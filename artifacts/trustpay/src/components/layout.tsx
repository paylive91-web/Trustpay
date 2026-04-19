import React, { useEffect } from "react";
import BottomNav from "./bottom-nav";
import { getAuthToken } from "@/lib/auth";

interface LayoutProps {
  children: React.ReactNode;
  showBottomNav?: boolean;
}

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

// Global heartbeat — fires every 30s on every authenticated screen so that
// `lastSeenAt` stays fresh and buyers can submit proof while the seller is on
// /sell, /orders, etc. Previously the ping lived only on home.tsx, which made
// sellers appear offline after ~2 minutes on the matching page.
function useHeartbeat() {
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    const ping = () =>
      fetch(`${API_BASE}/auth/heartbeat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    ping();
    const t = setInterval(ping, 30_000);
    return () => clearInterval(t);
  }, []);
}

export default function Layout({ children, showBottomNav = true }: LayoutProps) {
  useHeartbeat();
  return (
    <div className="min-h-[100dvh] w-full bg-muted/30 flex justify-center">
      <div className="w-full max-w-[430px] bg-background min-h-[100dvh] shadow-xl relative flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto pb-20">
          {children}
        </div>
        {showBottomNav && <BottomNav />}
      </div>
    </div>
  );
}
