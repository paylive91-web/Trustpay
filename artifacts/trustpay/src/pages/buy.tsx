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
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle, Clock, Copy, Headset, ShieldCheck, Upload } from "lucide-react";
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

function BuyRulesDialog({ open, onOpenChange, onConfirm, buy, rules }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  buy: any;
  rules: string;
}) {
  if (!buy) return null;
  const lines = (rules || "").split("\n").map((line) => line.trim()).filter(Boolean);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-[28px] border border-white/60 bg-gradient-to-br from-white via-slate-50 to-indigo-50 shadow-[0_20px_70px_rgba(59,130,246,0.18)] overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-fuchsia-500 via-sky-500 to-emerald-400" />
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 via-orange-400 to-amber-300 flex items-center justify-center text-white shadow-lg ring-4 ring-rose-100">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <span className="font-bold">Buy confirm karo</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left leading-relaxed">
            <div className="text-sm text-slate-700">Payment start karne se pehle ye rules dhyan se padh lo:</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-2xl bg-white/70 border border-white/80 p-4 max-h-[45vh] overflow-y-auto space-y-3">
          <div className="rounded-2xl bg-gradient-to-r from-sky-50 to-fuchsia-50 border border-sky-100 p-3">
            <div className="text-xs text-sky-700 font-semibold">Order Amount</div>
            <div className="text-lg font-black text-slate-900">₹{buy.amount}</div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-sky-50/80 border border-sky-100 p-3">
              <div className="text-xs font-semibold text-sky-700 mb-2">English</div>
              <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
                {(lines.length ? lines : ["Pay only exact amount.", "Pay only to the UPI shown on screen.", "Never pay to any other number."]).map((line, idx) => <li key={idx}>{line}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl bg-fuchsia-50/80 border border-fuchsia-100 p-3">
              <div className="text-xs font-semibold text-fuchsia-700 mb-2">Hindi</div>
              <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
                {["Sirf exact amount pay karo.", "Sirf screen par dikh raha UPI use karo.", "Kisi aur number par payment mat karo.", "Agar UPI ID me aapka number dikh raha hai to scam call ka risk hai."].map((line, idx) => <li key={idx}>{line}</li>)}
              </ul>
            </div>
          </div>
        </div>
        <AlertDialogFooter className="sm:justify-between gap-2">
          <AlertDialogCancel className="rounded-full border-slate-300 bg-white/80 shadow-sm">Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="rounded-full bg-gradient-to-r from-primary via-sky-500 to-fuchsia-500 text-white shadow-lg">
            I understand, continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function Buy() {
  const [, setLocation] = useLocation();
  const { data: user, isError } = useGetMe({ query: { queryKey: ["me"], retry: false } });
  const { data: settings } = useGetAppSettings();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showBuyRulesDialog, setShowBuyRulesDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [activeUpis, setActiveUpis] = useState<UpiEntry[]>([]);
  const [showDailyRules, setShowDailyRules] = useState(false);

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
    if (myBuy?.status === "locked") setShowBuyRulesDialog(true);
    else setShowBuyRulesDialog(false);
    setShowPaymentDialog(false);
  }, [myBuy?.status]);
  useEffect(() => {
    const raw = (settings as any)?.multipleUpiIds;
    const arr = Array.isArray(raw) ? raw : [];
    setActiveUpis(arr.filter((u: any) => u?.upiId).map((u: any) => ({
      upiId: String(u.upiId || "").trim(),
      upiName: String(u.upiName || "").trim(),
      qrImageUrl: String(u.qrImageUrl || "").trim(),
    })));
  }, [settings]);
  useEffect(() => {
    const key = `buy_rules_seen_${new Date().toISOString().slice(0, 10)}`;
    setShowDailyRules(!localStorage.getItem(key));
  }, []);

  const lockMut = useMutation({
    mutationFn: (id: number) => api(`/p2p/lock/${id}`, { method: "POST" }),
    onSuccess: () => { refetchBuy(); qc.invalidateQueries({ queryKey: ["p2p-queue"] }); toast({ title: "Order locked! Pay now." }); },
    onError: (e: any) => toast({ title: "This order may be bought by someone else", description: e.message, variant: "destructive" }),
  });

  if (!user) return null;

  return (
    <Layout>
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary via-primary to-sky-600 text-primary-foreground">
        <Link href="/"><ArrowLeft className="cursor-pointer" /></Link>
        <span className="font-bold text-lg flex-1">Buy</span>
        <button onClick={() => setShowDailyRules(true)} className="flex items-center gap-1 text-xs bg-primary-foreground/15 px-2.5 py-1.5 rounded-full">
          <BookOpen className="w-3.5 h-3.5" /> Rules
        </button>
      </div>
      <div className="px-4 pt-3"><DisputePauseBanner /></div>
      <AlertDialog open={showDailyRules} onOpenChange={(v) => { setShowDailyRules(v); if (!v) localStorage.setItem(`buy_rules_seen_${new Date().toISOString().slice(0, 10)}`, "1"); }}>
        <AlertDialogContent className="max-w-md rounded-[28px] border border-white/60 bg-gradient-to-br from-white via-slate-50 to-indigo-50 shadow-[0_20px_70px_rgba(59,130,246,0.18)] overflow-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">Buy rules</AlertDialogTitle>
            <AlertDialogDescription>Hindi aur English dono me rules check kar lo.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-sky-50/80 border border-sky-100 p-3 text-sm text-slate-700">Pay only exact amount.<br />Only to the UPI shown.<br />Never share OTP or confirm on call.</div>
            <div className="rounded-2xl bg-fuchsia-50/80 border border-fuchsia-100 p-3 text-sm text-slate-700">Sirf exact amount pay karo.<br />Sirf dikhaya gaya UPI use karo.<br />OTP share mat karo, call par confirm mat karo.</div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setShowDailyRules(false); localStorage.setItem(`buy_rules_seen_${new Date().toISOString().slice(0, 10)}`, "1"); }}>Cancel</Button>
            <Button onClick={() => { setShowDailyRules(false); localStorage.setItem(`buy_rules_seen_${new Date().toISOString().slice(0, 10)}`, "1"); }}>I understand, continue</Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <BuyRulesDialog
        open={showBuyRulesDialog}
        onOpenChange={setShowBuyRulesDialog}
        buy={myBuy}
        rules={(settings as any)?.buyRules || ""}
        onConfirm={() => {
          setShowBuyRulesDialog(false);
          setLocation("/home");
        }}
      />

      <div className="p-4 space-y-4">
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
  const [showPaymentDialog, setShowPaymentDialog] = useState(true);

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
      <PaymentActionDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        buy={buy}
        onPayNow={() => setShowPaymentDialog(false)}
        onCancel={() => {
          setShowPaymentDialog(false);
          cancelMut.mutate();
        }}
      />
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
              <div className="p-4 rounded-[24px] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] border border-slate-200">
                <img
                  src={qrUrl}
                  alt="UPI QR Code"
                  className="w-44 h-44 rounded-2xl"
                  onError={() => setQrError(true)}
                />
              </div>
              <div className="text-xs text-slate-500">Scan with any UPI app</div>
            </div>
          )}

          <div className="rounded-[24px] p-3 space-y-2 text-sm bg-gradient-to-r from-slate-50 via-white to-indigo-50 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Pay to UPI:</span>
              <button onClick={() => { navigator.clipboard.writeText(buy.upiId); toast({ title: "Copied!" }); }} className="text-primary text-xs flex items-center gap-1 font-semibold">
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <div className="font-mono font-semibold break-all text-slate-900">{buy.upiId}</div>
            <div className="text-xs text-muted-foreground">Holder: {buy.holderName || buy.upiName}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
              {[
                { key: "phonepe", label: "PhonePe" },
                { key: "paytm", label: "Paytm" },
              ].map((app) => (
                <Button
                  key={app.key}
                  type="button"
                  variant="outline"
                  className="h-11 rounded-2xl text-xs font-semibold border-slate-300 bg-white shadow-sm hover:bg-slate-50"
                  onClick={() => openUpiApp(buy.upiId, buy.amount, app.key as any)}
                >
                  {app.label}
                </Button>
              ))}
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
                className="w-full h-12 text-base font-bold rounded-2xl bg-gradient-to-r from-primary via-sky-600 to-fuchsia-600 shadow-lg"
                disabled={!utr || !screenshotUrl || submitMut.isPending || !!uploading}
                onClick={() => setShowWarning(true)}
              >
                {submitMut.isPending ? "Submitting..." : "Submit Payment Proof"}
              </Button>
              <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
                <AlertDialogContent>
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
                  <AlertDialogFooter>
                    <AlertDialogCancel>Go Back</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => { setShowWarning(false); submitMut.mutate(); }}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Yes, Submit
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
    }, 200);
    return () => clearTimeout(t);
  }, [displayQueue.length]);

  // Every 600 ms swap multiple pairs so the whole list visibly shuffles.
  useEffect(() => {
    if (displayQueue.length < 2) return;
    const timer = setInterval(() => {
      setSlots((prev) => reshuffle(prev, Math.max(2, Math.floor(prev.length / 2))));
    }, 850);
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
