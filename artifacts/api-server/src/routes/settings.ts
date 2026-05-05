import { Router } from "express";
import { getAllSettings } from "../lib/settings.js";
import { googleClientId } from "../lib/google.js";
import { normalizeAppUrl, normalizeAppUrlList } from "../lib/normalizeAppUrl.js";

const router = Router();

router.get("/app", async (req, res) => {
  const s = await getAllSettings();
  // Defensive: never let proxies/CDNs cache settings — admins need
  // their changes to reflect on every client immediately.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  let multipleUpiIds = [];
  try { multipleUpiIds = JSON.parse(s.multipleUpiIds || "[]"); } catch {}
  let announcements = [];
  try { announcements = JSON.parse(s.announcements || "[]"); } catch {}
  let broadcastNotification = null;
  try { broadcastNotification = JSON.parse(s.broadcastNotification || "null"); } catch {}
  let agentTiers: Array<{ minActiveDeposits: number; reward: number; label: string }> = [];
  try {
    const raw = JSON.parse(s.agentTiers || "[]");
    if (Array.isArray(raw)) {
      agentTiers = raw
        .map((t: any) => ({
          minActiveDeposits: Number(t?.minActiveDeposits),
          reward: Number(t?.reward),
          label: String(t?.label || ""),
        }))
        .filter((t) => Number.isFinite(t.minActiveDeposits) && Number.isFinite(t.reward));
    }
  } catch {}
  res.json({
    upiId: s.upiId || "trustpay@upi",
    upiName: s.upiName || "TrustPay",
    multipleUpiIds,
    popupMessage: s.popupMessage || "",
    popupImageUrl: normalizeAppUrl(s.popupImageUrl || ""),
    announcements,
    telegramLink: s.telegramLink || "",
    // Dispute support URL — separate setting so a dedicated dispute team
    // can be reached. If admin hasn't configured it, fall back to the
    // generic telegramLink so the Contact Support button never points
    // nowhere.
    telegramSupportUrl: s.telegramSupportUrl || s.telegramLink || "",
    bannerImages: normalizeAppUrlList(JSON.parse(s.bannerImages || "[]")),
    appName: s.appName || "TrustPay",
    appLogoUrl: normalizeAppUrl(s.appLogoUrl || ""),
    popupSoundUrl: normalizeAppUrl(s.popupSoundUrl || ""),
    buyRules: s.buyRules || "",
    sellRules: s.sellRules || "",
    buyRulesImageUrl: normalizeAppUrl(s.buyRulesImageUrl || ""),
    sellRulesImageUrl: normalizeAppUrl(s.sellRulesImageUrl || ""),
    inviteShareImageUrl: normalizeAppUrl(s.inviteShareImageUrl || ""),
    // APK URL precedence: env var (so a CI deploy can override without DB
    // edits) > admin-configured value > empty string. Admin UI still wins
    // when env is unset.
    apkDownloadUrl: process.env.APK_DOWNLOAD_URL || s.apkDownloadUrl || "",
    apkVersion: s.apkVersion || "1.0.0",
    forceAppDownload: (s.forceAppDownload ?? "false") === "true",
    // Google OAuth Web Client ID — used by the frontend to render the
    // "Verify with Google" button via Google Identity Services. Empty
    // string means Google verification is disabled for the deployment;
    // the UI will hide the button accordingly.
    googleClientId: googleClientId(),
    broadcastNotification,
    agentTiers,
    // Reward percentages — needed by Sell page to show "earn X% bonus" hints
    // and by Buy page to preview rewards. Tiers are buyer-side only and
    // already returned per-amount on order endpoints, so we expose only
    // the simple percentage scalars here.
    sellRewardPercent: parseFloat(s.sellRewardPercent || "0"),
    buyRewardPercent: parseFloat(s.buyRewardPercent || "0"),
    // Home page reward-highlight card. Frontend uses these to render
    // the UPI half of the card; the USDT half reads usdt rate/bonus
    // (also exposed below) and auto-computes the example.
    homeRewardCardEnabled: (s.homeRewardCardEnabled ?? "true") === "true",
    homeRewardUpiTitle: s.homeRewardUpiTitle || "UPI REWARD UP TO 6%",
    homeRewardUpiExampleAmount: parseFloat(s.homeRewardUpiExampleAmount || "10000"),
    homeRewardUpiExampleBonus: parseFloat(s.homeRewardUpiExampleBonus || "300"),
    homeRewardUsdtTitle: s.homeRewardUsdtTitle || "USDT REWARD",
    // USDT pricing — surfaced here so the home reward card doesn't need
    // a separate fetch. /usdt/public-config still exists for the deposit
    // page (it carries enabled flag, address count, notes etc).
    usdtEnabled: (s.usdtEnabled ?? "false") === "true",
    usdtRatePerUnit: parseFloat(s.usdtRatePerUnit || "0"),
    usdtBonusPercent: parseFloat(s.usdtBonusPercent || "0"),
  });
});

export default router;
