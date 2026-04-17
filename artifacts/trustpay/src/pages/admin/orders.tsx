import React, { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminGetOrders, useAdminApproveOrder, useAdminRejectOrder, useAdminUpdateOrder } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminGetOrdersQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Eye, Image } from "lucide-react";

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params: any = {};
  if (statusFilter !== "all") params.status = statusFilter;
  if (typeFilter !== "all") params.type = typeFilter;

  const { data: orders, isLoading } = useAdminGetOrders(params, {
    query: { queryKey: ["/api/admin/orders", params] }
  });

  const approveMutation = useAdminApproveOrder();
  const rejectMutation = useAdminRejectOrder();
  const updateMutation = useAdminUpdateOrder();

  const [editOrder, setEditOrder] = useState<any>(null);
  const [editRewardPercent, setEditRewardPercent] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [viewOrder, setViewOrder] = useState<any>(null);

  const handleApprove = (id: number) => {
    approveMutation.mutate({ id, data: {} }, {
      onSuccess: () => {
        toast({ title: "Order approved" });
        queryClient.invalidateQueries({ queryKey: getAdminGetOrdersQueryKey(params) });
      }
    });
  };

  const handleReject = (id: number) => {
    if (window.confirm("Are you sure you want to reject this order?")) {
      rejectMutation.mutate({ id, data: {} }, {
        onSuccess: () => {
          toast({ title: "Order rejected" });
          queryClient.invalidateQueries({ queryKey: getAdminGetOrdersQueryKey(params) });
        }
      });
    }
  };

  const openEdit = (order: any) => {
    setEditOrder(order);
    setEditRewardPercent(order.rewardPercent.toString());
    setEditAmount(order.amount.toString());
  };

  const handleSaveEdit = () => {
    if (!editOrder) return;
    updateMutation.mutate({
      id: editOrder.id,
      data: {
        rewardPercent: parseFloat(editRewardPercent),
        amount: parseFloat(editAmount),
      }
    }, {
      onSuccess: () => {
        toast({ title: "Order updated" });
        setEditOrder(null);
        queryClient.invalidateQueries({ queryKey: getAdminGetOrdersQueryKey(params) });
      }
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Manage Orders</h1>

          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="withdrawal">Withdrawal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
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
                    <TableHead>User / Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount + Reward</TableHead>
                    <TableHead>Details / UTR</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell>
                    </TableRow>
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
                          {order.type === "deposit" && (
                            <div className="text-xs text-green-600">+{order.rewardPercent}% (₹{order.rewardAmount})</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.type === "deposit" ? (
                            <div className="text-xs space-y-1">
                              <div>Name: <span className="font-medium">{order.userName || "-"}</span></div>
                              {order.utrNumber && (
                                <div className="font-bold text-blue-700">UTR: {order.utrNumber}</div>
                              )}
                              {order.screenshotUrl && (
                                <button
                                  className="text-blue-600 underline flex items-center gap-1"
                                  onClick={() => setViewOrder(order)}
                                >
                                  <Image className="w-3 h-3" /> Screenshot
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs space-y-1">
                              <div>UPI: <span className="font-medium">{order.userUpiId}</span></div>
                              <div>Name: <span className="font-medium">{order.userUpiName}</span></div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            order.status === "approved" ? "bg-green-100 text-green-800" :
                            order.status === "rejected" ? "bg-red-100 text-red-800" :
                            "bg-yellow-100 text-yellow-800"
                          }>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {order.status === "pending" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleApprove(order.id)} className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
                                  Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleReject(order.id)} className="text-red-600 hover:bg-red-50 border-red-200">
                                  Reject
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => openEdit(order)}>Edit</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No orders found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editOrder} onOpenChange={(open) => !open && setEditOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Order #{editOrder?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount (₹)</label>
              <Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reward Percent (%)</label>
              <Input type="number" value={editRewardPercent} onChange={(e) => setEditRewardPercent(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrder(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Screenshot View Dialog */}
      <Dialog open={!!viewOrder} onOpenChange={(open) => !open && setViewOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Screenshot — Order #{viewOrder?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {viewOrder?.utrNumber && (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">UTR Number</div>
                <div className="font-bold text-blue-700 text-lg">{viewOrder.utrNumber}</div>
              </div>
            )}
            {viewOrder?.screenshotUrl && (
              <img src={viewOrder.screenshotUrl} alt="Payment Screenshot" className="w-full rounded-lg border" />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOrder(null)}>Close</Button>
            {viewOrder?.status === "pending" && (
              <>
                <Button variant="outline" onClick={() => { handleApprove(viewOrder.id); setViewOrder(null); }} className="bg-green-50 text-green-700 border-green-200">Approve</Button>
                <Button variant="outline" onClick={() => { handleReject(viewOrder.id); setViewOrder(null); }} className="text-red-600 border-red-200">Reject</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
