import React, { useState } from "react";
import { useGetMe, useGetAppSettings, useLogout } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import {
  Headset, LogOut, ChevronRight,
  Phone, Gift, Copy, Trophy, ShieldOff,
  ShieldCheck, Mail, Loader2, IndianRupee, Star,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { getGoogleIdToken } from "@/lib/google-id";
import { API_BASE } from "@/lib/api-config";

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Profile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetMe();
  const { data: settings } = useGetAppSettings();
  const logoutMutation = useLogout();

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
    const link = (settings as any)?.telegramSupportUrl || (settings as any)?.telegramLink;
    if (link) window.open(link, "_blank");
    else toast({ title: "Support link not available", variant: "destructive" });
  };

  const handleCopyReferral = () => {
    const code = (user as any)?.referralCode;
    if (code) { navigator.clipboard.writeText(code); toast({ title: "Referral code copied!" }); }
  };

  const [googleBusy, setGoogleBusy] = useState(false);
  const googleClientId = (settings as any)?.googleClientId as string | undefined;
  const googleVerified = !!(user as any)?.googleVerified;
  const linkedEmail = (user as any)?.email as string | undefined;

  const handleGoogleLink = async () => {
    if (!googleClientId) { toast({ title: "Google verification is not configured", variant: "destructive" }); return; }
    setGoogleBusy(true);
    try {
      const idToken = await getGoogleIdToken(googleClientId);
      const res = await fetch(`${API_BASE}/auth/google/link`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAuthToken() || ""}` }, body: JSON.stringify({ idToken }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      toast({ title: "Google verified!", description: data.email });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (err: any) {
      toast({ title: "Google verification failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally { setGoogleBusy(false); }
  };

  const handleGoogleUnlink = async () => {
    setGoogleBusy(true);
    try {
      const res = await fetch(`${API_BASE}/auth/google/unlink`, { method: "POST", headers: { Authorization: `Bearer ${getAuthToken() || ""}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      toast({ title: "Google unlinked" });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (err: any) {
      toast({ title: "Failed to unlink", description: err?.message || "Unknown error", variant: "destructive" });
    } finally { setGoogleBusy(false); }
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
  const trustScore = (user as any)?.trustScore ?? 0;
  const balance = user?.balance || 0;

  return (
    <Layout>
      {/* Hero header — orange-amber gradient matching home UPI card */}
      <div className="relative bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 pt-8 pb-20 px-4 border-b border-orange-200 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-300/20 rounded-full blur-2xl" />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-amber-300/20 rounded-full blur-xl" />
        <div className="relative flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-16 w-16 border-2 border-orange-300 shadow-lg">
              <AvatarFallback className="bg-gradient-to-br from-orange-400 to-rose-500 text-xl text-white font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
              <span className="text-[8px] text-white font-black">✓</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-900 truncate">{displayName}</h2>
            <div className="flex items-center gap-1 text-orange-700/70 text-sm mt-0.5">
              <Phone className="w-3 h-3" />
              <span>+91 {user?.phone || user?.username}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] bg-orange-200/60 text-orange-800 px-2 py-0.5 rounded-full font-medium">ID #{user?.id}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${trustScore >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                Trust {trustScore}
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
                <p className="text-xs text-red-700 mt-0.5">{(user as any)?.freezeReason || "Your account has been frozen by TrustPay. Please contact support."}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Balance hero card — like USDT page */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 ring-1 ring-amber-400/30 p-5 shadow-xl">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-orange-500/10 rounded-full blur-xl" />
          <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300/80 font-semibold mb-1">Current Balance</div>
          <div className="flex items-baseline gap-1">
            <IndianRupee className="h-6 w-6 text-amber-300" />
            <div className="text-3xl font-black text-amber-300">{fmt(balance)}</div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
              <div className="text-[10px] text-emerald-300/80 uppercase tracking-wide font-bold">Total Deposited</div>
              <div className="text-sm font-black text-white mt-0.5">₹{fmt(user?.totalDeposits || 0)}</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
              <div className="text-[10px] text-rose-300/80 uppercase tracking-wide font-bold">Total Withdrawn</div>
              <div className="text-sm font-black text-white mt-0.5">₹{fmt(user?.totalWithdrawals || 0)}</div>
            </div>
          </div>
        </div>

        {/* Rewards & Earnings link */}
        <div
          className="rounded-2xl shadow-lg cursor-pointer overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
          onClick={() => setLocation("/stats")}
        >
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/15 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="text-white font-bold text-sm">Rewards & Earnings</div>
                <div className="text-xs text-slate-500">Buy reward · Sell reward · Agent earning</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </div>
        </div>

        {/* Referral Code */}
        {(user as any)?.referralCode && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 border border-orange-200 p-4 shadow-sm">
            <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-400 to-rose-400 text-white text-[10px] font-black">
              <Star className="h-2.5 w-2.5" /> EARN
            </div>
            <div className="text-xs text-orange-700/70 mb-1 font-medium uppercase tracking-wide">Your Referral Code</div>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-black tracking-widest text-slate-900">{(user as any).referralCode}</div>
              <Button variant="outline" size="sm" onClick={handleCopyReferral} className="shrink-0 rounded-xl border-orange-200 text-orange-700 hover:bg-orange-100">
                <Copy className="w-4 h-4 mr-1" /> Copy
              </Button>
            </div>
          </div>
        )}

        {/* Google Verification */}
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className={`p-2 rounded-xl ${googleVerified ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900">Google Verification</div>
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
              <Button variant="outline" className="w-full rounded-xl" onClick={handleGoogleUnlink} disabled={googleBusy} data-testid="button-google-unlink">
                {googleBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Unlink Google
              </Button>
            ) : (
              <Button className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-none" onClick={handleGoogleLink} disabled={googleBusy || !googleClientId} data-testid="button-google-verify">
                {googleBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {googleClientId ? "Verify with Google" : "Loading…"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <Card className="border-none shadow-md overflow-hidden">
          <div className="divide-y divide-orange-50">
            <MenuItem icon={<Headset className="text-orange-500" />} label="Contact Support" onClick={handleContactSupport} />
            <MenuItem icon={<Gift className="text-amber-500" />} label="Invite & Earn" onClick={() => setLocation("/invite")} />
          </div>
        </Card>

        {/* Logout */}
        <Card className="border-none shadow-md">
          <div className="p-4">
            <Button variant="destructive" className="w-full rounded-xl" onClick={handleLogout} disabled={logoutMutation.isPending}>
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
    <div className="flex items-center justify-between p-4 hover:bg-orange-50/50 cursor-pointer transition-colors" onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className="bg-orange-50 border border-orange-100 p-2 rounded-xl">{icon}</div>
        <span className="font-medium text-sm text-slate-800">{label}</span>
      </div>
      <ChevronRight className="w-5 h-5 text-orange-300" />
    </div>
  );
}
