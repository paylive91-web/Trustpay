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
import { ArrowLeft, ArrowRight, Coins, History as HistoryIcon, IndianRupee, Loader2, Sparkles, ShieldCheck, Info } from "lucide-react";
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

        {/* Trust + window info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white border border-slate-200 p-3 flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center shrink-0 shadow-sm">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <div className="text-[12px] font-bold text-slate-800">Verified by TrustPay</div>
              <div className="text-[11px] text-slate-500 leading-snug">TrustPay reviews TxID + screenshot before crediting.</div>
            </div>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-3 flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shrink-0 shadow-sm">
              <Info className="h-4 w-4 text-slate-900" />
            </div>
            <div>
              <div className="text-[12px] font-bold text-slate-800">{config.windowMinutes}-min window</div>
              <div className="text-[11px] text-slate-500 leading-snug">Pay within {config.windowMinutes} minutes after starting.</div>
            </div>
          </div>
        </div>

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
