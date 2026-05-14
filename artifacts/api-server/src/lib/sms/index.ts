import { sendOtpViaApitxt, apitxtConfigured } from "./apitxt.js";

/**
 * SMS provider abstraction.
 * Uses APItxt — set APITXT_AUTH_KEY env var to enable.
 */
export async function sendOtp(phone: string, otp: string): Promise<void> {
  if (!apitxtConfigured()) {
    throw new Error("SMS not configured — set APITXT_AUTH_KEY env var on the server.");
  }
  await sendOtpViaApitxt(phone, otp);
}

export function smsConfigured(): boolean {
  return apitxtConfigured();
}
