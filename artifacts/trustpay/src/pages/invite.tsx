import React, { useState } from "react";
import { useGetMe, useGetAppSettings } from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Gift, Copy, Share2, Users, TrendingUp, IndianRupee, ChevronRight, Headset } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";

export default function Invite() {
  const { toast } = useToast();
  const { data: user, isLoading } = useGetMe();
  const { data: settings } = useGetAppSettings();

  const referralCode = (user as any)?.referralCode || "";
  const inviteEarnings = (user as any)?.inviteEarnings || 0;
  const inviteEarningsL2 = (user as any)?.inviteEarningsL2 || 0;
  const totalEarnings = inviteEarnings + inviteEarningsL2;

  const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/register?ref=${referralCode}`;
  const { data: invitees = [] } = useQuery<any[]>({
    queryKey: ["invitees"],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/auth/invitees`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      return res.json();
    },
    enabled: !!user,
  });

  const handleCopyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    toast({ title: "Referral code copied!" });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Invite link copied!" });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join TrustPay",
          text: `Join TrustPay and start earning! Use my referral code: ${referralCode}`,
          url: shareUrl,
        });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 space-y-4 pb-24">
        {/* Hero */}
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground text-center">
          <div className="w-16 h-16 bg-primary-foreground/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gift className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Invite & Earn</h1>
          <p className="text-primary-foreground/80 text-sm">Earn commissions when your friends deposit</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-primary-foreground/10 rounded-xl p-3">
              <div className="text-2xl font-bold">1%</div>
              <div className="text-xs text-primary-foreground/70">Direct Invite (L1)</div>
            </div>
            <div className="bg-primary-foreground/10 rounded-xl p-3">
              <div className="text-2xl font-bold">0.1%</div>
              <div className="text-xs text-primary-foreground/70">2nd Level (L2)</div>
            </div>
          </div>
        </div>

        {/* Earnings Summary */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">L1 Earnings</div>
              <div className="text-xl font-bold text-primary flex items-center justify-center">
                <IndianRupee className="w-4 h-4 mr-0.5" />
                {inviteEarnings.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">L2 Earnings</div>
              <div className="text-xl font-bold text-purple-600 flex items-center justify-center">
                <IndianRupee className="w-4 h-4 mr-0.5" />
                {inviteEarningsL2.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {totalEarnings > 0 && (
          <Card className="border-none shadow-sm bg-green-50 border-green-100">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Total Commission Earned</div>
                <div className="text-2xl font-bold text-green-700 flex items-center">
                  <IndianRupee className="w-5 h-5 mr-0.5" />{totalEarnings.toFixed(2)}
                </div>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </CardContent>
          </Card>
        )}

        {/* Referral Code */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your Referral Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-muted rounded-xl p-4 flex items-center justify-between">
              <span className="text-2xl font-bold tracking-widest text-primary">{referralCode}</span>
              <Button variant="ghost" size="icon" onClick={handleCopyCode}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleCopyLink} className="rounded-xl">
                <Copy className="w-4 h-4 mr-2" /> Copy Link
              </Button>
              <Button onClick={handleShare} className="rounded-xl">
                <Share2 className="w-4 h-4 mr-2" /> Share
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">How it Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { step: "1", title: "Share your code", desc: "Share your referral code or link with friends" },
              { step: "2", title: "Friend registers", desc: "They sign up using your referral code" },
              { step: "3", title: "Earn commission", desc: "Get 1% of every deposit your friend makes (L1)" },
              { step: "4", title: "Earn more (L2)", desc: "Get 0.1% from deposits of friends invited by your friends" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                  {item.step}
                </div>
                <div>
                  <div className="font-medium text-sm">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Invited Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invitees.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">No one has joined with your invite yet.</div>
            ) : (
              invitees.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
                  <div>
                    <div className="font-medium text-sm">{u.displayName || u.username}</div>
                    <div className="text-xs text-muted-foreground">Joined with your code</div>
                  </div>
                  <Users className="w-4 h-4 text-primary" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <button
              className="w-full flex items-center justify-between"
              onClick={() => window.open((settings as any)?.telegramLink || "/support", "_blank")}
            >
              <div className="flex items-center gap-3">
                <div className="bg-muted p-2 rounded-lg"><Headset className="w-4 h-4" /></div>
                <div className="text-left">
                  <div className="font-medium text-sm">Contact Support</div>
                  <div className="text-xs text-muted-foreground">Open help link</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
