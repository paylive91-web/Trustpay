import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { format } from "date-fns";
import { getAuthToken } from "@/lib/auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { API_BASE } from "@/lib/api-config";

type Notification = {
  id: number;
  kind: string;
  title: string;
  body: string;
  severity: "info" | "warn" | "critical";
  fraudAlertId: number | null;
  readAt: string | null;
  createdAt: string;
};

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

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data } = useQuery<{ notifications: Notification[]; unreadCount: number }>({
    queryKey: ["notifications"],
    queryFn: () => api("/notifications"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const readAllMut = useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const readOneMut = useMutation({
    mutationFn: (id: number) => api(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = data?.unreadCount ?? 0;
  const items = data?.notifications ?? [];

  const sevIcon = (s: string) =>
    s === "critical" ? <AlertCircle className="h-4 w-4 text-red-600" /> :
    s === "warn" ? <AlertTriangle className="h-4 w-4 text-amber-600" /> :
    <Info className="h-4 w-4 text-blue-600" />;

  const sevBg = (s: string) =>
    s === "critical" ? "bg-red-50 border-red-200" :
    s === "warn" ? "bg-amber-50 border-amber-200" :
    "bg-blue-50 border-blue-200";

  return (
    <>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => {
          setOpen(true);
          if (unread > 0) readAllMut.mutate();
        }}
        className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
        data-testid="button-notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[90%] w-[400px] rounded-xl p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-muted/30">
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> Notifications
              {items.length > 0 && (
                <Badge variant="outline" className="ml-2">{items.length}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto divide-y">
            {items.length === 0 && (
              <div className="text-center text-muted-foreground py-12 text-sm">
                You have no notifications.
              </div>
            )}
            {items.map((n) => (
              <div
                key={n.id}
                className={`p-4 ${!n.readAt ? "bg-primary/5" : ""}`}
                onClick={() => !n.readAt && readOneMut.mutate(n.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full border ${sevBg(n.severity)}`}>
                    {sevIcon(n.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-sm leading-tight">{n.title}</h4>
                      {!n.readAt && (
                        <span className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {format(new Date(n.createdAt), "MMM dd, yyyy HH:mm")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t bg-muted/30 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
