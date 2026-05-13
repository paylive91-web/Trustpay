import { Router } from "express";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/vapid-public-key", (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || "";
  res.json({ key });
});

router.post("/subscribe", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const { endpoint, p256dh, auth } = req.body || {};
  if (!endpoint || !p256dh || !auth) {
    res.status(400).json({ error: "endpoint, p256dh, auth required" });
    return;
  }
  await db
    .insert(pushSubscriptionsTable)
    .values({ userId, endpoint, p256dh, auth })
    .onConflictDoUpdate({ target: pushSubscriptionsTable.endpoint, set: { userId, p256dh, auth } });
  res.json({ success: true });
});

router.delete("/subscribe", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const { endpoint } = req.body || {};
  if (!endpoint) { res.status(400).json({ error: "endpoint required" }); return; }
  await db.delete(pushSubscriptionsTable).where(
    and(eq(pushSubscriptionsTable.endpoint, endpoint), eq(pushSubscriptionsTable.userId, userId))
  );
  res.json({ success: true });
});

export default router;
