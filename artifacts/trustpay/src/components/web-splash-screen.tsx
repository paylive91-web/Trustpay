import { useEffect, useState } from "react";

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
        background: "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)",
        transition: "opacity 0.5s ease",
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "all",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: 24,
            background: "rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}
        >
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <circle cx="26" cy="26" r="26" fill="white" fillOpacity="0.15" />
            <path
              d="M16 22h20M16 30h20M22 16l4 20 4-20"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1
          style={{
            color: "white",
            fontSize: 32,
            fontWeight: 700,
            margin: "0 0 6px",
            letterSpacing: "-0.5px",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          TrustPay
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: 14,
            margin: 0,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Safe &amp; Trusted Payments
        </p>

        <div style={{ marginTop: 48 }}>
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.3)",
              margin: "0 auto",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 2,
                background: "white",
                animation: "splashProgress 2s ease forwards",
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
