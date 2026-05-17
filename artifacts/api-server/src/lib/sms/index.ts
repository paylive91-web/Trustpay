import { sendOtpViaApitxt, apitxtConfigured, type OtpChannel } from "./apitxt.js";

  /**
   * SMS provider abstraction.
   * Uses APItxt — set APITXT_AUTH_KEY env var to enable.
   */
  export async function sendOtp(phone: string, otp: string, channel: OtpChannel = "sms"): Promise<void> {
    if (!apitxtConfigured()) {
      throw new Error("SMS not configured — set APITXT_AUTH_KEY env var on the server.");
    }
    await sendOtpViaApitxt(phone, otp, channel);
  }

  export function smsConfigured(): boolean {
    return apitxtConfigured();
  }

  export type { OtpChannel };
  