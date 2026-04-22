import React, { useEffect, useState } from "react";
import { MessageSquare, ShieldCheck, Zap, Lock, AlertTriangle } from "lucide-react";
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

  function handleInstallApp() {
    window.open("https://play.google.com/store", "_blank");
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

          <div className="text-center space-y-1">
            <div className="text-xl font-black tracking-tight">SMS Permission Required</div>
            <div className="text-sm text-slate-400">Automatic payment verification ke liye</div>
          </div>

          {noBridge ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-200 leading-snug">
                Yeh feature sirf <strong>TrustPay Android App</strong> mein available hai. Browser
                mein SMS permission nahi diya ja sakta. APK install karne ke baad yeh
                screen automatically unlock ho jayegi.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <PermissionFeature
                icon={<Zap className="w-4 h-4 text-yellow-400" />}
                title="Auto UTR Detection"
                desc="Bank SMS se UTR number automatically read hoga — koi manual entry nahi"
              />
              <PermissionFeature
                icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
                title="Instant Verification"
                desc="Payment SMS match hote hi order auto-confirm — seller ka wait khatam"
              />
              <PermissionFeature
                icon={<Lock className="w-4 h-4 text-sky-400" />}
                title="Fraud Protection"
                desc="Fake UTR aur duplicate payments automatically block ho jaate hain"
              />
            </div>
          )}

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-slate-400 leading-relaxed">
            TrustPay sirf payment SMS padhta hai — personal messages, OTPs, ya koi aur SMS kabhi
            access nahi ki jaati.
          </div>

          <Button
            className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-to-r from-fuchsia-500 via-sky-500 to-emerald-500 hover:from-fuchsia-600 hover:via-sky-600 hover:to-emerald-600 text-white shadow-[0_4px_24px_rgba(99,102,241,0.5)] border-0 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAllow}
            disabled={noBridge}
          >
            <MessageSquare className="mr-2 h-5 w-5" />
            Allow SMS Permission
          </Button>
          {noBridge && (
            <Button
              variant="outline"
              className="w-full h-12 rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
              onClick={handleInstallApp}
            >
              Install APK App
            </Button>
          )}
          <p className="text-center text-[11px] text-slate-500">
            {noBridge
              ? "Browser se nahi chalega. APK install karo ya app open karo."
              : "Yeh permission bina diye auto-verify kaam nahi karega."}
          </p>
        </div>
      </div>
    </div>
  );
}

function PermissionFeature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl p-3">
      <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-slate-400 mt-0.5 leading-snug">{desc}</div>
      </div>
    </div>
  );
}
