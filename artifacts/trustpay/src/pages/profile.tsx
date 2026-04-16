import React from "react";
import { useGetMe, useGetAppSettings, useLogout } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { clearAuthToken } from "@/lib/auth";
import logoPath from "@assets/file_00000000da60720ba5a8a74acd96c937_1776335785514.png";
import { Headset, LogOut, ChevronRight, TrendingUp, Wallet, ArrowDownCircle, ArrowUpCircle, Phone } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetMe();
  const { data: settings } = useGetAppSettings();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        clearAuthToken();
        queryClient.clear();
        toast({ title: "Logged out successfully" });
        setLocation("/login");
      }
    });
  };

  const handleContactSupport = () => {
    const link = (settings as any)?.telegramLink;
    if (link) {
      window.open(link, "_blank");
    } else {
      toast({ title: "Support link not available", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  const displayName = user?.phone || user?.username || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  // Compute estimated rewards: balance + withdrawals - deposits (net reward added)
  const estimatedRewards = Math.max(
    0,
    (user?.balance || 0) + (user?.totalWithdrawals || 0) - (user?.totalDeposits || 0)
  );

  const stats = [
    {
      label: "Current Balance",
      value: `₹ ${user?.balance?.toFixed(2) || "0.00"}`,
      icon: <Wallet className="w-5 h-5 text-blue-500" />,
      color: "bg-blue-50 border-blue-100",
    },
    {
      label: "Total Deposited (Buy)",
      value: `₹ ${user?.totalDeposits?.toFixed(2) || "0.00"}`,
      icon: <ArrowDownCircle className="w-5 h-5 text-green-500" />,
      color: "bg-green-50 border-green-100",
    },
    {
      label: "Total Rewards Earned",
      value: `₹ ${estimatedRewards.toFixed(2)}`,
      icon: <TrendingUp className="w-5 h-5 text-yellow-500" />,
      color: "bg-yellow-50 border-yellow-100",
    },
    {
      label: "Total Withdrawn (Sell)",
      value: `₹ ${user?.totalWithdrawals?.toFixed(2) || "0.00"}`,
      icon: <ArrowUpCircle className="w-5 h-5 text-red-500" />,
      color: "bg-red-50 border-red-100",
    },
  ];

  return (
    <Layout>
      {/* Header */}
      <div className="bg-primary pt-10 pb-20 px-4 text-primary-foreground">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary-foreground/20">
            <AvatarFallback className="bg-primary-foreground/10 text-xl text-white font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold">{displayName}</h2>
            <div className="flex items-center gap-1 text-primary-foreground/70 text-sm mt-1">
              <Phone className="w-3 h-3" />
              <span>+91 {user?.phone || user?.username}</span>
            </div>
            <p className="text-primary-foreground/50 text-xs mt-1">User ID: #{user?.id}</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-12 relative z-10 space-y-4">
        {/* Stats Grid */}
        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">Account Statistics</h3>
            <div className="grid grid-cols-2 gap-3">
              {stats.map((stat, i) => (
                <div key={i} className={`rounded-xl p-3 border ${stat.color}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {stat.icon}
                    <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                  </div>
                  <div className="text-lg font-bold">{stat.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-none shadow-md overflow-hidden">
          <div className="divide-y">
            <MenuItem icon={<Headset className="text-blue-500" />} label="Contact Support" onClick={handleContactSupport} />
          </div>
        </Card>

        {/* App Info + Logout */}
        <Card className="border-none shadow-md">
          <div className="p-4 flex items-center justify-center flex-col text-center">
            <img src={logoPath} alt="TrustPay" className="w-16 h-16 mb-3 rounded-xl shadow-sm" />
            <h3 className="font-bold text-lg">TrustPay</h3>
            <p className="text-xs text-muted-foreground mb-4">Version 1.0.0</p>

            <Button
              variant="destructive"
              className="w-full rounded-xl"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {logoutMutation.isPending ? "Logging out..." : "Log Out"}
            </Button>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <div
      className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="bg-muted p-2 rounded-lg">{icon}</div>
        <span className="font-medium text-sm">{label}</span>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </div>
  );
}
