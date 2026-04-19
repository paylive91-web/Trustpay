import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGetMe, useGetAppSettings } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import Layout from "@/components/layout";
import DisputePauseBanner from "@/components/dispute-pause-banner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, BookOpen, Clock, ShieldCheck, BellRing, CheckCircle2, Loader2,
  Pencil, Radio, Wallet, User as UserIcon, Sparkles, Wifi, WifiOff,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch (_) {}
}

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
  const { data: user, isError, refetch: refetchMe } = useGetMe({ query: { retry: false } });
  const { data: settings } = useGetAppSettings();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showRules, setShowRules] = useState(false);
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

  useEffect(() => { if (isError) setLocation("/login"); }, [isError, setLocation]);

  // Sound when a new lock or pending-confirmation arrives.
  const prevLocked = useRef(0);
  const prevPending = useRef(0);
  useEffect(() => {
    const locked = matching?.locked || 0;
    if (locked > prevLocked.current) playBeep();
    prevLocked.current = locked;
  }, [matching?.locked]);
  useEffect(() => {
    if (pendingConfirms.length > prevPending.current) playBeep();
    prevPending.current = pendingConfirms.length;
  }, [pendingConfirms.length]);

  const startMut = useMutation({
    mutationFn: () => api("/p2p/start-matching", { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Matching shuru ho gayi", description: "15 minute tak online raho." });
      refetchMatching(); refetchChunks(); refetchMe();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const stopMut = useMutation({
    mutationFn: () => api("/p2p/stop-matching", { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Matching band kar di" });
      refetchMatching(); refetchChunks(); refetchMe();
    },
  });

  if (!user) return null;

  const expiresAt = matching?.matchingExpiresAt ? new Date(matching.matchingExpiresAt).getTime() : 0;
  const remaining = expiresAt - now;
  const isMatching = !!matching?.isActive && remaining > 0;
  const trustScore = (user as any).trustScore ?? 0;
  const isFrozen = (user as any).isFrozen;
  const heldBalance = (user as any).heldBalance ?? 0;
  const balance = Number((user as any).balance ?? 0);

  return (
    <Layout>
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-secondary via-secondary to-primary text-white">
        <Link href="/"><ArrowLeft className="cursor-pointer" /></Link>
        <span className="font-bold text-lg flex-1">Sell — Matching</span>
        <button onClick={() => setShowRules((v) => !v)} className="flex items-center gap-1 text-xs bg-white/15 px-2.5 py-1.5 rounded-full">
          <BookOpen className="w-3.5 h-3.5" /> Rules
        </button>
      </div>
      {showRules && (settings as any)?.sellRules && (
        <div className="p-4 bg-secondary/5 border-b border-secondary/20 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {(settings as any).sellRules}
        </div>
      )}
      <div className="px-4 pt-3"><DisputePauseBanner /></div>

      {isFrozen && (
        <div className="px-4 pt-3">
          <Card className="border-red-400 bg-red-50">
            <CardContent className="p-3 text-sm text-red-700">Account frozen — sells paused. Contact support.</CardContent>
          </Card>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Premium matching hero */}
        <Card className="overflow-hidden border-none shadow-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white">
          <CardContent className="p-0">
            <div className="p-5 relative">
              <div className="absolute top-3 right-3">
                {isMatching ? (
                  <span className="flex items-center gap-1.5 text-xs bg-white/20 backdrop-blur px-2.5 py-1 rounded-full">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    LIVE
                  </span>
                ) : (
                  <span className="text-xs bg-white/15 px-2.5 py-1 rounded-full">Idle</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-white/80 text-xs uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" /> Sell Matching
              </div>
              <div className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">
                {isMatching ? "Matching ho rahi hai…" : "Ready to sell?"}
              </div>
              <p className="mt-2 text-sm text-white/85 leading-relaxed max-w-md">
                {isMatching
                  ? "Wait karein — buyer milte hi aapko notification + sound aayegi. Online raho, app open rakho."
                  : "Sell button dabate hi aapke chunks 15 minute ke liye buy queue me chale jayenge."}
              </p>

              {isMatching ? (
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-white/15 backdrop-blur p-3 text-center">
                    <div className="text-[11px] uppercase tracking-wider text-white/75">Time left</div>
                    <div className="font-mono text-2xl font-black mt-0.5">{fmtCountdown(remaining)}</div>
                  </div>
                  <div className="rounded-2xl bg-white/15 backdrop-blur p-3 text-center">
                    <div className="text-[11px] uppercase tracking-wider text-white/75">In queue</div>
                    <div className="text-2xl font-black mt-0.5">{matching?.available || 0}</div>
                  </div>
                  <div className="rounded-2xl bg-white/15 backdrop-blur p-3 text-center">
                    <div className="text-[11px] uppercase tracking-wider text-white/75">Locked</div>
                    <div className="text-2xl font-black mt-0.5">{matching?.locked || 0}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-white/15 backdrop-blur p-3 text-center">
                    <Wallet className="w-4 h-4 mx-auto opacity-80" />
                    <div className="text-[10px] uppercase tracking-wider text-white/75 mt-1">Balance</div>
                    <div className="text-base font-bold">₹{balance.toFixed(0)}</div>
                  </div>
                  <div className="rounded-2xl bg-white/15 backdrop-blur p-3 text-center">
                    <Clock className="w-4 h-4 mx-auto opacity-80" />
                    <div className="text-[10px] uppercase tracking-wider text-white/75 mt-1">Held</div>
                    <div className="text-base font-bold">₹{Number(heldBalance).toFixed(0)}</div>
                  </div>
                  <div className="rounded-2xl bg-white/15 backdrop-blur p-3 text-center">
                    <ShieldCheck className="w-4 h-4 mx-auto opacity-80" />
                    <div className="text-[10px] uppercase tracking-wider text-white/75 mt-1">Trust</div>
                    <div className="text-base font-bold">{trustScore}</div>
                  </div>
                </div>
              )}

              <div className="mt-5">
                {isMatching ? (
                  <Button
                    onClick={() => stopMut.mutate()}
                    disabled={stopMut.isPending}
                    className="w-full h-12 text-base font-bold rounded-2xl bg-white text-violet-700 hover:bg-white/90 shadow-lg"
                  >
                    {stopMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Stop Matching
                  </Button>
                ) : (
                  <Button
                    onClick={() => startMut.mutate()}
                    disabled={startMut.isPending || isFrozen}
                    className="w-full h-12 text-base font-bold rounded-2xl bg-white text-violet-700 hover:bg-white/90 shadow-lg"
                  >
                    {startMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Radio className="w-4 h-4 mr-2" />}
                    Start Selling — 15 min
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="pending">
          <TabsList className="w-full">
            <TabsTrigger value="pending" className="flex-1">
              Pending {pendingConfirms.length > 0 && <span className="ml-1 px-1.5 bg-orange-500 text-white rounded-full text-xs">{pendingConfirms.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="chunks" className="flex-1">My Orders</TabsTrigger>
            <TabsTrigger value="me" className="flex-1">Me</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-2 mt-3">
            {pendingConfirms.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No pending confirmations.</CardContent></Card>
            ) : (
              pendingConfirms.map((c) => (
                <PendingConfirmCard key={c.id} chunk={c} onResolved={() => { refetchPending(); refetchChunks(); qc.invalidateQueries({ queryKey: ["me"] }); }} />
              ))
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

          <TabsContent value="me" className="space-y-3 mt-3">
            <MePanel user={user} onUpdated={() => refetchMe()} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function MePanel({ user, onUpdated }: { user: any; onUpdated: () => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState<string>(user.displayName || user.username || "");
  useEffect(() => { setName(user.displayName || user.username || ""); }, [user.displayName, user.username]);
  const saveMut = useMutation({
    mutationFn: () => api("/auth/update-name", { method: "POST", body: JSON.stringify({ displayName: name }) }),
    onSuccess: () => { toast({ title: "Naam update ho gaya" }); setEditing(false); onUpdated(); },
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

function PendingConfirmCard({ chunk, onResolved }: { chunk: any; onResolved: () => void }) {
  const { toast } = useToast();
  const [now, setNow] = useState(Date.now());
  const [showProof, setShowProof] = useState(false);
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
          Check your bank app for ₹{chunk.amount} from buyer's UPI. Confirm only if received.
        </div>

        {!showProof ? (
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" className="bg-green-600 hover:bg-green-700 h-12 text-base" disabled={confirmMut.isPending} onClick={() => confirmMut.mutate()}>
              YES — Received
            </Button>
            <Button size="lg" variant="destructive" className="h-12 text-base" onClick={() => setShowProof(true)}>
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
              ⚠ Opening a dispute will require you to upload bank statement, full screen recording, and last transaction screenshot within 24 hours.
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
          Auto-confirms to buyer in {fmtCountdown(remaining)} if no action taken.
        </div>
      </CardContent>
    </Card>
  );
}
