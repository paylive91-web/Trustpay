import React from "react";
import { Link, useLocation } from "wouter";
import { Home, ListOrdered, Gift, Info, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Home", icon: Home },
    { href: "/orders", label: "Orders", icon: ListOrdered },
    { href: "/invite", label: "Invite", icon: Gift, center: true },
    { href: "/info", label: "Info", icon: Info },
    { href: "/profile", label: "Me", icon: User },
  ];

  return (
    <div className="absolute bottom-0 w-full bg-card border-t shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-50">
      <div className="flex items-center justify-around h-16 px-2 relative">
        {links.map((link) => {
          const isActive = location === link.href;
          const Icon = link.icon;

          if (link.center) {
            return (
              <Link key={link.href} href={link.href} className="relative -top-6">
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-4 border-background transition-colors",
                  isActive ? "bg-primary/90 text-primary-foreground" : "bg-primary text-primary-foreground"
                )}>
                  <Icon size={24} />
                </div>
              </Link>
            );
          }

          return (
            <Link key={link.href} href={link.href} className="flex flex-col items-center justify-center w-full h-full space-y-1">
              <Icon size={22} className={cn("transition-colors", isActive ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-[10px] font-medium transition-colors", isActive ? "text-primary" : "text-muted-foreground")}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
