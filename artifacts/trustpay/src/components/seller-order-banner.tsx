import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { BellRing, ChevronDown, XCircle } from "lucide-react";
import { getAuthToken } from "@/lib/auth";
import { playAlarm } from "@/lib/alarm";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

async function api(path: string) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function SellerOrderBanner() {
  const [location] = useLocation();
  const { data: user } = useGetMe({ query: { queryKey: ["me"], retry: false } });
  const { data: alerts = [] } = useQuery<any[]>({
    queryKey: ["seller-alerts"],
    queryFn: () => api("/p2p/my-seller-alerts"),
    refetchInterval: 2000,
    enabled: !!user,
  });

  const [minimized, setMinimized] = useState(false);
  const [cancelledOrder, setCancelledOrder] = useState<{ amount: number; buyer?: string } | null>(null);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevLockedRef = useRef<{ id: number; amount: number; buyer?: string } | null>(null);

  const lockedOrder = alerts.find((a) => a.status === "locked") || null;

  useEffect(() => {
    if (lockedOrder) {
      if (!prevLockedRef.current || prevLockedRef.current.id !== lockedOrder.id) {
        playAlarm();
      }
      prevLockedRef.current = {
        id: lockedOrder.id,
        amount: lockedOrder.amount,
        buyer: lockedOrder.buyer?.username || `#${lockedOrder.buyer?.id || "?"}`,
      };
      setCancelledOrder(null);
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    } else {
      if (prevLockedRef.current) {
        setCancelledOrder({
          amount: prevLockedRef.current.amount,
          buyer: prevLockedRef.current.buyer,
        });
        prevLockedRef.current = null;
        if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
        cancelTimerRef.current = setTimeout(() => setCancelledOrder(null), 8000);
      }
    }
  }, [lockedOrder?.id, lockedOrder?.status]);

  useEffect(() => () => { if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current); }, []);

  if (location === "/sell") return null;

  if (!lockedOrder && !cancelledOrder) return null;

  if (cancelledOrder) {
    return (
      <div className="fixed left-0 right-0 bottom-20 z-50 px-4 pointer-events-none">
        <div className="max-w-[430px] mx-auto pointer-events-auto">
          <Card className="rounded-[22px] border border-red-400/40 shadow-2xl bg-gradient-to-r from-red-950 via-red-900 to-rose-900 text-white overflow-hidden">
            <CardContent className="p-0">
              <div className="h-1 bg-gradient-to-r from-red-500 via-rose-400 to-orange-400" />
              <div className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                  <XCircle className="h-5 w-5 text-red-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-red-100">Order Cancel Ho Gaya</div>
                  <div className="mt-0.5 text-xs text-white/70">
                    ₹{Number(cancelledOrder.amount).toFixed(2)} · Buyer {cancelledOrder.buyer}
                  </div>
                </div>
                <button
                  className="p-1 rounded-full hover:bg-white/10 shrink-0"
                  onClick={() => setCancelledOrder(null)}
                >
                  <XCircle className="h-4 w-4 text-white/60" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed left-0 right-0 bottom-20 z-50 px-4 pointer-events-none">
      <div className="max-w-[430px] mx-auto pointer-events-auto">
        <Card className="rounded-[22px] border border-white/70 shadow-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-900 text-white overflow-hidden">
          <CardContent className="p-0">
            <div className="h-1 bg-gradient-to-r from-fuchsia-500 via-sky-500 to-emerald-400" />
            <div className="p-3 flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <BellRing className="h-5 w-5 text-amber-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm truncate">Order Locked</div>
                  <button className="p-1 rounded-full hover:bg-white/10" onClick={() => setMinimized((v) => !v)}>
                    <ChevronDown className={`h-4 w-4 transition-transform ${minimized ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {!minimized && (
                  <div className="mt-1 text-xs text-white/75">
                    Amount ₹{Number(lockedOrder!.amount || 0).toFixed(2)} · Buyer {lockedOrder!.buyer?.username || `#${lockedOrder!.buyer?.id || "?"}`}
                  </div>
                )}
              </div>
              {!minimized && (
                <Link href="/sell">
                  <Button size="sm" className="rounded-full bg-white text-slate-900 hover:bg-white/90">
                    Open
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
