import { db } from "@workspace/db";
import {
  smsLearningQueueTable,
  smsCandidatePatternsTable,
  smsActivePatternsTable,
} from "@workspace/db";
import { eq, inArray, sql, lt } from "drizzle-orm";
import { getSetting } from "./settings.js";

export interface SmsLearningStatus {
  activePatternsCount: number;
  pendingQueueCount: number;
  proposedCandidatesCount: number;
  isLearningComplete: boolean;
  cleanableQueueCount: number;
  cleanableCandidatesCount: number;
}

const CLEANABLE_QUEUE_STATUSES = ["clustered", "dismissed", "matched"] as const;

export async function getSmsLearningStatus(): Promise<SmsLearningStatus> {
  const [activeResult] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(smsActivePatternsTable)
    .where(eq(smsActivePatternsTable.isActive, true));

  const [pendingResult] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(smsLearningQueueTable)
    .where(eq(smsLearningQueueTable.status, "pending"));

  const [proposedResult] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(smsCandidatePatternsTable)
    .where(eq(smsCandidatePatternsTable.status, "proposed"));

  const [cleanableQueueResult] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(smsLearningQueueTable)
    .where(inArray(smsLearningQueueTable.status, [...CLEANABLE_QUEUE_STATUSES]));

  const [cleanableCandidatesResult] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(smsCandidatePatternsTable)
    .where(eq(smsCandidatePatternsTable.status, "rejected"));

  const activePatternsCount = parseInt(activeResult?.count ?? "0");
  const pendingQueueCount = parseInt(pendingResult?.count ?? "0");
  const proposedCandidatesCount = parseInt(proposedResult?.count ?? "0");
  const cleanableQueueCount = parseInt(cleanableQueueResult?.count ?? "0");
  const cleanableCandidatesCount = parseInt(cleanableCandidatesResult?.count ?? "0");

  const isLearningComplete =
    activePatternsCount >= 1 && proposedCandidatesCount === 0;

  return {
    activePatternsCount,
    pendingQueueCount,
    proposedCandidatesCount,
    isLearningComplete,
    cleanableQueueCount,
    cleanableCandidatesCount,
  };
}

export interface SmsCleanupResult {
  skipped: boolean;
  skipReason?: string;
  deletedQueueRows: number;
  deletedCandidateRows: number;
}

export async function runSmsAutoCleanup(opts?: {
  force?: boolean;
}): Promise<SmsCleanupResult> {
  const autoDeleteEnabled = await getSetting("smsAutoDeleteEnabled");
  if (autoDeleteEnabled !== "true" && !opts?.force) {
    return { skipped: true, skipReason: "auto_delete_disabled", deletedQueueRows: 0, deletedCandidateRows: 0 };
  }

  const status = await getSmsLearningStatus();

  if (!status.isLearningComplete && !opts?.force) {
    const reason = status.activePatternsCount < 1
      ? "no_active_patterns_yet"
      : `pending_proposals_exist(${status.proposedCandidatesCount})`;
    return { skipped: true, skipReason: reason, deletedQueueRows: 0, deletedCandidateRows: 0 };
  }

  const retentionDays = 7;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const deletedQueue = await db
    .delete(smsLearningQueueTable)
    .where(
      sql`${smsLearningQueueTable.status} = ANY(${CLEANABLE_QUEUE_STATUSES}) AND ${smsLearningQueueTable.createdAt} < ${cutoff}`
    )
    .returning({ id: smsLearningQueueTable.id });

  const deletedCandidates = await db
    .delete(smsCandidatePatternsTable)
    .where(eq(smsCandidatePatternsTable.status, "rejected"))
    .returning({ id: smsCandidatePatternsTable.id });

  return {
    skipped: false,
    deletedQueueRows: deletedQueue.length,
    deletedCandidateRows: deletedCandidates.length,
  };
}
