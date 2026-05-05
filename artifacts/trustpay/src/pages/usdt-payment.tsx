import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, CheckCircle2, Clock, Copy, Loader2, ShieldAlert, Upload, X,
  Sparkles, IndianRupee, Hourglass, History as HistoryIcon,
} from "lucide-react";
import { API_BASE } from "@/lib/api-config";
import { getAuthToken } from "@/lib/auth";

type UsdtOrder = {
  id: number;
  usdtAmount: number;
  rate: number;
  bonusPercent: number;
  inrValue: number;
  bonusInr: number;
  totalCredit: number;
  address: string;
  addressLabel: string | null;
  addressQrImageUrl?: string | null;
  txId: string | null;
  screenshotUrl: string | null;
  status: "pending" | "submitted" | "processing" | "approved" | "rejected" | "expired" | "cancelled";
  expiresAt: string;
  createdAt: string;
  reviewSecondsRemaining: number | null;
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

function fmt(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function fmtCountdown(ms: number) {
  if (ms <= 0) return "00:00";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Isolated countdown so the every-1s tick doesn't re-render the parent
// payment form (which would dismiss the mobile keyboard while the user
// is typing the TxID, and was the root cause of "kuch nahi likh pa rha").
function CountdownPill({ expiresAt, totalWindowMs, totalCredit }: { expiresAt: string; totalWindowMs: number; totalCredit: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const expiresMs = new Date(expiresAt).getTime() - now;
  const expired = expiresMs <= 0;
  const ringPct = totalWindowMs > 0 ? Math.max(0, Math.min(100, (expiresMs / totalWindowMs) * 100)) : 0;
  return (
    <div className={`relative overflow-hidden rounded-2xl p-3 text-white shadow-lg ${expired ? "bg-gradient-to-r from-rose-500 to-rose-700" : "bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 ring-1 ring-amber-400/30"}`}>
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.15)" strokeWidth="4" fill="none" />
            <circle
              cx="24" cy="24" r="20"
              stroke={expired ? "#fff" : "#fbbf24"}
              strokeWidth="4"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 20}`}
              strokeDashoffset={`${2 * Math.PI * 20 * (1 - ringPct / 100)}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-mono font-black text-[11px]">
            {fmtCountdown(expiresMs)}
          </div>
        </div>
        <div className="flex-1 leading-tight">
          <div className="text-[9px] uppercase tracking-[0.18em] text-amber-300/80 font-semibold">Pay within</div>
          <div className="text-base font-black text-amber-200">{expired ? "Expired" : "Time remaining"}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wide text-amber-300/70 font-bold">You get</div>
          <div className="text-sm font-black text-amber-300">₹{totalCredit.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
        </div>
      </div>
    </div>
  );
}

export default function UsdtPayment() {
  const { data: user, isLoading: userLoading } = useGetMe({ query: { queryKey: ["me"], retry: false } });
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/usdt-payment/:id");
  const id = Number(params?.id);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [txId, setTxId] = useState("");
  const [screenshot, setScreenshot] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) setLocation("/login");
  }, [user, userLoading, setLocation]);

  const { data: order, isLoading } = useQuery<UsdtOrder>({
    queryKey: ["usdt-order", id],
    queryFn: async () => api(`/usdt/order/${id}`),
    refetchInterval: 5000,
    enabled: Number.isFinite(id),
  });

  const submitMut = useMutation({
    mutationFn: () => api(`/usdt/submit/${id}`, {
      method: "POST",
      body: JSON.stringify({ txId: txId.trim(), screenshotDataUrl: screenshot }),
    }),
    onSuccess: () => {
      toast({ title: "Submitted!", description: "TrustPay will review and credit your account." });
      qc.invalidateQueries({ queryKey: ["usdt-order", id] });
    },
    onError: (err: any) => {
      toast({ title: "Submit failed", description: err?.message || "Please try again", variant: "destructive" });
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => api(`/usdt/cancel/${id}`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Order cancelled" });
      setLocation("/usdt-history");
    },
    onError: (err: any) => {
      toast({ title: "Cancel failed", description: err?.message || "Please try again", variant: "destructive" });
    },
  });

  // The countdown ring + tick lives in <CountdownPill /> below — keeping
  // the every-1s setNow out of this component is critical so the TxID
  // input and Upload button don't re-render every second (which on
  // mobile causes the keyboard to dismiss mid-typing).
  // Use the order's actual payment window (expiresAt − createdAt) so the
  // ring stays accurate even if admin changes the configured window
  // after the order was created. Fallback to 15 min only if dates are
  // missing.
  const totalWindowMs = useMemo(() => {
    if (!order?.createdAt || !order?.expiresAt) return 15 * 60 * 1000;
    const span = new Date(order.expiresAt).getTime() - new Date(order.createdAt).getTime();
    return Number.isFinite(span) && span > 0 ? span : 15 * 60 * 1000;
  }, [order?.createdAt, order?.expiresAt]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Image only", variant: "destructive" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Too large", description: "Screenshot must be under 8 MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setScreenshot(dataUrl);
    } finally {
      setUploading(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast({ title: `${label} copied` })).catch(() => {});
  };

  if (userLoading || isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-muted-foreground">Loading order…</p>
        </div>
      </Layout>
    );
  }

  if (!user) return null;
  if (!order) {
    return (
      <Layout>
        <div className="p-6">
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="p-5 text-sm text-rose-700">Order not found.</CardContent>
          </Card>
          <Link href="/usdt-deposit" className="mt-4 inline-block text-sm font-semibold text-amber-600">← Back to USDT</Link>
        </div>
      </Layout>
    );
  }

  const qrSrc = order.addressQrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(order.address)}`;

  // Approved status — final success state
  if (order.status === "approved") {
    return (
      <Layout>
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <Link href="/usdt-history"><ArrowLeft className="cursor-pointer" /></Link>
          <span className="font-bold text-lg flex-1">Order Approved</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-6 text-white shadow-xl text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-3 ring-2 ring-white/30">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h2 className="text-2xl font-black">Credited Successfully</h2>
            <p className="text-emerald-100 text-sm mt-1">{order.usdtAmount} USDT received</p>
            <div className="mt-4 inline-flex items-center gap-1 text-3xl font-black">
              <IndianRupee className="h-6 w-6" />{fmt(order.totalCredit)}
            </div>
          </div>
          <Link href="/" className="block w-full h-12 rounded-2xl bg-slate-900 text-white font-bold flex items-center justify-center">
            Back to Home
          </Link>
        </div>
      </Layout>
    );
  }

  // Rejected / cancelled / expired — terminal failure states
  if (order.status === "rejected" || order.status === "cancelled" || order.status === "expired") {
    const isReject = order.status === "rejected";
    const title = isReject ? "Order Rejected" : order.status === "cancelled" ? "Order Cancelled" : "Window Expired";
    return (
      <Layout>
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <Link href="/usdt-history"><ArrowLeft className="cursor-pointer" /></Link>
          <span className="font-bold text-lg flex-1">{title}</span>
        </div>
        <div className="p-5 space-y-4">
          <Card className={isReject ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}>
            <CardContent className="p-5 space-y-2">
              <div className={`flex items-center gap-2 font-bold ${isReject ? "text-rose-700" : "text-slate-700"}`}>
                <ShieldAlert className="h-4 w-4" /> {title}
              </div>
              <p className={`text-sm ${isReject ? "text-rose-700" : "text-slate-700"}`}>
                {order.status === "expired"
                  ? "You didn't submit your TxID and screenshot within the payment window."
                  : "This order is finalised. You can start a new deposit anytime."}
              </p>
            </CardContent>
          </Card>
          <Link href="/usdt-deposit" className="block w-full h-12 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 font-black flex items-center justify-center shadow-md">
            Start New Order
          </Link>
        </div>
      </Layout>
    );
  }

  // Submitted — within 15-min TrustPay review SLA
  if (order.status === "submitted") {
    const reviewSec = Math.max(0, order.reviewSecondsRemaining ?? 0);
    const reviewMs = reviewSec * 1000;
    return (
      <Layout>
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <Link href="/usdt-history"><ArrowLeft className="cursor-pointer" /></Link>
          <span className="font-bold text-lg flex-1">Under TrustPay Review</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl text-center ring-1 ring-amber-400/30">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center mb-3 ring-2 ring-amber-300/40 shadow-lg">
              <Clock className="h-10 w-10 text-slate-900" />
            </div>
            <h2 className="text-2xl font-black bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">Order Pending</h2>
            <p className="text-slate-300 text-sm mt-1">TrustPay is verifying your TxID + screenshot</p>
            <div className="mt-4 inline-flex items-baseline gap-1.5 text-3xl font-black font-mono text-amber-300">
              {fmtCountdown(reviewMs)}
              <span className="text-[11px] font-bold text-amber-400/70 uppercase tracking-wider">remaining</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">Order #{order.id}</div>
          </div>
          <Card className="border-slate-200">
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Sent</span><span className="font-bold">{order.usdtAmount} USDT</span></div>
              <div className="flex justify-between"><span className="text-slate-500">TxID</span><span className="font-mono text-xs break-all text-right max-w-[60%]">{order.txId}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">You'll receive</span><span className="font-black text-amber-700">₹{fmt(order.totalCredit)}</span></div>
            </CardContent>
          </Card>
          <Link href="/usdt-history" className="block w-full h-12 rounded-2xl bg-slate-900 text-white font-bold flex items-center justify-center">
            View History
          </Link>
        </div>
      </Layout>
    );
  }

  // Processing — past 15-min SLA, still awaiting TrustPay action
  if (order.status === "processing") {
    return (
      <Layout>
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <Link href="/usdt-history"><ArrowLeft className="cursor-pointer" /></Link>
          <span className="font-bold text-lg flex-1">In Processing</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl text-center ring-1 ring-amber-400/30">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center mb-3 ring-2 ring-amber-300/40 shadow-lg">
              <Hourglass className="h-10 w-10 text-slate-900 animate-pulse" />
            </div>
            <h2 className="text-2xl font-black bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">Order in Processing</h2>
            <p className="text-slate-300 text-sm mt-1 leading-relaxed">
              Your deposit is queued and will be approved by TrustPay shortly.<br />
              Aap intezaar karein, balance jald credit hoga.
            </p>
            <div className="mt-3 text-[11px] text-slate-400">Order #{order.id}</div>
          </div>
          <Card className="border-slate-200">
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Sent</span><span className="font-bold">{order.usdtAmount} USDT</span></div>
              <div className="flex justify-between"><span className="text-slate-500">TxID</span><span className="font-mono text-xs break-all text-right max-w-[60%]">{order.txId}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">You'll receive</span><span className="font-black text-amber-700">₹{fmt(order.totalCredit)}</span></div>
            </CardContent>
          </Card>
          <Link href="/usdt-history" className="block w-full h-12 rounded-2xl bg-slate-900 text-white font-bold flex items-center justify-center">
            View History
          </Link>
        </div>
      </Layout>
    );
  }

  // Pending — main payment UI (compact single-screen layout)
  return (
    <Layout>
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
        <Link href="/usdt-deposit"><ArrowLeft className="cursor-pointer h-5 w-5" /></Link>
        <div className="flex-1">
          <div className="font-bold text-lg leading-tight">Pay USDT</div>
          <div className="text-[11px] text-slate-300">#{order.id} · TRC-20</div>
        </div>
        <Link
          href="/usdt-history"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-colors"
          data-testid="link-usdt-history"
        >
          <HistoryIcon className="h-3.5 w-3.5" /> History
        </Link>
      </div>

      <div className="px-4 py-4 space-y-3.5">
        <CountdownPill
          expiresAt={order.expiresAt}
          totalWindowMs={totalWindowMs}
          totalCredit={order.totalCredit}
        />

        {/* Send/Rate/Bonus inline */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-slate-900 p-2.5 text-center text-white shadow-sm">
            <div className="text-[10px] uppercase tracking-wide font-bold text-amber-300/70">Send</div>
            <div className="text-lg font-black text-amber-300 mt-0.5 leading-tight">{order.usdtAmount}</div>
            <div className="text-[10px] text-slate-400">USDT</div>
          </div>
          <div className="rounded-xl bg-slate-100 p-2.5 text-center">
            <div className="text-[10px] uppercase tracking-wide font-bold text-slate-600">Rate</div>
            <div className="text-lg font-black text-slate-800 mt-0.5 leading-tight">₹{fmt(order.rate)}</div>
            <div className="text-[10px] text-slate-500">per USDT</div>
          </div>
          <div className="relative rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 p-2.5 text-center shadow-md ring-1 ring-amber-300/60 overflow-hidden">
            <div className="text-[10px] uppercase tracking-wide font-bold text-slate-900/70">Bonus</div>
            <div className="text-lg font-black text-slate-900 mt-0.5 inline-flex items-center gap-0.5 leading-tight">
              <Sparkles className="h-3 w-3" />+{order.bonusPercent}%
            </div>
            <div className="text-[10px] text-slate-900/70 font-semibold">FREE</div>
          </div>
        </div>

        {/* Address card with QR side-by-side */}
        <Card className="overflow-hidden border-slate-200">
          <div className="bg-slate-900 px-3 py-2 text-white flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-amber-300">TRC-20 Address {order.addressLabel ? `· ${order.addressLabel}` : ""}</div>
            <div className="text-[10px] text-rose-300 font-semibold">⚠ TRC-20 only</div>
          </div>
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white p-2 shadow ring-1 ring-slate-200 shrink-0">
                <img src={qrSrc} alt="USDT TRC-20 QR" className="w-24 h-24 rounded-md" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="text-[10px] uppercase tracking-wide font-bold text-slate-500">Wallet Address</div>
                <code className="block text-[12px] font-mono break-all text-slate-800 leading-snug bg-slate-50 rounded-md p-2 border border-slate-200" data-testid="text-usdt-address">{order.address}</code>
                <button
                  type="button"
                  onClick={() => copy(order.address, "Address")}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-bold transition-colors"
                  data-testid="button-copy-address"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy address
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TxID input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] uppercase tracking-wide font-bold text-slate-600">TxID / Transaction Hash</label>
            <span className="text-[10px] text-slate-400">From your wallet</span>
          </div>
          <Input
            placeholder="Paste or type your TxID"
            value={txId}
            onChange={(e) => setTxId(e.target.value)}
            className="h-12 font-mono text-sm rounded-xl border-slate-200 focus-visible:ring-amber-300 focus-visible:border-amber-400"
            data-testid="input-tx-id"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        {/* Screenshot upload */}
        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-wide font-bold text-slate-600">Payment Screenshot</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            data-testid="input-screenshot"
          />
          {!screenshot ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50/40 transition-all flex items-center justify-center gap-2 text-slate-500 hover:text-amber-700 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              <span className="text-sm font-semibold">{uploading ? "Reading…" : "Tap to upload screenshot"}</span>
            </button>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-slate-200">
              <img src={screenshot} alt="Screenshot preview" className="w-full max-h-40 object-cover bg-slate-50" />
              <button
                type="button"
                onClick={() => setScreenshot("")}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg hover:bg-rose-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Submit */}
        <Button
          type="button"
          onClick={() => submitMut.mutate()}
          disabled={submitMut.isPending || !txId.trim() || !screenshot || txId.trim().length < 10}
          className="w-full h-14 rounded-xl text-base font-black bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:from-amber-500 hover:to-yellow-600 text-slate-900 shadow-lg shadow-amber-500/30 disabled:opacity-50"
          data-testid="button-submit-usdt"
        >
          {submitMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting…</> : "Submit"}
        </Button>

        {/* Cancel — proper outlined danger button (was a tiny text link) */}
        {!confirmCancel ? (
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            className="w-full h-12 rounded-xl border-2 border-rose-200 bg-white hover:bg-rose-50 hover:border-rose-300 text-rose-600 hover:text-rose-700 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors"
            data-testid="button-cancel-order"
          >
            <X className="h-4 w-4" /> Cancel this order
          </button>
        ) : (
          <div className="rounded-xl bg-rose-50 border-2 border-rose-200 p-3 space-y-2.5">
            <p className="text-sm font-semibold text-rose-700 text-center">Cancel this order? You'll need to start a fresh one.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfirmCancel(false)} className="flex-1 h-11 text-sm font-bold border-slate-300">Keep</Button>
              <Button onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending} className="flex-1 h-11 text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white">
                {cancelMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, cancel"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
