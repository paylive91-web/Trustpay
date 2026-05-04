import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { sendOtp } from "./sms/index.js";
import { logger } from "./logger.js";

// Same SESSION_SECRET used by lib/auth.ts. Importing rather than re-reading
// from env keeps a single source of truth and ensures the fail-fast guard
// in lib/auth.ts runs first.
const JWT_SECRET = process.env.SESSION_SECRET as string;

export type OtpPurpose = "register" | "forgot";

const OTP_TTL_MS = 5 * 60 * 1000;          // OTP valid for 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;       // 60s between sends per phone
const PER_PHONE_HOURLY_LIMIT = 3;           // max 3 OTP sends per phone per hour
const PER_IP_HOURLY_LIMIT = 5;              // max 5 OTP sends per IP per hour
const VERIFIED_TOKEN_TTL = "10m";           // verifiedToken validity after OTP success

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Anti-spam guards before issuing a new OTP. Each guard returns an error
 * string on rejection or null on success. Caller maps to HTTP 429.
 */
async function preflightSendChecks(phone: string, ip: string, purpose: OtpPurpose): Promise<string | null> {
  // 1) Resend cooldown — block sub-60s repeats for the same phone+purpose.
  const recent = await db.execute(sql`
    SELECT created_at FROM otp_codes
    WHERE phone = ${phone} AND purpose = ${purpose}
    ORDER BY created_at DESC LIMIT 1
  `);
  const lastRow = (recent as any).rows?.[0] || (recent as any)[0];
  if (lastRow?.created_at) {
    const elapsed = Date.now() - new Date(lastRow.created_at).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return `Please wait ${wait}s before requesting another OTP`;
    }
  }
  // 2) Per-phone hourly cap.
  const phCount = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM otp_codes
    WHERE phone = ${phone} AND created_at > NOW() - INTERVAL '1 hour'
  `);
  const phN = Number((phCount as any).rows?.[0]?.n ?? (phCount as any)[0]?.n ?? 0);
  if (phN >= PER_PHONE_HOURLY_LIMIT) {
    return "Too many OTP requests on this number. Try again after 1 hour.";
  }
  // 3) Per-IP hourly cap.
  if (ip) {
    const ipCount = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM otp_rate_limits
      WHERE ip = ${ip} AND created_at > NOW() - INTERVAL '1 hour'
    `);
    const ipN = Number((ipCount as any).rows?.[0]?.n ?? (ipCount as any)[0]?.n ?? 0);
    if (ipN >= PER_IP_HOURLY_LIMIT) {
      return "Too many OTP requests from this network. Try again later.";
    }
  }
  return null;
}

export async function issueOtp(opts: { phone: string; purpose: OtpPurpose; ip: string }): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { phone, purpose, ip } = opts;
  const guard = await preflightSendChecks(phone, ip, purpose);
  if (guard) return { ok: false, error: guard, status: 429 };

  const otp = generateOtp();
  const codeHash = await bcrypt.hash(otp, 8);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  // Invalidate any prior unconsumed OTPs for this phone+purpose so an
  // attacker can't keep an old code alive while a new one is in flight.
  await db.execute(sql`
    UPDATE otp_codes SET consumed_at = NOW()
    WHERE phone = ${phone} AND purpose = ${purpose} AND consumed_at IS NULL
  `);
  await db.execute(sql`
    INSERT INTO otp_codes (phone, purpose, code_hash, expires_at)
    VALUES (${phone}, ${purpose}, ${codeHash}, ${expiresAt})
  `);
  if (ip) {
    await db.execute(sql`INSERT INTO otp_rate_limits (ip) VALUES (${ip})`);
  }

  try {
    await sendOtp(phone, otp);
  } catch (err: any) {
    logger.error({ err: String(err?.message || err), phone }, "sendOtp failed");
    return { ok: false, error: err?.message || "Failed to send OTP", status: 502 };
  }
  return { ok: true };
}

/**
 * Verify a submitted OTP. On success returns a short-lived signed
 * "verifiedToken" the client must include in the subsequent register /
 * forgot-password call. Token binds to phone + purpose so it can't be
 * reused for a different flow.
 */
export async function verifyOtpAndIssueToken(opts: { phone: string; purpose: OtpPurpose; code: string }): Promise<{ ok: true; verifiedToken: string } | { ok: false; error: string; status: number }> {
  const { phone, purpose, code } = opts;
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "Invalid OTP", status: 400 };
  const rowsRes = await db.execute(sql`
    SELECT id, code_hash, expires_at, attempts FROM otp_codes
    WHERE phone = ${phone} AND purpose = ${purpose} AND consumed_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `);
  const row = (rowsRes as any).rows?.[0] || (rowsRes as any)[0];
  if (!row) return { ok: false, error: "OTP expired. Please request a new one.", status: 400 };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "OTP expired. Please request a new one.", status: 400 };
  }
  if ((row.attempts ?? 0) >= 5) {
    await db.execute(sql`UPDATE otp_codes SET consumed_at = NOW() WHERE id = ${row.id}`);
    return { ok: false, error: "Too many wrong attempts. Please request a new OTP.", status: 429 };
  }
  const ok = await bcrypt.compare(code, row.code_hash);
  if (!ok) {
    await db.execute(sql`UPDATE otp_codes SET attempts = COALESCE(attempts,0) + 1 WHERE id = ${row.id}`);
    return { ok: false, error: "Wrong OTP. Please try again.", status: 400 };
  }
  await db.execute(sql`UPDATE otp_codes SET consumed_at = NOW() WHERE id = ${row.id}`);
  const verifiedToken = jwt.sign({ phone, purpose, kind: "otp" }, JWT_SECRET, { expiresIn: VERIFIED_TOKEN_TTL });
  return { ok: true, verifiedToken };
}

export function consumeVerifiedToken(token: string, expectedPurpose: OtpPurpose, expectedPhone: string): boolean {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return payload?.kind === "otp" && payload.purpose === expectedPurpose && payload.phone === expectedPhone;
  } catch {
    return false;
  }
}
