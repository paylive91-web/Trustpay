import { db } from "@workspace/db";
import {
  fraudAlertsTable, utrIndexTable, imageHashesTable, ordersTable, usersTable,
  deviceFingerprintsTable, disputesTable, userNotificationsTable,
} from "@workspace/db";
import { eq, and, sql, ne, or, inArray } from "drizzle-orm";

type Severity = "info" | "warn" | "critical";

function describeRule(rule: string, severity: Severity): { title: string; body: string } {
  const sevLabel = severity === "critical" ? "Critical" : severity === "warn" ? "Warning" : "Notice";
  const titles: Record<string, string> = {
    duplicate_utr: "Duplicate payment reference flagged",
    duplicate_utr_same_user: "You reused a payment reference",
    utr_reuse_recent: "You reused a payment reference recently",
    fake_utr_pattern: "Suspicious payment reference",
    fake_utr_sequential: "Suspicious payment reference",
    fake_utr_length: "Unusual payment reference length",
    duplicate_screenshot_cross_user: "Duplicate screenshot flagged",
    duplicate_screenshot_same_user: "You reused a screenshot",
    duplicate_recording_cross_user: "Duplicate recording flagged",
    duplicate_recording_same_user: "You reused a recording",
    velocity_burst: "Too many actions in a short time",
    velocity_high: "High activity detected",
    off_hours_burst: "Unusual late-night activity",
    upi_multi_account: "Your UPI is in use on other accounts",
    upi_suspicious_pattern: "Your UPI looks suspicious",
    high_cancel_rate: "High cancellation rate on your account",
    extreme_cancel_rate: "Excessive cancellations on your account",
    rapid_lock_release: "Rapid lock/release pattern",
    multi_account_same_device: "Multiple accounts on your device",
    multi_ip_login: "Logins from many IPs",
    multi_ip_login_critical: "Logins from many IPs",
    frozen_user_login_attempt: "Login attempt while frozen",
    referral_self_loop: "Self-referral detected",
    referral_same_device: "Referral from same device flagged",
    high_dispute_rate: "High dispute rate on your account",
    extreme_dispute_rate: "Excessive disputes on your account",
    new_account_high_value: "High-value action on new account",
    balance_drain_attempt: "Repeated lock-and-release flagged",
  };
  const title = titles[rule] || `Account flagged: ${rule}`;
  const frozenNote = severity === "critical"
    ? " Your account has been frozen for review — please contact support to resolve."
    : " Please review your recent activity. Contact support if you believe this is a mistake.";
  return { title: `${sevLabel}: ${title}`, body: `Our fraud system flagged your account.${frozenNote}` };
}

async function logAlert(userId: number | null, orderId: number | null, rule: string, severity: Severity, evidence: string) {
  // Insert the alert; notify the user in-app for warn/critical (info is too noisy).
  const shouldNotify = userId != null && (severity === "warn" || severity === "critical");
  const [alert] = await db.insert(fraudAlertsTable).values({
    userId: userId ?? undefined,
    orderId: orderId ?? undefined,
    rule, severity, evidence,
    notifiedAt: shouldNotify ? new Date() : undefined,
  }).returning();

  if (shouldNotify && alert) {
    const { title, body } = describeRule(rule, severity);
    await db.insert(userNotificationsTable).values({
      userId: userId!,
      kind: "fraud_alert",
      title,
      body: `${body}${evidence ? `\n\nDetails: ${evidence}` : ""}`,
      severity,
      fraudAlertId: alert.id,
    });
  }

  if (severity === "critical" && userId) {
    await db.update(usersTable).set({ isFrozen: true }).where(eq(usersTable.id, userId));
  }
}

function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

const SUSPICIOUS_UPI_PATTERNS = [
  /^test/i, /scam/i, /fake/i, /\d{15,}/,
];

export async function checkUtrFraud(utr: string, userId: number, orderId: number): Promise<string[]> {
  const issues: string[] = [];
  const normalized = utr.trim();

  // Rule: duplicate UTR across users (current + 7-day window)
  const dupes = await db.select().from(utrIndexTable).where(eq(utrIndexTable.utr, normalized));
  if (dupes.length > 0) {
    const otherUser = dupes.find((d) => d.userId !== userId);
    if (otherUser) {
      issues.push("duplicate_utr_other_user");
      await logAlert(userId, orderId, "duplicate_utr", "critical", `UTR ${normalized} previously used by user #${otherUser.userId} on order #${otherUser.orderId}`);
    } else {
      // UTR re-use within window (7 days)
      const recent = dupes.find((d) => {
        const ageDays = (Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return ageDays < 7;
      });
      if (recent) {
        issues.push("utr_reuse_window");
        await logAlert(userId, orderId, "utr_reuse_recent", "warn", `Same user reused UTR ${normalized} within 7 days`);
      } else {
        issues.push("duplicate_utr_same_user");
        await logAlert(userId, orderId, "duplicate_utr_same_user", "warn", `Same user reused UTR ${normalized}`);
      }
    }
  }

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

  await db.insert(utrIndexTable).values({ utr: normalized, userId, orderId });
  return issues;
}

export async function checkImageHash(dataUrl: string, userId: number, orderId: number, kind: "screenshot" | "recording"): Promise<string[]> {
  const issues: string[] = [];
  if (!dataUrl || dataUrl.length < 100) return issues;
  const hash = hashString(dataUrl.slice(0, 5000));
  // Extended window: any duplicate (not just recent)
  const dupes = await db.select().from(imageHashesTable).where(and(eq(imageHashesTable.hash, hash), eq(imageHashesTable.kind, kind)));
  if (dupes.length > 0) {
    const otherUser = dupes.find((d) => d.userId !== userId);
    if (otherUser) {
      issues.push(`duplicate_${kind}_other_user`);
      await logAlert(userId, orderId, `duplicate_${kind}_cross_user`, "critical", `${kind} matches user #${otherUser.userId} order #${otherUser.orderId}`);
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
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recent = await db.select({ c: sql<string>`COUNT(*)` }).from(ordersTable)
    .where(and(eq(ordersTable.lockedByUserId, userId), sql`${ordersTable.createdAt} > ${fiveMinAgo}`));
  const count = parseInt(String(recent[0]?.c || "0"));
  if (count >= 10) {
    issues.push("velocity_burst");
    await logAlert(userId, null, "velocity_burst", "critical", `${count} lock attempts in 5 min`);
  } else if (count >= 5) {
    await logAlert(userId, null, "velocity_high", "warn", `${count} lock attempts in 5 min`);
  }

  // Off-hours velocity (local IST 1AM-5AM)
  const hourIst = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCHours();
  if (hourIst >= 1 && hourIst <= 5) {
    const lastHr = new Date(Date.now() - 60 * 60 * 1000);
    const offRows = await db.select({ c: sql<string>`COUNT(*)` }).from(ordersTable)
      .where(and(eq(ordersTable.lockedByUserId, userId), sql`${ordersTable.createdAt} > ${lastHr}`));
    const offCount = parseInt(String(offRows[0]?.c || "0"));
    if (offCount >= 5) {
      await logAlert(userId, null, "off_hours_burst", "warn", `${offCount} actions during 1-5 AM IST`);
    }
  }
  return issues;
}

export async function checkUpiReuse(upiId: string, userId: number): Promise<string[]> {
  const issues: string[] = [];
  const others = await db.select({ uid: ordersTable.userId }).from(ordersTable)
    .where(and(eq(ordersTable.userUpiId, upiId), ne(ordersTable.userId, userId)));
  const distinct = new Set(others.map((o) => o.uid));
  if (distinct.size > 0) {
    issues.push("upi_multi_account");
    await logAlert(userId, null, "upi_multi_account", "critical", `UPI ${upiId} used by ${distinct.size} other user(s)`);
  }
  for (const re of SUSPICIOUS_UPI_PATTERNS) {
    if (re.test(upiId)) {
      issues.push("upi_suspicious_pattern");
      await logAlert(userId, null, "upi_suspicious_pattern", "warn", `UPI ${upiId} matches suspicious pattern ${re}`);
      break;
    }
  }
  return issues;
}

export async function checkCancelRate(userId: number): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const total = await db.select({ c: sql<string>`COUNT(*)` }).from(ordersTable).where(and(
    eq(ordersTable.lockedByUserId, userId), sql`${ordersTable.createdAt} > ${since}`,
  ));
  const cancelled = await db.select({ c: sql<string>`COUNT(*)` }).from(ordersTable).where(and(
    eq(ordersTable.lockedByUserId, userId), sql`${ordersTable.createdAt} > ${since}`,
    inArray(ordersTable.status, ["cancelled", "expired", "available"]),
  ));
  const t = parseInt(String(total[0]?.c || "0"));
  const c = parseInt(String(cancelled[0]?.c || "0"));
  if (t >= 5 && c / t >= 0.6) {
    await logAlert(userId, null, "high_cancel_rate", "warn", `${c}/${t} (${Math.round(c / t * 100)}%) cancelled/released in 24h`);
  }
  if (t >= 10 && c / t >= 0.8) {
    await logAlert(userId, null, "extreme_cancel_rate", "critical", `${c}/${t} cancelled in 24h - lock spam`);
  }
}

export async function checkRapidLockRelease(userId: number): Promise<void> {
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const recent = await db.select().from(ordersTable).where(and(
    eq(ordersTable.lockedByUserId, userId),
    sql`${ordersTable.createdAt} > ${since}`,
    eq(ordersTable.status, "available"),
  ));
  if (recent.length >= 3) {
    await logAlert(userId, null, "rapid_lock_release", "warn", `${recent.length} chunks locked then released in 10 min`);
  }
}

export async function recordDeviceFingerprint(userId: number, fingerprint: string, ip: string, userAgent: string): Promise<void> {
  if (!fingerprint) return;
  // Update existing or insert
  const existing = await db.select().from(deviceFingerprintsTable).where(and(
    eq(deviceFingerprintsTable.userId, userId), eq(deviceFingerprintsTable.fingerprint, fingerprint),
  )).limit(1);
  if (existing[0]) {
    await db.update(deviceFingerprintsTable).set({ lastSeenAt: new Date(), ip, userAgent })
      .where(eq(deviceFingerprintsTable.id, existing[0].id));
  } else {
    await db.insert(deviceFingerprintsTable).values({ userId, fingerprint, ip, userAgent });
  }

  // Multi-account same device check
  const others = await db.select().from(deviceFingerprintsTable).where(and(
    eq(deviceFingerprintsTable.fingerprint, fingerprint),
    ne(deviceFingerprintsTable.userId, userId),
  ));
  if (others.length > 0) {
    const distinctUsers = new Set(others.map((o) => o.userId));
    if (distinctUsers.size >= 2) {
      await logAlert(userId, null, "multi_account_same_device", "critical", `Device shared with ${distinctUsers.size} other accounts`);
    } else {
      await logAlert(userId, null, "multi_account_same_device", "warn", `Device shared with ${distinctUsers.size} other account`);
    }
  }
}

export async function checkAccountFraud(userId: number, ip: string, userAgent: string): Promise<void> {
  // Multi-IP login (5+ distinct IPs in 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const ips = await db.select({ ip: deviceFingerprintsTable.ip }).from(deviceFingerprintsTable).where(and(
    eq(deviceFingerprintsTable.userId, userId),
    sql`${deviceFingerprintsTable.lastSeenAt} > ${since}`,
  ));
  const distinctIps = new Set(ips.map((r) => r.ip).filter(Boolean));
  if (distinctIps.size >= 5) {
    await logAlert(userId, null, "multi_ip_login", "warn", `${distinctIps.size} distinct IPs in 24h`);
  }
  if (distinctIps.size >= 10) {
    await logAlert(userId, null, "multi_ip_login_critical", "critical", `${distinctIps.size} distinct IPs in 24h`);
  }
  // Frozen-user retry
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (u?.isFrozen) {
    await logAlert(userId, null, "frozen_user_login_attempt", "info", `Frozen user logged in`);
  }
}

export async function checkReferralSelfLoop(referrerId: number, referredId: number): Promise<void> {
  if (referrerId === referredId) {
    await logAlert(referredId, null, "referral_self_loop", "critical", `User ${referredId} self-referred`);
    return;
  }
  // Same device cross-check
  const refDevs = await db.select().from(deviceFingerprintsTable).where(eq(deviceFingerprintsTable.userId, referrerId));
  const refdDevs = await db.select().from(deviceFingerprintsTable).where(eq(deviceFingerprintsTable.userId, referredId));
  const refFps = new Set(refDevs.map((d) => d.fingerprint));
  if (refdDevs.some((d) => refFps.has(d.fingerprint))) {
    await logAlert(referredId, null, "referral_same_device", "critical", `Referrer ${referrerId} and referred ${referredId} share a device`);
  }
}

export async function checkDisputeRate(userId: number): Promise<void> {
  // % disputes vs total trades, threshold 30%
  const total = await db.select({ c: sql<string>`COUNT(*)` }).from(ordersTable).where(or(
    eq(ordersTable.userId, userId), eq(ordersTable.lockedByUserId, userId),
  ));
  const disputes = await db.select({ c: sql<string>`COUNT(*)` }).from(disputesTable).where(or(
    eq(disputesTable.buyerId, userId), eq(disputesTable.sellerId, userId),
  ));
  const t = parseInt(String(total[0]?.c || "0"));
  const d = parseInt(String(disputes[0]?.c || "0"));
  if (t >= 5 && d / t >= 0.3) {
    await logAlert(userId, null, "high_dispute_rate", "warn", `${d}/${t} (${Math.round(d / t * 100)}%) trades disputed`);
  }
  if (t >= 10 && d / t >= 0.5) {
    await logAlert(userId, null, "extreme_dispute_rate", "critical", `${d}/${t} disputed - likely scammer`);
  }
}

export async function checkNewAccountHighValue(userId: number, amount: number): Promise<void> {
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!u) return;
  const accountAgeDays = (Date.now() - new Date(u.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  if (accountAgeDays < 1 && amount >= 5000) {
    await logAlert(userId, null, "new_account_high_value", "critical", `Account <24h old attempting ₹${amount}`);
  } else if (accountAgeDays < 3 && amount >= 10000) {
    await logAlert(userId, null, "new_account_high_value", "warn", `Account ${Math.round(accountAgeDays)}d old attempting ₹${amount}`);
  }
}

export async function checkBalanceDrain(userId: number): Promise<void> {
  // Multiple chunk locks released without payment in last hour
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const released = await db.select({ c: sql<string>`COUNT(*)` }).from(ordersTable).where(and(
    eq(ordersTable.lockedByUserId, userId),
    sql`${ordersTable.createdAt} > ${since}`,
    inArray(ordersTable.status, ["available", "expired", "cancelled"]),
  ));
  const c = parseInt(String(released[0]?.c || "0"));
  if (c >= 8) {
    await logAlert(userId, null, "balance_drain_attempt", "critical", `${c} chunks locked & released in 1h - drain attempt`);
  }
}
