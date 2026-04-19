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
import { ArrowLeft, CheckCircle, PlusCircle, Trash2, Wifi } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
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
  const { data: user, isError } = useGetMe({ query: { retry: false } });
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
  const wrap = (cb: (id: number) => void) => (id: number) => cb(id);

  return (
    <Layout>
      <div className="flex items-center gap-3 p-4 bg-primary text-primary-foreground">
        <Link href="/"><ArrowLeft className="cursor-pointer" /></Link>
        <span className="font-bold text-lg flex-1">Manage UPI</span>
        <button onClick={() => setShowAdd((v) => !v)} className="flex items-center gap-1 text-xs bg-primary-foreground/20 px-2.5 py-1.5 rounded-full">
          <PlusCircle className="w-3.5 h-3.5" /> Add UPI
        </button>
      </div>

      <div className="p-4 space-y-4">
        {showAdd && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <div className="font-semibold text-sm text-primary">Add New UPI</div>
              <div className="space-y-1.5">
                <Label>UPI ID</Label>
                <Input placeholder="yourname@paytm" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>UPI App / Platform</Label>
                <Input placeholder="e.g. PhonePe, Google Pay, Paytm" value={platform} onChange={(e) => setPlatform(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Bank Name</Label>
                <Input placeholder="e.g. SBI, HDFC" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Account Holder Name</Label>
                <Input placeholder="As per bank records" value={holderName} onChange={(e) => setHolderName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button
                  onClick={() => addMut.mutate()}
                  disabled={addMut.isPending || !upiId || !platform || !bankName || !holderName}
                >
                  {addMut.isPending ? "Adding..." : "Add & Activate"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeList.length === 0 && !showAdd && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center space-y-3">
              <Wifi className="w-10 h-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No active UPI linked. Add one to start auto-selling.</p>
              <Button onClick={() => setShowAdd(true)}>
                <PlusCircle className="w-4 h-4 mr-2" /> Add UPI
              </Button>
            </CardContent>
          </Card>
        )}

        {activeList.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Active UPIs ({activeList.length})</div>
            {activeList.map((u) => (
              <UpiCard
                key={u.id}
                u={u}
                isActive
                onDeactivate={() => deactivateMut.mutate(u.id)}
                onDelete={() => deleteMut.mutate(u.id)}
                deactivating={deactivateMut.isPending}
                deleting={deleteMut.isPending}
              />
            ))}
          </div>
        )}

        {inactiveList.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Saved UPIs</div>
            {inactiveList.map((u) => (
              <UpiCard
                key={u.id}
                u={u}
                isActive={false}
                onActivate={() => activateMut.mutate(u.id)}
                onDelete={() => deleteMut.mutate(u.id)}
                activating={activateMut.isPending}
                deleting={deleteMut.isPending}
              />
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center pt-2">
          Multiple UPIs can be active at once. During matching, incoming chunks are split across all active UPIs round-robin.
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
  return (
    <Card className={isActive ? "border-green-400 bg-green-50" : ""}>
      <CardContent className="p-3 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-sm truncate">{u.upiId}</div>
            {isActive && <Badge className="bg-green-600 text-white text-xs shrink-0">Active</Badge>}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{u.platform} · {u.bankName} · {u.holderName}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isActive && onActivate && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onActivate} disabled={activating}>
              <CheckCircle className="w-3 h-3 mr-1" /> Activate
            </Button>
          )}
          {isActive && onDeactivate && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onDeactivate} disabled={deactivating}>
              Pause
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={onDelete} disabled={deleting}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
