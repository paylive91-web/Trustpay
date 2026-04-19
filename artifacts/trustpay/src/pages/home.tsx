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
import { ArrowDownCircle, BookOpen, HelpCircle, Link as LinkIcon, ShieldAlert, ShieldCheck, User as UserIcon } from "lucide-react";
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
  const { data: user, isLoading, isError } = useGetMe({ query: { retry: false } });
  const { data: settings } = useGetAppSettings();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const { toast } = useToast();

  const [showBuyRules, setShowBuyRules] = useState(false);
  const [showSellRules, setShowSellRules] = useState(false);

  const { data: upiList = [] } = useQuery({
    queryKey: ["upi"],
    queryFn: () => api("/upi"),
    enabled: !!user,
  });

  useEffect(() => {
    if (isError) setLocation("/login");
  }, [isError, setLocation]);

  // Heartbeat: update lastSeenAt every 30s
  useEffect(() => {
    if (!user) return;
    const ping = () => api("/auth/heartbeat", { method: "POST" }).catch(() => {});
    ping();
    const t = setInterval(ping, 30_000);
    return () => clearInterval(t);
  }, [user]);

  // Auto-advance banner carousel every 4 seconds
  useEffect(() => {
    if (!emblaApi) return;
    const t = setInterval(() => emblaApi.scrollNext(), 4000);
    return () => clearInterval(t);
  }, [emblaApi]);

  const handleHelpCenter = () => {
    const link = (settings as any)?.telegramLink;
    if (link) window.open(link, "_blank");
  };

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

  const activeUpiList = (upiList as any[]).filter((u: any) => u.isActive);
  const hasUpi = activeUpiList.length > 0;
  const displayName = user.phone || user.username;
  const trustScore = (user as any).trustScore ?? 0;
  const isFrozen = (user as any).isFrozen;

  return (
    <Layout>
      <AppStartupPopup />
      <div className="px-4 pt-3"><DisputePauseBanner /></div>

      <div className="flex items-center justify-between p-4 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <img src={logoPath} alt="TrustPay" className="w-8 h-8 rounded bg-white p-1" />
          <span className="font-bold text-lg">TrustPay</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium">Hello, {displayName}</span>
          <NotificationsBell />
        </div>
      </div>

      {settings?.bannerImages && settings.bannerImages.length > 0 && (
        <div className="overflow-hidden bg-muted/20" ref={emblaRef}>
          <div className="flex">
            {settings.bannerImages.map((img, i) => (
              <div className="flex-[0_0_100%] min-w-0" key={i}>
                <img src={img} alt={`Banner ${i}`} className="w-full h-40 object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 space-y-4 -mt-4 relative z-10">
        {isFrozen && (
          <Card className="border-red-500 bg-red-50">
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldAlert className="text-red-600 h-6 w-6" />
              <div className="text-sm text-red-700">
                Your account is frozen due to low trust score. Contact support to resolve.
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-lg border-none bg-gradient-to-br from-card to-muted">
          <CardContent className="p-6">
            <div className="text-muted-foreground text-sm mb-1">My Total Assets</div>
            <div className="text-3xl font-bold">₹ {user.balance.toFixed(2)}</div>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Trust Score: <span className={trustScore >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>{trustScore}</span></span>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <Link href="/buy" className="w-full">
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-lg rounded-xl shadow-md">
                  <ArrowDownCircle className="mr-2 h-5 w-5" />
                  BUY
                </Button>
              </Link>
              <Link href="/upi" className="w-full">
                <Button
                  className={`w-full h-12 text-lg rounded-xl shadow-md ${hasUpi ? "bg-green-600 hover:bg-green-700 text-white" : "bg-secondary hover:bg-secondary/90 text-secondary-foreground"}`}
                >
                  <LinkIcon className="mr-2 h-5 w-5" />
                  {hasUpi ? "UPI Linked" : "Connect UPI"}
                </Button>
              </Link>
            </div>
            {hasUpi && (
              <div className="mt-3 text-xs text-center text-muted-foreground">
                Auto-Sell is ON · {activeUpiList[0]?.upiId}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-4 gap-2 py-2">
          <QuickAction icon={<BookOpen className="text-primary" />} label="Buy Rules" onClick={() => setShowBuyRules(true)} />
          <QuickAction icon={<ShieldAlert className="text-secondary" />} label="Sell Rules" onClick={() => setShowSellRules(true)} />
          <QuickAction icon={<HelpCircle className="text-primary" />} label="Help Center" onClick={handleHelpCenter} />
          <Link href="/profile">
            <QuickAction icon={<UserIcon className="text-secondary" />} label="Profile" />
          </Link>
        </div>

        <Card className="border-none shadow-sm bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-primary">My Orders</h3>
              <p className="text-sm text-muted-foreground">Buys, sells & disputes</p>
            </div>
            <Link href="/orders">
              <Button variant="outline" size="sm" className="rounded-full">View</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-secondary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-secondary">My Sell Queue</h3>
              <p className="text-sm text-muted-foreground">See active orders & pending confirmations</p>
            </div>
            <Link href="/sell">
              <Button variant="outline" size="sm" className="rounded-full">Open</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showBuyRules} onOpenChange={setShowBuyRules}>
        <DialogContent className="max-w-[380px] rounded-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary" />Buy Rules</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {(settings as any)?.buyRules ? (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{(settings as any).buyRules}</div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No buy rules configured yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSellRules} onOpenChange={setShowSellRules}>
        <DialogContent className="max-w-[380px] rounded-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-secondary" />Sell Rules</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {(settings as any)?.sellRules ? (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{(settings as any).sellRules}</div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No sell rules configured yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 cursor-pointer" onClick={onClick}>
      <div className="w-12 h-12 rounded-full bg-card shadow-sm border flex items-center justify-center">{icon}</div>
      <span className="text-xs text-center font-medium">{label}</span>
    </div>
  );
}
