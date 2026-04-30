import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGetMe, useGetAppSettings } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import Layout from "@/components/layout";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, BookOpen, Clock, ShieldCheck, BellRing, CheckCircle2, Loader2,
  Pencil, Radio, Wallet, User as UserIcon, Sparkles, Wifi, WifiOff, Headset, ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { playLoudAlarm } from "@/lib/alarm";

import { API_BASE } from "@/lib/api-config";

async function api(path: string, opts: RequestInit = {}) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function fmtCountdown(ms: number) {
  if (ms <= 0) return "00:00";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const STATUS_COLOR: Record<string, string> = {
  available: "bg-blue-100 text-blue-700",
  locked: "bg-amber-100 text-amber-700",
  pending_confirmation: "bg-orange-100 text-orange-700",
  confirmed: "bg-green-100 text-green-700",
  disputed: "bg-red-100 text-red-700",
};

export default function Sell() {
  const [, setLocation] = useLocation();
  const { data: user, isError, isLoading: userLoading, refetch: refetchMe } = useGetMe({ query: { queryKey: ["me"], retry: false } });
  const { data: settings } = useGetAppSettings();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());

  // 1-second tick drives the matching countdown.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const { data: matching, refetch: refetchMatching } = useQuery<any>({
    queryKey: ["matching-status"],
    queryFn: () => api("/p2p/matching-status"),
    enabled: !!user,
    refetchInterval: 3000,
  });
  const { data: chunks = [], refetch: refetchChunks } = useQuery<any[]>({
    queryKey: ["my-chunks"], queryFn: () => api("/p2p/my-chunks"), enabled: !!user, refetchInterval: 5000,
  });
  const { data: pendingConfirms = [], refetch: refetchPending } = useQuery<any[]>({
    queryKey: ["pending-confirms"], queryFn: () => api("/p2p/my-pending-confirmations"), enabled: !!user, refetchInterval: 4000,
  });

  // Compute isMatching early so Wake Lock hooks can reference it
  const expiresAtEarly = matching?.matchingExpiresAt ? new Date(matching.matchingExpiresAt).getTime() : 0;
  const remainingEarly = expiresAtEarly - now;
  const isMatchingEarly = !!matching?.isActive && remainingEarly > 0;

  useEffect(() => { if (isError) setLocation("/login"); }, [isError, setLocation]);

  useEffect(() => {
    const handler = () => { refetchMatching(); refetchChunks(); };
    window.addEventListener("matching-stopped", handler);
    return () => window.removeEventListener("matching-stopped", handler);
  }, []);
  // Wake Lock — prevent screen sleep when matching is active
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    if (!isMatchingEarly) {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      return;
    }
    if ("wakeLock" in navigator) {
      (navigator as any).wakeLock.request("screen").then((wl: WakeLockSentinel) => {
        wakeLockRef.current = wl;
      }).catch(() => {});
    }
    return () => {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [isMatchingEarly]);

  // Re-acquire Wake Lock when page becomes visible again (OS releases it on hide)
  useEffect(() => {
    const onVisible = () => {
      if (isMatchingEarly && "wakeLock" in navigator && (!wakeLockRef.current || wakeLockRef.current.released)) {
        (navigator as any).wakeLock.request("screen").then((wl: WakeLockSentinel) => {
          wakeLockRef.current = wl;
        }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isMatchingEarly]);

  // Sound when a new lock or pending-confirmation arrives.
  const prevLocked = useRef(0);
  const prevPending = useRef(0);
  useEffect(() => {
    const locked = matching?.locked || 0;
    if (locked > prevLocked.current) playLoudAlarm();
    prevLocked.current = locked;
  }, [matching?.locked]);
  useEffect(() => {
    if (pendingConfirms.length > prevPending.current) playLoudAlarm();
    prevPending.current = pendingConfirms.length;
  }, [pendingConfirms.length]);

  const startMut = useMutation({
    mutationFn: () => api("/p2p/start-matching", { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Matching started", description: "Stay online for the next 15 minutes." });
      refetchMatching(); refetchChunks(); refetchMe();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const stopMut = useMutation({
    mutationFn: () => api("/p2p/stop-matching", { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Matching stopped" });
      refetchMatching(); refetchChunks(); refetchMe();
    },
  });

  if (userLoading) return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </Layout>
  );

  if (!user) return null;

  const expiresAt = matching?.matchingExpiresAt ? new Date(matching.matchingExpiresAt).getTime() : 0;
  const remaining = expiresAt - now;
  const isMatching = !!matching?.isActive && remaining > 0;
  const trustScore = (user as any).trustScore ?? 0;
  const isFrozen = (user as any).isFrozen;
  const heldBalance = (user as any).heldBalance ?? 0;
  const balance = Number((user as any).balance ?? 0);
  const sellRewardPct = Math.max(0, parseFloat((settings as any)?.sellRewardPercent) || 0);

  return (
    <Layout>
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-secondary via-secondary to-primary text-white">
        <Link href="/"><ArrowLeft className="cursor-pointer" /></Link>
        <span className="font-bold text-lg flex-1">Sell — Matching</span>
      </div>
      {isFrozen && (
        <div className="px-4 pt-3">
          <Card className="border-red-400 bg-red-50">
            <CardContent className="p-3 text-sm text-red-700">
              Account frozen — sells paused.{" "}
              <button
                className="underline font-semibold"
                onClick={() => window.open((settings as any)?.supportLink || "/support", "_blank")}
              >
                Contact Support
              </button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Premium matching hero */}
        <Card className="overflow-hidden border-none shadow-2xl text-white" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 35%, #7c3aed 65%, #c026d3 100%)" }}>
          <CardContent className="p-0">
            {/* Animated background grid */}
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />

              <div className="p-5 relative z-10">
                {isMatching ? (
                  /* ── LIVE matching state ── */
                  <div>
                    {/* Top bar */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2 bg-emerald-400/20 border border-emerald-400/40 rounded-full px-3 py-1">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                        </span>
                        <span className="text-xs font-black tracking-widest text-emerald-300 uppercase">You're Live</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-white/60 uppercase tracking-wider">Time left</div>
                        <div className="font-mono text-xl font-black text-white">{fmtCountdown(remaining)}</div>
                      </div>
                    </div>

                    {/* Central radar animation */}
                    <>
                      <style>{`
                        @keyframes radarSweep{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
                        @keyframes orbit-a{from{transform:rotate(0deg) translateX(52px) rotate(0deg)}to{transform:rotate(360deg) translateX(52px) rotate(-360deg)}}
                        @keyframes orbit-b{from{transform:rotate(120deg) translateX(70px) rotate(-120deg)}to{transform:rotate(480deg) translateX(70px) rotate(-480deg)}}
                        @keyframes orbit-c{from{transform:rotate(240deg) translateX(44px) rotate(-240deg)}to{transform:rotate(600deg) translateX(44px) rotate(-600deg)}}
                        @keyframes orbit-d{from{transform:rotate(60deg) translateX(63px) rotate(-60deg)}to{transform:rotate(420deg) translateX(63px) rotate(-420deg)}}
                        @keyframes corePulse{0%,100%{box-shadow:0 0 18px 7px rgba(139,92,246,0.55),0 0 36px 14px rgba(139,92,246,0.22)}50%{box-shadow:0 0 28px 12px rgba(139,92,246,0.8),0 0 56px 24px rgba(139,92,246,0.38)}}
                        @keyframes dpGreen{0%,100%{box-shadow:0 0 7px 2px rgba(52,211,153,0.7),0 0 14px 5px rgba(52,211,153,0.3)}50%{box-shadow:0 0 12px 5px rgba(52,211,153,1),0 0 24px 10px rgba(52,211,153,0.5)}}
                        @keyframes dpSky{0%,100%{box-shadow:0 0 7px 2px rgba(56,189,248,0.7),0 0 14px 5px rgba(56,189,248,0.3)}50%{box-shadow:0 0 12px 5px rgba(56,189,248,1),0 0 24px 10px rgba(56,189,248,0.5)}}
                        @keyframes dpFuchsia{0%,100%{box-shadow:0 0 7px 2px rgba(232,121,249,0.7),0 0 14px 5px rgba(232,121,249,0.3)}50%{box-shadow:0 0 12px 5px rgba(232,121,249,1),0 0 24px 10px rgba(232,121,249,0.5)}}
                        @keyframes dpYellow{0%,100%{box-shadow:0 0 7px 2px rgba(250,204,21,0.7),0 0 14px 5px rgba(250,204,21,0.3)}50%{box-shadow:0 0 12px 5px rgba(250,204,21,1),0 0 24px 10px rgba(250,204,21,0.5)}}
                      `}</style>
                      <div className="flex justify-center mb-5">
                        <div className="relative flex items-center justify-center" style={{ width: 204, height: 204 }}>
                          {/* SVG radar grid */}
                          <svg className="absolute inset-0" width="204" height="204" style={{ overflow: "visible" }}>
                            <defs>
                              <radialGradient id="rgFade" cx="50%" cy="50%" r="50%">
                                <stop offset="60%" stopColor="rgba(255,255,255,0)" />
                                <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
                              </radialGradient>
                            </defs>
                            <circle cx="102" cy="102" r="92" fill="url(#rgFade)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
                            <circle cx="102" cy="102" r="66" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.75" />
                            <circle cx="102" cy="102" r="40" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.75" />
                            <line x1="102" y1="6" x2="102" y2="198" stroke="rgba(255,255,255,0.07)" strokeWidth="0.75" />
                            <line x1="6" y1="102" x2="198" y2="102" stroke="rgba(255,255,255,0.07)" strokeWidth="0.75" />
                            <line x1="28" y1="28" x2="176" y2="176" stroke="rgba(255,255,255,0.04)" strokeWidth="0.6" />
                            <line x1="176" y1="28" x2="28" y2="176" stroke="rgba(255,255,255,0.04)" strokeWidth="0.6" />
                            {[0,30,60,90,120,150,180,210,240,270,300,330].map(a => {
                              const r = (a - 90) * Math.PI / 180;
                              return <line key={a} x1={102 + 87*Math.cos(r)} y1={102 + 87*Math.sin(r)} x2={102 + 92*Math.cos(r)} y2={102 + 92*Math.sin(r)} stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" strokeLinecap="round" />;
                            })}
                          </svg>

                          {/* Sweep gradient layer */}
                          <div className="absolute rounded-full overflow-hidden" style={{ width: 184, height: 184, animation: "radarSweep 3s linear infinite" }}>
                            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "conic-gradient(from 0deg, transparent 0deg, rgba(52,211,153,0.7) 4deg, rgba(52,211,153,0.35) 35deg, rgba(52,211,153,0.08) 75deg, transparent 75deg)" }} />
                          </div>
                          {/* Sweep arm */}
                          <div className="absolute" style={{ width: 184, height: 184, animation: "radarSweep 3s linear infinite" }}>
                            <div style={{ position: "absolute", top: "50%", left: "50%", width: "50%", height: "1.5px", transformOrigin: "left center", background: "linear-gradient(to right, rgba(52,211,153,0.95), rgba(52,211,153,0.2), transparent)", borderRadius: 2 }} />
                          </div>

                          {/* Orbiting buyer dots */}
                          <div className="absolute" style={{ top:"50%", left:"50%", marginTop:-10, marginLeft:-10, animation:"orbit-a 3.5s linear infinite" }}>
                            <div style={{ width:20, height:20, borderRadius:"50%", background:"linear-gradient(135deg,#6ee7b7,#10b981)", border:"2px solid rgba(255,255,255,0.85)", animation:"dpGreen 2s ease-in-out infinite" }} />
                          </div>
                          <div className="absolute" style={{ top:"50%", left:"50%", marginTop:-8, marginLeft:-8, animation:"orbit-b 5.5s linear infinite" }}>
                            <div style={{ width:16, height:16, borderRadius:"50%", background:"linear-gradient(135deg,#7dd3fc,#0ea5e9)", border:"2px solid rgba(255,255,255,0.85)", animation:"dpSky 1.8s ease-in-out infinite 0.4s" }} />
                          </div>
                          <div className="absolute" style={{ top:"50%", left:"50%", marginTop:-7, marginLeft:-7, animation:"orbit-c 4s linear infinite" }}>
                            <div style={{ width:14, height:14, borderRadius:"50%", background:"linear-gradient(135deg,#f0abfc,#d946ef)", border:"2px solid rgba(255,255,255,0.85)", animation:"dpFuchsia 2.2s ease-in-out infinite 0.9s" }} />
                          </div>
                          <div className="absolute" style={{ top:"50%", left:"50%", marginTop:-6, marginLeft:-6, animation:"orbit-d 6.5s linear infinite" }}>
                            <div style={{ width:12, height:12, borderRadius:"50%", background:"linear-gradient(135deg,#fde68a,#f59e0b)", border:"2px solid rgba(255,255,255,0.85)", animation:"dpYellow 1.6s ease-in-out infinite 1.4s" }} />
                          </div>

                          {/* Center core */}
                          <div className="relative z-20 flex flex-col items-center justify-center rounded-full" style={{
                            width:78, height:78,
                            background:"radial-gradient(circle at 38% 32%, rgba(216,180,254,0.9) 0%, rgba(124,58,237,0.95) 45%, rgba(76,29,149,1) 100%)",
                            border:"1.5px solid rgba(255,255,255,0.45)",
                            animation:"corePulse 2.5s ease-in-out infinite",
                          }}>
                            <Radio className="w-6 h-6 text-white mb-0.5" style={{ filter:"drop-shadow(0 0 5px rgba(255,255,255,0.9))" }} />
                            <span className="text-[9px] font-black tracking-widest text-emerald-300 uppercase">LIVE</span>
                          </div>
                        </div>
                      </div>
                    </>

                    {/* Balance */}
                    <div className="rounded-2xl bg-white/10 border border-white/20 p-4 mb-4 text-center backdrop-blur">
                      <div className="text-sm text-white/70 mb-1">Your amount being matched</div>
                      <div className="text-4xl font-black tracking-tight">₹{balance.toFixed(0)}</div>
                    </div>

                    {/* Sell Reward — only when admin has set a reward % */}
                    {sellRewardPct > 0 && (
                      <div className="rounded-2xl bg-emerald-500/20 border border-emerald-400/30 px-4 py-3 mb-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-400/30 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-4 h-4 text-emerald-300" />
                        </div>
                        <div>
                          <div className="text-[11px] text-emerald-200 uppercase tracking-wider">Sell Reward</div>
                          <div className="text-xl font-black text-emerald-300">+₹{(balance * sellRewardPct / 100).toFixed(0)} <span className="text-sm font-normal text-emerald-400">at {sellRewardPct}%</span></div>
                        </div>
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="rounded-2xl bg-white/10 backdrop-blur p-3 text-center border border-white/10">
                        <div className="text-[11px] uppercase tracking-wider text-white/60">In Queue</div>
                        <div className="text-3xl font-black mt-0.5">{matching?.available || 0}</div>
                      </div>
                      <div className={`rounded-2xl p-3 text-center border ${(matching?.locked || 0) > 0 ? "bg-emerald-500/25 border-emerald-400/40" : "bg-white/10 border-white/10"}`}>
                        <div className={`text-[11px] uppercase tracking-wider ${(matching?.locked || 0) > 0 ? "text-emerald-300" : "text-white/60"}`}>Locked 🔒</div>
                        <div className={`text-3xl font-black mt-0.5 ${(matching?.locked || 0) > 0 ? "text-emerald-300" : ""}`}>{matching?.locked || 0}</div>
                      </div>
                    </div>

                    {/* Stay online urge */}
                    <div className="rounded-xl bg-amber-400/15 border border-amber-400/25 px-3 py-2 mb-4 text-center">
                      <span className="text-xs text-amber-200 font-medium">🔥 Stay online — a buyer could lock any second!</span>
                    </div>
                  </div>
                ) : (
                  /* ── Idle state ── */
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-white/60 text-xs uppercase tracking-widest">
                        <Sparkles className="w-3.5 h-3.5" /> Sell Matching
                      </div>
                      <span className="text-xs bg-white/10 px-2.5 py-1 rounded-full text-white/60">Idle</span>
                    </div>

                    <div className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                      Turn your balance<br />
                      <span className="text-fuchsia-300">into earnings.</span>
                    </div>
                    <p className="mt-2 text-sm text-white/75 leading-relaxed">
                      Go live for 15 minutes and let buyers pay you directly.
                    </p>

                    {/* Earnings preview — only if admin has configured a sell reward */}
                    {balance > 0 && sellRewardPct > 0 && (
                      <div className="mt-4 rounded-2xl bg-white/10 border border-white/15 p-4">
                        <div className="text-xs text-white/60 uppercase tracking-wider mb-2">If you sell now</div>
                        <div className="flex items-end gap-3">
                          <div>
                            <div className="text-[11px] text-white/50">Your balance</div>
                            <div className="text-xl font-black">₹{balance.toFixed(0)}</div>
                          </div>
                          <div className="text-white/40 text-xl mb-0.5">→</div>
                          <div>
                            <div className="text-[11px] text-emerald-300">You earn (+{sellRewardPct}%)</div>
                            <div className="text-xl font-black text-emerald-300">+₹{(balance * sellRewardPct / 100).toFixed(0)}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-2xl bg-white/10 p-3 text-center">
                        <Wallet className="w-4 h-4 mx-auto opacity-60 mb-1" />
                        <div className="text-[10px] uppercase tracking-wider text-white/60">Balance</div>
                        <div className="text-sm font-bold">₹{balance.toFixed(0)}</div>
                      </div>
                      <div className="rounded-2xl bg-white/10 p-3 text-center">
                        <Clock className="w-4 h-4 mx-auto opacity-60 mb-1" />
                        <div className="text-[10px] uppercase tracking-wider text-white/60">Held</div>
                        <div className="text-sm font-bold">₹{Number(heldBalance).toFixed(0)}</div>
                      </div>
                      <div className="rounded-2xl bg-white/10 p-3 text-center">
                        <ShieldCheck className="w-4 h-4 mx-auto opacity-60 mb-1" />
                        <div className="text-[10px] uppercase tracking-wider text-white/60">Trust</div>
                        <div className="text-sm font-bold">{trustScore}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  {isMatching ? (
                    <Button onClick={() => stopMut.mutate()} disabled={stopMut.isPending} className="w-full h-12 text-base font-bold rounded-2xl bg-white/15 hover:bg-white/25 border border-white/30 text-white shadow-lg backdrop-blur">
                      {stopMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <WifiOff className="w-4 h-4 mr-2" />}
                      Stop Matching
                    </Button>
                  ) : (
                    <Button onClick={() => startMut.mutate()} disabled={startMut.isPending || isFrozen} className="w-full h-13 text-base font-bold rounded-2xl shadow-xl border border-white/30 text-violet-900 hover:scale-[1.01] transition-transform" style={{ background: "linear-gradient(135deg, #fff 0%, #e9d5ff 50%, #fdf4ff 100%)" }}>
                      {startMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Radio className="w-4 h-4 mr-2" />}
                      Start Selling — Go Live 🚀
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <LockedOrderTabs
          chunks={chunks}
          pendingConfirms={pendingConfirms}
          user={user}
          onRefetch={() => { refetchPending(); refetchChunks(); qc.invalidateQueries({ queryKey: ["me"] }); }}
          onUpdated={() => refetchMe()}
          now={now}
        />
      </div>
    </Layout>
  );
}

function LockedOrderTabs({
  chunks, pendingConfirms, user, onRefetch, onUpdated, now,
}: {
  chunks: any[]; pendingConfirms: any[]; user: any; onRefetch: () => void; onUpdated: () => void; now: number;
}) {
  const lockedChunks = chunks.filter((c) => c.status === "locked" || c.status === "pending_confirmation");
  const hasLocked = lockedChunks.length > 0;
  const [manualTab, setManualTab] = useState<"pending" | "locked" | "chunks" | null>(null);

  useEffect(() => {
    if (pendingConfirms.length > 0) setManualTab("pending");
    else if (hasLocked) setManualTab("locked");
    else setManualTab(null);
  }, [pendingConfirms.length, hasLocked]);

  const tab = manualTab ?? (pendingConfirms.length > 0 ? "pending" : hasLocked ? "locked" : "chunks");

  return (
    <Tabs value={tab} onValueChange={(v) => setManualTab(v as any)}>
      <TabsList className="w-full">
        <TabsTrigger value="pending" className="flex-1">
          Pending {pendingConfirms.length > 0 && (
            <span className="ml-1 px-1.5 bg-orange-500 text-white rounded-full text-xs">{pendingConfirms.length}</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="locked" className="flex-1">
          Locked Order {lockedChunks.length > 0 && (
            <span className="ml-1 px-1.5 bg-amber-500 text-white rounded-full text-xs">{lockedChunks.length}</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="chunks" className="flex-1">My Orders</TabsTrigger>
      </TabsList>

      <TabsContent value="pending" className="space-y-2 mt-3">
        {pendingConfirms.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No pending confirmations.</CardContent></Card>
        ) : (
          pendingConfirms.map((c) => (
            <PendingConfirmCard key={c.id} chunk={c} onResolved={onRefetch} />
          ))
        )}
      </TabsContent>

      <TabsContent value="locked" className="space-y-3 mt-3">
        {lockedChunks.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No orders locked right now.
            </CardContent>
          </Card>
        ) : (
          lockedChunks.map((c) => {
            const expiresAt = c.confirmDeadline ? new Date(c.confirmDeadline).getTime() : 0;
            const msLeft = Math.max(0, expiresAt - now);
            const m = Math.floor(msLeft / 60000);
            const s = Math.floor((msLeft % 60000) / 1000);
            const countdown = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            return (
              <Card key={c.id} className="overflow-hidden border-amber-200">
                <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-fuchsia-500" />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Amount</div>
                      <div className="text-3xl font-black text-amber-700">₹{Number(c.amount).toFixed(2)}</div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR[c.status] || "bg-muted"}`}>
                      {c.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-muted/50 p-2">
                      <div className="text-muted-foreground">Order #</div>
                      <div className="font-semibold">{c.id}</div>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-2">
                      <div className="text-muted-foreground">Expires in</div>
                      <div className="font-mono font-bold text-orange-600">{expiresAt ? countdown : "—"}</div>
                    </div>
                    {c.upiId && (
                      <div className="rounded-xl bg-muted/50 p-2 col-span-2">
                        <div className="text-muted-foreground">UPI ID</div>
                        <div className="font-semibold truncate">{c.upiId}</div>
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 leading-relaxed">
                    A buyer has locked your order. Once they submit payment proof, you will need to confirm it.
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </TabsContent>

      <TabsContent value="chunks" className="space-y-2 mt-3">
        {chunks.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No active orders. Start matching above to push chunks into the buy queue.
            </CardContent>
          </Card>
        ) : (
          chunks.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-bold">₹{c.amount}</div>
                  <div className="text-xs text-muted-foreground">Order #{c.id}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${STATUS_COLOR[c.status] || "bg-muted"}`}>{c.status.replace(/_/g, " ")}</span>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}

function MePanel({ user, onUpdated }: { user: any; onUpdated: () => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState<string>(user.displayName || user.username || "");
  useEffect(() => { setName(user.displayName || user.username || ""); }, [user.displayName, user.username]);
  const saveMut = useMutation({
    mutationFn: () => api("/auth/update-name", { method: "POST", body: JSON.stringify({ displayName: name }) }),
    onSuccess: () => { toast({ title: "Display name updated" }); setEditing(false); onUpdated(); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white">
            <UserIcon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">Display name</div>
            {editing ? (
              <div className="flex items-center gap-2 mt-1">
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-9" />
                <Button size="sm" disabled={saveMut.isPending || name.trim().length < 2} onClick={() => saveMut.mutate()}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(user.displayName || user.username || ""); }}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="font-semibold truncate">{user.displayName || user.username}</div>
                <button onClick={() => setEditing(true)} className="text-primary text-xs flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              </div>
            )}
            <div className="text-[11px] text-muted-foreground">Login handle: {user.username}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-muted/50 p-2">
            <div className="text-muted-foreground">Trust</div>
            <div className="font-bold text-base">{user.trustScore ?? 0}</div>
          </div>
          <div className="rounded-xl bg-muted/50 p-2">
            <div className="text-muted-foreground">Trades</div>
            <div className="font-bold text-base">{user.successfulTrades ?? 0}</div>
          </div>
          <div className="rounded-xl bg-muted/50 p-2">
            <div className="text-muted-foreground">Warnings</div>
            <div className={`font-bold text-base ${(user.fraudWarningCount ?? 0) >= 2 ? "text-red-600" : ""}`}>{user.fraudWarningCount ?? 0}/3</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PendingConfirmCard({ chunk, onResolved }: { chunk: any; onResolved: () => void; }) {
  const { toast } = useToast();
  const [now, setNow] = useState(Date.now());
  const [showProof, setShowProof] = useState(false);
  const [showDisputeWarning, setShowDisputeWarning] = useState(false);
  const [confirmPopupOpen, setConfirmPopupOpen] = useState(false);
  const [reason, setReason] = useState("");
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const deadline = new Date(chunk.confirmDeadline).getTime();
  const remaining = deadline - now;

  const confirmMut = useMutation({
    mutationFn: () => api(`/p2p/confirm/${chunk.id}`, { method: "POST" }),
    onSuccess: () => { toast({ title: "Confirmed!", description: `Trade settled. ₹${chunk.amount} released.` }); onResolved(); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const disputeMut = useMutation({
    mutationFn: () => api(`/p2p/dispute/${chunk.id}`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => { toast({ title: "Dispute opened" }); onResolved(); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="border-orange-300 shadow-lg">
      <CardContent className="p-4 space-y-3">
        <div className="rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white p-4 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide opacity-90">Payment coming soon</div>
              <div className="text-lg font-bold mt-1">Be ready to confirm</div>
              <div className="text-sm opacity-90 mt-1">Buyer has shared proof. Check your bank app now.</div>
            </div>
            <BellRing className="h-6 w-6 shrink-0 animate-pulse" />
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <CheckCircle2 className="h-4 w-4" />
            Direct confirm option below
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-lg">₹{chunk.amount}</div>
            <div className="text-xs text-muted-foreground">Buyer #{chunk.buyer?.id || chunk.lockedByUserId}</div>
          </div>
          <div className={`flex items-center gap-1 text-sm ${remaining < 5 * 60 * 1000 ? "text-red-600" : "text-orange-600"}`}>
            <Clock className="h-4 w-4" />
            <span className="font-mono font-semibold">{fmtCountdown(remaining)}</span>
          </div>
        </div>

        <div className="bg-muted/50 rounded-2xl p-3 text-sm space-y-2">
          <div>UTR: <span className="font-mono font-semibold">{chunk.utrNumber}</span></div>
        </div>
        {chunk.screenshotUrl && (
          <a href={chunk.screenshotUrl} target="_blank" className="text-sm text-primary underline font-medium">View Screenshot</a>
        )}{" "}
        {chunk.recordingUrl && (
          <a href={chunk.recordingUrl} target="_blank" className="text-sm text-primary underline font-medium ml-2">View Recording</a>
        )}

        <div className="text-xs text-muted-foreground">
          Check your bank app for ₹{chunk.amount} credited from the buyer's UPI. Only confirm if you have received it.
        </div>

        {!showProof ? (
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" className="bg-green-600 hover:bg-green-700 h-12 text-base" disabled={confirmMut.isPending} onClick={() => setConfirmPopupOpen(true)}>
              YES — Received
            </Button>
            <Button size="lg" variant="destructive" className="h-12 text-base" onClick={() => setShowDisputeWarning(true)}>
              NO — Not Received
            </Button>
          </div>
        ) : (
            <div className="space-y-2">
            <textarea
              className="w-full border rounded-2xl p-3 text-sm"
              rows={2}
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="text-xs text-red-700">
              ⚠ Opening a dispute will require you to upload your bank statement, a full screen recording and the last transaction screenshot within 24 hours.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setShowProof(false)}>Back</Button>
              <Button variant="destructive" disabled={disputeMut.isPending} onClick={() => disputeMut.mutate()}>
                Open Dispute
              </Button>
            </div>
          </div>
        )}
        <div className="text-xs text-center text-muted-foreground">
          Auto-confirms to the buyer in {fmtCountdown(remaining)} if no action is taken.
        </div>
      </CardContent>

      <Dialog open={confirmPopupOpen} onOpenChange={setConfirmPopupOpen}>
        <DialogContent className="max-w-[92vw] w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" /> Please verify in your bank app first
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Open the UPI app linked to this order (PhonePe, Google Pay, or Paytm) and check the recent transaction history. Confirm that ₹{chunk.amount} has actually credited to your account.
            </p>
            <p className="font-medium text-foreground">
              Press Continue only after you have seen the credit in your statement. Once confirmed, the trade cannot be reversed.
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmPopupOpen(false)}>
              Go back
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => { setConfirmPopupOpen(false); confirmMut.mutate(); }}
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDisputeWarning} onOpenChange={setShowDisputeWarning}>
        <DialogContent className="max-w-[92vw] w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" /> Open dispute carefully
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Before raising a dispute, open your UPI app (PhonePe, Google Pay, or Paytm) and re-check the recent history. Many UPI payments take a minute or two to reflect in the bank statement.
            </p>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 space-y-1">
              <div className="font-semibold">If your dispute is found wrong:</div>
              <ul className="list-disc list-inside text-[13px] leading-snug">
                <li>−10 trust score per wrong dispute</li>
                <li>Your account is automatically suspended once your trust score reaches −50</li>
                <li>You must upload bank statement, screen recording and last-transaction screenshot within 24 hours</li>
              </ul>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDisputeWarning(false)}>
              Re-check history
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => { setShowDisputeWarning(false); setShowProof(true); }}
            >
              Continue to dispute
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
