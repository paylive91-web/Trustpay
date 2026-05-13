import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/api-config";
import { getAuthToken } from "@/lib/auth";

const DISMISSED_KEY = "notif_gate_v3_dismissed_until";

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
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const res = await fetch(`${API_BASE}/push/vapid-public-key`);
      const { key } = await res.json();
      if (!key) return "error";
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
    }
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const token = getAuthToken();
    await fetch(`${API_BASE}/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }),
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
    const existing = await reg.pushManager.getSubscription();
    if (!existing) return;
    const json = existing.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
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

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!("Notification" in window) || !("PushManager" in window)) return;
      const perm = Notification.permission;
      if (perm === "granted") { silentlySubscribeIfGranted(); return; }
      if (perm === "denied") return;
      const until = localStorage.getItem(DISMISSED_KEY);
      if (until && Date.now() < parseInt(until)) return;
      setShow(true);
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  const handleAllow = async () => {
    setLoading(true);
    await trySubscribe();
    setLoading(false);
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center pb-6 px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-[420px] rounded-3xl overflow-hidden shadow-[0_20px_80px_rgba(234,88,12,0.30)] animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-orange-100">TrustPay</div>
              <div className="text-[17px] font-extrabold text-white leading-tight">Enable Payment Notifications</div>
            </div>
          </div>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="text-[14px] text-slate-600 leading-relaxed mb-4">
            Allow notifications to get instant alerts for payments, order updates, and disputes — even when the app is closed.
          </p>
          <Button
            className="w-full h-12 rounded-2xl text-white font-bold text-[15px]"
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
  );
}
