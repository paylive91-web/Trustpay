import { Router } from "express";
import { db } from "@workspace/db";
import { disputesTable, ordersTable, usersTable, transactionsTable, userNotificationsTable } from "@workspace/db";
import { eq, and, or, sql, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import { applyTrustDelta, bumpSuccessfulTrade } from "../lib/trust.js";
import { settleConfirmedTrade } from "../lib/settle.js";

const router = Router();

router.get("/my", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const rows = await db.select().from(disputesTable).where(or(
    eq(disputesTable.buyerId, u.id),
    eq(disputesTable.sellerId, u.id),
  )).orderBy(sql`${disputesTable.createdAt} desc`);
  const orderIds = rows.map((r) => r.orderId);
  const orders = orderIds.length ? await db.select().from(ordersTable).where(inArray(ordersTable.id, orderIds)) : [];
  const byId = new Map(orders.map((o) => [o.id, o]));
  res.json(rows.map((r) => ({
    ...r,
    role: r.buyerId === u.id ? "buyer" : "seller",
    order: byId.get(r.orderId),
  })));
});

// Bank statements must be PDF (image screenshots no longer accepted).
// Other proof kinds (recordings, transaction screenshots) remain image-only.
const PDF_PROOF_MIME = /^data:application\/pdf;base64,/i;
const IMAGE_PROOF_MIME = /^data:image\/(png|jpe?g|gif|webp|heic);base64,/i;
const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5 MB raw
function validateProof(dataUrl: unknown, kind: "image" | "pdf"): string | null {
  if (typeof dataUrl !== "string" || dataUrl.length < 32) return "Invalid file";
  const ok = kind === "pdf" ? PDF_PROOF_MIME : IMAGE_PROOF_MIME;
  if (!ok.test(dataUrl)) {
    return kind === "pdf"
      ? "Only PDF files allowed for bank statements"
      : "Only PNG/JPG/WEBP/HEIC images allowed";
  }
  // base64 expands by ~4/3; check decoded byte size <= MAX_PROOF_BYTES
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bytes = Math.floor(b64.length * 3 / 4);
  if (bytes > MAX_PROOF_BYTES) return "File exceeds 5 MB";
  return null;
}

router.post("/buyer-proof/:id", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const id = parseInt(req.params.id);
  const { bankStatementUrl, txHistoryUrl } = req.body;
  // For seller_offline disputes bank statement is optional; txHistory is required
  const [d] = await db.select().from(disputesTable).where(eq(disputesTable.id, id)).limit(1);
  if (!d || d.buyerId !== u.id || d.status !== "open") {
    res.status(400).json({ error: "Cannot upload" }); return;
  }
  // Validate bank statement (pdf) only if provided
  if (bankStatementUrl) {
    const err = validateProof(bankStatementUrl, "pdf");
    if (err) { res.status(400).json({ error: err }); return; }
  }
  // Validate txHistory screenshot (image) only if provided
  if (txHistoryUrl) {
    const err = validateProof(txHistoryUrl, "image");
    if (err) { res.status(400).json({ error: err }); return; }
  }
  if (!bankStatementUrl && !txHistoryUrl) {
    res.status(400).json({ error: "At least one proof file is required" }); return;
  }
  const updates: Record<string, any> = { buyerProofAt: new Date() };
  if (bankStatementUrl) updates.buyerBankStatementUrl = bankStatementUrl;
  if (txHistoryUrl) updates.buyerTxHistoryUrl = txHistoryUrl;
  await db.update(disputesTable).set(updates).where(eq(disputesTable.id, id));
  res.json({ success: true });
});

router.post("/seller-proof/:id", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const id = parseInt(req.params.id);
  const { bankStatementUrl, recordingUrl, lastTxnScreenshotUrl } = req.body;
  for (const [name, url, kind] of [
    ["bank statement", bankStatementUrl, "pdf" as const],
    ["screen recording", recordingUrl, "image" as const],
    ["last-transaction screenshot", lastTxnScreenshotUrl, "image" as const],
  ]) {
    const e = validateProof(url, kind as any);
    if (e) { res.status(400).json({ error: `${name}: ${e}` }); return; }
  }
  const [d] = await db.select().from(disputesTable).where(eq(disputesTable.id, id)).limit(1);
  if (!d || d.sellerId !== u.id || d.status !== "open") {
    res.status(400).json({ error: "Cannot upload" }); return;
  }
  await db.update(disputesTable).set({
    sellerBankStatementUrl: bankStatementUrl,
    sellerRecordingUrl: recordingUrl,
    sellerLastTxnScreenshotUrl: lastTxnScreenshotUrl,
    sellerProofAt: new Date(),
  }).where(eq(disputesTable.id, id));
  res.json({ success: true });
});

// ADMIN endpoints
router.get("/admin/list", requireAdmin, async (req, res) => {
  // Auto-resolve silent disputes
  await autoResolveSilent();
  const rows = await db.select().from(disputesTable).orderBy(sql`${disputesTable.createdAt} desc`).limit(200);
  const userIds = [...new Set([...rows.map((r) => r.buyerId), ...rows.map((r) => r.sellerId)])];
  const orderIds = rows.map((r) => r.orderId);
  const users = userIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const orders = orderIds.length ? await db.select().from(ordersTable).where(inArray(ordersTable.id, orderIds)) : [];
  const userById = new Map(users.map((u) => [u.id, u]));
  const orderById = new Map(orders.map((o) => [o.id, o]));
  res.json(rows.map((r) => ({
    ...r,
    buyer: userById.get(r.buyerId) ? { id: r.buyerId, username: userById.get(r.buyerId)!.username, trustScore: userById.get(r.buyerId)!.trustScore } : null,
    seller: userById.get(r.sellerId) ? { id: r.sellerId, username: userById.get(r.sellerId)!.username, trustScore: userById.get(r.sellerId)!.trustScore } : null,
    order: orderById.get(r.orderId),
  })));
});

router.post("/admin/resolve/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { winner, notes } = req.body; // "buyer" | "seller"
  if (winner !== "buyer" && winner !== "seller") {
    res.status(400).json({ error: "winner must be 'buyer' or 'seller'" }); return;
  }
  const [d] = await db.select().from(disputesTable).where(eq(disputesTable.id, id)).limit(1);
  if (!d || d.status !== "open") { res.status(400).json({ error: "Dispute already resolved" }); return; }

  if (winner === "buyer") {
    await settleConfirmedTrade(d.orderId, false);
    // Settlement applies +1 trust to both parties for trade_success.
    // Reverse the unintended seller +1, then apply the -10 dispute loss net.
    await applyTrustDelta(d.sellerId, -11, "dispute_loss", d.orderId);

    // For seller_offline disputes: buyer gets an extra +1 trust for patience
    // + waiting — already got +1 from trade_success, this is the bonus.
    if (d.triggerReason === "seller_offline") {
      await applyTrustDelta(d.buyerId, 1, "seller_offline_buyer_bonus", d.orderId);
      const [ord] = await db.select().from(ordersTable).where(eq(ordersTable.id, d.orderId)).limit(1);
      await db.insert(userNotificationsTable).values({
        userId: d.buyerId,
        kind: "seller_offline_buyer_bonus",
        title: "✅ +1 Bonus Trust Score",
        body: `Seller ke offline jaane ke kaaran aapka ₹${ord ? parseFloat(ord.amount).toFixed(2) : "?"} hold mein tha. System ne verify kiya ki aapne real payment ki — wait karne ke liye extra +1 trust score diya ja raha hai!`,
        severity: "info",
      });
    }
  } else {
    // Seller wins - release seller's hold back to balance, reset chunk to available, buyer gets nothing.
    const [chunk] = await db.select().from(ordersTable).where(eq(ordersTable.id, d.orderId)).limit(1);
    const heldAmt = chunk ? parseFloat(chunk.heldAmount || "0") : 0;
    const { releaseHold } = await import("../lib/hold.js");
    await db.transaction(async (tx) => {
      if (chunk) {
        await releaseHold(chunk.userId, heldAmt, tx);
      }
      await tx.update(ordersTable).set({
        status: "available",
        lockedAt: null, lockedByUserId: null, confirmDeadline: null,
        utrNumber: null, screenshotUrl: null, recordingUrl: null,
        submittedAt: null,
        updatedAt: new Date(),
      }).where(eq(ordersTable.id, d.orderId));
    });
    await applyTrustDelta(d.buyerId, -10, "dispute_loss", d.orderId);
  }
  await db.update(disputesTable).set({
    status: winner === "buyer" ? "buyer_won" : "seller_won",
    resolvedAt: new Date(),
    resolvedBy: (req as any).user.id,
    adminNotes: notes || null,
  }).where(eq(disputesTable.id, id));
  res.json({ success: true });
});

async function autoResolveSilent() {
  const now = new Date();
  const open = await db.select().from(disputesTable).where(eq(disputesTable.status, "open"));
  for (const d of open) {
    const buyerSubmitted = !!d.buyerProofAt;
    const sellerSubmitted = !!d.sellerProofAt;
    const buyerLate = d.buyerProofDeadline && d.buyerProofDeadline < now && !buyerSubmitted;
    const sellerLate = d.sellerProofDeadline && d.sellerProofDeadline < now && !sellerSubmitted;
    if (buyerLate && !sellerLate) {
      // Seller wins - buyer silent. Release seller's hold back to balance.
      const [chunk] = await db.select().from(ordersTable).where(eq(ordersTable.id, d.orderId)).limit(1);
      const heldAmt = chunk ? parseFloat(chunk.heldAmount || "0") : 0;
      const { releaseHold } = await import("../lib/hold.js");
      await db.transaction(async (tx) => {
        if (chunk) {
          await releaseHold(chunk.userId, heldAmt, tx);
        }
        await tx.update(ordersTable).set({
          status: "available",
          lockedAt: null, lockedByUserId: null, confirmDeadline: null,
          utrNumber: null, screenshotUrl: null, recordingUrl: null, submittedAt: null,
          updatedAt: new Date(),
        }).where(eq(ordersTable.id, d.orderId));
      });
      await applyTrustDelta(d.buyerId, -10, "dispute_silent", d.orderId);
      await db.update(disputesTable).set({
        status: "auto_resolved", resolvedAt: now, adminNotes: "Buyer silent → seller wins",
      }).where(eq(disputesTable.id, d.id));
    } else if (sellerLate && !buyerLate) {
      // Buyer wins - seller silent
      await settleConfirmedTrade(d.orderId, false);
      await applyTrustDelta(d.sellerId, -11, "dispute_silent", d.orderId);
      await db.update(disputesTable).set({
        status: "auto_resolved", resolvedAt: now, adminNotes: "Seller silent → buyer wins",
      }).where(eq(disputesTable.id, d.id));
    }
  }
}

export default router;
