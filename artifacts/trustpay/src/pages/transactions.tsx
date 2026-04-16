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
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold">Transaction History</h1>
        
        <div className="space-y-3">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
          ) : transactions && transactions.length > 0 ? (
            transactions.map((tx) => (
              <Card key={tx.id} className="overflow-hidden border-none shadow-sm">
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-full ${
                      tx.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {tx.type === "credit" ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{tx.description}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {tx.createdAt ? format(new Date(tx.createdAt), "MMM dd, yyyy HH:mm") : ""}
                      </div>
                    </div>
                  </div>
                  <div className={`font-bold flex items-center ${
                    tx.type === 'credit' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {tx.type === 'credit' ? '+' : '-'}
                    <IndianRupee className="w-4 h-4 mx-0.5" />
                    {tx.amount.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <History className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p>No transaction history available.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
