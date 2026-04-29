import { useEffect, useState } from "react";
import logoPath from "@assets/1000279069-removebg-preview_(1)_1777443970849.png";

export function WebSplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);
  const [logoReady, setLogoReady] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2500);
    const doneTimer = setTimeout(() => onDone(), 3100);
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
        background: "linear-gradient(160deg, #1a0533 0%, #2d0d6e 35%, #4c1d95 65%, #1e0e47 100%)",
        transition: "opacity 0.6s cubic-bezier(0.4,0,0.2,1)",
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "all",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes splashProgress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes logoPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(167,139,250,0), 0 20px 60px rgba(0,0,0,0.5); }
          50% { box-shadow: 0 0 0 18px rgba(167,139,250,0.12), 0 20px 60px rgba(0,0,0,0.5); }
        }
        @keyframes floatUp {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%) rotate(30deg); }
          100% { transform: translateX(300%) rotate(30deg); }
        }
        @keyframes glowOrb {
          0%,100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(1.08); }
        }
      `}</style>

      {/* Background glow orbs */}
      <div style={{
        position: "absolute", top: "-18%", left: "50%", transform: "translateX(-50%)",
        width: 360, height: 360, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,92,246,0.45) 0%, transparent 70%)",
        animation: "glowOrb 4s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-12%", right: "-10%",
        width: 260, height: 260, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(109,40,217,0.35) 0%, transparent 70%)",
        animation: "glowOrb 5s ease-in-out infinite 1s",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "10%", left: "-8%",
        width: 200, height: 200, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(167,139,250,0.2) 0%, transparent 70%)",
        animation: "glowOrb 6s ease-in-out infinite 2s",
        pointerEvents: "none",
      }} />

      {/* Main content */}
      <div style={{
        position: "relative",
        textAlign: "center",
        animation: "floatUp 0.7s cubic-bezier(0.22,1,0.36,1) both",
      }}>
        {/* Logo container */}
        <div style={{
          width: 120, height: 120,
          borderRadius: 32,
          background: "linear-gradient(145deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%)",
          border: "1px solid rgba(255,255,255,0.22)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 28px",
          animation: "logoPulse 2.5s ease-in-out infinite",
          position: "relative",
          overflow: "hidden",
          backdropFilter: "blur(12px)",
        }}>
          {/* Shimmer effect */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)",
            animation: "shimmer 2.2s ease-in-out infinite 0.5s",
            pointerEvents: "none",
          }} />
          {/* White fill layer for dark tick area */}
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 0,
          }}>
            <img
              src={logoPath}
              alt=""
              aria-hidden
              style={{
                width: 80, height: 80,
                objectFit: "contain",
                filter: "brightness(0) invert(1)",
                opacity: logoReady ? 0.35 : 0,
                transition: "opacity 0.3s ease",
              }}
            />
          </div>
          <img
            src={logoPath}
            alt="TrustPay"
            onLoad={() => setLogoReady(true)}
            style={{
              width: 80, height: 80,
              objectFit: "contain",
              opacity: logoReady ? 1 : 0,
              transition: "opacity 0.3s ease",
              position: "relative",
              zIndex: 1,
              filter: "drop-shadow(0 4px 16px rgba(0,100,255,0.4))",
            }}
          />
        </div>

        {/* App name */}
        <h1 style={{
          color: "white",
          fontSize: 38,
          fontWeight: 800,
          margin: "0 0 10px",
          letterSpacing: "-1px",
          fontFamily: "Inter, system-ui, sans-serif",
          textShadow: "0 2px 24px rgba(167,139,250,0.6)",
          lineHeight: 1,
        }}>
          TrustPay
        </h1>

        {/* Tagline */}
        <p style={{
          color: "rgba(196,181,253,0.9)",
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: "3px",
          margin: "0 0 44px",
          fontFamily: "Inter, system-ui, sans-serif",
          textTransform: "uppercase",
        }}>
          Secure P2P UPI Trading
        </p>

        {/* Progress bar */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{
            width: 120, height: 3,
            borderRadius: 999,
            background: "rgba(255,255,255,0.12)",
            overflow: "hidden",
          }}>
            <div style={{
              width: "100%", height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg, #a78bfa, #7c3aed, #c4b5fd)",
              transformOrigin: "left center",
              animation: "splashProgress 2.5s cubic-bezier(0.4,0,0.2,1) forwards",
              boxShadow: "0 0 12px rgba(167,139,250,0.8)",
            }} />
          </div>
        </div>
      </div>

      {/* Bottom brand */}
      <div style={{
        position: "absolute", bottom: 40,
        color: "rgba(167,139,250,0.45)",
        fontSize: 11,
        fontFamily: "Inter, system-ui, sans-serif",
        letterSpacing: "1.5px",
        fontWeight: 500,
      }}>
        POWERED BY TRUSTPAY
      </div>
    </div>
  );
}
