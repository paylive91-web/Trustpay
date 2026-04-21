import { Router } from "express";
import { getAllSettings } from "../lib/settings.js";
import { googleClientId } from "../lib/google.js";

const router = Router();

router.get("/app", async (req, res) => {
  const s = await getAllSettings();
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
    bannerImages: JSON.parse(s.bannerImages || "[]"),
    appName: s.appName || "TrustPay",
    appLogoUrl: s.appLogoUrl || "",
    popupSoundUrl: s.popupSoundUrl || "",
    buyRules: s.buyRules || "",
    sellRules: s.sellRules || "",
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
  });
});

export default router;
