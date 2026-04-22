import React, { useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getAuthToken } from "@/lib/auth";
import { addSmsListener, isTrustedSender, claimOrderConfirm, releaseOrderClaim, type SmsMessage } from "@/lib/sms-bridge";
import { parseBankSms } from "@/lib/utr-validator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
const AMOUNT_TOLERANCE = 1;

async function confirmOrder(id: number): Promise<{ error?: string }> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/p2p/confirm/${id}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

interface MatchedOrder {
  orderId: number;
  utrNumber: string;
  amount: number;
}

export default function SmsAutoConfirmService() {
  const [confirmedOrder, setConfirmedOrder] = useState<MatchedOrder | null>(null);

  const { data: pendingOrders = [] } = useQuery<any[]>({
    queryKey: ["my-pending-confirmations-bg"],
    queryFn: async () => {
      const token = getAuthToken();
      if (!token) return [];
      const res = await fetch(`${API_BASE}/p2p/my-pending-confirmations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAndroid() && !!getAuthToken(),
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (!isAndroid() || pendingOrders.length === 0) return;

    const remove = addSmsListener(async (msg: SmsMessage) => {
      if (!isTrustedSender(msg.sender)) return;
      const parsed = parseBankSms(msg.sms);
      if (!parsed) return;
      for (const order of pendingOrders) {
        const id: number = order.id;
        const utrMatch = parsed.utr.toUpperCase() === String(order.utrNumber || "").toUpperCase();
        const amountMatch = Math.abs(parsed.amount - Number(order.amount)) <= AMOUNT_TOLERANCE;
        if (utrMatch && amountMatch) {
          if (!claimOrderConfirm(id)) break;
          const result = await confirmOrder(id);
          if (result?.error) {
            releaseOrderClaim(id);
            return;
          }
          setConfirmedOrder({
            orderId: id,
            utrNumber: order.utrNumber,
            amount: Number(order.amount),
          });
          break;
        }
      }
    });

    return remove;
  }, [pendingOrders]);

  if (!confirmedOrder) return null;

  return (
    <Dialog open onOpenChange={() => setConfirmedOrder(null)}>
      <DialogContent className="max-w-[92vw] w-[360px] rounded-[28px] border border-emerald-200 bg-gradient-to-br from-white via-emerald-50 to-green-50 shadow-2xl overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-400 via-green-500 to-teal-400" />
        <DialogHeader className="pt-4">
          <DialogTitle className="flex items-center gap-3 text-emerald-800">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white shadow-lg">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <span className="text-lg font-black">Payment Received!</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 px-2">
          <div className="rounded-2xl bg-emerald-100/60 border border-emerald-200 p-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-emerald-700">Amount</span>
              <span className="font-bold text-emerald-900">₹{confirmedOrder.amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-700">UTR</span>
              <span className="font-mono font-semibold text-emerald-900">{confirmedOrder.utrNumber}</span>
            </div>
          </div>
          <p className="text-sm text-emerald-800 text-center font-medium">
            Bank SMS se payment verify ho gayi. Trade auto-confirm ho gaya!
          </p>
          <Button
            className="w-full h-11 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold shadow-md border-0"
            onClick={() => setConfirmedOrder(null)}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
