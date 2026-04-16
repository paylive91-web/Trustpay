import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import AdminLayout from "@/components/admin-layout";
import { useAdminGetSettings, useAdminUpdateSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminGetSettingsQueryKey } from "@workspace/api-client-react";

const settingsSchema = z.object({
  upiId: z.string().min(1, "UPI ID is required"),
  upiName: z.string().min(1, "UPI Name is required"),
  popupMessage: z.string().optional(),
  popupImageUrl: z.string().optional(),
  telegramLink: z.string().optional(),
  bannerImages: z.string().optional(), // Comma separated
  adminPassword: z.string().optional(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useAdminGetSettings();
  const updateSettingsMutation = useAdminUpdateSettings();

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      upiId: "",
      upiName: "",
      popupMessage: "",
      popupImageUrl: "",
      telegramLink: "",
      bannerImages: "",
      adminPassword: "",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        upiId: settings.upiId || "",
        upiName: settings.upiName || "",
        popupMessage: settings.popupMessage || "",
        popupImageUrl: settings.popupImageUrl || "",
        telegramLink: settings.telegramLink || "",
        bannerImages: settings.bannerImages ? settings.bannerImages.join(",") : "",
        adminPassword: "",
      });
    }
  }, [settings, form]);

  const onSubmit = (data: SettingsValues) => {
    const payload: any = {
      ...data,
      bannerImages: data.bannerImages ? data.bannerImages.split(",").map(s => s.trim()).filter(Boolean) : [],
    };
    
    if (!payload.adminPassword) {
      delete payload.adminPassword;
    }

    updateSettingsMutation.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "Settings updated successfully" });
        queryClient.invalidateQueries({ queryKey: getAdminGetSettingsQueryKey() });
        form.setValue("adminPassword", "");
      },
      onError: (err) => {
        toast({ title: "Error updating settings", description: err.error || "Unknown error", variant: "destructive" });
      }
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-4 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">App Settings</h1>
          <p className="text-muted-foreground">Configure payment details, announcements, and links.</p>
        </div>

        {isLoading ? (
          <Skeleton className="h-[500px] w-full rounded-xl" />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Payment Configuration</CardTitle>
                  <CardDescription>Main UPI account where users will deposit funds.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="upiId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deposit UPI ID</FormLabel>
                        <FormControl>
                          <Input placeholder="admin@upi" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="upiName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UPI Display Name</FormLabel>
                        <FormControl>
                          <Input placeholder="TrustPay Official" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Announcement Popup</CardTitle>
                  <CardDescription>Shown to users when they open the app.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="popupMessage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message Content</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Welcome to TrustPay..." className="min-h-[100px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="popupImageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Image URL (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/image.png" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Links & Media</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="telegramLink"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Support Telegram Link</FormLabel>
                        <FormControl>
                          <Input placeholder="https://t.me/..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bannerImages"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Home Banner Images (Comma separated URLs)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="https://img1.jpg, https://img2.jpg" {...field} />
                        </FormControl>
                        <FormDescription>These images will appear in the top carousel on the home page.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="text-red-600">Security</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="adminPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Change Admin Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Leave blank to keep current password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button type="submit" size="lg" disabled={updateSettingsMutation.isPending}>
                  {updateSettingsMutation.isPending ? "Saving..." : "Save All Settings"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </AdminLayout>
  );
}
