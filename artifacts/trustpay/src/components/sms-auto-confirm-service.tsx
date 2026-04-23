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

async function reportSmsToServer(opts: {
  sender: string;
  body: string;
  bucket: "suspicious" | "unparsed";
  parsedUtr?: string | null;
  parsedAmount?: number | null;
  isDebit?: boolean;
}): Promise<void> {
  try {
    const token = getAuthToken();
    if (!token) return;
    await fetch(`${API_BASE}/sms/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(opts),
    });
  } catch {
  }
}

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

  const { data: customTrustedSenders = [] } = useQuery<string[]>({
    queryKey: ["sms-trusted-senders"],
    queryFn: async () => {
      const token = getAuthToken();
      if (!token) return [];
      const res = await fetch(`${API_BASE}/sms/trusted-senders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.senderKeys) ? data.senderKeys : [];
    },
    enabled: isAndroid() && !!getAuthToken(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

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

  const customSendersSet = React.useMemo(
    () => new Set(customTrustedSenders.map((k) => k.toUpperCase())),
    [customTrustedSenders],
  );

  const isEffectivelyTrusted = React.useCallback(
    (sender: string) => {
      if (isTrustedSender(sender)) return true;
      const upper = sender.toUpperCase().trim();
      const segments = upper.split(/[-_.\s+/\\]+/).filter((s: string) => s.length >= 3);
      return segments.some((seg: string) => customSendersSet.has(seg));
    },
    [customSendersSet],
  );

  useEffect(() => {
    if (!isAndroid()) return;

    const remove = addSmsListener(async (msg: SmsMessage) => {
      if (!isEffectivelyTrusted(msg.sender)) {
        reportSmsToServer({ sender: msg.sender, body: msg.sms, bucket: "unparsed" });
        return;
      }
      const parsed = parseBankSms(msg.sms);
      if (!parsed) {
        reportSmsToServer({ sender: msg.sender, body: msg.sms, bucket: "suspicious" });
        return;
      }

      let orderMatched = false;
      for (const order of pendingOrders) {
        const id: number = order.id;
        const utrMatch = parsed.utr.toUpperCase() === String(order.utrNumber || "").toUpperCase();
        const amountMatch = Math.abs(parsed.amount - Number(order.amount)) <= AMOUNT_TOLERANCE;
        if (utrMatch && amountMatch) {
          orderMatched = true;
          if (!claimOrderConfirm(id)) break;
          const result = await confirmOrder(id);
          if (result?.error) {
            releaseOrderClaim(id);
            return;
          }
          reportSmsToServer({
            sender: msg.sender,
            body: msg.sms,
            bucket: "matched",
            parsedUtr: parsed.utr,
            parsedAmount: parsed.amount,
          });
          setConfirmedOrder({
            orderId: id,
            utrNumber: order.utrNumber,
            amount: Number(order.amount),
          });
          break;
        }
      }

      if (!orderMatched) {
        reportSmsToServer({
          sender: msg.sender,
          body: msg.sms,
          bucket: "suspicious",
          parsedUtr: parsed.utr,
          parsedAmount: parsed.amount,
        });
      }
    });

    return remove;
  }, [pendingOrders, isEffectivelyTrusted]);

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
