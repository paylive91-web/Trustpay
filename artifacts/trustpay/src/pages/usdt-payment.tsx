import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, Clock, Copy, Loader2, ShieldAlert, Upload, X, Sparkles, Coins, IndianRupee } from "lucide-react";
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
  status: "pending" | "submitted" | "approved" | "rejected" | "expired" | "cancelled";
  expiresAt: string;
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

export default function UsdtPayment() {
  const { data: user, isLoading: userLoading } = useGetMe({ query: { queryKey: ["me"], retry: false } });
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/usdt-payment/:id");
  const id = Number(params?.id);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [txId, setTxId] = useState("");
  const [screenshot, setScreenshot] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) setLocation("/login");
  }, [user, userLoading, setLocation]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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
      toast({ title: "Submitted!", description: "Admin will review and credit your account." });
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

  const expiresMs = order ? new Date(order.expiresAt).getTime() - now : 0;
  const expired = order ? expiresMs <= 0 : false;
  const totalWindowMs = useMemo(() => {
    if (!order) return 0;
    // Approximate: from createdAt to expiresAt would need extra fetch; use 15min default for ring.
    return 15 * 60 * 1000;
  }, [order]);
  const ringPct = totalWindowMs > 0 ? Math.max(0, Math.min(100, (expiresMs / totalWindowMs) * 100)) : 0;

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
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
          <Link href="/usdt-deposit" className="mt-4 inline-block text-sm font-semibold text-emerald-600">← Back to USDT</Link>
        </div>
      </Layout>
    );
  }

  const qrSrc = order.addressQrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(order.address)}`;

  // Status banners ----------------------------------------------------------
  if (order.status === "approved") {
    return (
      <Layout>
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <Link href="/usdt-history"><ArrowLeft className="cursor-pointer" /></Link>
          <span className="font-bold text-lg flex-1">Order Approved</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 p-6 text-white shadow-xl text-center">
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

  if (order.status === "rejected" || order.status === "cancelled" || order.status === "expired") {
    const palette = order.status === "rejected" ? "rose" : "slate";
    const title = order.status === "rejected" ? "Order Rejected" : order.status === "cancelled" ? "Order Cancelled" : "Window Expired";
    return (
      <Layout>
        <div className={`flex items-center gap-3 p-4 bg-gradient-to-r from-${palette}-600 to-${palette}-700 text-white`}>
          <Link href="/usdt-history"><ArrowLeft className="cursor-pointer" /></Link>
          <span className="font-bold text-lg flex-1">{title}</span>
        </div>
        <div className="p-5 space-y-4">
          <Card className={`border-${palette}-200 bg-${palette}-50`}>
            <CardContent className="p-5 space-y-2">
              <div className={`flex items-center gap-2 text-${palette}-700 font-bold`}>
                <ShieldAlert className="h-4 w-4" /> {title}
              </div>
              <p className={`text-sm text-${palette}-700`}>
                {order.status === "expired"
                  ? "You didn't submit your TxID and screenshot within the payment window."
                  : "This order is finalised. You can start a new deposit anytime."}
              </p>
            </CardContent>
          </Card>
          <Link href="/usdt-deposit" className="block w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold flex items-center justify-center">
            Start New Order
          </Link>
        </div>
      </Layout>
    );
  }

  if (order.status === "submitted") {
    return (
      <Layout>
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white">
          <Link href="/usdt-history"><ArrowLeft className="cursor-pointer" /></Link>
          <span className="font-bold text-lg flex-1">Awaiting Admin Review</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 p-6 text-white shadow-xl text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-3 ring-2 ring-white/30">
              <Clock className="h-9 w-9" />
            </div>
            <h2 className="text-2xl font-black">Under Review</h2>
            <p className="text-amber-50 text-sm mt-1">Admin will verify your TxID + screenshot</p>
            <div className="mt-3 text-amber-100 text-xs">Order #{order.id}</div>
          </div>
          <Card>
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Sent</span><span className="font-bold">{order.usdtAmount} USDT</span></div>
              <div className="flex justify-between"><span className="text-slate-500">TxID</span><span className="font-mono text-xs break-all text-right max-w-[60%]">{order.txId}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Will receive</span><span className="font-bold text-emerald-600">₹{fmt(order.totalCredit)}</span></div>
            </CardContent>
          </Card>
          <Link href="/usdt-history" className="block w-full h-12 rounded-2xl bg-slate-900 text-white font-bold flex items-center justify-center">
            View History
          </Link>
        </div>
      </Layout>
    );
  }

  // Pending state — main payment UI
  return (
    <Layout>
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg">
        <Link href="/usdt-deposit"><ArrowLeft className="cursor-pointer" /></Link>
        <div className="flex-1">
          <div className="font-bold text-lg leading-tight">Pay USDT</div>
          <div className="text-[11px] text-emerald-100">Order #{order.id} · TRC-20</div>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-24">
        {/* Countdown ring */}
        <div className={`relative overflow-hidden rounded-3xl p-5 text-white shadow-xl ${expired ? "bg-gradient-to-br from-rose-500 to-rose-700" : "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"}`}>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" stroke="rgba(255,255,255,0.15)" strokeWidth="6" fill="none" />
                <circle
                  cx="40" cy="40" r="34"
                  stroke={expired ? "#fff" : "#34d399"}
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - ringPct / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-mono font-black text-[15px]">
                {fmtCountdown(expiresMs)}
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300 font-semibold">Pay within</div>
              <div className="text-xl font-black">{expired ? "Expired" : "Time remaining"}</div>
              <div className="text-xs text-slate-300 mt-0.5">{expired ? "Start a new order to deposit." : "Don't close this page until you submit."}</div>
            </div>
          </div>
        </div>

        {/* Amount summary */}
        <Card className="border-emerald-100">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-emerald-50 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide font-bold text-emerald-700">Send</div>
                <div className="text-lg font-black text-emerald-800 mt-1">{order.usdtAmount}</div>
                <div className="text-[10px] text-emerald-600">USDT</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide font-bold text-slate-600">Rate</div>
                <div className="text-lg font-black text-slate-800 mt-1">₹{fmt(order.rate)}</div>
                <div className="text-[10px] text-slate-500">per USDT</div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide font-bold text-orange-700">You get</div>
                <div className="text-lg font-black text-orange-800 mt-1">₹{fmt(order.totalCredit)}</div>
                {order.bonusPercent > 0 && <div className="text-[10px] text-orange-600 inline-flex items-center gap-0.5"><Sparkles className="h-2.5 w-2.5" /> +{order.bonusPercent}%</div>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address + QR */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-slate-900 to-slate-700 p-4 text-white">
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-300">TRC-20 Address {order.addressLabel ? `· ${order.addressLabel}` : ""}</div>
            <div className="mt-1 text-[11px] text-amber-300 font-semibold">⚠ Send only TRC-20 USDT to this address. Wrong network = funds lost.</div>
          </div>
          <CardContent className="p-5 space-y-4">
            <div className="flex justify-center">
              <div className="rounded-2xl bg-white p-3 shadow-md ring-1 ring-slate-200">
                <img src={qrSrc} alt="USDT TRC-20 QR" className="w-44 h-44 rounded-lg" />
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3">
              <div className="text-[10px] uppercase tracking-wide font-bold text-slate-500 mb-1">Wallet Address</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[12px] font-mono break-all text-slate-800 leading-snug" data-testid="text-usdt-address">{order.address}</code>
                <button
                  type="button"
                  onClick={() => copy(order.address, "Address")}
                  className="shrink-0 p-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                  data-testid="button-copy-address"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-center">
              <div className="text-[10px] uppercase tracking-wide font-bold text-emerald-700">Send exactly</div>
              <div className="text-3xl font-black text-emerald-800 flex items-center justify-center gap-2 mt-1">
                <Coins className="h-6 w-6" /> {order.usdtAmount} USDT
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit form */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide font-bold text-slate-600">TxID / Transaction Hash</Label>
              <Input
                placeholder="Paste TxID from your wallet"
                value={txId}
                onChange={(e) => setTxId(e.target.value.trim())}
                disabled={expired}
                className="h-12 font-mono text-xs"
                data-testid="input-tx-id"
              />
              <p className="text-[11px] text-slate-500">From your wallet's transaction history. Required.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide font-bold text-slate-600">Payment Screenshot</Label>
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
                  disabled={expired || uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-28 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-emerald-600"
                >
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                  <span className="text-sm font-semibold">{uploading ? "Reading…" : "Tap to upload screenshot"}</span>
                  <span className="text-[10px]">Max 8 MB · PNG/JPG/WEBP</span>
                </button>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200">
                  <img src={screenshot} alt="Screenshot preview" className="w-full max-h-72 object-contain bg-slate-50" />
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

            <Button
              type="button"
              onClick={() => submitMut.mutate()}
              disabled={expired || submitMut.isPending || !txId.trim() || !screenshot || txId.trim().length < 10}
              className="w-full h-14 rounded-2xl text-[16px] font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30"
              data-testid="button-submit-usdt"
            >
              {submitMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting…</> : <>Submit for Review</>}
            </Button>

            {!confirmCancel ? (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="w-full text-center text-[12px] font-semibold text-slate-400 hover:text-rose-600 transition-colors"
              >
                Cancel this order
              </button>
            ) : (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 space-y-2">
                <p className="text-[12px] font-semibold text-rose-700">Cancel this order? You'll need to start a fresh one.</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setConfirmCancel(false)} className="flex-1 h-9 text-xs">Keep</Button>
                  <Button onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending} className="flex-1 h-9 text-xs bg-rose-500 hover:bg-rose-600">
                    {cancelMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes, cancel"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
