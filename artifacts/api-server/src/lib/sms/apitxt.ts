import { logger } from "../logger.js";

const APITXT_BASE = "https://apitxt.com/api/sendMsg";

/**
 * Send an OTP via APItxt SMS gateway.
 *
 * Credentials come from environment variables:
 *   APITXT_AUTH_KEY   — your APItxt auth key (required)
 *   APITXT_SENDER     — 6-char uppercase sender ID, e.g. TRSTPY (required)
 *   APITXT_ROUTE      — '1' promotional, '4' transactional (default: '4')
 *   APITXT_TEMPLATE_ID — DLT template ID (optional, leave blank if no DLT)
 *   APITXT_PE_ID      — DLT principal entity ID (optional, leave blank if no DLT)
 */
export async function sendOtpViaApitxt(phone: string, otp: string): Promise<boolean> {
  const authKey = process.env.APITXT_AUTH_KEY || "";
  const sender  = process.env.APITXT_SENDER   || "";
  const route   = process.env.APITXT_ROUTE    || "4";
  const templateId = process.env.APITXT_TEMPLATE_ID || "";
  const peId       = process.env.APITXT_PE_ID       || "";

  if (!authKey || !sender) {
    throw new Error("APItxt not configured — set APITXT_AUTH_KEY and APITXT_SENDER env vars.");
  }

  const message = `Your TrustPay OTP is ${otp}. Valid for 5 minutes. Do not share with anyone.`;

  const body: Record<string, string> = {
    authkey:  authKey,
    mobiles:  phone,
    message,
    sender,
    route,
    template_id: templateId,
    pe_id:       peId,
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

    if (parsed && parsed.status !== 200 && parsed.message?.toLowerCase().includes("error")) {
      logger.warn({ parsed }, "apitxt returned error in body");
      throw new Error(`APItxt rejected: ${msg}`);
    }

    logger.info({ phone: phone.slice(-4), route, requestId: parsed?.request_id }, "apitxt accepted");
    return true;
  } finally {
    clearTimeout(timer);
  }
}

export function apitxtConfigured(): boolean {
  return !!(process.env.APITXT_AUTH_KEY && process.env.APITXT_SENDER);
}
