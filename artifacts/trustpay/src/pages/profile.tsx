import React, { useState, useEffect } from "react";
import { useGetMe, useGetAppSettings, useLogout } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { clearAuthToken } from "@/lib/auth";
import {
  Headset, LogOut, ChevronRight, TrendingUp, Wallet, ArrowDownCircle,
  ArrowUpCircle, Phone, Gift, Copy, ShieldCheck, Mail, Loader2, ShieldOff,
  Trophy, Star, Zap, ChevronDown, ChevronUp, ShoppingCart, Banknote,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { getGoogleIdToken } from "@/lib/google-id";
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

export default function Profile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetMe();
  const { data: settings } = useGetAppSettings();
  const logoutMutation = useLogout();

  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [historyTab, setHistoryTab] = useState<"buy" | "sell">("buy");

  useEffect(() => {
    if (!user) return;
    setStatsLoading(true);
    fetch(`${API_BASE}/p2p/my-stats`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    })
      .then((r) => r.json())
      .then((d) => setMyStats(d))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [user]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        clearAuthToken();
        localStorage.removeItem("popup_seen_session");
        queryClient.clear();
        toast({ title: "Logged out successfully" });
        setLocation("/login");
      },
    });
  };

  const handleContactSupport = () => {
    const link = (settings as any)?.telegramLink;
    if (link) window.open(link, "_blank");
    else toast({ title: "Support link not available", variant: "destructive" });
  };

  const [googleBusy, setGoogleBusy] = useState(false);
  const googleClientId = (settings as any)?.googleClientId as string | undefined;
  const googleVerified = !!(user as any)?.googleVerified;
  const linkedEmail = (user as any)?.email as string | null | undefined;

  const handleGoogleLink = async () => {
    if (!googleClientId) {
      toast({ title: "Google verification configured nahi hai", variant: "destructive" });
      return;
    }
    setGoogleBusy(true);
    try {
      const idToken = await getGoogleIdToken(googleClientId);
      const res = await fetch(`${API_BASE}/auth/google/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      toast({ title: "Google verified!", description: data.email });
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast({ title: "Google verification failed", description: err.message, variant: "destructive" });
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleGoogleUnlink = async () => {
    setGoogleBusy(true);
    try {
      const res = await fetch(`${API_BASE}/auth/google/unlink`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error("Unlink failed");
      toast({ title: "Google unlinked" });
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleCopyReferral = () => {
    const code = (user as any)?.referralCode;
    if (code) {
      navigator.clipboard.writeText(code);
      toast({ title: "Referral code copied!" });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  const displayName = user?.phone || user?.username || "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const inviteEarnings = (user as any)?.inviteEarnings || 0;

  const totalRewards = (myStats?.buyReward.total || 0) + (myStats?.sellReward.total || 0) + (myStats?.agentEarning.total || 0);
  const todayRewards = (myStats?.buyReward.today || 0) + (myStats?.sellReward.today || 0);

  const stats = [
    {
      label: "Current Balance",
      value: `₹ ${fmt(user?.balance || 0)}`,
      icon: <Wallet className="w-5 h-5 text-blue-500" />,
      color: "bg-blue-50 border-blue-100",
    },
    {
      label: "Total Deposited (Buy)",
      value: `₹ ${fmt(user?.totalDeposits || 0)}`,
      icon: <ArrowDownCircle className="w-5 h-5 text-green-500" />,
      color: "bg-green-50 border-green-100",
    },
    {
      label: "Invite Earnings (L1)",
      value: `₹ ${fmt(inviteEarnings)}`,
      icon: <Gift className="w-5 h-5 text-purple-500" />,
      color: "bg-purple-50 border-purple-100",
    },
    {
      label: "Total Withdrawn (Sell)",
      value: `₹ ${fmt(user?.totalWithdrawals || 0)}`,
      icon: <ArrowUpCircle className="w-5 h-5 text-red-500" />,
      color: "bg-red-50 border-red-100",
    },
  ];

  return (
    <Layout>
      {/* Header */}
      <div className="bg-gradient-to-br from-primary via-primary to-sky-700 pt-10 pb-20 px-4 text-primary-foreground">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary-foreground/30 shadow-lg">
            <AvatarFallback className="bg-primary-foreground/10 text-xl text-white font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">{displayName}</h2>
            <div className="flex items-center gap-1 text-primary-foreground/80 text-sm mt-1">
              <Phone className="w-3 h-3" />
              <span>+91 {user?.phone || user?.username}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] bg-primary-foreground/15 px-2 py-0.5 rounded-full">ID #{user?.id}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${(user as any)?.trustScore >= 0 ? "bg-green-500/30" : "bg-red-500/40"}`}>
                Trust {(user as any)?.trustScore ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-12 relative z-10 space-y-4 pb-6">
        {/* Frozen warning */}
        {(user as any)?.isFrozen && (
          <Card className="border-red-200 bg-red-50 shadow-md">
            <CardContent className="p-4 flex items-start gap-3">
              <ShieldOff className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 text-sm">Account Frozen</p>
                <p className="text-xs text-red-700 mt-0.5">
                  {(user as any)?.freezeReason || "Your account has been frozen by admin. Please contact support."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Account Statistics */}
        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">Account Statistics</h3>
            <div className="grid grid-cols-2 gap-3">
              {stats.map((stat, i) => (
                <div key={i} className={`rounded-xl p-3 border ${stat.color}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {stat.icon}
                    <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                  </div>
                  <div className="text-lg font-bold">{stat.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ─── REWARDS SECTION (Dark theme) ─── */}
        <div
          className="rounded-2xl overflow-hidden shadow-lg cursor-pointer"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
          onClick={() => setShowRewards(!showRewards)}
        >
          {/* Header row — always visible */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
                <Trophy className="w-5 h-5" style={{ color: "#f59e0b" }} />
              </div>
              <div>
                <div className="text-white font-bold text-sm">Rewards & Earnings</div>
                <div className="text-xs" style={{ color: "#64748b" }}>
                  Today: <span style={{ color: "#fbbf24" }}>₹ {fmt(todayRewards)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs" style={{ color: "#64748b" }}>Total Earned</div>
                <div className="font-bold text-base" style={{ color: "#f59e0b" }}>₹ {fmt(totalRewards)}</div>
              </div>
              {showRewards
                ? <ChevronUp className="w-5 h-5" style={{ color: "#475569" }} />
                : <ChevronDown className="w-5 h-5" style={{ color: "#475569" }} />
              }
            </div>
          </div>

          {/* Expanded content */}
          {showRewards && (
            <div className="px-4 pb-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              <div style={{ height: 1, background: "#1e293b", marginBottom: 4 }} />

              {statsLoading ? (
                <div className="text-center py-4" style={{ color: "#475569" }}>Loading...</div>
              ) : (
                <>
                  {/* Today Rewards — 2 cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-3" style={{ background: "#0d1829", border: "1px solid #1e3a5f" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <ShoppingCart className="w-4 h-4" style={{ color: "#3b82f6" }} />
                        <span className="text-xs font-medium" style={{ color: "#64748b" }}>Buy Reward</span>
                      </div>
                      <div className="font-bold text-base" style={{ color: "#fbbf24" }}>
                        ₹ {fmt(myStats?.buyReward.today || 0)}
                      </div>
                      <div className="text-xs mt-1" style={{ color: "#475569" }}>
                        Today
                      </div>
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
                      <div className="text-xs mt-1" style={{ color: "#475569" }}>
                        Today
                      </div>
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

                  {/* Invite Earnings breakdown */}
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

                  {/* Total summary row */}
                  <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" style={{ color: "#f59e0b" }} />
                      <span className="text-sm font-semibold" style={{ color: "#f59e0b" }}>Total Lifetime Earnings</span>
                    </div>
                    <div className="font-bold text-base" style={{ color: "#f59e0b" }}>
                      ₹ {fmt(totalRewards + inviteEarnings)}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ─── BUY / SELL HISTORY ─── */}
        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">Transaction History</h3>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setHistoryTab("buy")}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                  historyTab === "buy"
                    ? "bg-primary text-white shadow-sm"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5 inline mr-1.5" />
                Buy History
              </button>
              <button
                onClick={() => setHistoryTab("sell")}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                  historyTab === "sell"
                    ? "bg-primary text-white shadow-sm"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Banknote className="w-3.5 h-3.5 inline mr-1.5" />
                Sell History
              </button>
            </div>

            {/* Content */}
            {statsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : historyTab === "buy" ? (
              myStats?.buyOrders.length === 0 || !myStats ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No buy transactions yet</div>
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
                        <div className={`text-xs px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                          o.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {o.status === "confirmed" ? "Completed" : o.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              myStats?.sellOrders.length === 0 || !myStats ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No sell transactions yet</div>
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
                        <div className={`text-xs px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                          o.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {o.status === "confirmed" ? "Completed" : o.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Referral Code */}
        {(user as any)?.referralCode && (
          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Your Referral Code</div>
                  <div className="text-xl font-bold tracking-widest text-primary">{(user as any).referralCode}</div>
                </div>
                <Button variant="outline" size="sm" onClick={handleCopyReferral} className="shrink-0">
                  <Copy className="w-4 h-4 mr-1" /> Copy
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Google Verification */}
        {googleClientId && (
          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className={`p-2 rounded-lg ${googleVerified ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">Google Verification</div>
                  {googleVerified ? (
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 shrink-0" />
                      <span className="truncate">{linkedEmail || "Linked"}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Apna Gmail bind karein — bhulne par password reset kar payenge.
                    </div>
                  )}
                </div>
              </div>
              {googleVerified ? (
                <Button variant="outline" className="w-full" onClick={handleGoogleUnlink} disabled={googleBusy} data-testid="button-google-unlink">
                  {googleBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Unlink Google
                </Button>
              ) : (
                <Button className="w-full" onClick={handleGoogleLink} disabled={googleBusy} data-testid="button-google-verify">
                  {googleBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Verify with Google
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-none shadow-md overflow-hidden">
          <div className="divide-y">
            <MenuItem icon={<Headset className="text-blue-500" />} label="Contact Support" onClick={handleContactSupport} />
            <MenuItem icon={<Gift className="text-purple-500" />} label="Invite & Earn" onClick={() => setLocation("/invite")} />
          </div>
        </Card>

        <Card className="border-none shadow-md">
          <div className="p-4">
            <Button
              variant="destructive"
              className="w-full rounded-xl"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {logoutMutation.isPending ? "Logging out..." : "Log Out"}
            </Button>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <div
      className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="bg-muted p-2 rounded-lg">{icon}</div>
        <span className="font-medium text-sm">{label}</span>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </div>
  );
}
