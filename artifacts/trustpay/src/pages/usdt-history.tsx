import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, Clock, Coins, Loader2, Plus, ShieldAlert, X } from "lucide-react";
import { API_BASE } from "@/lib/api-config";
import { getAuthToken } from "@/lib/auth";

type UsdtOrder = {
  id: number;
  usdtAmount: number;
  rate: number;
  bonusPercent: number;
  totalCredit: number;
  status: "pending" | "submitted" | "approved" | "rejected" | "expired" | "cancelled";
  txId: string | null;
  adminNote: string | null;
  createdAt: string;
  approvedAt: string | null;
};

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "submitted", label: "Review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function fmt(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function StatusBadge({ status }: { status: UsdtOrder["status"] }) {
  const map: Record<string, { bg: string; text: string; icon: any; label: string }> = {
    pending: { bg: "bg-slate-100", text: "text-slate-700", icon: Clock, label: "Pending" },
    submitted: { bg: "bg-amber-100", text: "text-amber-700", icon: Clock, label: "Under Review" },
    approved: { bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle2, label: "Approved" },
    rejected: { bg: "bg-rose-100", text: "text-rose-700", icon: ShieldAlert, label: "Rejected" },
    expired: { bg: "bg-slate-100", text: "text-slate-500", icon: X, label: "Expired" },
    cancelled: { bg: "bg-slate-100", text: "text-slate-500", icon: X, label: "Cancelled" },
  };
  const m = map[status] || map.pending;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${m.bg} ${m.text}`}>
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}

export default function UsdtHistory() {
  const { data: user, isLoading: userLoading } = useGetMe({ query: { queryKey: ["me"], retry: false } });
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!userLoading && !user) setLocation("/login");
  }, [user, userLoading, setLocation]);

  const { data: orders, isLoading } = useQuery<UsdtOrder[]>({
    queryKey: ["usdt-my-orders"],
    queryFn: async () => {
      const token = getAuthToken();
      const r = await fetch(`${API_BASE}/usdt/my-orders`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!r.ok) throw new Error("Failed to load history");
      return r.json();
    },
    refetchInterval: 10_000,
    enabled: !!user,
  });

  const filtered = (orders || []).filter((o) => filter === "all" ? true : o.status === filter);

  if (userLoading || isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg">
        <Link href="/usdt-deposit"><ArrowLeft className="cursor-pointer" /></Link>
        <div className="flex-1">
          <div className="font-bold text-lg leading-tight">USDT History</div>
          <div className="text-[11px] text-emerald-100">All your TRC-20 deposits</div>
        </div>
        <Link href="/usdt-deposit" className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors" title="New deposit">
          <Plus className="h-4 w-4" />
        </Link>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-all ${
                filter === f.key
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
              data-testid={`filter-${f.key}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
                <Coins className="h-7 w-7 text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No orders here yet</p>
              <p className="text-xs text-slate-500 mt-1">Start a USDT deposit to fund your account.</p>
              <Link href="/usdt-deposit" className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold">
                <Plus className="h-4 w-4" /> New Deposit
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((o) => {
              const isActive = o.status === "pending" || o.status === "submitted";
              const href = isActive ? `/usdt-payment/${o.id}` : `/usdt-payment/${o.id}`;
              return (
                <Link key={o.id} href={href} className="block">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-sm">
                            <Coins className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{o.usdtAmount} <span className="text-xs text-slate-500 font-normal">USDT</span></div>
                            <div className="text-[11px] text-slate-500">@ ₹{fmt(o.rate)} · #{o.id}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-emerald-600">₹{fmt(o.totalCredit)}</div>
                          <div className="mt-1"><StatusBadge status={o.status} /></div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{new Date(o.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                        {o.bonusPercent > 0 && <span className="text-emerald-600 font-semibold">+{o.bonusPercent}% bonus</span>}
                      </div>
                      {o.status === "rejected" && o.adminNote && (
                        <div className="mt-2 rounded-lg bg-rose-50 border border-rose-100 p-2 text-[11px] text-rose-700">
                          <span className="font-bold">Reason:</span> {o.adminNote}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
