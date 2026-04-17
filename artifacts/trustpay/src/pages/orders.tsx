import React, { useState } from "react";
import { useGetOrders } from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { IndianRupee, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2, XCircle } from "lucide-react";

export default function Orders() {
  const [filterType, setFilterType] = useState<"all" | "deposit" | "withdrawal">("all");

  const { data: orders, isLoading } = useGetOrders({
    query: { queryKey: ["/api/orders", { type: filterType !== "all" ? filterType : undefined }] }
  }, {
    request: filterType !== "all" ? { type: filterType } : undefined
  } as any);

  const filteredOrders = orders?.filter(o => filterType === "all" || o.type === filterType) || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle2 className="w-4 h-4 text-green-500 mr-1" />;
      case "rejected": return <XCircle className="w-4 h-4 text-destructive mr-1" />;
      default: return <Clock className="w-4 h-4 text-yellow-500 mr-1" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-100 text-green-800 border-green-200";
      case "rejected": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
  };

  return (
    <Layout>
      <div className="p-4 space-y-4 flex flex-col h-full">
        <h1 className="text-xl font-bold">My Orders</h1>

        <Tabs value={filterType} onValueChange={(v) => setFilterType(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="deposit">Buy</TabsTrigger>
            <TabsTrigger value="withdrawal">Sell</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1 space-y-3 pb-4">
          {isLoading ? (
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
                    {order.type === "deposit" ? (
                      <>
                        <div className="flex justify-between">
                          <div>
                            <div className="text-muted-foreground text-xs mb-0.5">Amount</div>
                            <div className="font-semibold flex items-center">
                              <IndianRupee className="w-3.5 h-3.5 mr-0.5" />{order.amount.toFixed(2)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-muted-foreground text-xs mb-0.5">Reward ({order.rewardPercent}%)</div>
                            <div className="font-semibold text-green-600 flex items-center justify-end">
                              + <IndianRupee className="w-3.5 h-3.5 mr-0.5 ml-1" />{order.rewardAmount.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        {order.utrNumber && (
                          <div className="border-t pt-2 text-xs text-muted-foreground">
                            UTR: <span className="font-medium text-foreground">{order.utrNumber}</span>
                          </div>
                        )}
                        <div className="border-t pt-2 flex justify-between items-center">
                          <span className="text-xs text-muted-foreground font-medium">Total</span>
                          <span className="font-bold text-primary flex items-center">
                            <IndianRupee className="w-4 h-4 mr-0.5" />{order.totalAmount.toFixed(2)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <div>
                            <div className="text-muted-foreground text-xs mb-0.5">Amount</div>
                            <div className="font-semibold flex items-center">
                              <IndianRupee className="w-3.5 h-3.5 mr-0.5" />{order.amount.toFixed(2)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-muted-foreground text-xs mb-0.5">UPI</div>
                            <div className="font-medium text-xs">{order.userUpiId || "-"}</div>
                          </div>
                        </div>
                      </>
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
    </Layout>
  );
}
