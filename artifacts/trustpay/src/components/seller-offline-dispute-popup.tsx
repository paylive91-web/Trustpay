import React, { useState } from "react";
import { useGetMyDisputes, getGetMyDisputesQueryKey, type MyDispute } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X, ArrowRight, ShieldAlert } from "lucide-react";
import { Link } from "wouter";

export default function SellerOfflineDisputePopup() {
  const { data } = useGetMyDisputes({
    query: { queryKey: getGetMyDisputesQueryKey(), refetchInterval: 60000 },
  });
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const disputes: MyDispute[] = data ?? [];

  const pendingOffline = disputes.filter(
    (d) =>
      d.role === "seller" &&
      d.status === "open" &&
      d.triggerReason === "seller_offline" &&
      !d.sellerProofAt
  );

  if (!pendingOffline.length) return null;

  const d = pendingOffline[0];
  const orderAmount = d.order?.amount ?? d.amount ?? "?";
  const orderId = d.orderId ?? d.order?.id ?? "?";

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4">
      <div className="bg-white border-2 border-orange-400 rounded-2xl shadow-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="font-bold text-sm text-gray-900">Dispute Open!</div>
              <div className="text-xs text-gray-500">Order #{orderId} · ₹{Number(orderAmount).toFixed(2)}</div>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-orange-50 rounded-xl p-3 text-xs text-orange-800 leading-relaxed">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Tum offline the jab yeh order expire hua. Buyer ne claim kiya hai usne payment ki hai.{" "}
              <strong>24 ghante ke andar apna proof submit karo</strong> — bank statement ya screenshot
              jisme dikhe ki koi payment nahi aayi.
            </span>
          </div>
        </div>

        {pendingOffline.length > 1 && (
          <div className="text-xs text-center text-gray-500">
            +{pendingOffline.length - 1} aur dispute{pendingOffline.length - 1 > 1 ? "s" : ""} pending
          </div>
        )}

        <Link href="/orders?tab=disputes">
          <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2">
            Proof Submit Karo
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
