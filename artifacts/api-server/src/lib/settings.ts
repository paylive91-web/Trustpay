import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const DEFAULT_SETTINGS: Record<string, string> = {
  upiId: "trustpay@upi",
  upiName: "TrustPay",
  popupMessage: "Welcome to TrustPay! Start earning rewards today.",
  popupImageUrl: "",
  appLogoUrl: "",
  popupSoundUrl: "",
  telegramLink: "https://t.me/trustpay",
  // Dispute-specific support handle. Falls back to telegramLink if blank.
  // Used by the Contact Support button on dispute cards (orders.tsx) so a
  // dedicated dispute team can be reached without changing the global
  // telegramLink shown elsewhere (footer, profile, etc).
  telegramSupportUrl: "",
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
  // Admin-configurable reward percentages
  // buyRewardTiers: JSON array of {min, max, reward} bands. Empty string = "not yet configured"
  // (legacy mode) — settle.ts will fall back to buyRewardPercent. Once the admin saves tiers
  // (even as []), the value is stored as JSON and the flat buyRewardPercent is no longer used.
  buyRewardTiers: "",       // empty string = not configured; fall back to buyRewardPercent
  buyRewardPercent: "5",   // legacy flat %; only active when buyRewardTiers is not yet set in DB
  sellRewardPercent: "0",  // seller reward % on each trade (default 0%, can enable anytime)
  smsAutoDeleteEnabled: "false",

  // -------------------------------------------------------------------------
  // Device-based registration limit
  // -------------------------------------------------------------------------
  // How many distinct user accounts can ever be registered from the same
  // device fingerprint. Counted across users (not events) — once a user is
  // registered from a device the count goes up by 1 for that device. The
  // /register handler rejects new sign-ups when this cap is reached so a
  // single phone can't be used to farm referral bonuses indefinitely.
  // Admin-configurable; default 3 strikes a balance between family-sharing
  // and abuse.
  maxRegistrationsPerDevice: "3",

  // -------------------------------------------------------------------------
  // USDT (TRC-20) buy flow
  // -------------------------------------------------------------------------
  // Master switch + pricing for the USDT → INR deposit tab in the buy page.
  //  - usdtEnabled: "true"|"false". When false the USDT tab is hidden in the
  //    user app and the API rejects /usdt/start.
  //  - usdtRatePerUnit: how many INR a single USDT is worth (admin-set).
  //  - usdtBonusPercent: flat % bonus credited on top of (usdt * rate) when
  //    the admin approves the order. 0 disables the bonus line.
  //  - usdtMinAmount / usdtMaxAmount: min/max USDT (in whole units) that a
  //    user can submit in a single order.
  //  - usdtAddresses: JSON array of TRC-20 addresses (with optional label +
  //    qrImageUrl). The /usdt/start endpoint round-robins across these.
  //  - usdtPaymentWindowMinutes: how long the user has to pay + submit TxID
  //    before the order auto-expires. Default 15 (mirrors UPI buyLockMinutes).
  //  - usdtNotes: optional admin-controlled instructions shown on the
  //    payment screen (network warnings etc).
  usdtEnabled: "false",
  usdtRatePerUnit: "85",
  usdtBonusPercent: "0",
  usdtMinAmount: "10",
  usdtMaxAmount: "10000",
  usdtAddresses: JSON.stringify([]),
  usdtPaymentWindowMinutes: "15",
  usdtNotes: "Only TRC-20 (Tron network) deposits are accepted. Sending on any other network will result in permanent loss of funds.",

  // -------------------------------------------------------------------------
  // Home page Rewards highlight card
  // -------------------------------------------------------------------------
  // Two-pane card on the home screen showing the UPI buy bonus + USDT
  // deposit bonus side-by-side so users discover the rewards without
  // opening the BUY page. Admin can fully change the headline + example
  // numbers, or hide the card entirely with the enabled toggle.
  //  - homeRewardCardEnabled: master switch.
  //  - homeRewardUpiTitle: short headline e.g. "UPI REWARD UP TO 6%".
  //  - homeRewardUpiExampleAmount / Bonus: ₹ amounts shown in the
  //    "Pay X → Get Y bonus" example line on the UPI side.
  //  - The USDT side auto-derives from usdtRatePerUnit + usdtBonusPercent
  //    so admins don't have to keep two places in sync. Only the title
  //    string is admin-editable for the USDT half.
  homeRewardCardEnabled: "true",
  homeRewardUpiTitle: "UPI REWARD UP TO 6%",
  homeRewardUpiExampleAmount: "10000",
  homeRewardUpiExampleBonus: "300",
  homeRewardUsdtTitle: "USDT REWARD",

  // -------------------------------------------------------------------------
  // New User Signup Bonus
  // -------------------------------------------------------------------------
  // Amount credited to new user's wallet on first registration.
  // Set to "0" to disable. Admin-configurable via admin panel.
  signupBonus: "51",

  // -------------------------------------------------------------------------
  // Daily Task Reward
  // -------------------------------------------------------------------------
  // Master switch + tiers for the daily buy reward card on the home screen.
  // dailyRewardTiers: JSON array of {minBuy, reward} — user claims the
  // highest tier where their total confirmed buy amount today >= minBuy.
  dailyRewardEnabled: "true",
  dailyRewardTiers: JSON.stringify([
    { minBuy: 2000, reward: 20 },
    { minBuy: 5000, reward: 50 },
    { minBuy: 10000, reward: 100 },
    { minBuy: 20000, reward: 200 },
    { minBuy: 50000, reward: 300 },
  ]),
};

export async function getSetting(key: string): Promise<string> {
  try {
    const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
    if (rows[0]) return rows[0].value;
  } catch {}
  return DEFAULT_SETTINGS[key] ?? "";
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  try {
    const allRows = await db.select().from(settingsTable);
    for (const key of keys) {
      const row = allRows.find((r) => r.key === key);
      result[key] = row ? row.value : (DEFAULT_SETTINGS[key] ?? "");
    }
    return result;
  } catch {
    for (const key of keys) {
      result[key] = DEFAULT_SETTINGS[key] ?? "";
    }
    return result;
  }
}

// Short in-memory cache of the full settings table. The /admin/settings,
// /settings/app, and many internal helpers all call getAllSettings() — on
// busy admin pages this was firing 4-5 Supabase round-trips per second.
// A 5s TTL is short enough that admins never see stale data after Save
// (setSettings/setSetting bust the cache), but long enough to coalesce
// the burst of reads triggered by a single page load.
let _settingsCache: { at: number; data: Record<string, string> } | null = null;
const SETTINGS_TTL_MS = 5_000;
let _inflight: Promise<Record<string, string>> | null = null;

function invalidateSettingsCache() {
  _settingsCache = null;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  if (_settingsCache && Date.now() - _settingsCache.at < SETTINGS_TTL_MS) {
    return _settingsCache.data;
  }
  // Coalesce concurrent callers into a single DB round-trip.
  if (_inflight) return _inflight;
  _inflight = (async () => {
    const result: Record<string, string> = { ...DEFAULT_SETTINGS };
    try {
      const allRows = await db.select().from(settingsTable);
      for (const row of allRows) {
        result[row.key] = row.value;
      }
    } catch {}
    _settingsCache = { at: Date.now(), data: result };
    return result;
  })();
  try {
    return await _inflight;
  } finally {
    _inflight = null;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await db.insert(settingsTable)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { value, updatedAt: sql`now()` },
      });
    invalidateSettingsCache();
  } catch {
    return;
  }
}

export async function setSettings(entries: Record<string, string>): Promise<void> {
  const pairs = Object.entries(entries).filter(([, v]) => v != null);
  if (pairs.length === 0) return;
  try {
    await db.insert(settingsTable)
      .values(pairs.map(([key, value]) => ({ key, value })))
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: {
          value: sql`excluded.value`,
          updatedAt: sql`now()`,
        },
      });
    invalidateSettingsCache();
  } catch (err) {
    console.error("[setSettings] failed to save settings:", err);
    return;
  }
}
