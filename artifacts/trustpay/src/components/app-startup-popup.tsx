import React, { useEffect, useMemo, useState } from "react";
import { useGetAppSettings } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Lock, Clock } from "lucide-react";
import { getAuthToken } from "@/lib/auth";

type SellerAlert = {
  id: number;
  amount: number;
  status: "locked" | "pending_confirmation";
  utrNumber?: string | null;
  screenshotUrl?: string | null;
  recordingUrl?: string | null;
  buyer?: { id?: number; username?: string } | null;
  confirmDeadline?: string | null;
  lockedAt?: string | null;
};

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

async function api(path: string, opts: RequestInit = {}) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function fmtCountdown(ms: number) {
  if (ms <= 0) return "00:00";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AppStartupPopup() {
  const qc = useQueryClient();
  const [annOpen, setAnnOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [queue, setQueue] = useState<any[]>([]);
  const [proofViewer, setProofViewer] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const { data: settings } = useGetAppSettings();

  const today = new Date().toDateString();

  const { data: alerts = [], refetch } = useQuery<SellerAlert[]>({
    queryKey: ["seller-alerts"],
    queryFn: () => api("/p2p/my-seller-alerts"),
    refetchInterval: 4000,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!settings) return;
    const items: any[] = [];

    const broadcast = (settings as any)?.broadcastNotification;
    if (broadcast?.message) {
      const broadcastKey = `broadcast_seen_${broadcast.sentAt}`;
      if (!localStorage.getItem(broadcastKey)) {
        items.push({ _key: broadcastKey, title: broadcast.title || "TrustPay", message: broadcast.message });
      }
    }

    const popupKey = `popup_seen_${today}`;
    if (!localStorage.getItem(popupKey)) {
      const announcements = (settings as any)?.announcements;
      if (announcements?.length) {
        announcements.forEach((ann: any) => {
          if (ann.message) items.push({ _key: popupKey, _sharedKey: true, title: ann.title || "Announcement", message: ann.message, imageUrl: ann.imageUrl });
        });
      } else if (settings?.popupMessage) {
        items.push({ _key: popupKey, _sharedKey: true, title: "Announcement", message: settings.popupMessage, imageUrl: (settings as any)?.popupImageUrl });
      }
    }

    if (items.length > 0) {
      setQueue(items);
      setCurrentIndex(0);
      setAnnOpen(true);
    }
  }, [JSON.stringify(settings)]);

  const handleNext = () => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      const sharedKey = `popup_seen_${today}`;
      localStorage.setItem(sharedKey, "1");
      queue.forEach((item: any) => localStorage.setItem(item._key, "1"));
      setAnnOpen(false);
    }
  };

  const handleSkipAll = () => {
    queue.forEach((item: any) => localStorage.setItem(item._key, "1"));
    const sharedKey = `popup_seen_${today}`;
    localStorage.setItem(sharedKey, "1");
    setAnnOpen(false);
  };

  const confirmReceipt = async (id: number) => {
    await api(`/p2p/confirm/${id}`, { method: "POST" });
    await qc.invalidateQueries({ queryKey: ["my-buy"] });
    await qc.invalidateQueries({ queryKey: ["my-chunks"] });
    await qc.invalidateQueries({ queryKey: ["pending-confirms"] });
    await qc.invalidateQueries({ queryKey: ["me"] });
    await refetch();
  };

  const openProof = (url?: string | null) => {
    if (!url) return;
    setProofViewer(url);
  };

  // Seller alerts take priority and are non-dismissable until resolved.
  const current = alerts[0];
  if (current) {
    const remaining = current.confirmDeadline ? Math.max(0, new Date(current.confirmDeadline).getTime() - now) : 0;
    const isLocked = current.status === "locked";

    return (
      <>
        <Dialog open={true}>
          <DialogContent
            className="max-w-[95vw] w-[440px] rounded-2xl p-0 overflow-hidden [&>button]:hidden"
            onEscapeKeyDown={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            {isLocked ? (
              <>
                <DialogHeader className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <DialogTitle className="text-left text-xl font-black">ORDER LOCKED</DialogTitle>
                      <p className="text-sm font-medium mt-1">Buyer locked your order. Waiting for payment proof…</p>
                    </div>
                    <Lock className="h-6 w-6 shrink-0 animate-pulse" />
                  </div>
                </DialogHeader>
                <div className="p-4 space-y-4">
                  <div className="rounded-2xl bg-muted/50 p-4">
                    <div className="text-sm text-muted-foreground">Amount</div>
                    <div className="text-3xl font-black">₹{Number(current.amount).toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Buyer: {current.buyer?.username || `#${current.buyer?.id || "?"}`}
                    </div>
                    <div className="text-xs text-blue-700 mt-2 font-medium flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Lock expires in {fmtCountdown(remaining)}
                    </div>
                  </div>
                  <div className="rounded-2xl border-2 border-dashed border-blue-400/40 bg-blue-50 p-3 text-sm text-blue-900">
                    Stay on this screen. As soon as the buyer submits payment proof, you’ll be able to confirm here.
                  </div>
                </div>
              </>
            ) : (
              <>
                <DialogHeader className="p-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <DialogTitle className="text-left text-xl font-black">PAYMENT COMING</DialogTitle>
                      <p className="text-sm font-medium mt-1">Buyer shared proof. Please verify and confirm.</p>
                    </div>
                    <BellRing className="h-6 w-6 shrink-0 animate-pulse" />
                  </div>
                </DialogHeader>
                <div className="p-4 space-y-4">
                  <div className="rounded-2xl bg-muted/50 p-4">
                    <div className="text-sm text-muted-foreground">Amount</div>
                    <div className="text-3xl font-black">₹{Number(current.amount).toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Buyer: {current.buyer?.username || `#${current.buyer?.id || current.id}`}
                    </div>
                    {current.utrNumber && (
                      <div className="text-xs mt-2">
                        UTR: <span className="font-mono font-semibold">{current.utrNumber}</span>
                      </div>
                    )}
                    <div className="text-xs text-orange-700 mt-2 font-medium">
                      Auto-confirms in {fmtCountdown(remaining)}
                    </div>
                  </div>
                  <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4">
                    <button
                      type="button"
                      onClick={() => openProof(current.screenshotUrl)}
                      className="w-full text-left"
                    >
                      <div className="text-base font-black tracking-wide text-primary">CHECK PAYMENT PROOF</div>
                      <div className="text-sm text-muted-foreground mt-1">Tap to open the buyer’s screenshot in full screen.</div>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      className="h-12 bg-green-600 hover:bg-green-700"
                      onClick={() => confirmReceipt(current.id)}
                    >
                      YES — Payment Received
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11"
                      onClick={() => (window.location.href = (import.meta.env.BASE_URL || "/") + "sell")}
                    >
                      NOT received — Open Dispute
                    </Button>
                  </div>
                  <div className="text-[11px] text-center text-muted-foreground">
                    This popup will stay until you confirm or dispute.
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={!!proofViewer} onOpenChange={(open) => !open && setProofViewer(null)}>
          <DialogContent className="max-w-[96vw] w-[96vw] p-0 overflow-hidden bg-black">
            <div className="p-3 flex items-center justify-between bg-black text-white">
              <div className="text-base font-bold">Payment proof</div>
              <Button variant="outline" className="text-black bg-white hover:bg-white/90" onClick={() => setProofViewer(null)}>Close</Button>
            </div>
            {proofViewer && (
              <img src={proofViewer} alt="Payment proof" className="w-full max-h-[80vh] object-contain bg-black" />
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (queue.length === 0) return null;
  const currentAnn = queue[currentIndex];

  return (
    <Dialog open={annOpen} onOpenChange={(open) => !open && handleSkipAll()}>
      <DialogContent className="max-w-[90%] w-[380px] rounded-xl p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-muted/30">
          <DialogTitle className="text-center">{currentAnn?.title || "Announcement"}</DialogTitle>
          {queue.length > 1 && (
            <p className="text-xs text-center text-muted-foreground">{currentIndex + 1} / {queue.length}</p>
          )}
        </DialogHeader>
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {currentAnn?.imageUrl && (
            <img src={currentAnn.imageUrl} alt="Announcement" className="w-full rounded-lg mb-4 object-cover" />
          )}
          <p className="text-sm text-foreground whitespace-pre-wrap">{currentAnn?.message || ""}</p>
        </div>
        <div className="p-4 border-t bg-muted/30 flex gap-2">
          {queue.length > 1 && currentIndex < queue.length - 1 ? (
            <>
              <Button variant="outline" onClick={handleSkipAll} className="flex-1">Skip All</Button>
              <Button onClick={handleNext} className="flex-1">Next ({currentIndex + 1}/{queue.length})</Button>
            </>
          ) : (
            <Button onClick={handleNext} className="w-full">Got it</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
