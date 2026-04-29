import { useEffect, useState } from "react";
import logoPath from "@assets/file_00000000da60720ba5a8a74acd96c937_1776335785514.png";

export function WebSplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2000);
    const doneTimer = setTimeout(() => onDone(), 2500);
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
          "radial-gradient(circle at top, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 32%), linear-gradient(180deg, #3b0f7a 0%, #5b21b6 45%, #6d28d9 100%)",
        transition: "opacity 0.5s ease",
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "all",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.16), transparent 38%), radial-gradient(circle at 20% 80%, rgba(255,255,255,0.08), transparent 22%), radial-gradient(circle at 80% 75%, rgba(255,255,255,0.08), transparent 18%)",
        }}
      />
      <div
        style={{
          position: "relative",
          textAlign: "center",
          padding: "28px 22px 34px",
          borderRadius: 32,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.16)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          maxWidth: 340,
          width: "calc(100% - 40px)",
        }}
      >
        <div
          style={{
            width: 112,
            height: 112,
            borderRadius: 32,
            background: "linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.12))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 22px",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.35), 0 18px 40px rgba(0,0,0,0.28)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 10,
              borderRadius: 24,
              background: "rgba(255,255,255,0.10)",
              filter: "blur(1px)",
            }}
          />
          <img
            src={logoPath}
            alt="TrustPay"
            style={{
              width: 72,
              height: 72,
              objectFit: "contain",
              position: "relative",
              zIndex: 1,
              filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.22))",
            }}
          />
        </div>

        <h1
          style={{
            color: "white",
            fontSize: 34,
            fontWeight: 800,
            margin: "0 0 8px",
            letterSpacing: "-0.8px",
            fontFamily: "Inter, system-ui, sans-serif",
            textShadow: "0 4px 22px rgba(0,0,0,0.24)",
          }}
        >
          TrustPay
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.82)",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "1.9px",
            margin: 0,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          SECURE P2P UPI TRADING
        </p>

        <div style={{ marginTop: 34 }}>
          <div
            style={{
              width: 92,
              height: 6,
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
              margin: "0 auto",
              overflow: "hidden",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.18)",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg, #fff 0%, #f5d0fe 45%, #fff 100%)",
                animation: "splashProgress 2s ease forwards",
                boxShadow: "0 0 18px rgba(255,255,255,0.55)",
              }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes splashProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
