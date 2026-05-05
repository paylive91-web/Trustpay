import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Coins, Loader2, Plus, Trash2, CheckCircle2, X, Eye, ShieldAlert, ExternalLink, RefreshCcw } from "lucide-react";
import { API_BASE } from "@/lib/api-config";
import { getAuthToken } from "@/lib/auth";
import {
  useAdminGetSettings,
  useAdminUpdateSettings,
  getAdminGetSettingsQueryKey,
  getGetAppSettingsQueryKey,
} from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

type UsdtAddress = { address: string; label?: string; qrImageUrl?: string };
type AdminUsdtOrder = {
  id: number;
  user: { username: string; phone: string };
  usdtAmount: number;
  rate: number;
  bonusPercent: number;
  totalCredit: number;
  address: string;
  txId: string | null;
  screenshotUrl: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  submittedAt: string | null;
};

async function adminApi(path: string, opts: RequestInit = {}) {
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

function fmt(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

const TABS = [
  { key: "orders", label: "Orders" },
  { key: "settings", label: "Settings" },
  { key: "addresses", label: "Addresses" },
];

export default function AdminUsdt() {
  const [tab, setTab] = useState<"orders" | "settings" | "addresses">("orders");

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">USDT Deposits</h1>
            <p className="text-[12px] text-slate-500">Approve TRC-20 deposits, configure rate, bonus and addresses.</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-1 flex gap-1 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as any)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                tab === t.key
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              data-testid={`admin-usdt-tab-${t.key}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "orders" && <OrdersTab />}
        {tab === "settings" && <SettingsTab />}
        {tab === "addresses" && <AddressesTab />}
      </div>
    </AdminLayout>
  );
}

function OrdersTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("submitted");
  const [previewOrder, setPreviewOrder] = useState<AdminUsdtOrder | null>(null);
  const [rejectingFor, setRejectingFor] = useState<AdminUsdtOrder | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: orders, isLoading, refetch } = useQuery<AdminUsdtOrder[]>({
    queryKey: ["admin-usdt-orders", filter],
    queryFn: () => adminApi(`/admin/usdt/orders?status=${filter}&limit=200`),
    refetchInterval: 15_000,
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => adminApi(`/admin/usdt/approve/${id}`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      toast({ title: "Order approved & user credited" });
      qc.invalidateQueries({ queryKey: ["admin-usdt-orders"] });
      setPreviewOrder(null);
    },
    onError: (err: any) => toast({ title: "Approve failed", description: err?.message, variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      adminApi(`/admin/usdt/reject/${id}`, { method: "POST", body: JSON.stringify({ note }) }),
    onSuccess: () => {
      toast({ title: "Order rejected" });
      qc.invalidateQueries({ queryKey: ["admin-usdt-orders"] });
      setRejectingFor(null);
      setRejectReason("");
      setPreviewOrder(null);
    },
    onError: (err: any) => toast({ title: "Reject failed", description: err?.message, variant: "destructive" }),
  });

  const FILTERS = [
    { key: "submitted", label: "Pending Review" },
    { key: "processing", label: "Processing (overdue)" },
    { key: "pending", label: "Awaiting Pay" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "expired", label: "Expired" },
    { key: "all", label: "All" },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Orders</CardTitle>
          <CardDescription>Review TxIDs and screenshots before crediting INR balance.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="shrink-0">
          <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all ${
                filter === f.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              data-testid={`admin-usdt-filter-${f.key}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
        ) : !orders || orders.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">No orders match this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500 border-b">
                <tr>
                  <th className="text-left py-2 px-2">Order</th>
                  <th className="text-left py-2 px-2">User</th>
                  <th className="text-right py-2 px-2">USDT</th>
                  <th className="text-right py-2 px-2">Credit ₹</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-right py-2 px-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="py-2.5 px-2">
                      <div className="font-bold text-slate-800">#{o.id}</div>
                      <div className="text-[11px] text-slate-400">{new Date(o.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</div>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="font-semibold text-slate-700">{o.user?.username || "—"}</div>
                      <div className="text-[11px] text-slate-400">{o.user?.phone}</div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold tabular-nums">{o.usdtAmount}</td>
                    <td className="py-2.5 px-2 text-right font-black text-emerald-600 tabular-nums">₹{fmt(o.totalCredit)}</td>
                    <td className="py-2.5 px-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        o.status === "submitted" ? "bg-amber-100 text-amber-700" :
                        o.status === "processing" ? "bg-rose-100 text-rose-700 ring-1 ring-rose-300 animate-pulse" :
                        o.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                        o.status === "rejected" ? "bg-rose-100 text-rose-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {o.status === "processing" ? "OVERDUE" : o.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setPreviewOrder(o)} className="h-8 px-2" data-testid={`admin-usdt-view-${o.id}`}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {(o.status === "submitted" || o.status === "processing") && (
                          <>
                            <Button size="sm" onClick={() => approveMut.mutate(o.id)} disabled={approveMut.isPending} className="h-8 px-2 bg-emerald-500 hover:bg-emerald-600" data-testid={`admin-usdt-approve-${o.id}`}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" onClick={() => { setRejectingFor(o); setRejectReason(""); }} className="h-8 px-2 bg-rose-500 hover:bg-rose-600" data-testid={`admin-usdt-reject-${o.id}`}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Order preview dialog */}
      <Dialog open={!!previewOrder} onOpenChange={(o) => !o && setPreviewOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order #{previewOrder?.id}</DialogTitle>
            <DialogDescription>{previewOrder?.user?.username} · +91 {previewOrder?.user?.phone}</DialogDescription>
          </DialogHeader>
          {previewOrder && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-emerald-50 p-2.5 text-center">
                  <div className="text-[10px] uppercase text-emerald-700 font-bold">USDT</div>
                  <div className="text-lg font-black">{previewOrder.usdtAmount}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                  <div className="text-[10px] uppercase text-slate-600 font-bold">Rate</div>
                  <div className="text-lg font-black">₹{fmt(previewOrder.rate)}</div>
                </div>
                <div className="rounded-xl bg-amber-50 p-2.5 text-center">
                  <div className="text-[10px] uppercase text-orange-700 font-bold">Credit</div>
                  <div className="text-lg font-black">₹{fmt(previewOrder.totalCredit)}</div>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 space-y-1">
                <div className="text-[10px] uppercase text-slate-500 font-bold">Address</div>
                <code className="text-[11px] font-mono break-all text-slate-800">{previewOrder.address}</code>
              </div>
              {previewOrder.txId && (
                <div className="rounded-xl bg-slate-50 p-3 space-y-1">
                  <div className="text-[10px] uppercase text-slate-500 font-bold flex items-center gap-1">
                    TxID
                    <a href={`https://tronscan.org/#/transaction/${previewOrder.txId}`} target="_blank" rel="noreferrer" className="text-emerald-600">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <code className="text-[11px] font-mono break-all text-slate-800">{previewOrder.txId}</code>
                </div>
              )}
              {previewOrder.screenshotUrl && (
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
                  <img
                    src={previewOrder.screenshotUrl.startsWith("data:") || previewOrder.screenshotUrl.startsWith("http")
                      ? previewOrder.screenshotUrl
                      : `${API_BASE.replace(/\/api$/, "")}${previewOrder.screenshotUrl}`}
                    alt="Payment screenshot"
                    className="w-full max-h-96 object-contain"
                  />
                </div>
              )}
              {previewOrder.adminNote && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-[12px] text-rose-700">
                  <span className="font-bold">Note:</span> {previewOrder.adminNote}
                </div>
              )}
            </div>
          )}
          {(previewOrder?.status === "submitted" || previewOrder?.status === "processing") && (
            <DialogFooter className="gap-2">
              <Button onClick={() => previewOrder && approveMut.mutate(previewOrder.id)} disabled={approveMut.isPending} className="bg-emerald-500 hover:bg-emerald-600">
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve & Credit
              </Button>
              <Button onClick={() => previewOrder && (setRejectingFor(previewOrder), setRejectReason(""))} className="bg-rose-500 hover:bg-rose-600">
                <X className="h-4 w-4 mr-1.5" /> Reject
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject reason dialog */}
      <Dialog open={!!rejectingFor} onOpenChange={(o) => !o && setRejectingFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-rose-500" /> Reject Order #{rejectingFor?.id}</DialogTitle>
            <DialogDescription>Reason will be visible to the user. Required.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. TxID not found on TRC-20 explorer; please re-submit with correct hash."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            data-testid="input-reject-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingFor(null)}>Cancel</Button>
            <Button
              onClick={() => rejectingFor && rejectReason.trim() && rejectMut.mutate({ id: rejectingFor.id, note: rejectReason.trim() })}
              disabled={!rejectReason.trim() || rejectMut.isPending}
              className="bg-rose-500 hover:bg-rose-600"
            >
              Reject Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SettingsTab() {
  const { data: settings } = useAdminGetSettings();
  const { toast } = useToast();
  const qc = useQueryClient();
  const updateMut = useAdminUpdateSettings({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "USDT settings saved" });
        if (data) qc.setQueryData(getAdminGetSettingsQueryKey(), data);
        qc.invalidateQueries({ queryKey: getGetAppSettingsQueryKey() });
      },
      onError: (e: any) => toast({ title: "Save failed", description: e?.message, variant: "destructive" }),
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [rate, setRate] = useState<number>(85);
  const [bonusPct, setBonusPct] = useState<number>(0);
  const [minA, setMinA] = useState<number>(10);
  const [maxA, setMaxA] = useState<number>(10000);
  const [windowMin, setWindowMin] = useState<number>(15);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!settings) return;
    const s: any = settings;
    setEnabled(s.usdtEnabled === true || s.usdtEnabled === "true");
    setRate(Number(s.usdtRatePerUnit) || 85);
    setBonusPct(Number(s.usdtBonusPercent) || 0);
    setMinA(Number(s.usdtMinAmount) || 10);
    setMaxA(Number(s.usdtMaxAmount) || 10000);
    setWindowMin(Number(s.usdtPaymentWindowMinutes) || 15);
    setNotes(s.usdtNotes || "");
  }, [settings]);

  const save = () => {
    updateMut.mutate({
      data: {
        usdtEnabled: enabled,
        usdtRatePerUnit: String(rate),
        usdtBonusPercent: String(bonusPct),
        usdtMinAmount: String(minA),
        usdtMaxAmount: String(maxA),
        usdtPaymentWindowMinutes: String(windowMin),
        usdtNotes: notes,
      } as any,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate, Bonus & Limits</CardTitle>
        <CardDescription>These are picked up live by the user-facing buy screen.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2 flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
          <div>
            <div className="text-sm font-bold text-emerald-800">Enable USDT deposits</div>
            <div className="text-[11px] text-emerald-600">Off → users won't see the USDT tab on Buy.</div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} data-testid="switch-usdt-enabled" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Rate (₹ per USDT)</Label>
          <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(parseFloat(e.target.value) || 0)} data-testid="input-usdt-rate" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Bonus %</Label>
          <Input type="number" step="0.1" value={bonusPct} onChange={(e) => setBonusPct(parseFloat(e.target.value) || 0)} data-testid="input-usdt-bonus" />
          <p className="text-[11px] text-slate-500">Extra INR % credited on top of base value.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Min USDT</Label>
          <Input type="number" step="0.01" value={minA} onChange={(e) => setMinA(parseFloat(e.target.value) || 0)} data-testid="input-usdt-min" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Max USDT (0 = no cap)</Label>
          <Input type="number" step="0.01" value={maxA} onChange={(e) => setMaxA(parseFloat(e.target.value) || 0)} data-testid="input-usdt-max" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Payment window (minutes)</Label>
          <Input type="number" min={1} max={120} value={windowMin} onChange={(e) => setWindowMin(parseInt(e.target.value) || 15)} data-testid="input-usdt-window" />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-xs font-medium">User-facing notes</Label>
          <Textarea rows={3} placeholder="Optional message shown on the deposit screen." value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-usdt-notes" />
        </div>
        <div className="md:col-span-2">
          <Button onClick={save} disabled={updateMut.isPending} className="bg-emerald-500 hover:bg-emerald-600" data-testid="button-save-usdt-settings">
            {updateMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving…</> : "Save Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddressesTab() {
  const { data: settings } = useAdminGetSettings();
  const { toast } = useToast();
  const qc = useQueryClient();
  const updateMut = useAdminUpdateSettings({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Addresses saved" });
        if (data) qc.setQueryData(getAdminGetSettingsQueryKey(), data);
        qc.invalidateQueries({ queryKey: getGetAppSettingsQueryKey() });
      },
      onError: (e: any) => toast({ title: "Save failed", description: e?.message, variant: "destructive" }),
    },
  });
  const [addresses, setAddresses] = useState<UsdtAddress[]>([]);

  useEffect(() => {
    if (!settings) return;
    const raw = (settings as any).usdtAddresses;
    let list: UsdtAddress[] = [];
    if (Array.isArray(raw)) list = raw;
    else if (typeof raw === "string") {
      try { list = JSON.parse(raw); } catch { list = []; }
    }
    setAddresses(list.map((a: any) => ({ address: a?.address || "", label: a?.label || "", qrImageUrl: a?.qrImageUrl || "" })));
  }, [settings]);

  const add = () => setAddresses((p) => [...p, { address: "", label: "", qrImageUrl: "" }]);
  const remove = (i: number) => setAddresses((p) => p.filter((_, idx) => idx !== i));
  const upd = (i: number, field: keyof UsdtAddress, val: string) => setAddresses((p) => p.map((a, idx) => idx === i ? { ...a, [field]: val } : a));

  const save = () => {
    const cleaned = addresses
      .map((a) => ({ address: a.address.trim(), label: (a.label || "").trim() || undefined, qrImageUrl: (a.qrImageUrl || "").trim() || undefined }))
      .filter((a) => a.address.length > 0);
    // Loose TRC-20 sanity check: 34 chars starting with 'T'.
    const bad = cleaned.find((a) => !/^T[a-zA-Z0-9]{33}$/.test(a.address));
    if (bad) {
      toast({ title: "Invalid address", description: `${bad.address.slice(0, 12)}… is not a TRC-20 address.`, variant: "destructive" });
      return;
    }
    updateMut.mutate({ data: { usdtAddresses: cleaned } as any });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>TRC-20 Addresses</CardTitle>
        <CardDescription>Round-robin distributed across new orders. Multiple addresses spread risk and reviewer load.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {addresses.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No addresses configured. Add at least one before enabling USDT deposits.
          </div>
        )}
        {addresses.map((a, i) => (
          <div key={i} className="rounded-2xl bg-slate-50 border border-slate-200 p-3 space-y-2">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[11px] uppercase font-bold text-slate-500">TRC-20 Address #{i + 1}</Label>
                <Input
                  value={a.address}
                  onChange={(e) => upd(i, "address", e.target.value.trim())}
                  placeholder="T..."
                  className="font-mono text-xs"
                  data-testid={`input-address-${i}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase font-bold text-slate-500">Label (optional)</Label>
                <Input value={a.label || ""} onChange={(e) => upd(i, "label", e.target.value)} placeholder="e.g. Binance Hot Wallet" />
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label className="text-[11px] uppercase font-bold text-slate-500">QR image URL (optional)</Label>
                <Input value={a.qrImageUrl || ""} onChange={(e) => upd(i, "qrImageUrl", e.target.value)} placeholder="https://… (leave blank to auto-generate from address)" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => remove(i)} className="text-rose-600 hover:bg-rose-50">
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
              </Button>
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <Button variant="outline" onClick={add} data-testid="button-add-address">
            <Plus className="h-4 w-4 mr-1" /> Add Address
          </Button>
          <Button onClick={save} disabled={updateMut.isPending} className="bg-emerald-500 hover:bg-emerald-600" data-testid="button-save-addresses">
            {updateMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving…</> : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
