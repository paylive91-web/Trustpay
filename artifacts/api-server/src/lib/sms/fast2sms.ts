import { logger } from "../logger.js";

const FAST2SMS_BASE = "https://www.fast2sms.com/dev/bulkV2";

/**
 * Send a transactional OTP via Fast2SMS.
 *
 *  We use the Quick (`q`) route by default because it is the only route
 *  available to a brand-new Fast2SMS account out of the box — the dedicated
 *  `otp` route requires DLT/sender-id approval that takes days. Quick uses
 *  the default sender id "FSTSMS" and works on day one.
 *
 *  Cost is roughly ₹0.25 per SMS. The full OTP message is sent as the
 *  `message` parameter (no template variable interpolation on this route).
 *
 *  Optionally overridable via `FAST2SMS_ROUTE=otp` env var once the account
 *  has the OTP route activated.
 *
 *  Returns true on a 200 response with `return: true`. Throws with the
 *  provider's error message on failure so callers can surface a useful
 *  error to the user.
 */
export async function sendOtpViaFast2Sms(phone: string, otp: string): Promise<boolean> {
  const apiKey = process.env.FAST2SMS_API_KEY || "";
  if (!apiKey) {
    throw new Error("SMS provider not configured");
  }
  // Fast2SMS now mandates the dedicated OTP route on new accounts (the
  // Quick `q` route was retired post-TRAI). Override via FAST2SMS_ROUTE
  // env var if the account is later switched to DLT (route=dlt_manual).
  const route = (process.env.FAST2SMS_ROUTE || "otp").toLowerCase();

  // Use POST + JSON body + header-based auth — Fast2SMS's recommended
  // method. Query-string GET is supported but more flaky (URL-encoding
  // edge cases, stricter caching, occasional 404s on certain routes).
  const reqBody: Record<string, string> = {
    route,
    numbers: phone,
  };
  if (route === "otp") {
    reqBody.variables_values = otp;
  } else {
    reqBody.message = `Your TrustPay OTP is ${otp}. Valid for 5 minutes. Do not share with anyone.`;
    reqBody.language = "english";
    reqBody.flash = "0";
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(FAST2SMS_BASE, {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
        "cache-control": "no-cache",
      },
      body: JSON.stringify(reqBody),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch {}
    // Surface the actual Fast2SMS error message in BOTH the log and the
    // thrown error. Previously we threw a generic "SMS send failed (400)"
    // which made it impossible for the user (or us) to tell whether the
    // problem was a bad API key, an unverified sender id, insufficient
    // wallet balance, or something else.
    const fastMsg = (() => {
      if (body) {
        if (Array.isArray(body.message)) return body.message.join(", ");
        if (typeof body.message === "string") return body.message;
      }
      return text.slice(0, 200);
    })();
    if (!res.ok) {
      logger.warn({ status: res.status, body: text.slice(0, 500) }, "fast2sms non-200");
      throw new Error(`SMS provider error (${res.status}): ${fastMsg || "unknown"}`);
    }
    if (body && body.return === false) {
      logger.warn({ body }, "fast2sms returned false");
      throw new Error(`SMS provider rejected: ${fastMsg || "unknown reason"}`);
    }
    return true;
  } finally {
    clearTimeout(timer);
  }
}
