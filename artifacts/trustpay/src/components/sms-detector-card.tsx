import React, { useEffect, useRef, useState } from "react";
import { MessageSquare, CheckCircle2, Clock, Smartphone, Zap } from "lucide-react";
import { parseBankSms } from "@/lib/utr-validator";

interface SmsDetectorCardProps {
  submittedAt: string;
  utrNumber: string;
  amount: number;
  onAutoConfirm: () => void;
  confirmPending: boolean;
}

const SMS_WINDOW_MS = 5 * 60 * 1000;
const AMOUNT_TOLERANCE = 1;

function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

declare global {
  interface Window {
    TrustPayNative?: {
      requestSmsPermission?: () => void;
      onSmsReceived?: (sms: string) => void;
    };
  }
}

export default function SmsDetectorCard({
  submittedAt,
  utrNumber,
  amount,
  onAutoConfirm,
  confirmPending,
}: SmsDetectorCardProps) {
  const [now, setNow] = useState(Date.now());
  const [matched, setMatched] = useState(false);
  const confirmedRef = useRef(false);

  const submittedMs = new Date(submittedAt).getTime();
  const elapsed = now - submittedMs;
  const windowPassed = elapsed >= SMS_WINDOW_MS;
  const remaining = Math.max(0, SMS_WINDOW_MS - elapsed);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isAndroid()) return;

    function handleSmsEvent(e: Event) {
      const sms: string = (e as CustomEvent).detail?.sms ?? "";
      if (!sms || confirmedRef.current) return;
      const parsed = parseBankSms(sms);
      if (!parsed) return;
      const utrMatch = parsed.utr.toUpperCase() === utrNumber.toUpperCase();
      const amountMatch = Math.abs(parsed.amount - amount) <= AMOUNT_TOLERANCE;
      if (utrMatch && amountMatch) {
        confirmedRef.current = true;
        setMatched(true);
        onAutoConfirm();
      }
    }

    document.addEventListener("trustpay:sms", handleSmsEvent);

    if (window.TrustPayNative?.onSmsReceived) {
      window.TrustPayNative.onSmsReceived = (sms: string) => {
        document.dispatchEvent(new CustomEvent("trustpay:sms", { detail: { sms } }));
      };
    }

    return () => {
      document.removeEventListener("trustpay:sms", handleSmsEvent);
    };
  }, [utrNumber, amount, onAutoConfirm]);

  if (!isAndroid()) {
    return (
      <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-3 text-sm text-sky-800 flex items-start gap-3">
        <Smartphone className="w-5 h-5 shrink-0 mt-0.5 text-sky-600" />
        <div>
          <div className="font-semibold">Bank SMS check karo</div>
          <div className="text-xs mt-0.5 text-sky-700">
            Apne bank app mein ₹{amount} ki payment check karo (UTR:{" "}
            <span className="font-mono font-semibold">{utrNumber}</span>). Payment mili ho to
            neeche "YES — Received" dabao.
          </div>
        </div>
      </div>
    );
  }

  if (matched || confirmPending) {
    return (
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 flex items-center gap-3">
        <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0 animate-pulse" />
        <div>
          <div className="font-bold text-emerald-800">Payment SMS mil gaya!</div>
          <div className="text-xs text-emerald-700 mt-0.5">
            UTR <span className="font-mono font-semibold">{utrNumber}</span> match — trade
            auto-confirm ho raha hai...
          </div>
        </div>
      </div>
    );
  }

  if (windowPassed) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 space-y-2">
        <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
          <MessageSquare className="w-4 h-4" />
          SMS nahi aaya?
        </div>
        <div className="text-xs text-amber-700 leading-relaxed">
          5 minute ho gaye lekin bank SMS detect nahi hua. Apna payment history manually check
          karo aur neeche confirm karo.
        </div>
        <div className="text-xs font-mono text-amber-800 font-semibold">
          UTR: {utrNumber} · ₹{amount}
        </div>
      </div>
    );
  }

  const secs = Math.floor(remaining / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const progress = Math.min(100, (elapsed / SMS_WINDOW_MS) * 100);

  return (
    <div className="rounded-2xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-sky-50 to-white p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-fuchsia-800 font-semibold text-sm">
          <Zap className="w-4 h-4 animate-pulse" />
          Payment SMS detect ho raha hai...
        </div>
        <div className="flex items-center gap-1 text-xs text-fuchsia-700 font-mono">
          <Clock className="w-3 h-3" />
          {mm}:{ss}
        </div>
      </div>

      <div className="w-full h-1.5 bg-fuchsia-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-fuchsia-500 to-sky-500 rounded-full transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="text-[11px] text-fuchsia-700 leading-snug">
        Bank SMS mein UTR{" "}
        <span className="font-mono font-semibold">{utrNumber}</span> aur ₹{amount} match hone
        par automatically confirm ho jayega.
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
        5 minute baad SMS nahi aaya to manual confirm option pe jaana hoga
      </div>
    </div>
  );
}
