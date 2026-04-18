import { db, usersTable, ordersTable, userUpiIdsTable, disputesTable, settingsTable, highValueEventsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const BASE = process.env.TEST_API_BASE || `https://${process.env.REPLIT_DEV_DOMAIN}/api`;

export type AuthedUser = { id: number; username: string; phone: string; password: string; token: string };

export async function api(
  path: string,
  opts: { method?: string; token?: string; body?: any } = {},
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const r = await fetch(BASE + path, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, data };
}

function uniq() { return Math.random().toString(36).slice(2, 8); }

export function freshUsername(prefix = "u"): string {
  return `${prefix}_${uniq()}`.slice(0, 20);
}

export function freshPhone(): string {
  // 10-digit starting 6-9
  let s = String(6 + Math.floor(Math.random() * 4));
  while (s.length < 10) s += String(Math.floor(Math.random() * 10));
  return s;
}

export async function registerUser(prefix = "u"): Promise<AuthedUser> {
  const username = freshUsername(prefix);
  const phone = freshPhone();
  const password = "test1234";
  const r = await api("/auth/register", { method: "POST", body: { username, phone, password } });
  if (r.status !== 200) throw new Error(`register failed: ${r.status} ${JSON.stringify(r.data)}`);
  return { id: r.data.user.id, username, phone, password, token: r.data.token };
}

export async function adminLogin(): Promise<{ token: string; id: number }> {
  // Try default admin "admin"/"password"; fallback: bootstrap a hashed password into settings.
  let r = await api("/admin/login", { method: "POST", body: { username: "admin", password: "password" } });
  if (r.status !== 200) {
    // Bootstrap: write known hash so admin login works.
    const hash = await bcrypt.hash("password", 10);
    const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, "adminPasswordHash")).limit(1);
    if (existing[0]) {
      await db.update(settingsTable).set({ value: hash, updatedAt: new Date() }).where(eq(settingsTable.key, "adminPasswordHash"));
    } else {
      await db.insert(settingsTable).values({ key: "adminPasswordHash", value: hash });
    }
    r = await api("/admin/login", { method: "POST", body: { username: "admin", password: "password" } });
  }
  if (r.status !== 200) throw new Error(`admin login failed: ${r.status} ${JSON.stringify(r.data)}`);
  return { token: r.data.token, id: r.data.user.id };
}

export async function setUserBalance(userId: number, balance: number): Promise<void> {
  await db.update(usersTable).set({ balance: String(balance), heldBalance: "0" }).where(eq(usersTable.id, userId));
}

export async function getUser(userId: number) {
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return u;
}

export async function insertSellChunk(sellerId: number, amount: number): Promise<number> {
  // Ensure seller has a UPI row so seller-side display is correct (not strictly needed for buy flow, but realistic)
  const [existing] = await db.select().from(userUpiIdsTable).where(eq(userUpiIdsTable.userId, sellerId)).limit(1);
  if (!existing) {
    await db.insert(userUpiIdsTable).values({
      userId: sellerId, upiId: `seed${sellerId}@upi`, platform: "PhonePe", bankName: "HDFC", holderName: `Seed ${sellerId}`, isActive: true,
    });
  }
  const [row] = await db.insert(ordersTable).values({
    userId: sellerId,
    type: "withdrawal",
    amount: String(amount),
    rewardPercent: "0", rewardAmount: "0",
    totalAmount: String(amount),
    status: "available",
    userUpiId: `seed${sellerId}@upi`,
    userUpiName: `Seed ${sellerId}`,
    userName: `Seed ${sellerId}`,
  }).returning();
  return row.id;
}

export async function setOrderConfirmDeadline(orderId: number, when: Date): Promise<void> {
  await db.update(ordersTable).set({ confirmDeadline: when }).where(eq(ordersTable.id, orderId));
}

export async function findDisputeForOrder(orderId: number) {
  const [d] = await db.select().from(disputesTable).where(eq(disputesTable.orderId, orderId)).limit(1);
  return d;
}

export async function highValueRowsForOrder(orderId: number) {
  return db.select().from(highValueEventsTable).where(eq(highValueEventsTable.orderId, orderId));
}

// Tiny valid base64 PNG (1x1 transparent) — used for fields that go through
// MIME validation only (not stored & cross-checked for duplicates).
export const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
export const TINY_PDF = "data:application/pdf;base64," + Buffer.from("%PDF-1.4\n%EOF\n").toString("base64");

// Unique data URL — image-mime so it passes both fraud-hash dedup (different
// payload per call) and the dispute proof MIME regex.
export function uniqueImg(): string {
  const padding = Buffer.from(`unique-${Date.now()}-${Math.random().toString(36).slice(2)}-${"x".repeat(120)}`).toString("base64");
  return `data:image/png;base64,${padding}`;
}
