import React, { useEffect, useState } from "react";
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

function BannerImageEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { toast } = useToast();
  const uploadMut = useAdminUploadImage();
  const onPick = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5 MB", variant: "destructive" });
      return;
    }
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
    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-3 items-start">
      <div className="w-full md:w-40 h-24 rounded-md border bg-white flex items-center justify-center overflow-hidden shrink-0">
        {value ? (
          <img src={value} alt="banner preview" className="w-full h-full object-cover" />
        ) : (
          <div className="text-muted-foreground text-xs flex flex-col items-center gap-1">
            <ImageIcon className="w-5 h-5" />
            No image
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Image URL</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or upload below"
        />
        <label className="inline-flex items-center gap-2 px-3 py-1.5 border rounded text-xs cursor-pointer hover:bg-muted">
          <Upload className="w-3 h-3" /> {busy ? "Uploading..." : "Upload from device"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] || null)}
          />
        </label>
      </div>
    </div>
  );
}

export default function AdminLinksMedia() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    data: settings,
    isLoading,
    isError,
  } = useAdminGetSettings({ query: { retry: false, refetchOnWindowFocus: false } });

  const [telegramLink, setTelegramLink] = useState("");
  const [bannerImages, setBannerImages] = useState<string[]>([]);

  useEffect(() => {
    if (settings) {
      setTelegramLink((settings as any).telegramLink || "");
      setBannerImages(
        Array.isArray((settings as any).bannerImages) ? (settings as any).bannerImages : []
      );
    }
  }, [settings]);

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

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMut.mutate({
      data: {
        telegramLink,
        // strip empty banners on save so DB only stores real images
        bannerImages: bannerImages.map((u) => u.trim()).filter(Boolean),
      } as any,
    });
  };

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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  Home Banner Images
                </CardTitle>
                <CardDescription>
                  Banners shown in the carousel on the home screen. Recommended size 1200×400.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {bannerImages.length === 0 && (
                  <div className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
                    No banners yet — click <b>Add Banner</b> below.
                  </div>
                )}
                {bannerImages.map((url, idx) => (
                  <div
                    key={idx}
                    className="border rounded-lg p-4 bg-muted/30 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Banner {idx + 1}</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setBannerImages((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Remove
                      </Button>
                    </div>
                    <BannerImageEditor
                      value={url}
                      onChange={(v) =>
                        setBannerImages((prev) =>
                          prev.map((u, i) => (i === idx ? v : u))
                        )
                      }
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBannerImages((prev) => [...prev, ""])}
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Banner
                </Button>
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
