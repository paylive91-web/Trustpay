import { useEffect, useState } from "react";
import logoPath from "@assets/1000279069-removebg-preview_(1)_1777443970849.png";

export function WebSplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);
  const [logoReady, setLogoReady] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2600);
    const doneTimer = setTimeout(() => onDone(), 3200);
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
        background: "linear-gradient(180deg, #0f0528 0%, #1e0a5c 40%, #3b0f9e 75%, #1a0640 100%)",
        transition: "opacity 0.6s ease",
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "all",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes ring1 {
          0%   { transform: scale(1);   opacity: 0.18; }
          50%  { transform: scale(1.12); opacity: 0.08; }
          100% { transform: scale(1);   opacity: 0.18; }
        }
        @keyframes ring2 {
          0%   { transform: scale(1);   opacity: 0.12; }
          50%  { transform: scale(1.18); opacity: 0.05; }
          100% { transform: scale(1);   opacity: 0.12; }
        }
        @keyframes logoIn {
          0%   { opacity: 0; transform: scale(0.7); }
          60%  { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes textIn {
          0%   { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes barGrow {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes orbFloat {
          0%,100% { transform: translateY(0px); opacity: 0.6; }
          50%      { transform: translateY(-14px); opacity: 0.9; }
        }
      `}</style>

      {/* Soft background blobs */}
      <div style={{
        position: "absolute", top: "5%", left: "50%",
        transform: "translateX(-50%)",
        width: 420, height: 420, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,58,237,0.55) 0%, transparent 68%)",
        animation: "orbFloat 6s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "0%", right: "-15%",
        width: 300, height: 300, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(79,70,229,0.4) 0%, transparent 70%)",
        animation: "orbFloat 8s ease-in-out infinite 2s",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "15%", left: "-10%",
        width: 220, height: 220, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)",
        animation: "orbFloat 7s ease-in-out infinite 1s",
        pointerEvents: "none",
      }} />

      {/* Center content */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Pulsing rings behind logo */}
        <div style={{
          position: "absolute",
          width: 230, height: 230,
          borderRadius: "50%",
          border: "1.5px solid rgba(167,139,250,0.25)",
          animation: "ring1 3s ease-in-out infinite",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute",
          width: 290, height: 290,
          borderRadius: "50%",
          border: "1px solid rgba(139,92,246,0.15)",
          animation: "ring2 3s ease-in-out infinite 0.5s",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }} />

        {/* Logo — no container box */}
        <div style={{
          width: 150, height: 150,
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "logoIn 0.9s cubic-bezier(0.22,1,0.36,1) both",
          marginBottom: 32,
          position: "relative",
          zIndex: 2,
        }}>
          <img
            src={logoPath}
            alt="TrustPay"
            onLoad={() => setLogoReady(true)}
            style={{
              width: 150, height: 150,
              objectFit: "contain",
              opacity: logoReady ? 1 : 0,
              transition: "opacity 0.4s ease",
              filter:
                "drop-shadow(0 0 24px rgba(99,102,241,0.7)) drop-shadow(0 12px 32px rgba(0,0,0,0.5))",
            }}
          />
        </div>

        {/* App name */}
        <h1 style={{
          color: "#fff",
          fontSize: 42,
          fontWeight: 900,
          margin: "0 0 8px",
          letterSpacing: "-1.2px",
          fontFamily: "Inter, system-ui, sans-serif",
          textShadow: "0 0 40px rgba(167,139,250,0.8), 0 4px 16px rgba(0,0,0,0.4)",
          lineHeight: 1,
          animation: "textIn 0.7s ease 0.4s both",
        }}>
          TrustPay
        </h1>

        {/* Tagline */}
        <p style={{
          color: "rgba(196,181,253,0.85)",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "3.5px",
          margin: 0,
          fontFamily: "Inter, system-ui, sans-serif",
          textTransform: "uppercase",
          animation: "textIn 0.7s ease 0.6s both",
        }}>
          Secure P2P UPI Trading
        </p>
      </div>

      {/* Bottom loading bar */}
      <div style={{
        position: "absolute",
        bottom: 72,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        animation: "textIn 0.6s ease 0.8s both",
      }}>
        <div style={{
          width: 140, height: 3,
          borderRadius: 999,
          background: "rgba(255,255,255,0.1)",
          overflow: "hidden",
        }}>
          <div style={{
            width: "100%", height: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, #818cf8, #a78bfa, #c4b5fd)",
            transformOrigin: "left center",
            animation: "barGrow 2.6s cubic-bezier(0.4,0,0.2,1) forwards",
            boxShadow: "0 0 14px rgba(167,139,250,0.9)",
          }} />
        </div>
        <div style={{
          color: "rgba(167,139,250,0.4)",
          fontSize: 10,
          letterSpacing: "2px",
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 500,
        }}>
          POWERED BY TRUSTPAY
        </div>
      </div>
    </div>
  );
}
