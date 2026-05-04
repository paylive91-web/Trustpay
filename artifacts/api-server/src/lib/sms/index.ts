import { sendOtpViaFast2Sms } from "./fast2sms.js";

/**
 * SMS provider abstraction. Today only Fast2SMS is wired up, but exposing a
 * single `sendOtp` function lets us swap to MSG91 / Twilio / etc. by editing
 * one file. Callers must NEVER import the Fast2SMS module directly.
 */
export async function sendOtp(phone: string, otp: string): Promise<void> {
  await sendOtpViaFast2Sms(phone, otp);
}

export function smsConfigured(): boolean {
  return !!process.env.FAST2SMS_API_KEY;
}
