import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { storeSmsForLearning } from "../lib/sms-bridge.js";
import { db } from "@workspace/db";
import { smsSafeSendersTable, smsActivePatternsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
  if (!["suspicious", "unparsed", "matched"].includes(bucket)) {
    return res.status(400).json({ error: "bucket must be suspicious, unparsed, or matched" });
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

router.get("/trusted-senders", requireAuth, async (_req, res) => {
  const [safeSenders, activePatterns] = await Promise.all([
    db.select({ senderKey: smsSafeSendersTable.senderKey }).from(smsSafeSendersTable),
    db.select({
      senderKey: smsActivePatternsTable.senderKey,
      utrRegex: smsActivePatternsTable.utrRegex,
      amountRegex: smsActivePatternsTable.amountRegex,
    })
      .from(smsActivePatternsTable)
      .where(eq(smsActivePatternsTable.isActive, true)),
  ]);

  const keys = new Set<string>([
    ...safeSenders.map((s) => s.senderKey.toUpperCase()),
    ...activePatterns.map((p) => p.senderKey.toUpperCase()),
  ]);

  res.json({
    senderKeys: Array.from(keys),
    activePatterns: activePatterns.map((p) => ({
      senderKey: p.senderKey.toUpperCase(),
      utrRegex: p.utrRegex,
      amountRegex: p.amountRegex,
    })),
  });
});

export default router;
