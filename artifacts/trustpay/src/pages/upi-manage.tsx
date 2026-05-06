import React, { useEffect, useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, PlusCircle, Trash2, Wifi, AlertTriangle, Zap, ShieldCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { API_BASE } from "@/lib/api-config";

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

export default function UpiManage() {
  const [, setLocation] = useLocation();
  const { data: user, isError } = useGetMe({ query: { queryKey: ["me"], retry: false } });
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [platform, setPlatform] = useState("");
  const [bankName, setBankName] = useState("");
  const [holderName, setHolderName] = useState("");

  useEffect(() => { if (isError) setLocation("/login"); }, [isError, setLocation]);

  const { data: upiList = [] } = useQuery<any[]>({
    queryKey: ["upi-all"],
    queryFn: () => api("/upi"),
    enabled: !!user,
  });

  const addMut = useMutation({
    mutationFn: () => api("/upi", { method: "POST", body: JSON.stringify({ upiId, platform, bankName, holderName }) }),
    onSuccess: () => {
      toast({ title: "UPI added & Auto-Sell activated" });
      setUpiId(""); setPlatform(""); setBankName(""); setHolderName("");
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["upi-all"] });
      qc.invalidateQueries({ queryKey: ["upi"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const activateMut = useMutation({
    mutationFn: (id: number) => api(`/upi/${id}/activate`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "UPI activated" });
      qc.invalidateQueries({ queryKey: ["upi-all"] });
      qc.invalidateQueries({ queryKey: ["upi"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: number) => api(`/upi/${id}/deactivate`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "UPI deactivated" });
      qc.invalidateQueries({ queryKey: ["upi-all"] });
      qc.invalidateQueries({ queryKey: ["upi"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api(`/upi/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "UPI removed" });
      qc.invalidateQueries({ queryKey: ["upi-all"] });
      qc.invalidateQueries({ queryKey: ["upi"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (!user) return null;
  const activeList = (upiList as any[]).filter((u) => u.isActive);
  const inactiveList = (upiList as any[]).filter((u) => !u.isActive);

  return (
    <Layout>
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 border-b border-orange-200 px-4 pt-4 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/"><ArrowLeft className="cursor-pointer text-slate-700 w-5 h-5" /></Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">Manage UPI</h1>
            <p className="text-[11px] text-orange-700/70">Connect your UPI to start Auto-Sell</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-white/70 border border-orange-200 p-3 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Active</div>
              <div className="text-lg font-black text-slate-900">{activeList.length}</div>
            </div>
          </div>
          <div className="rounded-2xl bg-white/70 border border-orange-200 p-3 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-sm">
              <Wifi className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</div>
              <div className="text-lg font-black text-slate-900">{(upiList as any[]).length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Add UPI form */}
        {showAdd && (
          <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 shadow-md">
            <CardContent className="p-4 space-y-3">
              <div className="font-semibold text-sm text-orange-700 flex items-center gap-2">
                <PlusCircle className="w-4 h-4" /> Add New UPI
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">UPI ID</Label>
                <Input placeholder="yourname@paytm" value={upiId} onChange={(e) => setUpiId(e.target.value)} className="rounded-xl border-orange-200 focus-visible:ring-orange-300" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">UPI App / Platform</Label>
                <Input placeholder="e.g. PhonePe, Google Pay, Paytm" value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded-xl border-orange-200 focus-visible:ring-orange-300" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Bank Name</Label>
                <Input placeholder="e.g. SBI, HDFC" value={bankName} onChange={(e) => setBankName(e.target.value)} className="rounded-xl border-orange-200 focus-visible:ring-orange-300" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Account Holder Name</Label>
                <Input placeholder="As per bank records" value={holderName} onChange={(e) => setHolderName(e.target.value)} className="rounded-xl border-orange-200 focus-visible:ring-orange-300" />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button variant="outline" onClick={() => setShowAdd(false)} className="rounded-xl border-orange-200 text-slate-600">Cancel</Button>
                <Button
                  onClick={() => addMut.mutate()}
                  disabled={addMut.isPending || !upiId || !platform || !bankName || !holderName}
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-none shadow-md"
                >
                  {addMut.isPending ? "Adding..." : "Add & Activate"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state — big centered connect button */}
        {(upiList as any[]).length === 0 && !showAdd && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 ring-1 ring-amber-400/30 p-8 shadow-xl text-center">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl" />
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center mb-4 shadow-lg ring-2 ring-orange-300/30">
              <Wifi className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-black text-white mb-1">No UPI Connected</h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Link your UPI ID to activate Auto-Sell and start earning
            </p>
            <Button
              onClick={() => setShowAdd(true)}
              className="mx-auto w-full h-14 text-lg rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-none shadow-lg font-bold gap-2"
            >
              <PlusCircle className="w-6 h-6" /> Add UPI
            </Button>
          </div>
        )}

        {/* Big Add UPI button — always visible when UPIs exist */}
        {(activeList.length > 0 || inactiveList.length > 0) && !showAdd && (
          <Button
            onClick={() => setShowAdd(true)}
            className="w-full h-14 text-base rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-none shadow-lg font-bold gap-2"
          >
            <PlusCircle className="w-5 h-5" /> Add UPI
          </Button>
        )}

        {/* Active UPIs */}
        {activeList.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Active UPIs ({activeList.length})
            </div>
            {activeList.map((u) => (
              <UpiCard
                key={u.id} u={u} isActive
                onDeactivate={() => deactivateMut.mutate(u.id)}
                onDelete={() => deleteMut.mutate(u.id)}
                deactivating={deactivateMut.isPending}
                deleting={deleteMut.isPending}
              />
            ))}
          </div>
        )}

        {/* Saved (inactive) UPIs */}
        {inactiveList.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Saved UPIs</div>
            {inactiveList.map((u) => (
              <UpiCard
                key={u.id} u={u} isActive={false}
                onActivate={() => activateMut.mutate(u.id)}
                onDelete={() => deleteMut.mutate(u.id)}
                activating={activateMut.isPending}
                deleting={deleteMut.isPending}
              />
            ))}
          </div>
        )}

        {/* Security warning */}
        <div className="mt-2 rounded-2xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-amber-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-red-700 mb-1.5">⚠️ ज़रूरी सुरक्षा सलाह — ध्यान से पढ़ें</div>
              <div className="text-[13px] leading-relaxed text-gray-800 space-y-2">
                <p>अगर आपकी UPI ID में आपका <span className="font-semibold text-red-700">मोबाइल नंबर</span> दिख रहा है (जैसे <span className="font-mono bg-white px-1 rounded">9876543210@ybl</span>), तो Sell के समय scammers आपका नंबर देख लेते हैं और आपको सीधे call करके <span className="font-semibold">"मैंने payment कर दिया है"</span> झूठ बोलकर बार-बार परेशान कर सकते हैं।</p>
                <p className="font-semibold text-green-800">✅ हमेशा वही UPI ID add करें जिसमें आपका phone number दिखाई न दे — जैसे <span className="font-mono bg-white px-1 rounded text-green-900">yourname@okaxis</span>, <span className="font-mono bg-white px-1 rounded text-green-900 ml-1">yourname@ybl</span> आदि।</p>
                <p className="text-[12px] text-gray-600 italic">आप अपनी UPI app (PhonePe / GPay / Paytm) में जाकर एक नई username-based UPI ID बना सकते हैं और वही यहाँ add करें।</p>
                <p className="mt-2 text-[13px] font-extrabold text-black bg-yellow-200 border-l-4 border-black px-2 py-1.5 rounded">📞 याद रखें: TrustPay कभी भी आपको call नहीं करता। अगर कोई "TrustPay" बनकर call करे, तो वो 100% scammer है।</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function UpiCard({ u, isActive, onActivate, onDeactivate, onDelete, activating, deactivating, deleting }: {
  u: any; isActive: boolean;
  onActivate?: () => void; onDeactivate?: () => void; onDelete: () => void;
  activating?: boolean; deactivating?: boolean; deleting?: boolean;
}) {
  const handleDelete = () => {
    if (window.confirm(`Remove UPI "${u.upiId}"? This will cancel all pending chunks linked to this UPI.`)) {
      onDelete();
    }
  };

  return (
    <Card className={`overflow-hidden border-none shadow-md ${isActive ? "ring-1 ring-emerald-400/50" : ""}`}>
      <div className={`h-1 ${isActive ? "bg-gradient-to-r from-emerald-400 to-teal-400" : "bg-muted"}`} />
      <CardContent className="p-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isActive ? "bg-emerald-100" : "bg-slate-100"}`}>
            <Wifi className={`w-4 h-4 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-sm truncate">{u.upiId}</div>
              {isActive && <Badge className="bg-emerald-600 text-white text-[10px] shrink-0 px-1.5">Active</Badge>}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{u.platform} · {u.bankName} · {u.holderName}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isActive && onActivate && (
            <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg border-orange-200 text-orange-700 hover:bg-orange-50" onClick={onActivate} disabled={activating}>
              <CheckCircle className="w-3 h-3 mr-1" /> Activate
            </Button>
          )}
          {isActive && onDeactivate && (
            <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={onDeactivate} disabled={deactivating}>
              Pause
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-white hover:bg-red-500 rounded-lg transition-colors" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
