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
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle, Clock, Copy, Headset, ShieldCheck, Upload, Wifi } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import screenshotImg from "@assets/Screenshot_20260419_224354_1776618846292.jpg";

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
  const { data: user, isError } = useGetMe({ query: { queryKey: ["me"], retry: false } });
  const { data: settings } = useGetAppSettings();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showRules, setShowRules] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef<number | null>(null);
  const pauseUntilRef = useRef(0);

  const { data: myBuy, refetch: refetchBuy } = useQuery<any>({
    queryKey: ["my-buy"],
    queryFn: () => api("/p2p/my-buy"),
    enabled: !!user,
    refetchInterval: 2000,
  });

  const { data: queue = [] } = useQuery<any[]>({
    queryKey: ["p2p-queue"],
    queryFn: () => api("/p2p/queue"),
    enabled: !!user && !myBuy,
    refetchInterval: 1000,
  });

  useEffect(() => { if (isError) setLocation("/login"); }, [isError, setLocation]);

  useEffect(() => {
    if (myBuy) return;
    const el = listRef.current;
    if (!el || queue.length < 2) return;

    const speedPerSecond = 720;
    let last = performance.now();
    let target = 0;

    const tick = (now: number) => {
      const current = listRef.current;
      if (!current) return;
      const shouldPause = Date.now() < pauseUntilRef.current;
      const maxScroll = current.scrollHeight - current.clientHeight;

      if (!shouldPause && maxScroll > 0) {
        const delta = ((now - last) / 1000) * speedPerSecond;
        current.scrollTop = Math.min(current.scrollTop + delta, maxScroll);
        if (current.scrollTop >= target - 1) {
          const next = current.querySelector<HTMLElement>(`[data-queue-item="${(target / 1)}"]`);
          target = current.scrollTop + (next?.offsetHeight || 120);
          if (target >= maxScroll) target = 0;
        }
        if (current.scrollTop >= maxScroll - 1) current.scrollTop = 0;
      }

      last = now;
      autoScrollRef.current = window.requestAnimationFrame(tick);
    };

    autoScrollRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (autoScrollRef.current) window.cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    };
  }, [myBuy, queue.length]);

  function pauseAutoScroll(ms = 1200) {
    pauseUntilRef.current = Date.now() + ms;
  }

  const lockMut = useMutation({
    mutationFn: (id: number) => api(`/p2p/lock/${id}`, { method: "POST" }),
    onSuccess: () => { refetchBuy(); qc.invalidateQueries({ queryKey: ["p2p-queue"] }); toast({ title: "Order locked! Pay now." }); },
    onError: (e: any) => toast({ title: "Failed to lock", description: e.message, variant: "destructive" }),
  });

  if (!user) return null;

  return (
    <Layout>
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary via-primary to-sky-600 text-primary-foreground">
        <Link href="/"><ArrowLeft className="cursor-pointer" /></Link>
        <span className="font-bold text-lg flex-1">Buy</span>
        <button onClick={() => setShowRules((v) => !v)} className="flex items-center gap-1 text-xs bg-primary-foreground/15 px-2.5 py-1.5 rounded-full">
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
        <div className="overflow-hidden">
          <img src={screenshotImg} alt="Buy preview" className="w-full rounded-2xl shadow-sm mb-2" />
        </div>
        {myBuy ? (
          <ActiveBuyCard buy={myBuy} refetch={refetchBuy} />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Available Orders</h2>
              <div className="text-xs text-muted-foreground">Swipe to browse more</div>
            </div>
            {queue.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">No orders available right now. Please wait — sellers are being matched continuously.</p>
                </CardContent>
              </Card>
            ) : (
              <div
                ref={listRef}
                className="space-y-2 max-h-[65vh] overflow-y-auto pr-0.5"
                onTouchStart={() => pauseAutoScroll(1600)}
                onTouchEnd={() => pauseAutoScroll(800)}
                onMouseEnter={() => pauseAutoScroll(2000)}
                onWheel={() => pauseAutoScroll(1600)}
              >
                {queue.map((c, index) => (
                  <Card
                    key={c.id}
                    data-queue-item={index}
                    className="hover:shadow-md transition-shadow rounded-2xl animate-pulse"
                    style={{ animationDuration: "2s" }}
                  >
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-xl font-black tracking-tight">₹{c.amount}</div>
                          <span className="rounded-full bg-yellow-300 text-black text-xs font-semibold px-2 py-1">UPI</span>
                          {c.seller?.lastSeenAt && isOnline(c.seller.lastSeenAt) && (
                            <span className="flex items-center gap-1 text-green-600 text-xs">
                              <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />
                              Online
                            </span>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl bg-muted/40 p-2">
                            <div className="text-muted-foreground">Income</div>
                            <div className="text-base font-bold text-primary">₹{c.rewardAmount}</div>
                            <div className="text-[11px] text-muted-foreground">{c.rewardPercent}% reward</div>
                          </div>
                          <div className="rounded-xl bg-muted/40 p-2">
                            <div className="text-muted-foreground">Quota</div>
                            <div className="text-base font-bold">₹{c.totalAmount}</div>
                            <div className="text-[11px] text-muted-foreground">Available</div>
                          </div>
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
                        className="shrink-0 rounded-full px-5 h-10"
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
            <div>Reward: <strong>₹{Number(buy.rewardAmount || 0).toFixed(2)}</strong></div>
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
      <Card className="border-red-400 bg-red-50 rounded-2xl">
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

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">₹{buy.amount}</div>
              <div className="text-xs text-green-600">+₹{Number(buy.rewardAmount || 0).toFixed(2)} reward ({buy.rewardPercent}%)</div>
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

          <div className="bg-muted/50 rounded-xl p-3 space-y-2 text-sm">
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
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Payment Screenshot <span className="text-red-600">*</span></Label>
                <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed ${screenshotUrl ? "border-green-400 bg-green-50" : "border-primary/50 bg-primary/5"} rounded-2xl p-5 cursor-pointer hover:bg-primary/10 transition-colors`}>
                  <Upload className={`w-8 h-8 ${screenshotUrl ? "text-green-600" : "text-primary"}`} />
                  <div className="text-sm font-semibold">
                    {screenshotUrl ? "Screenshot uploaded ✓" : "Tap to upload screenshot"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">JPG / PNG · max 5 MB</div>
                  <input type="file" accept="image/*" onChange={(e) => handleFile(e, "shot")} className="hidden" />
                </label>
              </div>
              <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-2 leading-snug">
                Optional: also record your screen while paying. You'll need it only if a dispute opens later.
              </div>
              <Button
                className="w-full h-12 text-base font-bold rounded-xl"
                disabled={!utr || !screenshotUrl || submitMut.isPending || !!uploading}
                onClick={() => submitMut.mutate()}
              >
                {submitMut.isPending ? "Submitting..." : "Submit Payment Proof"}
              </Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => cancelMut.mutate()}>
                Cancel Buy
              </Button>
      <Button variant="outline" size="sm" className="w-full" onClick={() => window.open((settings as any)?.telegramLink || "/support", "_blank")}>
                <Headset className="mr-2 h-4 w-4" />
                Contact Support
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
