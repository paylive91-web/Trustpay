import React from "react";
import { useGetAppSettings, useLogout, useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { clearAuthToken } from "@/lib/auth";
import logoPath from "@assets/file_00000000da60720ba5a8a74acd96c937_1776335785514.png";
import { Headset, LogOut, ChevronRight, Settings, FileText, Bell } from "lucide-react";
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
      }
    });
  };

  const handleContactSupport = () => {
    if (settings?.telegramLink) {
      window.open(settings.telegramLink, "_blank");
    } else {
      toast({ title: "Support link not available", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="bg-primary pt-8 pb-16 px-4 text-primary-foreground relative">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary-foreground/20">
            <AvatarFallback className="bg-primary-foreground/10 text-xl text-white">
              {user?.username?.substring(0, 2).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold">{user?.username}</h2>
            <p className="text-primary-foreground/70 text-sm">ID: {user?.id}</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-8 relative z-10 space-y-4">
        <Card className="border-none shadow-md overflow-hidden">
          <div className="divide-y">
            <MenuItem icon={<Headset className="text-blue-500" />} label="Contact Support" onClick={handleContactSupport} />
            <MenuItem icon={<FileText className="text-orange-500" />} label="Terms & Conditions" />
            <MenuItem icon={<Settings className="text-gray-500" />} label="Account Settings" />
            <MenuItem icon={<Bell className="text-purple-500" />} label="Notifications" />
          </div>
        </Card>

        <Card className="border-none shadow-md mt-6">
          <div className="p-4 flex items-center justify-center flex-col text-center">
            <img src={logoPath} alt="TrustPay" className="w-16 h-16 mb-4 rounded-xl shadow-sm" />
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

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <div 
      className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="bg-muted p-2 rounded-lg">
          {icon}
        </div>
        <span className="font-medium text-sm">{label}</span>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </div>
  );
}
