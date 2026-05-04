import { Router } from "express";
import { getAllSettings } from "../lib/settings.js";

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
    popupImageUrl: s.popupImageUrl || "",
    announcements,
    telegramLink: s.telegramLink || "",
    // Dispute support URL — separate setting so a dedicated dispute team
    // can be reached. If admin hasn't configured it, fall back to the
    // generic telegramLink so the Contact Support button never points
    // nowhere.
    telegramSupportUrl: s.telegramSupportUrl || s.telegramLink || "",
    bannerImages: JSON.parse(s.bannerImages || "[]"),
    appName: s.appName || "TrustPay",
    appLogoUrl: s.appLogoUrl || "",
    popupSoundUrl: s.popupSoundUrl || "",
    buyRules: s.buyRules || "",
    sellRules: s.sellRules || "",
    buyRulesImageUrl: s.buyRulesImageUrl || "",
    sellRulesImageUrl: s.sellRulesImageUrl || "",
    inviteShareImageUrl: s.inviteShareImageUrl || "",
    // APK URL precedence: env var (so a CI deploy can override without DB
    // edits) > admin-configured value > empty string. Admin UI still wins
    // when env is unset.
    apkDownloadUrl: process.env.APK_DOWNLOAD_URL || s.apkDownloadUrl || "",
    apkVersion: s.apkVersion || "1.0.0",
    forceAppDownload: (s.forceAppDownload ?? "false") === "true",
    broadcastNotification,
    agentTiers,
    // Reward percentages — needed by Sell page to show "earn X% bonus" hints
    // and by Buy page to preview rewards. Tiers are buyer-side only and
    // already returned per-amount on order endpoints, so we expose only
    // the simple percentage scalars here.
    sellRewardPercent: parseFloat(s.sellRewardPercent || "0"),
    buyRewardPercent: parseFloat(s.buyRewardPercent || "0"),
  });
});

export default router;
