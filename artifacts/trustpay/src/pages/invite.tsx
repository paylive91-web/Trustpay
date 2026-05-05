import React from "react";
import { useGetMe, useGetAppSettings } from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Gift, Copy, Share2, Users, TrendingUp, IndianRupee, Award, Flame, Download, Sparkles, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { API_BASE, assetUrl } from "@/lib/api-config";

export default function Invite() {
  const { toast } = useToast();
  const { data: user, isLoading } = useGetMe();
  useGetAppSettings();

  const referralCode = (user as any)?.referralCode || "";
  const inviteEarnings = (user as any)?.inviteEarnings || 0;
  const inviteEarningsL2 = (user as any)?.inviteEarningsL2 || 0;
  const { data: invitees = [] } = useQuery<any[]>({
    queryKey: ["invitees"],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/auth/invitees`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      return res.json();
    },
    enabled: !!user,
  });
  const totalEarnings = inviteEarnings + inviteEarningsL2;
  const { data: appSettings } = useGetAppSettings();
  const agentTiers = Array.isArray((appSettings as any)?.agentTiers) ? (appSettings as any).agentTiers : [];
  const todayActiveCount = invitees.filter((u: any) => Number(u.todayDeposits || 0) > 0).length;
  const currentDailyReward = agentTiers
    .filter((tier: any) => todayActiveCount >= Number(tier.minActiveDeposits || 0))
    .reduce((sum: number, tier: any) => sum + Number(tier.reward || 0), 0);
  const inviteShareImageUrl = assetUrl((appSettings as any)?.inviteShareImageUrl);
  const shareUrl = `${window.location.origin}/register?ref=${referralCode}`;

  const handleCopyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    toast({ title: "Referral code copied!" });
  };
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Invite link copied!" });
  };
  const dataUrlToBlob = (dataUrl: string): Blob => {
    const [header, b64] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };
  const handleSaveImage = () => {
    if (!inviteShareImageUrl) return;
    try {
      const blob = inviteShareImageUrl.startsWith("data:") ? dataUrlToBlob(inviteShareImageUrl) : undefined;
      const url = blob ? URL.createObjectURL(blob) : inviteShareImageUrl;
      const a = document.createElement("a");
      a.href = url; a.download = "trustpay-invite.jpg"; a.click();
      if (blob) setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: "Saving image", description: "Once saved to gallery, you can share it" });
    } catch { toast({ title: "Save failed", variant: "destructive" }); }
  };
  const handleShare = async () => {
    const text = `Join TrustPay and start earning! 6% earning platform. Use my referral code: ${referralCode}\n${shareUrl}`;
    if (!navigator.share) { handleCopyLink(); return; }
    if (inviteShareImageUrl) {
      try {
        const blob = inviteShareImageUrl.startsWith("data:") ? dataUrlToBlob(inviteShareImageUrl) : await fetch(inviteShareImageUrl).then((r) => r.blob());
        const ext = blob.type.includes("png") ? "png" : "jpg";
        const file = new File([blob], `trustpay-invite.${ext}`, { type: blob.type || "image/jpeg" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ title: "Join TrustPay", text, files: [file] }); return;
        }
      } catch {}
    }
    try { await navigator.share({ title: "Join TrustPay", text }); } catch { handleCopyLink(); }
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
      {/* Hero — dark slate + amber (USDT page style) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 pt-8 pb-20">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl" />

        <div className="absolute top-4 right-4 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-400 to-rose-400 text-white text-[10px] font-black shadow-lg">
          <Sparkles className="h-2.5 w-2.5" /> EARN UP TO 1%
        </div>

        <div className="relative flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center mb-3 shadow-lg ring-2 ring-orange-300/30">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white mb-1">Invite & Earn</h1>
          <p className="text-slate-400 text-sm">Earn commissions when your friends deposit</p>
          <div className="mt-4 grid grid-cols-2 gap-3 w-full max-w-xs">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center">
              <div className="text-2xl font-black text-amber-300">1%</div>
              <div className="text-[11px] text-slate-400">Direct Invite (L1)</div>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center">
              <div className="text-2xl font-black text-amber-300">0.1%</div>
              <div className="text-[11px] text-slate-400">2nd Level (L2)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-10 relative z-10 space-y-4 pb-6">
        {/* Earnings summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 p-4 shadow-md">
            <div className="text-[10px] uppercase tracking-wide text-orange-700/70 font-bold mb-1">L1 Earnings</div>
            <div className="text-xl font-black text-slate-900 flex items-center">
              <IndianRupee className="w-4 h-4 mr-0.5 text-orange-500" />{inviteEarnings.toFixed(2)}
            </div>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 p-4 shadow-md">
            <div className="text-[10px] uppercase tracking-wide text-amber-700/70 font-bold mb-1">L2 Earnings</div>
            <div className="text-xl font-black text-slate-900 flex items-center">
              <IndianRupee className="w-4 h-4 mr-0.5 text-amber-500" />{inviteEarningsL2.toFixed(2)}
            </div>
          </div>
        </div>

        {totalEarnings > 0 && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] text-emerald-100/80 uppercase tracking-wide font-bold">Total Commission Earned</div>
                <div className="text-2xl font-black flex items-center mt-0.5">
                  <IndianRupee className="w-5 h-5 mr-0.5" />{totalEarnings.toFixed(2)}
                </div>
              </div>
              <TrendingUp className="w-10 h-10 text-emerald-200/50" />
            </div>
          </div>
        )}

        {/* Referral Code card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 border border-orange-200 p-4 shadow-md">
          <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-400 to-rose-400 text-white text-[10px] font-black">
            <Star className="h-2.5 w-2.5" /> YOUR CODE
          </div>
          <div className="text-[10px] text-orange-700/70 uppercase tracking-wide font-bold mb-2">Your Referral Code</div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-3xl font-black tracking-widest text-slate-900">{referralCode}</div>
            <Button variant="ghost" size="icon" onClick={handleCopyCode} className="text-orange-600 hover:bg-orange-100 rounded-xl">
              <Copy className="w-5 h-5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={handleCopyLink} className="rounded-xl border-orange-200 text-orange-700 hover:bg-orange-100">
              <Copy className="w-4 h-4 mr-2" /> Copy Link
            </Button>
            <Button type="button" onClick={handleShare} className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-none shadow-md">
              <Share2 className="w-4 h-4 mr-2" /> Share
            </Button>
          </div>
        </div>

        {/* Invite Image */}
        {inviteShareImageUrl && (
          <Card className="border-none shadow-md overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900">Invite Image</div>
              <img src={inviteShareImageUrl} alt="Invite" className="w-full rounded-xl object-cover max-h-64" />
              <p className="text-xs text-muted-foreground text-center">
                Save image → attach manually in WhatsApp/Telegram to share
              </p>
              <Button type="button" variant="outline" onClick={handleSaveImage} className="w-full rounded-xl border-orange-200 text-orange-700 hover:bg-orange-50">
                <Download className="w-4 h-4 mr-2" /> Save Image to Gallery
              </Button>
            </CardContent>
          </Card>
        )}

        {/* How it works */}
        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="font-semibold text-slate-900">How it Works</div>
            {[
              { step: "1", title: "Share your code", desc: "Share your referral code or link with friends", color: "from-orange-400 to-amber-400" },
              { step: "2", title: "Friend registers", desc: "They sign up using your referral code", color: "from-amber-400 to-yellow-400" },
              { step: "3", title: "Earn commission", desc: "Get 1% of every deposit your friend makes (L1)", color: "from-emerald-400 to-teal-400" },
              { step: "4", title: "Earn more (L2)", desc: "Get 0.1% from deposits of friends invited by your friends", color: "from-violet-400 to-fuchsia-400" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className={`w-8 h-8 bg-gradient-to-br ${item.color} rounded-full flex items-center justify-center shrink-0 text-sm font-black text-white shadow-sm`}>
                  {item.step}
                </div>
                <div className="pt-0.5">
                  <div className="font-semibold text-sm text-slate-900">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Agent Criteria */}
        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-orange-500" /> Agent Criteria
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-orange-50 border border-orange-100 p-3">
                <div className="text-xs text-muted-foreground">Today's active invite deposits</div>
                <div className="text-2xl font-black text-orange-600 flex items-center gap-1 mt-1">
                  <Flame className="w-5 h-5" />{todayActiveCount}
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
                <div className="text-xs text-muted-foreground">With today deposit</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">
                  {invitees.filter((u: any) => Number(u.todayDeposits || 0) > 0).length}
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 ring-1 ring-amber-400/30 p-4">
              <div className="text-[10px] text-amber-300/80 uppercase tracking-wide font-bold">
                Current daily reward at {todayActiveCount} active users
              </div>
              <div className="text-2xl font-black text-amber-300 mt-0.5">
                ₹{Number(currentDailyReward || 0).toFixed(2)}
              </div>
            </div>
            <div className="space-y-2">
              {agentTiers.length === 0 ? (
                <div className="text-sm text-muted-foreground">Agent reward criteria currently not configured.</div>
              ) : (
                agentTiers.map((tier: any, idx: number) => {
                  const isReached = todayActiveCount >= Number(tier.minActiveDeposits || 0);
                  return (
                    <div key={`${tier.minActiveDeposits}-${idx}`} className={`rounded-2xl border p-3 ${isReached ? "bg-emerald-50 border-emerald-200" : "bg-white border-orange-100"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-sm">{tier.label || `Tier ${idx + 1}`}</div>
                          <div className="text-xs text-muted-foreground">{tier.minActiveDeposits}+ active invite deposits today</div>
                        </div>
                        <div className={`text-sm font-black ${isReached ? "text-emerald-700" : "text-orange-700"}`}>
                          ₹{Number(tier.reward || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Invited Users */}
        <Card className="border-none shadow-md">
          <CardContent className="p-4 space-y-3">
            <div className="font-semibold text-slate-900">Invited Users ({invitees.length})</div>
            {invitees.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-7 h-7 text-orange-300" />
                </div>
                <p className="text-sm text-muted-foreground">No one has joined with your invite yet.</p>
              </div>
            ) : (
              invitees.map((u: any) => (
                <div key={u.id} className="rounded-2xl border border-orange-100 bg-orange-50/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 text-white flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{u.displayName || u.username}</div>
                        <div className="text-[11px] text-muted-foreground">Joined with your code</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Today commission</div>
                      <div className="text-sm font-black text-emerald-600">₹{Number(u.todayCommission || 0).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-orange-100/60 p-2 text-center">
                      <div className="text-[10px] text-orange-700 uppercase">Today</div>
                      <div className="text-xs font-bold text-orange-800">₹{Number(u.todayDeposits || 0).toFixed(2)}</div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-2 text-center">
                      <div className="text-[10px] text-emerald-700 uppercase">Total</div>
                      <div className="text-xs font-bold text-emerald-800">₹{Number(u.totalDeposits || 0).toFixed(2)}</div>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-2 text-center">
                      <div className="text-[10px] text-amber-700 uppercase">Commission</div>
                      <div className="text-xs font-bold text-amber-800">₹{Number(u.lifetimeCommission || 0).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
