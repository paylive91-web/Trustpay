import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoPath from "@assets/file_00000000da60720ba5a8a74acd96c937_1776335785514.png";

const APK_UA_MARKER = "TrustPayAndroid";
const FLAG_KEY = "trustpay:mustInstallApp";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type AppSettings = {
  apkDownloadUrl?: string;
  apkVersion?: string;
  forceAppDownload?: boolean;
  appName?: string;
};

/**
 * Returns true when the page is loaded inside the Capacitor APK shell. We
 * stamp a custom User-Agent suffix in `capacitor.config.ts` so the web layer
 * can cheaply detect the wrapper without bundling Capacitor into the web build.
 */
function isInsideApk(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.userAgent.includes(APK_UA_MARKER);
}

/**
 * Mark the current browser as "needs the APK". Called right after a successful
 * registration. The flag persists in localStorage so reloading or even closing
 * the browser doesn't bypass the lock — the only way to clear it is to open
 * the app from inside the installed APK.
 */
export function markMustInstallApp() {
  try {
    localStorage.setItem(FLAG_KEY, "1");
  } catch {}
}

export function clearMustInstallApp() {
  try {
    localStorage.removeItem(FLAG_KEY);
  } catch {}
}

export default function InstallLock() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Inside the APK we never lock — clear any stale flag from a prior browser
    // session and keep the overlay hidden forever.
    if (isInsideApk()) {
      clearMustInstallApp();
      return;
    }
    // Never lock admin routes: the operator must always be able to log in to
    // /admin to configure the APK download URL itself, otherwise misconfiguring
    // the lock would brick the entire system.
    if (typeof window !== "undefined" && window.location.pathname.includes("/admin")) {
      return;
    }
    let mounted = true;
    fetch(`${API_BASE}/settings/app`)
      .then((r) => r.json())
      .then((s) => {
        if (!mounted) return;
        setSettings(s);
        const hasFlag = (() => { try { return localStorage.getItem(FLAG_KEY) === "1"; } catch { return false; } })();
        // Show the lock only when (a) admin has globally enabled
        // forceAppDownload OR this browser registered after the requirement
        // was added, AND (b) the admin has actually uploaded an APK URL.
        // Without an APK URL the lock would be unbypassable, so we silently
        // skip — the admin will turn it on once distribution is ready.
        const wantsLock = !!s?.forceAppDownload || hasFlag;
        const hasUrl = !!s?.apkDownloadUrl?.trim();
        if (wantsLock && hasUrl) setShow(true);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  if (!show) return null;

  const apkUrl = settings?.apkDownloadUrl?.trim();

  return (
    <div
      className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6 text-center overflow-y-auto"
      data-testid="install-lock-overlay"
    >
      <img src={logoPath} alt="App logo" className="w-24 h-24 mb-6" />
      <h1 className="text-2xl font-bold mb-2">{settings?.appName || "TrustPay"} ko mobile me chalayein</h1>
      <p className="text-muted-foreground mb-6 max-w-md">
        Behtar suraksha aur tezi ke liye, hamari Android app download karke install karein.
        Web par aap aage nahi badh sakte.
      </p>

      <div className="w-full max-w-sm space-y-3 bg-card border rounded-2xl p-5">
        <div className="flex items-center gap-3 text-left">
          <div className="bg-primary/10 text-primary p-2 rounded-full">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="text-sm">
            <div className="font-medium">Android app version {settings?.apkVersion || "1.0.0"}</div>
            <div className="text-xs text-muted-foreground">~10 MB · Install se Unknown Sources allow karein</div>
          </div>
        </div>

        <Button asChild className="w-full h-12 text-base" data-testid="button-download-apk">
          <a href={apkUrl} download>
            <Download className="w-4 h-4 mr-2" /> Download App (APK)
          </a>
        </Button>

        <ol className="text-xs text-muted-foreground text-left list-decimal pl-5 space-y-1 pt-2 border-t">
          <li>"Download App" par tap karein</li>
          <li>Phone settings → "Install Unknown Apps" allow karein</li>
          <li>App install karke open karein, login wahi credentials se</li>
        </ol>
      </div>
    </div>
  );
}
