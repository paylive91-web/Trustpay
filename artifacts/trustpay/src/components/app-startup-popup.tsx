import React, { useEffect, useState } from "react";
import { useGetAppSettings } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// Home-page popup. Handles broadcast notifications and daily announcements
// only. Seller-side order alerts (locked / pending_confirmation) live in
// <SellerAlertsPopup /> and are mounted on the sell page.
export default function AppStartupPopup() {
  const [annOpen, setAnnOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [queue, setQueue] = useState<any[]>([]);
  const { data: settings } = useGetAppSettings();

  const today = new Date().toDateString();

  // Broadcast notifications are delivered via the browser's system
  // notification API (no longer shown as an in-app popup). We dispatch the
  // notification once per `sentAt` value so the same broadcast doesn't fire
  // repeatedly across reloads.
  useEffect(() => {
    if (!settings) return;
    const broadcast = (settings as any)?.broadcastNotification;
    if (!broadcast?.message) return;
    const seenKey = `broadcast_notified_${broadcast.sentAt}`;
    if (localStorage.getItem(seenKey)) return;

    const fire = () => {
      try {
        const n = new Notification(broadcast.title || "TrustPay", {
          body: broadcast.message,
          icon: (settings as any)?.appLogoUrl || (broadcast.imageUrl || undefined),
        });
        // Auto-close after 8s so it doesn't pile up.
        setTimeout(() => { try { n.close(); } catch {} }, 8000);
      } catch {
        // ignore — environment without Notification support
      }
      localStorage.setItem(seenKey, "1");
    };

    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      fire();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") fire();
      }).catch(() => {});
    }
  }, [JSON.stringify((settings as any)?.broadcastNotification), (settings as any)?.appLogoUrl]);

  useEffect(() => {
    if (!settings) return;
    const items: any[] = [];

    const popupKey = `popup_seen_${today}`;
    const announcements = (settings as any)?.announcements;
    if (announcements?.length) {
      announcements.forEach((ann: any) => {
        if (ann.message) items.push({ _key: popupKey, _sharedKey: true, title: ann.title || "Announcement", message: ann.message, imageUrl: ann.imageUrl });
      });
    } else if (settings?.popupMessage) {
      items.push({ _key: popupKey, _sharedKey: true, title: "Announcement", message: settings.popupMessage, imageUrl: (settings as any)?.popupImageUrl });
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
      setAnnOpen(false);
    }
  };

  const handleSkipAll = () => {
    setAnnOpen(false);
  };

  // Play popup notification sound exactly once when the queue first opens.
  // Uses the admin-configured popupSoundUrl. Failures are silent — autoplay
  // can be blocked by the browser before the user interacts with the page.
  useEffect(() => {
    if (queue.length === 0) return;
    const url = (settings as any)?.popupSoundUrl;
    if (!url) return;
    try {
      const a = new Audio(url);
      a.volume = 0.7;
      a.play().catch(() => {});
    } catch {
      // ignore
    }
  }, [queue.length > 0, (settings as any)?.popupSoundUrl]);

  if (queue.length === 0) return null;
  const currentAnn = queue[currentIndex];

  return (
    <Dialog open={annOpen} onOpenChange={(open) => !open && handleSkipAll()}>
      <DialogContent className="w-[min(92vw,440px)] rounded-[28px] border-0 p-0 overflow-hidden shadow-[0_24px_80px_rgba(15,23,42,0.28)] bg-gradient-to-b from-white via-slate-50 to-white">
        <DialogHeader className="relative px-5 pt-5 pb-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white">
          <button
            type="button"
            onClick={handleSkipAll}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <X className="h-4 w-4" />
          </button>
          <DialogTitle className="text-center text-[22px] font-bold tracking-tight">
            {currentAnn?.title || "Announcement"}
          </DialogTitle>
          {queue.length > 1 && (
            <p className="mt-1 text-center text-xs font-medium text-white/80">
              {currentIndex + 1} / {queue.length}
            </p>
          )}
        </DialogHeader>
        <div className="px-5 py-5 max-h-[62vh] overflow-y-auto">
          {currentAnn?.imageUrl && (
            <div className="mb-4 rounded-[22px] bg-slate-100 p-3 shadow-inner">
              <img
                src={currentAnn.imageUrl}
                alt="Announcement"
                className="w-full h-auto max-h-[46vh] rounded-[18px] object-contain"
              />
            </div>
          )}
          <p className="text-[15px] leading-6 text-slate-700 whitespace-pre-wrap">{currentAnn?.message || ""}</p>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          {queue.length > 1 && currentIndex < queue.length - 1 ? (
            <>
              <Button variant="outline" onClick={handleSkipAll} className="flex-1 rounded-2xl border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-50">
                Skip All
              </Button>
              <Button onClick={handleNext} className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-blue-600/20 hover:opacity-95">
                Next ({currentIndex + 1}/{queue.length})
              </Button>
            </>
          ) : (
            <Button onClick={handleNext} className="w-full rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-blue-600/20 hover:opacity-95">
              Got it
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
