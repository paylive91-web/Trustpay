import { sendOtpViaApitxt, apitxtConfigured } from "./apitxt.js";
import { sendOtpViaFast2Sms } from "./fast2sms.js";

/**
 * SMS provider abstraction.
 * Priority: APItxt (if APITXT_AUTH_KEY + APITXT_SENDER set) → Fast2SMS fallback.
 * Callers must NEVER import provider modules directly.
 */
export async function sendOtp(phone: string, otp: string): Promise<void> {
  if (apitxtConfigured()) {
    await sendOtpViaApitxt(phone, otp);
  } else {
    await sendOtpViaFast2Sms(phone, otp);
  }
}

export function smsConfigured(): boolean {
  return apitxtConfigured() || !!process.env.FAST2SMS_API_KEY;
}
