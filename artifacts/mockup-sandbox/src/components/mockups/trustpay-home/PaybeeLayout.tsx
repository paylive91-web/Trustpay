import React, { useState } from "react";
import {
  Bell,
  Headphones,
  Home,
  ShoppingCart,
  Plus,
  Users,
  User,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  ShieldCheck,
  ChevronRight,
  Link as LinkIcon,
  TrendingDown,
  TrendingUp,
  Crown,
  Calendar,
  UserPlus,
  Handshake,
} from "lucide-react";
import "./_group.css";

export function PaybeeLayout() {
  const [bannerIdx, setBannerIdx] = useState(0);
  const banners = [
    {
      gradient: "from-amber-700 via-orange-600 to-rose-700",
      kicker: "Limited-time agent recruitment",
      title: "Easily earn ₹70,000 per month",
      subtitle: "Limited slots, first come first served",
      cta: "JOIN NOW",
    },
    {
      gradient: "from-indigo-700 via-blue-700 to-sky-700",
      kicker: "Refer & Earn",
      title: "Get ₹500 per friend you invite",
      subtitle: "Unlimited referrals, instant credit",
      cta: "INVITE FRIENDS",
    },
    {
      gradient: "from-violet-700 via-fuchsia-700 to-purple-800",
      kicker: "USDT special offer",
      title: "Buy USDT with 3% extra profit",
      subtitle: "Platform price always above Binance",
      cta: "BUY NOW",
    },
  ];
  const banner = banners[bannerIdx];

  return (
    <div className="tp-root min-h-screen bg-gradient-to-b from-sky-50 via-white to-white text-slate-900 mx-auto max-w-[420px] relative pb-24 overflow-x-hidden">
      {/* HEADER — light pastel, avatar + greeting + support + bell */}
      <header className="px-4 pt-3 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-sky-400 flex items-center justify-center text-white font-bold text-base ring-2 ring-white shadow-sm">
            R
          </div>
          <div>
            <div className="text-xs text-slate-500 leading-none">Hello,</div>
            <div className="text-base font-bold text-slate-900 leading-tight mt-1">
              Rahul98765
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm hover:bg-slate-50">
            <Headphones className="w-5 h-5 text-slate-700" />
          </button>
          <button className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm hover:bg-slate-50 relative">
            <Bell className="w-5 h-5 text-slate-700" />
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 border border-white"></div>
          </button>
        </div>
      </header>

      {/* BIG HERO BANNER — Paybee-style prominent height */}
      <div className="px-4">
        <div
          className={`relative rounded-2xl overflow-hidden shadow-md ring-1 ring-black/5 h-52 bg-gradient-to-br ${banner.gradient}`}
        >
          {/* Decorative blobs */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-12 -left-8 w-44 h-44 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute right-4 top-4 w-20 h-20 rounded-full bg-white/15" />
          <div className="absolute right-10 bottom-10 w-12 h-12 rounded-full bg-white/15" />

          {/* Content */}
          <div className="relative z-10 h-full flex flex-col justify-between p-5 text-white">
            <div>
              <div className="text-[11px] uppercase tracking-wider font-bold text-white/85 mb-1">
                {banner.kicker}
              </div>
              <div className="text-2xl font-black leading-tight max-w-[260px]">
                {banner.title}
              </div>
              <div className="text-xs text-white/85 mt-1.5 max-w-[240px]">
                {banner.subtitle}
              </div>
            </div>
            <button className="self-start bg-white/95 hover:bg-white text-slate-900 font-bold text-xs px-5 py-2 rounded-full shadow-md tracking-wide">
              {banner.cta} →
            </button>
          </div>

          {/* Pagination dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setBannerIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === bannerIdx ? "w-5 bg-white" : "w-1.5 bg-white/60"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 4 QUICK ACTION TILES — Paybee-style colorful soft squares */}
      <div className="px-4 mt-4 grid grid-cols-4 gap-3">
        <button className="flex flex-col items-center gap-2 group">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 border border-violet-200/60 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <UserPlus className="w-6 h-6 text-violet-600" />
          </div>
          <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">
            Refer<br />& Earn
          </span>
        </button>
        <button className="flex flex-col items-center gap-2 group">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200/60 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow relative">
            <LinkIcon className="w-6 h-6 text-emerald-600" />
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"></div>
          </div>
          <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">
            Connect<br />UPI
          </span>
        </button>
        <button className="flex flex-col items-center gap-2 group">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-100 to-blue-100 border border-sky-200/60 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <Calendar className="w-6 h-6 text-sky-600" />
          </div>
          <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">
            Daily<br />Tasks
          </span>
        </button>
        <button className="flex flex-col items-center gap-2 group">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200/60 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <Crown className="w-6 h-6 text-amber-600" />
          </div>
          <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">
            Agent<br />Tier
          </span>
        </button>
      </div>

      {/* BALANCE + BUY/SELL — TrustPay's existing style preserved */}
      <div className="px-4 mt-4">
        <div className="rounded-2xl shadow-sm border border-slate-200 bg-gradient-to-br from-white via-white to-sky-50 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-blue-600/5 to-sky-500/10">
            <div className="flex items-center justify-between mb-3 gap-3">
              <div>
                <div className="text-slate-500 text-sm">My Total Assets</div>
                <div className="text-3xl font-bold tracking-tight text-slate-900">
                  ₹ 12,847.50
                </div>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Wallet className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>
                Trust Score:{" "}
                <span className="text-emerald-600 font-semibold">95</span>
              </span>
            </div>
          </div>

          <div className="p-4 pt-0">
            <div className="grid grid-cols-2 gap-2.5">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white min-h-12 text-base font-semibold rounded-2xl shadow-md flex items-center justify-center gap-2 transition-colors">
                <ArrowDownCircle className="h-5 w-5" />
                BUY
              </button>
              <button className="w-full min-h-12 text-base font-semibold rounded-2xl shadow-md bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white flex items-center justify-center gap-2 transition-colors">
                <ArrowUpCircle className="h-5 w-5" />
                SELL
              </button>
            </div>
            <div className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700 flex items-center justify-between gap-2">
              <span>2 UPI linked & ready</span>
              <span className="font-medium underline cursor-pointer">
                Manage
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* BUY RUPEE CARD — Paybee peach style */}
      <div className="px-4 mt-3">
        <div className="relative rounded-2xl bg-gradient-to-br from-orange-50 via-rose-50 to-orange-50 border border-orange-100 p-4 overflow-hidden">
          <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-rose-400 to-orange-400 text-white text-[10px] font-bold shadow-sm">
            👍 Hot
          </div>
          <div className="text-lg font-bold text-slate-900 mb-3">Buy Rupee</div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">Rewards</div>
              <div className="text-3xl font-black text-slate-900 leading-none">
                2.5%<span className="text-orange-500">+6</span>
              </div>
            </div>
            <div className="flex-1 max-w-[200px] rounded-2xl bg-orange-100/70 border border-orange-200 px-3 py-2 text-[11px] leading-tight text-orange-800">
              <div className="font-semibold">Example: Pay ₹10,000</div>
              <div className="font-semibold">Receive ₹10,256</div>
            </div>
          </div>
        </div>
      </div>

      {/* BUY USDT CARD — Paybee blue style */}
      <div className="px-4 mt-3">
        <div className="relative rounded-2xl bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 border border-blue-100 p-4 overflow-hidden">
          <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-500 to-sky-500 text-white text-[10px] font-bold shadow-sm">
            👍 Popular
          </div>
          <div className="text-lg font-bold text-slate-900 mb-1">Buy USDT</div>
          <div className="text-sm font-semibold text-blue-600 mb-4">
            <span className="text-2xl">3%</span>{" "}
            <span className="text-slate-600 font-medium text-sm">
              profit per order
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-slate-500 mb-1">
                Binance Price (₹)
              </div>
              <div className="text-2xl font-black text-slate-900">89.50</div>
            </div>
            <div className="border-l border-slate-200 pl-3">
              <div className="text-xs text-slate-500 mb-1">
                Platform Price (₹)
              </div>
              <div className="text-2xl font-black text-slate-900">91.50</div>
            </div>
          </div>
        </div>
      </div>

      {/* LIVE ORDERS — TrustPay's existing snapshot */}
      <div className="px-4 mt-3">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
              </span>
              <h3 className="font-semibold text-sm text-slate-900">
                Live Orders
              </h3>
            </div>
            <button className="text-xs text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-1">
              All <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer">
              <div className="p-1.5 rounded-full bg-blue-100">
                <TrendingDown className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900">
                    ₹5,000.00
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">
                    Pending
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Buy · Order #8821
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer">
              <div className="p-1.5 rounded-full bg-violet-100">
                <TrendingUp className="h-4 w-4 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900">
                    ₹2,500.00
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
                    Locked
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Sell · Order #8819
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* RULES SECTION — Paybee "Learn & Earn" style */}
      <div className="px-4 mt-3">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900">Rules</h3>
            <button className="text-xs px-3 py-1 rounded-full border border-blue-300 text-blue-600 font-semibold flex items-center gap-1 hover:bg-blue-50">
              More <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-sky-50 p-3">
              <div className="text-xs font-bold text-sky-700 mb-1">
                Buy Rules
              </div>
              <div className="text-[11px] text-slate-600 line-clamp-3">
                Pay only via linked UPI. Use exact amount. Submit UTR after
                payment.
              </div>
            </div>
            <div className="rounded-xl bg-fuchsia-50 p-3">
              <div className="text-xs font-bold text-fuchsia-700 mb-1">
                Sell Rules
              </div>
              <div className="text-[11px] text-slate-600 line-clamp-3">
                Confirm payment receipt before release. Verify buyer's UPI
                handle.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM NAV — 5 tabs with center action button (Paybee style) */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-[420px] mx-auto bg-white border-t border-slate-200 px-4 pt-2 pb-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50">
        <div className="grid grid-cols-5 items-end gap-1">
          <button className="flex flex-col items-center gap-0.5 text-blue-600">
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-bold">Home</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 text-slate-400">
            <ShoppingCart className="w-5 h-5" />
            <span className="text-[10px] font-medium">Buy</span>
          </button>
          <button className="flex flex-col items-center gap-1 -mt-6">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-sky-500 flex items-center justify-center shadow-lg ring-4 ring-white">
              <Plus className="w-7 h-7 text-white" strokeWidth={3} />
            </div>
            <span className="text-[10px] font-bold text-blue-600">UPI</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 text-slate-400">
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-medium">Team</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 text-slate-400">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">My</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
