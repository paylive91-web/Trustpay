import { createWorker } from "tesseract.js";
import { logger } from "./logger.js";

export interface OcrResult {
  rawText: string;
  utr: string | null;
  amount: string | null;
  timestamp: string | null;
  bank: string | null;
  status: "done" | "unreadable" | "failed";
}

const KNOWN_BANKS = [
  "HDFC", "ICICI", "SBI", "AXIS", "KOTAK", "IDBI", "BOB", "PNB",
  "CANARA", "UNION", "YES BANK", "YESBANK", "BANDHAN", "FEDERAL",
  "INDUSIND", "RBL", "PAYTM", "PHONEPE", "GPAY", "GOOGLE PAY",
  "AMAZON PAY", "BHIM", "NAVI", "JUSPAY", "RAZORPAY",
  "BARODA", "BANK OF BARODA", "PUNJAB", "INDIAN BANK",
];

const UTR_PATTERNS = [
  /\b[A-Z]{1,6}\d{8,12}\b/g,
  /\b\d{12}\b/g,
  /\b[A-Z]{2,4}[A-Z0-9]{8,10}\b/g,
  /\bUTR[:\s#]*([A-Z0-9]{10,22})\b/gi,
  /\bRef(?:erence)?[:\s#]*([A-Z0-9]{10,22})\b/gi,
  /\bTransaction\s*(?:ID|No|Ref)[:\s#]*([A-Z0-9]{10,22})\b/gi,
];

const AMOUNT_PATTERNS = [
  /₹\s*([\d,]+(?:\.\d{1,2})?)/g,
  /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/gi,
  /INR\s*([\d,]+(?:\.\d{1,2})?)/gi,
  /Amount[:\s]*([\d,]+(?:\.\d{1,2})?)/gi,
  /\bPaid[:\s]*([\d,]+(?:\.\d{1,2})?)/gi,
  /\bTotal[:\s]*([\d,]+(?:\.\d{1,2})?)/gi,
];

const TIMESTAMP_PATTERNS = [
  /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)/gi,
  /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)/gi,
  /\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)/gi,
  /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g,
];

function extractUtr(text: string): string | null {
  const upper = text.toUpperCase();
  for (const pattern of UTR_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = upper.matchAll(pattern);
    for (const m of matches) {
      const candidate = (m[1] || m[0]).replace(/\s+/g, "");
      if (candidate.length >= 10 && candidate.length <= 22) {
        return candidate;
      }
    }
  }
  return null;
}

function extractAmount(text: string): string | null {
  const candidates: number[] = [];
  for (const pattern of AMOUNT_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.matchAll(pattern);
    for (const m of matches) {
      const raw = (m[1] || m[0]).replace(/,/g, "").trim();
      const num = parseFloat(raw);
      if (!isNaN(num) && num > 0 && num < 10_000_000) {
        candidates.push(num);
      }
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b - a);
  return candidates[0].toFixed(2);
}

function extractTimestamp(text: string): string | null {
  for (const pattern of TIMESTAMP_PATTERNS) {
    pattern.lastIndex = 0;
    const m = pattern.exec(text);
    if (m) {
      return m[0].trim();
    }
  }
  return null;
}

function extractBank(text: string): string | null {
  const upper = text.toUpperCase();
  for (const bank of KNOWN_BANKS) {
    if (upper.includes(bank)) return bank;
  }
  return null;
}

let workerInstance: Awaited<ReturnType<typeof createWorker>> | null = null;
let workerReady = false;

async function getWorker() {
  if (workerInstance && workerReady) return workerInstance;
  try {
    workerInstance = await createWorker("eng", 1, {
      logger: () => {},
    });
    workerReady = true;
    return workerInstance;
  } catch (err) {
    logger.error({ err }, "Tesseract worker init failed");
    throw err;
  }
}

const OCR_TIMEOUT_MS = 30_000;

/**
 * Run OCR on a payment screenshot.
 * Accepts either a Buffer (pre-loaded image bytes) or a data URL string
 * (base64-encoded). External URL strings are rejected to prevent SSRF.
 */
export async function runOcr(input: Buffer | string): Promise<OcrResult> {
  let imageBuffer: Buffer;

  if (Buffer.isBuffer(input)) {
    if (input.length < 100) {
      return { rawText: "", utr: null, amount: null, timestamp: null, bank: null, status: "failed" };
    }
    imageBuffer = input;
  } else {
    if (!input || input.length < 100) {
      return { rawText: "", utr: null, amount: null, timestamp: null, bank: null, status: "failed" };
    }
    // Security: only accept data URLs (base64-encoded images). Reject external
    // URLs to prevent SSRF — Tesseract.js can fetch URLs if passed a string
    // that isn't decoded locally first.
    if (!input.startsWith("data:")) {
      logger.warn("runOcr: rejected non-data-URL input (SSRF guard)");
      return { rawText: "", utr: null, amount: null, timestamp: null, bank: null, status: "failed" };
    }
    const base64Part = input.split(",")[1];
    if (!base64Part) throw new Error("Invalid data URL: missing base64 payload");
    imageBuffer = Buffer.from(base64Part, "base64");
  }

  try {
    const worker = await getWorker();
    // Apply a timeout to prevent OCR worker contention under load
    const recognizeWithTimeout = new Promise<{ data: { text: string } }>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("OCR timeout")), OCR_TIMEOUT_MS);
      worker.recognize(imageBuffer).then((r) => { clearTimeout(t); resolve(r); }).catch(reject);
    });
    const { data } = await recognizeWithTimeout;
    const rawText = (data.text || "").trim();

    if (!rawText || rawText.length < 10) {
      return { rawText, utr: null, amount: null, timestamp: null, bank: null, status: "unreadable" };
    }

    const utr = extractUtr(rawText);
    const amount = extractAmount(rawText);
    const timestamp = extractTimestamp(rawText);
    const bank = extractBank(rawText);

    return { rawText, utr, amount, timestamp, bank, status: "done" };
  } catch (err) {
    logger.error({ err }, "OCR failed");
    return { rawText: "", utr: null, amount: null, timestamp: null, bank: null, status: "failed" };
  }
}
