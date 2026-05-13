import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

let vapidReady = false;

function ensureVapid() {
  if (vapidReady) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return;
  webpush.setVapidDetails("mailto:admin@trustpayapp.in", pub, priv);
  vapidReady = true;
}

export async function sendPushToUser(userId: number, title: string, body: string, url = "/") {
  ensureVapid();
  if (!vapidReady) return;
  let subs: typeof pushSubscriptionsTable.$inferSelect[] = [];
  try {
    subs = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId));
  } catch {
    return;
  }
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url }),
      );
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id)).catch(() => {});
      } else {
        logger.warn({ err, userId }, "push send failed");
      }
    }
  }
}
