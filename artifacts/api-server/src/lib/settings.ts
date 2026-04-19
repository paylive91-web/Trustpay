import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEFAULT_SETTINGS: Record<string, string> = {
  upiId: "trustpay@upi",
  upiName: "TrustPay",
  popupMessage: "Welcome to TrustPay! Start earning rewards today.",
  popupImageUrl: "",
  telegramLink: "https://t.me/trustpay",
  bannerImages: JSON.stringify([]),
  appName: "TrustPay",
  adminUsername: "admin",
  adminPasswordHash: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
  highValueThreshold: "5000",
  highValueCriticalThreshold: "10000",
  newUserChunkCap: "10000",
  newUserTradeThreshold: "5",
  chunkMin: "100",
  chunkMax: "50000",
  platformCommissionPerChunk: "1",
  platformCommissionTotal: "0",
  buyLockMinutes: "15",
  sellerConfirmMinutes: "15",
  disputeWindowHours: "24",
};

export async function getSetting(key: string): Promise<string> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  if (rows[0]) return rows[0].value;
  return DEFAULT_SETTINGS[key] ?? "";
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const allRows = await db.select().from(settingsTable);
  const result: Record<string, string> = {};
  for (const key of keys) {
    const row = allRows.find((r) => r.key === key);
    result[key] = row ? row.value : (DEFAULT_SETTINGS[key] ?? "");
  }
  return result;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const allRows = await db.select().from(settingsTable);
  const result: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of allRows) {
    result[row.key] = row.value;
  }
  return result;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  if (existing[0]) {
    await db.update(settingsTable).set({ value, updatedAt: new Date() }).where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({ key, value });
  }
}
