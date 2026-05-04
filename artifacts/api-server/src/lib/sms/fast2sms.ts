import { logger } from "../logger.js";

const FAST2SMS_BASE = "https://www.fast2sms.com/dev/bulkV2";

/**
 * Send a transactional OTP via Fast2SMS Quick (Q) route.
 *
 *  - Quick route uses the default sender id "FSTSMS" and does NOT require
 *    DLT registration, so it works the day the API key is issued.
 *  - Cost is roughly ₹0.25 per SMS (varies by operator).
 *  - The variables_values field is the OTP digits and is interpolated into
 *    Fast2SMS's stock template: "Your OTP: {#var#}. ...".
 *
 *  Returns true on a 200 response with `return: true`. Throws on network or
 *  HTTP failure so callers can surface a useful error to the user.
 */
export async function sendOtpViaFast2Sms(phone: string, otp: string): Promise<boolean> {
  const apiKey = process.env.FAST2SMS_API_KEY || "";
  if (!apiKey) {
    throw new Error("SMS provider not configured");
  }
  const url = new URL(FAST2SMS_BASE);
  url.searchParams.set("authorization", apiKey);
  url.searchParams.set("variables_values", otp);
  url.searchParams.set("route", "otp");
  url.searchParams.set("numbers", phone);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "cache-control": "no-cache" },
      signal: ctrl.signal,
    });
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch {}
    if (!res.ok) {
      logger.warn({ status: res.status, body: text.slice(0, 300) }, "fast2sms non-200");
      throw new Error(`SMS send failed (${res.status})`);
    }
    if (body && body.return === false) {
      const msg = String(body.message || "SMS send failed");
      logger.warn({ body }, "fast2sms returned false");
      throw new Error(msg);
    }
    return true;
  } finally {
    clearTimeout(timer);
  }
}
