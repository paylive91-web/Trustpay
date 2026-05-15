import React, { useEffect } from "react";
import { useGetMe, useGetAppSettings } from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Gift, Copy, Share2, Users, TrendingUp, IndianRupee,
  Award, Flame, Download, Sparkles, Star, ChevronRight,
  BarChart2, UserCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { API_BASE, assetUrl } from "@/lib/api-config";

export default function Invite() {
  const { toast } = useToast();
  const { data: user, isLoading } = useGetMe();
  const { data: appSettings } = useGetAppSettings();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const referralCode = (user as any)?.referralCode || "";
  const inviteEarnings   = Number((user as any)?.inviteEarnings   || 0);
  const inviteEarningsL2 = Number((user as any)?.inviteEarningsL2 || 0);
  const totalEarnings    = inviteEarnings + inviteEarningsL2;

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

  const { data: weeklyStats } = useQuery<{
    weekTotal: number;
    users: Array<{ id: number; name: string; weekBuy: number }>;
    weekStart: string;
  }>({
    queryKey: ["invite-weekly-stats"],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/p2p/invite-weekly-stats`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      return res.json();
    },
    enabled: !!user,
    staleTime: 60_000,
  });

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
      const a = document.createElement("a"); a.href = url; a.download = "trustpay-invite.jpg"; a.click();
      if (blob) setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: "Saving image", description: "Share it from your gallery" });
    } catch { toast({ title: "Save failed", variant: "destructive" }); }
  };
  const handleShare = async () => {
    const text = `Join TrustPay and start earning! Use my referral code: ${referralCode}\n${shareUrl}`;
    if (!navigator.share) { handleCopyLink(); return; }
    if (inviteShareImageUrl) {
      try {
        const blob = inviteShareImageUrl.startsWith("data:") ? dataUrlToBlob(inviteShareImageUrl) : await fetch(inviteShareImageUrl).then((r) => r.blob());
        const ext = blob.type.includes("png") ? "png" : "jpg";
        const file = new File([blob], `trustpay-invite.${ext}`, { type: blob.type || "image/jpeg" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ title: "Join TrustPay", text, files: [file] }); return; }
      } catch {}
    }
    try { await navigator.share({ title: "Join TrustPay", text }); } catch { handleCopyLink(); }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-48 w-full rounded-3xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <style>{`
        @keyframes slideDown{0%{opacity:0;transform:translateY(-18px);}100%{opacity:1;transform:translateY(0);}}
        @keyframes fadeUp{0%{opacity:0;transform:translateY(14px);}100%{opacity:1;transform:translateY(0);}}
        @keyframes floatGift{0%,100%{transform:translateY(0) scale(1);}50%{transform:translateY(-7px) scale(1.05);}}
        @keyframes shimmerOrange{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
        @keyframes pulseGlow{0%,100%{box-shadow:0 0 0 0 rgba(234,88,12,.35);}50%{box-shadow:0 0 0 10px rgba(234,88,12,0);}}
        .anim-hero{animation:slideDown .5s cubic-bezier(.22,1,.36,1) both;}
        .anim-cards{animation:fadeUp .5s cubic-bezier(.22,1,.36,1) .12s both;}
        .float-gift{animation:floatGift 2.8s ease-in-out infinite;}
        .shimmer-share{background:linear-gradient(105deg,#ea580c 0%,#f97316 30%,#fdba74 50%,#f97316 70%,#ea580c 100%);background-size:200% 100%;animation:shimmerOrange 2s linear infinite;}
        .pulse-glow{animation:pulseGlow 2.2s ease-in-out infinite;}
      `}</style>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden anim-hero" style={{background:"linear-gradient(145deg,#1e1b4b 0%,#312e81 45%,#4f46e5 100%)"}}>
        <div className="absolute inset-0 opacity-20" style={{backgroundImage:"radial-gradient(circle at 20% 50%,#f97316 0%,transparent 50%),radial-gradient(circle at 80% 20%,#fb923c 0%,transparent 40%)"}} />
        <div className="relative px-5 pt-10 pb-20 text-center">
          <div className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 text-white text-[11px] font-bold rounded-full px-3 py-1 mb-5">
            <Sparkles className="h-3 w-3 text-orange-300" /> EARN UP TO 1% COMMISSION
          </div>
          <div className="w-18 h-18 mx-auto mb-4 float-gift">
            <div className="w-[72px] h-[72px] mx-auto rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-2xl border-2 border-white/20">
              <Gift className="w-9 h-9 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-white mb-1.5 tracking-tight">Invite & Earn</h1>
          <p className="text-indigo-200 text-sm mb-6">Earn commissions every time your friends buy on TrustPay</p>
          <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
            <div className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm p-3 text-center">
              <div className="text-2xl font-black text-orange-300">1%</div>
              <div className="text-[11px] text-indigo-300 mt-0.5">Direct Invite (L1)</div>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm p-3 text-center">
              <div className="text-2xl font-black text-orange-300">0.1%</div>
              <div className="text-[11px] text-indigo-300 mt-0.5">2nd Level (L2)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-8 relative z-10 pb-8 space-y-4 anim-cards">

        {/* ── Earnings Summary ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1 rounded-2xl bg-white border border-slate-100 shadow-lg p-3.5 text-center">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-1">L1</div>
            <div className="text-lg font-black text-slate-900">₹{inviteEarnings.toFixed(2)}</div>
          </div>
          <div className="col-span-1 rounded-2xl bg-white border border-slate-100 shadow-lg p-3.5 text-center">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-1">L2</div>
            <div className="text-lg font-black text-slate-900">₹{inviteEarningsL2.toFixed(2)}</div>
          </div>
          <div className="col-span-1 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 shadow-lg p-3.5 text-center">
            <div className="text-[10px] text-orange-100 uppercase tracking-wide font-semibold mb-1">Total</div>
            <div className="text-lg font-black text-white">₹{totalEarnings.toFixed(2)}</div>
          </div>
        </div>

        {/* ── Referral Code ── */}
        <div className="rounded-3xl bg-white border border-slate-100 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase tracking-widest font-bold">Your Referral Code</span>
            <span className="flex items-center gap-1 text-[10px] font-black text-orange-400 bg-orange-400/10 border border-orange-400/20 px-2 py-0.5 rounded-full">
              <Star className="h-2.5 w-2.5 fill-orange-400" /> YOUR CODE
            </span>
          </div>
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-3xl font-black tracking-[.18em] text-slate-900">{referralCode}</div>
              <button onClick={handleCopyCode} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-orange-50 hover:border-orange-200 transition-colors">
                <Copy className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Button type="button" variant="outline" onClick={handleCopyLink} className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold">
                <Copy className="w-4 h-4 mr-2" /> Copy Link
              </Button>
              <Button type="button" onClick={handleShare} className="rounded-xl shimmer-share text-white border-none shadow-md font-semibold">
                <Share2 className="w-4 h-4 mr-2" /> Share
              </Button>
            </div>
          </div>
        </div>

        {/* ── How it Works ── */}
        <div className="rounded-3xl bg-white border border-slate-100 shadow-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-xl bg-orange-50 flex items-center justify-center">
              <ChevronRight className="w-4 h-4 text-orange-500" />
            </div>
            <span className="text-sm font-black text-slate-900">How it Works</span>
          </div>
          <div className="space-y-3">
            {[
              { n: "1", title: "Share your code", desc: "Send your referral code or link to friends", color: "from-orange-400 to-amber-400" },
              { n: "2", title: "Friend registers", desc: "They sign up using your referral code", color: "from-amber-400 to-yellow-400" },
              { n: "3", title: "Earn L1 commission", desc: "Get 1% of every buy your friend makes", color: "from-emerald-400 to-teal-400" },
              { n: "4", title: "Earn L2 commission", desc: "Get 0.1% from your friends' invited friends", color: "from-violet-400 to-fuchsia-400" },
            ].map((item) => (
              <div key={item.n} className="flex items-center gap-3">
                <div className={`w-8 h-8 bg-gradient-to-br ${item.color} rounded-full flex items-center justify-center shrink-0 text-sm font-black text-white shadow-sm`}>{item.n}</div>
                <div>
                  <div className="font-semibold text-sm text-slate-900">{item.title}</div>
                  <div className="text-xs text-slate-400">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Weekly Invite Buy Tracker ── */}
        <div className="rounded-3xl bg-white border border-slate-100 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-white" />
              <span className="text-sm font-black text-white">Weekly Invite Buy Tracker</span>
            </div>
            {weeklyStats?.weekStart && (
              <span className="text-[10px] text-orange-100 bg-white/15 border border-white/20 rounded-full px-2 py-0.5 font-semibold">
                From {weeklyStats.weekStart}
              </span>
            )}
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">This Week's Total</div>
                <div className="text-3xl font-black text-slate-900 mt-0.5">
                  ₹{Number(weeklyStats?.weekTotal || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400 font-semibold">Users tracked</div>
                <div className="text-2xl font-black text-orange-500">{weeklyStats?.users?.length || 0}</div>
              </div>
            </div>
            {weeklyStats?.users && weeklyStats.users.length > 0 ? (
              <div className="space-y-2.5">
                {weeklyStats.users.map((u, i) => {
                  const pct = weeklyStats.weekTotal > 0 ? Math.round((u.weekBuy / weeklyStats.weekTotal) * 100) : 0;
                  return (
                    <div key={u.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-black shrink-0 ${i === 0 ? "bg-gradient-to-br from-orange-400 to-red-500" : i === 1 ? "bg-gradient-to-br from-amber-400 to-orange-400" : "bg-slate-200 text-slate-600"}`}>{i + 1}</div>
                          <span className="font-semibold text-slate-700 truncate max-w-[130px]">{u.name}</span>
                        </div>
                        <span className="font-black text-slate-900">₹{Number(u.weekBuy).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-all duration-700" style={{ width: pct + "%" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-5 text-sm text-slate-400">No buy activity from invited users this week yet.</div>
            )}
            <div className="mt-3 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-[11px] text-blue-700 leading-snug">
              <span className="font-semibold">For Agents:</span> To claim your weekly reward, please contact support.
            </div>
          </div>
        </div>

        {/* ── Agent Criteria ── */}
        <div className="rounded-3xl bg-white border border-slate-100 shadow-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-xl bg-orange-50 flex items-center justify-center">
              <Award className="w-4 h-4 text-orange-500" />
            </div>
            <span className="text-sm font-black text-slate-900">Agent Criteria</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-2xl bg-orange-50 border border-orange-100 p-3 text-center">
              <div className="text-[10px] text-orange-600 uppercase font-semibold mb-1">Active today</div>
              <div className="text-2xl font-black text-orange-600 flex items-center justify-center gap-1">
                <Flame className="w-5 h-5" />{todayActiveCount}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Daily Reward</div>
              <div className="text-2xl font-black text-slate-800">₹{Number(currentDailyReward || 0).toFixed(0)}</div>
            </div>
          </div>
          {agentTiers.length > 0 && (
            <div className="space-y-2">
              {agentTiers.map((tier: any, idx: number) => {
                const isReached = todayActiveCount >= Number(tier.minActiveDeposits || 0);
                return (
                  <div key={idx} className={`rounded-xl border p-3 flex items-center justify-between ${isReached ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-100"}`}>
                    <div>
                      <div className="font-semibold text-sm text-slate-800">{tier.label || `Tier ${idx + 1}`}</div>
                      <div className="text-xs text-slate-400">{tier.minActiveDeposits}+ active invites today</div>
                    </div>
                    <div className={`text-sm font-black ${isReached ? "text-emerald-700" : "text-slate-400"}`}>₹{Number(tier.reward || 0).toFixed(0)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Invite Image ── */}
        {inviteShareImageUrl && (
          <div className="rounded-3xl bg-white border border-slate-100 shadow-lg p-4 space-y-3">
            <div className="text-sm font-black text-slate-900">Invite Image</div>
            <img src={inviteShareImageUrl} alt="Invite" className="w-full rounded-2xl object-cover max-h-64 shadow-sm" />
            <p className="text-xs text-slate-400 text-center">Save → share on WhatsApp / Telegram</p>
            <Button type="button" variant="outline" onClick={handleSaveImage} className="w-full rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50">
              <Download className="w-4 h-4 mr-2" /> Save Image to Gallery
            </Button>
          </div>
        )}

        {/* ── Invited Users ── */}
        <div className="rounded-3xl bg-white border border-slate-100 shadow-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-xl bg-orange-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-orange-500" />
            </div>
            <span className="text-sm font-black text-slate-900">Invited Users</span>
            <span className="ml-auto text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{invitees.length}</span>
          </div>
          {invitees.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <UserCheck className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-sm text-slate-400">No one has joined with your invite yet.</p>
              <p className="text-xs text-slate-300 mt-1">Share your code and start earning!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {invitees.map((u: any) => (
                <div key={u.id} className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white flex items-center justify-center shrink-0 text-sm font-black">
                        {(u.displayName || u.username || "U")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-slate-900 truncate">{u.displayName || u.username}</div>
                        <div className="text-[11px] text-slate-400">Joined with your code</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400">Commission</div>
                      <div className="text-sm font-black text-emerald-600">₹{Number(u.todayCommission || 0).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-white border border-slate-100 p-2 text-center">
                      <div className="text-[10px] text-slate-400 uppercase">Today</div>
                      <div className="text-xs font-bold text-slate-800">₹{Number(u.todayDeposits || 0).toFixed(0)}</div>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-100 p-2 text-center">
                      <div className="text-[10px] text-slate-400 uppercase">Total</div>
                      <div className="text-xs font-bold text-slate-800">₹{Number(u.totalDeposits || 0).toFixed(0)}</div>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-100 p-2 text-center">
                      <div className="text-[10px] text-slate-400 uppercase">Earned</div>
                      <div className="text-xs font-bold text-emerald-700">₹{Number(u.lifetimeCommission || 0).toFixed(0)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
