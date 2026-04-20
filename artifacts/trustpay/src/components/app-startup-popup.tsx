import React, { useEffect, useState } from "react";
import { useGetAppSettings } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Home-page popup. Handles broadcast notifications and daily announcements
// only. Seller-side order alerts (locked / pending_confirmation) live in
// <SellerAlertsPopup /> and are mounted on the sell page.
export default function AppStartupPopup() {
  const [annOpen, setAnnOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [queue, setQueue] = useState<any[]>([]);
  const { data: settings } = useGetAppSettings();

  const today = new Date().toDateString();

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
      <DialogContent className="max-w-[90%] w-[380px] rounded-xl p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-muted/30">
          <DialogTitle className="text-center">{currentAnn?.title || "Announcement"}</DialogTitle>
          {queue.length > 1 && (
            <p className="text-xs text-center text-muted-foreground">{currentIndex + 1} / {queue.length}</p>
          )}
        </DialogHeader>
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {currentAnn?.imageUrl && (
            <div className="w-full mb-4 flex justify-center">
              {/* Fixed standard popup image size: 320×180 (16:9). Keeps every
                  announcement visually consistent regardless of source aspect
                  ratio. `object-contain` preserves the original picture. */}
              <img
                src={currentAnn.imageUrl}
                alt="Announcement"
                className="w-[320px] h-[180px] rounded-lg object-contain bg-muted/40"
              />
            </div>
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
