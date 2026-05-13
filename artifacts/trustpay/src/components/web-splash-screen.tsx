import { useEffect, useState } from "react";
import { useGetAppSettings } from "@workspace/api-client-react";
import { assetUrl } from "@/lib/api-config";

const logoPath = `${import.meta.env.BASE_URL}trustpay-logo.png`;

export function WebSplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const { data: settings } = useGetAppSettings();
  const appName = (settings as any)?.appName || "TrustPay";
  const logoUrl = assetUrl((settings as any)?.appLogoUrl) || logoPath;

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2200);
    const doneTimer = setTimeout(() => onDone(), 2800);
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
        background: "linear-gradient(160deg, #fff7ed 0%, #ffffff 45%, #eff6ff 100%)",
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
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes logoIn {
          0%  { opacity: 0; transform: scale(0.78); }
          65% { transform: scale(1.05); }
          100%{ opacity: 1; transform: scale(1); }
        }
        @keyframes glowPulse {
          0%,100% { opacity: 0.5; transform: scale(1) translateX(-50%); }
          50%     { opacity: 0.75; transform: scale(1.1) translateX(-50%); }
        }
        @keyframes orbFloat {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-18px); }
        }
      `}</style>

      {/* Background orbs */}
      <div style={{
        position: "absolute", top: "8%", left: "10%",
        width: 220, height: 220, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(251,146,60,0.18) 0%, transparent 70%)",
        animation: "orbFloat 7s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "10%", right: "8%",
        width: 180, height: 180, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
        animation: "orbFloat 9s ease-in-out infinite 1s",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "50%", left: "5%",
        width: 120, height: 120, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(234,88,12,0.1) 0%, transparent 70%)",
        animation: "orbFloat 11s ease-in-out infinite 0.5s",
        pointerEvents: "none",
      }} />

      {/* Main content */}
      <div style={{
        position: "relative",
        textAlign: "center",
        animation: "floatIn 0.7s cubic-bezier(0.22,1,0.36,1) both",
      }}>
        {/* Logo — transparent, no white box */}
        <div style={{ position: "relative", width: 148, height: 148, margin: "0 auto 20px" }}>
          <div style={{
            position: "absolute", inset: -16,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(251,146,60,0.30) 0%, transparent 70%)",
            animation: "glowPulse 3.5s ease-in-out infinite",
          }} />
          <img
            src={logoUrl}
            alt={appName}
            onLoad={() => setLogoReady(true)}
            style={{
              width: 148, height: 148,
              objectFit: "contain",
              opacity: logoReady ? 1 : 0,
              transition: "opacity 0.3s ease",
              animation: "logoIn 0.85s cubic-bezier(0.22,1,0.36,1) both",
              position: "relative",
              filter: "drop-shadow(0 8px 24px rgba(234,88,12,0.22))",
            }}
          />
        </div>

        {/* App name */}
        <h1 style={{
          color: "#0f172a",
          fontSize: 36,
          fontWeight: 800,
          margin: "0 0 6px",
          letterSpacing: "-0.8px",
          fontFamily: "Inter, system-ui, sans-serif",
          lineHeight: 1,
        }}>
          {appName}
        </h1>

        {/* Tagline */}
        <p style={{
          color: "#f97316",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "3px",
          margin: "0 0 38px",
          fontFamily: "Inter, system-ui, sans-serif",
          textTransform: "uppercase",
        }}>
          Secure P2P UPI Trading
        </p>

        {/* Progress bar */}
        <div style={{
          width: 120, height: 3.5,
          borderRadius: 999,
          background: "rgba(234,88,12,0.12)",
          overflow: "hidden",
          margin: "0 auto",
        }}>
          <div style={{
            width: "100%", height: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, #f97316, #ea580c, #fb923c)",
            transformOrigin: "left center",
            animation: "splashProgress 2.2s cubic-bezier(0.4,0,0.2,1) forwards",
            boxShadow: "0 0 10px rgba(249,115,22,0.6)",
          }} />
        </div>
      </div>

      {/* Bottom label */}
      <div style={{
        position: "absolute", bottom: 32,
        color: "rgba(148,163,184,0.8)",
        fontSize: 10,
        letterSpacing: "2.5px",
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 600,
        textTransform: "uppercase",
      }}>
        Powered by {appName}
      </div>
    </div>
  );
}
