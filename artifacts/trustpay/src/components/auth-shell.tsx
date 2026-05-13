import React from "react";
import { useGetAppSettings } from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { ShieldCheck } from "lucide-react";
import { assetUrl } from "@/lib/api-config";

const logoPath = `${import.meta.env.BASE_URL}trustpay-logo.png`;

export function useBranding() {
  const { data: settings } = useGetAppSettings();
  const appName = (settings as any)?.appName || "TrustPay";
  const logoUrl = assetUrl((settings as any)?.appLogoUrl) || logoPath;
  return { appName, logoUrl };
}

/**
 * AuthShell — light orange+blue theme matching the home page.
 * Used by login / register / forgot-password pages.
 */
export function AuthShell({
  children,
  badge = "Secure UPI Platform",
}: {
  children: React.ReactNode;
  badge?: string;
}) {
  const { appName, logoUrl } = useBranding();
  return (
    <Layout showBottomNav={false}>
      <div className="relative min-h-[100svh] w-full overflow-hidden flex flex-col"
        style={{ background: "linear-gradient(160deg, #fff7ed 0%, #ffffff 45%, #eff6ff 100%)" }}>

        {/* Floating orbs — orange + blue matching home page accent */}
        <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
          <span className="absolute top-[6%] left-[5%] w-52 h-52 rounded-full bg-orange-300/20 blur-3xl animate-[floatA_14s_ease-in-out_infinite]" />
          <span className="absolute top-[50%] right-[4%] w-60 h-60 rounded-full bg-blue-300/15 blur-3xl animate-[floatB_18s_ease-in-out_infinite]" />
          <span className="absolute bottom-[6%] left-[15%] w-48 h-48 rounded-full bg-orange-200/20 blur-3xl animate-[floatC_16s_ease-in-out_infinite]" />
          <span className="absolute top-[30%] left-[40%] w-36 h-36 rounded-full bg-amber-200/15 blur-2xl animate-[floatA_20s_ease-in-out_infinite_2s]" />
        </div>

        <style>{`
          @keyframes floatA { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,-24px)} }
          @keyframes floatB { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-24px,32px)} }
          @keyframes floatC { 0%,100%{transform:translate(0,0)} 50%{transform:translate(16px,-32px)} }
          @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        `}</style>

        <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-5">
          <div className="w-full max-w-[400px]">
            {/* Brand block */}
            <div className="flex flex-col items-center mb-5">
              <div className="relative mb-3">
                {/* Orange glow — no white box, logo transparent */}
                <div className="absolute inset-0 rounded-full bg-orange-400/20 blur-2xl scale-125 animate-pulse" />
                <img
                  src={logoUrl}
                  alt={`${appName} Logo`}
                  className="relative w-[88px] h-[88px] object-contain"
                  style={{ filter: "drop-shadow(0 6px 18px rgba(234,88,12,0.25))" }}
                />
              </div>
              <div className="text-[26px] font-extrabold tracking-tight text-slate-900 drop-shadow-sm">
                {appName}
              </div>
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200">
                <ShieldCheck className="w-3 h-3 text-orange-500" />
                <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-orange-600">
                  {badge}
                </span>
              </div>
            </div>

            {/* Card */}
            <div className="relative rounded-[28px] p-[1.5px] bg-gradient-to-br from-orange-200/60 via-white/80 to-blue-200/40 shadow-[0_20px_60px_-10px_rgba(234,88,12,0.15),0_8px_24px_-6px_rgba(59,130,246,0.10)]">
              <div className="rounded-[26px] bg-white/98 backdrop-blur-xl p-5">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

/* ─── Reusable UI bits ──────────────────────────────────────────── */

export function PremiumInputWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="group relative rounded-xl bg-slate-50/80 ring-1 ring-slate-200 transition focus-within:ring-2 focus-within:ring-orange-400/50 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(249,115,22,0.08)]">
      {children}
    </div>
  );
}

export function PremiumButton({
  children,
  disabled,
  type = "submit",
  onClick,
  variant = "primary",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
  variant?: "primary" | "ghost";
}) {
  if (variant === "ghost") {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className="w-full h-11 rounded-xl text-slate-500 text-sm font-medium hover:bg-slate-100 transition"
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="relative group w-full h-12 rounded-xl text-white font-bold tracking-wide overflow-hidden disabled:opacity-60 disabled:pointer-events-none active:scale-[0.99] transition"
      style={{
        background: "linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)",
        boxShadow: "0 12px 28px -8px rgba(234,88,12,0.50), 0 4px 10px -4px rgba(249,115,22,0.30), inset 0 1px 0 rgba(255,255,255,0.18)",
      }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-[-20deg] group-hover:animate-[shimmer_1.2s_ease-out]"
      />
      <span className="relative flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}

export function TrustRow() {
  const items = [
    { dot: "bg-emerald-500", label: "256-bit Encrypted" },
    { dot: "bg-orange-500", label: "10K+ Traders" },
  ];
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${i.dot}`} />
          <span className="text-[10.5px] font-semibold text-slate-500 tracking-wide">{i.label}</span>
        </div>
      ))}
    </div>
  );
}
