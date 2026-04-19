import { Router } from "express";
import { getAllSettings } from "../lib/settings.js";

const router = Router();

router.get("/app", async (req, res) => {
  const s = await getAllSettings();
  let multipleUpiIds = [];
  try { multipleUpiIds = JSON.parse(s.multipleUpiIds || "[]"); } catch {}
  let announcements = [];
  try { announcements = JSON.parse(s.announcements || "[]"); } catch {}
  let broadcastNotification = null;
  try { broadcastNotification = JSON.parse(s.broadcastNotification || "null"); } catch {}
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
    buyRules: s.buyRules || "",
    sellRules: s.sellRules || "",
    apkDownloadUrl: s.apkDownloadUrl || "",
    apkVersion: s.apkVersion || "1.0.0",
    forceAppDownload: (s.forceAppDownload ?? "false") === "true",
    broadcastNotification,
  });
});

export default router;
