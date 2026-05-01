import React from "react";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { format } from "date-fns";
import { History, IndianRupee, RefreshCw } from "lucide-react";
import { API_BASE } from "@/lib/api-config";

interface TimeoutItem {
  id: number;
  orderId: number | null;
  disputeId: number | null;
  amount: number;
  sellerId: number | null;
  sellerUsername: string | null;
  buyerId: number | null;
  buyerUsername: string | null;
  description: string;
  createdAt: string;
}

interface TimeoutResponse {
  totalAmount: number;
  totalCount: number;
  todayAmount: number;
  todayCount: number;
  items: TimeoutItem[];
}

async function fetchTimeoutHistory(): Promise<TimeoutResponse> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/admin/timeout-history?limit=200`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to load timeout history");
  return res.json();
}

export default function AdminTimeoutHistory() {
  const { data, isLoading, refetch, isFetching } = useQuery<TimeoutResponse>({
    queryKey: ["/admin/timeout-history"],
    queryFn: fetchTimeoutHistory,
    refetchInterval: 30000,
  });

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <History className="h-6 w-6 text-gray-700" />
              Timeout History
            </h1>
            <p className="text-sm text-muted-foreground">
              All disputes closed as a timeout — held amounts forfeited from sellers to the TrustPay platform account.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Forfeited (All Time)</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-1">
                <IndianRupee className="h-6 w-6" />
                {isLoading ? <Skeleton className="h-8 w-24" /> : (data?.totalAmount ?? 0).toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "—" : `${data?.totalCount ?? 0} timeout${(data?.totalCount ?? 0) === 1 ? "" : "s"}`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Today</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-1">
                <IndianRupee className="h-6 w-6" />
                {isLoading ? <Skeleton className="h-8 w-24" /> : (data?.todayAmount ?? 0).toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "—" : `${data?.todayCount ?? 0} timeout${(data?.todayCount ?? 0) === 1 ? "" : "s"} today`}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Timeouts</CardTitle>
            <CardDescription>Showing the latest 200 entries.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !data?.items?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                No timeout disputes yet. When you close a dispute as a timeout, it will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="py-2 pr-3">When</th>
                      <th className="py-2 pr-3">Dispute</th>
                      <th className="py-2 pr-3">Order</th>
                      <th className="py-2 pr-3">Seller (Forfeited)</th>
                      <th className="py-2 pr-3">Buyer</th>
                      <th className="py-2 pr-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((it) => (
                      <tr key={it.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {format(new Date(it.createdAt), "MMM dd, HH:mm")}
                        </td>
                        <td className="py-2 pr-3">
                          {it.disputeId ? <Badge variant="outline">#{it.disputeId}</Badge> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2 pr-3">
                          {it.orderId ? `#${it.orderId}` : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2 pr-3">
                          {it.sellerUsername ? (
                            <span>
                              {it.sellerUsername}
                              <span className="text-muted-foreground ml-1">(#{it.sellerId})</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {it.buyerUsername ? (
                            <span>
                              {it.buyerUsername}
                              <span className="text-muted-foreground ml-1">(#{it.buyerId})</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right font-semibold flex items-center justify-end gap-0.5">
                          <IndianRupee className="h-3 w-3" />
                          {it.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
