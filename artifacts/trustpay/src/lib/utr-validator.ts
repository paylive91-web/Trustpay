const REPEATED_CHAR_RE = /^(.)\1+$/;

const BANK_UTR_PATTERNS = [
  /^[A-Z]{1,6}\d{6,11}$/,
  /^\d{12}$/,
  /^[A-Z]{2,4}[A-Z0-9]{8,10}$/,
];

export function isValidUtr(utr: string): boolean {
  const t = utr.trim().toUpperCase();
  if (!/^[A-Z0-9]{12}$/.test(t)) return false;
  if (REPEATED_CHAR_RE.test(t)) return false;
  return true;
}

export function isBankStandardUtr(utr: string): boolean {
  const t = utr.trim().toUpperCase();
  return BANK_UTR_PATTERNS.some((re) => re.test(t));
}

export function utrError(utr: string): string | null {
  const t = utr.trim();
  if (!t) return null;
  if (t.length < 12) return `UTR 12 characters ka hona chahiye (abhi ${t.length} hain)`;
  if (t.length > 12) return `UTR 12 se zyada characters nahi hone chahiye (abhi ${t.length} hain)`;
  if (!/^[A-Z0-9]+$/i.test(t)) return "UTR mein sirf letters (A-Z) aur numbers (0-9) hote hain";
  if (REPEATED_CHAR_RE.test(t.toUpperCase())) return "UTR valid nahi lagta — ek hi character baar baar repeat ho raha hai";
  if (!isBankStandardUtr(t)) return "UTR bank-standard format mein nahi hai (e.g. T12345678901, HDFC12345678)";
  return null;
}

export interface ParsedSmsUtr {
  utr: string;
  amount: number;
}

const SMS_PATTERNS: Array<{ utrRe: RegExp; amountRe: RegExp }> = [
  { utrRe: /(?:UTR|UPI Ref|Ref No)[:\s#.]*([A-Z0-9]{12})/i, amountRe: /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i },
  { utrRe: /(?:UPI|IMPS|NEFT|RTGS)[:\s]+([A-Z0-9]{12})/i, amountRe: /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i },
  { utrRe: /txn\s*(?:id|ref)[:\s#]*([A-Z0-9]{12})/i, amountRe: /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i },
  { utrRe: /([A-Z0-9]{12})/, amountRe: /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/ },
];

export function parseBankSms(sms: string): ParsedSmsUtr | null {
  for (const p of SMS_PATTERNS) {
    const utrM = sms.match(p.utrRe);
    const amtM = sms.match(p.amountRe);
    if (utrM && amtM) {
      const utr = utrM[1].toUpperCase();
      const amount = parseFloat(amtM[1].replace(/,/g, ""));
      if (isValidUtr(utr) && amount > 0) return { utr, amount };
    }
  }
  return null;
}
