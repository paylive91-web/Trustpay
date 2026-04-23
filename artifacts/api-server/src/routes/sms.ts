import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { storeSmsForLearning } from "../lib/sms-bridge.js";

const router = Router();

router.post("/report", requireAuth, async (req: any, res: any) => {
  const user = (req as any).user;
  const { sender, body, bucket, parsedUtr, parsedAmount, isDebit, hasReversal } = req.body || {};

  if (!sender || typeof sender !== "string") {
    return res.status(400).json({ error: "sender required" });
  }
  if (!body || typeof body !== "string") {
    return res.status(400).json({ error: "body required" });
  }
  if (!["suspicious", "unparsed"].includes(bucket)) {
    return res.status(400).json({ error: "bucket must be suspicious or unparsed" });
  }
  if (body.length > 2000) {
    return res.status(400).json({ error: "SMS body too long" });
  }

  await storeSmsForLearning({
    sender: String(sender).slice(0, 64),
    body: String(body).slice(0, 2000),
    bucket,
    parsedUtr: parsedUtr ? String(parsedUtr).slice(0, 20) : null,
    parsedAmount: parsedAmount != null ? Number(parsedAmount) : null,
    isDebit: Boolean(isDebit),
    hasReversal: Boolean(hasReversal),
    userId: user?.id || null,
  });

  res.json({ ok: true });
});

export default router;
