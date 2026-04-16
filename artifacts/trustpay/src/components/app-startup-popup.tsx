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
  const { data: settings } = useGetAppSettings();

  useEffect(() => {
    const hasSeen = sessionStorage.getItem("hasSeenPopup");
    if (!hasSeen && settings?.popupMessage) {
      setIsOpen(true);
    }
  }, [settings]);

  const handleClose = () => {
    sessionStorage.setItem("hasSeenPopup", "true");
    setIsOpen(false);
  };

  if (!settings?.popupMessage) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-[90%] w-[380px] rounded-xl p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-muted/30">
          <DialogTitle className="text-center">Announcement</DialogTitle>
        </DialogHeader>
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {settings.popupImageUrl && (
            <img src={settings.popupImageUrl} alt="Announcement" className="w-full rounded-lg mb-4 object-cover" />
          )}
          <p className="text-sm text-foreground whitespace-pre-wrap">{settings.popupMessage}</p>
        </div>
        <div className="p-4 border-t bg-muted/30">
          <Button onClick={handleClose} className="w-full">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
