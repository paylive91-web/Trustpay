import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminGetSettings, useAdminUploadImage, useAdminNotifyAll, useAdminUpdateSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminGetSettingsQueryKey } from "@workspace/api-client-react";
import { Plus, Trash2, Bell, Upload } from "lucide-react";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function ImagePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const { toast } = useToast();
  const uploadMut = useAdminUploadImage();
  const onPick = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Image must be under 5 MB", variant: "destructive" }); return; }
    try {
      const dataUrl = await fileToDataUrl(file);
      const d = await uploadMut.mutateAsync({ data: { dataUrl } });
      onChange(d.url);
      toast({ title: "Image uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
  };
  const busy = uploadMut.isPending;
  return (
    <div className="space-y-2">
      {label && <Label className="text-xs">{label}</Label>}
      <div className="flex items-center gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Image URL or upload below" />
      </div>
      <label className="inline-flex items-center gap-2 px-3 py-1.5 border rounded text-xs cursor-pointer hover:bg-muted">
        <Upload className="w-3 h-3" /> {busy ? "Uploading..." : "Upload from device"}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0] || null)} />
      </label>
      {value && <img src={value} alt="preview" className="w-24 h-24 object-contain border rounded" />}
    </div>
  );
}

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
  const notifyMut = useAdminNotifyAll();
  const saving = false;
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const [upiId, setUpiId] = useState("");
  const [upiName, setUpiName] = useState("");
  const [multipleUpiIds, setMultipleUpiIds] = useState<UpiEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupImageUrl, setPopupImageUrl] = useState("");
  const [telegramLink, setTelegramLink] = useState("");
  const [bannerImages, setBannerImages] = useState<string[]>([]);
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
      setBannerImages(Array.isArray((settings as any).bannerImages) ? (settings as any).bannerImages : []);
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

  const updateSettingsMut = useAdminUpdateSettings({
    mutation: {
      onSuccess: () => {
        toast({ title: "Settings updated successfully" });
        queryClient.invalidateQueries({ queryKey: getAdminGetSettingsQueryKey() });
        setAdminPassword("");
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.message || "Failed to save settings", variant: "destructive" });
      },
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      upiId,
      upiName,
      multipleUpiIds: multipleUpiIds.filter((u) => u.upiId.trim()),
      announcements: announcements.filter((a) => a.message.trim()),
      popupMessage,
      popupImageUrl,
      telegramLink,
      bannerImages,
      buyRules,
      sellRules,
    };
    if (adminPassword) payload.adminPassword = adminPassword;
    updateSettingsMut.mutate({ data: payload });
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      toast({ title: "Message is required", variant: "destructive" });
      return;
    }
    try {
      await notifyMut.mutateAsync({ data: { message: broadcastMessage.trim(), title: broadcastTitle.trim() || "TrustPay" } });
      toast({ title: "Notification sent to all users!" });
      setBroadcastMessage("");
      setBroadcastTitle("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };
  const notifying = notifyMut.isPending;

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
                    <ImagePicker
                      label="QR Code Image (Optional)"
                      value={entry.qrImageUrl || ""}
                      onChange={(v) => updateUpiEntry(idx, "qrImageUrl", v)}
                    />
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
                    <ImagePicker
                      label="Image (Optional)"
                      value={ann.imageUrl || ""}
                      onChange={(v) => updateAnnouncement(idx, "imageUrl", v)}
                    />
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
                  <ImagePicker label="Popup Image (Optional)" value={popupImageUrl} onChange={setPopupImageUrl} />
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
                  <Label>Home Banner Images</Label>
                  <div className="space-y-3">
                    {bannerImages.map((url, idx) => (
                      <div key={idx} className="border rounded p-3 space-y-2">
                        <ImagePicker
                          label={`Banner ${idx + 1}`}
                          value={url}
                          onChange={(v) => setBannerImages((prev) => prev.map((u, i) => i === idx ? v : u))}
                        />
                        <Button
                          type="button" variant="outline" size="sm"
                          onClick={() => setBannerImages((prev) => prev.filter((_, i) => i !== idx))}
                        >Remove</Button>
                      </div>
                    ))}
                    <Button
                      type="button" variant="outline" size="sm"
                      onClick={() => setBannerImages((prev) => [...prev, ""])}
                    ><Upload className="w-3 h-3 mr-1" /> Add Banner</Button>
                  </div>
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
