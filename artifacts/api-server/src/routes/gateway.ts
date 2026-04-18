import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, usersTable, transactionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { getSettings } from "../lib/settings.js";

const router = Router();

function extractGatewayTxn(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/gw_txn:([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

router.post("/create-deposit", requireAuth, async (req, res) => {
  const currentUser = (req as any).user;
  const { amount, depositTaskId, userName } = req.body;
  if (!amount || amount <= 0) {
    res.status(400).json({ error: "Amount required" });
    return;
  }

  const [existing] = await db.select().from(ordersTable).where(
    and(
      eq(ordersTable.userId, currentUser.id),
      eq(ordersTable.type, "deposit"),
      eq(ordersTable.status, "pending"),
    ),
  ).limit(1);
  if (existing) {
    res.status(400).json({ error: "You already have a pending deposit. Cancel it first." });
    return;
  }

  const settings = await getSettings(["upiId", "upiName"]);
  const gatewaySettings = await getSettings([
    "gatewayBaseUrl",
    "gatewayMerchantId",
    "gatewayApiKey",
    "gatewayApiSecret",
    "gatewayWebhookSecret",
    "gatewayAuthMethod",
    "gatewayCreatePaymentPath",
    "gatewayVerifyPaymentPath",
    "gatewayRefundPath",
    "gatewayStatusPath",
  ]);
  const gatewayBaseUrl = gatewaySettings.gatewayBaseUrl || "https://gateway-hub--kishorimeeraa.replit.app";
  const gatewayApi = `${gatewayBaseUrl}/api`;
  const gatewayKey = gatewaySettings.gatewayApiKey || "";
  const gatewaySecret = gatewaySettings.gatewayApiSecret || "";
  const gatewayWebhookSecret = gatewaySettings.gatewayWebhookSecret || "whsec_trustpay1";
  const gatewayMerchantId = gatewaySettings.gatewayMerchantId || "Tporder";
  const gatewayAuthMethod = gatewaySettings.gatewayAuthMethod || "bearer";
  const gatewayCreatePath = gatewaySettings.gatewayCreatePaymentPath || "/payments";
  const gatewayVerifyPath = gatewaySettings.gatewayVerifyPaymentPath || "/payments/:id/verify";
  const gatewayRefundPath = gatewaySettings.gatewayRefundPath || "/refunds";
  const gatewayStatusPath = gatewaySettings.gatewayStatusPath || "/payments/:id/status";
  const rewardPercent = 4;
  const rewardAmount = parseFloat((amount * rewardPercent / 100).toFixed(2));
  const totalAmount = parseFloat((amount + rewardAmount).toFixed(2));

  const [order] = await db.insert(ordersTable).values({
    userId: currentUser.id,
    type: "deposit",
    amount: String(amount),
    rewardPercent: String(rewardPercent),
    rewardAmount: String(rewardAmount),
    totalAmount: String(totalAmount),
    status: "pending",
    upiId: settings.upiId,
    upiName: settings.upiName,
    userName: userName || currentUser.username,
    notes: "gateway:pending",
  }).returning();

  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const webhookUrl = `${proto}://${host}/api/gateway/webhook`;
  const redirectUrl = `${proto}://${host}/`;

  const payload = {
    appId: gatewayMerchantId,
    merchantId: gatewayMerchantId,
    orderId: `trustpay_${order.id}_${Date.now()}`,
    amount: Number(amount),
    currency: "INR",
    customerName: userName || currentUser.username,
    customerEmail: `${currentUser.username}@trustpay.local`,
    customerPhone: currentUser.phone || "9999999999",
    description: `TrustPay deposit order #${order.id}`,
    redirectUrl,
    webhookUrl,
    apiSecret: gatewaySecret,
    webhookSecret: gatewayWebhookSecret,
  };

  try {
    const gatewayRes = await fetch(`${gatewayApi}${gatewayCreatePath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: gatewayAuthMethod === "bearer" ? `Bearer ${gatewayKey}` : gatewayKey,
      },
      body: JSON.stringify(payload),
    });
    const text = await gatewayRes.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch {}

    if (!gatewayRes.ok) {
      const detail = typeof data === "object" && data ? data : { raw: text };
      await db.update(ordersTable).set({
        status: "rejected",
        notes: `gateway_error:${text.slice(0, 200)}`,
        updatedAt: new Date(),
      }).where(eq(ordersTable.id, order.id));
      res.status(502).json({ error: "Gateway create failed", detail, status: gatewayRes.status });
      return;
    }

    const txnId = data.id || data.transactionId || data.orderId || data.paymentId || null;
    const paymentUrl = data.paymentUrl || data.redirectUrl || data.url || (txnId ? `${gatewayBaseUrl}/pay/${txnId}` : null);
    const verifyUrl = txnId ? `${gatewayApi}${gatewayVerifyPath.replace(":id", encodeURIComponent(String(txnId)))}` : null;
    const refundUrl = txnId ? `${gatewayApi}${gatewayRefundPath}` : null;

    await db.update(ordersTable).set({
      notes: txnId ? `gw_txn:${txnId}` : "gateway:created",
      updatedAt: new Date(),
    }).where(eq(ordersTable.id, order.id));

    res.json({
      orderId: order.id,
      transactionId: txnId,
      paymentUrl,
      verifyUrl,
      refundUrl,
      qrCode: data.qrCode || null,
      gateway: data,
    });
  } catch (err: any) {
    await db.update(ordersTable).set({
      status: "rejected",
      notes: `gateway_exception:${err.message}`.slice(0, 200),
      updatedAt: new Date(),
    }).where(eq(ordersTable.id, order.id));
    res.status(502).json({ error: "Gateway request failed", message: err.message });
  }
});

router.post("/webhook", async (req, res) => {
  const { transactionId, utrNumber, amount, status } = req.body || {};
  if (!transactionId) {
    res.status(400).json({ error: "transactionId required" });
    return;
  }

  const all = await db.select().from(ordersTable).where(
    and(eq(ordersTable.type, "deposit"), eq(ordersTable.status, "pending")),
  );
  const order = all.find((o) => extractGatewayTxn(o.notes) === transactionId);
  if (!order) {
    res.status(404).json({ error: "Order not found for transaction" });
    return;
  }

  const normalized = String(status || "").toUpperCase();
  if (normalized === "SUCCESS" || normalized === "PAID" || normalized === "COMPLETED") {
    const orderAmount = parseFloat(order.amount);
    const rewardPercent = parseFloat(order.rewardPercent);
    const rewardAmount = parseFloat((orderAmount * rewardPercent / 100).toFixed(2));
    const totalAmount = parseFloat((orderAmount + rewardAmount).toFixed(2));

    await db.update(ordersTable).set({
      status: "approved",
      utrNumber: utrNumber || order.utrNumber,
      notes: `gw_txn:${transactionId};verified`,
      updatedAt: new Date(),
    }).where(eq(ordersTable.id, order.id));

    await db.update(usersTable).set({
      balance: sql`${usersTable.balance} + ${totalAmount}`,
      totalDeposits: sql`${usersTable.totalDeposits} + ${orderAmount}`,
    }).where(eq(usersTable.id, order.userId));

    await db.insert(transactionsTable).values({
      userId: order.userId,
      orderId: order.id,
      type: "credit",
      amount: String(totalAmount),
      description: `Gateway deposit approved (UTR: ${utrNumber || "n/a"})`,
    });

    res.json({ success: true, orderId: order.id, status: "approved" });
    return;
  }

  if (normalized === "FAILED" || normalized === "REJECTED" || normalized === "CANCELLED") {
    await db.update(ordersTable).set({
      status: "rejected",
      notes: `gw_txn:${transactionId};${normalized.toLowerCase()}`,
      updatedAt: new Date(),
    }).where(eq(ordersTable.id, order.id));
    res.json({ success: true, orderId: order.id, status: "rejected" });
    return;
  }

  res.json({ success: true, orderId: order.id, status: "pending", received: normalized });
});

router.get("/status/:orderId", requireAuth, async (req, res) => {
  const id = parseInt(req.params.orderId);
  const currentUser = (req as any).user;
  const [order] = await db.select().from(ordersTable).where(
    and(eq(ordersTable.id, id), eq(ordersTable.userId, currentUser.id)),
  ).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const txnId = extractGatewayTxn(order.notes);
  let gatewayStatus: any = null;
  if (txnId) {
    try {
      const r = await fetch(`${gatewayApi}${gatewayStatusPath.replace(":id", encodeURIComponent(String(txnId)))}`, {
        headers: { Authorization: gatewayAuthMethod === "bearer" ? `Bearer ${gatewayKey}` : gatewayKey },
      });
      const text = await r.text();
      try { gatewayStatus = JSON.parse(text); } catch { gatewayStatus = { raw: text }; }
    } catch (err: any) {
      gatewayStatus = { error: err.message };
    }
  }

  res.json({
    orderId: order.id,
    status: order.status,
    transactionId: txnId,
    utrNumber: order.utrNumber,
    gateway: gatewayStatus,
  });
});

export default router;
