import { Router } from "express";
import { getAllSettings } from "../lib/settings.js";

const router = Router();

router.get("/app", async (req, res) => {
  const s = await getAllSettings();
  res.json({
    upiId: s.upiId || "trustpay@upi",
    upiName: s.upiName || "TrustPay",
    popupMessage: s.popupMessage || "",
    popupImageUrl: s.popupImageUrl || "",
    telegramLink: s.telegramLink || "",
    bannerImages: JSON.parse(s.bannerImages || "[]"),
    appName: s.appName || "TrustPay",
  });
});

export default router;
