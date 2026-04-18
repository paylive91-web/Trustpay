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
  gatewayBaseUrl: "https://payment-gateway-hub--atulusf3.replit.app",
  gatewayMerchantId: "b6d1180da244e4cbbfc25364",
  gatewayApiKey: "pgk_13628d3fe162163a0c75a0b0ef2900b01cb9d942d3add932",
  gatewayApiSecret: "pgs_c978a9ffef20a4577b35128c5ab6891de231182ec442d090",
  gatewayWebhookSecret: "570848f110092e28a4778ef1a78d6b11e7e3520e85b168602d70be34caae95f3",
  gatewayAuthMethod: "hmac",
  gatewayCreatePaymentPath: "/payments",
  gatewayVerifyPaymentPath: "/payments/{id}/verify",
  gatewayRefundPath: "/refunds",
  gatewayStatusPath: "/payments/{id}/status",
  adminUsername: "admin",
  adminPasswordHash: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
};

export async function getSetting(key: string): Promise<string> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  if (rows[0]) return rows[0].value;
  return DEFAULT_SETTINGS[key] ?? "";
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await db.select().from(settingsTable).where(
    // @ts-ignore
    keys.length === 1
      ? eq(settingsTable.key, keys[0])
      : undefined
  );
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
