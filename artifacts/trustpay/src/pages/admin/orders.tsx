import React, { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminGetOrders } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Image as ImageIcon, XCircle, RotateCcw, Info, CheckCircle2, XCircle as XCircleIcon, AlertCircle, Scan } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";

function OcrField({ label, value, storedMatch }: {
  label: string;
  value: string | null | undefined;
  storedMatch?: "match" | "mismatch" | "not_extracted" | null;
}) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b last:border-0">
      <div className="text-xs text-muted-foreground shrink-0 w-40">{label}</div>
      <div className="flex items-center gap-1.5 flex-1 justify-end">
        {value != null ? (
          <span className="font-medium text-sm">{value}</span>
        ) : (
          <span className="text-xs text-muted-foreground italic">Not found</span>
        )}
        {storedMatch === "match" && (
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" aria-label="Matches submitted value" />
        )}
        {storedMatch === "mismatch" && (
          <XCircleIcon className="w-4 h-4 text-red-500 shrink-0" aria-label="Does not match submitted value" />
        )}
      </div>
    </div>
  );
}

const STATUS_OPTIONS = ["all", "available", "locked", "pending_confirmation", "disputed", "confirmed", "cancelled", "expired"];
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

export default function AdminOrders() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [userQuery, setUserQuery] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const params: any = {};
  if (statusFilter !== "all") params.status = statusFilter;
  if (typeFilter !== "all") params.type = typeFilter;

  const { data: ordersAll, isLoading, refetch } = useAdminGetOrders(params, {
    query: { queryKey: ["/api/admin/orders", params] },
  });

  const orders = React.useMemo(() => {
    if (!ordersAll) return [];
    const uq = userQuery.trim().toLowerCase();
    const min = minAmount ? Number(minAmount) : null;
    const max = maxAmount ? Number(maxAmount) : null;
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() + 86399999 : null;
    return (ordersAll as any[]).filter((o) => {
      if (uq) {
        const u = `${o.user?.username || ""} ${o.user?.phone || ""} ${o.userId}`.toLowerCase();
        if (!u.includes(uq)) return false;
      }
      const amt = Number(o.amount);
      if (min != null && amt < min) return false;
      if (max != null && amt > max) return false;
      const ts = new Date(o.createdAt).getTime();
      if (from != null && ts < from) return false;
      if (to != null && ts > to) return false;
      return true;
    });
  }, [ordersAll, userQuery, minAmount, maxAmount, fromDate, toDate]);

  const [viewOrder, setViewOrder] = useState<any>(null);
  const [reverseOrder, setReverseOrder] = useState<any>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const handleForceClose = async (order: any) => {
    if (!confirm(`Force-close order #${order.id} (${order.status})? This will cancel it and release the seller's hold.`)) return;
    setActionLoading(order.id);
    try {
      await api(`/admin/orders/${order.id}/force-close`, { method: "POST" });
      toast({ title: `Order #${order.id} force-closed` });
      refetch();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReverse = async () => {
    if (!reverseOrder || !reverseReason.trim()) return;
    setActionLoading(reverseOrder.id);
    try {
      await api(`/admin/orders/${reverseOrder.id}/reverse`, { method: "POST", body: JSON.stringify({ reason: reverseReason.trim() }) });
      toast({ title: `Order #${reverseOrder.id} reversed` });
      setReverseOrder(null);
      setReverseReason("");
      refetch();
    } catch (e: any) {
      toast({ title: "Reversal failed", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const statusColor = (s: string) => {
    if (s === "confirmed") return "bg-green-100 text-green-800";
    if (s === "disputed") return "bg-red-100 text-red-800";
    if (s === "cancelled" || s === "expired") return "bg-gray-100 text-gray-700";
    if (s === "pending_confirmation") return "bg-blue-100 text-blue-800";
    if (s === "locked") return "bg-orange-100 text-orange-800";
    return "bg-yellow-100 text-yellow-800";
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
            <p className="text-sm text-muted-foreground">View, filter, force-close stuck orders, or reverse completed trades.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <Input className="w-[180px]" placeholder="User / phone / id" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
            <Input className="w-[110px]" type="number" placeholder="Min ₹" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
            <Input className="w-[110px]" type="number" placeholder="Max ₹" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
            <Input className="w-[150px]" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input className="w-[150px]" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="deposit">Buy</SelectItem>
                <SelectItem value="withdrawal">Sell</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s === "all" ? "All Status" : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800">
              <strong>Force-Close:</strong> Cancels a stuck <em>locked</em> or <em>pending_confirmation</em> order, releasing the seller's hold. Use when a buyer has disappeared and the order is stuck.
              <strong className="ml-2">Reverse:</strong> Undoes a <em>confirmed</em> trade — deducts the amount from the buyer's wallet and returns it to the seller. Requires a written reason which is logged permanently.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell></TableRow>
                  ) : orders && orders.length > 0 ? (
                    orders.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.id}</TableCell>
                        <TableCell>
                          <div className="font-medium">{order.user?.username || `User ${order.userId}`}</div>
                          <div className="text-xs text-muted-foreground">{order.user?.phone || ""}</div>
                          <div className="text-xs text-muted-foreground">{format(new Date(order.createdAt), "MMM dd HH:mm")}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={order.type === "deposit" ? "text-blue-600 border-blue-200 bg-blue-50" : "text-orange-600 border-orange-200 bg-orange-50"}>
                            {order.type === "deposit" ? "Buy" : "Sell"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold">₹{order.amount}</div>
                          {order.rewardPercent > 0 && (
                            <div className="text-xs text-green-600">+{order.rewardPercent}% (₹{order.rewardAmount})</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-1">
                            {order.userUpiId && <div>UPI: <span className="font-medium">{order.userUpiId}</span></div>}
                            {order.utrNumber && <div className="font-bold text-blue-700">UTR: {order.utrNumber}</div>}
                            {order.lockedByUserId && <div>Buyer: #{order.lockedByUserId}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColor(order.status)}>{order.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end flex-wrap">
                            {(order.screenshotUrl || order.recordingUrl) && (
                              <Button size="sm" variant="ghost" onClick={() => setViewOrder(order)}>
                                <ImageIcon className="w-4 h-4" />
                              </Button>
                            )}
                            {["locked", "pending_confirmation"].includes(order.status) && (
                              <Button size="sm" variant="outline" className="text-orange-600 border-orange-300" onClick={() => handleForceClose(order)} disabled={actionLoading === order.id}>
                                <XCircle className="w-3.5 h-3.5 mr-1" /> Force Close
                              </Button>
                            )}
                            {order.status === "confirmed" && (
                              <Button size="sm" variant="outline" className="text-red-600 border-red-300" onClick={() => { setReverseOrder(order); setReverseReason(""); }}>
                                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reverse
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No orders found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!viewOrder} onOpenChange={(open) => !open && setViewOrder(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Order #{viewOrder?.id} — Proof &amp; OCR Analysis</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {viewOrder?.utrNumber && (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">UTR Number (Submitted)</div>
                <div className="font-bold text-blue-700 text-lg">{viewOrder.utrNumber}</div>
              </div>
            )}

            {/* OCR Analysis Panel */}
            {viewOrder?.ocrStatus && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 flex items-center gap-2 border-b">
                  <Scan className="w-4 h-4 text-slate-600" />
                  <span className="font-medium text-sm">OCR Analysis</span>
                  <Badge variant="outline" className={
                    viewOrder.ocrStatus === "done" ? "text-green-700 border-green-300 bg-green-50" :
                    viewOrder.ocrStatus === "pending" ? "text-yellow-700 border-yellow-300 bg-yellow-50" :
                    viewOrder.ocrStatus === "unreadable" ? "text-orange-700 border-orange-300 bg-orange-50" :
                    "text-red-700 border-red-300 bg-red-50"
                  }>
                    {viewOrder.ocrStatus}
                  </Badge>
                </div>
                <div className="p-3 space-y-2">
                  {viewOrder.ocrStatus === "pending" && (
                    <p className="text-sm text-muted-foreground">OCR is still processing…</p>
                  )}
                  {viewOrder.ocrStatus === "failed" && (
                    <p className="text-sm text-red-600">OCR failed to process this image.</p>
                  )}
                  {viewOrder.ocrStatus === "unreadable" && (
                    <div className="flex items-center gap-2 text-orange-700 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      No recognizable payment data could be extracted from this screenshot.
                    </div>
                  )}
                  {(viewOrder.ocrStatus === "done") && (
                    <div className="space-y-2">
                      <OcrField
                        label="UTR in Screenshot"
                        value={viewOrder.ocrUtr}
                        storedMatch={viewOrder.ocrUtrMatch}
                      />
                      <OcrField
                        label="Amount in Screenshot"
                        value={viewOrder.ocrAmount ? `₹${viewOrder.ocrAmount}` : null}
                        storedMatch={viewOrder.ocrAmountMatch}
                      />
                      <OcrField label="Date/Time in Screenshot" value={viewOrder.ocrTimestamp} />
                      <OcrField label="Bank/App Detected" value={viewOrder.ocrBank} />
                    </div>
                  )}
                  {viewOrder.ocrRawText && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Raw OCR text</summary>
                      <pre className="text-xs mt-1 bg-slate-50 p-2 rounded border max-h-32 overflow-y-auto whitespace-pre-wrap break-words">{viewOrder.ocrRawText}</pre>
                    </details>
                  )}
                </div>
              </div>
            )}

            {viewOrder?.screenshotUrl && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Payment Screenshot</div>
                <img src={viewOrder.screenshotUrl} alt="Screenshot" className="w-full rounded-lg border" />
              </div>
            )}
            {viewOrder?.recordingUrl && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Screen Recording</div>
                <img src={viewOrder.recordingUrl} alt="Recording" className="w-full rounded-lg border" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOrder(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reverseOrder} onOpenChange={(o) => !o && setReverseOrder(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reverse Order #{reverseOrder?.id}?</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              This will deduct <strong>₹{reverseOrder?.amount}</strong> from the buyer (User #{reverseOrder?.lockedByUserId}) and return it to the seller (User #{reverseOrder?.userId}). The order will be marked as cancelled. This action is <strong>permanent</strong> and logged.
            </p>
            <div className="space-y-1">
              <label className="text-sm font-medium">Reason for reversal <span className="text-red-500">*</span></label>
              <textarea
                className="w-full border rounded p-2 text-sm"
                rows={3}
                placeholder="Enter the reason for reversing this trade..."
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseOrder(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReverse} disabled={!reverseReason.trim() || actionLoading === reverseOrder?.id}>
              {actionLoading === reverseOrder?.id ? "Reversing..." : "Confirm Reversal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
