import React, { useEffect, useState } from "react";
import { useGetMe, useGetAppSettings } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import Layout from "@/components/layout";
import DisputePauseBanner from "@/components/dispute-pause-banner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, BookOpen, Clock, RefreshCw, ShieldCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
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
  const { data: user, isError } = useGetMe({ query: { retry: false } });
  const { data: settings } = useGetAppSettings();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showRules, setShowRules] = useState(false);

  const { data: chunks = [], refetch: refetchChunks } = useQuery<any[]>({
    queryKey: ["my-chunks"], queryFn: () => api("/p2p/my-chunks"), enabled: !!user, refetchInterval: 8000,
  });
  const { data: pendingConfirms = [], refetch: refetchPending } = useQuery<any[]>({
    queryKey: ["pending-confirms"], queryFn: () => api("/p2p/my-pending-confirmations"), enabled: !!user, refetchInterval: 4000,
  });

  useEffect(() => { if (isError) setLocation("/login"); }, [isError, setLocation]);

  const regenMut = useMutation({
    mutationFn: () => api("/p2p/regenerate-chunks", { method: "POST" }),
    onSuccess: () => { toast({ title: "Chunks regenerated" }); refetchChunks(); },
  });

  if (!user) return null;
  const trustScore = (user as any).trustScore ?? 0;
  const isFrozen = (user as any).isFrozen;
  const heldBalance = (user as any).heldBalance ?? 0;

  return (
    <Layout>
      <div className="flex items-center gap-3 p-4 bg-secondary text-secondary-foreground">
        <Link href="/"><ArrowLeft className="cursor-pointer" /></Link>
        <span className="font-bold text-lg flex-1">My Sell Queue</span>
        <button onClick={() => setShowRules((v) => !v)} className="flex items-center gap-1 text-xs bg-secondary-foreground/15 px-2 py-1 rounded">
          <BookOpen className="w-3.5 h-3.5" /> Rules
        </button>
        <button onClick={() => regenMut.mutate()} className="opacity-80 hover:opacity-100" title="Regenerate chunks">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      {showRules && (settings as any)?.sellRules && (
        <div className="p-4 bg-secondary/5 border-b border-secondary/20 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {(settings as any).sellRules}
        </div>
      )}
      <div className="px-4 pt-3"><DisputePauseBanner /></div>

      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="p-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div className="text-muted-foreground">Balance</div>
              <div className="text-base font-bold">₹{user.balance.toFixed(0)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Held</div>
              <div className="text-base font-bold">₹{Number(heldBalance).toFixed(0)}</div>
            </div>
            <div>
              <div className="text-muted-foreground flex items-center gap-1 justify-center"><ShieldCheck className="h-3 w-3" /> Trust</div>
              <div className={`text-base font-bold ${trustScore >= 0 ? "text-green-600" : "text-red-600"}`}>{trustScore}</div>
            </div>
          </CardContent>
        </Card>

        {isFrozen && (
          <Card className="border-red-400 bg-red-50">
            <CardContent className="p-3 text-sm text-red-700">Account frozen — sells paused.</CardContent>
          </Card>
        )}

        <Tabs defaultValue="pending">
          <TabsList className="w-full">
            <TabsTrigger value="pending" className="flex-1">
              Pending {pendingConfirms.length > 0 && <span className="ml-1 px-1.5 bg-orange-500 text-white rounded-full text-xs">{pendingConfirms.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="chunks" className="flex-1">My Chunks</TabsTrigger>
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
                  No active chunks. Connect UPI on home page to start auto-sell.
                </CardContent>
              </Card>
            ) : (
              chunks.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold">₹{c.amount}</div>
                      <div className="text-xs text-muted-foreground">Chunk #{c.id}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${STATUS_COLOR[c.status] || "bg-muted"}`}>{c.status.replace(/_/g, " ")}</span>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
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
    <Card className="border-orange-300">
      <CardContent className="p-4 space-y-3">
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

        <div className="bg-muted/50 rounded p-2 text-xs space-y-1">
          <div>UTR: <span className="font-mono font-semibold">{chunk.utrNumber}</span></div>
        </div>
        {chunk.screenshotUrl && (
          <a href={chunk.screenshotUrl} target="_blank" className="text-xs text-primary underline">View Screenshot</a>
        )}{" "}
        {chunk.recordingUrl && (
          <a href={chunk.recordingUrl} target="_blank" className="text-xs text-primary underline ml-2">View Recording</a>
        )}

        <div className="text-xs text-muted-foreground">
          Check your bank app for ₹{chunk.amount} from buyer's UPI. Confirm only if received.
        </div>

        {!showProof ? (
          <div className="grid grid-cols-2 gap-2">
            <Button className="bg-green-600 hover:bg-green-700" disabled={confirmMut.isPending} onClick={() => confirmMut.mutate()}>
              YES — Received
            </Button>
            <Button variant="destructive" onClick={() => setShowProof(true)}>
              NO — Not Received
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              className="w-full border rounded p-2 text-sm"
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
