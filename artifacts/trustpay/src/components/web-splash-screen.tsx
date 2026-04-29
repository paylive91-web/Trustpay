import { useEffect, useState } from "react";
import logoPath from "@assets/trustpay-logo-transparent.png";

export function WebSplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);
  const [logoReady, setLogoReady] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2000);
    const doneTimer = setTimeout(() => onDone(), 2600);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at 50% 20%, rgba(160,100,255,0.55) 0%, transparent 55%), linear-gradient(180deg, #3b0f7a 0%, #5b21b6 50%, #4c1d95 100%)",
        transition: "opacity 0.6s ease",
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "all",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes splashProgress {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes logoIn {
          0%  { opacity: 0; transform: scale(0.8); }
          70% { transform: scale(1.04); }
          100%{ opacity: 1; transform: scale(1); }
        }
        @keyframes glowPulse {
          0%,100% { opacity: 0.55; transform: scale(1) translateX(-50%); }
          50%     { opacity: 0.75; transform: scale(1.08) translateX(-50%); }
        }
      `}</style>

      {/* Background glow */}
      <div style={{
        position: "absolute", top: "-10%", left: "50%",
        transform: "translateX(-50%)",
        width: 480, height: 380, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(167,139,250,0.35) 0%, transparent 68%)",
        animation: "glowPulse 5s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* Main content */}
      <div style={{
        position: "relative",
        textAlign: "center",
        animation: "floatIn 0.7s cubic-bezier(0.22,1,0.36,1) both",
      }}>
        {/* Logo — transparent, no box */}
        <div style={{
          width: 150, height: 150,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 26px",
          animation: "logoIn 0.8s cubic-bezier(0.22,1,0.36,1) both",
          position: "relative",
        }}>
          {/* Soft glow ring behind logo */}
          <div style={{
            position: "absolute", inset: -10,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)",
            filter: "blur(12px)",
          }} />
          <img
            src={logoPath}
            alt="TrustPay"
            onLoad={() => setLogoReady(true)}
            style={{
              width: 140, height: 140,
              objectFit: "contain",
              opacity: logoReady ? 1 : 0,
              transition: "opacity 0.3s ease",
              position: "relative",
              zIndex: 1,
              filter: "drop-shadow(0 8px 24px rgba(99,102,241,0.55)) drop-shadow(0 2px 8px rgba(0,0,0,0.4))",
            }}
          />
        </div>

        {/* App name */}
        <h1 style={{
          color: "#fff",
          fontSize: 38,
          fontWeight: 800,
          margin: "0 0 8px",
          letterSpacing: "-0.8px",
          fontFamily: "Inter, system-ui, sans-serif",
          textShadow: "0 4px 28px rgba(139,92,246,0.7)",
          lineHeight: 1,
        }}>
          TrustPay
        </h1>

        {/* Tagline */}
        <p style={{
          color: "rgba(196,181,253,0.85)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "3px",
          margin: "0 0 40px",
          fontFamily: "Inter, system-ui, sans-serif",
          textTransform: "uppercase",
        }}>
          Secure P2P UPI Trading
        </p>

        {/* Progress bar */}
        <div style={{
          width: 110, height: 3,
          borderRadius: 999,
          background: "rgba(255,255,255,0.12)",
          overflow: "hidden",
          margin: "0 auto",
        }}>
          <div style={{
            width: "100%", height: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, #a78bfa, #7c3aed, #c4b5fd)",
            transformOrigin: "left center",
            animation: "splashProgress 2s cubic-bezier(0.4,0,0.2,1) forwards",
            boxShadow: "0 0 10px rgba(167,139,250,0.8)",
          }} />
        </div>
      </div>

      {/* Bottom */}
      <div style={{
        position: "absolute", bottom: 36,
        color: "rgba(167,139,250,0.35)",
        fontSize: 10,
        letterSpacing: "2px",
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 500,
        textTransform: "uppercase",
      }}>
        Powered by TrustPay
      </div>
    </div>
  );
}
