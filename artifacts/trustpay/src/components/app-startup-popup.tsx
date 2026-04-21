import React, { useEffect, useState } from "react";
import { useGetAppSettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { X, ChevronRight } from "lucide-react";

export default function AppStartupPopup() {
  const [annOpen, setAnnOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [queue, setQueue] = useState<any[]>([]);
  const { data: settings } = useGetAppSettings();

  const today = new Date().toDateString();

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
        setTimeout(() => { try { n.close(); } catch {} }, 8000);
      } catch {}
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

    // Once-per-login-session guard — cleared on every login/logout
    if (localStorage.getItem("popup_seen_session")) return;

    const items: any[] = [];
    const announcements = (settings as any)?.announcements;
    if (announcements?.length) {
      announcements.forEach((ann: any) => {
        if (ann.message) items.push({ title: ann.title || "Announcement", message: ann.message, imageUrl: ann.imageUrl });
      });
    } else if (settings?.popupMessage) {
      items.push({ title: "Announcement", message: settings.popupMessage, imageUrl: (settings as any)?.popupImageUrl });
    }

    if (items.length > 0) {
      setQueue(items);
      setCurrentIndex(0);
      setAnnOpen(true);
    }
  }, [JSON.stringify(settings)]);

  const markSeenToday = () => {
    localStorage.setItem("popup_seen_session", "1");
  };

  const handleNext = () => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      markSeenToday();
      setAnnOpen(false);
    }
  };

  const handleSkipAll = () => {
    markSeenToday();
    setAnnOpen(false);
  };

  useEffect(() => {
    if (queue.length === 0) return;
    const url = (settings as any)?.popupSoundUrl;
    if (!url) return;
    try {
      const a = new Audio(url);
      a.volume = 0.7;
      a.play().catch(() => {});
    } catch {}
  }, [queue.length > 0, (settings as any)?.popupSoundUrl]);

  if (!annOpen || queue.length === 0) return null;
  const currentAnn = queue[currentIndex];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleSkipAll}
      />

      {/* Dialog */}
      <div className="relative w-[min(92vw,420px)] rounded-[32px] overflow-hidden shadow-[0_32px_100px_rgba(79,70,229,0.45)] animate-in fade-in zoom-in-95 duration-300">

        {/* Glow ring */}
        <div className="absolute inset-0 rounded-[32px] ring-1 ring-inset ring-white/20 pointer-events-none z-10" />

        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#4f46e5] via-[#6d28d9] to-[#7c3aed] px-5 pt-6 pb-5 overflow-hidden">
          {/* Decorative orbs */}
          <div className="absolute -top-6 -left-6 w-28 h-28 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-indigo-400/20 blur-xl pointer-events-none" />
          {/* Shimmer line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {/* Close button */}
          <button
            type="button"
            onClick={handleSkipAll}
            className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>

          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-200 mb-1">
            TrustPay
          </p>
          <h2 className="text-center text-[22px] font-extrabold tracking-tight text-white drop-shadow-sm">
            {currentAnn?.title || "Announcement"}
          </h2>
          {queue.length > 1 && (
            <div className="mt-2 flex justify-center gap-1.5">
              {queue.map((_: any, i: number) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? "w-5 bg-white" : "w-1.5 bg-white/35"}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="bg-white px-5 pt-5 pb-1 max-h-[54vh] overflow-y-auto">
          {currentAnn?.imageUrl && (
            <div className="mb-4 rounded-[22px] overflow-hidden ring-1 ring-slate-100 shadow-md">
              <img
                src={currentAnn.imageUrl}
                alt="Announcement"
                className="w-full h-auto max-h-[42vh] object-contain"
              />
            </div>
          )}
          <p className="text-[15px] leading-[1.65] text-slate-600 whitespace-pre-wrap pb-1">
            {currentAnn?.message || ""}
          </p>
        </div>

        {/* Footer */}
        <div className="bg-white px-5 pt-3 pb-6">
          {queue.length > 1 && currentIndex < queue.length - 1 ? (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSkipAll}
                className="flex-1 h-12 rounded-2xl border-slate-200 text-slate-500 hover:bg-slate-50 font-semibold"
              >
                Skip All
              </Button>
              <Button
                onClick={handleNext}
                className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-lg shadow-indigo-500/30 hover:opacity-95 active:scale-[0.98] transition-all"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleNext}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[16px] font-bold shadow-lg shadow-indigo-500/30 hover:opacity-95 active:scale-[0.98] transition-all"
            >
              Got it
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
