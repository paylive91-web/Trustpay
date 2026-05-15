import React, { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Target, Calendar, Loader2,
  ChevronLeft, Sparkles, TrendingUp, Info, Trophy,
  Flame, Zap, Star,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";
import { API_BASE } from "@/lib/api-config";
import { Link } from "wouter";

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

const fmtINR = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export default function DailyRewardPage() {
  const { toast } = useToast();
  const [claiming, setClaiming] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["daily-reward"],
    queryFn: () => api("/p2p/daily-reward"),
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const res = await api("/p2p/daily-reward/claim", { method: "POST" });
      toast({ title: `🎁 ₹${res.rewardAmount} reward credited!`, description: "Added to your TrustPay wallet." });
      refetch();
    } catch (err: any) {
      toast({ title: "Cannot claim", description: err?.message || "Try again later", variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  };

  const tiers: Array<{ minBuy: number; reward: number }> = data?.tiers || [];
  const todayBuyAmount: number = Number(data?.todayBuyAmount || 0);
  const eligibleTier = data?.eligibleTier || null;
  const claimed: boolean = !!data?.claimed;
  const claimedReward: number | null = data?.claimedReward ?? null;
  const nextTier = tiers.find((t) => todayBuyAmount < t.minBuy);
  const topTier = tiers[tiers.length - 1];
  const progressMax = topTier?.minBuy || 1;
  const progressPct = Math.min(100, (todayBuyAmount / progressMax) * 100);
  const remaining = nextTier ? nextTier.minBuy - todayBuyAmount : 0;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <style>{`
        @keyframes slideDown {
          0%{opacity:0;transform:translateY(-16px);}
          100%{opacity:1;transform:translateY(0);}
        }
        @keyframes fadeUp {
          0%{opacity:0;transform:translateY(14px);}
          100%{opacity:1;transform:translateY(0);}
        }
        @keyframes shimmerBar {
          0%{background-position:-200% 0;}
          100%{background-position:200% 0;}
        }
        @keyframes shimmerBtn {
          0%{background-position:200% 0;}
          100%{background-position:-200% 0;}
        }
        @keyframes countUp {
          0%{opacity:0;transform:scale(.8);}
          60%{transform:scale(1.06);}
          100%{opacity:1;transform:scale(1);}
        }
        @keyframes sparkle {
          0%,100%{opacity:1;transform:scale(1) rotate(0deg);}
          50%{opacity:.5;transform:scale(.7) rotate(20deg);}
        }
        @keyframes glowPulse {
          0%,100%{box-shadow:0 0 0 0 rgba(251,146,60,.4);}
          50%{box-shadow:0 0 0 8px rgba(251,146,60,.0);}
        }
        .slide-down{animation:slideDown .45s cubic-bezier(.22,1,.36,1) both;}
        .fade-up{animation:fadeUp .45s cubic-bezier(.22,1,.36,1) both;}
        .fade-up-2{animation:fadeUp .45s cubic-bezier(.22,1,.36,1) .1s both;}
        .fade-up-3{animation:fadeUp .45s cubic-bezier(.22,1,.36,1) .2s both;}
        .fade-up-4{animation:fadeUp .45s cubic-bezier(.22,1,.36,1) .3s both;}
        .shimmer-bar{background:linear-gradient(90deg,#fbbf24 0%,#f97316 35%,#fef3c7 50%,#f97316 65%,#fbbf24 100%);background-size:200% 100%;animation:shimmerBar 1.8s linear infinite;}
        .shimmer-btn{background:linear-gradient(105deg,#f59e0b 0%,#f97316 30%,#fbbf24 50%,#f97316 70%,#f59e0b 100%);background-size:200% 100%;animation:shimmerBtn 2s linear infinite;}
        .count-up{animation:countUp .5s cubic-bezier(.34,1.56,.64,1) both;}
        .sparkle-1{animation:sparkle 2s ease-in-out infinite;}
        .sparkle-2{animation:sparkle 2s ease-in-out infinite .5s;}
        .sparkle-3{animation:sparkle 2s ease-in-out infinite 1s;}
        .glow-pulse{animation:glowPulse 2s ease-in-out infinite;}
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 slide-down">
        <Link href="/">
          <button className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
        </Link>
        <div>
          <h1 className="text-lg font-black text-slate-900">Daily Task Reward</h1>
          <p className="text-[11px] text-muted-foreground">Buy more today, earn more bonus</p>
        </div>
        <div className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 rounded-full px-3 py-1 shrink-0">
          <Calendar className="h-3 w-3" />
          Today
        </div>
      </div>

      <div className="px-4 pb-28 space-y-4">

        {/* Hero Stats Card */}
        <div className="relative overflow-hidden rounded-3xl p-5 fade-up" style={{ background: "linear-gradient(135deg,#f59e0b,#ea580c,#dc2626)" }}>
          <div className="absolute top-3 right-3 opacity-30">
            <Star className="w-5 h-5 text-white sparkle-1 fill-white" />
          </div>
          <div className="absolute top-8 right-10 opacity-20">
            <Zap className="w-3 h-3 text-white sparkle-2 fill-white" />
          </div>
          <div className="absolute bottom-4 right-5 opacity-20">
            <Star className="w-4 h-4 text-white sparkle-3 fill-white" />
          </div>

          <div className="mb-3">
            <div className="text-white/70 text-[11px] uppercase tracking-widest font-bold mb-1">Today's Buy Total</div>
            <div className="text-4xl font-black text-white count-up">{fmtINR(todayBuyAmount)}</div>
            {nextTier && !claimed && (
              <div className="text-white/80 text-sm mt-1">
                {fmtINR(remaining)} more → <span className="font-bold text-yellow-200">+{fmtINR(nextTier.reward)} bonus</span>
              </div>
            )}
            {claimed && <div className="text-yellow-200 text-sm mt-1 font-bold">✅ Reward claimed today!</div>}
            {!nextTier && !claimed && tiers.length > 0 && (
              <div className="text-yellow-200 text-sm mt-1 font-bold">🏆 Top tier reached!</div>
            )}
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-2.5 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-white/80 transition-all duration-700"
                style={{ width: `${Math.max(progressPct, progressPct > 0 ? 3 : 0)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-white/60">
              <span>₹0</span>
              <span>{fmtINR(progressMax)}</span>
            </div>
          </div>
        </div>

        {/* Status Banner */}
        {claimed && (
          <div className="fade-up-2 flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-sm font-black text-emerald-700">₹{claimedReward} added to wallet!</div>
              <div className="text-xs text-emerald-600 mt-0.5">Come back tomorrow for a fresh reward 🎉</div>
            </div>
          </div>
        )}
        {!claimed && eligibleTier && (
          <div className="fade-up-2 flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border-2 border-amber-400">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 glow-pulse">
              <Flame className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-black text-amber-800">₹{eligibleTier.reward} reward unlocked!</div>
              <div className="text-xs text-amber-700 mt-0.5">Claim it now before midnight reset</div>
            </div>
          </div>
        )}

        {/* Tier Milestones */}
        <div className="fade-up-3">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-bold text-slate-800">Reward Milestones</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {tiers.map((t, i) => {
              const reached = todayBuyAmount >= t.minBuy;
              const isNext = !reached && (i === 0 || todayBuyAmount >= tiers[i - 1]?.minBuy);
              const isEligible = eligibleTier?.minBuy === t.minBuy;
              return (
                <div
                  key={i}
                  className={`relative rounded-2xl border p-3.5 flex items-center justify-between transition-all
                    ${reached ? "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 shadow-sm" : "bg-white border-slate-100"}
                    ${isEligible && !claimed ? "ring-2 ring-amber-500 ring-offset-1" : ""}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg
                      ${reached ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow" : "bg-slate-100"}`}>
                      {reached ? "🔥" : isNext ? "🎯" : "○"}
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${reached ? "text-slate-900" : "text-slate-400"}`}>
                        {fmtINR(t.minBuy)}+ today
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {reached ? "Milestone reached" : isNext ? "Next target" : "Locked"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div className={`text-lg font-black ${reached ? "text-orange-600" : "text-slate-300"}`}>
                      +{fmtINR(t.reward)}
                    </div>
                    {reached && <CheckCircle2 className="h-4 w-4 text-amber-500" />}
                  </div>
                  {isEligible && !claimed && (
                    <div className="absolute -top-1.5 right-3 bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                      CLAIM NOW
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Claim Button */}
        <div className="pt-1 fade-up-4">
          {!claimed && eligibleTier && (
            <button
              className="w-full h-14 rounded-2xl text-white font-black text-lg shadow-xl shimmer-btn flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-95"
              onClick={handleClaim}
              disabled={claiming}
            >
              {claiming
                ? <><Loader2 className="h-5 w-5 animate-spin" /> Claiming...</>
                : <><Zap className="h-5 w-5" /> Claim ₹{eligibleTier.reward} Now!</>}
            </button>
          )}
          {!claimed && !eligibleTier && (
            <div className="flex flex-col items-center gap-3 py-5 rounded-2xl bg-muted/40 border border-amber-100">
              <Target className="h-7 w-7 text-amber-400" />
              <div className="text-sm font-semibold text-slate-700 text-center">
                Buy {fmtINR(tiers[0]?.minBuy || 2000)}+ to unlock your first reward
              </div>
              <Link href="/buy">
                <Button size="sm" className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white border-none shadow">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Start Buying
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* How it works */}
        <Card className="border-slate-100 shadow-sm fade-up-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-bold text-slate-800">How Daily Rewards Work</span>
            </div>
            <div className="space-y-2.5">
              {[
                { icon: "🛒", text: "Buy USDT or UPI on TrustPay throughout the day." },
                { icon: "📊", text: "Your total confirmed buy amount counts toward milestones." },
                { icon: "🔥", text: "Reach a milestone and tap Claim — once per day." },
                { icon: "💰", text: "Reward is credited instantly to your TrustPay wallet." },
                { icon: "🔄", text: "Resets at midnight every day. Daily grind = daily rewards!" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="text-base shrink-0 leading-none mt-0.5">{item.icon}</span>
                  <span className="leading-snug">{item.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
}
