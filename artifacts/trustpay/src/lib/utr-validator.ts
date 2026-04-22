const REPEATED_CHAR_RE = /^(.)\1+$/;

/**
 * Bank/UPI standard UTR formats observed in production:
 *   1. Prefix-letters + digits        : "T12345678901", "UPI12345678",  "HDFC12345678"
 *   2. All 12 digits                  : "412345678901" (most common UPI/IMPS)
 *   3. Mixed alphanumeric blocks      : "AXISN1234567890"
 */
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

/**
 * Detect debit-only messages so we don't accidentally auto-confirm
 * an order from the SELLER's outgoing payment SMS (e.g. seller paid for
 * something else and an SMS came in with a 12-char UTR).
 */
const DEBIT_HINT_RE =
  /\b(debited|withdrawn|spent|paid\s+to|sent\s+to|sent\s+via|deducted|debit\s+alert|w\/d|wdl|purchase\s+at|atm\s+wdl)\b/i;

const CREDIT_HINT_RE =
  /\b(credited|received|deposited|credit\s+alert|added\s+to|money\s+received|payment\s+received|cr\.?|recd\.?)\b/i;

function isLikelyDebit(sms: string): boolean {
  return DEBIT_HINT_RE.test(sms) && !CREDIT_HINT_RE.test(sms);
}

/**
 * UTR extraction patterns ordered from most-specific (keyword-anchored) to
 * least-specific (bare 12-char fallback).  Each captures group 1 = UTR.
 *
 * Covers:
 *  - PhonePe   "UPI Ref. ID: 412345678901"
 *  - GPay      "UPI transaction ID: 412345678901"
 *  - Paytm     "UPI Ref No: 412345678901" / "Ref Id: 412345678901"
 *  - AmazonPay "RRN: 412345678901"
 *  - HDFC/ICICI/SBI/Axis credit SMS  "UPI/CR/412345678901" "UPI:412345678901"
 *  - Generic   "UTR: ...", "Reference: ...", "Txn Id: ..."
 *  - IMPS/NEFT/RTGS variants
 */
const UTR_PATTERNS: RegExp[] = [
  // UPI Ref ID / UPI Ref No / UPI Reference Number / UPI Txn Id
  /(?:UPI\s*(?:Ref(?:erence)?|Txn|Trans(?:action)?))\s*(?:ID|Id|No|Number|#)?\s*[:.#-]*\s*([A-Z0-9]{12})\b/i,
  // RRN (used by Amazon Pay, ICICI etc.)
  /\bRRN\b\s*[:.#-]*\s*([A-Z0-9]{12})\b/i,
  // Slash-style: "UPI/CR/412345678901" "UPI/credit/412345678901" "UPI/P2A/412345678901"
  /UPI\s*[/:][A-Z0-9]{1,12}[/:]\s*([A-Z0-9]{12})\b/i,
  // "UPI:412345678901" / "UPI 412345678901"
  /\bUPI\b\s*[:#-]*\s*([A-Z0-9]{12})\b/i,
  // "UTR: 412345678901" / "UTR No 412345678901"
  /\bUTR\b\s*(?:No|Number|#)?\s*[:.#-]*\s*([A-Z0-9]{12})\b/i,
  // "Ref No 412345678901" / "Ref. No. 412345678901" / "Reference: 412345678901"
  /\b(?:Ref(?:erence)?)\b\s*(?:No|Number|ID|Id|#)?\s*[:.#-]*\s*([A-Z0-9]{12})\b/i,
  // "Txn Id: 412345678901" / "Transaction ID: 412345678901"
  /\b(?:Txn|Trans(?:action)?)\b\s*(?:Id|ID|No|Number|Ref|Reference|#)?\s*[:.#-]*\s*([A-Z0-9]{12})\b/i,
  // IMPS / NEFT / RTGS
  /\b(?:IMPS|NEFT|RTGS)\b\s*(?:Ref|ID|No|Reference)?\s*[:.#-]*\s*([A-Z0-9]{12})\b/i,
  // Bare 12-char fallback (lowest priority)
  /\b([A-Z0-9]{12})\b/i,
];

/**
 * Amount extraction. Captures a positive ₹/Rs/INR amount with optional decimals
 * and comma grouping. Tries currency-prefix first, then suffix form.
 */
const AMOUNT_PATTERNS: RegExp[] = [
  /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /([\d,]+(?:\.\d{1,2})?)\s*(?:Rs\.?|INR|₹|rupees?)/i,
];

function extractAmount(sms: string): number | null {
  for (const re of AMOUNT_PATTERNS) {
    const m = sms.match(re);
    if (m) {
      const n = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return null;
}

/**
 * Parse a bank/UPI/wallet SMS and return {utr, amount} on success.
 * Returns null if:
 *   - The SMS is a debit-only notification
 *   - No 12-char bank-standard UTR is found
 *   - No positive amount is found
 *   - The extracted UTR fails isValidUtr() / isBankStandardUtr()
 */
export function parseBankSms(sms: string): ParsedSmsUtr | null {
  if (!sms || typeof sms !== "string") return null;
  if (isLikelyDebit(sms)) return null;

  const amount = extractAmount(sms);
  if (amount === null) return null;

  const seen = new Set<string>();
  for (const re of UTR_PATTERNS) {
    const matches = sms.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"));
    for (const m of matches) {
      const candidate = (m[1] || "").toUpperCase();
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      if (isValidUtr(candidate) && isBankStandardUtr(candidate)) {
        return { utr: candidate, amount };
      }
    }
  }
  return null;
}
