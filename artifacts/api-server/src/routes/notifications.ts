import { Router } from "express";
import { db } from "@workspace/db";
import { userNotificationsTable } from "@workspace/db";
import { and, eq, sql, isNull } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

function fNotification(n: any) {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    severity: n.severity,
    fraudAlertId: n.fraudAlertId,
    readAt: n.readAt,
    createdAt: n.createdAt,
  };
}

router.get("/", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const { unread } = req.query as { unread?: string };
  const conds: any[] = [eq(userNotificationsTable.userId, userId)];
  if (unread === "true") conds.push(isNull(userNotificationsTable.readAt));
  const rows = await db.select().from(userNotificationsTable)
    .where(and(...conds))
    .orderBy(sql`${userNotificationsTable.createdAt} desc`)
    .limit(100);
  const unreadRow = await db.select({ c: sql<string>`COUNT(*)` })
    .from(userNotificationsTable)
    .where(and(eq(userNotificationsTable.userId, userId), isNull(userNotificationsTable.readAt)));
  res.json({
    notifications: rows.map(fNotification),
    unreadCount: parseInt(String(unreadRow[0]?.c || "0")),
  });
});

router.post("/:id/read", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const id = parseInt(req.params.id);
  await db.update(userNotificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(userNotificationsTable.id, id), eq(userNotificationsTable.userId, userId)));
  res.json({ success: true });
});

router.post("/read-all", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  await db.update(userNotificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(userNotificationsTable.userId, userId), isNull(userNotificationsTable.readAt)));
  res.json({ success: true });
});

export default router;
