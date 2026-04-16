import React, { useEffect } from "react";
import { useGetMe, useGetAppSettings } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import Layout from "@/components/layout";
import AppStartupPopup from "@/components/app-startup-popup";
import logoPath from "@assets/file_00000000da60720ba5a8a74acd96c937_1776335785514.png";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownCircle, ArrowUpCircle, BookOpen, HelpCircle, ShieldAlert, User as UserIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import useEmblaCarousel from "embla-carousel-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetMe({ query: { retry: false } });
  const { data: settings } = useGetAppSettings();
  const [emblaRef] = useEmblaCarousel({ loop: true });

  useEffect(() => {
    if (isError) {
      setLocation("/login");
    }
  }, [isError, setLocation]);

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <AppStartupPopup />
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <img src={logoPath} alt="TrustPay" className="w-8 h-8 rounded bg-white p-1" />
          <span className="font-bold text-lg">TrustPay</span>
        </div>
        <div className="text-sm font-medium">Hello, {user.username}</div>
      </div>

      {/* Banner Carousel */}
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
        {/* Balance Card */}
        <Card className="shadow-lg border-none bg-gradient-to-br from-card to-muted">
          <CardContent className="p-6">
            <div className="text-muted-foreground text-sm mb-1">My Total Assets</div>
            <div className="text-3xl font-bold">₹ {user.balance.toFixed(2)}</div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <Link href="/buy" className="w-full">
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-lg rounded-xl shadow-md">
                  <ArrowDownCircle className="mr-2 h-5 w-5" />
                  BUY
                </Button>
              </Link>
              <Link href="/sell" className="w-full">
                <Button className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground h-12 text-lg rounded-xl shadow-md">
                  <ArrowUpCircle className="mr-2 h-5 w-5" />
                  SELL
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2 py-4">
          <QuickAction icon={<BookOpen className="text-primary" />} label="Buy Rules" />
          <QuickAction icon={<ShieldAlert className="text-secondary" />} label="Sell Rules" />
          <Link href="/support">
            <QuickAction icon={<HelpCircle className="text-primary" />} label="Help Center" />
          </Link>
          <Link href="/support">
            <QuickAction icon={<UserIcon className="text-secondary" />} label="Profile" />
          </Link>
        </div>

        {/* Info Card */}
        <Card className="border-none shadow-sm bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-primary">Active Orders</h3>
              <p className="text-sm text-muted-foreground">Check your pending transactions</p>
            </div>
            <Link href="/orders">
              <Button variant="outline" size="sm" className="rounded-full">View</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 cursor-pointer" onClick={onClick}>
      <div className="w-12 h-12 rounded-full bg-card shadow-sm border flex items-center justify-center">
        {icon}
      </div>
      <span className="text-xs text-center font-medium">{label}</span>
    </div>
  );
}
