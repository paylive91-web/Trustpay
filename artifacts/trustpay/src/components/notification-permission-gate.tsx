import React, { useEffect, useState } from "react";
import { Bell, BellRing, Lock, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/api-config";
import { getAuthToken } from "@/lib/auth";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

async function doSubscribe() {
  if (!("PushManager" in window) || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return;
    const res = await fetch(`${API_BASE}/push/vapid-public-key`);
    const { key } = await res.json();
    if (!key) return;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const token = getAuthToken();
    await fetch(`${API_BASE}/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }),
    });
  } catch {}
}

export default function NotificationPermissionGate() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("PushManager" in window)) return;
    if (Notification.permission === "granted" || Notification.permission === "denied") return;
    if (sessionStorage.getItem("notif_gate_dismissed")) return;
    // Small delay so it doesn't pop up immediately
    const t = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(t);
  }, []);

  if (!show || dismissed) return null;

  const handleAllow = async () => {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") await doSubscribe();
    } catch {}
    setLoading(false);
    setShow(false);
    setDismissed(true);
  };

  const handleLater = () => {
    sessionStorage.setItem("notif_gate_dismissed", "1");
    setShow(false);
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center pb-6 px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-[420px] rounded-3xl overflow-hidden shadow-[0_20px_80px_rgba(79,70,229,0.4)] animate-in slide-in-from-bottom-4 duration-300">
        {/* Top gradient bar */}
        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-5 pt-5 pb-4 relative">
          <div className="absolute top-3 right-3">
            <button onClick={handleLater} className="text-white/60 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-indigo-200 mb-0.5">Important</div>
              <div className="text-[17px] font-extrabold text-white leading-tight">Notifications Enable Karein</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="bg-white px-5 py-4 space-y-3">
          <div className="space-y-2">
            {[
              { icon: <BellRing className="w-4 h-4 text-indigo-500" />, text: "Jab koi aapka order lock kare — turant alert" },
              { icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />, text: "Payment aane par push notification" },
              { icon: <Bell className="w-4 h-4 text-amber-500" />, text: "Order cancel ya dispute hone par bhi notify karein" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[13px] text-slate-700">
                <div className="shrink-0">{item.icon}</div>
                <span>{item.text}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 leading-snug">
            Notifications off hone par aap order miss kar sakte hain. Ye app ke liye zaroori hai.
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
              className="flex-2 flex-grow-[2] h-11 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/30"
              onClick={handleAllow}
              disabled={loading}
            >
              {loading ? "Enabling..." : "🔔 Enable Notifications"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
