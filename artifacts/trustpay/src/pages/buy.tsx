import React, { useEffect, useState } from "react";
import { useGetMe, useGetAppSettings } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import Layout from "@/components/layout";
import DisputePauseBanner from "@/components/dispute-pause-banner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle, Clock, Copy, Headset, Loader2, ShieldCheck, Upload } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type UpiEntry = {
  upiId: string;
  upiName: string;
  qrImageUrl?: string;
};

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

function buildUpiPayUrl(upiId: string, amount: number) {
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=TrustPay&am=${encodeURIComponent(String(amount))}&cu=INR`;
}

function openUpiApp(upiId: string, amount: number, app: "phonepe" | "paytm" | "gpay") {
  const base = buildUpiPayUrl(upiId, amount);
  const scheme =
    app === "phonepe"
      ? `phonepe://pay?pa=${encodeURIComponent(upiId)}&pn=TrustPay&am=${encodeURIComponent(String(amount))}&cu=INR`
      : app === "paytm"
        ? `paytmmp://pay?pa=${encodeURIComponent(upiId)}&pn=TrustPay&am=${encodeURIComponent(String(amount))}&cu=INR`
        : `tez://upi/pay?pa=${encodeURIComponent(upiId)}&pn=TrustPay&am=${encodeURIComponent(String(amount))}&cu=INR`;
  window.location.href = scheme;
  setTimeout(() => {
    window.location.href = base;
  }, 1200);
}

function PaymentActionDialog({ open, onOpenChange, onPayNow, onCancel, buy }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPayNow: () => void;
  onCancel: () => void;
  buy: any;
}) {
  if (!buy) return null;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-[28px] max-w-sm border border-white/60 bg-gradient-to-br from-white via-slate-50 to-indigo-50 shadow-[0_20px_70px_rgba(59,130,246,0.18)] overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-fuchsia-500 via-sky-500 to-emerald-400" />
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary via-sky-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg ring-4 ring-sky-100">
              <Clock className="h-5 w-5" />
            </div>
            <span className="font-bold">Payment pending</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-2 leading-relaxed">
            <span className="block">
              You locked <strong>₹{buy.amount}</strong>. Please pay now or cancel this buy.
            </span>
            <span className="block text-foreground/80">
              UPI: <strong>{buy.upiId}</strong>
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-2xl bg-white/60 border border-white/70 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Amount</span>
            <span className="font-semibold text-slate-800">₹{buy.amount}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>UPI</span>
            <span className="font-semibold text-slate-800 break-all text-right">{buy.upiId}</span>
          </div>
        </div>
        <AlertDialogFooter className="sm:justify-between gap-2">
          <AlertDialogCancel onClick={onCancel} className="rounded-full border-slate-300 bg-white/80 shadow-sm">Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onPayNow} className="rounded-full bg-gradient-to-r from-primary via-sky-500 to-fuchsia-500 hover:from-primary/90 hover:via-sky-600 hover:to-fuchsia-600 text-white shadow-lg">
            Buy Now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function Buy() {
  const [, setLocation] = useLocation();
  const { data: user, isError, isLoading: userLoading } = useGetMe({ query: { queryKey: ["me"], retry: false } });
  const { data: settings } = useGetAppSettings();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeUpis, setActiveUpis] = useState<UpiEntry[]>([]);

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
    const raw = (settings as any)?.multipleUpiIds;
    const arr = Array.isArray(raw) ? raw : [];
    setActiveUpis(arr.filter((u: any) => u?.upiId).map((u: any) => ({
      upiId: String(u.upiId || "").trim(),
      upiName: String(u.upiName || "").trim(),
      qrImageUrl: String(u.qrImageUrl || "").trim(),
    })));
  }, [settings]);
  const lockMut = useMutation({
    mutationFn: (id: number) => api(`/p2p/lock/${id}`, { method: "POST" }),
    onSuccess: () => { refetchBuy(); qc.invalidateQueries({ queryKey: ["p2p-queue"] }); toast({ title: "Order locked! Pay now." }); },
    onError: (e: any) => toast({ title: "This order may be bought by someone else", description: e.message, variant: "destructive" }),
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

  return (
    <Layout>
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary via-primary to-sky-600 text-primary-foreground">
        <Link href="/"><ArrowLeft className="cursor-pointer" /></Link>
        <span className="font-bold text-lg flex-1">Buy</span>
      </div>
      <div className="px-4 pt-3"><DisputePauseBanner /></div>
      <div className="p-4 space-y-4">
        {myBuy ? (
          <ActiveBuyCard buy={myBuy} refetch={refetchBuy} />
        ) : (
          <>
            {queue.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">No orders available right now. Please wait — sellers are being matched continuously.</p>
                </CardContent>
              </Card>
            ) : (
              <ChunkCarousel
                queue={queue}
                onLock={(id) => lockMut.mutate(id)}
                disabled={lockMut.isPending}
              />
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
  const { data: settings } = useGetAppSettings();
  const [now, setNow] = useState(Date.now());
  const [utr, setUtr] = useState("");
  const [screenshotUrl, setScreenshot] = useState("");
  const [recordingUrl, setRecording] = useState("");
  const [uploading, setUploading] = useState<"shot" | "rec" | null>(null);
  const [qrError, setQrError] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

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
      <Card className="rounded-[28px] shadow-xl border border-white/70 bg-gradient-to-br from-white via-sky-50 to-indigo-50 overflow-hidden">
        <CardContent className="p-4 space-y-4 relative">
          <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-sky-300 to-transparent" />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-black tracking-tight">₹{buy.amount}</div>
              <div className="inline-flex items-center gap-1 mt-1 text-xs text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                +₹{Number(buy.rewardAmount || 0).toFixed(2)} reward ({buy.rewardPercent}%)
              </div>
            </div>
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-full border ${expired ? "bg-red-50 text-red-600 border-red-100" : remaining < 5 * 60 * 1000 ? "bg-orange-50 text-orange-600 border-orange-100" : "bg-sky-50 text-sky-700 border-sky-100"}`}>
              <Clock className="h-4 w-4" />
              <span className="font-mono font-semibold">{fmtCountdown(remaining)}</span>
            </div>
          </div>

          {/* QR Code */}
          {!qrError && (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="p-4 rounded-[28px] bg-gradient-to-br from-white via-sky-50 to-fuchsia-50 shadow-[0_18px_50px_rgba(59,130,246,0.12)] border border-sky-200/70">
                <img
                  src={qrUrl}
                  alt="UPI QR Code"
                  className="w-44 h-44 rounded-2xl ring-4 ring-white/80 shadow-md"
                  onError={() => setQrError(true)}
                />
              </div>
              <div className="text-xs text-slate-500 font-medium">Scan with any UPI app</div>
            </div>
          )}

          <div className="rounded-[24px] p-3 space-y-2 text-sm bg-gradient-to-r from-sky-50 via-white to-fuchsia-50 border border-sky-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Pay to UPI:</span>
              <button onClick={() => { navigator.clipboard.writeText(buy.upiId); toast({ title: "Copied!" }); }} className="text-fuchsia-700 text-xs flex items-center gap-1 font-semibold">
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <div className="font-mono font-semibold break-all text-slate-900">{buy.upiId}</div>
            <div className="text-xs text-muted-foreground">Holder: {buy.holderName || buy.upiName}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-14 rounded-2xl border-0 bg-white shadow-md hover:shadow-lg flex items-center justify-center px-3 overflow-hidden"
              onClick={() => openUpiApp(buy.upiId, buy.amount, "phonepe")}
            >
              <img
                src={`${import.meta.env.BASE_URL}phonepe-logo.png`}
                alt="PhonePe"
                className="h-8 w-full object-contain"
              />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-14 rounded-2xl border-0 bg-white shadow-md hover:shadow-lg flex items-center justify-center px-3 overflow-hidden"
              onClick={() => openUpiApp(buy.upiId, buy.amount, "paytm")}
            >
              <img
                src={`${import.meta.env.BASE_URL}paytm-logo.png`}
                alt="Paytm"
                className="h-8 w-full object-contain"
              />
            </Button>
          </div>

          {expired ? (
            <Button variant="destructive" className="w-full" onClick={() => cancelMut.mutate()}>
              Lock Expired — Release
            </Button>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">UTR / Reference Number</Label>
                <Input className="border-fuchsia-200 bg-fuchsia-50/40 focus-visible:ring-fuchsia-300" placeholder="12-digit UTR from your UPI app" value={utr} onChange={(e) => setUtr(e.target.value.trim())} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Payment Screenshot <span className="text-red-600">*</span></Label>
                <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed ${screenshotUrl ? "border-emerald-400 bg-emerald-50" : "border-sky-300 bg-sky-50/70"} rounded-2xl p-5 cursor-pointer hover:bg-sky-100 transition-colors`}>
                  <Upload className={`w-8 h-8 ${screenshotUrl ? "text-emerald-600" : "text-sky-600"}`} />
                  <div className="text-sm font-semibold">
                    {screenshotUrl ? "Screenshot uploaded ✓" : "Tap to upload screenshot"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">JPG / PNG · max 5 MB</div>
                  <input type="file" accept="image/*" onChange={(e) => handleFile(e, "shot")} className="hidden" />
                </label>
              </div>
              <div className="text-[11px] text-muted-foreground bg-gradient-to-r from-slate-50 to-rose-50 rounded-xl p-2.5 leading-snug border border-rose-100">
                Optional: also record your screen while paying. You'll need it only if a dispute opens later.
              </div>
              <Button
                className="w-full h-12 text-base font-bold rounded-2xl bg-gradient-to-r from-primary via-sky-600 to-fuchsia-600 shadow-lg border border-fuchsia-200/60"
                disabled={!utr || !screenshotUrl || submitMut.isPending || !!uploading}
                onClick={() => setShowWarning(true)}
              >
                {submitMut.isPending ? "Submitting..." : "Submit Payment Proof"}
              </Button>
              <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
                  <AlertDialogContent className="rounded-[28px] border border-rose-200 bg-gradient-to-br from-white via-rose-50 to-orange-50 shadow-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" /> Confirm Payment Proof
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-left space-y-2 leading-relaxed">
                      <span className="block">
                        If you submit a fake payment, duplicate screenshot, wrong UTR, or
                        repeat someone else's UTR, your account's trust score will decrease
                        by <strong>10 points</strong>.
                      </span>
                      <span className="block">
                        If it reaches <strong>-50</strong>, your account will be suspended.
                      </span>
                      <span className="block pt-1 text-foreground/80">
                        Only proceed if you have actually paid <strong>₹{buy.amount}</strong>{" "}
                        to <strong>{buy.upiId}</strong> and the UTR is correct.
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="rounded-full border border-slate-300 bg-white/90 shadow-sm">Go Back</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => { setShowWarning(false); submitMut.mutate(); }}
                      className="rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 hover:from-red-700 hover:via-rose-700 hover:to-orange-700 text-white shadow-lg"
                    >
                      Yes, Submit
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="ghost" size="sm" className="w-full rounded-2xl border border-rose-200 bg-gradient-to-r from-white to-rose-50 text-rose-700 hover:from-rose-50 hover:to-rose-100 shadow-sm" onClick={() => cancelMut.mutate()}>
                Cancel Buy
              </Button>
              <Button variant="outline" size="sm" className="w-full rounded-2xl border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 to-sky-50 text-fuchsia-700 shadow-sm hover:from-fuchsia-100 hover:to-sky-100" onClick={() => window.open((settings as any)?.telegramLink || "/support", "_blank")}>
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

/**
 * Single-chunk spotlight carousel: one order at a time, auto-cycles every 3 s.
 * Alternates slide direction on each advance for a lively feel.
 * No scrollbar. Navigation arrows + dot indicators.
 */
function ChunkCarousel({ queue, onLock, disabled }: { queue: any[]; onLock: (id: number) => void; disabled: boolean }) {
  const [idx, setIdx] = useState(0);
  // "dir" tracks which side the new card slides in from: +1 = from right, -1 = from left
  const [dir, setDir] = useState(1);
  const [animKey, setAnimKey] = useState(0);

  const n = queue.length;

  const go = (next: number, direction: number) => {
    setDir(direction);
    setAnimKey((k) => k + 1);
    setIdx(((next % n) + n) % n);
  };

  // Auto-cycle every 3 s, alternating direction each time
  const autoDir = React.useRef(1);
  useEffect(() => {
    if (n < 2) return;
    const t = setInterval(() => {
      autoDir.current *= -1;
      setDir(autoDir.current);
      setAnimKey((k) => k + 1);
      setIdx((i) => ((i + 1) % n));
    }, 3200);
    return () => clearInterval(t);
  }, [n]);

  // Reset to first when queue changes
  useEffect(() => { setIdx(0); }, [n]);

  if (n === 0) return null;
  const chunk = queue[idx];

  const slideIn = dir > 0 ? "slideInRight" : "slideInLeft";

  return (
    <div className="space-y-4">
      {/* Counter */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span className="font-medium">{n} order{n !== 1 ? "s" : ""} available</span>
        <span>{idx + 1} / {n}</span>
      </div>

      {/* Card stage — fixed height, overflow hidden = no scrollbar */}
      <div className="relative overflow-hidden rounded-[28px]" style={{ minHeight: 180 }}>
        <style>{`
          @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          @keyframes slideInLeft  { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          .slide-in-right { animation: slideInRight 0.38s cubic-bezier(0.22,1,0.36,1) both; }
          .slide-in-left  { animation: slideInLeft  0.38s cubic-bezier(0.22,1,0.36,1) both; }
        `}</style>
        <div
          key={animKey}
          className={slideIn === "slideInRight" ? "slide-in-right" : "slide-in-left"}
        >
          <ChunkCard chunk={chunk} onLock={() => onLock(chunk.id)} disabled={disabled} />
        </div>
      </div>

      {/* Dot indicators */}
      {n > 1 && (
        <div className="flex justify-center gap-1.5">
          {queue.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i, i > idx ? 1 : -1)}
              className={`rounded-full transition-all ${i === idx ? "w-5 h-2 bg-primary" : "w-2 h-2 bg-muted-foreground/30"}`}
            />
          ))}
        </div>
      )}

      {/* Prev / Next arrows (only when multiple items) */}
      {n > 1 && (
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => go(idx - 1, -1)}
            className="flex-1 max-w-[140px] h-10 rounded-2xl border border-border/60 bg-muted/40 text-sm font-medium hover:bg-muted transition-colors"
          >
            ← Prev
          </button>
          <button
            onClick={() => go(idx + 1, 1)}
            className="flex-1 max-w-[140px] h-10 rounded-2xl border border-border/60 bg-muted/40 text-sm font-medium hover:bg-muted transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function ChunkCard({ chunk, onLock, disabled }: { chunk: any; onLock: () => void; disabled: boolean }) {
  const online = chunk.seller?.lastSeenAt && isOnline(chunk.seller.lastSeenAt);
  return (
    <Card className="rounded-[28px] shadow-2xl border border-white/70 bg-gradient-to-br from-white via-sky-50 to-indigo-50 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-fuchsia-500 via-sky-500 to-emerald-400" />
      <CardContent className="p-5 space-y-4">
        {/* Top: amount + badges */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Order Amount</div>
            <div className="text-5xl font-black tracking-tight text-slate-900">₹{chunk.amount}</div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="rounded-full bg-yellow-300 text-black text-[10px] font-bold px-3 py-1">UPI</span>
            {online && (
              <span className="flex items-center gap-1 text-green-700 bg-green-100 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                Seller Online
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
            <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide mb-1">You Earn</div>
            <div className="text-2xl font-black text-emerald-700">₹{Number(chunk.rewardAmount || 0).toFixed(2)}</div>
            <div className="text-[10px] text-emerald-500 font-medium mt-0.5">{chunk.rewardPercent}% reward</div>
          </div>
          <div className="rounded-2xl bg-sky-50 border border-sky-100 p-3">
            <div className="text-[10px] text-sky-600 font-semibold uppercase tracking-wide mb-1">Total Receive</div>
            <div className="text-2xl font-black text-sky-700">₹{Number(chunk.totalAmount || 0).toFixed(2)}</div>
            {chunk.seller && (
              <div className="flex items-center gap-1 text-[10px] text-sky-400 font-medium mt-0.5">
                <ShieldCheck className="h-3 w-3" />
                Trust {chunk.seller.trustScore ?? "N/A"}
              </div>
            )}
          </div>
        </div>

        {/* Buy button */}
        <button
          onClick={onLock}
          disabled={disabled}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-primary via-sky-500 to-fuchsia-500 text-white text-base font-bold shadow-lg disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {disabled ? "Locking..." : "Buy Now"}
        </button>
      </CardContent>
    </Card>
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
