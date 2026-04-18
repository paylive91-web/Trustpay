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
import { Image as ImageIcon } from "lucide-react";

const STATUS_OPTIONS = ["all", "available", "locked", "pending_confirmation", "disputed", "confirmed", "cancelled", "expired"];

export default function AdminOrders() {
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

  const { data: ordersAll, isLoading } = useAdminGetOrders(params, {
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
            <h1 className="text-2xl font-bold tracking-tight">Orders (Read-only)</h1>
            <p className="text-sm text-muted-foreground">P2P trades are settled automatically. Use the Disputes tab to intervene.</p>
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
                          {(order.screenshotUrl || order.recordingUrl) && (
                            <Button size="sm" variant="ghost" onClick={() => setViewOrder(order)}>
                              <ImageIcon className="w-4 h-4" />
                            </Button>
                          )}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order #{viewOrder?.id} — Proof</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {viewOrder?.utrNumber && (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">UTR Number</div>
                <div className="font-bold text-blue-700 text-lg">{viewOrder.utrNumber}</div>
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
    </AdminLayout>
  );
}
