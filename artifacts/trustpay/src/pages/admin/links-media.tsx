import React, { useEffect, useRef, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import {
  useAdminGetSettings,
  useAdminUpdateSettings,
  useAdminUploadImage,
  getAdminGetSettingsQueryKey,
  getGetAppSettingsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, Plus, Link as LinkIcon, ImageIcon } from "lucide-react";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function AdminLinksMedia() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inviteImageInputRef = useRef<HTMLInputElement | null>(null);
  const buyRulesInputRef = useRef<HTMLInputElement | null>(null);
  const sellRulesInputRef = useRef<HTMLInputElement | null>(null);

  const {
    data: settings,
    isLoading,
    isError,
  } = useAdminGetSettings({
    query: {
      queryKey: getAdminGetSettingsQueryKey(),
      retry: false,
      refetchOnWindowFocus: false,
      // Cache settings client-side. Admins jump between Settings, Links &
      // Media, etc. — without staleTime each navigation re-fetched from
      // Supabase (often 200-500ms round-trip) which felt very slow.
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    },
  });

  const [telegramLink, setTelegramLink] = useState("");
  const [bannerImages, setBannerImages] = useState<string[]>([]);
  const [inviteShareImageUrl, setInviteShareImageUrl] = useState("");
  const [buyRulesImageUrl, setBuyRulesImageUrl] = useState("");
  const [sellRulesImageUrl, setSellRulesImageUrl] = useState("");

  // Whenever fresh settings arrive, normalise & strip junk so UI is clean.
  useEffect(() => {
    if (!settings) return;
    setTelegramLink((settings as any).telegramLink || "");
    const raw = (settings as any).bannerImages;
    const arr = Array.isArray(raw) ? raw : [];
    const clean = arr
      .map((u: unknown) => (typeof u === "string" ? u.trim() : ""))
      .filter((u: string) => u.length > 0);
    setBannerImages(clean);
    setInviteShareImageUrl((settings as any).inviteShareImageUrl || "");
    setBuyRulesImageUrl((settings as any).buyRulesImageUrl || "");
    setSellRulesImageUrl((settings as any).sellRulesImageUrl || "");
  }, [settings]);

  const uploadMut = useAdminUploadImage();
  const updateMut = useAdminUpdateSettings({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Saved" });
        // The PUT already returns the full updated settings object — write
        // it directly into the cache instead of triggering a fresh GET.
        // Saves one round-trip (~200-500ms on Supabase) and the UI feels
        // instant after Save.
        if (data) queryClient.setQueryData(getAdminGetSettingsQueryKey(), data);
        // Public settings still need a refresh so users see new banners /
        // invite image, but we don't block on it.
        queryClient.invalidateQueries({ queryKey: getGetAppSettingsQueryKey() });
      },
      onError: (e: any) =>
        toast({ title: "Save failed", description: e?.message, variant: "destructive" }),
    },
  });

  const onPickBanner = async (file: File | null) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      toast({ title: `Image too large (${mb} MB)`, description: "Max allowed is 20 MB.", variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const d = await uploadMut.mutateAsync({ data: { dataUrl } });
      setBannerImages((prev) => [...prev, d.url]);
      toast({ title: "Banner added — remember to Save Changes" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onPickInviteImage = async (file: File | null) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      toast({ title: `Image too large (${mb} MB)`, description: "Max allowed is 20 MB.", variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const d = await uploadMut.mutateAsync({ data: { dataUrl } });
      setInviteShareImageUrl(d.url);
      toast({ title: "Invite image uploaded — remember to Save Changes" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      if (inviteImageInputRef.current) inviteImageInputRef.current.value = "";
    }
  };

  const onPickRulesImage = async (
    file: File | null,
    which: "buy" | "sell",
  ) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      toast({ title: `Image too large (${mb} MB)`, description: "Max allowed is 20 MB.", variant: "destructive" });
      return;
    }
    const ref = which === "buy" ? buyRulesInputRef : sellRulesInputRef;
    try {
      const dataUrl = await fileToDataUrl(file);
      const d = await uploadMut.mutateAsync({ data: { dataUrl } });
      if (which === "buy") setBuyRulesImageUrl(d.url);
      else setSellRulesImageUrl(d.url);
      toast({ title: `${which === "buy" ? "Buy" : "Sell"} Rules image uploaded — remember to Save Changes` });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      if (ref.current) ref.current.value = "";
    }
  };

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMut.mutate({
      data: {
        telegramLink: telegramLink.trim(),
        bannerImages: bannerImages.map((u) => u.trim()).filter(Boolean),
        inviteShareImageUrl: inviteShareImageUrl.trim(),
        buyRulesImageUrl: buyRulesImageUrl.trim(),
        sellRulesImageUrl: sellRulesImageUrl.trim(),
      } as any,
    });
  };

  const uploading = uploadMut.isPending;

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Links & Media</h1>
          <p className="text-sm text-muted-foreground">
            Manage support contact link and home-screen banner images.
          </p>
        </div>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}
        {isError && (
          <Card className="border-red-300">
            <CardContent className="p-4 text-sm text-red-600">
              Failed to load settings. Please refresh.
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && (
          <form onSubmit={onSave} className="space-y-6">
            {/* Telegram link */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-primary" />
                  Support Telegram Link
                </CardTitle>
                <CardDescription>
                  Shown to users on the Support page so they can contact you.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Telegram URL</Label>
                  <Input
                    placeholder="https://t.me/your_handle"
                    value={telegramLink}
                    onChange={(e) => setTelegramLink(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Invite Share Image */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  Invite Share Image
                </CardTitle>
                <CardDescription>
                  Jab user Share button dabaye to yeh image WhatsApp/Telegram mein automatically attach hogi.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {inviteShareImageUrl ? (
                  <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                    <div className="bg-muted flex items-center justify-center overflow-hidden p-2">
                      <img
                        src={inviteShareImageUrl}
                        alt="Invite Share Image"
                        className="max-h-[480px] max-w-full w-auto h-auto object-contain rounded"
                      />
                    </div>
                    <div className="p-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-muted-foreground">Current image</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setInviteShareImageUrl("")}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground border-2 border-dashed rounded-md p-8 text-center">
                    Koi image nahi — neeche Upload karo.
                  </div>
                )}
                <div>
                  <input
                    ref={inviteImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickInviteImage(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => inviteImageInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <><Upload className="w-4 h-4 mr-2 animate-pulse" />Uploading...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" />Upload Image</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Buy Rules Image */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  Buy Rules Image
                </CardTitle>
                <CardDescription>
                  Image shown to users on the home screen under "Buy Rules". Recommended portrait or square layout.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {buyRulesImageUrl ? (
                  <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                    <div className="bg-muted flex items-center justify-center overflow-hidden p-2">
                      <img
                        src={buyRulesImageUrl}
                        alt="Buy Rules Image"
                        className="max-h-[480px] w-auto h-auto object-contain rounded"
                      />
                    </div>
                    <div className="p-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-muted-foreground">Current image</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setBuyRulesImageUrl("")}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground border-2 border-dashed rounded-md p-8 text-center">
                    No image yet — click Upload below. Portrait or square images work best.
                  </div>
                )}
                <div>
                  <input
                    ref={buyRulesInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickRulesImage(e.target.files?.[0] || null, "buy")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => buyRulesInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <><Upload className="w-4 h-4 mr-2 animate-pulse" />Uploading...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" />Upload Image</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sell Rules Image */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  Sell Rules Image
                </CardTitle>
                <CardDescription>
                  Image shown to users on the home screen under "Sell Rules". Recommended portrait or square layout.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sellRulesImageUrl ? (
                  <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                    <div className="bg-muted flex items-center justify-center overflow-hidden p-2">
                      <img
                        src={sellRulesImageUrl}
                        alt="Sell Rules Image"
                        className="max-h-[480px] w-auto h-auto object-contain rounded"
                      />
                    </div>
                    <div className="p-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-muted-foreground">Current image</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSellRulesImageUrl("")}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground border-2 border-dashed rounded-md p-8 text-center">
                    No image yet — click Upload below. Portrait or square images work best.
                  </div>
                )}
                <div>
                  <input
                    ref={sellRulesInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickRulesImage(e.target.files?.[0] || null, "sell")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => sellRulesInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <><Upload className="w-4 h-4 mr-2 animate-pulse" />Uploading...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" />Upload Image</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Banner images */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  Home Banner Images
                </CardTitle>
                <CardDescription>
                  Banners shown in the carousel on the home screen. Recommended
                  size 1200×400. Click <b>Add Banner</b> to upload an image.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {bannerImages.length === 0 ? (
                  <div className="text-sm text-muted-foreground border-2 border-dashed rounded-md p-8 text-center">
                    No banners yet. Click <b>Add Banner</b> below to upload one.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {bannerImages.map((url, idx) => (
                      <div
                        key={`${idx}-${url}`}
                        className="border rounded-lg overflow-hidden bg-white shadow-sm flex flex-col"
                      >
                        <div className="aspect-[3/1] bg-muted flex items-center justify-center overflow-hidden">
                          {url ? (
                            <img
                              src={url}
                              alt={`Banner ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-8 h-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="p-3 flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold">
                            Banner {idx + 1}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setBannerImages((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickBanner(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Upload className="w-4 h-4 mr-2 animate-pulse" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" /> Add Banner
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" size="lg" disabled={updateMut.isPending}>
                {updateMut.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
