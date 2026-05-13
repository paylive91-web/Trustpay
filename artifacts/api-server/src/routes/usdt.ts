import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, transactionsTable } from "@workspace/db";
import { eq, sql, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { getAllSettings } from "../lib/settings.js";

const router: IRouter = Router();

type UsdtAddress = { address: string; label?: string; qrImageUrl?: string };

function parseAddresses(raw: unknown): UsdtAddress[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((a: any) => ({
        address: String(a?.address || "").trim(),
        label: a?.label ? String(a.label) : undefined,
        qrImageUrl: a?.qrImageUrl ? String(a.qrImageUrl) : undefined,
      }))
      .filter((a) => a.address.length > 0);
  }
  if (typeof raw === "string") {
    try {
      return parseAddresses(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function loadUsdtConfig() {
  const s = await getAllSettings();
  return {
    enabled: s.usdtEnabled === "true",
    rate: Math.max(0, Number(s.usdtRatePerUnit) || 0),
    bonusPct: Math.max(0, Number(s.usdtBonusPercent) || 0),
    min: Math.max(0, Number(s.usdtMinAmount) || 0),
    max: Math.max(0, Number(s.usdtMaxAmount) || 0),
    addresses: parseAddresses(s.usdtAddresses),
    windowMinutes: Math.max(1, Math.floor(Number(s.usdtPaymentWindowMinutes) || 15)),
    notes: String(s.usdtNotes || ""),
  };
}

// Public-facing config the user UI needs to render the calculator + tab.
// Intentionally hides full address list — only `addressCount` is exposed.
router.get("/public-config", async (_req, res) => {
  const cfg = await loadUsdtConfig();
  res.json({
    enabled: cfg.enabled,
    rate: cfg.rate,
    bonusPercent: cfg.bonusPct,
    minAmount: cfg.min,
    maxAmount: cfg.max,
    windowMinutes: cfg.windowMinutes,
    addressCount: cfg.addresses.length,
    notes: cfg.notes,
  });
});

router.use(requireAuth);

// Pick a TRC-20 address for a fresh order. Round-robin across all
// configured addresses based on the previous order's id so load is spread
// evenly even with concurrent /start calls.
async function pickAddress(addresses: UsdtAddress[]): Promise<UsdtAddress> {
  if (addresses.length === 1) return addresses[0];
  const last = await db.execute(sql`
    SELECT COUNT(*)::int AS c FROM usdt_orders
  `);
  const count = Number(((last as any).rows?.[0] || (last as any)[0])?.c || 0);
  return addresses[count % addresses.length];
}

router.post("/start", async (req, res) => {
  const u = (req as any).user as { id: number };
  const cfg = await loadUsdtConfig();
  if (!cfg.enabled) {
    res.status(503).json({ error: "USDT deposits are temporarily disabled. Please try again later." });
    return;
  }
  if (cfg.addresses.length === 0 || cfg.rate <= 0) {
    res.status(503).json({ error: "USDT deposits not configured. Please contact support." });
    return;
  }
  const amount = Number((req.body || {}).usdtAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "Enter a valid USDT amount" });
    return;
  }
  if (amount < cfg.min) {
    res.status(400).json({ error: `Minimum deposit is ${cfg.min} USDT` });
    return;
  }
  if (cfg.max && amount > cfg.max) {
    res.status(400).json({ error: `Maximum deposit is ${cfg.max} USDT` });
    return;
  }

  // Refuse if user already has an unresolved order — keeps the address
  // pool clean and prevents accidental double-pays. Pending must be
  // within its payment window; submitted/processing are admin-side
  // states with no payment-window guard (admin SLA controls them).
  const active = await db.execute(sql`
    SELECT id, status FROM usdt_orders
     WHERE user_id = ${u.id}
       AND (
         (status = 'pending' AND expires_at > NOW())
         OR status IN ('submitted', 'processing')
       )
     LIMIT 1
  `);
  const activeRow = ((active as any).rows?.[0] || (active as any)[0]) as { id?: number } | undefined;
  if (activeRow?.id) {
    res.status(409).json({ error: "You already have a pending USDT order. Complete or cancel it first.", orderId: activeRow.id });
    return;
  }

  const addr = await pickAddress(cfg.addresses);
  const inrValue = round2(amount * cfg.rate);
  const bonusInr = round2((inrValue * cfg.bonusPct) / 100);
  const total = round2(inrValue + bonusInr);

  const ins = await db.execute(sql`
    INSERT INTO usdt_orders (
      user_id, usdt_amount, rate_snapshot, bonus_pct_snapshot,
      inr_value, bonus_inr, total_credit,
      address, address_label, status, expires_at
    ) VALUES (
      ${u.id}, ${amount}, ${cfg.rate}, ${cfg.bonusPct},
      ${inrValue}, ${bonusInr}, ${total},
      ${addr.address}, ${addr.label ?? null}, 'pending',
      NOW() + (${cfg.windowMinutes}::int * INTERVAL '1 minute')
    )
    RETURNING id, expires_at, address, address_label,
              usdt_amount, rate_snapshot, bonus_pct_snapshot,
              inr_value, bonus_inr, total_credit, status
  `);
  const row = ((ins as any).rows?.[0] || (ins as any)[0]);
  res.json({
    id: row.id,
    address: row.address,
    addressLabel: row.address_label,
    addressQrImageUrl: addr.qrImageUrl || null,
    usdtAmount: Number(row.usdt_amount),
    rate: Number(row.rate_snapshot),
    bonusPercent: Number(row.bonus_pct_snapshot),
    inrValue: Number(row.inr_value),
    bonusInr: Number(row.bonus_inr),
    totalCredit: Number(row.total_credit),
    status: row.status,
    expiresAt: row.expires_at,
    notes: cfg.notes,
  });
});

router.post("/submit/:id", async (req, res) => {
  const u = (req as any).user as { id: number };
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid order id" });
    return;
  }
  const { txId, screenshotDataUrl } = (req.body || {}) as { txId?: string; screenshotDataUrl?: string };
  const cleanTx = String(txId || "").trim();
  if (cleanTx.length < 10) {
    res.status(400).json({ error: "Enter the full TxID from your wallet" });
    return;
  }
  if (!screenshotDataUrl || !screenshotDataUrl.startsWith("data:image/")) {
    res.status(400).json({ error: "Screenshot is required" });
    return;
  }

  const found = await db.execute(sql`
    SELECT id, status, expires_at FROM usdt_orders
     WHERE id = ${id} AND user_id = ${u.id}
     LIMIT 1
  `);
  const order = ((found as any).rows?.[0] || (found as any)[0]) as
    | { id: number; status: string; expires_at: Date | string }
    | undefined;
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (order.status !== "pending") {
    res.status(409).json({ error: `Order is already ${order.status}` });
    return;
  }
  const exp = new Date(order.expires_at as any).getTime();
  if (exp <= Date.now()) {
    await db.execute(sql`
      UPDATE usdt_orders SET status = 'expired', updated_at = NOW()
       WHERE id = ${id} AND status = 'pending'
    `);
    res.status(410).json({ error: "Payment window expired. Please start a new order." });
    return;
  }

  // Reject if this exact TxID was already used in any order — TRC-20 hashes
  // are globally unique so a duplicate strongly implies the user is trying
  // to settle two orders against one transfer.
  const dup = await db.execute(sql`
    SELECT id, user_id FROM usdt_orders
     WHERE tx_id = ${cleanTx} AND id <> ${id}
     LIMIT 1
  `);
  const dupRow = ((dup as any).rows?.[0] || (dup as any)[0]);
  if (dupRow) {
    res.status(409).json({ error: "This TxID has already been submitted on another order" });
    return;
  }

  // Cap raw data-URL size at 8 MB (≈ 6 MB image after base64 inflate)
  // — same heuristic the order screenshot path uses.
  const sizeBytes = Math.ceil((screenshotDataUrl.length - screenshotDataUrl.indexOf(",") - 1) * 3 / 4);
  if (sizeBytes > 8 * 1024 * 1024) {
    res.status(400).json({ error: `Screenshot must be under 8 MB (got ${(sizeBytes / 1024 / 1024).toFixed(1)} MB)` });
    return;
  }

  // Atomic transition: refuse the second of two racing submits cleanly
  // instead of overwriting tx_id/screenshot. Without the status guard,
  // both requests would pass the SELECT above and both would mutate the
  // row, leaving the second submitter's TxID even though the first one
  // already returned 200.
  const upd = await db.execute(sql`
    UPDATE usdt_orders
       SET tx_id = ${cleanTx},
           screenshot_url = ${screenshotDataUrl},
           status = 'submitted',
           submitted_at = NOW(),
           updated_at = NOW()
     WHERE id = ${id} AND user_id = ${u.id} AND status = 'pending'
    RETURNING id
  `);
  const updRow = ((upd as any).rows?.[0] || (upd as any)[0]);
  if (!updRow) {
    res.status(409).json({ error: "Order is no longer pending" });
    return;
  }
  res.json({ ok: true, status: "submitted" });
});

router.post("/cancel/:id", async (req, res) => {
  const u = (req as any).user as { id: number };
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid order id" });
    return;
  }
  const r = await db.execute(sql`
    UPDATE usdt_orders
       SET status = 'cancelled',
           cancelled_at = NOW(),
           updated_at = NOW()
     WHERE id = ${id} AND user_id = ${u.id}
       AND status = 'pending'
    RETURNING id
  `);
  const row = ((r as any).rows?.[0] || (r as any)[0]);
  if (!row) {
    res.status(409).json({ error: "Order can't be cancelled (already submitted or finalised)" });
    return;
  }
  res.json({ ok: true });
});

// 15-minute admin review window. After this, submitted orders auto-shift
// to "processing" status — still pending admin action, but UI surfaces
// it as a different state ("under processing" vs "under review") so the
// user knows the SLA window has passed and the request is queued.
const REVIEW_WINDOW_MS = 15 * 60 * 1000;

function computeReviewSecondsRemaining(submittedAt: Date | string | null): number | null {
  if (!submittedAt) return null;
  const subMs = new Date(submittedAt).getTime();
  if (!Number.isFinite(subMs)) return null;
  return Math.max(0, Math.ceil((subMs + REVIEW_WINDOW_MS - Date.now()) / 1000));
}

// Defensive auto-shift: any submitted order past the 15-min review SLA
// is moved to "processing" so admin queue + user UI both reflect the
// degraded state. Same row can still be approved/rejected by admin.
async function autoFlipSubmittedToProcessing(userId?: number) {
  const where = userId
    ? sql`WHERE user_id = ${userId} AND status = 'submitted' AND submitted_at IS NOT NULL AND submitted_at <= NOW() - INTERVAL '15 minutes'`
    : sql`WHERE status = 'submitted' AND submitted_at IS NOT NULL AND submitted_at <= NOW() - INTERVAL '15 minutes'`;
  await db.execute(sql`
    UPDATE usdt_orders
       SET status = 'processing', updated_at = NOW()
    ${where}
  `).catch(() => {});
}

router.get("/my-orders", async (req, res) => {
  const u = (req as any).user as { id: number };
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "50")) || 50));
  // Defensive auto-expire for any pending orders past their window so the
  // history listing is always honest.
  await db.execute(sql`
    UPDATE usdt_orders
       SET status = 'expired', updated_at = NOW()
     WHERE user_id = ${u.id}
       AND status = 'pending'
       AND expires_at <= NOW()
  `);
  await autoFlipSubmittedToProcessing(u.id);
  const rows = await db.execute(sql`
    SELECT id, usdt_amount, rate_snapshot, bonus_pct_snapshot,
           inr_value, bonus_inr, total_credit,
           address, address_label, tx_id, screenshot_url,
           status, admin_note, expires_at,
           submitted_at, approved_at, cancelled_at, created_at
      FROM usdt_orders
     WHERE user_id = ${u.id}
     ORDER BY created_at DESC
     LIMIT ${limit}
  `);
  const list = ((rows as any).rows || (rows as any) || []) as any[];
  res.json(list.map((r) => ({
    id: r.id,
    usdtAmount: Number(r.usdt_amount),
    rate: Number(r.rate_snapshot),
    bonusPercent: Number(r.bonus_pct_snapshot),
    inrValue: Number(r.inr_value),
    bonusInr: Number(r.bonus_inr),
    totalCredit: Number(r.total_credit),
    address: r.address,
    addressLabel: r.address_label,
    txId: r.tx_id,
    screenshotUrl: r.screenshot_url,
    status: r.status,
    adminNote: r.admin_note,
    expiresAt: r.expires_at,
    submittedAt: r.submitted_at,
    approvedAt: r.approved_at,
    cancelledAt: r.cancelled_at,
    createdAt: r.created_at,
    reviewSecondsRemaining: r.status === "submitted" ? computeReviewSecondsRemaining(r.submitted_at) : null,
    reviewDeadlineAt: r.submitted_at ? new Date(new Date(r.submitted_at).getTime() + REVIEW_WINDOW_MS).toISOString() : null,
  })));
});

router.get("/order/:id", async (req, res) => {
  const u = (req as any).user as { id: number };
  const id = Number(req.params.id);
  // Mirror /my-orders defensive transitions on the single-order read so
  // the payment screen (polled every 5s) reflects reality the moment a
  // window closes — without waiting for the background job tick.
  // - pending past expires_at → expired (so user sees "Expired" view
  //   instead of a pending UI with disabled inputs).
  // - submitted past 15-min SLA → processing (TrustPay queue).
  await db.execute(sql`
    UPDATE usdt_orders
       SET status = 'expired', updated_at = NOW()
     WHERE id = ${id}
       AND user_id = ${u.id}
       AND status = 'pending'
       AND expires_at <= NOW()
  `).catch(() => {});
  await autoFlipSubmittedToProcessing(u.id);
  const rows = await db.execute(sql`
    SELECT id, usdt_amount, rate_snapshot, bonus_pct_snapshot,
           inr_value, bonus_inr, total_credit,
           address, address_label, tx_id, screenshot_url,
           status, admin_note, expires_at,
           submitted_at, approved_at, cancelled_at, created_at
      FROM usdt_orders
     WHERE id = ${id} AND user_id = ${u.id}
     LIMIT 1
  `);
  const r = ((rows as any).rows?.[0] || (rows as any)[0]);
  if (!r) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json({
    id: r.id,
    usdtAmount: Number(r.usdt_amount),
    rate: Number(r.rate_snapshot),
    bonusPercent: Number(r.bonus_pct_snapshot),
    inrValue: Number(r.inr_value),
    bonusInr: Number(r.bonus_inr),
    totalCredit: Number(r.total_credit),
    address: r.address,
    addressLabel: r.address_label,
    txId: r.tx_id,
    screenshotUrl: r.screenshot_url,
    status: r.status,
    adminNote: r.admin_note,
    expiresAt: r.expires_at,
    submittedAt: r.submitted_at,
    approvedAt: r.approved_at,
    cancelledAt: r.cancelled_at,
    createdAt: r.created_at,
    reviewSecondsRemaining: r.status === "submitted" ? computeReviewSecondsRemaining(r.submitted_at) : null,
    reviewDeadlineAt: r.submitted_at ? new Date(new Date(r.submitted_at).getTime() + REVIEW_WINDOW_MS).toISOString() : null,
  });
});

// Exported so the background mediaCleanup job can run the same flip
// across every user without each user having to hit /my-orders first.
export const usdtAutoFlipSubmittedToProcessing = autoFlipSubmittedToProcessing;

export default router;
