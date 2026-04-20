import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminGetSettings, useAdminUploadImage, useAdminNotifyAll, useAdminUpdateSettings, useAdminGetFeeTransactions } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminGetSettingsQueryKey, getGetAppSettingsQueryKey } from "@workspace/api-client-react";
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

interface FeeTier {
  min: number;
  max: number;
  fee: number;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useAdminGetSettings();
  const notifyMut = useAdminNotifyAll();
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const [upiId, setUpiId] = useState("");
  const [upiName, setUpiName] = useState("");
  const [multipleUpiIds, setMultipleUpiIds] = useState<UpiEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupImageUrl, setPopupImageUrl] = useState("");
  const [appName, setAppName] = useState("");
  const [appLogoUrl, setAppLogoUrl] = useState("");
  const [popupSoundUrl, setPopupSoundUrl] = useState("");
  const [chunkMin, setChunkMin] = useState<number>(100);
  const [chunkMax, setChunkMax] = useState<number>(50000);
  const [adminChunkMin, setAdminChunkMin] = useState<number>(5000);
  const [adminChunkMax, setAdminChunkMax] = useState<number>(50000);
  const [telegramLink, setTelegramLink] = useState("");
  const [bannerImages, setBannerImages] = useState<string[]>([]);
  const [adminPassword, setAdminPassword] = useState("");
  const [buyRules, setBuyRules] = useState("");
  const [sellRules, setSellRules] = useState("");
  const [feeTiers, setFeeTiers] = useState<FeeTier[]>([]);
  const [apkDownloadUrl, setApkDownloadUrl] = useState("");
  const [apkVersion, setApkVersion] = useState("");
  const [forceAppDownload, setForceAppDownload] = useState(true);

  useEffect(() => {
    if (settings) {
      setUpiId((settings as any).upiId || "");
      setUpiName((settings as any).upiName || "");
      setMultipleUpiIds((settings as any).multipleUpiIds || []);
      setAnnouncements((settings as any).announcements || []);
      setPopupMessage((settings as any).popupMessage || "");
      setPopupImageUrl((settings as any).popupImageUrl || "");
      setAppName((settings as any).appName || "TrustPay");
      setAppLogoUrl((settings as any).appLogoUrl || "");
      setPopupSoundUrl((settings as any).popupSoundUrl || "");
      setChunkMin(Number((settings as any).chunkMin) || 100);
      setChunkMax(Number((settings as any).chunkMax) || 50000);
      setAdminChunkMin(Number((settings as any).adminChunkMin) || 5000);
      setAdminChunkMax(Number((settings as any).adminChunkMax) || 50000);
      setTelegramLink((settings as any).telegramLink || "");
      setBannerImages(Array.isArray((settings as any).bannerImages) ? (settings as any).bannerImages : []);
      setBuyRules((settings as any).buyRules || "");
      setSellRules((settings as any).sellRules || "");
      const tiers = Array.isArray((settings as any).feeTiers) ? (settings as any).feeTiers : [];
      setFeeTiers(tiers.map((t: any) => ({ min: Number(t.min) || 0, max: Number(t.max) || 0, fee: Number(t.fee) || 0 })));
      setApkDownloadUrl((settings as any).apkDownloadUrl || "");
      setApkVersion((settings as any).apkVersion || "1.0.0");
      setForceAppDownload((settings as any).forceAppDownload === true);
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
        queryClient.invalidateQueries({ queryKey: getGetAppSettingsQueryKey() });
        setAdminPassword("");
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.message || "Failed to save settings", variant: "destructive" });
      },
    },
  });

  const addFeeTier = () => setFeeTiers((prev) => {
    // Default the new tier just after the last one to make it easy to extend
    // the table without typing both bounds from scratch.
    const last = prev[prev.length - 1];
    const min = last ? last.max + 1 : 100;
    return [...prev, { min, max: min + 499, fee: 1 }];
  });
  const removeFeeTier = (i: number) => setFeeTiers((prev) => prev.filter((_, idx) => idx !== i));
  const updateFeeTier = (i: number, field: keyof FeeTier, val: number) =>
    setFeeTiers((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  const validateFeeTiers = (tiers: FeeTier[]): string | null => {
    const sorted = [...tiers].sort((a, b) => a.min - b.min);
    for (const t of sorted) {
      if (!Number.isFinite(t.min) || !Number.isFinite(t.max) || !Number.isFinite(t.fee)) return "Each tier needs Min, Max and Fee";
      if (t.min < 0 || t.max <= t.min) return `Invalid range: min must be strictly less than max (${t.min}-${t.max})`;
      if (t.fee < 0) return `Fee cannot be negative: ${t.fee}`;
    }
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].min <= sorted[i - 1].max) {
        return `Tiers overlap: ${sorted[i - 1].min}-${sorted[i - 1].max} and ${sorted[i].min}-${sorted[i].max}`;
      }
    }
    return null;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tierError = validateFeeTiers(feeTiers);
    if (tierError) {
      toast({ title: "Fee tiers error", description: tierError, variant: "destructive" });
      return;
    }
    const payload: any = {
      upiId,
      upiName,
      multipleUpiIds: multipleUpiIds.filter((u) => u.upiId.trim()),
      announcements: announcements.filter((a) => a.message.trim()),
      popupMessage,
      popupImageUrl,
      telegramLink,
      bannerImages,
      appName,
      appLogoUrl,
      popupSoundUrl,
      chunkMin,
      chunkMax,
      adminChunkMin,
      adminChunkMax,
      buyRules,
      sellRules,
      feeTiers,
      apkDownloadUrl,
      apkVersion,
      forceAppDownload,
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

            {/* App Branding */}
            <Card>
              <CardHeader>
                <CardTitle>App Branding</CardTitle>
                <CardDescription>App name + logo shown across the app, login and registration screens.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>App Name</Label>
                  <Input placeholder="TrustPay" value={appName} onChange={(e) => setAppName(e.target.value)} />
                </div>
                <ImagePicker label="App Logo (square, ~256×256)" value={appLogoUrl} onChange={setAppLogoUrl} />
              </CardContent>
            </Card>

            {/* Notification Sound */}
            <Card>
              <CardHeader>
                <CardTitle>Popup Notification Sound</CardTitle>
                <CardDescription>
                  Plays once when an announcement / broadcast popup appears for the user.
                  Upload an MP3/OGG/WAV under 1 MB.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="https://... (audio URL)" value={popupSoundUrl} onChange={(e) => setPopupSoundUrl(e.target.value)} />
                <SoundPicker value={popupSoundUrl} onChange={setPopupSoundUrl} />
                {popupSoundUrl && (
                  <audio src={popupSoundUrl} controls className="w-full h-10" />
                )}
              </CardContent>
            </Card>

            {/* Chunk Sizes */}
            <Card>
              <CardHeader>
                <CardTitle>Chunk Size Control</CardTitle>
                <CardDescription>
                  Min/Max chunk size for normal sellers and admin liquidity. Buyers see these as available orders.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>User Chunk Min (₹)</Label>
                  <Input type="number" value={chunkMin} onChange={(e) => setChunkMin(parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>User Chunk Max (₹)</Label>
                  <Input type="number" value={chunkMax} onChange={(e) => setChunkMax(parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Admin Chunk Min (₹)</Label>
                  <Input type="number" value={adminChunkMin} onChange={(e) => setAdminChunkMin(parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Admin Chunk Max (₹)</Label>
                  <Input type="number" value={adminChunkMax} onChange={(e) => setAdminChunkMax(parseInt(e.target.value) || 0)} />
                </div>
              </CardContent>
            </Card>

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

            {/* Per-Chunk Fee Tiers */}
            <Card data-testid="card-fee-tiers">
              <CardHeader>
                <CardTitle>Order Fee Tiers</CardTitle>
                <CardDescription>
                  Per-chunk platform fee charged to the seller based on the chunk's gross amount.
                  Ranges must not overlap. The first matching tier is used.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                  <div className="col-span-4">Min (₹)</div>
                  <div className="col-span-4">Max (₹)</div>
                  <div className="col-span-3">Fee (₹)</div>
                  <div className="col-span-1"></div>
                </div>
                {feeTiers.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    No tiers configured — falls back to flat per-chunk commission.
                  </p>
                )}
                {feeTiers.map((tier, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      type="number"
                      className="col-span-4"
                      value={tier.min}
                      onChange={(e) => updateFeeTier(idx, "min", parseInt(e.target.value) || 0)}
                      data-testid={`input-tier-min-${idx}`}
                    />
                    <Input
                      type="number"
                      className="col-span-4"
                      value={tier.max}
                      onChange={(e) => updateFeeTier(idx, "max", parseInt(e.target.value) || 0)}
                      data-testid={`input-tier-max-${idx}`}
                    />
                    <Input
                      type="number"
                      className="col-span-3"
                      value={tier.fee}
                      onChange={(e) => updateFeeTier(idx, "fee", parseInt(e.target.value) || 0)}
                      data-testid={`input-tier-fee-${idx}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-span-1"
                      onClick={() => removeFeeTier(idx)}
                      data-testid={`button-remove-tier-${idx}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addFeeTier} className="w-full" data-testid="button-add-tier">
                  <Plus className="w-4 h-4 mr-2" /> Add Tier
                </Button>
              </CardContent>
            </Card>

            {/* Android APK Distribution */}
            <Card data-testid="card-apk-config">
              <CardHeader>
                <CardTitle>Android App (APK)</CardTitle>
                <CardDescription>
                  After registration, users see a full-screen lock until they install and open the
                  Android APK. The lock auto-clears when the user is browsing from inside the APK.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>APK Download URL</Label>
                  <Input
                    type="url"
                    placeholder="https://example.com/trustpay.apk"
                    value={apkDownloadUrl}
                    onChange={(e) => setApkDownloadUrl(e.target.value)}
                    data-testid="input-apk-url"
                  />
                </div>
                <div className="space-y-2">
                  <Label>APK Version</Label>
                  <Input
                    placeholder="1.0.0"
                    value={apkVersion}
                    onChange={(e) => setApkVersion(e.target.value)}
                    data-testid="input-apk-version"
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceAppDownload}
                    onChange={(e) => setForceAppDownload(e.target.checked)}
                    className="w-4 h-4"
                    data-testid="checkbox-force-download"
                  />
                  <span className="text-sm">Force every web visitor to install the APK (not just newly registered users)</span>
                </label>
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
              <Button type="submit" size="lg" disabled={updateSettingsMut.isPending}>
                {updateSettingsMut.isPending ? "Saving..." : "Save All Settings"}
              </Button>
            </div>
          </form>
        )}

        <FeeTransactionsCard />

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

function SoundPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { toast } = useToast();
  const uploadMut = useAdminUploadImage();
  const onPick = async (file: File | null) => {
    if (!file) return;
    if (file.size > 1024 * 1024) { toast({ title: "Sound must be under 1 MB", variant: "destructive" }); return; }
    try {
      const dataUrl = await fileToDataUrl(file);
      const d = await uploadMut.mutateAsync({ data: { dataUrl } });
      onChange(d.url);
      toast({ title: "Sound uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
  };
  void value;
  return (
    <label className="inline-flex items-center gap-2 px-3 py-1.5 border rounded text-xs cursor-pointer hover:bg-muted">
      <Upload className="w-3 h-3" /> {uploadMut.isPending ? "Uploading..." : "Upload sound from device"}
      <input type="file" accept="audio/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0] || null)} />
    </label>
  );
}

function FeeTransactionsCard() {
  const { data, isLoading } = useAdminGetFeeTransactions({ limit: 100 });
  const items = (data as any)?.items || [];
  return (
    <Card className="border-emerald-200">
      <CardHeader>
        <CardTitle className="text-emerald-700">Platform Fee Transactions</CardTitle>
        <CardDescription>Per-chunk fees credited to the admin wallet.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="text-xs text-muted-foreground">Lifetime fees</div>
            <div className="text-2xl font-bold text-emerald-700">₹{Number((data as any)?.totalAmount || 0).toFixed(2)}</div>
            <div className="text-[11px] text-muted-foreground">{(data as any)?.totalCount ?? 0} transactions</div>
          </div>
          <div className="rounded-xl bg-sky-50 p-3">
            <div className="text-xs text-muted-foreground">Today</div>
            <div className="text-2xl font-bold text-sky-700">₹{Number((data as any)?.todayAmount || 0).toFixed(2)}</div>
            <div className="text-[11px] text-muted-foreground">{(data as any)?.todayCount ?? 0} transactions</div>
          </div>
        </div>
        <div className="border rounded-lg max-h-80 overflow-y-auto divide-y">
          {isLoading ? (
            <div className="p-3 text-sm text-muted-foreground">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No fee transactions yet.</div>
          ) : items.map((t: any) => (
            <div key={t.id} className="p-2.5 flex items-center justify-between text-xs gap-2">
              <div className="flex-1 min-w-0">
                <div className="truncate">{t.description}</div>
                <div className="text-[10px] text-muted-foreground">
                  {t.createdAt ? format(new Date(t.createdAt), "dd MMM yyyy, HH:mm") : ""}
                  {t.orderId ? ` · order #${t.orderId}` : ""}
                </div>
              </div>
              <div className="font-bold text-emerald-700">+₹{Number(t.amount).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
