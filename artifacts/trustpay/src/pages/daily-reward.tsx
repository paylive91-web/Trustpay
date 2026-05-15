import React, { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Gift, CheckCircle2, Target, Calendar, Loader2,
  ChevronLeft, Sparkles, TrendingUp, Info, Trophy,
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
      toast({
        title: `🎁 ₹${res.rewardAmount} reward credited!`,
        description: "Daily task reward added to your wallet.",
      });
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
        @keyframes giftFloat {
          0%,100%{transform:translateY(0) rotate(-4deg) scale(1);}
          30%{transform:translateY(-16px) rotate(4deg) scale(1.07);}
          60%{transform:translateY(-8px) rotate(-2deg) scale(1.04);}
          80%{transform:translateY(-20px) rotate(5deg) scale(1.1);}
        }
        @keyframes outerRing {
          0%{transform:scale(1);opacity:.5;}
          100%{transform:scale(1.9);opacity:0;}
        }
        @keyframes innerRing {
          0%{transform:scale(1);opacity:.4;}
          100%{transform:scale(1.5);opacity:0;}
        }
        @keyframes shimmerBar {
          0%{background-position:-200% 0;}
          100%{background-position:200% 0;}
        }
        @keyframes shimmerBtn {
          0%{background-position:200% 0;}
          100%{background-position:-200% 0;}
        }
        @keyframes popIn {
          0%{transform:scale(.7);opacity:0;}
          70%{transform:scale(1.08);}
          100%{transform:scale(1);opacity:1;}
        }
        .gift-float{animation:giftFloat 2.4s ease-in-out infinite;}
        .ring-outer{animation:outerRing 2s ease-out infinite;}
        .ring-inner{animation:innerRing 2s ease-out infinite .35s;}
        .shimmer-bar{background:linear-gradient(90deg,#fbbf24 0%,#f97316 35%,#fef3c7 50%,#f97316 65%,#fbbf24 100%);background-size:200% 100%;animation:shimmerBar 1.8s linear infinite;}
        .shimmer-btn{background:linear-gradient(105deg,#f59e0b 0%,#f97316 30%,#fbbf24 50%,#f97316 70%,#f59e0b 100%);background-size:200% 100%;animation:shimmerBtn 2s linear infinite;}
        .pop-in{animation:popIn .4s cubic-bezier(.34,1.56,.64,1) forwards;}
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link href="/">
          <button className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
        </Link>
        <div>
          <h1 className="text-lg font-black text-slate-900">Daily Task Reward</h1>
          <p className="text-[11px] text-muted-foreground">Buy more, earn more — resets every midnight</p>
        </div>
        <div className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 rounded-full px-3 py-1 shrink-0">
          <Calendar className="h-3 w-3" />
          Today
        </div>
      </div>

      <div className="px-4 pb-28 space-y-4">

        {/* Animated Gift Hero */}
        <div className="relative flex flex-col items-center py-8">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-32 h-32 rounded-full bg-amber-300/25 ring-outer" />
            <div className="absolute w-24 h-24 rounded-full bg-amber-400/30 ring-inner" />
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 flex items-center justify-center shadow-2xl gift-float"
              style={{ boxShadow: "0 12px 40px rgba(251,146,60,.55), 0 0 0 4px rgba(251,191,36,.25)" }}>
              <Gift className="h-12 w-12 text-white drop-shadow-lg" strokeWidth={1.8} />
              {claimed && (
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg pop-in border-2 border-white">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          </div>
          <div className="mt-5 text-center px-4">
            <div className="text-2xl font-black text-slate-900 leading-tight">
              {claimed
                ? `₹${claimedReward} Claimed! 🎉`
                : eligibleTier
                ? `₹${eligibleTier.reward} Ready! 🎁`
                : tiers.length > 0
                ? `Buy ${fmtINR(tiers[0].minBuy)}+ Today`
                : "Daily Rewards"}
            </div>
            <p className="text-sm text-muted-foreground mt-1.5 leading-snug">
              {claimed
                ? "Great job! Reward added to your wallet. Come back tomorrow."
                : eligibleTier
                ? "You've hit a milestone — tap below to claim your reward!"
                : "Complete buy trades to unlock daily bonus rewards."}
            </p>
          </div>
        </div>

        {/* Progress Card */}
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 shadow-md overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-bold text-slate-800">Today's Buy Total</span>
              </div>
              <span className="text-lg font-black text-amber-700">{fmtINR(todayBuyAmount)}</span>
            </div>
            <div className="space-y-1.5">
              <div className="h-3.5 rounded-full bg-amber-200/60 overflow-hidden">
                <div
                  className="h-full rounded-full shimmer-bar transition-all duration-700"
                  style={{ width: `${Math.max(progressPct, progressPct > 0 ? 3 : 0)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-amber-700/70">₹0</span>
                {nextTier && !claimed ? (
                  <span className="text-amber-700 font-semibold">
                    {fmtINR(remaining)} more → <span className="font-black">+{fmtINR(nextTier.reward)}</span>
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold">🏆 Top tier reached!</span>
                )}
                <span className="text-amber-700/70">{fmtINR(progressMax)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tier Milestones */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-bold text-slate-800">Reward Milestones</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {tiers.map((t, i) => {
              const reached = todayBuyAmount >= t.minBuy;
              const isNext = !reached && (i === 0 || todayBuyAmount >= tiers[i - 1]?.minBuy);
              const isEligible = eligibleTier?.minBuy === t.minBuy;
              return (
                <div
                  key={i}
                  className={`relative rounded-2xl border p-4 flex items-center justify-between transition-all
                    ${reached ? "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 shadow-md" : isNext ? "bg-white border-amber-200 shadow-sm" : "bg-white/60 border-slate-100"}
                    ${isEligible && !claimed ? "ring-2 ring-amber-500 ring-offset-2" : ""}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow
                      ${reached ? "bg-gradient-to-br from-amber-400 to-orange-500" : isNext ? "bg-amber-50 border border-amber-200" : "bg-muted"}`}>
                      {reached ? "🎁" : isNext ? "🎯" : "⭕"}
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${reached ? "text-slate-900" : "text-slate-500"}`}>
                        Buy {fmtINR(t.minBuy)}+
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {reached ? "✅ Tier reached" : isNext ? "Next milestone" : "Keep buying to unlock"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xl font-black ${reached ? "text-orange-600" : "text-slate-300"}`}>
                      +{fmtINR(t.reward)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">bonus</div>
                  </div>
                  {isEligible && !claimed && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black px-3 py-0.5 rounded-full shadow-md">
                      ✨ CLAIM NOW
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Claim / Status */}
        <div className="pt-1">
          {claimed ? (
            <div className="flex flex-col items-center gap-3 py-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 shadow-sm">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <div className="text-lg font-black text-emerald-700">₹{claimedReward} Added to Wallet!</div>
              <div className="text-xs text-emerald-600">Resets at midnight — come back tomorrow 🎉</div>
            </div>
          ) : eligibleTier ? (
            <button
              className="w-full h-14 rounded-2xl text-white font-black text-lg shadow-xl shimmer-btn flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-95"
              onClick={handleClaim}
              disabled={claiming}
            >
              {claiming
                ? <><Loader2 className="h-5 w-5 animate-spin" /> Claiming...</>
                : <><Gift className="h-5 w-5" /> Claim ₹{eligibleTier.reward} Reward!</>}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 rounded-2xl bg-muted/40 border border-amber-100">
              <Target className="h-8 w-8 text-amber-400" />
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
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-bold text-slate-800">How Daily Rewards Work</span>
            </div>
            <div className="space-y-2.5">
              {[
                { icon: "🛒", text: "Buy USDT or UPI on TrustPay throughout the day." },
                { icon: "📊", text: "Your total confirmed buy amount counts toward milestones." },
                { icon: "🏆", text: "Reach a milestone tier and tap Claim — once per day." },
                { icon: "💰", text: "Reward is credited instantly to your TrustPay wallet." },
                { icon: "🔄", text: "Everything resets at midnight. New day, new chance!" },
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
