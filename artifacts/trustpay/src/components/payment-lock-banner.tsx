import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { ChevronDown, ShieldAlert, X } from "lucide-react";
import { getAuthToken } from "@/lib/auth";
import React, { useEffect, useRef, useState } from "react";
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

export default function PaymentLockBanner() {
  const [location] = useLocation();
  const qc = useQueryClient();
  const { data: user } = useGetMe({ query: { queryKey: ["me"], retry: false } });
  const { data: myBuy } = useQuery<any>({
    queryKey: ["my-buy"],
    queryFn: () => api("/p2p/my-buy"),
    enabled: !!user,
    refetchInterval: 3000,
  });
  const [minimized, setMinimized] = useState(false);
  const prevOrderIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (myBuy?.status !== "locked" && myBuy?.status !== "pending_confirmation") setMinimized(false);
  }, [myBuy?.status]);

  // Play alarm sound when a new locked order arrives (same sound as seller order lock)
  useEffect(() => {
    if (myBuy?.status === "locked" && myBuy?.id !== prevOrderIdRef.current) {
      playAlarm();
    }
    if (myBuy?.id) prevOrderIdRef.current = myBuy.id;
  }, [myBuy?.id, myBuy?.status]);

  if (location === "/buy") return null;
  if (!myBuy || !["locked", "pending_confirmation"].includes(myBuy.status)) return null;

  return (
    <div className="fixed left-0 right-0 bottom-20 z-50 px-4 pointer-events-none">
      <div className="max-w-[430px] mx-auto pointer-events-auto">
        <Card className="rounded-[22px] border border-white/70 shadow-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-900 text-white overflow-hidden">
          <CardContent className="p-0">
            <div className="h-1 bg-gradient-to-r from-fuchsia-500 via-sky-500 to-emerald-400" />
            <div className="p-3 flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <ShieldAlert className="h-5 w-5 text-amber-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm truncate">
                    Payment {myBuy.status === "pending_confirmation" ? "submitted" : "locked"}
                  </div>
                  <button className="p-1 rounded-full hover:bg-white/10" onClick={() => setMinimized((v) => !v)}>
                    <ChevronDown className={`h-4 w-4 transition-transform ${minimized ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {!minimized && (
                  <div className="mt-1 text-xs text-white/75">
                    Amount ₹{myBuy.amount} · reward ₹{Number(myBuy.rewardAmount || 0).toFixed(2)}
                  </div>
                )}
              </div>
              {!minimized && (
                <Link href="/buy">
                  <Button size="sm" className="rounded-full bg-white text-slate-900 hover:bg-white/90">
                    Open
                  </Button>
                </Link>
              )}
              <button
                className="p-1 rounded-full hover:bg-white/10"
                onClick={() => {
                  qc.invalidateQueries({ queryKey: ["my-buy"] });
                  qc.invalidateQueries({ queryKey: ["me"] });
                }}
              >
                <X className="h-4 w-4 opacity-40" />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
