import React, { useState } from "react";
import {
  useGetOrders,
  useGetMyDisputes,
  useSubmitBuyerProof,
  useSubmitSellerProof,
  getGetMyDisputesQueryKey,
  type MyDispute,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { IndianRupee, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2, XCircle, ShieldAlert, Upload } from "lucide-react";
import { fileToDataUrl } from "@/lib/dispute-actions";

export default function Orders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<"all" | "deposit" | "withdrawal" | "disputes">("all");

  const ordersTypeParam = filterType === "deposit" || filterType === "withdrawal" ? filterType : undefined;
  const { data: orders, isLoading } = useGetOrders(ordersTypeParam ? { type: ordersTypeParam } : undefined);

  const filteredOrders = orders?.filter(o => filterType === "all" || filterType === "disputes" || o.type === filterType) || [];

  // Disputes
  const { data: disputesData, isLoading: loadingDisputes } = useGetMyDisputes();
  const disputes = disputesData ?? [];
  const [activeProof, setActiveProof] = useState<MyDispute | null>(null);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [lastTxnFile, setLastTxnFile] = useState<File | null>(null);

  const invalidateDisputes = () => queryClient.invalidateQueries({ queryKey: getGetMyDisputesQueryKey() });

  const buyerProofMut = useSubmitBuyerProof();
  const sellerProofMut = useSubmitSellerProof();
  const uploading = buyerProofMut.isPending || sellerProofMut.isPending;

  const submitProof = async () => {
    if (!activeProof) return;
    try {
      const role = activeProof.role;
      if (role === "buyer") {
        if (!bankFile) { toast({ title: "Bank statement required", variant: "destructive" }); return; }
        const bankStatementUrl = await fileToDataUrl(bankFile);
        await buyerProofMut.mutateAsync({ id: activeProof.id, data: { bankStatementUrl } });
      } else {
        if (!bankFile || !recordingFile || !lastTxnFile) {
          toast({ title: "All three proofs required", variant: "destructive" }); return;
        }
        const [bankStatementUrl, recordingUrl, lastTxnScreenshotUrl] = await Promise.all([
          fileToDataUrl(bankFile),
          fileToDataUrl(recordingFile),
          fileToDataUrl(lastTxnFile),
        ]);
        await sellerProofMut.mutateAsync({ id: activeProof.id, data: { bankStatementUrl, recordingUrl, lastTxnScreenshotUrl } });
      }
      toast({ title: "Proof uploaded successfully" });
      setActiveProof(null); setBankFile(null); setRecordingFile(null); setLastTxnFile(null);
      invalidateDisputes();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
      case "approved": return <CheckCircle2 className="w-4 h-4 text-green-500 mr-1" />;
      case "rejected":
      case "cancelled":
      case "expired": return <XCircle className="w-4 h-4 text-destructive mr-1" />;
      case "disputed": return <ShieldAlert className="w-4 h-4 text-red-500 mr-1" />;
      default: return <Clock className="w-4 h-4 text-yellow-500 mr-1" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
      case "approved": return "bg-green-100 text-green-800 border-green-200";
      case "rejected":
      case "cancelled":
      case "expired": return "bg-red-100 text-red-800 border-red-200";
      case "disputed": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
  };

  const dispStatusColor = (s: string) =>
    s === "open" ? "bg-yellow-100 text-yellow-800" :
    s === "buyer_won" || s === "auto_resolved" ? "bg-green-100 text-green-800" :
    "bg-red-100 text-red-800";

  return (
    <Layout>
      <div className="p-4 space-y-4 flex flex-col h-full">
        <h1 className="text-xl font-bold">My Orders</h1>

        <Tabs value={filterType} onValueChange={(v) => setFilterType(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="deposit">Buy</TabsTrigger>
            <TabsTrigger value="withdrawal">Sell</TabsTrigger>
            <TabsTrigger value="disputes">
              Disputes{disputes.filter((d) => d.status === "open").length > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">{disputes.filter((d) => d.status === "open").length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1 space-y-3 pb-4">
          {filterType === "disputes" ? (
            loadingDisputes ? (
              Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
            ) : disputes.length > 0 ? (
              disputes.map((d) => (
                <Card key={d.id} className={`border-2 ${d.status === "open" ? "border-red-200" : "border-muted"}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-red-500" />
                          Dispute #{d.id} ({d.role})
                        </div>
                        <div className="text-xs text-muted-foreground">{d.createdAt ? format(new Date(d.createdAt), "MMM dd HH:mm") : ""}</div>
                      </div>
                      <Badge variant="outline" className={dispStatusColor(d.status)}>{d.status}</Badge>
                    </div>
                    {d.order && (
                      <div className="bg-muted/40 rounded p-2 text-sm">
                        Order #{d.order.id} · ₹{parseFloat(d.order.amount).toFixed(2)}
                      </div>
                    )}
                    <div className="text-sm"><span className="text-muted-foreground">Reason:</span> {d.reason}</div>
                    {d.adminNotes && <div className="text-xs italic text-muted-foreground">Admin: {d.adminNotes}</div>}

                    {d.status === "open" && (
                      <div className="border-t pt-3 space-y-2">
                        <div className="text-xs text-muted-foreground">
                          {d.role === "buyer"
                            ? "Upload your bank statement (PDF or image) showing the payment to settle this dispute."
                            : "Upload bank statement, screen recording, and last-transaction screenshot to defend yourself."}
                        </div>
                        {(() => {
                          const deadline = new Date(new Date(d.createdAt).getTime() + 24 * 3600 * 1000).getTime();
                          const ms = deadline - Date.now();
                          if (ms <= 0) return <div className="text-xs text-red-600 font-medium">Proof window expired — admin will auto-resolve.</div>;
                          const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
                          return <div className="text-xs text-amber-700 font-medium">Time left to submit proof: {h}h {m}m</div>;
                        })()}
                        <div className="flex flex-wrap gap-2">
                          {(d.role === "buyer" ? !d.buyerProofAt : !d.sellerProofAt) ? (
                            <Button size="sm" onClick={() => { setActiveProof(d); setBankFile(null); setRecordingFile(null); setLastTxnFile(null); }}>
                              <Upload className="w-3 h-3 mr-1" /> Upload Proof
                            </Button>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700">Proof submitted</Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center p-8 text-muted-foreground">No disputes — keep it clean!</div>
            )
          ) : isLoading ? (
            Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
          ) : filteredOrders.length > 0 ? (
            filteredOrders.map((order: any) => (
              <Card key={order.id} className="overflow-hidden border shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-full mr-3 ${order.type === "deposit" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"}`}>
                        {order.type === "deposit" ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-semibold capitalize text-base">{order.type === "deposit" ? "Buy" : "Sell"}</div>
                        <div className="text-xs text-muted-foreground">
                          {order.createdAt ? format(new Date(order.createdAt), "MMM dd, yyyy HH:mm") : ""}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={`flex items-center rounded-full px-2 py-0.5 border ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      <span className="capitalize">{order.status}</span>
                    </Badge>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-2">
                    <div className="flex justify-between">
                      <div>
                        <div className="text-muted-foreground text-xs mb-0.5">Amount</div>
                        <div className="font-semibold flex items-center"><IndianRupee className="w-3.5 h-3.5 mr-0.5" />{order.amount.toFixed(2)}</div>
                      </div>
                      {order.type === "deposit" && order.rewardPercent > 0 ? (
                        <div className="text-right">
                          <div className="text-muted-foreground text-xs mb-0.5">Reward ({order.rewardPercent}%)</div>
                          <div className="font-semibold text-green-600 flex items-center justify-end">
                            +<IndianRupee className="w-3.5 h-3.5 mr-0.5 ml-1" />{order.rewardAmount.toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-right">
                          <div className="text-muted-foreground text-xs mb-0.5">UPI</div>
                          <div className="font-medium text-xs">{order.userUpiId || "-"}</div>
                        </div>
                      )}
                    </div>
                    {order.utrNumber && (
                      <div className="border-t pt-2 text-xs text-muted-foreground">UTR: <span className="font-medium text-foreground">{order.utrNumber}</span></div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center p-8 text-muted-foreground h-full flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p>No orders found.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!activeProof} onOpenChange={(o) => !o && setActiveProof(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload {activeProof?.role === "buyer" ? "Buyer" : "Seller"} Proof</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Bank Statement Screenshot *</label>
              <input type="file" accept="image/*,application/pdf" onChange={(e) => setBankFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
            </div>
            {activeProof?.role === "seller" && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Screen Recording (Image) *</label>
                  <input type="file" accept="image/*" onChange={(e) => setRecordingFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Last Transaction Screenshot *</label>
                  <input type="file" accept="image/*" onChange={(e) => setLastTxnFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
                </div>
              </>
            )}
            <div className="text-xs text-muted-foreground">Files must be under 5 MB each.</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveProof(null)}>Cancel</Button>
            <Button onClick={submitProof} disabled={uploading}>{uploading ? "Uploading..." : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
