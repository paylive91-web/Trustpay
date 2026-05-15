import React, { useState, useEffect } from "react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Trophy, CheckCircle2, Target, Loader2,
  ChevronLeft, Sparkles, TrendingUp, Info,
  Star, Zap, Calendar,
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

const fmtINR = (n: number) =>
  n >= 100000
    ? "₹" + (n / 100000).toFixed(n % 100000 === 0 ? 0 : 1) + "L"
    : n >= 1000
    ? "₹" + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k"
    : "₹" + n;

const fmtINRFull = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export default function WeeklyRewardPage() {
  const { toast } = useToast();
  const [claiming, setClaiming] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["weekly-reward"],
    queryFn: () => api("/p2p/weekly-reward"),
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const res = await api("/p2p/weekly-reward/claim", { method: "POST" });
      toast({ title: `🏆 ₹${res.rewardAmount} weekly reward credited!`, description: "Added to your TrustPay wallet." });
      refetch();
    } catch (err: any) {
      toast({ title: "Cannot claim", description: err?.message || "Try again later", variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  };

  const tiers: Array<{ minBuy: number; reward: number }> = data?.tiers || [];
  const weekBuyAmount: number = Number(data?.weekBuyAmount || 0);
  const eligibleTier = data?.eligibleTier || null;
  const claimed: boolean = !!data?.claimed;
  const claimedReward: number | null = data?.claimedReward ?? null;
  const weekStart: string = data?.weekStart || "";
  const weekEnd: string = data?.weekEnd || "";

  const nextTier = tiers.find((t) => weekBuyAmount < t.minBuy);
  const topTier = tiers[tiers.length - 1];
  const progressMax = topTier?.minBuy || 1;
  const progressPct = Math.min(100, (weekBuyAmount / progressMax) * 100);
  const remaining = nextTier ? nextTier.minBuy - weekBuyAmount : 0;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <style>{`
        @keyframes floatUp {
          0%,100%{transform:translateY(0);}
          50%{transform:translateY(-10px);}
        }
        @keyframes rotateGlow {
          0%{transform:rotate(0deg);}
          100%{transform:rotate(360deg);}
        }
        @keyframes pulseRing {
          0%{transform:scale(1);opacity:.5;}
          100%{transform:scale(1.8);opacity:0;}
        }
        @keyframes shimmerBar {
          0%{background-position:-200% 0;}
          100%{background-position:200% 0;}
        }
        @keyframes shimmerBtn {
          0%{background-position:200% 0;}
          100%{background-position:-200% 0;}
        }
        @keyframes fadeSlideIn {
          0%{opacity:0;transform:translateY(12px);}
          100%{opacity:1;transform:translateY(0);}
        }
        @keyframes sparkle {
          0%,100%{opacity:1;transform:scale(1);}
          50%{opacity:.4;transform:scale(.7);}
        }
        .float-up{animation:floatUp 3s ease-in-out infinite;}
        .pulse-ring{animation:pulseRing 2s ease-out infinite;}
        .pulse-ring-2{animation:pulseRing 2s ease-out infinite .5s;}
        .shimmer-bar{background:linear-gradient(90deg,#7c3aed 0%,#a855f7 35%,#e9d5ff 50%,#a855f7 65%,#7c3aed 100%);background-size:200% 100%;animation:shimmerBar 1.8s linear infinite;}
        .shimmer-btn{background:linear-gradient(105deg,#7c3aed 0%,#a855f7 30%,#c4b5fd 50%,#a855f7 70%,#7c3aed 100%);background-size:200% 100%;animation:shimmerBtn 2s linear infinite;}
        .fade-in{animation:fadeSlideIn .4s ease both;}
        .sparkle-star{animation:sparkle 1.5s ease-in-out infinite;}
        .sparkle-star-2{animation:sparkle 1.5s ease-in-out infinite .4s;}
        .sparkle-star-3{animation:sparkle 1.5s ease-in-out infinite .8s;}
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link href="/">
          <button className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
        </Link>
        <div>
          <h1 className="text-lg font-black text-slate-900">Weekly Reward</h1>
          <p className="text-[11px] text-muted-foreground">Big trades, bigger rewards — every week</p>
        </div>
        <div className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-100 rounded-full px-3 py-1 shrink-0">
          <Calendar className="h-3 w-3" />
          This Week
        </div>
      </div>

      <div className="px-4 pb-28 space-y-4">

        {/* Hero Trophy */}
        <div className="relative flex flex-col items-center py-8 overflow-hidden">
          <div className="absolute w-4 h-4 top-6 left-10 text-violet-300 sparkle-star"><Star className="w-4 h-4 fill-violet-300" /></div>
          <div className="absolute w-3 h-3 top-10 right-12 text-purple-300 sparkle-star-2"><Zap className="w-3 h-3 fill-purple-300" /></div>
          <div className="absolute w-3 h-3 top-4 right-24 text-violet-200 sparkle-star-3"><Star className="w-3 h-3 fill-violet-200" /></div>

          <div className="relative flex items-center justify-center">
            <div className="absolute w-32 h-32 rounded-full bg-violet-300/20 pulse-ring" />
            <div className="absolute w-24 h-24 rounded-full bg-violet-400/25 pulse-ring-2" />
            <div
              className="relative w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl float-up"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7,#6d28d9)", boxShadow: "0 12px 40px rgba(124,58,237,.5), 0 0 0 4px rgba(167,139,250,.3)" }}
            >
              <Trophy className="h-12 w-12 text-white drop-shadow-lg" strokeWidth={1.8} />
              {claimed && (
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg border-2 border-white">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 text-center px-4 fade-in">
            <div className="text-2xl font-black text-slate-900 leading-tight">
              {claimed
                ? `₹${claimedReward?.toLocaleString("en-IN")} Claimed! 🎉`
                : eligibleTier
                ? `₹${eligibleTier.reward.toLocaleString("en-IN")} Ready! 🏆`
                : tiers.length > 0
                ? `Buy ${fmtINR(tiers[0].minBuy)}+ This Week`
                : "Weekly Rewards"}
            </div>
            <p className="text-sm text-muted-foreground mt-1.5">
              {claimed
                ? "Outstanding! Reward added to wallet. Next week resets Monday."
                : eligibleTier
                ? "You've crossed a milestone — claim your weekly reward!"
                : "Complete big buy trades this week to unlock rewards."}
            </p>
            {weekStart && weekEnd && (
              <div className="mt-2 text-[11px] text-violet-600 bg-violet-50 rounded-full px-3 py-1 inline-block">
                {weekStart} – {weekEnd}
              </div>
            )}
          </div>
        </div>

        {/* Progress Card */}
        <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 shadow-md overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-600" />
                <span className="text-sm font-bold text-slate-800">This Week's Buys</span>
              </div>
              <span className="text-lg font-black text-violet-700">{fmtINRFull(weekBuyAmount)}</span>
            </div>
            <div className="space-y-1.5">
              <div className="h-3.5 rounded-full bg-violet-200/60 overflow-hidden">
                <div
                  className="h-full rounded-full shimmer-bar transition-all duration-700"
                  style={{ width: `${Math.max(progressPct, progressPct > 0 ? 3 : 0)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-violet-700/60">₹0</span>
                {nextTier && !claimed ? (
                  <span className="text-violet-700 font-semibold">
                    {fmtINRFull(remaining)} more → <span className="font-black">+{fmtINRFull(nextTier.reward)}</span>
                  </span>
                ) : claimed ? (
                  <span className="text-emerald-600 font-semibold">✅ Claimed this week</span>
                ) : (
                  <span className="text-emerald-600 font-semibold">🏆 Top tier reached!</span>
                )}
                <span className="text-violet-700/60">{fmtINR(progressMax)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tier Milestones */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-bold text-slate-800">Weekly Milestones</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {tiers.map((t, i) => {
              const reached = weekBuyAmount >= t.minBuy;
              const isNext = !reached && (i === 0 || weekBuyAmount >= tiers[i - 1]?.minBuy);
              const isEligible = eligibleTier?.minBuy === t.minBuy;
              return (
                <div
                  key={i}
                  className={`relative rounded-2xl border p-4 flex items-center justify-between transition-all
                    ${reached ? "bg-gradient-to-r from-violet-50 to-purple-50 border-violet-300 shadow-md" : isNext ? "bg-white border-violet-200 shadow-sm" : "bg-white/60 border-slate-100"}
                    ${isEligible && !claimed ? "ring-2 ring-violet-500 ring-offset-2" : ""}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow
                      ${reached ? "bg-gradient-to-br from-violet-500 to-purple-600" : isNext ? "bg-violet-50 border border-violet-200" : "bg-muted"}`}>
                      {reached ? "🏆" : isNext ? "🎯" : "⭕"}
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${reached ? "text-slate-900" : "text-slate-500"}`}>
                        Buy {fmtINRFull(t.minBuy)}+
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {reached ? "✅ Milestone crossed" : isNext ? "Next target" : "Keep buying"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xl font-black ${reached ? "text-violet-600" : "text-slate-300"}`}>
                      +{fmtINRFull(t.reward)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">bonus</div>
                  </div>
                  {isEligible && !claimed && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-[9px] font-black px-3 py-0.5 rounded-full shadow-md">
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
              <div className="text-lg font-black text-emerald-700">₹{claimedReward?.toLocaleString("en-IN")} Added to Wallet!</div>
              <div className="text-xs text-emerald-600">Resets every Monday. Trade more next week! 🚀</div>
            </div>
          ) : eligibleTier ? (
            <button
              className="w-full h-14 rounded-2xl text-white font-black text-lg shadow-xl shimmer-btn flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-95"
              onClick={handleClaim}
              disabled={claiming}
            >
              {claiming
                ? <><Loader2 className="h-5 w-5 animate-spin" /> Claiming...</>
                : <><Trophy className="h-5 w-5" /> Claim ₹{eligibleTier.reward.toLocaleString("en-IN")} Reward!</>}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 rounded-2xl bg-muted/40 border border-violet-100">
              <Target className="h-8 w-8 text-violet-400" />
              <div className="text-sm font-semibold text-slate-700 text-center">
                Buy {fmtINRFull(tiers[0]?.minBuy || 50000)}+ this week to unlock first reward
              </div>
              <Link href="/buy">
                <Button size="sm" className="rounded-full bg-gradient-to-r from-violet-500 to-purple-500 text-white border-none shadow">
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
              <span className="text-sm font-bold text-slate-800">How Weekly Rewards Work</span>
            </div>
            <div className="space-y-2.5">
              {[
                { icon: "🛒", text: "Buy USDT or UPI on TrustPay throughout the week (Mon–Sun)." },
                { icon: "📊", text: "Your total confirmed buy amount for the week counts toward milestones." },
                { icon: "🏆", text: "Cross a milestone tier and tap Claim — once per week." },
                { icon: "💰", text: "Reward is credited instantly to your TrustPay wallet." },
                { icon: "🔄", text: "Resets every Monday midnight. New week, new chance!" },
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
