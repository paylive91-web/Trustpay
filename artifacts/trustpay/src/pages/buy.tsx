import React, { useEffect, useRef, useState } from "react";
import { useGetMe, useGetAppSettings } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import Layout from "@/components/layout";
import DisputePauseBanner from "@/components/dispute-pause-banner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle, Clock, Copy, ShieldCheck, Upload, Wifi } from "lucide-react";
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

function isOnline(lastSeenAt?: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000;
}

function makeQrUrl(upiId: string, amount: number): string {
  const upiData = `upi://pay?pa=${encodeURIComponent(upiId)}&am=${amount}&tn=TrustPay&cu=INR`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiData)}`;
}

export default function Buy() {
  const [, setLocation] = useLocation();
  const { data: user, isError } = useGetMe({ query: { retry: false } });
  const { data: settings } = useGetAppSettings();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showRules, setShowRules] = useState(false);

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
    onSuccess: () => { refetchBuy(); qc.invalidateQueries({ queryKey: ["p2p-queue"] }); toast({ title: "Order locked! Pay now." }); },
    onError: (e: any) => toast({ title: "Failed to lock", description: e.message, variant: "destructive" }),
  });

  if (!user) return null;

  return (
    <Layout>
      <div className="flex items-center gap-3 p-4 bg-primary text-primary-foreground">
        <Link href="/"><ArrowLeft className="cursor-pointer" /></Link>
        <span className="font-bold text-lg flex-1">Buy</span>
        <button onClick={() => setShowRules((v) => !v)} className="flex items-center gap-1 text-xs bg-primary-foreground/15 px-2 py-1 rounded">
          <BookOpen className="w-3.5 h-3.5" /> Rules
        </button>
      </div>
      {showRules && (settings as any)?.buyRules && (
        <div className="p-4 bg-primary/5 border-b border-primary/20 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {(settings as any).buyRules}
        </div>
      )}
      <div className="px-4 pt-3"><DisputePauseBanner /></div>

      <div className="p-4 space-y-4">
        {myBuy ? (
          <ActiveBuyCard buy={myBuy} refetch={refetchBuy} />
        ) : (
          <>
            <h2 className="font-semibold text-sm">Available Orders</h2>
            {queue.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">No orders available right now. Please wait — sellers are being matched continuously.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-0.5">
                {queue.map((c) => (
                  <Card key={c.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-lg font-bold">₹{c.amount}</div>
                          {c.seller?.lastSeenAt && isOnline(c.seller.lastSeenAt) && (
                            <span className="flex items-center gap-1 text-green-600 text-xs">
                              <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />
                              Online
                            </span>
                          )}
                        </div>
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
                        className="shrink-0"
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
  const [qrError, setQrError] = useState(false);

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
    const limit = kind === "shot" ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
    if (f.size > limit) {
      toast({ title: "File too large", description: kind === "rec" ? "Max 50 MB" : "Max 5 MB", variant: "destructive" });
      return;
    }
    // Video: check duration >= 120s (2 min minimum)
    if (kind === "rec" && f.type.startsWith("video/")) {
      const ok = await checkVideoDuration(f, 120);
      if (!ok) {
        toast({ title: "Recording too short", description: "Screen recording must be at least 2 minutes long. Please record from before you initiate the payment.", variant: "destructive" });
        e.target.value = "";
        return;
      }
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
          <CheckCircle className="w-10 h-10 text-green-600 mx-auto" />
          <div className="text-green-700 font-semibold">Payment submitted — waiting for seller</div>
          <div className="text-xs text-muted-foreground">Auto-confirms in {fmtCountdown(remaining)} if seller doesn't respond</div>
          <div className="border-t pt-3 mt-2 text-left text-xs space-y-1">
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

  const qrUrl = makeQrUrl(buy.upiId, buy.amount);

  return (
    <div className="space-y-3">
      {/* Scammer warning */}
      <Card className="border-red-400 bg-red-50">
        <CardContent className="p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div className="text-xs text-red-700 space-y-1">
            <div className="font-semibold">Scam Alert — Read before paying</div>
            <ul className="list-disc pl-3 space-y-0.5">
              <li>Pay ONLY ₹{buy.amount} — no more, no less</li>
              <li>Pay ONLY to the UPI below — not to any other number</li>
              <li>NEVER share OTP, PIN, or password</li>
              <li>If asked for extra payment, report immediately</li>
            </ul>
          </div>
        </CardContent>
      </Card>

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

          {/* QR Code */}
          {!qrError && (
            <div className="flex flex-col items-center gap-2 py-2">
              <img
                src={qrUrl}
                alt="UPI QR Code"
                className="w-44 h-44 rounded-lg border"
                onError={() => setQrError(true)}
              />
              <div className="text-xs text-muted-foreground">Scan with any UPI app</div>
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Pay to UPI:</span>
              <button onClick={() => { navigator.clipboard.writeText(buy.upiId); toast({ title: "Copied!" }); }} className="text-primary text-xs flex items-center gap-1">
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <div className="font-mono font-semibold break-all">{buy.upiId}</div>
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
                <input type="file" accept="image/*" onChange={(e) => handleFile(e, "shot")} className="text-xs w-full" />
                {screenshotUrl && <div className="text-xs text-green-600 flex items-center gap-1"><Upload className="h-3 w-3" /> Loaded</div>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Screen Recording (min 2 min)</Label>
                {/* Recording instructions */}
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 space-y-1">
                  <div className="font-medium">How to record:</div>
                  <ol className="list-decimal pl-3 space-y-0.5">
                    <li>Start screen recording BEFORE opening your UPI app</li>
                    <li>Open UPI app → Enter UPI ID → Pay ₹{buy.amount}</li>
                    <li>Show transaction success screen</li>
                    <li>Stop recording (must be at least 2 minutes total)</li>
                  </ol>
                </div>
                <input type="file" accept="video/*" onChange={(e) => handleFile(e, "rec")} className="text-xs w-full" />
                {uploading === "rec" && <div className="text-xs text-blue-600">Checking duration...</div>}
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
    </div>
  );
}

function checkVideoDuration(file: File, minSeconds: number): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration >= minSeconds);
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(true); }; // allow on error
    video.src = url;
  });
}
