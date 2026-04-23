import { db } from "@workspace/db";
import { smsLearningQueueTable, smsSafeSendersTable, smsCandidatePatternsTable } from "@workspace/db";
import { sql, and, eq } from "drizzle-orm";

const DEBIT_HINT_RE =
  /\b(debited|withdrawn|spent|paid\s+to|sent\s+to|sent\s+via|deducted|debit\s+alert|w\/d|wdl|purchase\s+at|atm\s+wdl)\b/i;
const CREDIT_HINT_RE =
  /\b(credited|received|deposited|credit\s+alert|added\s+to|money\s+received|payment\s+received|cr\.?|recd\.?)\b/i;
const REVERSAL_HINT_RE = /\b(reversal|reversed|refund|chargeback|return\s+credit)\b/i;

export function serverDetectDebit(body: string): boolean {
  return DEBIT_HINT_RE.test(body) && !CREDIT_HINT_RE.test(body);
}

export function serverDetectReversal(body: string): boolean {
  return REVERSAL_HINT_RE.test(body);
}

const VALID_SENDER_RE = /^[A-Z]{3,}/;

export function looksLikeValidSenderKey(key: string): boolean {
  return VALID_SENDER_RE.test(key.toUpperCase()) && key.length <= 12;
}

export function normalizeSenderKey(sender: string): string {
  const upper = sender.toUpperCase().trim();
  const segments = upper.split(/[-_.\s+/\\]+/).filter((s) => s.length >= 3);
  return segments[0] || upper.slice(0, 8);
}

export function normalizeTemplate(body: string): string {
  return body
    .replace(/(?:Rs\.?|INR|₹)\s*[\d,]+(?:\.\d{1,2})?/gi, "{AMOUNT}")
    .replace(/[\d,]+(?:\.\d{1,2})?\s*(?:Rs\.?|INR|₹|rupees?)/gi, "{AMOUNT}")
    .replace(/\b[A-Z0-9]{12}\b/gi, "{UTR}")
    .replace(/\b(?:XX|X)[Xx0-9]{2,}\b/g, "{ACCT}")
    .replace(/\b\d{8,11}\b/g, "{NUM}")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function computeTemplateHash(senderKey: string, templateBody: string): string {
  const s = senderKey + "|" + templateBody;
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) ^ s.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export async function storeSmsForLearning(opts: {
  sender: string;
  body: string;
  bucket: "suspicious" | "unparsed" | "matched";
  reason?: string | null;
  parsedUtr?: string | null;
  parsedAmount?: number | null;
  isDebit?: boolean;
  hasReversal?: boolean;
  userId?: number | null;
}): Promise<void> {
  const senderKey = normalizeSenderKey(opts.sender);
  const templateBody = normalizeTemplate(opts.body);
  const templateHash = computeTemplateHash(senderKey, templateBody);

  const serverIsDebit = serverDetectDebit(opts.body);
  const serverHasReversal = serverDetectReversal(opts.body);
  const isDebit = opts.isDebit || serverIsDebit;
  const hasReversal = opts.hasReversal || serverHasReversal;

  await db.insert(smsLearningQueueTable).values({
    sender: opts.sender,
    senderKey,
    body: opts.body,
    bucket: opts.bucket,
    parsedUtr: opts.parsedUtr || null,
    parsedAmount: opts.parsedAmount != null ? String(opts.parsedAmount) : null,
    isDebit,
    hasReversal,
    templateBody,
    templateHash,
    userId: opts.userId || null,
    status: opts.bucket === "matched" ? "matched" : "pending",
    reason: opts.reason || null,
  });
}

const MIN_SAMPLES = 5;
const UTR_CONSISTENCY_THRESHOLD = 0.6;

export async function proposePatterns(): Promise<{ proposed: number; skipped: number; reasons: Record<string, string> }> {
  const items = await db
    .select()
    .from(smsLearningQueueTable)
    .where(
      and(
        eq(smsLearningQueueTable.status, "pending"),
        eq(smsLearningQueueTable.isDebit, false),
        eq(smsLearningQueueTable.hasReversal, false),
      ),
    );

  const existingCandidates = await db.select().from(smsCandidatePatternsTable);
  const existingHashes = new Set(
    existingCandidates.map((c) => c.senderKey + "|" + c.templateHash),
  );

  const safeSenders = await db.select().from(smsSafeSendersTable);
  const safeSenderKeys = new Set(safeSenders.map((s) => s.senderKey.toUpperCase()));

  const groups = new Map<string, typeof items>();
  for (const item of items) {
    if (!item.templateHash) continue;
    const key = item.senderKey + "|" + item.templateHash;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }

  let proposed = 0;
  let skipped = 0;
  const reasons: Record<string, string> = {};

  for (const [key, group] of groups) {
    const first = group[0];

    if (existingHashes.has(key)) {
      reasons[key] = "already_proposed";
      skipped++;
      continue;
    }

    if (group.length < MIN_SAMPLES) {
      reasons[key] = `insufficient_samples(${group.length}<${MIN_SAMPLES})`;
      skipped++;
      continue;
    }

    if (!looksLikeValidSenderKey(first.senderKey)) {
      reasons[key] = `invalid_sender_key(${first.senderKey})`;
      skipped++;
      continue;
    }

    if (!safeSenderKeys.has(first.senderKey.toUpperCase())) {
      reasons[key] = `sender_not_admin_approved(${first.senderKey})`;
      skipped++;
      continue;
    }

    const utrCount = group.filter((i) => i.parsedUtr).length;
    const utrRatio = utrCount / group.length;
    if (utrRatio < UTR_CONSISTENCY_THRESHOLD) {
      reasons[key] = `low_utr_consistency(${utrCount}/${group.length})`;
      skipped++;
      continue;
    }

    const amtCount = group.filter((i) => i.parsedAmount).length;
    const amtRatio = amtCount / group.length;
    if (amtRatio < UTR_CONSISTENCY_THRESHOLD) {
      reasons[key] = `low_amount_consistency(${amtCount}/${group.length})`;
      skipped++;
      continue;
    }

    const debitCount = group.filter((i) => i.isDebit).length;
    const reversalCount = group.filter((i) => i.hasReversal).length;
    if (debitCount > 0 || reversalCount > 0) {
      reasons[key] = `debit_or_reversal_in_samples(debit:${debitCount},reversal:${reversalCount})`;
      skipped++;
      continue;
    }

    const distinctUtrs = new Set(group.filter((i) => i.parsedUtr).map((i) => i.parsedUtr!));
    const distinctUsers = new Set(group.filter((i) => i.userId != null).map((i) => i.userId!));
    if (group.length >= MIN_SAMPLES * 2 && distinctUtrs.size < 2) {
      reasons[key] = `low_sample_diversity(utrs:${distinctUtrs.size},users:${distinctUsers.size})`;
      skipped++;
      continue;
    }

    const sampleIds = JSON.stringify(group.slice(0, 20).map((i) => i.id));
    const utrSamples = group.filter((i) => i.parsedUtr).map((i) => i.parsedUtr!);
    const amtSamples = group.filter((i) => i.parsedAmount).map((i) => i.parsedAmount!);

    await db.insert(smsCandidatePatternsTable).values({
      senderKey: first.senderKey,
      templateHash: first.templateHash!,
      templateBody: first.templateBody!,
      utrSample: utrSamples[0] || null,
      amountSample: amtSamples[0] || null,
      sampleCount: group.length,
      sampleIds,
      status: "proposed",
    });

    const ids = group.map((i) => i.id);
    await db
      .update(smsLearningQueueTable)
      .set({ status: "clustered" })
      .where(sql`${smsLearningQueueTable.id} = ANY(${ids})`);

    proposed++;
    reasons[key] = "proposed";
  }

  return { proposed, skipped, reasons };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildContextRegex(templateBody: string): { utrRegex: string; amountRegex: string } {
  const utrParts = templateBody.split(/\{utr\}/i);
  const amtParts = templateBody.split(/\{amount\}/i);

  const beforeUtrWords = (utrParts[0] || "").trim().split(/\s+/).filter(Boolean).slice(-2);
  const beforeAmtWords = (amtParts[0] || "").trim().split(/\s+/).filter(Boolean).slice(-2);

  const utrCtx = beforeUtrWords.map(escapeRegex).join("\\s+");
  const amtCtx = beforeAmtWords.map(escapeRegex).join("\\s+");

  const utrRegex = (utrCtx ? utrCtx + "\\s+" : "") + `([A-Z0-9]{12,22})`;
  const amountRegex =
    (amtCtx ? amtCtx + "\\s+" : "") +
    `(?:Rs\\.?|INR|₹)?\\s*([\\d,]+(?:\\.\\d{1,2})?)`;

  return { utrRegex, amountRegex };
}

export async function isSafeAdminSender(senderKey: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(smsSafeSendersTable)
    .where(eq(smsSafeSendersTable.senderKey, senderKey.toUpperCase()));
  return rows.length > 0;
}
