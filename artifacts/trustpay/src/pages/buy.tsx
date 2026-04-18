import React, { useEffect, useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, Copy, ShieldCheck, Upload } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
async function api(path: string, opts: RequestInit = {}) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

function fmtCountdown(ms: number) {
  if (ms <= 0) return "00:00";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Buy() {
  const [, setLocation] = useLocation();
  const { data: user, isError } = useGetMe({ query: { retry: false } });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: myBuy, refetch: refetchBuy } = useQuery<any>({
    queryKey: ["my-buy"],
    queryFn: () => api("/p2p/my-buy"),
    enabled: !!user,
    refetchInterval: 5000,
  });

  const { data: queue = [] } = useQuery<any[]>({
    queryKey: ["p2p-queue"],
    queryFn: () => api("/p2p/queue"),
    enabled: !!user && !myBuy,
    refetchInterval: 7000,
  });

  useEffect(() => { if (isError) setLocation("/login"); }, [isError, setLocation]);

  const lockMut = useMutation({
    mutationFn: (id: number) => api(`/p2p/lock/${id}`, { method: "POST" }),
    onSuccess: () => { refetchBuy(); qc.invalidateQueries({ queryKey: ["p2p-queue"] }); toast({ title: "Chunk locked! Pay now." }); },
    onError: (e: any) => toast({ title: "Failed to lock", description: e.message, variant: "destructive" }),
  });

  if (!user) return null;

  return (
    <Layout>
      <div className="flex items-center gap-3 p-4 bg-primary text-primary-foreground">
        <Link href="/"><ArrowLeft className="cursor-pointer" /></Link>
        <span className="font-bold text-lg">Buy</span>
      </div>

      <div className="p-4 space-y-4">
        {myBuy ? (
          <ActiveBuyCard buy={myBuy} refetch={refetchBuy} />
        ) : (
          <>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <h3 className="font-semibold text-primary mb-1">How it works</h3>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                  <li>Pick any chunk below — you have 15 min to pay seller via UPI</li>
                  <li>Submit UTR + screenshot + screen recording within the time limit</li>
                  <li>Once seller confirms, balance + reward credited instantly</li>
                  <li>Only ONE active buy at a time</li>
                </ul>
              </CardContent>
            </Card>

            <h2 className="font-semibold text-sm">Available Chunks ({queue.length})</h2>
            {queue.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">No chunks available right now. Please wait — sellers are being matched continuously.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {queue.map((c) => (
                  <Card key={c.id} className="hover:shadow-md">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <div className="text-lg font-bold">₹{c.amount}</div>
                        <div className="text-xs text-green-600">+₹{c.rewardAmount} reward ({c.rewardPercent}%)</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Total credit: <span className="font-semibold">₹{c.totalAmount}</span>
                        </div>
                        {c.seller && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <ShieldCheck className="h-3 w-3" />
                            Seller trust: <span className={c.seller.trustScore >= 0 ? "text-green-600" : "text-red-600"}>{c.seller.trustScore}</span>
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => lockMut.mutate(c.id)}
                        disabled={lockMut.isPending}
                      >
                        Buy
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function ActiveBuyCard({ buy, refetch }: { buy: any; refetch: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [utr, setUtr] = useState("");
  const [screenshotUrl, setScreenshot] = useState("");
  const [recordingUrl, setRecording] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<"shot" | "rec" | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const deadline = new Date(buy.confirmDeadline).getTime();
  const remaining = deadline - now;
  const expired = remaining <= 0;

  const cancelMut = useMutation({
    mutationFn: () => api(`/p2p/cancel/${buy.id}`, { method: "POST" }),
    onSuccess: () => { toast({ title: "Cancelled" }); refetch(); qc.invalidateQueries({ queryKey: ["p2p-queue"] }); },
  });

  const submitMut = useMutation({
    mutationFn: () => api(`/p2p/submit/${buy.id}`, { method: "POST", body: JSON.stringify({ utrNumber: utr, screenshotUrl, recordingUrl }) }),
    onSuccess: () => { toast({ title: "Submitted! Seller will confirm." }); refetch(); },
    onError: (e: any) => toast({ title: "Submit failed", description: e.message, variant: "destructive" }),
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>, kind: "shot" | "rec") {
    const f = e.target.files?.[0];
    if (!f) return;
    const limit = kind === "shot" ? 5 * 1024 * 1024 : 30 * 1024 * 1024;
    if (f.size > limit) {
      toast({ title: "File too large", variant: "destructive" });
      return;
    }
    setUploading(kind);
    try {
      const url = await fileToDataUrl(f);
      if (kind === "shot") setScreenshot(url); else setRecording(url);
    } finally { setUploading(null); }
  }

  if (buy.status === "pending_confirmation") {
    return (
      <Card>
        <CardContent className="p-5 text-center space-y-2">
          <div className="text-amber-600 font-semibold">Waiting for seller confirmation</div>
          <div className="text-xs text-muted-foreground">Auto-confirms in {fmtCountdown(remaining)} if seller doesn't respond</div>
          <div className="border-t pt-3 mt-2 text-left text-xs">
            <div>Amount: <strong>₹{buy.amount}</strong></div>
            <div>UTR: <strong>{buy.utrNumber}</strong></div>
            <div>Reward: <strong>₹{buy.rewardAmount}</strong></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (buy.status === "disputed") {
    return (
      <Card className="border-red-300">
        <CardContent className="p-5 text-center space-y-2">
          <div className="text-red-600 font-semibold">Dispute Open</div>
          <p className="text-xs text-muted-foreground">Seller marked your payment as not received. Please go to Orders &gt; Disputes and upload your bank statement within 24 hours, or you will lose this dispute automatically.</p>
          <Link href="/orders"><Button variant="outline" className="mt-2">Open Disputes</Button></Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">₹{buy.amount}</div>
            <div className="text-xs text-green-600">+₹{buy.rewardAmount} reward ({buy.rewardPercent}%)</div>
          </div>
          <div className={`flex items-center gap-1 text-sm ${expired ? "text-red-600" : remaining < 5 * 60 * 1000 ? "text-orange-600" : "text-primary"}`}>
            <Clock className="h-4 w-4" />
            <span className="font-mono font-semibold">{fmtCountdown(remaining)}</span>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Pay to UPI:</span>
            <button onClick={() => { navigator.clipboard.writeText(buy.upiId); toast({ title: "Copied!" }); }} className="text-primary text-xs flex items-center gap-1">
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
          <div className="font-mono font-semibold">{buy.upiId}</div>
          <div className="text-xs text-muted-foreground">Holder: {buy.holderName || buy.upiName}</div>
        </div>

        {expired ? (
          <Button variant="destructive" className="w-full" onClick={() => cancelMut.mutate()}>
            Lock Expired — Release
          </Button>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">UTR / Reference Number</Label>
              <Input placeholder="12-digit UTR from your UPI app" value={utr} onChange={(e) => setUtr(e.target.value.trim())} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Screenshot</Label>
              <input type="file" accept="image/*" onChange={(e) => handleFile(e, "shot")} className="text-xs" />
              {screenshotUrl && <div className="text-xs text-green-600 flex items-center gap-1"><Upload className="h-3 w-3" /> Loaded</div>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Screen Recording (mandatory)</Label>
              <input type="file" accept="video/*" onChange={(e) => handleFile(e, "rec")} className="text-xs" />
              {recordingUrl && <div className="text-xs text-green-600 flex items-center gap-1"><Upload className="h-3 w-3" /> Loaded</div>}
            </div>
            <Button
              className="w-full"
              disabled={!utr || !screenshotUrl || !recordingUrl || submitMut.isPending || !!uploading}
              onClick={() => submitMut.mutate()}
            >
              {submitMut.isPending ? "Submitting..." : "Submit Payment Proof"}
            </Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => cancelMut.mutate()}>
              Cancel Buy
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
