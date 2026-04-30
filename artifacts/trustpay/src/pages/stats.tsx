import { useState, useEffect } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Trophy, Star, Gift, Zap, ShoppingCart, Banknote, ChevronDown, ChevronUp,
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
      {/* Dark header */}
      <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", paddingBottom: 24 }}>
        {/* Top nav */}
        <div className="flex items-center gap-3 px-4 pt-10 pb-4">
          <button
            onClick={() => setLocation("/profile")}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-white font-bold text-lg">Rewards & Stats</h1>
        </div>

        {/* Summary card */}
        <div className="mx-4 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 6 }}>Total Lifetime Earnings</div>
          <div style={{ color: "#f59e0b", fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>
            ₹ {fmt(lifetimeTotal)}
          </div>
          <div className="flex gap-5 mt-3">
            <div>
              <div style={{ color: "#475569", fontSize: 11 }}>Today</div>
              <div style={{ color: "#fbbf24", fontSize: 16, fontWeight: 700 }}>₹ {fmt(todayRewards)}</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
            <div>
              <div style={{ color: "#475569", fontSize: 11 }}>Agent</div>
              <div style={{ color: "#94a3b8", fontSize: 16, fontWeight: 700 }}>₹ {fmt(myStats?.agentEarning.total || 0)}</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
            <div>
              <div style={{ color: "#475569", fontSize: 11 }}>Invite</div>
              <div style={{ color: "#a855f7", fontSize: 16, fontWeight: 700 }}>₹ {fmt(inviteEarnings)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-4">
        {/* Reward breakdown */}
        <div className="rounded-2xl overflow-hidden shadow-md" style={{ background: "#0f172a" }}>
          <button
            className="w-full flex items-center justify-between p-4"
            onClick={() => setShowRewardDetail(!showRewardDetail)}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
                <Trophy className="w-5 h-5" style={{ color: "#f59e0b" }} />
              </div>
              <span className="text-white font-semibold text-sm">Reward Breakdown</span>
            </div>
            {showRewardDetail
              ? <ChevronUp className="w-4 h-4" style={{ color: "#475569" }} />
              : <ChevronDown className="w-4 h-4" style={{ color: "#475569" }} />}
          </button>

          {showRewardDetail && (
            <div className="px-4 pb-4 space-y-3">
              <div style={{ height: 1, background: "#1e293b", marginBottom: 8 }} />

              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-xl" style={{ background: "#1e293b" }} />
                  <Skeleton className="h-16 w-full rounded-xl" style={{ background: "#1e293b" }} />
                </div>
              ) : (
                <>
                  {/* Buy + Sell reward cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-3" style={{ background: "#0d1829", border: "1px solid #1e3a5f" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <ShoppingCart className="w-4 h-4" style={{ color: "#3b82f6" }} />
                        <span className="text-xs font-medium" style={{ color: "#64748b" }}>Buy Reward</span>
                      </div>
                      <div className="font-bold text-base" style={{ color: "#fbbf24" }}>
                        ₹ {fmt(myStats?.buyReward.today || 0)}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "#475569" }}>Today</div>
                      <div className="text-xs mt-1" style={{ color: "#334155" }}>
                        Overall: ₹ {fmt(myStats?.buyReward.total || 0)}
                      </div>
                    </div>

                    <div className="rounded-xl p-3" style={{ background: "#0d1f1a", border: "1px solid #14532d" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Banknote className="w-4 h-4" style={{ color: "#22c55e" }} />
                        <span className="text-xs font-medium" style={{ color: "#64748b" }}>Sell Reward</span>
                      </div>
                      <div className="font-bold text-base" style={{ color: "#fbbf24" }}>
                        ₹ {fmt(myStats?.sellReward.today || 0)}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "#475569" }}>Today</div>
                      <div className="text-xs mt-1" style={{ color: "#334155" }}>
                        Overall: ₹ {fmt(myStats?.sellReward.total || 0)}
                      </div>
                    </div>
                  </div>

                  {/* Agent Earning */}
                  <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "#12101f", border: "1px solid #312e81" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                        <Star className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-xs font-medium" style={{ color: "#94a3b8" }}>Agent Earning</div>
                        <div className="text-xs mt-0.5" style={{ color: "#475569" }}>
                          {(user as any)?.isVerifiedAgent ? "Active Agent" : "Based on invitee activity"}
                        </div>
                      </div>
                    </div>
                    <div className="font-bold text-lg" style={{ color: "#e2e8f0" }}>
                      ₹ {fmt(myStats?.agentEarning.total || 0)}
                    </div>
                  </div>

                  {/* Invite Earning */}
                  <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "#1a0a2e", border: "1px solid #4c1d95" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(168,85,247,0.2)" }}>
                        <Gift className="w-5 h-5" style={{ color: "#a855f7" }} />
                      </div>
                      <div>
                        <div className="text-xs font-medium" style={{ color: "#94a3b8" }}>Invite Earning (L1)</div>
                        <div className="text-xs mt-0.5" style={{ color: "#475569" }}>1% per referred buyer trade</div>
                      </div>
                    </div>
                    <div className="font-bold text-lg" style={{ color: "#a855f7" }}>
                      ₹ {fmt(inviteEarnings)}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" style={{ color: "#f59e0b" }} />
                      <span className="text-sm font-semibold" style={{ color: "#f59e0b" }}>Total Lifetime Earnings</span>
                    </div>
                    <div className="font-bold text-base" style={{ color: "#f59e0b" }}>
                      ₹ {fmt(lifetimeTotal)}
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
                  historyTab === "buy" ? "bg-primary text-white shadow-sm" : "bg-muted text-muted-foreground"
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5 inline mr-1.5" />
                Buy History
              </button>
              <button
                onClick={() => setHistoryTab("sell")}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                  historyTab === "sell" ? "bg-primary text-white shadow-sm" : "bg-muted text-muted-foreground"
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
                <div className="divide-y">
                  {myStats.buyOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                          <ShoppingCart className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">₹ {fmt(parseFloat(o.amount))}</div>
                          <div className="text-xs text-muted-foreground">{timeAgo(o.createdAt)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-600 font-semibold text-sm">
                          +₹ {fmt(parseFloat(o.rewardAmount || "0"))}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                          o.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
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
                <div className="divide-y">
                  {myStats.sellOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                          <Banknote className="w-4 h-4 text-red-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">₹ {fmt(parseFloat(o.amount))}</div>
                          <div className="text-xs text-muted-foreground">{timeAgo(o.createdAt)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        {parseFloat(o.sellRewardAmount || "0") > 0 && (
                          <div className="text-green-600 font-semibold text-sm">
                            +₹ {fmt(parseFloat(o.sellRewardAmount))}
                          </div>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                          o.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
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
