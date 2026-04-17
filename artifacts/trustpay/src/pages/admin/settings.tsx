import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminGetSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminGetSettingsQueryKey } from "@workspace/api-client-react";
import { Plus, Trash2, Bell } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface UpiEntry {
  upiId: string;
  upiName: string;
  qrImageUrl?: string;
}

interface Announcement {
  title: string;
  message: string;
  imageUrl?: string;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useAdminGetSettings();
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const [upiId, setUpiId] = useState("");
  const [upiName, setUpiName] = useState("");
  const [multipleUpiIds, setMultipleUpiIds] = useState<UpiEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupImageUrl, setPopupImageUrl] = useState("");
  const [telegramLink, setTelegramLink] = useState("");
  const [bannerImages, setBannerImages] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [buyRules, setBuyRules] = useState("");
  const [sellRules, setSellRules] = useState("");

  useEffect(() => {
    if (settings) {
      setUpiId((settings as any).upiId || "");
      setUpiName((settings as any).upiName || "");
      setMultipleUpiIds((settings as any).multipleUpiIds || []);
      setAnnouncements((settings as any).announcements || []);
      setPopupMessage((settings as any).popupMessage || "");
      setPopupImageUrl((settings as any).popupImageUrl || "");
      setTelegramLink((settings as any).telegramLink || "");
      setBannerImages((settings as any).bannerImages ? (settings as any).bannerImages.join(",") : "");
      setBuyRules((settings as any).buyRules || "");
      setSellRules((settings as any).sellRules || "");
      setAdminPassword("");
    }
  }, [settings]);

  const addUpiEntry = () => setMultipleUpiIds((prev) => [...prev, { upiId: "", upiName: "", qrImageUrl: "" }]);
  const removeUpiEntry = (i: number) => setMultipleUpiIds((prev) => prev.filter((_, idx) => idx !== i));
  const updateUpiEntry = (i: number, field: keyof UpiEntry, val: string) =>
    setMultipleUpiIds((prev) => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const addAnnouncement = () => setAnnouncements((prev) => [...prev, { title: "", message: "", imageUrl: "" }]);
  const removeAnnouncement = (i: number) => setAnnouncements((prev) => prev.filter((_, idx) => idx !== i));
  const updateAnnouncement = (i: number, field: keyof Announcement, val: string) =>
    setAnnouncements((prev) => prev.map((a, idx) => idx === i ? { ...a, [field]: val } : a));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("authToken");
      const payload: any = {
        upiId,
        upiName,
        multipleUpiIds: multipleUpiIds.filter((u) => u.upiId.trim()),
        announcements: announcements.filter((a) => a.message.trim()),
        popupMessage,
        popupImageUrl,
        telegramLink,
        bannerImages: bannerImages.split(",").map((s) => s.trim()).filter(Boolean),
        buyRules,
        sellRules,
      };
      if (adminPassword) payload.adminPassword = adminPassword;

      const res = await fetch(`${API_BASE}/admin/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }
      toast({ title: "Settings updated successfully" });
      queryClient.invalidateQueries({ queryKey: getAdminGetSettingsQueryKey() });
      setAdminPassword("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      toast({ title: "Message is required", variant: "destructive" });
      return;
    }
    setNotifying(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API_BASE}/admin/notify-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: broadcastMessage.trim(), title: broadcastTitle.trim() || "TrustPay" }),
      });
      if (!res.ok) throw new Error("Failed to send notification");
      toast({ title: "Notification sent to all users!" });
      setBroadcastMessage("");
      setBroadcastTitle("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setNotifying(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">App Settings</h1>
          <p className="text-muted-foreground">Configure payment, rules, links, and announcements.</p>
        </div>

        {isLoading ? (
          <Skeleton className="h-[500px] w-full rounded-xl" />
        ) : (
          <form onSubmit={onSubmit} className="space-y-6">

            {/* Primary UPI */}
            <Card>
              <CardHeader>
                <CardTitle>Primary UPI Account</CardTitle>
                <CardDescription>Default UPI shown to users for deposits.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>UPI ID</Label>
                  <Input placeholder="admin@upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>UPI Display Name</Label>
                  <Input placeholder="TrustPay Official" value={upiName} onChange={(e) => setUpiName(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* Multiple UPI IDs */}
            <Card>
              <CardHeader>
                <CardTitle>Multiple UPI IDs</CardTitle>
                <CardDescription>Add multiple UPI IDs. Each can have its own QR code image URL.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {multipleUpiIds.map((entry, idx) => (
                  <div key={idx} className="border rounded-xl p-4 space-y-3 relative">
                    <button
                      type="button"
                      className="absolute top-3 right-3 text-destructive hover:text-destructive/80"
                      onClick={() => removeUpiEntry(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">UPI ID</Label>
                        <Input
                          placeholder="e.g. example@paytm"
                          value={entry.upiId}
                          onChange={(e) => updateUpiEntry(idx, "upiId", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Display Name</Label>
                        <Input
                          placeholder="Name"
                          value={entry.upiName}
                          onChange={(e) => updateUpiEntry(idx, "upiName", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">QR Code Image URL (Optional)</Label>
                      <Input
                        placeholder="https://example.com/qr.png"
                        value={entry.qrImageUrl || ""}
                        onChange={(e) => updateUpiEntry(idx, "qrImageUrl", e.target.value)}
                      />
                      {entry.qrImageUrl && (
                        <img src={entry.qrImageUrl} alt="QR Preview" className="w-20 h-20 mt-2 object-contain border rounded" />
                      )}
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addUpiEntry} className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> Add UPI ID
                </Button>
              </CardContent>
            </Card>

            {/* Buy Rules */}
            <Card>
              <CardHeader>
                <CardTitle>Buy Rules</CardTitle>
                <CardDescription>Rules displayed to users on the home screen under "Buy Rules".</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="1. Minimum deposit is ₹100&#10;2. Deposits are processed within 10 minutes&#10;3. ..."
                  value={buyRules}
                  onChange={(e) => setBuyRules(e.target.value)}
                  className="min-h-[120px]"
                />
              </CardContent>
            </Card>

            {/* Sell Rules */}
            <Card>
              <CardHeader>
                <CardTitle>Sell Rules</CardTitle>
                <CardDescription>Rules displayed to users on the home screen under "Sell Rules".</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="1. Minimum withdrawal is ₹100&#10;2. Withdrawals are processed within 24 hours&#10;3. ..."
                  value={sellRules}
                  onChange={(e) => setSellRules(e.target.value)}
                  className="min-h-[120px]"
                />
              </CardContent>
            </Card>

            {/* Multiple Announcements */}
            <Card>
              <CardHeader>
                <CardTitle>Announcements</CardTitle>
                <CardDescription>Multiple announcements shown to users once per day on app open.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {announcements.map((ann, idx) => (
                  <div key={idx} className="border rounded-xl p-4 space-y-3 relative">
                    <button
                      type="button"
                      className="absolute top-3 right-3 text-destructive hover:text-destructive/80"
                      onClick={() => removeAnnouncement(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="space-y-1">
                      <Label className="text-xs">Title</Label>
                      <Input
                        placeholder="Announcement"
                        value={ann.title}
                        onChange={(e) => updateAnnouncement(idx, "title", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Message</Label>
                      <Textarea
                        placeholder="Message content..."
                        value={ann.message}
                        onChange={(e) => updateAnnouncement(idx, "message", e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Image URL (Optional)</Label>
                      <Input
                        placeholder="https://example.com/image.png"
                        value={ann.imageUrl || ""}
                        onChange={(e) => updateAnnouncement(idx, "imageUrl", e.target.value)}
                      />
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addAnnouncement} className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> Add Announcement
                </Button>
                <div className="border-t pt-4 space-y-2">
                  <Label className="text-xs text-muted-foreground">Legacy Single Popup Message (fallback)</Label>
                  <Textarea
                    placeholder="Welcome to TrustPay..."
                    className="min-h-[80px]"
                    value={popupMessage}
                    onChange={(e) => setPopupMessage(e.target.value)}
                  />
                  <Input
                    placeholder="Image URL (Optional)"
                    value={popupImageUrl}
                    onChange={(e) => setPopupImageUrl(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Links & Media */}
            <Card>
              <CardHeader>
                <CardTitle>Links & Media</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Support Telegram Link</Label>
                  <Input
                    placeholder="https://t.me/..."
                    value={telegramLink}
                    onChange={(e) => setTelegramLink(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Home Banner Images (Comma separated URLs)</Label>
                  <Textarea
                    placeholder="https://img1.jpg, https://img2.jpg"
                    value={bannerImages}
                    onChange={(e) => setBannerImages(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Security */}
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">Security</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Change Admin Password</Label>
                  <Input
                    type="password"
                    placeholder="Leave blank to keep current password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" size="lg" disabled={saving}>
                {saving ? "Saving..." : "Save All Settings"}
              </Button>
            </div>
          </form>
        )}

        {/* Broadcast Notification */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-500" />
              Send Notification to All Users
            </CardTitle>
            <CardDescription>This message will appear as a popup next time users open the app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input placeholder="Important Update" value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Write your message here..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            <Button onClick={handleSendBroadcast} disabled={notifying} className="w-full">
              <Bell className="w-4 h-4 mr-2" />
              {notifying ? "Sending..." : "Send to All Users"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
