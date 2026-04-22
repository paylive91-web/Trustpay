import React from "react";
import { useGetMe, useGetAppSettings, useLogout } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { clearAuthToken } from "@/lib/auth";
import { Headset, LogOut, ChevronRight, TrendingUp, Wallet, ArrowDownCircle, ArrowUpCircle, Phone, Gift, Copy, ShieldCheck, Mail, Loader2, ShieldOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { getGoogleIdToken } from "@/lib/google-id";
import { getAuthToken } from "@/lib/auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

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
      }
    });
  };

  const handleContactSupport = () => {
    const link = (settings as any)?.telegramLink;
    if (link) {
      window.open(link, "_blank");
    } else {
      toast({ title: "Support link not available", variant: "destructive" });
    }
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
  const inviteEarningsL2 = (user as any)?.inviteEarningsL2 || 0;

  const stats = [
    {
      label: "Current Balance",
      value: `₹ ${user?.balance?.toFixed(2) || "0.00"}`,
      icon: <Wallet className="w-5 h-5 text-blue-500" />,
      color: "bg-blue-50 border-blue-100",
    },
    {
      label: "Total Deposited (Buy)",
      value: `₹ ${user?.totalDeposits?.toFixed(2) || "0.00"}`,
      icon: <ArrowDownCircle className="w-5 h-5 text-green-500" />,
      color: "bg-green-50 border-green-100",
    },
    {
      label: "Invite Earnings (L1)",
      value: `₹ ${inviteEarnings.toFixed(2)}`,
      icon: <Gift className="w-5 h-5 text-purple-500" />,
      color: "bg-purple-50 border-purple-100",
    },
    {
      label: "Total Withdrawn (Sell)",
      value: `₹ ${user?.totalWithdrawals?.toFixed(2) || "0.00"}`,
      icon: <ArrowUpCircle className="w-5 h-5 text-red-500" />,
      color: "bg-red-50 border-red-100",
    },
  ];

  return (
    <Layout>
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

      <div className="px-4 -mt-12 relative z-10 space-y-4">
        {(user as any)?.isFrozen && (
          <Card className="border-red-200 bg-red-50 shadow-md">
            <CardContent className="p-4 flex items-start gap-3">
              <ShieldOff className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 text-sm">Account Frozen</p>
                <p className="text-xs text-red-700 mt-0.5">
                  {(user as any)?.freezeReason
                    ? (user as any).freezeReason
                    : "Your account has been frozen by admin. Please contact support for details."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
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

        {/* Google Verification — bind a Gmail to enable self-serve forgot password */}
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
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleUnlink}
                  disabled={googleBusy}
                  data-testid="button-google-unlink"
                >
                  {googleBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Unlink Google
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleGoogleLink}
                  disabled={googleBusy}
                  data-testid="button-google-verify"
                >
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
