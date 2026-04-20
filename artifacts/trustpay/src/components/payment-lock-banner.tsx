import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ChevronUp, Clock, X } from "lucide-react";
import { getAuthToken } from "@/lib/auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

async function api(path: string) {
  const token = getAuthToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

function fmtCountdown(ms: number) {
  if (ms <= 0) return "00:00";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Persistent payment-lock banner.
 *
 * Polls `/p2p/my-buy` on every authenticated screen and, while a buy lock is
 * active (status `locked` — buyer hasn't submitted proof yet), shows a sticky
 * banner at the top of the viewport. The banner survives page navigation so
 * the buyer can never "lose" their lock by browsing away from /buy.
 *
 * The banner is minimizable via the chevron — minimized state collapses to a
 * floating dot in the corner. The "X" is intentionally NOT a cancel —
 * cancelling a lock is irreversible and must happen on /buy. The X only
 * minimizes the banner.
 */
export default function PaymentLockBanner() {
  const [location] = useLocation();
  const [minimized, setMinimized] = useState(false);
  const [now, setNow] = useState(Date.now());

  const { data: myBuy } = useQuery<any>({
    queryKey: ["my-buy"],
    queryFn: () => api("/p2p/my-buy"),
    enabled: !!getAuthToken(),
    refetchInterval: 4000,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!myBuy || myBuy.status !== "locked") return null;
  // Hide on /buy where the dedicated ActiveBuyCard already shows the lock.
  if (location.startsWith("/buy")) return null;

  const deadline = new Date(myBuy.confirmDeadline).getTime();
  const remaining = deadline - now;
  const expired = remaining <= 0;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-24 right-3 z-50 flex items-center gap-2 rounded-full bg-amber-500 text-white px-4 py-2.5 shadow-2xl ring-2 ring-amber-300 animate-pulse"
        aria-label="Show payment lock"
      >
        <Clock className="h-4 w-4" />
        <span className="text-xs font-bold">₹{myBuy.amount} • {fmtCountdown(remaining)}</span>
      </button>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div className="w-full max-w-[430px] pointer-events-auto">
        <div className={`m-2 rounded-2xl shadow-2xl border ${expired ? "bg-red-600 text-white" : "bg-gradient-to-r from-amber-500 to-orange-500 text-white"} px-3 py-2.5 flex items-center gap-3`}>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wide opacity-90 font-semibold">
              Payment Pending
            </div>
            <div className="flex items-center gap-2 text-sm font-bold leading-tight truncate">
              <span>₹{myBuy.amount}</span>
              <span className="opacity-70">→</span>
              <span className="font-mono text-xs truncate">{myBuy.upiId}</span>
            </div>
          </div>
          <div className={`flex items-center gap-1 text-sm font-mono font-bold rounded-full px-2.5 py-1 ${expired ? "bg-white/20" : "bg-black/20"}`}>
            <Clock className="h-3.5 w-3.5" />
            {fmtCountdown(remaining)}
          </div>
          <Link href="/buy">
            <button className="rounded-full bg-white text-amber-700 text-xs font-bold px-3 py-1.5 shadow hover:bg-amber-50">
              Pay Now
            </button>
          </Link>
          <button
            onClick={() => setMinimized(true)}
            aria-label="Minimize"
            className="text-white/90 hover:text-white p-1"
          >
            <ChevronUp className="h-4 w-4 rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}
