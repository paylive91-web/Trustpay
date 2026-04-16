import React from "react";
import BottomNav from "./bottom-nav";

interface LayoutProps {
  children: React.ReactNode;
  showBottomNav?: boolean;
}

export default function Layout({ children, showBottomNav = true }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] w-full bg-muted/30 flex justify-center">
      <div className="w-full max-w-[430px] bg-background min-h-[100dvh] shadow-xl relative flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto pb-20">
          {children}
        </div>
        {showBottomNav && <BottomNav />}
      </div>
    </div>
  );
}
