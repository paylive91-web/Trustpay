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

  const { data: matching, refetch: refetchMatching } = useQuery<any>({
    queryKey: ["matching-status"],
    queryFn: () => api("/p2p/matching-status"),
    enabled: !!user,
    // Fast poll while matching is live; slow background poll otherwise.
    // We can't reference `isMatching` here yet, so derive from cached data inline.
    refetchInterval: (q) => {
      const d: any = q.state.data;
      const exp = d?.matchingExpiresAt ? new Date(d.matchingExpiresAt).getTime() : 0;
      return d?.isActive && exp - Date.now() > 0 ? 3000 : 30000;
    },
  });

  // Compute isMatching early so the rest of this component (timers, polls,
  // wake lock) can gate themselves on it instead of running 24/7.
  const expiresAtEarly = matching?.matchingExpiresAt ? new Date(matching.matchingExpiresAt).getTime() : 0;
  const remainingEarly = expiresAtEarly - now;
  const isMatchingEarly = !!matching?.isActive && remainingEarly > 0;

  const { data: chunks = [], refetch: refetchChunks } = useQuery<any[]>({
    queryKey: ["my-chunks"],
    queryFn: () => api("/p2p/my-chunks"),
    enabled: !!user,
    // Only fast-poll chunks when actively matching — chunks can't change
    // without an active matching session.
    refetchInterval: isMatchingEarly ? 5000 : 30000,
  });
  const { data: pendingConfirms = [], refetch: refetchPending } = useQuery<any[]>({
    queryKey: ["pending-confirms"],
    queryFn: () => api("/p2p/my-pending-confirmations"),
    enabled: !!user,
    // Pending confirms have a hard deadline, so poll fast when any exist;
    // back off to a sanity-check cadence otherwise.
    refetchInterval: (q) => ((q.state.data as any[] | undefined)?.length ? 4000 : 20000),
  });

  // 1-second tick drives the matching countdown and the per-pending-confirm
  // deadline countdown. Only run it when something actually needs to tick —
  // otherwise it forces a full Sell tree re-render every second for nothing.
  const needsTick = isMatchingEarly || pendingConfirms.length > 0;
  useEffect(() => {
    if (!needsTick) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [needsTick]);

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

                    {/* Central radar animation — rainbow neon edition */}
                    <>
                      <style>{`
                        @keyframes radarSweep{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
                        @keyframes radarSweepRev{from{transform:rotate(360deg)}to{transform:rotate(0deg)}}
                        @keyframes orbit-a{from{transform:rotate(0deg) translateX(54px) rotate(0deg)}to{transform:rotate(360deg) translateX(54px) rotate(-360deg)}}
                        @keyframes orbit-b{from{transform:rotate(120deg) translateX(72px) rotate(-120deg)}to{transform:rotate(480deg) translateX(72px) rotate(-480deg)}}
                        @keyframes orbit-c{from{transform:rotate(240deg) translateX(46px) rotate(-240deg)}to{transform:rotate(600deg) translateX(46px) rotate(-600deg)}}
                        @keyframes orbit-d{from{transform:rotate(60deg) translateX(64px) rotate(-60deg)}to{transform:rotate(420deg) translateX(64px) rotate(-420deg)}}
                        @keyframes pulseRing{0%{transform:scale(0.4);opacity:0.85}80%{opacity:0.05}100%{transform:scale(1.6);opacity:0}}
                        @keyframes pulseRingSlow{0%{transform:scale(0.5);opacity:0.6}100%{transform:scale(1.5);opacity:0}}
                        @keyframes ringSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
                        @keyframes ringSpinRev{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
                        @keyframes hueShift{0%{filter:hue-rotate(0deg) brightness(1.05)}50%{filter:hue-rotate(60deg) brightness(1.2)}100%{filter:hue-rotate(0deg) brightness(1.05)}}
                        @keyframes coreGlow{0%,100%{box-shadow:0 0 22px 8px rgba(168,85,247,0.55),0 0 44px 18px rgba(236,72,153,0.32),0 0 70px 28px rgba(56,189,248,0.18)}50%{box-shadow:0 0 32px 14px rgba(236,72,153,0.75),0 0 60px 26px rgba(168,85,247,0.45),0 0 96px 38px rgba(56,189,248,0.28)}}
                        @keyframes coreShimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
                        @keyframes dpGreen{0%,100%{box-shadow:0 0 8px 2px rgba(52,211,153,0.85),0 0 18px 7px rgba(52,211,153,0.45),0 0 34px 14px rgba(52,211,153,0.18)}50%{box-shadow:0 0 14px 5px rgba(52,211,153,1),0 0 28px 12px rgba(52,211,153,0.6),0 0 50px 22px rgba(52,211,153,0.28)}}
                        @keyframes dpSky{0%,100%{box-shadow:0 0 8px 2px rgba(56,189,248,0.85),0 0 18px 7px rgba(56,189,248,0.45),0 0 34px 14px rgba(56,189,248,0.18)}50%{box-shadow:0 0 14px 5px rgba(56,189,248,1),0 0 28px 12px rgba(56,189,248,0.6),0 0 50px 22px rgba(56,189,248,0.28)}}
                        @keyframes dpFuchsia{0%,100%{box-shadow:0 0 8px 2px rgba(232,121,249,0.85),0 0 18px 7px rgba(232,121,249,0.45),0 0 34px 14px rgba(232,121,249,0.18)}50%{box-shadow:0 0 14px 5px rgba(232,121,249,1),0 0 28px 12px rgba(232,121,249,0.6),0 0 50px 22px rgba(232,121,249,0.28)}}
                        @keyframes dpAmber{0%,100%{box-shadow:0 0 8px 2px rgba(251,146,60,0.85),0 0 18px 7px rgba(251,146,60,0.45),0 0 34px 14px rgba(251,146,60,0.18)}50%{box-shadow:0 0 14px 5px rgba(251,146,60,1),0 0 28px 12px rgba(251,146,60,0.6),0 0 50px 22px rgba(251,146,60,0.28)}}
                        @keyframes liveBlink{0%,100%{opacity:1}50%{opacity:0.55}}
                        @keyframes sparkleDrift{0%{transform:translate(0,0) scale(0.8);opacity:0}20%{opacity:0.9}100%{transform:translate(var(--dx),var(--dy)) scale(1.1);opacity:0}}
                      `}</style>
                      <div className="flex justify-center mb-5">
                        <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
                          {/* Outer expanding pulse rings — give a "broadcasting" feel */}
                          <div className="absolute rounded-full" style={{ width:200, height:200, border:"2px solid rgba(167,139,250,0.55)", animation:"pulseRing 2.6s ease-out infinite" }} />
                          <div className="absolute rounded-full" style={{ width:200, height:200, border:"2px solid rgba(236,72,153,0.5)", animation:"pulseRing 2.6s ease-out infinite 0.85s" }} />
                          <div className="absolute rounded-full" style={{ width:200, height:200, border:"2px solid rgba(56,189,248,0.45)", animation:"pulseRing 2.6s ease-out infinite 1.7s" }} />

                          {/* Counter-rotating gradient ring (outer) */}
                          <div className="absolute rounded-full" style={{
                            width:208, height:208, padding:2, animation:"ringSpinRev 14s linear infinite, hueShift 8s ease-in-out infinite",
                            background:"conic-gradient(from 0deg, #34d399, #38bdf8, #a78bfa, #ec4899, #fbbf24, #34d399)",
                            WebkitMask:"linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
                            WebkitMaskComposite:"xor", maskComposite:"exclude",
                            opacity:0.55,
                          }} />

                          {/* SVG radar grid (subtle base) */}
                          <svg className="absolute" width="200" height="200" style={{ overflow: "visible" }}>
                            <defs>
                              <radialGradient id="rgFade" cx="50%" cy="50%" r="50%">
                                <stop offset="55%" stopColor="rgba(255,255,255,0)" />
                                <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
                              </radialGradient>
                            </defs>
                            <circle cx="100" cy="100" r="94" fill="url(#rgFade)" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
                            <circle cx="100" cy="100" r="68" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" strokeDasharray="2 4" />
                            <circle cx="100" cy="100" r="42" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" strokeDasharray="2 4" />
                            {[0,30,60,90,120,150,180,210,240,270,300,330].map(a => {
                              const r = (a - 90) * Math.PI / 180;
                              return <line key={a} x1={100 + 88*Math.cos(r)} y1={100 + 88*Math.sin(r)} x2={100 + 94*Math.cos(r)} y2={100 + 94*Math.sin(r)} stroke="rgba(255,255,255,0.32)" strokeWidth="1.5" strokeLinecap="round" />;
                            })}
                          </svg>

                          {/* Rainbow conic sweep — wide, vivid, multi-color */}
                          <div className="absolute rounded-full overflow-hidden" style={{ width: 192, height: 192, animation: "radarSweep 3.2s linear infinite" }}>
                            <div style={{
                              position: "absolute", inset: 0, borderRadius: "50%",
                              background: "conic-gradient(from 0deg, transparent 0deg, rgba(52,211,153,0.55) 6deg, rgba(56,189,248,0.45) 28deg, rgba(167,139,250,0.35) 55deg, rgba(236,72,153,0.18) 80deg, transparent 95deg)",
                              filter: "blur(0.5px)",
                            }} />
                          </div>
                          {/* Sweep arm — bright leading edge */}
                          <div className="absolute" style={{ width: 192, height: 192, animation: "radarSweep 3.2s linear infinite" }}>
                            <div style={{
                              position: "absolute", top: "50%", left: "50%", width: "50%", height: "2px", transformOrigin: "left center",
                              background: "linear-gradient(to right, rgba(255,255,255,1), rgba(167,139,250,0.85), rgba(236,72,153,0.4), transparent)",
                              borderRadius: 2,
                              boxShadow: "0 0 8px 1px rgba(167,139,250,0.85), 0 0 18px 3px rgba(236,72,153,0.4)",
                            }} />
                          </div>
                          {/* Counter sweep — a faint reverse arm for the "energy field" feel */}
                          <div className="absolute" style={{ width: 192, height: 192, animation: "radarSweepRev 5.5s linear infinite", opacity:0.5 }}>
                            <div style={{
                              position: "absolute", top: "50%", left: "50%", width: "48%", height: "1.5px", transformOrigin: "left center",
                              background: "linear-gradient(to right, rgba(56,189,248,0.9), rgba(56,189,248,0.2), transparent)",
                              borderRadius: 2,
                              boxShadow: "0 0 6px 1px rgba(56,189,248,0.6)",
                            }} />
                          </div>

                          {/* Floating sparkle particles — subtle ambient glow */}
                          {[
                            { dx:"22px", dy:"-30px", delay:"0s", color:"#fbbf24" },
                            { dx:"-26px", dy:"-18px", delay:"1.1s", color:"#a78bfa" },
                            { dx:"30px", dy:"24px", delay:"2.0s", color:"#34d399" },
                            { dx:"-28px", dy:"28px", delay:"0.6s", color:"#ec4899" },
                          ].map((p, i) => (
                            <div key={`spk-${i}`} className="absolute" style={{
                              top:"50%", left:"50%", width:5, height:5, borderRadius:"50%",
                              background: p.color, boxShadow:`0 0 8px 2px ${p.color}`,
                              ["--dx" as any]: p.dx, ["--dy" as any]: p.dy,
                              animation:`sparkleDrift 3.4s ease-out infinite ${p.delay}`,
                            }} />
                          ))}

                          {/* Orbiting chunk dots — count reflects actual chunks live in queue.
                              0 chunks = empty radar (no fake activity). Max 4 dots even
                              if more chunks exist, to keep the visual readable. */}
                          {(matching?.available || 0) >= 1 && (
                            <div className="absolute" style={{ top:"50%", left:"50%", marginTop:-11, marginLeft:-11, animation:"orbit-a 3.6s linear infinite" }}>
                              <div style={{ width:22, height:22, borderRadius:"50%", background:"radial-gradient(circle at 35% 30%, #d1fae5 0%, #34d399 45%, #059669 100%)", border:"2px solid rgba(255,255,255,0.95)", animation:"dpGreen 2s ease-in-out infinite" }} />
                            </div>
                          )}
                          {(matching?.available || 0) >= 2 && (
                            <div className="absolute" style={{ top:"50%", left:"50%", marginTop:-9, marginLeft:-9, animation:"orbit-b 5.5s linear infinite" }}>
                              <div style={{ width:18, height:18, borderRadius:"50%", background:"radial-gradient(circle at 35% 30%, #e0f2fe 0%, #38bdf8 45%, #0284c7 100%)", border:"2px solid rgba(255,255,255,0.95)", animation:"dpSky 1.8s ease-in-out infinite 0.4s" }} />
                            </div>
                          )}
                          {(matching?.available || 0) >= 3 && (
                            <div className="absolute" style={{ top:"50%", left:"50%", marginTop:-8, marginLeft:-8, animation:"orbit-c 4.2s linear infinite" }}>
                              <div style={{ width:16, height:16, borderRadius:"50%", background:"radial-gradient(circle at 35% 30%, #fae8ff 0%, #e879f9 45%, #c026d3 100%)", border:"2px solid rgba(255,255,255,0.95)", animation:"dpFuchsia 2.2s ease-in-out infinite 0.9s" }} />
                            </div>
                          )}
                          {(matching?.available || 0) >= 4 && (
                            <div className="absolute" style={{ top:"50%", left:"50%", marginTop:-7, marginLeft:-7, animation:"orbit-d 6.5s linear infinite" }}>
                              <div style={{ width:14, height:14, borderRadius:"50%", background:"radial-gradient(circle at 35% 30%, #fef3c7 0%, #fb923c 45%, #ea580c 100%)", border:"2px solid rgba(255,255,255,0.95)", animation:"dpAmber 1.6s ease-in-out infinite 1.4s" }} />
                            </div>
                          )}

                          {/* Center core — shimmering rainbow gradient */}
                          <div className="relative z-20 flex flex-col items-center justify-center rounded-full" style={{
                            width:84, height:84,
                            background:"linear-gradient(135deg, #a78bfa 0%, #ec4899 30%, #fb923c 55%, #38bdf8 85%, #a78bfa 100%)",
                            backgroundSize:"300% 300%",
                            border:"2px solid rgba(255,255,255,0.6)",
                            animation:"coreGlow 2.6s ease-in-out infinite, coreShimmer 5s ease-in-out infinite",
                          }}>
                            {/* Inner glassy overlay */}
                            <div className="absolute inset-1 rounded-full pointer-events-none" style={{
                              background:"radial-gradient(circle at 35% 28%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.05) 40%, rgba(0,0,0,0.18) 100%)",
                            }} />
                            <Radio className="relative w-7 h-7 text-white mb-0.5" style={{ filter:"drop-shadow(0 0 6px rgba(255,255,255,0.95)) drop-shadow(0 0 12px rgba(255,255,255,0.5))" }} />
                            <span className="relative text-[10px] font-black tracking-[0.2em] text-white uppercase" style={{
                              animation:"liveBlink 1.4s ease-in-out infinite",
                              textShadow:"0 0 8px rgba(255,255,255,0.9), 0 0 16px rgba(236,72,153,0.6)",
                            }}>LIVE</span>
                          </div>
                        </div>
                      </div>
                    </>

                    {/* Compact 4-col stats: Amount | Held | In Queue | Locked */}
                    <div className="grid grid-cols-4 gap-1.5 mb-3">
                      <div className="rounded-xl bg-white/10 border border-white/10 p-2 text-center">
                        <div className="text-[9px] uppercase tracking-wider text-white/55">Amount</div>
                        <div className="text-sm font-black leading-tight mt-0.5">₹{balance.toFixed(0)}</div>
                      </div>
                      <div className={`rounded-xl p-2 text-center border ${Number(heldBalance) > 0 ? "bg-amber-500/20 border-amber-400/40" : "bg-white/10 border-white/10"}`}>
                        <div className={`text-[9px] uppercase tracking-wider ${Number(heldBalance) > 0 ? "text-amber-300" : "text-white/55"}`}>Held</div>
                        <div className={`text-sm font-black leading-tight mt-0.5 ${Number(heldBalance) > 0 ? "text-amber-300" : ""}`}>₹{Number(heldBalance).toFixed(0)}</div>
                      </div>
                      <div className="rounded-xl bg-white/10 border border-white/10 p-2 text-center">
                        <div className="text-[9px] uppercase tracking-wider text-white/55">In Queue</div>
                        <div className="text-sm font-black leading-tight mt-0.5">{matching?.available || 0}</div>
                      </div>
                      <div className={`rounded-xl p-2 text-center border ${(matching?.locked || 0) > 0 ? "bg-emerald-500/25 border-emerald-400/40" : "bg-white/10 border-white/10"}`}>
                        <div className={`text-[9px] uppercase tracking-wider ${(matching?.locked || 0) > 0 ? "text-emerald-300" : "text-white/55"}`}>Locked 🔒</div>
                        <div className={`text-sm font-black leading-tight mt-0.5 ${(matching?.locked || 0) > 0 ? "text-emerald-300" : ""}`}>{matching?.locked || 0}</div>
                      </div>
                    </div>

                    {/* Diagnostic hint when matching is live but queue stays empty */}
                    {(matching as any)?.emptyReason && (
                      <div className="rounded-xl bg-red-500/15 border border-red-400/30 px-3 py-2 mb-3">
                        <div className="text-[10px] uppercase tracking-wider text-red-300 mb-0.5 font-bold">Why is my queue empty?</div>
                        <div className="text-xs text-red-100 leading-snug">{(matching as any).emptyReason}</div>
                        {((matching as any)?.disputed || 0) > 0 && (
                          <Link href="/orders">
                            <span className="inline-block mt-1.5 text-[11px] text-red-200 underline font-semibold cursor-pointer">View {(matching as any).disputed} open dispute{(matching as any).disputed > 1 ? "s" : ""} →</span>
                          </Link>
                        )}
                      </div>
                    )}

                    {/* Sell Reward row — always visible */}
                    <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/25 px-3 py-2 mb-3 flex items-center justify-between">
                      <span className="text-xs text-emerald-200 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" /> Sell Reward
                      </span>
                      <span className="text-sm font-black text-emerald-300">
                        ₹{(balance * sellRewardPct / 100).toFixed(2)}
                      </span>
                    </div>

                    {/* Stay online urge — message reflects real queue state so it
                        doesn't read like generic motivation copy. */}
                    {(() => {
                      const pending = (matching as any)?.pendingConfirmation || 0;
                      const locked = matching?.locked || 0;
                      const avail = matching?.available || 0;
                      let msg = "Stay online — buyers can lock any of your live chunks.";
                      let tone = "amber";
                      if (pending > 0) {
                        msg = `⚡ ${pending} buyer${pending > 1 ? "s" : ""} submitted payment — confirm now in Pending tab.`;
                        tone = "rose";
                      } else if (locked > 0) {
                        msg = `🔒 ${locked} order${locked > 1 ? "s" : ""} locked — buyer is paying. Don't go offline.`;
                        tone = "emerald";
                      } else if (avail > 0) {
                        msg = `🟢 ${avail} chunk${avail > 1 ? "s" : ""} live in queue · waiting for a buyer to lock.`;
                        tone = "emerald";
                      } else if ((matching as any)?.emptyReason) {
                        msg = "Queue empty — see reason above.";
                        tone = "white";
                      } else {
                        msg = "🔥 Stay online — a buyer could lock any second.";
                      }
                      const cls = tone === "rose"
                        ? "bg-rose-500/20 border-rose-400/35 text-rose-100"
                        : tone === "emerald"
                        ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-100"
                        : tone === "white"
                        ? "bg-white/10 border-white/20 text-white/70"
                        : "bg-amber-400/15 border-amber-400/25 text-amber-200";
                      return (
                        <div className={`rounded-xl border px-3 py-2 mb-4 text-center ${cls}`}>
                          <span className="text-xs font-medium">{msg}</span>
                        </div>
                      );
                    })()}
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

                    {/* Sell Reward — only the calculated amount */}
                    <div className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-400/20 via-white/10 to-emerald-300/15 border border-emerald-300/30 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-200 uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" /> Sell Reward
                      </div>
                      <div className="text-2xl font-black text-emerald-300">
                        ₹{(balance * sellRewardPct / 100).toFixed(2)}
                      </div>
                    </div>

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
                      Sell
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
          sellRewardPct={sellRewardPct}
        />
      </div>
    </Layout>
  );
}

function LockedOrderTabs({
  chunks, pendingConfirms, user, onRefetch, onUpdated, now, sellRewardPct,
}: {
  chunks: any[]; pendingConfirms: any[]; user: any; onRefetch: () => void; onUpdated: () => void; now: number; sellRewardPct: number;
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
            <PendingConfirmCard key={c.id} chunk={c} now={now} onResolved={onRefetch} />
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
                  </div>
                  {/* Sell Reward — only the calculated amount */}
                  <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-[11px] uppercase tracking-wider font-bold">Sell Reward</span>
                    </div>
                    <div className="text-base font-black text-emerald-700">
                      ₹{(Number(c.amount) * sellRewardPct / 100).toFixed(2)}
                    </div>
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

      <TabsContent value="chunks" className="space-y-3 mt-3">
        {chunks.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No active orders. Start matching above to push chunks into the buy queue.
            </CardContent>
          </Card>
        ) : (
          chunks.map((c) => <MyOrderCard key={c.id} chunk={c} now={now} sellRewardPct={sellRewardPct} />)
        )}
      </TabsContent>
    </Tabs>
  );
}

function relTime(ts: string | null | undefined, now: number): string {
  if (!ts) return "";
  const t = new Date(ts).getTime();
  if (!t) return "";
  const diff = Math.max(0, now - t);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function MyOrderCard({ chunk: c, now, sellRewardPct }: { chunk: any; now: number; sellRewardPct: number }) {
  const { toast } = useToast();
  const bonus = Number(c.sellRewardAmount || 0);
  const bonusPct = Number(c.sellRewardPercent || 0);
  const status: string = c.status;
  const amount = Number(c.amount || 0);
  // For non-confirmed orders, show projected reward using current settings rate
  const projectedBonus = sellRewardPct > 0 ? amount * sellRewardPct / 100 : 0;

  const accent =
    status === "confirmed" ? { bar: "from-emerald-400 via-green-400 to-teal-400", border: "border-emerald-200", amountText: "text-emerald-700" }
    : status === "disputed" ? { bar: "from-rose-500 via-red-400 to-orange-400", border: "border-rose-200", amountText: "text-rose-700" }
    : status === "pending_confirmation" ? { bar: "from-orange-400 via-amber-400 to-yellow-400", border: "border-orange-200", amountText: "text-orange-700" }
    : status === "locked" ? { bar: "from-amber-400 via-orange-400 to-fuchsia-400", border: "border-amber-200", amountText: "text-amber-700" }
    : { bar: "from-sky-400 via-blue-400 to-indigo-400", border: "border-sky-200", amountText: "text-sky-700" };

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => toast({ title: `${label} copied` })).catch(() => {});
  };

  return (
    <Card className={`overflow-hidden ${accent.border}`}>
      <div className={`h-1 bg-gradient-to-r ${accent.bar}`} />
      <CardContent className="p-4 space-y-3">
        {/* Header row: amount + status pill */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Order Amount</div>
            <div className={`text-2xl font-black leading-tight ${accent.amountText}`}>₹{amount.toFixed(2)}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Order #{c.id}
              {c.createdAt && <> · {relTime(c.createdAt, now)}</>}
            </div>
          </div>
          <span className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${STATUS_COLOR[status] || "bg-muted"}`}>
            {status === "confirmed" ? "✓ Confirmed" : status.replace(/_/g, " ")}
          </span>
        </div>

        {/* Confirmation details — shown for confirmed orders */}
        {status === "confirmed" && (
          <div className="rounded-xl bg-muted/40 border border-border/50 p-3 space-y-2">
            {c.updatedAt && (
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Confirmed on
                </span>
                <span className="font-semibold text-right">
                  {new Date(c.updatedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                </span>
              </div>
            )}
            {c.utrNumber && (
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="text-muted-foreground shrink-0">UTR</span>
                <button
                  onClick={() => copy(c.utrNumber, "UTR")}
                  className="font-mono font-bold text-foreground bg-white px-2 py-0.5 rounded border border-border/60 hover:bg-emerald-50 hover:border-emerald-300 transition truncate max-w-[180px]"
                  title="Tap to copy"
                >
                  {c.utrNumber}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sell Reward — only the calculated amount.
            Confirmed orders show stored bonus if present, else current rate;
            non-confirmed orders show projected bonus at current rate. */}
        <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-700">
            <Sparkles className="w-4 h-4" />
            <span className="text-[11px] uppercase tracking-wider font-bold">Sell Reward</span>
          </div>
          <div className="text-base font-black text-emerald-700">
            ₹{(status === "confirmed" && bonus > 0 ? bonus : projectedBonus).toFixed(2)}
          </div>
        </div>

        {/* Disputed banner */}
        {status === "disputed" && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 leading-snug">
            <div className="font-bold mb-0.5">⚠ Dispute open</div>
            This order is under review. The amount stays held until TrustPay resolves it.
          </div>
        )}

        {/* Available — live in queue */}
        {status === "available" && (
          <div className="text-xs text-muted-foreground italic">
            Live in queue — waiting for a buyer to lock.
          </div>
        )}
      </CardContent>
    </Card>
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

function PendingConfirmCard({ chunk, now, onResolved }: { chunk: any; now: number; onResolved: () => void; }) {
  const { toast } = useToast();
  const [showProof, setShowProof] = useState(false);
  const [showDisputeWarning, setShowDisputeWarning] = useState(false);
  const [confirmPopupOpen, setConfirmPopupOpen] = useState(false);
  const [reason, setReason] = useState("");
  // Countdown ticks via the parent's shared `now` prop — no per-card timer.
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
