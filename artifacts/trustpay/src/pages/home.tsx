import React, { useEffect, useState } from "react";
import { useGetMe, useGetAppSettings } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import Layout from "@/components/layout";
import AppStartupPopup from "@/components/app-startup-popup";
import DisputePauseBanner from "@/components/dispute-pause-banner";
import NotificationsBell from "@/components/notifications-bell";
const logoPath = `${import.meta.env.BASE_URL}trustpay-logo.png`;
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownCircle, ArrowUpCircle, ChevronRight, Coins, Download, IndianRupee, Link as LinkIcon, ShieldAlert, ShieldCheck, Sparkles, Wallet, TrendingUp, TrendingDown, AlertCircle, Award, Medal, Crown, Gem, BookOpen } from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { Skeleton } from "@/components/ui/skeleton";
import useEmblaCarousel from "embla-carousel-react";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import NotificationPermissionGate from "@/components/notification-permission-gate";

import { API_BASE, assetUrl } from "@/lib/api-config";

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

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  locked: { label: "Locked", color: "bg-amber-100 text-amber-700" },
  pending_confirmation: { label: "Pending", color: "bg-orange-100 text-orange-700" },
  disputed: { label: "Disputed", color: "bg-red-100 text-red-700" },
};

function LiveOrdersSection() {
  const { data: liveOrders = [], isLoading } = useQuery<any[]>({
    queryKey: ["recent-orders"],
    queryFn: () => api("/p2p/recent-orders"),
    refetchInterval: 8_000,
    staleTime: 0,
  });

  if (isLoading || liveOrders.length === 0) {
    return (
      <Card className="border-none shadow-sm bg-orange-50/60">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-orange-700">My Orders</h3>
            <p className="text-sm text-muted-foreground">{isLoading ? "Loading..." : "No active orders right now"}</p>
          </div>
          <Link href="/orders">
            <Button variant="outline" size="sm" className="rounded-full gap-1 border-orange-200 text-orange-700 hover:bg-orange-50">View <ChevronRight className="h-4 w-4" /></Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
            </span>
            <h3 className="font-semibold text-sm text-orange-800">Live Orders</h3>
          </div>
          <Link href="/orders">
            <Button variant="ghost" size="sm" className="rounded-full gap-1 text-xs h-7 text-orange-600 hover:text-orange-700 hover:bg-orange-50">All <ChevronRight className="h-3 w-3" /></Button>
          </Link>
        </div>
        <div className="divide-y divide-orange-50">
          {liveOrders.map((o: any) => {
            const st = STATUS_LABEL[o.status] || { label: o.status, color: "bg-muted text-muted-foreground" };
            const isBuy = o.side === "buy";
            const target = o.status === "disputed"
              ? "/orders?tab=disputes"
              : (isBuy ? "/buy" : "/sell");
            return (
              <Link key={o.id} href={target}>
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-orange-50/40 transition-colors cursor-pointer">
                  <div className={`p-1.5 rounded-full ${isBuy ? "bg-orange-100" : "bg-rose-100"}`}>
                    {isBuy
                      ? <TrendingDown className="h-4 w-4 text-orange-600" />
                      : <TrendingUp className="h-4 w-4 text-rose-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">₹{Number(o.amount).toFixed(2)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{isBuy ? "Buy" : "Sell"} · Order #{o.id}</div>
                  </div>
                  {o.status === "disputed" && <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                  <ChevronRight className="h-4 w-4 text-orange-300 flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetMe({ query: { queryKey: ["me"], retry: false } });
  const { data: settings } = useGetAppSettings();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const { toast } = useToast();

  const { isInstallable, handleInstall } = useInstallPrompt();

  const { data: upiList = [] } = useQuery({
    queryKey: ["upi"],
    queryFn: () => api("/upi"),
    enabled: !!user,
  });

  useEffect(() => {
    if (isError) setLocation("/login");
  }, [isError, setLocation]);


  // Auto-advance banner carousel every 4 seconds
  useEffect(() => {
    if (!emblaApi) return;
    const t = setInterval(() => emblaApi.scrollNext(), 4000);
    return () => clearInterval(t);
  }, [emblaApi]);

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }
  if (!user) return null;

  const activeUpiList = Array.isArray(upiList) ? (upiList as any[]).filter((u: any) => u.isActive) : [];
  const hasUpi = activeUpiList.length > 0;
  const displayName = user.phone || user.username;
  const trustScore = (user as any).trustScore ?? 0;
  const isAdmin = (user as any).role === "admin";
  const isFrozen = (user as any).isFrozen && !isAdmin;
  const balance = Number((user as any)?.balance ?? 0);
  const buyRules = (settings as any)?.buyRules || "";
  const sellRules = (settings as any)?.sellRules || "";

  return (
    <Layout>
      <AppStartupPopup />
      <NotificationPermissionGate />

      {/* Top bar — no background, flows with page */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={assetUrl((settings as any)?.appLogoUrl) || logoPath} alt={(settings as any)?.appName || "TrustPay"} className="w-10 h-10 rounded-xl object-contain shadow-sm" />
            <div>
              <div className="font-bold text-[19px] leading-none text-slate-900">
                {(settings as any)?.appName || "TrustPay"}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Secure P2P UPI trading</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground">Hello,</div>
              <div className="text-sm font-semibold text-slate-900 leading-none">{displayName}</div>
            </div>
            {isInstallable && (
              <button
                type="button"
                aria-label="Install App"
                onClick={handleInstall}
                className="relative p-2 rounded-full hover:bg-orange-200/50 transition-colors text-orange-600"
                title="Download App"
              >
                <Download className="h-5 w-5" />
              </button>
            )}
            <NotificationsBell />
          </div>
        </div>
      </div>

      {/* Banner carousel */}
      {settings?.bannerImages && settings.bannerImages.length > 0 && (
        <div className="px-4 pb-3">
          <div className="overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5" ref={emblaRef}>
            <div className="flex">
              {settings.bannerImages.map((img, i) => (
                <div className="flex-[0_0_100%] min-w-0 relative" key={i}>
                  <img src={assetUrl(img)} alt={`Banner ${i}`} className="w-full h-36 sm:h-44 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/10" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-3 sm:px-4 pb-4 space-y-3 sm:space-y-4">
        {isFrozen && (
          <Card className="border-red-300 bg-gradient-to-r from-red-50 to-red-100 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldAlert className="text-red-600 h-6 w-6" />
              <div className="text-sm text-red-700">
                Your account is frozen due to low trust score. Contact support to resolve.
              </div>
            </CardContent>
          </Card>
        )}

        <AgentTierBadge
          level={(user as any)?.agentTierLevel || 0}
          tiers={(settings as any)?.agentTiers || []}
        />

        {/* ── Balance card ── orange-amber tinted */}
        <Card className="shadow-xl border-none overflow-hidden bg-gradient-to-br from-white via-orange-50/40 to-amber-50">
          <CardContent className="p-0">
            <div className="p-4 sm:p-5 pb-4 bg-gradient-to-r from-orange-400/10 to-rose-400/10">
              <div className="flex items-center justify-between mb-4 gap-3">
                <div>
                  <div className="text-muted-foreground text-sm">My Total Assets</div>
                  <div className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">₹ {balance.toFixed(2)}</div>
                </div>
                <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Wallet className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-orange-500" />
                <span>Trust Score: <span className={trustScore >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>{trustScore}</span></span>
              </div>
            </div>

            <div className="p-4 sm:p-5 pt-0">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <Link href="/buy" className="w-full">
                  <Button className="w-full min-h-12 sm:min-h-13 text-base rounded-2xl shadow-md bg-primary hover:bg-primary/90 text-primary-foreground">
                    <ArrowDownCircle className="mr-2 h-5 w-5" />
                    BUY
                  </Button>
                </Link>
                <Link href="/sell" className="w-full">
                  <Button className="w-full min-h-12 sm:min-h-13 text-base rounded-2xl shadow-md bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white border-none">
                    <ArrowUpCircle className="mr-2 h-5 w-5" />
                    SELL
                  </Button>
                </Link>
              </div>
              {hasUpi ? (
                <div className="mt-3 rounded-2xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-[11px] sm:text-xs text-emerald-700 flex items-center justify-between gap-2">
                  <span>{activeUpiList.length} UPI linked & ready</span>
                  <Link href="/upi" className="font-medium underline">Manage</Link>
                </div>
              ) : (
                <Link href="/upi" className="block">
                  <div className="mt-3 rounded-2xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] sm:text-xs text-amber-800 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5"><LinkIcon className="w-3.5 h-3.5" /> No UPI linked yet</span>
                    <span className="font-medium underline">Connect UPI</span>
                  </div>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <DisputePauseBanner />
        <HomeRewardCard settings={settings} />
        <LiveOrdersSection />

        {/* ── Sell Queue quick link ── amber tinted */}
        <Card className="border-none shadow-sm bg-amber-50/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-amber-800">My Sell Queue</h3>
              <p className="text-sm text-muted-foreground">Quick rules & support</p>
            </div>
            <Link href="/sell">
              <Button variant="outline" size="sm" className="rounded-full gap-1 border-amber-200 text-amber-700 hover:bg-amber-50">Open <ChevronRight className="h-4 w-4" /></Button>
            </Link>
          </CardContent>
        </Card>

        {/* ── Rules preview ── orange + rose tinted panels */}
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Rules</h3>
                <p className="text-sm text-muted-foreground">Buy and sell rules</p>
              </div>
              <Link href="/info">
                <Button variant="outline" size="sm" className="rounded-full gap-1 border-orange-200 text-orange-700 hover:bg-orange-50">Open <ChevronRight className="h-4 w-4" /></Button>
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl bg-orange-50 border border-orange-100 p-3">
                <div className="text-xs font-semibold text-orange-700 mb-1">Buy Rules</div>
                <div className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{buyRules}</div>
              </div>
              <div className="rounded-2xl bg-rose-50 border border-rose-100 p-3">
                <div className="text-xs font-semibold text-rose-700 mb-1">Sell Rules</div>
                <div className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{sellRules}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── How to Use Guide ── green tinted */}
        <Link href="/how-to-use">
          <Card className="border-none shadow-sm bg-green-50/70 hover:bg-green-50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 border border-green-200 p-2.5 rounded-xl">
                  <BookOpen className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-900">TrustPay Guide</h3>
                  <p className="text-sm text-green-700/70">Buy, Sell aur Trust Score kaise kaam karta hai</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-green-400" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </Layout>
  );
}

function HomeRewardCard({ settings }: { settings: any }) {
  if (!settings) return null;
  const enabled = settings.homeRewardCardEnabled === undefined
    ? true
    : settings.homeRewardCardEnabled === true || settings.homeRewardCardEnabled === "true";
  if (!enabled) return null;

  const safeNum = (v: any, dflt: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return dflt;
    return Math.max(0, n);
  };

  const upiTitle = (settings.homeRewardUpiTitle ?? "UPI REWARD UP TO 6%") || "UPI REWARD UP TO 6%";
  const upiAmount = safeNum(settings.homeRewardUpiExampleAmount, 10000);
  const upiBonus = safeNum(settings.homeRewardUpiExampleBonus, 300);

  const usdtTitle = (settings.homeRewardUsdtTitle ?? "USDT REWARD") || "USDT REWARD";
  const usdtEnabled = settings.usdtEnabled === true || settings.usdtEnabled === "true";
  const usdtRate = safeNum(settings.usdtRatePerUnit, 0);
  const usdtBonusPct = safeNum(settings.usdtBonusPercent, 0);
  const usdtExampleUnits = 100;
  const usdtBaseInr = usdtExampleUnits * usdtRate;
  const usdtBonusInr = usdtBaseInr * (usdtBonusPct / 100);
  const usdtTotalInr = usdtBaseInr + usdtBonusInr;
  const showUsdt = usdtEnabled && usdtRate > 0;

  const showUpi = upiAmount > 0 || upiBonus > 0;
  if (!showUsdt && !showUpi) return null;

  const fmtINR = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  return (
    <div className="space-y-2.5">
      {showUpi && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 border border-orange-200 p-4 shadow-sm">
          <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-400 to-rose-400 text-white text-[10px] font-black tracking-wide shadow">
            <Sparkles className="h-2.5 w-2.5" /> HOT
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-md shrink-0">
              <IndianRupee className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-orange-700/70">Buy Rupee</div>
              <div className="text-base font-black text-slate-900 leading-tight">{upiTitle}</div>
            </div>
          </div>
          <Link href="/buy">
            <div className="mt-3 rounded-xl bg-white/80 border border-orange-200 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-white transition-colors" data-testid="link-home-reward-upi">
              <div className="flex items-center gap-2 text-[13px] font-bold text-slate-800">
                <span className="text-orange-700">Pay {fmtINR(upiAmount)}</span>
                <ChevronRight className="h-3 w-3 text-orange-400" />
                <span className="text-emerald-700">+{fmtINR(upiBonus)} bonus</span>
              </div>
              <ChevronRight className="h-4 w-4 text-orange-400" />
            </div>
          </Link>
        </div>
      )}

      {showUsdt && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 ring-1 ring-amber-400/30 p-4 shadow-lg">
          <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 text-[10px] font-black tracking-wide shadow">
            <Sparkles className="h-2.5 w-2.5" /> POPULAR
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-md shrink-0">
              <Coins className="h-6 w-6 text-slate-900" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-amber-300/70">Buy USDT</div>
              <div className="text-base font-black text-white leading-tight">{usdtTitle}</div>
              <div className="text-[11px] text-amber-200/90 mt-0.5">Platform price ₹{usdtRate}{usdtBonusPct > 0 ? ` + ${usdtBonusPct}% bonus` : ""}</div>
            </div>
          </div>
          <Link href="/usdt-deposit">
            <div className="mt-3 rounded-xl bg-white/10 backdrop-blur-sm border border-amber-300/20 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-white/15 transition-colors" data-testid="link-home-reward-usdt">
              <div className="flex items-center gap-2 text-[13px] font-bold">
                <span className="text-amber-200">{usdtExampleUnits} USDT</span>
                <ChevronRight className="h-3 w-3 text-amber-400/60" />
                <span className="text-emerald-300">{fmtINR(usdtTotalInr)}{usdtBonusPct > 0 ? ` (+${fmtINR(usdtBonusInr)} bonus)` : ""}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-amber-400/70" />
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}

interface AgentTierBadgeProps {
  level: number;
  tiers: Array<{ minActiveDeposits?: number; reward?: number; label?: string }>;
}

function AgentTierBadge({ level, tiers }: AgentTierBadgeProps) {
  if (!level || level < 1) return null;

  const styles = [
    {
      gradient: "from-amber-700 via-amber-600 to-amber-800",
      border: "border-amber-400",
      icon: Medal,
      defaultName: "Bronze Agent",
    },
    {
      gradient: "from-slate-400 via-slate-300 to-slate-500",
      border: "border-slate-200",
      icon: Award,
      defaultName: "Silver Agent",
    },
    {
      gradient: "from-yellow-500 via-yellow-400 to-amber-500",
      border: "border-yellow-300",
      icon: Crown,
      defaultName: "Gold Agent",
    },
    {
      gradient: "from-cyan-300 via-sky-400 to-blue-500",
      border: "border-cyan-200",
      icon: Gem,
      defaultName: "Diamond Agent",
    },
  ];

  const idx = Math.min(level - 1, styles.length - 1);
  const s = styles[idx];
  const Icon = s.icon;
  const adminLabel = tiers[idx]?.label?.trim();
  const name = adminLabel && adminLabel.length > 0 ? adminLabel : s.defaultName;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-lg border ${s.border} bg-gradient-to-r ${s.gradient} text-white`}
      title={`${name} — earned today`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="bg-white/20 rounded-full p-1.5 backdrop-blur-sm">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-semibold opacity-90 leading-tight">
            Today's Achievement
          </div>
          <div className="text-base font-bold leading-tight truncate">
            {name}
          </div>
        </div>
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wide bg-white/15 rounded-full px-2.5 py-1 backdrop-blur-sm border border-white/20 whitespace-nowrap">
        Level {level}
      </div>
    </div>
  );
}
