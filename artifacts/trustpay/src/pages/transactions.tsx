import React from "react";
import { useGetTransactions } from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { IndianRupee, ArrowDownRight, ArrowUpRight, History } from "lucide-react";

export default function Transactions() {
  const { data: transactions, isLoading } = useGetTransactions();

  return (
    <Layout>
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 border-b border-orange-200 px-4 pt-4 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-sm">
            <History className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Transaction History</h1>
            <p className="text-[11px] text-orange-700/70">All credits and debits</p>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2 pb-6">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : transactions && transactions.length > 0 ? (
          transactions.map((tx) => (
            <Card key={tx.id} className="overflow-hidden border-none shadow-md">
              <div className={`h-1 ${tx.type === "credit" ? "bg-gradient-to-r from-emerald-400 to-teal-400" : "bg-gradient-to-r from-rose-400 to-red-400"}`} />
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    tx.type === "credit"
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-rose-100 text-rose-600"
                  }`}>
                    {tx.type === "credit"
                      ? <ArrowDownRight className="w-5 h-5" />
                      : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-900">{tx.description}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {tx.createdAt ? format(new Date(tx.createdAt), "MMM dd, yyyy HH:mm") : ""}
                    </div>
                  </div>
                </div>
                <div className={`font-black flex items-center text-base ${
                  tx.type === "credit" ? "text-emerald-600" : "text-rose-600"
                }`}>
                  {tx.type === "credit" ? "+" : "-"}
                  <IndianRupee className="w-4 h-4 mx-0.5" />
                  {tx.amount.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-16 flex flex-col items-center">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
              <History className="w-8 h-8 text-orange-300" />
            </div>
            <p className="text-muted-foreground text-sm">No transaction history available.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
