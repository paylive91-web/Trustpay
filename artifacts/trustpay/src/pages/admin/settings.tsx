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
import { Plus, Trash2 } from "lucide-react";
import { clearAuthToken } from "@/lib/auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface UpiEntry {
  upiId: string;
  upiName: string;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useAdminGetSettings();
  const [saving, setSaving] = useState(false);

  const [upiId, setUpiId] = useState("");
  const [upiName, setUpiName] = useState("");
  const [multipleUpiIds, setMultipleUpiIds] = useState<UpiEntry[]>([]);
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
      setPopupMessage((settings as any).popupMessage || "");
      setPopupImageUrl((settings as any).popupImageUrl || "");
      setTelegramLink((settings as any).telegramLink || "");
      setBannerImages((settings as any).bannerImages ? (settings as any).bannerImages.join(",") : "");
      setBuyRules((settings as any).buyRules || "");
      setSellRules((settings as any).sellRules || "");
      setAdminPassword("");
    }
  }, [settings]);

  const addUpiEntry = () => {
    setMultipleUpiIds((prev) => [...prev, { upiId: "", upiName: "" }]);
  };

  const removeUpiEntry = (index: number) => {
    setMultipleUpiIds((prev) => prev.filter((_, i) => i !== index));
  };

  const updateUpiEntry = (index: number, field: keyof UpiEntry, value: string) => {
    setMultipleUpiIds((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("authToken");
      const payload: any = {
        upiId,
        upiName,
        multipleUpiIds: multipleUpiIds.filter((u) => u.upiId.trim()),
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
                <CardDescription>
                  Add multiple UPI IDs for payment. Users can choose which to pay to when buying.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {multipleUpiIds.map((entry, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input
                        placeholder="UPI ID (e.g. example@paytm)"
                        value={entry.upiId}
                        onChange={(e) => updateUpiEntry(idx, "upiId", e.target.value)}
                      />
                      <Input
                        placeholder="Display Name"
                        value={entry.upiName}
                        onChange={(e) => updateUpiEntry(idx, "upiName", e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive shrink-0"
                      onClick={() => removeUpiEntry(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addUpiEntry} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add UPI ID
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

            {/* Announcement Popup */}
            <Card>
              <CardHeader>
                <CardTitle>Announcement Popup</CardTitle>
                <CardDescription>Shown to users when they open the app.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Message Content</Label>
                  <Textarea
                    placeholder="Welcome to TrustPay..."
                    className="min-h-[100px]"
                    value={popupMessage}
                    onChange={(e) => setPopupMessage(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Image URL (Optional)</Label>
                  <Input
                    placeholder="https://example.com/image.png"
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
                  <Label>Help Center / Support Telegram Link</Label>
                  <Input
                    placeholder="https://t.me/..."
                    value={telegramLink}
                    onChange={(e) => setTelegramLink(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    This link opens when users click "Help Center" on the home screen.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Home Banner Images (Comma separated URLs)</Label>
                  <Textarea
                    placeholder="https://img1.jpg, https://img2.jpg"
                    value={bannerImages}
                    onChange={(e) => setBannerImages(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    These images appear in the top carousel on the home page.
                  </p>
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
      </div>
    </AdminLayout>
  );
}
