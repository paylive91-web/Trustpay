import { Jimp, intToRGBA } from "jimp";
import { db } from "@workspace/db";
import { imageHashesTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";

const PHASH_SIZE = 8;
const MIN_WIDTH = 100;
const MIN_HEIGHT = 150;
const MAX_PHASH_DISTANCE = 10;

const PAYMENT_KEYWORDS = [
  "success", "successful", "paid", "payment sent", "money sent",
  "transferred", "debited", "transaction successful", "txn successful",
  "₹", "rs.", "inr", "upi", "utr", "ref no", "reference", "transaction id",
  "txn id", "order id", "account debited", "amount paid", "payment complete",
  "payment done", "send money", "transfer complete", "approved",
];

export interface ImageAnalysisResult {
  hash: string;
  pHash: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  hasPaymentIndicators: boolean;
  qualityIssue: string | null;
}

export interface DuplicateCheckResult {
  isExactDuplicate: boolean;
  isSimilarDuplicate: boolean;
  duplicateUserId?: number;
  duplicateOrderId?: number;
  isSameUser: boolean;
  pHashDistance?: number;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return String(h >>> 0);
}

function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return MAX_PHASH_DISTANCE + 1;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

async function computePHash(buffer: Buffer): Promise<string | null> {
  try {
    const img = await Jimp.fromBuffer(buffer);
    const small = img.clone().resize(PHASH_SIZE + 1, PHASH_SIZE).greyscale();
    let bits = "";
    for (let y = 0; y < PHASH_SIZE; y++) {
      for (let x = 0; x < PHASH_SIZE; x++) {
        const left = intToRGBA(small.getPixelColor(x, y)).r;
        const right = intToRGBA(small.getPixelColor(x + 1, y)).r;
        bits += left > right ? "1" : "0";
      }
    }
    return bits;
  } catch {
    return null;
  }
}

function detectPaymentIndicators(text: string): boolean {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const kw of PAYMENT_KEYWORDS) {
    if (lower.includes(kw)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

export async function analyzeImage(
  dataUrl: string,
  ocrText?: string,
): Promise<ImageAnalysisResult> {
  const hash = simpleHash(dataUrl.slice(0, 10000));
  const fileSize = Math.round(dataUrl.length * 0.75);

  let pHash: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let qualityIssue: string | null = null;

  try {
    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const buffer = Buffer.from(base64, "base64");
    const img = await Jimp.fromBuffer(buffer);
    width = img.getWidth();
    height = img.getHeight();
    pHash = await computePHash(buffer);

    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      qualityIssue = `Image too small: ${width}x${height}px (minimum ${MIN_WIDTH}x${MIN_HEIGHT})`;
    }
  } catch {
    qualityIssue = "Could not read image data";
  }

  if (!qualityIssue && fileSize < 5000) {
    qualityIssue = "File too small — likely not a real screenshot";
  }

  const hasPaymentIndicators = detectPaymentIndicators(ocrText || "");

  return { hash, pHash, width, height, fileSize, hasPaymentIndicators, qualityIssue };
}

export async function checkDuplicate(
  hash: string,
  pHash: string | null,
  userId: number,
  orderId: number,
  kind: string,
): Promise<DuplicateCheckResult> {
  const existing = await db
    .select()
    .from(imageHashesTable)
    .where(and(eq(imageHashesTable.kind, kind), ne(imageHashesTable.orderId, orderId)));

  for (const row of existing) {
    if (row.hash === hash) {
      return {
        isExactDuplicate: true,
        isSimilarDuplicate: false,
        duplicateUserId: row.userId,
        duplicateOrderId: row.orderId,
        isSameUser: row.userId === userId,
      };
    }
    if (pHash && row.pHash) {
      const dist = hammingDistance(pHash, row.pHash);
      if (dist <= MAX_PHASH_DISTANCE) {
        return {
          isExactDuplicate: false,
          isSimilarDuplicate: true,
          duplicateUserId: row.userId,
          duplicateOrderId: row.orderId,
          isSameUser: row.userId === userId,
          pHashDistance: dist,
        };
      }
    }
  }
  return { isExactDuplicate: false, isSimilarDuplicate: false, isSameUser: false };
}

export async function getLearningStats() {
  const all = await db.select().from(imageHashesTable);

  const totalScreenshots = all.filter((r) => r.kind === "screenshot").length;
  const verifiedScreenshots = all.filter((r) => r.kind === "screenshot" && r.verifiedAt).length;
  const withPaymentIndicators = all.filter((r) => r.hasPaymentIndicators === true).length;
  const withoutPaymentIndicators = all.filter(
    (r) => r.kind === "screenshot" && r.hasPaymentIndicators === false,
  ).length;

  const duplicateAttempts = all.filter(
    (r) => r.kind === "screenshot",
  ).length - new Set(all.filter((r) => r.kind === "screenshot").map((r) => r.hash)).size;

  const last7Days = all.filter((r) => {
    const age = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return age <= 7;
  }).length;

  const last7DaysVerified = all.filter((r) => {
    if (!r.verifiedAt) return false;
    const age = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return age <= 7;
  }).length;

  return {
    totalScreenshots,
    verifiedScreenshots,
    withPaymentIndicators,
    withoutPaymentIndicators,
    duplicateAttempts: Math.max(0, duplicateAttempts),
    last7Days,
    last7DaysVerified,
    learningProgress: totalScreenshots > 0
      ? Math.round((verifiedScreenshots / totalScreenshots) * 100)
      : 0,
  };
}
