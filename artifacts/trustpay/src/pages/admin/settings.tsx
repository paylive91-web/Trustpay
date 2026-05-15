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
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { getAdminGetSettingsQueryKey, getGetAppSettingsQueryKey } from "@workspace/api-client-react";
import { getAuthToken } from "@/lib/auth";
import { Plus, Trash2, Bell, Upload, Award, Info, Gift, Target, Ghost } from "lucide-react";

import { BASE_ORIGIN as BASE, assetUrl } from "@/lib/api-config";

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
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const onPick = async (file: File | null) => {
    if (!file) return;
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: `Image too large (${sizeMb} MB)`, description: "Maximum 20 MB. Please pick a smaller image.", variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const d = await uploadMut.mutateAsync({ data: { dataUrl } });
      onChange(d.url);
      toast({ title: "Image uploaded" });
    } catch (e: any) {
      console.error("[ImagePicker] upload failed", e);
      toast({ title: "Upload failed", description: e?.message || "Unknown error — check connection and try again", variant: "destructive" });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  const busy = uploadMut.isPending;
  return (
    <div className="space-y-2">
      {label && <Label className="text-xs">{label}</Label>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] || null)}
      />
      {value ? (
        <div className="flex items-center gap-3 border rounded-lg p-3 bg-muted/30">
          <img src={value} alt="preview" className="w-20 h-20 object-cover border rounded bg-white" />
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              <Upload className="w-3 h-3 mr-1" /> {busy ? "Uploading..." : "Replace"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>
              <Trash2 className="w-3 h-3 mr-1" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-lg py-5 text-xs text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          {busy ? "Uploading..." : "Click to upload image"}
        </button>
      )}
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

interface AgentTier {
  minActiveDeposits: number;
  reward: number;
  label: string;
}

interface BuyRewardTier {
  min: number;
  max: number;
  reward: number;
}

interface DailyRewardTier {
  minBuy: number;
  reward: number;
}
interface WeeklyRewardTier {
  minBuy: number;
  reward: number;
}

interface FakeOrder {
  username: string;
  amount: string;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading: settingsLoading, isError: settingsError, error: settingsErr } = useAdminGetSettings({
    query: {
      queryKey: getAdminGetSettingsQueryKey(),
      retry: false,
      refetchOnWindowFocus: false,
      // Cache between admin tab switches to avoid a fresh DB round-trip
      // on every navigation (Settings ↔ Links & Media ↔ etc).
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    },
  });
  const notifyMut = useAdminNotifyAll();
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastImageUrl, setBroadcastImageUrl] = useState("");

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
  const [feeTiers, setFeeTiers] = useState<FeeTier[]>([]);
  const [agentTiers, setAgentTiers] = useState<AgentTier[]>([]);
  const [apkDownloadUrl, setApkDownloadUrl] = useState("");
  const [apkVersion, setApkVersion] = useState("");
  const [forceAppDownload, setForceAppDownload] = useState(true);
  const [buyRewardTiers, setBuyRewardTiers] = useState<BuyRewardTier[]>([
    { min: 100, max: 500, reward: 5 },
    { min: 501, max: 50000, reward: 5 },
  ]);
  const [sellRewardPercent, setSellRewardPercent] = useState<number>(0);
  const [maxRegistrationsPerDevice, setMaxRegistrationsPerDevice] = useState<number>(3);
  const [deviceLimitEnabled, setDeviceLimitEnabled] = useState<boolean>(true);
  // Home page Rewards card (UPI + USDT highlight on the home screen)
  const [homeRewardCardEnabled, setHomeRewardCardEnabled] = useState<boolean>(true);
  const [homeRewardUpiTitle, setHomeRewardUpiTitle] = useState<string>("UPI REWARD UP TO 6%");
  const [homeRewardUpiExampleAmount, setHomeRewardUpiExampleAmount] = useState<number>(10000);
  const [homeRewardUpiExampleBonus, setHomeRewardUpiExampleBonus] = useState<number>(300);
  const [homeRewardUsdtTitle, setHomeRewardUsdtTitle] = useState<string>("USDT REWARD");
  // Signup bonus + daily reward
  const [signupBonus, setSignupBonus] = useState<number>(51);
  const [dailyRewardEnabled, setDailyRewardEnabled] = useState<boolean>(true);
  const [dailyRewardTiers, setDailyRewardTiers] = useState<DailyRewardTier[]>([
    { minBuy: 2000, reward: 20 },
    { minBuy: 5000, reward: 50 },
    { minBuy: 10000, reward: 100 },
    { minBuy: 20000, reward: 200 },
    { minBuy: 50000, reward: 300 },
  ]);

  const [weeklyRewardEnabled, setWeeklyRewardEnabled] = useState<boolean>(true);
  const [weeklyRewardTiers, setWeeklyRewardTiers] = useState<WeeklyRewardTier[]>([
    { minBuy: 50000,   reward: 300 },
    { minBuy: 100000,  reward: 1000 },
    { minBuy: 300000,  reward: 3000 },
    { minBuy: 500000,  reward: 5000 },
    { minBuy: 1000000, reward: 10000 },
  ]);

  const [fakeOrders, setFakeOrders] = useState<FakeOrder[]>([]);
  const [fakeOrderUsername, setFakeOrderUsername] = useState("");
  const [fakeOrderAmount, setFakeOrderAmount] = useState("");

  // SMS Auto Delete UI removed — cleanup now runs system-wide, automatically,
  // every 6 hours via the learning auto-cleanup job (server-side). No manual
  // toggle or "Run Cleanup" button is needed.

  useEffect(() => {
    if (settings) {
      setUpiId((settings as any).upiId || "");
      setUpiName((settings as any).upiName || "");
      setMultipleUpiIds((settings as any).multipleUpiIds || []);
      setAnnouncements((settings as any).announcements || []);
      setPopupMessage((settings as any).popupMessage || "");
      setPopupImageUrl((settings as any).popupImageUrl || "");
      setBroadcastImageUrl((settings as any).broadcastNotification?.imageUrl || "");
      setAppName((settings as any).appName || "TrustPay");
      setAppLogoUrl((settings as any).appLogoUrl || "");
      setPopupSoundUrl((settings as any).popupSoundUrl || "");
      setChunkMin(Number((settings as any).chunkMin) || 100);
      setChunkMax(Number((settings as any).chunkMax) || 50000);
      setAdminChunkMin(Number((settings as any).adminChunkMin) || 5000);
      setAdminChunkMax(Number((settings as any).adminChunkMax) || 50000);
      setTelegramLink((settings as any).telegramLink || "");
      setBannerImages(Array.isArray((settings as any).bannerImages) ? (settings as any).bannerImages : []);
      const tiers = Array.isArray((settings as any).feeTiers) ? (settings as any).feeTiers : [];
      setFeeTiers(tiers.map((t: any) => ({ min: Number(t.min) || 0, max: Number(t.max) || 0, fee: Number(t.fee) || 0 })));
      const aTiers = Array.isArray((settings as any).agentTiers) ? (settings as any).agentTiers : [];
      setAgentTiers(aTiers.map((t: any) => ({
        minActiveDeposits: Number(t.minActiveDeposits) || 0,
        reward: Number(t.reward) || 0,
        label: String(t.label || ""),
      })));
      setApkDownloadUrl((settings as any).apkDownloadUrl || "");
      setApkVersion((settings as any).apkVersion || "1.0.0");
      setForceAppDownload((settings as any).forceAppDownload === true);
      const bTiersRaw = (settings as any).buyRewardTiers;
      if (bTiersRaw === null || bTiersRaw === undefined) {
        // Not yet configured in DB — pre-populate default rows using legacy flat percent
        const legacyPct = Number((settings as any).buyRewardPercent) || 5;
        setBuyRewardTiers([{ min: 100, max: 500, reward: legacyPct }, { min: 501, max: 50000, reward: legacyPct }]);
      } else if (Array.isArray(bTiersRaw)) {
        setBuyRewardTiers(bTiersRaw.map((t: any) => ({ min: Number(t.min) || 0, max: Number(t.max) || 0, reward: Number(t.reward) || 0 })));
      }
      setSellRewardPercent(Number((settings as any).sellRewardPercent) || 0);
      setMaxRegistrationsPerDevice(Number((settings as any).maxRegistrationsPerDevice) || 3);
      const dlRaw = (settings as any).deviceLimitEnabled;
      setDeviceLimitEnabled(dlRaw === undefined ? true : dlRaw === true || dlRaw === "true");
      const enabledRaw = (settings as any).homeRewardCardEnabled;
      setHomeRewardCardEnabled(enabledRaw === undefined ? true : enabledRaw === true || enabledRaw === "true");
      setHomeRewardUpiTitle((settings as any).homeRewardUpiTitle || "UPI REWARD UP TO 6%");
      setHomeRewardUpiExampleAmount(Number((settings as any).homeRewardUpiExampleAmount) || 10000);
      setHomeRewardUpiExampleBonus(Number((settings as any).homeRewardUpiExampleBonus) || 300);
      setHomeRewardUsdtTitle((settings as any).homeRewardUsdtTitle || "USDT REWARD");
      const foRaw = (settings as any).fakeOrdersConfig;
      setFakeOrders(Array.isArray(foRaw) ? foRaw : []);
      setSignupBonus(Number((settings as any).signupBonus ?? 51));
      const drEnabled = (settings as any).dailyRewardEnabled;
      setDailyRewardEnabled(drEnabled === undefined ? true : drEnabled === true || drEnabled === "true");
      const drTiersRaw = (settings as any).dailyRewardTiers;
      if (Array.isArray(drTiersRaw) && drTiersRaw.length > 0) {
        setDailyRewardTiers(drTiersRaw.map((t: any) => ({ minBuy: Number(t.minBuy) || 0, reward: Number(t.reward) || 0 })));
      }
      const wrEnabled = (settings as any).weeklyRewardEnabled;
      setWeeklyRewardEnabled(wrEnabled === undefined ? true : wrEnabled === true || wrEnabled === "true");
      const wrTiersRaw = (settings as any).weeklyRewardTiers;
      if (Array.isArray(wrTiersRaw) && wrTiersRaw.length > 0) {
        setWeeklyRewardTiers(wrTiersRaw.map((t: any) => ({ minBuy: Number(t.minBuy) || 0, reward: Number(t.reward) || 0 })));
      }
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
      onSuccess: (data) => {
        toast({ title: "Settings updated successfully" });
        // PUT response already contains the fresh settings — write straight
        // to cache instead of triggering another GET. Skips one full
        // round-trip to Supabase, save feels instant.
        if (data) queryClient.setQueryData(getAdminGetSettingsQueryKey(), data);
        queryClient.invalidateQueries({ queryKey: getGetAppSettingsQueryKey() });
        setAdminPassword("");
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.message || "Failed to save settings", variant: "destructive" });
      },
    },
  });

  const addAgentTier = () => setAgentTiers((prev) => {
    const last = prev[prev.length - 1];
    const minActiveDeposits = last ? last.minActiveDeposits + 25 : 20;
    return [...prev, { minActiveDeposits, reward: 50, label: `Tier ${prev.length + 1}` }];
  });
  const removeAgentTier = (i: number) => setAgentTiers((prev) => prev.filter((_, idx) => idx !== i));
  const updateAgentTier = (i: number, field: keyof AgentTier, val: any) =>
    setAgentTiers((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  const addBuyRewardTier = () => setBuyRewardTiers((prev) => {
    const last = prev[prev.length - 1];
    const min = last ? last.max + 1 : 100;
    return [...prev, { min, max: min + 499, reward: 5 }];
  });
  const removeBuyRewardTier = (i: number) => setBuyRewardTiers((prev) => prev.filter((_, idx) => idx !== i));
  const updateBuyRewardTier = (i: number, field: keyof BuyRewardTier, val: number) =>
    setBuyRewardTiers((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  const addDailyRewardTier = () => setDailyRewardTiers((prev) => {
    const last = prev[prev.length - 1];
    const minBuy = last ? last.minBuy * 2 : 2000;
    return [...prev, { minBuy, reward: 50 }];
  });
  const removeDailyRewardTier = (i: number) => setDailyRewardTiers((prev) => prev.filter((_, idx) => idx !== i));
  const updateDailyRewardTier = (i: number, field: keyof DailyRewardTier, val: number) =>
    setDailyRewardTiers((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  const addWeeklyRewardTier = () => setWeeklyRewardTiers((prev) => {
    const last = prev[prev.length - 1];
    const minBuy = last ? last.minBuy * 2 : 50000;
    return [...prev, { minBuy, reward: 500 }];
  });
  const removeWeeklyRewardTier = (i: number) => setWeeklyRewardTiers((prev) => prev.filter((_, idx) => idx !== i));
  const updateWeeklyRewardTier = (i: number, field: keyof WeeklyRewardTier, val: number) =>
    setWeeklyRewardTiers((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

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

  const validateBuyRewardTiers = (tiers: BuyRewardTier[]): string | null => {
    const sorted = [...tiers].sort((a, b) => a.min - b.min);
    for (const t of sorted) {
      if (!Number.isFinite(t.min) || !Number.isFinite(t.max) || !Number.isFinite(t.reward)) return "Each buy reward tier needs Min, Max and Reward %";
      if (t.min < 0 || t.max <= t.min) return `Invalid range: min must be strictly less than max (${t.min}-${t.max})`;
      if (t.reward < 0) return "Reward % cannot be negative";
    }
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].min <= sorted[i - 1].max) {
        return `Buy reward tiers overlap: ${sorted[i - 1].min}-${sorted[i - 1].max} and ${sorted[i].min}-${sorted[i].max}`;
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
    const buyTierError = validateBuyRewardTiers(buyRewardTiers);
    if (buyTierError) {
      toast({ title: "Buy reward tiers error", description: buyTierError, variant: "destructive" });
      return;
    }
    const payload: any = {
      upiId,
      upiName,
      multipleUpiIds: multipleUpiIds.filter((u) => u.upiId.trim()),
      announcements: announcements.filter((a) => a.message.trim()),
      popupMessage,
      popupImageUrl,
      appName,
      appLogoUrl,
      popupSoundUrl,
      chunkMin,
      chunkMax,
      adminChunkMin,
      adminChunkMax,
      feeTiers,
      agentTiers,
      apkDownloadUrl,
      apkVersion,
      forceAppDownload,
      buyRewardTiers,
      sellRewardPercent,
      maxRegistrationsPerDevice,
      deviceLimitEnabled,
      homeRewardCardEnabled,
      homeRewardUpiTitle,
      homeRewardUpiExampleAmount,
      homeRewardUpiExampleBonus,
      homeRewardUsdtTitle,
      signupBonus,
      dailyRewardEnabled,
      dailyRewardTiers,
      weeklyRewardEnabled,
      weeklyRewardTiers,
      fakeOrdersConfig: fakeOrders,
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
      await notifyMut.mutateAsync({ data: { message: broadcastMessage.trim(), title: broadcastTitle.trim() || "TrustPay", imageUrl: broadcastImageUrl.trim() || "" } as any });
      toast({ title: "Notification sent to all users!" });
      setBroadcastMessage("");
      setBroadcastTitle("");
      setBroadcastImageUrl("");
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

        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800">
              Changes here affect <strong>all users</strong> immediately after saving.
              <strong className="ml-1">UPI ID</strong> — the main account users pay to for deposits.
              <strong className="ml-1">Withdrawal Details</strong> — shown to sellers when getting paid.
              <strong className="ml-1">Fee Tiers</strong> — define the platform fee % per transaction amount range; ensure tiers don't overlap.
              <strong className="ml-1">Announcement Popup</strong> — shown to all users when they open the app; leave empty to hide.
              <strong className="ml-1">Notify All</strong> — sends a push notification to every registered user immediately.
            </p>
          </CardContent>
        </Card>

        {settingsLoading ? (
          <Skeleton className="h-[500px] w-full rounded-xl" />
        ) : settingsError ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">
              Failed to load settings: {getErrorMessage(settingsErr)}
            </CardContent>
          </Card>
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
                  <audio src={assetUrl(popupSoundUrl)} controls className="w-full h-10" />
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

            {/* Trade Reward Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Trade Reward Settings</CardTitle>
                <CardDescription>
                  Buy reward: buyer ko har successful trade pe milega (order amount ka %). Sell reward: seller ko milega (0% = band hai, future mein enable karo).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Buy Reward Tiers</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addBuyRewardTier}>
                      <Plus className="w-3 h-3 mr-1" /> Add Tier
                    </Button>
                  </div>
                  {buyRewardTiers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No tiers configured — reward will be 0% for all trades.</p>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Min (₹)</th>
                            <th className="text-left px-3 py-2 font-medium">Max (₹)</th>
                            <th className="text-left px-3 py-2 font-medium">Reward %</th>
                            <th className="px-2 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {buyRewardTiers.map((t, i) => (
                            <tr key={i} className="border-t">
                              <td className="px-2 py-1.5">
                                <Input
                                  type="number"
                                  min={0}
                                  step={1}
                                  className="h-7 text-xs"
                                  value={t.min}
                                  onChange={(e) => updateBuyRewardTier(i, "min", parseFloat(e.target.value) || 0)}
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input
                                  type="number"
                                  min={0}
                                  step={1}
                                  className="h-7 text-xs"
                                  value={t.max}
                                  onChange={(e) => updateBuyRewardTier(i, "max", parseFloat(e.target.value) || 0)}
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.1}
                                  className="h-7 text-xs"
                                  value={t.reward}
                                  onChange={(e) => updateBuyRewardTier(i, "reward", parseFloat(e.target.value) || 0)}
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeBuyRewardTier(i)}>
                                  <Trash2 className="w-3 h-3 text-destructive" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">Amount ranges must not overlap. If no tier matches an order amount, reward is 0%.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Sell Reward %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={sellRewardPercent}
                    onChange={(e) => setSellRewardPercent(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 1"
                    className="max-w-[180px]"
                  />
                  <p className="text-[11px] text-muted-foreground">Seller ko ₹100 trade pe ₹{(100 * sellRewardPercent / 100).toFixed(2)} milega</p>
                </div>
                {/* Home page Rewards highlight card */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-amber-900">Home Page Rewards Card</Label>
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={homeRewardCardEnabled}
                        onChange={(e) => setHomeRewardCardEnabled(e.target.checked)}
                        className="h-4 w-4 rounded border-amber-400"
                        data-testid="checkbox-home-reward-enabled"
                      />
                      <span className="font-semibold">{homeRewardCardEnabled ? "Visible" : "Hidden"}</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-muted-foreground -mt-1">
                    Home screen par UPI + USDT reward highlight card show karta hai. USDT side automatically rate aur bonus % se compute hoti hai.
                  </p>
                  <div className="grid grid-cols-1 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium">UPI side — Headline</Label>
                      <Input
                        value={homeRewardUpiTitle}
                        onChange={(e) => setHomeRewardUpiTitle(e.target.value)}
                        placeholder="UPI REWARD UP TO 6%"
                        className="h-8 text-xs"
                        data-testid="input-home-reward-upi-title"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-medium">UPI Example — Pay (₹)</Label>
                        <Input
                          type="number" min={0} step={100}
                          value={homeRewardUpiExampleAmount}
                          onChange={(e) => setHomeRewardUpiExampleAmount(parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs"
                          data-testid="input-home-reward-upi-amount"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-medium">UPI Example — Bonus (₹)</Label>
                        <Input
                          type="number" min={0} step={1}
                          value={homeRewardUpiExampleBonus}
                          onChange={(e) => setHomeRewardUpiExampleBonus(parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs"
                          data-testid="input-home-reward-upi-bonus"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium">USDT side — Headline</Label>
                      <Input
                        value={homeRewardUsdtTitle}
                        onChange={(e) => setHomeRewardUsdtTitle(e.target.value)}
                        placeholder="USDT REWARD"
                        className="h-8 text-xs"
                        data-testid="input-home-reward-usdt-title"
                      />
                      <p className="text-[10px] text-muted-foreground">USDT example auto-computed from current USDT rate + bonus %.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Max accounts allowed per device</Label>
                    <button
                      type="button"
                      onClick={() => setDeviceLimitEnabled((v) => !v)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${deviceLimitEnabled ? "bg-indigo-600" : "bg-slate-200"}`}
                      data-testid="toggle-device-limit-enabled"
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${deviceLimitEnabled ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>
                  {deviceLimitEnabled ? (
                    <>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        step={1}
                        value={maxRegistrationsPerDevice}
                        onChange={(e) => setMaxRegistrationsPerDevice(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                        placeholder="3"
                        className="max-w-[180px]"
                        data-testid="input-max-registrations-per-device"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Same device par jitne accounts ban sakte hain (default 3). Limit cross hone par registration block ho jayega.
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                      Device limit <strong>OFF</strong> hai — koi bhi device se unlimited accounts ban sakte hain. OTP verification se security maintain hogi.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Agent Reward Tiers */}
            <Card data-testid="card-agent-tiers">
              <CardHeader>
                <CardTitle>Agent Reward Tiers</CardTitle>
                <CardDescription>
                  Daily reward slabs based on the number of distinct invitees of an agent who confirm at
                  least one deposit on a given day. The agent gets the highest tier they reach today.
                  A tier-coloured badge (Bronze / Silver / Gold / Diamond by tier order) appears on the
                  agent's home screen above "My Total Assets" — only on days the criteria are met. On
                  any day they fail to qualify, the badge disappears automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                  <div className="col-span-3">Min Active Deposits</div>
                  <div className="col-span-3">Reward (₹)</div>
                  <div className="col-span-5">Label</div>
                  <div className="col-span-1"></div>
                </div>
                {agentTiers.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    No agent tiers configured.
                  </p>
                )}
                {agentTiers.map((tier, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      type="number"
                      className="col-span-3"
                      value={tier.minActiveDeposits}
                      onChange={(e) => updateAgentTier(idx, "minActiveDeposits", parseInt(e.target.value) || 0)}
                      data-testid={`input-agent-tier-min-${idx}`}
                    />
                    <Input
                      type="number"
                      className="col-span-3"
                      value={tier.reward}
                      onChange={(e) => updateAgentTier(idx, "reward", parseFloat(e.target.value) || 0)}
                      data-testid={`input-agent-tier-reward-${idx}`}
                    />
                    <Input
                      type="text"
                      className="col-span-5"
                      placeholder="e.g. Bronze Agent"
                      value={tier.label}
                      onChange={(e) => updateAgentTier(idx, "label", e.target.value)}
                      data-testid={`input-agent-tier-label-${idx}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-span-1"
                      onClick={() => removeAgentTier(idx)}
                      data-testid={`button-remove-agent-tier-${idx}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addAgentTier} className="w-full" data-testid="button-add-agent-tier">
                  <Plus className="w-4 h-4 mr-2" /> Add Agent Tier
                </Button>
              </CardContent>
            </Card>

            {/* Welcome Bonus */}
            <Card className="border-emerald-100 bg-emerald-50/30">
              <CardHeader>
                <CardTitle className="text-emerald-800 flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  Welcome Bonus (New User)
                </CardTitle>
                <CardDescription>
                  Amount credited to every new user's wallet on first registration. Set to 0 to disable.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Signup Bonus Amount (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    value={signupBonus}
                    onChange={(e) => setSignupBonus(Number(e.target.value) || 0)}
                    placeholder="51"
                    data-testid="input-signup-bonus"
                  />
                  <p className="text-xs text-muted-foreground">Default: ₹51. Set to 0 to disable welcome bonus.</p>
                </div>
              </CardContent>
            </Card>

            {/* Daily Task Reward */}
            <Card className="border-amber-100 bg-amber-50/30">
              <CardHeader>
                <CardTitle className="text-amber-800 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Daily Task Reward
                </CardTitle>
                <CardDescription>
                  Users earn a daily reward by completing buy trades. The highest tier where today's buy total &ge; minBuy is credited once per day.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-4 py-3">
                  <div>
                    <div className="font-medium text-sm">Daily Reward Enabled</div>
                    <div className="text-xs text-muted-foreground">Show daily reward card on home screen</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDailyRewardEnabled((v) => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${dailyRewardEnabled ? "bg-amber-500" : "bg-slate-300"}`}
                    data-testid="toggle-daily-reward"
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${dailyRewardEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Reward Tiers</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addDailyRewardTier} className="gap-1 text-amber-700 border-amber-200 hover:bg-amber-50">
                      <Plus className="w-3 h-3" /> Add Tier
                    </Button>
                  </div>
                  <div className="rounded-lg border border-amber-200 overflow-hidden">
                    <div className="grid grid-cols-[1fr_1fr_auto] text-xs font-medium bg-amber-50 px-3 py-2 gap-2 border-b border-amber-100">
                      <span>Min Buy (₹)</span>
                      <span>Reward (₹)</span>
                      <span />
                    </div>
                    {dailyRewardTiers.map((t, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_auto] px-3 py-2 gap-2 items-center border-b border-amber-50 last:border-0">
                        <Input
                          type="number" min={0} step={100}
                          value={t.minBuy}
                          onChange={(e) => updateDailyRewardTier(i, "minBuy", Number(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                        <Input
                          type="number" min={0} step={1}
                          value={t.reward}
                          onChange={(e) => updateDailyRewardTier(i, "reward", Number(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeDailyRewardTier(i)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    {dailyRewardTiers.length === 0 && (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">No tiers — daily reward card will be hidden</div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">User claims the highest tier where their total confirmed buys today ≥ Min Buy. Reward is credited to their wallet once per day.</p>
                </div>
              </CardContent>
            </Card>


            {/* Weekly Task Reward */}
            <Card className="border-violet-100 bg-violet-50/30">
              <CardHeader>
                <CardTitle className="text-violet-800 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Weekly Task Reward
                </CardTitle>
                <CardDescription>
                  Users earn a weekly reward by completing buy trades over Mon–Sun. Highest tier where weekly buy total ≥ minBuy is credited once per week.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-violet-200 bg-white px-4 py-3">
                  <div>
                    <div className="font-medium text-sm">Weekly Reward Enabled</div>
                    <div className="text-xs text-muted-foreground">Show weekly reward card on home screen</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWeeklyRewardEnabled((v) => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${weeklyRewardEnabled ? "bg-violet-500" : "bg-slate-300"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${weeklyRewardEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Reward Tiers</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addWeeklyRewardTier} className="gap-1 text-violet-700 border-violet-200 hover:bg-violet-50">
                      <Plus className="w-3 h-3" /> Add Tier
                    </Button>
                  </div>
                  <div className="rounded-lg border border-violet-200 overflow-hidden">
                    <div className="grid grid-cols-[1fr_1fr_auto] text-xs font-medium bg-violet-50 px-3 py-2 gap-2 border-b border-violet-100">
                      <span>Min Weekly Buy (₹)</span><span>Reward (₹)</span><span />
                    </div>
                    {weeklyRewardTiers.map((t, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_auto] px-3 py-2 gap-2 items-center border-b border-violet-50 last:border-0">
                        <Input type="number" min={0} step={1000} value={t.minBuy}
                          onChange={(e) => updateWeeklyRewardTier(i, "minBuy", Number(e.target.value) || 0)} className="h-8 text-sm" />
                        <Input type="number" min={0} step={10} value={t.reward}
                          onChange={(e) => updateWeeklyRewardTier(i, "reward", Number(e.target.value) || 0)} className="h-8 text-sm" />
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeWeeklyRewardTier(i)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    {weeklyRewardTiers.length === 0 && (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">No tiers — weekly reward card will be hidden</div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">User claims the highest tier where their total confirmed buys this week ≥ Min Buy. Once per week (resets Monday).</p>
                </div>
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
        <AgentEarningsCard />

        {/* Broadcast Notification */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-500" />
              Send Notification to All Users
            </CardTitle>
            <CardDescription>This message will be delivered as a system notification next time users open the app.</CardDescription>
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
            <ImagePicker label="Popup Image (Optional)" value={broadcastImageUrl} onChange={setBroadcastImageUrl} />
            <Button onClick={handleSendBroadcast} disabled={notifying} className="w-full">
              <Bell className="w-4 h-4 mr-2" />
              {notifying ? "Sending..." : "Send to All Users"}
            </Button>
            <TestPushButton />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function TestPushButton() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  async function handleTest() {
    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/api/admin/test-push`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (res.ok) {
        toast({ title: "Test notification sent!", description: "Check your device for the push notification." });
      } else {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Failed to send", description: d.error || "Check VAPID keys and push subscription.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button variant="outline" onClick={handleTest} disabled={loading} className="w-full border-dashed border-blue-300 text-blue-700 hover:bg-blue-50">
      <Bell className="w-4 h-4 mr-2" />
      {loading ? "Sending..." : "Send Test Push to My Device"}
    </Button>
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

function getErrorMessage(err: any) { return err?.message || err?.error || "Unknown error"; }

function AgentEarningsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-agent-transactions"],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/api/admin/agent-transactions?limit=100`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
  const items = (data as any)?.items || [];
  return (
    <Card className="border-violet-200">
      <CardHeader>
        <CardTitle className="text-violet-700 flex items-center gap-2">
          <Award className="w-4 h-4" />
          Agent Criteria Earnings
        </CardTitle>
        <CardDescription>Daily agent rewards credited to admin from the platform's agent criteria system.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-violet-50 p-3">
            <div className="text-xs text-muted-foreground">Lifetime earnings</div>
            <div className="text-2xl font-bold text-violet-700">₹{Number((data as any)?.totalAmount || 0).toFixed(2)}</div>
            <div className="text-[11px] text-muted-foreground">{(data as any)?.totalCount ?? 0} rewards</div>
          </div>
          <div className="rounded-xl bg-orange-50 p-3">
            <div className="text-xs text-muted-foreground">Today</div>
            <div className="text-2xl font-bold text-orange-600">₹{Number((data as any)?.todayAmount || 0).toFixed(2)}</div>
            <div className="text-[11px] text-muted-foreground">{(data as any)?.todayCount ?? 0} rewards</div>
          </div>
        </div>
        <div className="border rounded-lg max-h-80 overflow-y-auto divide-y">
          {isLoading ? (
            <div className="p-3 text-sm text-muted-foreground">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No agent rewards credited yet.</div>
          ) : items.map((t: any) => (
            <div key={t.id} className="p-2.5 flex items-center justify-between text-xs gap-2">
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{t.description}</div>
                <div className="text-[10px] text-muted-foreground">
                  {t.createdAt ? format(new Date(t.createdAt), "dd MMM yyyy, HH:mm") : ""}
                </div>
              </div>
              <div className="font-bold text-violet-700 shrink-0">+₹{Number(t.amount).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
