import React, { useEffect } from "react";
import BottomNav from "./bottom-nav";
import PaymentLockBanner from "./payment-lock-banner";
import SellerAlertsPopup from "./seller-alerts-popup";
import BuyerSuccessPopup from "./buyer-success-popup";
import SellerOfflineDisputePopup from "./seller-offline-dispute-popup";
import { getAuthToken } from "@/lib/auth";
import { playLoudAlarm } from "@/lib/alarm";

interface LayoutProps {
  children: React.ReactNode;
  showBottomNav?: boolean;
}

import { API_BASE } from "@/lib/api-config";

// Listens for push messages from the service worker and plays alarm when app is open
function usePushSound() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_RECEIVED" && event.data?.isPaymentAlert) {
        playLoudAlarm();
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);
}

// Global heartbeat — fires every 30s on every authenticated screen so that
// `lastSeenAt` stays fresh and buyers can submit proof while the seller is on
// /sell, /orders, etc. Previously the ping lived only on home.tsx, which made
// sellers appear offline after ~2 minutes on the matching page.
function useHeartbeat() {
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    const ping = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/heartbeat`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (data?.matchingStopped) {
          window.dispatchEvent(new Event("matching-stopped"));
        }
      } catch {}
    };
    ping();
    const t = setInterval(ping, 30_000);
    return () => clearInterval(t);
  }, []);
}

export default function Layout({ children, showBottomNav = true }: LayoutProps) {
  useHeartbeat();
  usePushSound();
  return (
    <div className="min-h-[100dvh] w-full bg-muted/30 flex justify-center">
      <div className="w-full max-w-[430px] bg-background min-h-[100dvh] shadow-xl relative overflow-hidden">
        <div className={`min-h-[100dvh] overflow-y-auto ${showBottomNav ? "pb-28" : ""}`}>
          {children}
        </div>
        <SellerOfflineDisputePopup />
        <PaymentLockBanner />
        <SellerAlertsPopup />
        <BuyerSuccessPopup />
        {showBottomNav && <BottomNav />}
      </div>
    </div>
  );
}
