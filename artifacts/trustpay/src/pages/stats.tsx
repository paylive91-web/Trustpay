import { useState, useEffect } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Trophy, Star, Gift, Zap, ShoppingCart, Banknote, ChevronDown, ChevronUp, IndianRupee,
} from "lucide-react";
import { getAuthToken } from "@/lib/auth";
import { API_BASE } from "@/lib/api-config";

interface MyStats {
  buyReward: { today: number; total: number };
  sellReward: { today: number; total: number };
  agentEarning: { total: number };
  buyOrders: Array<{ id: number; amount: string; rewardAmount: string; status: string; createdAt: string }>;
  sellOrders: Array<{ id: number; amount: string; sellRewardAmount: string; feeAmount: string; status: string; createdAt: string }>;
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Stats() {
  const [, setLocation] = useLocation();
  const { data: user } = useGetMe();
  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyTab, setHistoryTab] = useState<"buy" | "sell">("buy");
  const [showRewardDetail, setShowRewardDetail] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/p2p/my-stats`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    })
      .then((r) => r.json())
      .then((d) => setMyStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const inviteEarnings = (user as any)?.inviteEarnings || 0;
  const totalRewards = (myStats?.buyReward.total || 0) + (myStats?.sellReward.total || 0) + (myStats?.agentEarning.total || 0);
  const todayRewards = (myStats?.buyReward.today || 0) + (myStats?.sellReward.today || 0);
  const lifetimeTotal = totalRewards + inviteEarnings;

  return (
    <Layout>
      {/* Header — home orange-amber theme */}
      <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 border-b border-orange-200 pb-6">
        <div className="flex items-center gap-3 px-4 pt-4 pb-4">
          <button
            onClick={() => setLocation("/profile")}
            className="w-9 h-9 rounded-xl bg-white/70 border border-orange-200 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-slate-900 font-bold text-lg">Rewards & Stats</h1>
            <p className="text-[11px] text-orange-700/70">Your earnings at a glance</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-sm">
            <Trophy className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Summary hero card */}
        <div className="mx-4 rounded-2xl bg-white/80 border border-orange-200 shadow-sm p-4">
          <div className="text-[11px] text-orange-700/70 uppercase tracking-wide font-bold mb-1">Total Lifetime Earnings</div>
          <div className="flex items-baseline gap-1 mb-3">
            <IndianRupee className="w-6 h-6 text-orange-500" />
            <div className="text-3xl font-black text-slate-900">{fmt(lifetimeTotal)}</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-orange-50 border border-orange-100 p-2.5 text-center">
              <div className="text-[10px] text-orange-700/70 uppercase tracking-wide font-bold">Today</div>
              <div className="text-sm font-black text-orange-700">₹{fmt(todayRewards)}</div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-2.5 text-center">
              <div className="text-[10px] text-amber-700/70 uppercase tracking-wide font-bold">Agent</div>
              <div className="text-sm font-black text-amber-700">₹{fmt(myStats?.agentEarning.total || 0)}</div>
            </div>
            <div className="rounded-xl bg-violet-50 border border-violet-100 p-2.5 text-center">
              <div className="text-[10px] text-violet-700/70 uppercase tracking-wide font-bold">Invite</div>
              <div className="text-sm font-black text-violet-700">₹{fmt(inviteEarnings)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-4">
        {/* Reward breakdown */}
        <div className="rounded-2xl overflow-hidden shadow-md border border-orange-100 bg-white">
          <button
            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-amber-50"
            onClick={() => setShowRewardDetail(!showRewardDetail)}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-sm">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <span className="text-slate-900 font-semibold text-sm">Reward Breakdown</span>
            </div>
            {showRewardDetail
              ? <ChevronUp className="w-4 h-4 text-orange-400" />
              : <ChevronDown className="w-4 h-4 text-orange-400" />}
          </button>

          {showRewardDetail && (
            <div className="px-4 pb-4 space-y-3 pt-3">
              <div className="h-px bg-orange-100" />

              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : (
                <>
                  {/* Buy + Sell reward cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-3 bg-orange-50 border border-orange-100">
                      <div className="flex items-center gap-2 mb-2">
                        <ShoppingCart className="w-4 h-4 text-orange-500" />
                        <span className="text-xs font-semibold text-orange-700">Buy Reward</span>
                      </div>
                      <div className="font-black text-base text-slate-900">
                        ₹{fmt(myStats?.buyReward.today || 0)}
                      </div>
                      <div className="text-xs text-orange-600/70 mt-0.5">Today</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Overall: ₹{fmt(myStats?.buyReward.total || 0)}
                      </div>
                    </div>

                    <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Banknote className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-semibold text-emerald-700">Sell Reward</span>
                      </div>
                      <div className="font-black text-base text-slate-900">
                        ₹{fmt(myStats?.sellReward.today || 0)}
                      </div>
                      <div className="text-xs text-emerald-600/70 mt-0.5">Today</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Overall: ₹{fmt(myStats?.sellReward.total || 0)}
                      </div>
                    </div>
                  </div>

                  {/* Agent Earning */}
                  <div className="rounded-xl p-3 flex items-center justify-between bg-amber-50 border border-amber-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                        <Star className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-amber-800">Agent Earning</div>
                        <div className="text-xs text-amber-600/70 mt-0.5">
                          {(user as any)?.isVerifiedAgent ? "Active Agent" : "Based on invitee activity"}
                        </div>
                      </div>
                    </div>
                    <div className="font-black text-base text-amber-800">
                      ₹{fmt(myStats?.agentEarning.total || 0)}
                    </div>
                  </div>

                  {/* Invite Earning */}
                  <div className="rounded-xl p-3 flex items-center justify-between bg-violet-50 border border-violet-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center shadow-sm">
                        <Gift className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-violet-800">Invite Earning (L1)</div>
                        <div className="text-xs text-violet-600/70 mt-0.5">1% per referred buyer trade</div>
                      </div>
                    </div>
                    <div className="font-black text-base text-violet-800">
                      ₹{fmt(inviteEarnings)}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="rounded-xl p-3 flex items-center justify-between bg-gradient-to-r from-orange-100 to-amber-100 border border-orange-200">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-orange-600" />
                      <span className="text-sm font-bold text-orange-800">Total Lifetime Earnings</span>
                    </div>
                    <div className="font-black text-base text-orange-800">
                      ₹{fmt(lifetimeTotal)}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Transaction History */}
        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">Transaction History</h3>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setHistoryTab("buy")}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                  historyTab === "buy"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm"
                    : "bg-orange-50 text-orange-700 border border-orange-100"
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5 inline mr-1.5" />
                Buy History
              </button>
              <button
                onClick={() => setHistoryTab("sell")}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                  historyTab === "sell"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm"
                    : "bg-orange-50 text-orange-700 border border-orange-100"
                }`}
              >
                <Banknote className="w-3.5 h-3.5 inline mr-1.5" />
                Sell History
              </button>
            </div>

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : historyTab === "buy" ? (
              !myStats?.buyOrders.length ? (
                <div className="text-center py-10 text-muted-foreground text-sm">No buy transactions yet</div>
              ) : (
                <div className="divide-y divide-orange-50">
                  {myStats.buyOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center">
                          <ShoppingCart className="w-4 h-4 text-orange-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">₹{fmt(parseFloat(o.amount))}</div>
                          <div className="text-xs text-muted-foreground">{timeAgo(o.createdAt)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-emerald-600 font-semibold text-sm">
                          +₹{fmt(parseFloat(o.rewardAmount || "0"))}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                          o.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {o.status === "confirmed" ? "Completed" : o.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              !myStats?.sellOrders.length ? (
                <div className="text-center py-10 text-muted-foreground text-sm">No sell transactions yet</div>
              ) : (
                <div className="divide-y divide-orange-50">
                  {myStats.sellOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center">
                          <Banknote className="w-4 h-4 text-violet-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">₹{fmt(parseFloat(o.amount))}</div>
                          <div className="text-xs text-muted-foreground">{timeAgo(o.createdAt)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        {parseFloat(o.sellRewardAmount || "0") > 0 && (
                          <div className="text-emerald-600 font-semibold text-sm">
                            +₹{fmt(parseFloat(o.sellRewardAmount))}
                          </div>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                          o.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {o.status === "confirmed" ? "Completed" : o.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
