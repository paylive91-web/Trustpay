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

  const {
    data: settings,
    isLoading,
    isError,
  } = useAdminGetSettings({ query: { queryKey: getAdminGetSettingsQueryKey(), retry: false, refetchOnWindowFocus: false } });

  const [telegramLink, setTelegramLink] = useState("");
  const [bannerImages, setBannerImages] = useState<string[]>([]);
  const [inviteShareImageUrl, setInviteShareImageUrl] = useState("");

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
  }, [settings]);

  const uploadMut = useAdminUploadImage();
  const updateMut = useAdminUpdateSettings({
    mutation: {
      onSuccess: () => {
        toast({ title: "Saved" });
        queryClient.invalidateQueries({ queryKey: getAdminGetSettingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAppSettingsQueryKey() });
      },
      onError: (e: any) =>
        toast({ title: "Save failed", description: e?.message, variant: "destructive" }),
    },
  });

  const onPickBanner = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5 MB", variant: "destructive" });
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
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5 MB", variant: "destructive" });
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

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMut.mutate({
      data: {
        telegramLink: telegramLink.trim(),
        bannerImages: bannerImages.map((u) => u.trim()).filter(Boolean),
        inviteShareImageUrl: inviteShareImageUrl.trim(),
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
                    <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                      <img
                        src={inviteShareImageUrl}
                        alt="Invite Share Image"
                        className="w-full h-full object-contain"
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
