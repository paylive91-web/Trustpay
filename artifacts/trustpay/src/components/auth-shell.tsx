import React from "react";
import { useGetAppSettings } from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { ShieldCheck } from "lucide-react";

const logoPath = `${import.meta.env.BASE_URL}trustpay-logo.png`;

export function useBranding() {
  const { data: settings } = useGetAppSettings();
  const appName = (settings as any)?.appName || "TrustPay";
  const logoUrl = (settings as any)?.appLogoUrl || logoPath;
  return { appName, logoUrl };
}

/**
 * AuthShell — premium dark-mesh background + glass card wrapper used by
 * login / register / forgot-password. The wrapper guarantees the layout
 * fits a single mobile viewport (no scroll on ~700px screens) while still
 * feeling spacious on tablets/desktops.
 *
 * Why dark hero + white glass card: this is the proven premium fintech
 * pattern (CRED, Razorpay, Stripe). The dark mesh provides depth, the
 * floating orbs add motion, and the white glass card keeps the form area
 * highly readable.
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
      <div className="relative min-h-[100svh] w-full overflow-hidden bg-[#0b0820] flex flex-col">
        {/* Mesh gradient base — layered radial gradients build a rich, premium
            backdrop that no single gradient can match. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(1000px 700px at 10% -10%, rgba(99,102,241,0.55), transparent 60%)," +
              "radial-gradient(900px 600px at 110% 10%, rgba(217,70,239,0.45), transparent 60%)," +
              "radial-gradient(800px 600px at 50% 110%, rgba(56,189,248,0.35), transparent 60%)," +
              "linear-gradient(180deg, #0b0820 0%, #120a30 50%, #0b0820 100%)",
          }}
        />

        {/* Floating orbs — slow, calming motion adds life without distracting */}
        <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
          <span className="absolute top-[12%] left-[8%] w-40 h-40 rounded-full bg-indigo-500/30 blur-3xl animate-[floatA_14s_ease-in-out_infinite]" />
          <span className="absolute top-[55%] right-[6%] w-52 h-52 rounded-full bg-fuchsia-500/25 blur-3xl animate-[floatB_18s_ease-in-out_infinite]" />
          <span className="absolute bottom-[8%] left-[20%] w-44 h-44 rounded-full bg-cyan-400/25 blur-3xl animate-[floatC_16s_ease-in-out_infinite]" />
        </div>

        {/* Subtle dot grid for premium texture */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        {/* Inline animation keyframes — small enough to live with the shell */}
        <style>{`
          @keyframes floatA { 0%,100%{transform:translate(0,0)} 50%{transform:translate(40px,-30px)} }
          @keyframes floatB { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-30px,40px)} }
          @keyframes floatC { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,-40px)} }
          @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        `}</style>

        <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-5">
          <div className="w-full max-w-[400px]">
            {/* Brand block */}
            <div className="flex flex-col items-center mb-5">
              <div className="relative mb-3">
                {/* multi-ring glow stack — the soul of the premium look */}
                <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 blur-2xl opacity-70 scale-125 animate-pulse" />
                <div className="absolute -inset-1 rounded-[30px] bg-gradient-to-br from-indigo-300/60 via-violet-400/60 to-fuchsia-400/60 blur-md" />
                <div className="relative rounded-[26px] p-[2px] bg-gradient-to-br from-white/40 via-white/20 to-white/5">
                  <img
                    src={logoUrl}
                    alt={`${appName} Logo`}
                    className="relative w-[68px] h-[68px] rounded-[24px] object-contain bg-white shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                  />
                </div>
              </div>
              <div className="text-[26px] font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-fuchsia-200 drop-shadow-sm">
                {appName}
              </div>
              <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md">
                <ShieldCheck className="w-3 h-3 text-emerald-300" />
                <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-white/85">
                  {badge}
                </span>
              </div>
            </div>

            {/* Glass card with gradient border */}
            <div className="relative rounded-[28px] p-[1.5px] bg-gradient-to-br from-white/40 via-white/10 to-white/30 shadow-[0_30px_80px_-20px_rgba(99,66,237,0.55),0_10px_30px_-10px_rgba(217,70,239,0.35)]">
              <div className="rounded-[26px] bg-white/95 backdrop-blur-2xl p-5">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

/* ─── Premium reusable bits ──────────────────────────────────────────── */

export function PremiumInputWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="group relative rounded-xl bg-slate-50/70 ring-1 ring-slate-200 transition focus-within:ring-2 focus-within:ring-indigo-500/40 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.08)]">
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
        background:
          "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #c026d3 100%)",
        boxShadow:
          "0 14px 30px -10px rgba(124,58,237,0.55), 0 6px 12px -4px rgba(192,38,211,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
      }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg] group-hover:animate-[shimmer_1.2s_ease-out]"
      />
      <span className="relative flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}

export function TrustRow() {
  const items = [
    { dot: "bg-emerald-500", label: "256-bit Encrypted" },
    { dot: "bg-indigo-500", label: "10K+ Traders" },
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
