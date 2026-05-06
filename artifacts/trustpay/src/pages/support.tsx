import React from "react";
import { useGetAppSettings, useLogout, useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { clearAuthToken } from "@/lib/auth";
const logoPath = `${import.meta.env.BASE_URL}trustpay-logo.png`;
import { Headset, LogOut, ChevronRight, Settings, FileText, Bell, Phone } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Support() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const { data: settings } = useGetAppSettings();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        clearAuthToken();
        localStorage.removeItem("popup_seen_session");
        queryClient.clear();
        toast({ title: "Logged out successfully" });
        setLocation("/login");
      },
    });
  };

  const handleContactSupport = () => {
    const link = (settings as any)?.telegramSupportUrl || (settings as any)?.telegramLink;
    if (link) window.open(link, "_blank");
    else toast({ title: "Support link not available", variant: "destructive" });
  };

  const displayName = user?.phone || user?.username || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Layout>
      {/* Header */}
      <div className="relative bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 border-b border-orange-200 pt-8 pb-16 px-4 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-orange-300/20 rounded-full blur-2xl" />
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-orange-300 shadow-md">
            <AvatarFallback className="bg-gradient-to-br from-orange-400 to-rose-500 text-xl text-white font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{displayName}</h2>
            <div className="flex items-center gap-1 text-orange-700/70 text-sm mt-0.5">
              <Phone className="w-3 h-3" />
              <span>ID: {user?.id}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-8 relative z-10 space-y-4 pb-6">
        <Card className="border-none shadow-md overflow-hidden">
          <div className="divide-y divide-orange-50">
            <MenuItem icon={<Headset className="text-orange-500" />} label="Contact Support" onClick={handleContactSupport} />
            <MenuItem icon={<FileText className="text-amber-500" />} label="Terms & Conditions" />
            <MenuItem icon={<Settings className="text-slate-500" />} label="Account Settings" />
            <MenuItem icon={<Bell className="text-violet-500" />} label="Notifications" />
          </div>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-5 flex items-center flex-col text-center">
            <img src={logoPath} alt="TrustPay" className="w-14 h-14 mb-3 rounded-xl shadow-sm" />
            <h3 className="font-bold text-lg text-slate-900">TrustPay</h3>
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
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <div
      className="flex items-center justify-between p-4 hover:bg-orange-50/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="bg-orange-50 border border-orange-100 p-2 rounded-xl">{icon}</div>
        <span className="font-medium text-sm text-slate-800">{label}</span>
      </div>
      <ChevronRight className="w-5 h-5 text-orange-300" />
    </div>
  );
}
