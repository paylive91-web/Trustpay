import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { BellRing, ChevronDown } from "lucide-react";
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
  const current = alerts[0];

  useEffect(() => {
    if (current?.status === "locked") playAlarm();
  }, [current?.id, current?.status]);

  useEffect(() => {
    if (current?.status !== "locked") setMinimized(false);
  }, [current?.status]);

  if (!current || current.status !== "locked") return null;
  if (location === "/sell") return null;

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
                  <div className="font-semibold text-sm truncate">Order locked</div>
                  <button className="p-1 rounded-full hover:bg-white/10" onClick={() => setMinimized((v) => !v)}>
                    <ChevronDown className={`h-4 w-4 transition-transform ${minimized ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {!minimized && (
                  <div className="mt-1 text-xs text-white/75">
                    Amount ₹{Number(current.amount || 0).toFixed(2)} · Buyer {current.buyer?.username || `#${current.buyer?.id || "?"}`}
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