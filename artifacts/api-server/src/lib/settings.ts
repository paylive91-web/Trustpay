import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEFAULT_SETTINGS: Record<string, string> = {
  upiId: "trustpay@upi",
  upiName: "TrustPay",
  popupMessage: "Welcome to TrustPay! Start earning rewards today.",
  popupImageUrl: "",
  appLogoUrl: "",
  popupSoundUrl: "",
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
  chunkSweetMin: "100",
  chunkSweetMax: "2000",
  chunkSweetBias: "0.85",
  chunkSmallMin: "100",
  chunkSmallMax: "1000",
  chunkMediumMin: "1000",
  chunkMediumMax: "5000",
  chunkLargeMin: "5000",
  chunkLargeMax: "30000",
  chunkSmallLabel: "Small",
  chunkMediumLabel: "Medium",
  chunkLargeLabel: "Large",
  adminChunkMin: "5000",
  adminChunkMax: "50000",
  platformCommissionPerChunk: "1",
  platformCommissionTotal: "0",
  feeTiers: JSON.stringify([
    { min: 100, max: 500, fee: 1 },
    { min: 501, max: 1000, fee: 2 },
    { min: 1001, max: 2000, fee: 4 },
    { min: 2001, max: 5000, fee: 8 },
    { min: 5001, max: 50000, fee: 15 },
  ]),
  // Agent reward tiers. "minActiveDeposits" = distinct invitees of this
  // agent who confirmed at least one deposit today. Reward in ₹ is credited
  // to the agent's wallet (and they're flagged Verified Agent forever) the
  // first time the threshold is reached on a given day.
  agentTiers: JSON.stringify([
    { minActiveDeposits: 20, reward: 50, label: "Bronze Agent" },
    { minActiveDeposits: 50, reward: 200, label: "Silver Agent" },
    { minActiveDeposits: 100, reward: 600, label: "Gold Agent" },
    { minActiveDeposits: 150, reward: 1200, label: "Platinum Agent" },
  ]),
  inviteShareImageUrl: "",
  apkDownloadUrl: "",
  apkVersion: "1.0.0",
  forceAppDownload: "false",
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
