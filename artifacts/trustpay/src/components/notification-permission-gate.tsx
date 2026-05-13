import React, { useEffect, useState } from "react";
import { Bell, BellRing, ShieldCheck, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/api-config";
import { getAuthToken } from "@/lib/auth";

const DISMISSED_KEY = "notif_gate_v2_dismissed_until";
const DISMISS_HOURS = 24; // ask again after 24h if user taps "later"

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

async function trySubscribe(): Promise<"ok" | "denied" | "error"> {
  if (!("PushManager" in window) || !("serviceWorker" in navigator)) return "error";
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "denied";

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();

    let sub = existing;
    if (!sub) {
      const res = await fetch(`${API_BASE}/push/vapid-public-key`);
      const { key } = await res.json();
      if (!key) return "error";
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }

    // Always re-save subscription to ensure it's in DB
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const token = getAuthToken();
    await fetch(`${API_BASE}/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      }),
    });
    return "ok";
  } catch {
    return "error";
  }
}

async function silentlySubscribeIfGranted() {
  if (!("PushManager" in window) || !("serviceWorker" in navigator)) return;
  if (Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    // Check if subscription exists in DB by trying to save the existing one
    const existing = await reg.pushManager.getSubscription();
    if (!existing) return;
    const json = existing.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const token = getAuthToken();
    await fetch(`${API_BASE}/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      }),
    });
  } catch {}
}

type GateState = "idle" | "ask" | "denied_info" | "done";

export default function NotificationPermissionGate() {
  const [state, setState] = useState<GateState>("idle");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Wait for service worker to be ready + small delay for page to settle
    const t = setTimeout(async () => {
      if (!("Notification" in window) || !("PushManager" in window)) return;

      const perm = Notification.permission;

      if (perm === "granted") {
        // Already allowed — silently ensure subscription is saved in DB
        silentlySubscribeIfGranted();
        return;
      }

      if (perm === "denied") {
        // Browser blocked — show info on how to enable from settings
        // Only show once per day
        const until = localStorage.getItem(DISMISSED_KEY);
        if (until && Date.now() < parseInt(until)) return;
        setState("denied_info");
        return;
      }

      // perm === "default" — show the friendly gate
      const until = localStorage.getItem(DISMISSED_KEY);
      if (until && Date.now() < parseInt(until)) return;
      setState("ask");
    }, 2000);

    return () => clearTimeout(t);
  }, []);

  const handleAllow = async () => {
    setLoading(true);
    const result = await trySubscribe();
    setLoading(false);
    if (result === "denied") {
      setState("denied_info");
    } else {
      setState("done");
    }
  };

  const handleLater = () => {
    const until = Date.now() + DISMISS_HOURS * 60 * 60 * 1000;
    localStorage.setItem(DISMISSED_KEY, String(until));
    setState("done");
  };

  if (state === "idle" || state === "done") return null;

  // ── Denied: show how to enable from browser settings ─────────────────
  if (state === "denied_info") {
    return (
      <div className="fixed inset-0 z-[9998] flex items-end justify-center pb-6 px-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[420px] rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(234,88,12,0.25)] animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 pt-5 pb-4 relative">
            <button onClick={handleLater} className="absolute top-3 right-3 text-white/70 hover:text-white">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-orange-100 mb-0.5">Enable Notifications</div>
                <div className="text-[16px] font-extrabold text-white leading-tight">Notifications Blocked Hain</div>
              </div>
            </div>
          </div>
          <div className="bg-white px-5 py-4 space-y-3">
            <p className="text-[13px] text-slate-700 leading-relaxed">
              Aapne pehle notifications block ki thi. Enable karne ke liye:
            </p>
            <div className="space-y-2">
              {[
                "Browser mein address bar ke paas lock/settings icon tap karein",
                'Site settings mein "Notifications" ko Allow karein',
                "Page refresh karein",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5">
                    {i + 1}
                  </div>
                  <span className="text-[12.5px] text-slate-600">{step}</span>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              className="w-full h-10 rounded-2xl text-slate-400 text-sm"
              onClick={handleLater}
            >
              Theek hai, baad mein karenge
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Default: friendly permission request ──────────────────────────────
  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center pb-6 px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-[420px] rounded-3xl overflow-hidden shadow-[0_20px_80px_rgba(234,88,12,0.30)] animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 pt-5 pb-4 relative">
          <button onClick={handleLater} className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-orange-100 mb-0.5">Zaroori</div>
              <div className="text-[17px] font-extrabold text-white leading-tight">Notifications Allow Karein</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="bg-white px-5 py-4 space-y-3">
          <div className="space-y-2.5">
            {[
              { icon: <BellRing className="w-4 h-4 text-orange-500" />, text: "Jab koi aapka order lock kare — turant alert milega" },
              { icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />, text: "Payment aane par push notification phone pe aayegi" },
              { icon: <Bell className="w-4 h-4 text-blue-500" />, text: "Order cancel ya dispute hone par bhi notify honge" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[13px] text-slate-700">
                <div className="shrink-0">{item.icon}</div>
                <span>{item.text}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 leading-snug">
            Notifications off hone par aap order miss kar sakte hain aur dispute ho sakta hai.
          </p>

          <div className="flex gap-2 pt-1">
            <Button
              variant="ghost"
              className="flex-1 h-11 rounded-2xl text-slate-400 text-sm"
              onClick={handleLater}
              disabled={loading}
            >
              Baad mein
            </Button>
            <Button
              className="flex-[2] h-11 rounded-2xl text-white font-bold text-sm"
              style={{
                background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                boxShadow: "0 8px 20px -6px rgba(234,88,12,0.50)",
              }}
              onClick={handleAllow}
              disabled={loading}
            >
              {loading ? "Please wait..." : "🔔 Allow Notifications"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
