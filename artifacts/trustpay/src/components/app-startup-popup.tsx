import React, { useState, useEffect } from "react";
import { useGetAppSettings } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function AppStartupPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [queue, setQueue] = useState<any[]>([]);
  const { data: settings } = useGetAppSettings();

  const today = new Date().toDateString();

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
