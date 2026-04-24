import React, { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthToken } from "@/lib/auth";
import { isSmsPermissionGranted, hasNativeBridge, requestSmsPermission } from "@/lib/sms-bridge";

const STORAGE_KEY = "tp_sms_permission_granted";

function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

export default function SmsPermissionPopup() {
  const [show, setShow] = useState(false);
  const [noBridge, setNoBridge] = useState(false);

  useEffect(() => {
    if (!isAndroid()) return;
    const token = getAuthToken();
    if (!token) return;
    if (isSmsPermissionGranted()) return;
    setNoBridge(!hasNativeBridge());
    setShow(true);

    function handlePermissionResult(e: Event) {
      const granted: boolean = (e as CustomEvent).detail?.granted ?? false;
      if (granted) {
        localStorage.setItem(STORAGE_KEY, "granted");
        setShow(false);
      }
    }

    document.addEventListener("trustpay:sms-permission-result", handlePermissionResult);
    return () => {
      document.removeEventListener("trustpay:sms-permission-result", handlePermissionResult);
    };
  }, []);

  if (!show) return null;

  function handleAllow() {
    if (hasNativeBridge()) {
      requestSmsPermission();
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-[430px] rounded-t-[32px] bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white overflow-hidden shadow-[0_-20px_80px_rgba(0,0,0,0.6)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-fuchsia-500 via-sky-500 to-emerald-400" />
        <div className="px-6 pt-6 pb-8 space-y-5">
          <div className="flex items-center justify-center">
            <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-fuchsia-600 via-sky-500 to-emerald-500 flex items-center justify-center shadow-[0_8px_32px_rgba(99,102,241,0.4)]">
              <MessageSquare className="w-10 h-10 text-white" />
            </div>
          </div>

          <div className="text-center">
            <div className="text-xl font-black tracking-tight">Notification Access Required</div>
          </div>

          <Button
            className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-to-r from-fuchsia-500 via-sky-500 to-emerald-500 hover:from-fuchsia-600 hover:via-sky-600 hover:to-emerald-600 text-white shadow-[0_4px_24px_rgba(99,102,241,0.5)] border-0 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAllow}
            disabled={noBridge}
          >
            <MessageSquare className="mr-2 h-5 w-5" />
            Allow
          </Button>
        </div>
      </div>
    </div>
  );
}
