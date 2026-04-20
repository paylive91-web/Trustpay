import React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, ListOrdered, Settings, CreditCard, ShieldAlert, LogOut, Eye, AlertTriangle, Download, Link2 } from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useGetMe, useLogout, useGetAppSettings } from "@workspace/api-client-react";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import logoPath from "@assets/file_00000000da60720ba5a8a74acd96c937_1776335785514.png";
import { cn } from "@/lib/utils";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const adminPath = (path: string) => `${BASE}${path}`;

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });
  const { data: brandSettings } = useGetAppSettings();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const isAdmin = !!user && user.role === "admin";

  const { data: criticalCountData } = useQuery({
    queryKey: ["fraud-critical-open-count"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/fraud-alerts?resolved=false`, { headers: { Authorization: `Bearer ${getAuthToken()}` } });
      if (!r.ok) return { count: 0 };
      const rows = await r.json();
      return { count: Array.isArray(rows) ? rows.filter((a: any) => a.severity === "critical").length : 0 };
    },
    refetchInterval: 30000,
    enabled: isAdmin,
  });
  const { isInstallable, handleInstall } = useInstallPrompt();

  React.useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      setLocation(adminPath("/admin"));
    }
  }, [user, isLoading, setLocation]);

  if (isLoading || !user || user.role !== "admin") {
    return null;
  }

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        clearAuthToken();
        queryClient.clear();
        setLocation(adminPath("/admin"));
      }
    });
  };

  const criticalOpen = criticalCountData?.count ?? 0;

  const navItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, badge: 0 },
    { href: "/admin/orders", label: "Orders", icon: ListOrdered, badge: 0 },
    { href: "/admin/disputes", label: "Disputes", icon: ShieldAlert, badge: 0 },
    { href: "/admin/fraud-watch", label: "Fraud Watch", icon: AlertTriangle, badge: criticalOpen },
    { href: "/admin/high-value", label: "High Value", icon: Eye, badge: 0 },
    { href: "/admin/users", label: "Users", icon: Users, badge: 0 },
    { href: "/admin/deposit-tasks", label: "Deposit Tasks", icon: CreditCard, badge: 0 },
    { href: "/admin/settings", label: "Settings", icon: Settings, badge: 0 },
    { href: "/admin/links-media", label: "Links & Media", icon: Link2, badge: 0 },
  ];

  return (
    <div className="flex h-screen bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col shadow-xl z-10 hidden md:flex">
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
          <img src={(brandSettings as any)?.appLogoUrl || logoPath} alt={(brandSettings as any)?.appName || "TrustPay"} className="w-8 h-8 bg-white p-1 rounded object-contain" />
          <span className="font-bold text-lg">{(brandSettings as any)?.appName || "TrustPay"} Admin</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                  location === item.href 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                    : "hover:bg-sidebar-accent/50"
                )}>
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge > 0 && (
                    <Badge variant="destructive" className="text-[10px] h-5 px-1.5">{item.badge}</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="p-4 border-t border-sidebar-border">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-md hover:bg-sidebar-accent/50 transition-colors text-sidebar-foreground/80 hover:text-sidebar-foreground"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile Header */}
        <header className="h-16 bg-card border-b flex items-center justify-between px-4 md:hidden shadow-sm z-20">
          <div className="flex items-center gap-2">
            <img src={(brandSettings as any)?.appLogoUrl || logoPath} alt={(brandSettings as any)?.appName || "TrustPay"} className="w-6 h-6 object-contain" />
            <span className="font-bold">{(brandSettings as any)?.appName || "TrustPay"} Admin</span>
          </div>
          {isInstallable && (
            <button
              type="button"
              aria-label="Install App"
              onClick={handleInstall}
              className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
              title="Download App"
            >
              <Download className="h-5 w-5" />
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 w-full bg-card border-t flex justify-around p-2 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        {navItems.slice(0, 4).map((item) => (
          <Link key={item.href} href={item.href} className={cn(
            "flex flex-col items-center justify-center p-2 rounded-lg",
            location === item.href ? "text-primary" : "text-muted-foreground"
          )}>
            <item.icon className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
