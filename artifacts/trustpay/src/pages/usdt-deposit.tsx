import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Coins, Hourglass, History as HistoryIcon, IndianRupee, Loader2, ShieldAlert, Sparkles, X } from "lucide-react";
import { API_BASE } from "@/lib/api-config";
import { getAuthToken } from "@/lib/auth";

type UsdtConfig = {
  enabled: boolean;
  rate: number;
  bonusPercent: number;
  minAmount: number;
  maxAmount: number;
  windowMinutes: number;
  addressCount: number;
  notes: string;
};

type RecentOrder = {
  id: number;
  usdtAmount: number;
  totalCredit: number;
  status: "pending" | "submitted" | "processing" | "approved" | "rejected" | "expired" | "cancelled";
  createdAt: string;
};

const STATUS_META: Record<RecentOrder["status"], { label: string; cls: string; icon: any }> = {
  pending:    { label: "Pending",    cls: "bg-slate-100 text-slate-700",     icon: Clock },
  submitted:  { label: "Review",     cls: "bg-amber-100 text-amber-800",     icon: Clock },
  processing: { label: "Processing", cls: "bg-yellow-100 text-yellow-800",   icon: Hourglass },
  approved:   { label: "Approved",   cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  rejected:   { label: "Rejected",   cls: "bg-rose-100 text-rose-700",       icon: ShieldAlert },
  expired:    { label: "Expired",    cls: "bg-slate-100 text-slate-500",     icon: X },
  cancelled:  { label: "Cancelled",  cls: "bg-slate-100 text-slate-500",     icon: X },
};

async function api(path: string, opts: RequestInit = {}) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export default function UsdtDeposit() {
  const { data: user, isLoading: userLoading } = useGetMe({ query: { queryKey: ["me"], retry: false } });
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!userLoading && !user) setLocation("/login");
  }, [user, userLoading, setLocation]);

  const { data: config, isLoading: configLoading } = useQuery<UsdtConfig>({
    queryKey: ["usdt-public-config"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/usdt/public-config`);
      if (!r.ok) throw new Error("Failed to load config");
      return r.json();
    },
    staleTime: 30_000,
  });

  // Recent orders (top 3) shown on the deposit page so the user can
  // jump back to an in-flight order or re-open a finished one without
  // hopping to the history tab first.
  const { data: recentOrders } = useQuery<RecentOrder[]>({
    queryKey: ["usdt-recent-orders"],
    queryFn: async () => {
      const token = getAuthToken();
      const r = await fetch(`${API_BASE}/usdt/my-orders?limit=3`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 15_000,
    enabled: !!user,
  });
  const recents = (recentOrders || []).slice(0, 3);

  const startMut = useMutation<any, Error, number>({
    mutationFn: async (usdtAmount: number) => api(`/usdt/start`, { method: "POST", body: JSON.stringify({ usdtAmount }) }),
    onSuccess: (order: any) => {
      setLocation(`/usdt-payment/${order.id}`);
    },
    onError: (err: any) => {
      const e = err?.message || "Failed to start order";
      // Server returns 409 + { orderId } when an existing pending order is
      // still alive. Bounce the user straight to that order's payment screen
      // so they don't get stuck with no obvious next step.
      try {
        const parsed = JSON.parse(e);
        if (parsed?.orderId) { setLocation(`/usdt-payment/${parsed.orderId}`); return; }
      } catch {}
      toast({ title: "Cannot start order", description: e, variant: "destructive" });
    },
  });

  const numericAmount = parseFloat(amount) || 0;
  const calc = useMemo(() => {
    if (!config) return { inr: 0, bonus: 0, total: 0 };
    const inr = numericAmount * config.rate;
    const bonus = (inr * config.bonusPercent) / 100;
    return { inr, bonus, total: inr + bonus };
  }, [numericAmount, config]);

  const validation = useMemo(() => {
    if (!config) return null;
    if (!numericAmount) return null;
    if (numericAmount < config.minAmount) return `Minimum ${config.minAmount} USDT`;
    if (config.maxAmount && numericAmount > config.maxAmount) return `Maximum ${config.maxAmount} USDT`;
    return null;
  }, [numericAmount, config]);

  if (userLoading || configLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  if (!config?.enabled || config.addressCount === 0 || config.rate <= 0) {
    return (
      <Layout>
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <Link href="/buy"><ArrowLeft className="cursor-pointer" /></Link>
          <span className="font-bold text-lg flex-1">USDT Deposit</span>
        </div>
        <div className="p-6">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-5 text-sm text-amber-800 leading-relaxed">
              USDT deposits are temporarily unavailable. Please check back shortly or contact support if you need help.
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
        <Link href="/buy"><ArrowLeft className="cursor-pointer" /></Link>
        <div className="flex-1">
          <div className="font-bold text-lg leading-tight">Buy with USDT</div>
          <div className="text-[11px] text-slate-300">TRC-20 Network · Instant credit on approval</div>
        </div>
        <Link
          href="/usdt-history"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-[12px] font-bold border border-white/20 transition-colors"
          data-testid="link-usdt-history"
        >
          <HistoryIcon className="h-3.5 w-3.5" /> USDT History
        </Link>
      </div>

      <div className="p-4 space-y-4">
        {/* Hero rate card — slate + gold */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-xl ring-1 ring-amber-400/20">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-yellow-300/10 blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-amber-300/80">Live Rate</div>
              <div className="mt-1 text-4xl font-black tracking-tight bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">
                ₹{fmt(config.rate)}<span className="text-lg font-bold text-amber-200/80"> / USDT</span>
              </div>
              {config.bonusPercent > 0 && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black text-slate-900 ring-1 ring-amber-200/60 shadow-md animate-gold-shimmer animate-gold-pulse">
                  <Sparkles className="h-3.5 w-3.5" /> FREE +{config.bonusPercent}% BONUS
                </div>
              )}
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 p-3 ring-1 ring-amber-200/60 shadow-lg">
              <Coins className="h-7 w-7 text-slate-900" />
            </div>
          </div>
        </div>

        {/* Amount input + calculator */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 space-y-5">
            <div className="space-y-2">
              <Label className="text-[12px] font-bold uppercase tracking-[0.14em] text-slate-600">USDT Amount</Label>
              <div className="relative">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  placeholder=""
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-16 text-3xl font-black tracking-tight pr-20 rounded-2xl bg-slate-50 border-slate-200 focus-visible:ring-amber-300 focus-visible:border-amber-400"
                  data-testid="input-usdt-amount"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-600">USDT</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Min: <span className="font-semibold text-slate-700">{config.minAmount} USDT</span></span>
                {config.maxAmount > 0 && <span>Max: <span className="font-semibold text-slate-700">{config.maxAmount} USDT</span></span>}
              </div>
              {validation && <p className="text-[12px] font-semibold text-rose-600">{validation}</p>}
            </div>

            {/* Live calculator */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Base value</span>
                <span className="font-bold text-slate-800 tabular-nums">₹{fmt(calc.inr)}</span>
              </div>
              {config.bonusPercent > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-amber-700 font-semibold">
                    <Sparkles className="h-3.5 w-3.5" /> Bonus ({config.bonusPercent}%)
                  </span>
                  <span className="font-black text-amber-700 tabular-nums">+ ₹{fmt(calc.bonus)}</span>
                </div>
              )}
              <div className="border-t border-dashed border-slate-300 pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">You'll receive</span>
                <span className="text-2xl font-black tabular-nums flex items-center gap-1 bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">
                  <IndianRupee className="h-5 w-5 text-amber-600" />{fmt(calc.total)}
                </span>
              </div>
            </div>

            <Button
              type="button"
              disabled={!numericAmount || !!validation || startMut.isPending}
              onClick={() => startMut.mutate(numericAmount)}
              className="w-full h-14 rounded-2xl text-[16px] font-black bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:from-amber-500 hover:to-yellow-600 text-slate-900 shadow-lg shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-continue-usdt"
            >
              {startMut.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Starting…</>
              ) : (
                <>Continue to Payment <ArrowRight className="h-4 w-4 ml-2" /></>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Recent orders — quick jump back into in-flight or finished deposits */}
        {recents.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[12px] font-black uppercase tracking-[0.14em] text-slate-600">Recent Orders</h3>
              <Link href="/usdt-history" className="text-[11px] font-bold text-amber-600 hover:text-amber-700" data-testid="link-view-all-orders">
                View all →
              </Link>
            </div>
            <div className="space-y-2">
              {recents.map((o) => {
                const meta = STATUS_META[o.status] || STATUS_META.pending;
                const Icon = meta.icon;
                return (
                  <Link key={o.id} href={`/usdt-payment/${o.id}`} className="block" data-testid={`recent-order-${o.id}`}>
                    <Card className="hover:shadow-md transition-shadow border-slate-200">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-amber-400 shrink-0 shadow-sm">
                          <Coins className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{o.usdtAmount} <span className="text-[10px] text-slate-500 font-normal">USDT</span></span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>
                              <Icon className="h-2.5 w-2.5" />{meta.label}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(o.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">Credit</div>
                          <div className="text-sm font-black text-slate-900">₹{fmt(o.totalCredit)}</div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {config.notes && (
          <Card className="border-slate-200 bg-slate-50">
            <CardContent className="p-4 text-[12px] text-slate-700 whitespace-pre-wrap leading-relaxed">
              {config.notes}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
