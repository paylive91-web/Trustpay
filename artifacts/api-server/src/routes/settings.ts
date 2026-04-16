import { Router } from "express";
import { getAllSettings } from "../lib/settings.js";

const router = Router();

router.get("/app", async (req, res) => {
  const s = await getAllSettings();
  let multipleUpiIds = [];
  try { multipleUpiIds = JSON.parse(s.multipleUpiIds || "[]"); } catch {}
  res.json({
    upiId: s.upiId || "trustpay@upi",
    upiName: s.upiName || "TrustPay",
    multipleUpiIds,
    popupMessage: s.popupMessage || "",
    popupImageUrl: s.popupImageUrl || "",
    telegramLink: s.telegramLink || "",
    bannerImages: JSON.parse(s.bannerImages || "[]"),
    appName: s.appName || "TrustPay",
    buyRules: s.buyRules || "",
    sellRules: s.sellRules || "",
  });
});

export default router;
