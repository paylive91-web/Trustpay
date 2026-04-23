import { db } from "@workspace/db";
import { smsLearningQueueTable, smsSafeSendersTable, smsCandidatePatternsTable } from "@workspace/db";
import { sql, and, eq } from "drizzle-orm";

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
  bucket: "suspicious" | "unparsed";
  parsedUtr?: string | null;
  parsedAmount?: number | null;
  isDebit?: boolean;
  hasReversal?: boolean;
  userId?: number | null;
}): Promise<void> {
  const senderKey = normalizeSenderKey(opts.sender);
  const templateBody = normalizeTemplate(opts.body);
  const templateHash = computeTemplateHash(senderKey, templateBody);

  await db.insert(smsLearningQueueTable).values({
    sender: opts.sender,
    senderKey,
    body: opts.body,
    bucket: opts.bucket,
    parsedUtr: opts.parsedUtr || null,
    parsedAmount: opts.parsedAmount != null ? String(opts.parsedAmount) : null,
    isDebit: opts.isDebit ?? false,
    hasReversal: opts.hasReversal ?? false,
    templateBody,
    templateHash,
    userId: opts.userId || null,
    status: "pending",
  });
}

const MIN_SAMPLES = 5;

export async function proposePatterns(): Promise<{ proposed: number; skipped: number }> {
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

  for (const [key, group] of groups) {
    if (group.length < MIN_SAMPLES) {
      skipped++;
      continue;
    }
    if (existingHashes.has(key)) {
      skipped++;
      continue;
    }

    const first = group[0];
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
  }

  return { proposed, skipped };
}

export async function isSafeAdminSender(senderKey: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(smsSafeSendersTable)
    .where(eq(smsSafeSendersTable.senderKey, senderKey.toUpperCase()));
  return rows.length > 0;
}
