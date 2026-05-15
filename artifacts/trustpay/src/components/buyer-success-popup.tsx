import React, { useEffect, useRef, useState, useCallback } from "react";
import { getAuthToken } from "@/lib/auth";
import { API_BASE } from "@/lib/api-config";
import { CheckCircle2, X, Wallet, TrendingUp } from "lucide-react";

const STORAGE_KEY = "tp_shown_confirmed_buys";

function getShownIds(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

function markShown(id: number) {
  const set = getShownIds();
  set.add(id);
  // Keep only last 50
  const arr = Array.from(set).slice(-50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

interface ConfirmedOrder {
  id: number;
  amount: string;
  confirmedAt: string;
}

export default function BuyerSuccessPopup() {
  const [popup, setPopup] = useState<ConfirmedOrder | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRecent = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/p2p/my-buys/recent-confirmed`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const orders: ConfirmedOrder[] = data.orders || [];
      const shown = getShownIds();
      const unseen = orders.find((o) => !shown.has(o.id));
      if (unseen) {
        markShown(unseen.id);
        setPopup(unseen);
        setVisible(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setVisible(false), 5000);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchRecent();
    const interval = setInterval(fetchRecent, 30_000);
    return () => {
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchRecent]);

  const dismiss = () => {
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  if (!popup || !visible) return null;

  return (
    <>
      <style>{`
        @keyframes popupSlideIn {
          0%{opacity:0;transform:translateY(-32px) scale(.92);}
          60%{transform:translateY(4px) scale(1.01);}
          100%{opacity:1;transform:translateY(0) scale(1);}
        }
        @keyframes coinFall {
          0%{opacity:0;transform:translateY(-30px) rotate(0deg);}
          60%{opacity:1;}
          100%{opacity:0;transform:translateY(40px) rotate(180deg);}
        }
        @keyframes walletBounce {
          0%,100%{transform:scale(1) rotate(-3deg);}
          30%{transform:scale(1.15) rotate(3deg);}
          60%{transform:scale(1.08) rotate(-2deg);}
        }
        @keyframes checkPop {
          0%{transform:scale(0);}
          60%{transform:scale(1.2);}
          100%{transform:scale(1);}
        }
        @keyframes glowGreen {
          0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.4);}
          50%{box-shadow:0 0 0 10px rgba(34,197,94,.0);}
        }
        @keyframes confetti1 {
          0%{transform:translateY(0) rotate(0deg);opacity:1;}
          100%{transform:translateY(60px) rotate(720deg);opacity:0;}
        }
        @keyframes confetti2 {
          0%{transform:translateY(0) rotate(0deg) translateX(0);opacity:1;}
          100%{transform:translateY(50px) rotate(-540deg) translateX(20px);opacity:0;}
        }
        @keyframes confetti3 {
          0%{transform:translateY(0) rotate(45deg) translateX(0);opacity:1;}
          100%{transform:translateY(55px) rotate(270deg) translateX(-15px);opacity:0;}
        }
        .popup-enter{animation:popupSlideIn .45s cubic-bezier(.22,1,.36,1) both;}
        .wallet-bounce{animation:walletBounce 1.2s ease-in-out infinite;}
        .check-pop{animation:checkPop .4s cubic-bezier(.34,1.56,.64,1) .2s both;}
        .glow-green{animation:glowGreen 1.5s ease-in-out infinite;}
        .coin-1{animation:coinFall 1.2s ease-in .1s infinite;}
        .coin-2{animation:coinFall 1.2s ease-in .3s infinite;}
        .coin-3{animation:coinFall 1.2s ease-in .5s infinite;}
        .coin-4{animation:coinFall 1.2s ease-in .7s infinite;}
        .conf-1{animation:confetti1 1.5s ease-out .1s both;}
        .conf-2{animation:confetti2 1.5s ease-out .2s both;}
        .conf-3{animation:confetti3 1.5s ease-out .3s both;}
        .conf-4{animation:confetti1 1.5s ease-out .4s both;}
        .conf-5{animation:confetti2 1.5s ease-out .15s both;}
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Popup Card */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100vw-32px)] max-w-sm popup-enter">
        <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden border border-emerald-100">
          {/* Green top strip */}
          <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400" />

          {/* Confetti bits */}
          <div className="absolute top-4 left-8 w-2 h-2 rounded-sm bg-amber-400 conf-1" />
          <div className="absolute top-4 left-16 w-2 h-1.5 rounded-sm bg-emerald-400 conf-2" />
          <div className="absolute top-4 right-16 w-2 h-2 rounded-sm bg-violet-400 conf-3" />
          <div className="absolute top-4 right-8 w-1.5 h-2 rounded-sm bg-rose-400 conf-4" />
          <div className="absolute top-6 left-24 w-2 h-1.5 rounded-sm bg-blue-400 conf-5" />

          <div className="p-5">
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>

            <div className="flex items-start gap-4">
              {/* Wallet animation */}
              <div className="relative shrink-0">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center wallet-bounce glow-green"
                  style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", boxShadow: "0 8px 24px rgba(34,197,94,.35)" }}
                >
                  <Wallet className="h-7 w-7 text-white" strokeWidth={1.8} />
                </div>
                {/* Coin particles */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-amber-500 text-xs font-black coin-1 select-none">₹</div>
                <div className="absolute -top-1 left-3 text-amber-400 text-[10px] font-black coin-2 select-none">₹</div>
                <div className="absolute -top-1 right-2 text-yellow-500 text-xs font-black coin-3 select-none">₹</div>
                <div className="absolute -top-2 left-6 text-amber-300 text-[9px] font-black coin-4 select-none">₹</div>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="check-pop">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  </div>
                  <span className="text-sm font-black text-slate-900">Payment Received!</span>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-2xl font-black text-emerald-600">
                    ₹{Number(popup.amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-sm text-slate-500 font-medium">credited</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  Order #{popup.id} confirmed · Added to wallet
                </div>
              </div>
            </div>

            {/* Progress bar countdown */}
            <div className="mt-4 h-1 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500"
                style={{ animation: "shimmerBar 5s linear forwards", width: "100%" }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
