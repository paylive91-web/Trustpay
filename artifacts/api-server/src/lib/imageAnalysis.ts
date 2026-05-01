import { Jimp, intToRGBA } from "jimp";
import { db } from "@workspace/db";
import { imageHashesTable } from "@workspace/db";
import { eq, and, ne, desc, sql } from "drizzle-orm";

// --- Upgraded pHash: 16x16 = 256 bits (was 8x8 = 64 bits) ---
const PHASH_SIZE = 16;
const MIN_WIDTH = 100;
const MIN_HEIGHT = 150;
// Scale threshold proportionally: 10/64 ≈ 15.6% → 40/256
const MAX_PHASH_DISTANCE = 40;

// EXIF editing software signatures to flag
const EDITING_SOFTWARE = [
  "photoshop", "gimp", "lightroom", "picsart", "snapseed", "facetune",
  "adobe", "pixlr", "canva", "afterlight", "vsco", "inshot",
  "meitu", "beautycam", "airbrush", "retouch", "picmonkey",
  "fotor", "polarr", "remini", "photo editor", "photo studio",
];

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
  elaScore: number | null;
  elaTampered: boolean;
  exifSoftware: string | null;
  exifSuspicious: boolean;
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

// --- Stronger pHash: 16x16 gradient-based ---
async function computePHash(buffer: Buffer): Promise<string | null> {
  try {
    const img = await Jimp.fromBuffer(buffer);
    const small = img.clone().resize({ w: PHASH_SIZE + 1, h: PHASH_SIZE }).greyscale();
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

// --- ELA: Error Level Analysis for tamper detection ---
async function computeELA(buffer: Buffer): Promise<{ elaScore: number; isTampered: boolean }> {
  try {
    const original = await Jimp.fromBuffer(buffer);
    const W = original.width;
    const H = original.height;

    // Resize to max 320px wide for speed — keeps aspect ratio
    const scale = Math.min(1, 320 / W);
    const rW = Math.max(16, Math.round(W * scale));
    const rH = Math.max(16, Math.round(H * scale));
    const resized = original.clone().resize({ w: rW, h: rH });

    // Re-encode as JPEG (lossy) then reload → simulates one compression cycle
    const jpegBuf = await resized.getBuffer("image/jpeg");
    const recompressed = await Jimp.fromBuffer(jpegBuf);

    const blockSize = 8;
    const blockErrors: number[] = [];

    for (let by = 0; by + blockSize <= rH; by += blockSize) {
      for (let bx = 0; bx + blockSize <= rW; bx += blockSize) {
        let err = 0;
        for (let y = by; y < by + blockSize; y++) {
          for (let x = bx; x < bx + blockSize; x++) {
            const o = intToRGBA(resized.getPixelColor(x, y));
            const r = intToRGBA(recompressed.getPixelColor(x, y));
            err += Math.abs(o.r - r.r) + Math.abs(o.g - r.g) + Math.abs(o.b - r.b);
          }
        }
        blockErrors.push(err / (blockSize * blockSize * 3));
      }
    }

    if (blockErrors.length < 4) return { elaScore: 0, isTampered: false };

    const mean = blockErrors.reduce((a, b) => a + b, 0) / blockErrors.length;
    const variance = blockErrors.reduce((a, b) => a + (b - mean) ** 2, 0) / blockErrors.length;
    const stdDev = Math.sqrt(variance);

    // High std-deviation relative to mean = inconsistent compression = likely tampered
    const elaScore = Math.round(stdDev * 10) / 10;
    // Threshold: stdDev > 18 AND mean in a reasonable range (not just a blank/solid image)
    const isTampered = stdDev > 18 && mean > 1 && mean < 60;

    return { elaScore, isTampered };
  } catch {
    return { elaScore: 0, isTampered: false };
  }
}

// --- EXIF Validation: scan raw buffer for editing software strings ---
function validateExif(buffer: Buffer): { software: string | null; suspicious: boolean } {
  try {
    // Scan first 64KB of raw bytes for EXIF/metadata software strings
    const scan = buffer.slice(0, Math.min(buffer.length, 65536)).toString("latin1").toLowerCase();

    for (const sw of EDITING_SOFTWARE) {
      if (scan.includes(sw)) {
        return { software: sw, suspicious: true };
      }
    }

    // Check for APP1/EXIF marker in JPEG (0xFF 0xE1)
    // and look for unrealistic dates (year < 2018 or > current year)
    const currentYear = new Date().getFullYear();
    for (let y = 2000; y < 2018; y++) {
      if (scan.includes(`:${y}:`) || scan.includes(`${y}:01:`) || scan.includes(`${y}:00:`)) {
        return { software: `old-date:${y}`, suspicious: true };
      }
    }
    if (scan.includes(`:${currentYear + 1}:`) || scan.includes(`:${currentYear + 2}:`)) {
      return { software: `future-date`, suspicious: true };
    }

    return { software: null, suspicious: false };
  } catch {
    return { software: null, suspicious: false };
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
  let elaScore: number | null = null;
  let elaTampered = false;
  let exifSoftware: string | null = null;
  let exifSuspicious = false;

  try {
    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const buffer = Buffer.from(base64, "base64");
    const img = await Jimp.fromBuffer(buffer);
    width = img.width;
    height = img.height;

    // Memory: a 3MB phone screenshot decoded is ~30MB+ in RAM. Resize to a
    // bounded working buffer (max 1000px on longest side) so pHash/ELA only
    // ever see ~5MB max. Quality detection uses the original `width/height`
    // captured above, not the resized buffer.
    let workBuffer: Buffer = buffer;
    const MAX_DIM = 1000;
    if (width > MAX_DIM || height > MAX_DIM) {
      const scaledW = width > height ? MAX_DIM : Math.round((width * MAX_DIM) / height);
      img.resize({ w: scaledW });
      workBuffer = Buffer.from(await img.getBuffer("image/jpeg", { quality: 80 }));
    }

    // Sequential, not parallel: parallel processing 3 image pipelines on a
    // 512MB instance triples peak memory. Slightly slower per request, but
    // prevents OOM under concurrent uploads.
    pHash = await computePHash(workBuffer);
    const elaResult = await computeELA(workBuffer);
    elaScore = elaResult.elaScore;
    elaTampered = elaResult.isTampered;
    const exifResult = validateExif(buffer);
    exifSoftware = exifResult.software;
    exifSuspicious = exifResult.suspicious;

    if (width !== null && height !== null && (width < MIN_WIDTH || height < MIN_HEIGHT)) {
      qualityIssue = `Image too small: ${width}x${height}px (minimum ${MIN_WIDTH}x${MIN_HEIGHT})`;
    }
  } catch {
    qualityIssue = "Could not read image data";
  }

  if (!qualityIssue && fileSize < 5000) {
    qualityIssue = "File too small — likely not a real screenshot";
  }

  const hasPaymentIndicators = detectPaymentIndicators(ocrText || "");

  return {
    hash, pHash, width, height, fileSize,
    hasPaymentIndicators, qualityIssue,
    elaScore, elaTampered,
    exifSoftware, exifSuspicious,
  };
}

export async function checkDuplicate(
  hash: string,
  pHash: string | null,
  userId: number,
  orderId: number,
  kind: string,
): Promise<DuplicateCheckResult> {
  // Step 1: Exact-hash lookup is indexed and O(1). Cheap regardless of table size.
  const exact = await db
    .select()
    .from(imageHashesTable)
    .where(
      and(
        eq(imageHashesTable.kind, kind),
        eq(imageHashesTable.hash, hash),
        ne(imageHashesTable.orderId, orderId),
      ),
    )
    .limit(1);
  if (exact.length > 0) {
    const row = exact[0];
    return {
      isExactDuplicate: true,
      isSimilarDuplicate: false,
      duplicateUserId: row.userId,
      duplicateOrderId: row.orderId,
      isSameUser: row.userId === userId,
    };
  }

  // Step 2: pHash similarity scan — bounded to last 2000 rows for memory
  // safety. Older fraud history beyond that is statistically irrelevant for
  // active duplicate detection (real reuse happens within days).
  if (!pHash) {
    return { isExactDuplicate: false, isSimilarDuplicate: false, isSameUser: false };
  }
  const recent = await db
    .select({
      userId: imageHashesTable.userId,
      orderId: imageHashesTable.orderId,
      pHash: imageHashesTable.pHash,
    })
    .from(imageHashesTable)
    .where(and(eq(imageHashesTable.kind, kind), ne(imageHashesTable.orderId, orderId)))
    .orderBy(desc(imageHashesTable.createdAt))
    .limit(2000);

  for (const row of recent) {
    if (!row.pHash) continue;
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
  return { isExactDuplicate: false, isSimilarDuplicate: false, isSameUser: false };
}

export async function getLearningStats() {
  // SQL-side aggregations only — never load all rows into Node memory.
  const rows = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE kind = 'screenshot')::int AS total_screenshots,
      COUNT(*) FILTER (WHERE kind = 'screenshot' AND verified_at IS NOT NULL)::int AS verified_screenshots,
      COUNT(*) FILTER (WHERE has_payment_indicators = true)::int AS with_payment_indicators,
      COUNT(*) FILTER (WHERE kind = 'screenshot' AND has_payment_indicators = false)::int AS without_payment_indicators,
      COUNT(*) FILTER (WHERE kind = 'screenshot' AND created_at > NOW() - INTERVAL '7 days')::int AS last_7_days,
      COUNT(*) FILTER (WHERE kind = 'screenshot' AND verified_at IS NOT NULL AND created_at > NOW() - INTERVAL '7 days')::int AS last_7_days_verified,
      (COUNT(*) FILTER (WHERE kind = 'screenshot') - COUNT(DISTINCT hash) FILTER (WHERE kind = 'screenshot'))::int AS duplicate_attempts
    FROM image_hashes
  `);
  const r: any = (rows as any).rows?.[0] ?? (Array.isArray(rows) ? rows[0] : rows);
  const totalScreenshots = Number(r?.total_screenshots ?? 0);
  const verifiedScreenshots = Number(r?.verified_screenshots ?? 0);
  return {
    totalScreenshots,
    verifiedScreenshots,
    withPaymentIndicators: Number(r?.with_payment_indicators ?? 0),
    withoutPaymentIndicators: Number(r?.without_payment_indicators ?? 0),
    duplicateAttempts: Math.max(0, Number(r?.duplicate_attempts ?? 0)),
    last7Days: Number(r?.last_7_days ?? 0),
    last7DaysVerified: Number(r?.last_7_days_verified ?? 0),
    learningProgress: totalScreenshots > 0
      ? Math.round((verifiedScreenshots / totalScreenshots) * 100)
      : 0,
  };
}
