import React, { useEffect, useState } from "react";
import { useGetMe, useGetAppSettings } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import Layout from "@/components/layout";
import AppStartupPopup from "@/components/app-startup-popup";
import DisputePauseBanner from "@/components/dispute-pause-banner";
import NotificationsBell from "@/components/notifications-bell";
import logoPath from "@assets/file_00000000da60720ba5a8a74acd96c937_1776335785514.png";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownCircle, ArrowUpCircle, ChevronRight, Download, Link as LinkIcon, ShieldAlert, ShieldCheck, Wallet } from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { Skeleton } from "@/components/ui/skeleton";
import useEmblaCarousel from "embla-carousel-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

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

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetMe({ query: { queryKey: ["me"], retry: false } });
  const { data: settings } = useGetAppSettings();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const { toast } = useToast();

  const { isInstallable, handleInstall } = useInstallPrompt();

  const { data: upiList = [] } = useQuery({
    queryKey: ["upi"],
    queryFn: () => api("/upi"),
    enabled: !!user,
  });

  useEffect(() => {
    if (isError) setLocation("/login");
  }, [isError, setLocation]);

  // Heartbeat is now sent globally from <Layout /> on every authenticated page.

  // Auto-advance banner carousel every 4 seconds
  useEffect(() => {
    if (!emblaApi) return;
    const t = setInterval(() => emblaApi.scrollNext(), 4000);
    return () => clearInterval(t);
  }, [emblaApi]);

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }
  if (!user) return null;

  const activeUpiList = Array.isArray(upiList) ? (upiList as any[]).filter((u: any) => u.isActive) : [];
  const hasUpi = activeUpiList.length > 0;
  const displayName = user.phone || user.username;
  const trustScore = (user as any).trustScore ?? 0;
  const isFrozen = (user as any).isFrozen;
  const balance = Number((user as any)?.balance ?? 0);
  const buyRules = (settings as any)?.buyRules || "";
  const sellRules = (settings as any)?.sellRules || "";

  return (
    <Layout>
      <AppStartupPopup />
      <div className="px-4 pt-3"><DisputePauseBanner /></div>

      <div className="bg-gradient-to-r from-primary via-primary to-sky-600 text-primary-foreground px-4 pt-3 pb-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-xl p-1.5 shadow-sm">
              <img src={(settings as any)?.appLogoUrl || logoPath} alt={(settings as any)?.appName || "TrustPay"} className="w-8 h-8 rounded object-contain" />
            </div>
            <div>
              <div className="font-bold text-[19px] leading-none">{(settings as any)?.appName || "TrustPay"}</div>
              <div className="text-[11px] text-white/80 mt-1">Secure P2P UPI trading</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[11px] text-white/80">Hello,</div>
              <div className="text-sm font-semibold leading-none">{displayName}</div>
            </div>
            {isInstallable && (
              <button
                type="button"
                aria-label="Install App"
                onClick={handleInstall}
                className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
                title="Download App"
              >
                <Download className="h-5 w-5" />
              </button>
            )}
            <NotificationsBell />
          </div>
        </div>
      </div>

      {settings?.bannerImages && settings.bannerImages.length > 0 && (
        <div className="px-4 -mt-3">
          <div className="overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5" ref={emblaRef}>
            <div className="flex">
              {settings.bannerImages.map((img, i) => (
                <div className="flex-[0_0_100%] min-w-0 relative" key={i}>
                  <img src={img} alt={`Banner ${i}`} className="w-full h-36 sm:h-44 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-black/10" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-3 sm:px-4 py-4 space-y-3 sm:space-y-4">
        {isFrozen && (
          <Card className="border-red-500/30 bg-gradient-to-r from-red-50 to-red-100 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldAlert className="text-red-600 h-6 w-6" />
              <div className="text-sm text-red-700">
                Your account is frozen due to low trust score. Contact support to resolve.
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-xl border-none bg-gradient-to-br from-card via-white to-sky-50 overflow-hidden">
          <CardContent className="p-0">
            <div className="p-4 sm:p-5 pb-4 bg-gradient-to-r from-primary/5 to-sky-500/10">
              <div className="flex items-center justify-between mb-4 gap-3">
                <div>
                  <div className="text-muted-foreground text-sm">My Total Assets</div>
                  <div className="text-3xl sm:text-4xl font-bold tracking-tight">₹ {balance.toFixed(2)}</div>
                </div>
                <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Trust Score: <span className={trustScore >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>{trustScore}</span></span>
              </div>
            </div>

            <div className="p-4 sm:p-5 pt-0">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <Link href="/buy" className="w-full">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground min-h-12 sm:min-h-13 text-base rounded-2xl shadow-md">
                    <ArrowDownCircle className="mr-2 h-5 w-5" />
                    BUY
                  </Button>
                </Link>
                <Link href="/sell" className="w-full">
                  <Button
                    className="w-full min-h-12 sm:min-h-13 text-base rounded-2xl shadow-md bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white"
                  >
                    <ArrowUpCircle className="mr-2 h-5 w-5" />
                    SELL
                  </Button>
                </Link>
              </div>
              {hasUpi ? (
                <div className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-[11px] sm:text-xs text-emerald-700 flex items-center justify-between gap-2">
                  <span>{activeUpiList.length} UPI linked & ready</span>
                  <Link href="/upi" className="font-medium underline">Manage</Link>
                </div>
              ) : (
                <Link href="/upi" className="block">
                  <div className="mt-3 rounded-2xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] sm:text-xs text-amber-800 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5"><LinkIcon className="w-3.5 h-3.5" /> No UPI linked yet</span>
                    <span className="font-medium underline">Connect UPI</span>
                  </div>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-primary">My Orders</h3>
              <p className="text-sm text-muted-foreground">Buy & sell rules</p>
            </div>
            <Link href="/orders">
              <Button variant="outline" size="sm" className="rounded-full gap-1">View <ChevronRight className="h-4 w-4" /></Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-secondary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-secondary">My Sell Queue</h3>
              <p className="text-sm text-muted-foreground">Quick rules & support</p>
            </div>
            <Link href="/sell">
              <Button variant="outline" size="sm" className="rounded-full gap-1">Open <ChevronRight className="h-4 w-4" /></Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Buy Rules</h3>
                <p className="text-sm text-muted-foreground">Tap to view full page</p>
              </div>
              <Link href="/info#buy">
                <Button variant="outline" size="sm" className="rounded-full gap-1">Open <ChevronRight className="h-4 w-4" /></Button>
              </Link>
            </div>
            {buyRules && <div className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{buyRules}</div>}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Sell Rules</h3>
                <p className="text-sm text-muted-foreground">Tap to view full page</p>
              </div>
              <Link href="/info#sell">
                <Button variant="outline" size="sm" className="rounded-full gap-1">Open <ChevronRight className="h-4 w-4" /></Button>
              </Link>
            </div>
            {sellRules && <div className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{sellRules}</div>}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
