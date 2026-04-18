import { db } from "@workspace/db";
import { fraudAlertsTable, utrIndexTable, imageHashesTable, ordersTable, usersTable } from "@workspace/db";
import { eq, and, sql, ne } from "drizzle-orm";

type Severity = "info" | "warn" | "critical";

async function logAlert(userId: number | null, orderId: number | null, rule: string, severity: Severity, evidence: string) {
  await db.insert(fraudAlertsTable).values({
    userId: userId ?? undefined,
    orderId: orderId ?? undefined,
    rule, severity, evidence,
  });
  if (severity === "critical" && userId) {
    await db.update(usersTable).set({ isFrozen: true }).where(eq(usersTable.id, userId));
  }
}

function hashString(s: string): string {
  // simple non-crypto hash for fingerprinting
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

export async function checkUtrFraud(utr: string, userId: number, orderId: number): Promise<string[]> {
  const issues: string[] = [];
  const normalized = utr.trim();

  // Rule 1: duplicate UTR across all users/orders
  const dupes = await db.select().from(utrIndexTable).where(eq(utrIndexTable.utr, normalized));
  if (dupes.length > 0) {
    const otherUser = dupes.find((d) => d.userId !== userId);
    if (otherUser) {
      issues.push("duplicate_utr_other_user");
      await logAlert(userId, orderId, "duplicate_utr", "critical", `UTR ${normalized} previously used by user #${otherUser.userId} on order #${otherUser.orderId}`);
    } else {
      issues.push("duplicate_utr_same_user");
      await logAlert(userId, orderId, "duplicate_utr_same_user", "warn", `Same user reused UTR ${normalized}`);
    }
  }

  // Rule 2: fake UTR pattern - all same digit, sequential, wrong length
  if (/^(\d)\1{5,}$/.test(normalized)) {
    issues.push("fake_utr_repeated_digits");
    await logAlert(userId, orderId, "fake_utr_pattern", "critical", `UTR ${normalized} is all same digit`);
  } else if (/^(0123|1234|2345|3456|4567|5678|6789|9876|8765)/.test(normalized) && normalized.length >= 8) {
    issues.push("fake_utr_sequential");
    await logAlert(userId, orderId, "fake_utr_sequential", "warn", `UTR ${normalized} starts with sequential digits`);
  } else if (normalized.length < 6 || normalized.length > 22) {
    issues.push("fake_utr_length");
    await logAlert(userId, orderId, "fake_utr_length", "warn", `UTR length unusual: ${normalized.length}`);
  }

  // Index it for future checks
  await db.insert(utrIndexTable).values({ utr: normalized, userId, orderId });
  return issues;
}

export async function checkImageHash(dataUrl: string, userId: number, orderId: number, kind: "screenshot" | "recording"): Promise<string[]> {
  const issues: string[] = [];
  if (!dataUrl || dataUrl.length < 100) return issues;
  const hash = hashString(dataUrl.slice(0, 5000)); // sample first 5KB for hash
  const dupes = await db.select().from(imageHashesTable).where(and(eq(imageHashesTable.hash, hash), eq(imageHashesTable.kind, kind)));
  if (dupes.length > 0) {
    const otherUser = dupes.find((d) => d.userId !== userId);
    if (otherUser) {
      issues.push(`duplicate_${kind}_other_user`);
      await logAlert(userId, orderId, `duplicate_${kind}`, "critical", `${kind} matches user #${otherUser.userId} order #${otherUser.orderId}`);
    } else {
      issues.push(`duplicate_${kind}_same_user`);
      await logAlert(userId, orderId, `duplicate_${kind}_same_user`, "warn", `Same user reused ${kind}`);
    }
  }
  await db.insert(imageHashesTable).values({ hash, userId, orderId, kind });
  return issues;
}

export async function checkVelocity(userId: number): Promise<string[]> {
  const issues: string[] = [];
  // 10+ orders in 5 min
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recent = await db.select({ c: sql<string>`COUNT(*)` }).from(ordersTable)
    .where(and(eq(ordersTable.userId, userId), sql`${ordersTable.createdAt} > ${fiveMinAgo}`));
  const count = parseInt(String(recent[0]?.c || "0"));
  if (count >= 10) {
    issues.push("velocity_burst");
    await logAlert(userId, null, "velocity_burst", "critical", `${count} orders in 5 min`);
  } else if (count >= 5) {
    await logAlert(userId, null, "velocity_high", "warn", `${count} orders in 5 min`);
  }
  return issues;
}

export async function checkUpiReuse(upiId: string, userId: number): Promise<string[]> {
  const issues: string[] = [];
  // same UPI on multiple users
  const others = await db.select({ uid: ordersTable.userId }).from(ordersTable)
    .where(and(eq(ordersTable.userUpiId, upiId), ne(ordersTable.userId, userId)));
  const distinct = new Set(others.map((o) => o.uid));
  if (distinct.size > 0) {
    issues.push("upi_multi_account");
    await logAlert(userId, null, "upi_multi_account", "critical", `UPI ${upiId} used by ${distinct.size} other user(s)`);
  }
  return issues;
}
