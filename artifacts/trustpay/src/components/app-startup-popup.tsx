import React, { useEffect, useMemo, useState } from "react";
import { useGetAppSettings } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing } from "lucide-react";

type PendingConfirmation = {
  id: number;
  amount: number;
  utrNumber?: string | null;
  screenshotUrl?: string | null;
  recordingUrl?: string | null;
  buyer?: { id?: number; username?: string } | null;
  confirmDeadline?: string | null;
};

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function AppStartupPopup() {
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [queue, setQueue] = useState<any[]>([]);
  const [pending, setPending] = useState<PendingConfirmation[]>([]);
  const [proofViewer, setProofViewer] = useState<string | null>(null);
  const { data: settings } = useGetAppSettings();

  const today = new Date().toDateString();

  const pendingKey = useMemo(() => "trustpay_pending_seen", []);

  useEffect(() => {
    if (!settings) return;
    const items: any[] = [];

    // Check broadcast notification (shown based on sentAt key)
    const broadcast = (settings as any)?.broadcastNotification;
    if (broadcast?.message) {
      const broadcastKey = `broadcast_seen_${broadcast.sentAt}`;
      if (!localStorage.getItem(broadcastKey)) {
        items.push({ _key: broadcastKey, title: broadcast.title || "TrustPay", message: broadcast.message });
      }
    }

    // Check daily announcements (shown once per day)
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
      setIsOpen(true);
    }
  }, [JSON.stringify(settings)]);

  useEffect(() => {
    let mounted = true;
    api("/p2p/my-pending-confirmations")
      .then((rows) => {
        if (!mounted) return;
        setPending(Array.isArray(rows) ? rows : []);
        if ((Array.isArray(rows) ? rows : []).length > 0 && !localStorage.getItem(pendingKey)) {
          setIsOpen(true);
        }
      })
      .catch(() => {
        if (mounted) setPending([]);
      })
      .finally(() => {});
    return () => { mounted = false; };
  }, [pendingKey]);

  const dismissCurrent = () => {
    const current = queue[currentIndex];
    if (current) {
      if (!current._sharedKey || currentIndex === queue.filter((q: any) => q._sharedKey).length - 1 + queue.findIndex((q: any) => q._sharedKey)) {
        localStorage.setItem(current._key, "1");
      }
      // Mark individual broadcast keys
      if (!current._sharedKey) localStorage.setItem(current._key, "1");
    }
  };

  const handleNext = () => {
    dismissCurrent();
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Mark all shared keys (announcements)
      const sharedKey = `popup_seen_${today}`;
      localStorage.setItem(sharedKey, "1");
      setIsOpen(false);
    }
  };

  const handleSkipAll = () => {
    queue.forEach((item: any) => localStorage.setItem(item._key, "1"));
    const sharedKey = `popup_seen_${today}`;
    localStorage.setItem(sharedKey, "1");
    setIsOpen(false);
  };

  const confirmReceipt = async (id: number) => {
    await api(`/p2p/confirm/${id}`, { method: "POST" });
    localStorage.setItem(pendingKey, "1");
    await qc.invalidateQueries({ queryKey: ["my-buy"] });
    await qc.invalidateQueries({ queryKey: ["my-chunks"] });
    setPending((rows) => rows.filter((row) => row.id !== id));
  };

  const openProof = (url?: string | null) => {
    if (!url) return;
    setProofViewer(url);
  };

  if (pending.length > 0) {
    const current = pending[0];
    const remaining = current.confirmDeadline ? Math.max(0, new Date(current.confirmDeadline).getTime() - Date.now()) : 0;
    return (
      <>
        <Dialog open={isOpen} onOpenChange={(open) => !open && localStorage.setItem(pendingKey, "1")}>
          <DialogContent className="max-w-[95vw] w-[440px] rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="p-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DialogTitle className="text-left text-xl font-black">PAYMENT COMING</DialogTitle>
                  <p className="text-sm font-medium mt-1">Buyer shared proof. Confirm from the main screen.</p>
                </div>
                <BellRing className="h-6 w-6 shrink-0 animate-pulse" />
              </div>
            </DialogHeader>
            <div className="p-4 space-y-4">
              <div className="rounded-2xl bg-muted/50 p-4">
                <div className="text-sm text-muted-foreground">Amount</div>
                <div className="text-3xl font-black">₹{current.amount.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Buyer: {current.buyer?.username || `#${current.buyer?.id || current.id}`}
                </div>
                <div className="text-xs text-orange-700 mt-2 font-medium">
                  Auto-confirms in {Math.floor(remaining / 60000)}m {Math.floor((remaining % 60000) / 1000)}s
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
              <div className="grid grid-cols-2 gap-2">
                <Button className="h-12 bg-green-600 hover:bg-green-700" onClick={() => confirmReceipt(current.id)}>
                  YES — Received
                </Button>
                <Button variant="destructive" className="h-12" onClick={() => localStorage.setItem(pendingKey, "1")}>
                  NO — Not Received
                </Button>
              </div>
            </div>
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
  const current = queue[currentIndex];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleSkipAll()}>
      <DialogContent className="max-w-[90%] w-[380px] rounded-xl p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-muted/30">
          <DialogTitle className="text-center">{current?.title || "Announcement"}</DialogTitle>
          {queue.length > 1 && (
            <p className="text-xs text-center text-muted-foreground">{currentIndex + 1} / {queue.length}</p>
          )}
        </DialogHeader>
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {current?.imageUrl && (
            <img src={current.imageUrl} alt="Announcement" className="w-full rounded-lg mb-4 object-cover" />
          )}
          <p className="text-sm text-foreground whitespace-pre-wrap">{current?.message || ""}</p>
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
