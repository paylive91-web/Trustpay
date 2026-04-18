import React, { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShieldAlert, Eye } from "lucide-react";

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

export default function AdminDisputes() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [viewDispute, setView] = useState<any>(null);
  const [resolveOpen, setResolveOpen] = useState<{ d: any; winner: "buyer" | "seller" } | null>(null);
  const [notes, setNotes] = useState("");

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin-disputes"],
    queryFn: () => api("/disputes/admin/list"),
    refetchInterval: 10000,
  });

  const filtered = filter === "open" ? rows.filter((r) => r.status === "open") : rows;

  const resolveMut = useMutation({
    mutationFn: ({ id, winner, notes }: any) => api(`/disputes/admin/resolve/${id}`, { method: "POST", body: JSON.stringify({ winner, notes }) }),
    onSuccess: () => {
      toast({ title: "Dispute resolved" });
      setResolveOpen(null); setNotes("");
      qc.invalidateQueries({ queryKey: ["admin-disputes"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="text-red-600" /> Disputes
          </h1>
          <div className="flex gap-2">
            <Button variant={filter === "open" ? "default" : "outline"} size="sm" onClick={() => setFilter("open")}>Open</Button>
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>All</Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No disputes.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((d) => (
              <Card key={d.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div>
                      <div className="font-semibold">Dispute #{d.id} — Order #{d.orderId} — ₹{d.order?.amount}</div>
                      <div className="text-xs text-muted-foreground">Opened {format(new Date(d.createdAt), "MMM dd HH:mm")}</div>
                      {d.reason && <div className="text-xs mt-1 italic">"{d.reason}"</div>}
                    </div>
                    <Badge variant="outline" className={
                      d.status === "open" ? "bg-red-100 text-red-700" :
                      d.status === "buyer_won" ? "bg-blue-100 text-blue-700" :
                      d.status === "seller_won" ? "bg-orange-100 text-orange-700" :
                      "bg-gray-100 text-gray-700"
                    }>{d.status.replace(/_/g, " ")}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="border rounded p-2 bg-blue-50/50">
                      <div className="text-xs font-semibold text-blue-700 mb-1">BUYER</div>
                      <div className="text-sm">{d.buyer?.username} (Trust: {d.buyer?.trustScore})</div>
                      <div className="text-xs text-muted-foreground">UTR: {d.order?.utrNumber || "-"}</div>
                      <div className="text-xs mt-1">
                        Bank Statement: {d.buyerBankStatementUrl ? <a href={d.buyerBankStatementUrl} target="_blank" className="text-primary underline">View</a> : <span className="text-red-500">Not uploaded</span>}
                      </div>
                    </div>
                    <div className="border rounded p-2 bg-orange-50/50">
                      <div className="text-xs font-semibold text-orange-700 mb-1">SELLER</div>
                      <div className="text-sm">{d.seller?.username} (Trust: {d.seller?.trustScore})</div>
                      <div className="text-xs text-muted-foreground">UPI: {d.order?.userUpiId || "-"}</div>
                      <div className="text-xs mt-1">
                        Bank: {d.sellerBankStatementUrl ? <a href={d.sellerBankStatementUrl} target="_blank" className="text-primary underline">View</a> : <span className="text-red-500">No</span>} ·{" "}
                        Recording: {d.sellerRecordingUrl ? <a href={d.sellerRecordingUrl} target="_blank" className="text-primary underline">View</a> : <span className="text-red-500">No</span>} ·{" "}
                        LastTxn: {d.sellerLastTxnScreenshotUrl ? <a href={d.sellerLastTxnScreenshotUrl} target="_blank" className="text-primary underline">View</a> : <span className="text-red-500">No</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 flex-wrap">
                    <Button variant="ghost" size="sm" onClick={() => setView(d)}><Eye className="h-3 w-3 mr-1" /> Details</Button>
                    {d.status === "open" && (
                      <>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setResolveOpen({ d, winner: "buyer" })}>
                          Buyer Wins
                        </Button>
                        <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={() => setResolveOpen({ d, winner: "seller" })}>
                          Seller Wins
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!viewDispute} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Dispute #{viewDispute?.id} Evidence</DialogTitle></DialogHeader>
          {viewDispute && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-blue-700 mb-2">Buyer Proof</h3>
                {viewDispute.order?.screenshotUrl && (
                  <div><div className="text-xs mb-1">Payment Screenshot:</div><img src={viewDispute.order.screenshotUrl} className="w-full border rounded" /></div>
                )}
                {viewDispute.buyerBankStatementUrl && (
                  <div className="mt-2"><div className="text-xs mb-1">Bank Statement:</div><img src={viewDispute.buyerBankStatementUrl} className="w-full border rounded" /></div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-orange-700 mb-2">Seller Proof</h3>
                {viewDispute.sellerBankStatementUrl && (
                  <div><div className="text-xs mb-1">Bank Statement:</div><img src={viewDispute.sellerBankStatementUrl} className="w-full border rounded" /></div>
                )}
                {viewDispute.sellerLastTxnScreenshotUrl && (
                  <div className="mt-2"><div className="text-xs mb-1">Last Txn Screenshot:</div><img src={viewDispute.sellerLastTxnScreenshotUrl} className="w-full border rounded" /></div>
                )}
                {viewDispute.sellerRecordingUrl && (
                  <div className="mt-2"><div className="text-xs mb-1">Recording:</div><a href={viewDispute.sellerRecordingUrl} target="_blank" className="text-primary underline">Open</a></div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resolveOpen} onOpenChange={(o) => !o && setResolveOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Award to {resolveOpen?.winner.toUpperCase()}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {resolveOpen?.winner === "buyer"
                ? "Buyer will be credited the chunk amount + reward. Seller will lose 10 trust points."
                : "Chunk will be returned to seller's queue. Buyer will lose 10 trust points."}
            </p>
            <textarea className="w-full border rounded p-2 text-sm" rows={3} placeholder="Admin notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(null)}>Cancel</Button>
            <Button onClick={() => resolveMut.mutate({ id: resolveOpen!.d.id, winner: resolveOpen!.winner, notes })} disabled={resolveMut.isPending}>
              {resolveMut.isPending ? "Resolving..." : "Confirm Resolution"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
