import { logger } from "../logger.js";

const APITXT_BASE = "https://apitxt.com/api/sendMsg";

/**
 * Send an OTP via APItxt SMS gateway.
 * Only 3 things required: Auth Key, mobile number, OTP value.
 *
 * Env vars:
 *   APITXT_AUTH_KEY  — your APItxt auth key (required)
 *   APITXT_SENDER    — sender ID (default: GLBLNT)
 *   APITXT_ROUTE     — route (default: 1)
 */
export async function sendOtpViaApitxt(phone: string, otp: string): Promise<boolean> {
  const authKey = process.env.APITXT_AUTH_KEY || "";
  const sender  = process.env.APITXT_SENDER || "GLBLNT";
  const route   = process.env.APITXT_ROUTE  || "1";

  if (!authKey) {
    throw new Error("APItxt not configured — set APITXT_AUTH_KEY env var.");
  }

  const message = `Your TrustPay OTP is ${otp}. Valid for 5 minutes. Do not share with anyone.`;

  const body = {
    authkey:     authKey,
    mobiles:     phone,
    message,
    sender,
    route,
    template_id: "",
    pe_id:       "",
  };

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);

  try {
    const res = await fetch(APITXT_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}

    const msg = (() => {
      if (parsed) {
        if (typeof parsed.message === "string") return parsed.message;
        if (Array.isArray(parsed.message))      return parsed.message.join(", ");
      }
      return text.slice(0, 200);
    })();

    if (!res.ok) {
      logger.warn({ status: res.status, body: text.slice(0, 500) }, "apitxt non-200");
      throw new Error(`APItxt error (${res.status}): ${msg || "unknown"}`);
    }

    logger.info({ phone: phone.slice(-4), requestId: parsed?.request_id, msg }, "apitxt OTP sent");
    return true;
  } finally {
    clearTimeout(timer);
  }
}

export function apitxtConfigured(): boolean {
  return !!process.env.APITXT_AUTH_KEY;
}
