import React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, ListOrdered, Settings, CreditCard, LogOut } from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { clearAuthToken } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import logoPath from "@assets/file_00000000da60720ba5a8a74acd96c937_1776335785514.png";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      setLocation("/admin");
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
        setLocation("/admin");
      }
    });
  };

  const navItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/orders", label: "Orders", icon: ListOrdered },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/deposit-tasks", label: "Deposit Tasks", icon: CreditCard },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col shadow-xl z-10 hidden md:flex">
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
          <img src={logoPath} alt="TrustPay Admin" className="w-8 h-8 bg-white p-1 rounded" />
          <span className="font-bold text-lg">TrustPay Admin</span>
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
                  {item.label}
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
            <img src={logoPath} alt="TrustPay" className="w-6 h-6" />
            <span className="font-bold">Admin</span>
          </div>
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
