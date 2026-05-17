import { logger } from "../logger.js";

  /**
   * APItxt Unified OTP API
   * Endpoint: https://apitxt.com/api/sendOTP
   * Required: authkey, mobile (10-digit, 91 auto-prepended), otp
   * Optional: channel — "sms" (default) | "whatsapp" | "voice"
   *
   * Env vars:
   *   APITXT_AUTH_KEY — your APItxt auth key (required)
   */
  export type OtpChannel = "sms" | "whatsapp" | "voice";

  export async function sendOtpViaApitxt(phone: string, otp: string, channel: OtpChannel = "sms"): Promise<boolean> {
    const authKey = process.env.APITXT_AUTH_KEY || "";

    if (!authKey) {
      throw new Error("APItxt not configured — set APITXT_AUTH_KEY env var.");
    }

    // Strip country code prefix if present — APItxt auto-prepends 91 for 10-digit numbers
    const mobile = phone.replace(/^\+?91/, "").replace(/\D/g, "");

    const body = {
      authkey: authKey,
      mobile,
      otp,
      channel,
      country: "91",
    };

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);

    try {
      const res = await fetch("https://apitxt.com/api/sendOTP", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      const text = await res.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch {}

      if (!res.ok || parsed?.status === "error") {
        const errMsg = parsed?.message || text.slice(0, 200);
        logger.warn({ channel, status: res.status, body: text.slice(0, 500) }, "apitxt OTP failed");
        throw new Error(`APItxt error: ${errMsg}`);
      }

      logger.info({ channel, phone: mobile.slice(-4), requestId: parsed?.data?.request_id, cost: parsed?.data?.cost }, "apitxt OTP sent");
      return true;
    } finally {
      clearTimeout(timer);
    }
  }

  export function apitxtConfigured(): boolean {
    return !!process.env.APITXT_AUTH_KEY;
  }
  