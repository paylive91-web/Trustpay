import React, { useEffect, useState } from "react";
import { useGetMe, useGetAppSettings } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import Layout from "@/components/layout";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle, Clock, Copy, Headset, Loader2, ShieldCheck, Upload, ShieldAlert, Coins, IndianRupee } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { utrError } from "@/lib/utr-validator";
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

import { API_BASE } from "@/lib/api-config";

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

  // Polling cadence is dynamic by activity:
  //  - my-buy: 3s while there is an active order, 30s when idle (no buy yet).
  //  - queue:  2s while queued waiting to match, paused once myBuy exists.
  //  - cooldown: 10s only while actually in cooldown, otherwise 60s.
  // This mirrors the sell.tsx perf rework — it cuts background traffic ~10x
  // when the user is idle on the page, which directly reduces server load.
  const { data: myBuy, refetch: refetchBuy } = useQuery<any>({
    queryKey: ["my-buy"],
    queryFn: () => api("/p2p/my-buy"),
    enabled: !!user,
    refetchInterval: (query) => (query.state.data ? 3000 : 30_000),
  });

  const { data: queue = [] } = useQuery<any[]>({
    queryKey: ["p2p-queue"],
    queryFn: () => api("/p2p/queue"),
    enabled: !!user && !myBuy,
    refetchInterval: 2000,
  });

  const { data: cooldownData, refetch: refetchCooldown } = useQuery<{
    inCooldown: boolean;
    cooldownUntil: string | null;
    level: number;
    failedLockCount: number;
    chancesLeft: number;
  }>({
    queryKey: ["buyer-cooldown"],
    queryFn: () => api("/p2p/buyer-cooldown"),
    enabled: !!user && !myBuy,
    refetchInterval: (query) => (query.state.data?.inCooldown ? 10_000 : 60_000),
  });

  const [cooldownMs, setCooldownMs] = useState(0);
  useEffect(() => {
    if (!cooldownData?.inCooldown || !cooldownData.cooldownUntil) { setCooldownMs(0); return; }
    const tick = () => setCooldownMs(Math.max(0, new Date(cooldownData.cooldownUntil!).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [cooldownData?.cooldownUntil, cooldownData?.inCooldown]);

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
    onError: (e: any) => {
      if (e.message === "buyer_cooldown") { refetchCooldown(); return; }
      if (e.message === "order_being_locked" || e.message === "Race - chunk just taken" || (e.status === 409)) {
        toast({ title: "Order already taken!", description: "Another buyer got there first. Choose a different order.", variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["p2p-queue"] });
        return;
      }
      toast({ title: "Could not lock order", description: e.message, variant: "destructive" });
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

  return (
    <Layout>
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary via-primary to-sky-600 text-primary-foreground">
        <Link href="/"><ArrowLeft className="cursor-pointer" /></Link>
        <span className="font-bold text-lg flex-1">Buy</span>
      </div>
      <div className="p-4 space-y-4">
        {/* Buy modality switcher — INR (existing UPI flow) vs USDT TRC-20.
            Routes to dedicated USDT pages so the existing P2P state, locks
            and chunk-carousel logic below stay untouched. */}
        <BuyModeTabs />

        {myBuy ? (
          <ActiveBuyCard buy={myBuy} refetch={refetchBuy} user={user} />
        ) : (
          <>
            {/* Buyer Cooldown Banner */}
            {cooldownData?.inCooldown && cooldownMs > 0 && (
              <div className="rounded-[20px] border border-orange-300 bg-gradient-to-br from-orange-50 via-amber-50 to-red-50 p-4 shadow-md space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-orange-800 text-sm">Buy Access Temporarily Locked</div>
                    <div className="text-xs text-orange-600">You locked orders without completing payment too many times.</div>
                  </div>
                </div>
                <div className="rounded-2xl bg-white/70 border border-orange-200 p-3 flex items-center justify-between">
                  <span className="text-sm text-orange-700 font-medium">Time remaining</span>
                  <span className="font-mono text-2xl font-black text-orange-600 tracking-tight">
                    {(() => {
                      const totalSec = Math.floor(cooldownMs / 1000);
                      const h = Math.floor(totalSec / 3600);
                      const m = Math.floor((totalSec % 3600) / 60);
                      const s = totalSec % 60;
                      return h > 0
                        ? `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
                        : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
                    })()}
                  </span>
                </div>
                <p className="text-xs text-orange-600 text-center">
                  Complete payments on time to avoid longer bans. Repeated behavior leads to account freeze.
                </p>
              </div>
            )}

            {/* Chances remaining warning (when not in cooldown but has failed locks) */}
            {!cooldownData?.inCooldown && (cooldownData?.failedLockCount ?? 0) > 0 && (
              <div className="rounded-2xl border border-yellow-300 bg-yellow-50 px-4 py-2.5 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
                <span className="text-xs text-yellow-800 font-medium">
                  Warning: {cooldownData!.chancesLeft} chance{cooldownData!.chancesLeft === 1 ? "" : "s"} left — lock orders only if you're ready to pay.
                </span>
              </div>
            )}

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
              <ChunkCarousel
                queue={queue}
                onLock={(id) => lockMut.mutate(id)}
                disabled={lockMut.isPending || (cooldownData?.inCooldown === true && cooldownMs > 0)}
              />
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function BuyModeTabs() {
  const [, setLocation] = useLocation();
  const { data: usdtConfig } = useQuery<any>({
    queryKey: ["usdt-public-config"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/usdt/public-config`);
      if (!r.ok) return { enabled: false };
      return r.json();
    },
    staleTime: 60_000,
  });
  if (!usdtConfig?.enabled) return null;
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-1 flex shadow-sm">
      <button
        type="button"
        className="flex-1 rounded-xl px-3 py-2.5 flex items-center justify-center gap-2 text-sm font-bold bg-gradient-to-br from-primary via-primary to-sky-600 text-primary-foreground shadow-md"
        data-testid="tab-buy-inr"
      >
        <IndianRupee className="h-4 w-4" /> INR (UPI)
      </button>
      <button
        type="button"
        onClick={() => setLocation("/usdt-deposit")}
        className="flex-1 rounded-xl px-3 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
        data-testid="tab-buy-usdt"
      >
        <Coins className="h-4 w-4 text-emerald-500" /> USDT (TRC-20)
      </button>
    </div>
  );
}

function ActiveBuyCard({ buy, refetch, user }: { buy: any; refetch: () => void; user?: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: settings } = useGetAppSettings();
  const [now, setNow] = useState(Date.now());
  const [utr, setUtr] = useState("");
  const [screenshotUrl, setScreenshot] = useState("");
  const [recordingUrl, setRecording] = useState("");
  const [uploading, setUploading] = useState<"shot" | "rec" | null>(null);
  const [screenshotCheck, setScreenshotCheck] = useState<{
    isExactDuplicate?: boolean;
    isSimilarDuplicate?: boolean;
    qualityIssue?: string | null;
    hasPaymentIndicators?: boolean;
    checking?: boolean;
  } | null>(null);
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
      if (kind === "shot") {
        setScreenshot(url);
        setScreenshotCheck({ checking: true });
        try {
          const res = await api("/p2p/check-screenshot", { method: "POST", body: JSON.stringify({ screenshotUrl: url }) });
          setScreenshotCheck(res);
        } catch {
          setScreenshotCheck(null);
        }
      } else {
        setRecording(url);
      }
    } finally { setUploading(null); }
  }

  if (buy.status === "pending_confirmation") {
    const submittedAt = buy.submittedAt ? new Date(buy.submittedAt).getTime() : 0;
    const msSince = submittedAt ? now - submittedAt : 0;
    const DISPUTE_WAIT = 15 * 60 * 1000;
    const disputeUnlocked = msSince >= DISPUTE_WAIT;
    const msToDispute = Math.max(0, DISPUTE_WAIT - msSince);
    const disputeProgress = Math.min(100, (msSince / DISPUTE_WAIT) * 100);
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="text-center">
            <CheckCircle className="w-10 h-10 text-green-600 mx-auto" />
            <div className="text-green-700 font-semibold mt-2">Payment submitted — waiting for seller</div>
            <div className="text-xs text-muted-foreground">Auto-confirms in {fmtCountdown(remaining)}</div>
          </div>
          <div className="border-t pt-3 text-xs space-y-1">
            <div>Amount: <strong>₹{buy.amount}</strong></div>
            <div>UTR: <strong>{buy.utrNumber}</strong></div>
            <div>Reward: <strong>₹{Number(buy.rewardAmount || 0).toFixed(2)}</strong></div>
          </div>
          <div className="border-t pt-3">
            {!disputeUnlocked ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Seller not confirming?</span>
                  <span className="font-semibold text-orange-600">Dispute available in {fmtCountdown(msToDispute)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${disputeProgress}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  If seller does not respond within 15 minutes, you can open a dispute.
                </p>
              </div>
            ) : (
              <BuyerDisputeSection buy={buy} onResolved={refetch} />
            )}
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
          <Link href="/orders?tab=disputes"><Button variant="outline" className="mt-2">Open Disputes</Button></Link>
        </CardContent>
      </Card>
    );
  }

  const qrUrl = makeQrUrl(buy.upiId, buy.amount);

  const warnCount = user?.fraudWarningCount ?? 0;
  const warningsLeft = 3 - warnCount;

  return (
    <div className="space-y-3">
      {warnCount > 0 && warnCount < 3 && (
        <div className="flex items-start gap-2 bg-orange-50 border border-orange-300 rounded-2xl px-4 py-3 text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
          <div>
            <div className="font-semibold">Warning ({warnCount}/3): Suspicious payment activity detected.</div>
            <div className="text-xs mt-0.5">{warningsLeft} more warning{warningsLeft > 1 ? "s" : ""} will freeze your account. Please submit valid payment proof.</div>
          </div>
        </div>
      )}
      <Card className="rounded-[28px] shadow-xl border border-white/70 bg-gradient-to-br from-white via-sky-50 to-indigo-50 overflow-hidden">
        <CardContent className="p-4 space-y-4 relative">
          <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-sky-300 to-transparent" />
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-black tracking-tight">₹{buy.amount}</div>
                <button
                  type="button"
                  className="flex items-center justify-center w-7 h-7 rounded-full bg-sky-100 hover:bg-sky-200 transition-colors"
                  title="Copy amount"
                  onClick={() => {
                    navigator.clipboard.writeText(String(buy.amount)).then(() => {
                      toast({ title: "Amount copied!", description: `₹${buy.amount} copied to clipboard` });
                    }).catch(() => {
                      toast({ title: "Copy failed", description: "Please copy manually", variant: "destructive" });
                    });
                  }}
                >
                  <Copy className="w-3.5 h-3.5 text-sky-600" />
                </button>
              </div>
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
                <Input
                  className={`focus-visible:ring-fuchsia-300 ${utr && utrError(utr) ? "border-red-400 bg-red-50/60" : utr && !utrError(utr) ? "border-emerald-400 bg-emerald-50/40" : "border-fuchsia-200 bg-fuchsia-50/40"}`}
                  placeholder="12-character UTR (e.g. T12345678901)"
                  value={utr}
                  maxLength={12}
                  onChange={(e) => setUtr(e.target.value.trim().toUpperCase())}
                />
                {utr && utrError(utr) && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {utrError(utr)}
                  </p>
                )}
                {utr && !utrError(utr) && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    UTR format is valid
                  </p>
                )}
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
                {screenshotCheck?.checking && (
                  <p className="text-xs text-sky-600 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Verifying screenshot...
                  </p>
                )}
                {screenshotCheck && !screenshotCheck.checking && (screenshotCheck.isExactDuplicate || screenshotCheck.isSimilarDuplicate) && (
                  <p className="text-xs text-red-600 flex items-center gap-1 font-semibold">
                    <AlertTriangle className="h-3 w-3" />
                    {screenshotCheck.isExactDuplicate
                      ? "This screenshot has already been used in a previous transaction."
                      : "This screenshot looks very similar to one already used — please upload a fresh screenshot."}
                  </p>
                )}
                {screenshotCheck && !screenshotCheck.checking && screenshotCheck.qualityIssue && (
                  <p className="text-xs text-orange-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {screenshotCheck.qualityIssue}
                  </p>
                )}
                {screenshotCheck && !screenshotCheck.checking && !screenshotCheck.isExactDuplicate && !screenshotCheck.isSimilarDuplicate && !screenshotCheck.qualityIssue && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Screenshot looks valid
                  </p>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground bg-gradient-to-r from-slate-50 to-rose-50 rounded-xl p-2.5 leading-snug border border-rose-100">
                Optional: also record your screen while paying. You'll need it only if a dispute opens later.
              </div>
              <Button
                className="w-full h-12 text-base font-bold rounded-2xl bg-gradient-to-r from-primary via-sky-600 to-fuchsia-600 shadow-lg border border-fuchsia-200/60"
                disabled={!utr || !!utrError(utr) || !screenshotUrl || submitMut.isPending || !!uploading}
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
              <Button variant="outline" size="sm" className="w-full rounded-2xl border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 to-sky-50 text-fuchsia-700 shadow-sm hover:from-fuchsia-100 hover:to-sky-100" onClick={() => window.open((settings as any)?.telegramSupportUrl || (settings as any)?.telegramLink || "/support", "_blank")}>
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
 * Randomized queue: all orders stay visible, but their positions reshuffle
 * every few seconds so it feels like someone else may have purchased first.
 */
const CARD_H = 128;
const CARD_GAP = 10;

function ChunkCarousel({ queue, onLock, disabled }: { queue: any[]; onLock: (id: number) => void; disabled: boolean }) {
  // Build a "looped" display queue: repeat real orders enough times so the
  // user always sees a long, busy list (>= 24 cards) even when only a few
  // real chunks exist. Each repeat carries a unique key so React renders
  // them as distinct cards.
  const displayQueue = React.useMemo(() => {
    if (queue.length === 0) return [] as Array<{ chunk: any; key: string }>;
    const TARGET = 24;
    const repeats = Math.max(1, Math.ceil(TARGET / queue.length));
    const out: Array<{ chunk: any; key: string }> = [];
    for (let r = 0; r < repeats; r++) {
      for (const c of queue) {
        out.push({ chunk: c, key: `${c.id}-${r}` });
      }
    }
    return out;
  }, [queue]);

  // `slots[i]` = which visual slot card at displayQueue index i occupies
  const [slots, setSlots] = useState<number[]>(() => displayQueue.map((_, i) => i));

  // Re-sync slots when display length changes (new order arrived / order gone)
  useEffect(() => {
    setSlots(displayQueue.map((_, i) => i));
  }, [displayQueue.length]);

  // Helper: do `swaps` random pair-swaps in one shot so multiple cards
  // visibly move together each tick.
  const reshuffle = (prev: number[], swaps: number) => {
    const next = [...prev];
    if (next.length < 2) return next;
    for (let s = 0; s < swaps; s++) {
      const a = Math.floor(Math.random() * next.length);
      let b = Math.floor(Math.random() * (next.length - 1));
      if (b >= a) b += 1;
      [next[a], next[b]] = [next[b], next[a]];
    }
    return next;
  };

  // Start reshuffling almost immediately after the queue appears.
  useEffect(() => {
    if (displayQueue.length < 2) return;
    const t = setTimeout(() => {
      setSlots((prev) => reshuffle(prev, Math.max(2, Math.floor(prev.length / 2))));
    }, 350);
    return () => clearTimeout(t);
  }, [displayQueue.length]);

  // Every 600 ms swap multiple pairs so the whole list visibly shuffles.
  useEffect(() => {
    if (displayQueue.length < 2) return;
    const timer = setInterval(() => {
      setSlots((prev) => reshuffle(prev, Math.max(2, Math.floor(prev.length / 2))));
    }, 1400);
    return () => clearInterval(timer);
  }, [displayQueue.length]);

  const containerH = displayQueue.length * CARD_H + (displayQueue.length - 1) * CARD_GAP;

  return (
    <div style={{ position: "relative", height: displayQueue.length * CARD_H + (displayQueue.length - 1) * CARD_GAP }}>
      {displayQueue.map(({ chunk, key }, idx) => {
        const slot = slots[idx] ?? idx;
        const topPx = slot * (CARD_H + CARD_GAP);
        return (
          <div
            key={key}
            style={{
              position: "absolute",
              top: topPx,
              left: 0,
              right: 0,
              height: CARD_H,
              transition: "top 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <ChunkCard chunk={chunk} onLock={() => onLock(chunk.id)} disabled={disabled} />
          </div>
        );
      })}
    </div>
  );
}

function ChunkCard({ chunk, onLock, disabled }: { chunk: any; onLock: () => void; disabled: boolean }) {
  const online = chunk.seller?.lastSeenAt && isOnline(chunk.seller.lastSeenAt);
  return (
      <Card className="rounded-[22px] shadow-sm border border-border/60 bg-card h-full overflow-hidden">
      <CardContent className="p-3 h-full flex flex-col justify-between">
        {/* Row 1: amount + UPI badge + online */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[23px] sm:text-[25px] font-black tracking-tight leading-none truncate">₹{chunk.amount}</span>
          <span className="rounded-full bg-yellow-300 text-black text-[10px] font-bold px-3 py-1">UPI</span>
          {online && (
            <span className="flex items-center gap-1 text-green-600 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
              Online
            </span>
          )}
        </div>
        {/* Row 2: income + quota boxes + Buy button */}
        <div className="flex items-center gap-2 mt-2 min-w-0">
          <div className="flex-1 rounded-2xl bg-muted/50 p-3 min-w-0">
            <div className="text-[11px] text-muted-foreground font-medium">Income</div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-[18px] font-black text-emerald-700 truncate">₹{chunk.rewardAmount}</div>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 whitespace-nowrap">{chunk.rewardPercent}%+6</span>
            </div>
          </div>
          <div className="flex-1 rounded-2xl bg-muted/50 p-3 min-w-0">
            <div className="text-[11px] text-muted-foreground font-medium">Quota</div>
            <div className="text-[18px] font-black text-slate-900 truncate">+ {chunk.totalAmount}</div>
          </div>
          <button
            onClick={onLock}
            disabled={disabled}
            className="w-28 h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shrink-0 flex items-center justify-center shadow disabled:opacity-50 active:scale-95 transition-transform"
          >
            Buy
          </button>
        </div>
        {/* Row 3: seller trust */}
        {chunk.seller && (
          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 leading-none">
            <ShieldCheck className="h-3 w-3" />
            Seller trust:{" "}
            <span className={chunk.seller.trustScore >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
              {chunk.seller.trustScore}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BuyerDisputeSection({ buy, onResolved }: { buy: any; onResolved: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [bankUrl, setBankUrl] = useState("");
  const [txUrl, setTxUrl] = useState("");
  const [recUrl, setRecUrl] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>, kind: "bank" | "tx" | "rec") {
    const f = e.target.files?.[0];
    if (!f) return;
    const isVideo = f.type.startsWith("video/");
    const maxMb = isVideo ? 50 : 5;
    if (f.size > maxMb * 1024 * 1024) {
      toast({ title: "File too large", description: `Max ${maxMb} MB`, variant: "destructive" });
      return;
    }
    setUploading(kind);
    try {
      const url = await fileToDataUrl(f);
      if (kind === "bank") setBankUrl(url);
      else if (kind === "tx") setTxUrl(url);
      else setRecUrl(url);
    } finally { setUploading(null); }
  }

  const submitMut = useMutation({
    mutationFn: () => api(`/p2p/buyer-dispute/${buy.id}`, {
      method: "POST",
      body: JSON.stringify({ bankStatementUrl: bankUrl, txHistoryUrl: txUrl || undefined, recordingUrl: recUrl || undefined }),
    }),
    onSuccess: () => {
      toast({ title: "Dispute submitted!", description: "Admin will review your case. Keep your payment proof safe." });
      setOpen(false);
      onResolved();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-700 text-sm">Seller did not confirm within 15 minutes</div>
            <div className="text-xs text-red-600 mt-0.5">You can escalate this to admin by opening a dispute.</div>
          </div>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl"
        >
          Open Dispute
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[92%] w-[420px] rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="h-5 w-5" /> Open a Dispute
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <p className="text-xs text-muted-foreground">
              Please upload all 3 proofs below. Admin will review them to resolve this dispute in your favor.
            </p>

            <div className="space-y-1">
              <Label className="text-sm font-semibold">1. Bank Statement PDF <span className="text-red-500">*</span></Label>
              <p className="text-xs text-muted-foreground">PDF bank statement showing ₹{buy.amount} debit</p>
              <label className={`flex items-center gap-2 border-2 border-dashed rounded-xl p-3 cursor-pointer transition-colors ${bankUrl ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-primary/50"}`}>
                <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs">{bankUrl ? "✅ PDF uploaded" : uploading === "bank" ? "Uploading..." : "Choose bank statement PDF"}</span>
                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handleFile(e, "bank")} />
              </label>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold">2. Transaction History Screenshot</Label>
              <p className="text-xs text-muted-foreground">Screenshot of PhonePe / Paytm / GPay transaction history page</p>
              <label className={`flex items-center gap-2 border-2 border-dashed rounded-xl p-3 cursor-pointer transition-colors ${txUrl ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-primary/50"}`}>
                <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs">{txUrl ? "✅ Screenshot uploaded" : uploading === "tx" ? "Uploading..." : "Choose transaction screenshot"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, "tx")} />
              </label>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold">3. Screen Recording Video</Label>
              <p className="text-xs text-muted-foreground">Screen recording of your payment (minimum 2 minutes)</p>
              <label className={`flex items-center gap-2 border-2 border-dashed rounded-xl p-3 cursor-pointer transition-colors ${recUrl ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-primary/50"}`}>
                <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs">{recUrl ? "✅ Recording uploaded" : uploading === "rec" ? "Uploading..." : "Choose screen recording (.mp4)"}</span>
                <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFile(e, "rec")} />
              </label>
            </div>

            <Button
              onClick={() => submitMut.mutate()}
              disabled={!bankUrl || submitMut.isPending || !!uploading}
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl"
            >
              {submitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Dispute
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Submitting a false dispute will deduct 10 trust score. Only submit if you have actually made the payment and the seller has not confirmed.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
