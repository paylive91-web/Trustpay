import React, { useState } from "react";
import {
  Bell,
  Download,
  Eye,
  EyeOff,
  Wallet,
  ShieldCheck,
  Users,
  Zap,
  Award,
  Crown,
  Gift,
  ArrowDownCircle,
  ArrowUpCircle,
  Sparkles,
  IndianRupee,
  Coins,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Home,
  Banknote,
  User,
  ListOrdered
} from "lucide-react";
import "./_group.css";

export function RewardFirst() {
  const [showBalance, setShowBalance] = useState(true);

  return (
    <div className="tp-root bg-slate-50 min-h-screen text-slate-800 pb-20 font-sans">
      <div className="max-w-[420px] mx-auto bg-slate-50 min-h-screen shadow-2xl relative overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-[hsl(213,85%,42%)] to-blue-600 text-white px-4 pt-4 pb-16 relative">
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg border border-white/30 backdrop-blur-sm shadow-sm">
                R
              </div>
              <div>
                <div className="text-[11px] text-blue-100 font-medium tracking-wide">Welcome back</div>
                <div className="text-sm font-bold">Rahul (98XXX 12345)</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-full hover:bg-white/10 transition">
                <Download className="h-5 w-5" />
              </button>
              <div className="relative">
                <button className="p-2 rounded-full hover:bg-white/10 transition">
                  <Bell className="h-5 w-5" />
                </button>
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-blue-600"></span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 -mt-10 relative z-20 space-y-5">
          
          {/* BANNER (Placeholder for carousel) */}
          <div className="relative rounded-3xl overflow-hidden shadow-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 aspect-[16/7]">
            <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]"></div>
            <div className="absolute inset-0 p-5 flex flex-col justify-center">
              <div className="inline-flex items-center gap-1 bg-white/20 w-fit px-2 py-0.5 rounded-full text-white text-[10px] font-bold uppercase tracking-wider mb-2">
                <Gift className="w-3 h-3" /> Special Offer
              </div>
              <h2 className="text-white text-xl font-black leading-tight drop-shadow-sm">Refer & Earn<br/>₹500 per friend</h2>
              <p className="text-white/90 text-xs mt-1 font-medium">5 invitees pending bonus!</p>
            </div>
            <div className="absolute bottom-4 right-4 bg-white text-indigo-600 px-4 py-1.5 rounded-full text-xs font-bold shadow-md">
              Invite Now
            </div>
            {/* Carousel dots placeholder */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              <div className="w-4 h-1.5 bg-white rounded-full"></div>
              <div className="w-1.5 h-1.5 bg-white/40 rounded-full"></div>
              <div className="w-1.5 h-1.5 bg-white/40 rounded-full"></div>
            </div>
          </div>

          {/* 4-ICON QUICK ACTIONS GRID */}
          <div className="grid grid-cols-4 gap-3">
            <div className="flex flex-col items-center gap-1.5 group cursor-pointer">
              <div className="w-[4.5rem] h-[4.5rem] rounded-[1.25rem] bg-indigo-100 flex items-center justify-center shadow-sm">
                <Users className="h-7 w-7 text-indigo-600" />
              </div>
              <span className="text-[11px] font-semibold text-slate-600 text-center leading-tight">Refer<br/>& Earn</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 group cursor-pointer">
              <div className="w-[4.5rem] h-[4.5rem] rounded-[1.25rem] bg-emerald-100 flex items-center justify-center shadow-sm relative">
                <Zap className="h-7 w-7 text-emerald-600" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-600 text-center leading-tight">Connect<br/>UPI</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 group cursor-pointer">
              <div className="w-[4.5rem] h-[4.5rem] rounded-[1.25rem] bg-orange-100 flex items-center justify-center shadow-sm">
                <Award className="h-7 w-7 text-orange-600" />
              </div>
              <span className="text-[11px] font-semibold text-slate-600 text-center leading-tight">Daily<br/>Tasks</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 group cursor-pointer">
              <div className="w-[4.5rem] h-[4.5rem] rounded-[1.25rem] bg-purple-100 flex items-center justify-center shadow-sm">
                <Crown className="h-7 w-7 text-purple-600" />
              </div>
              <span className="text-[11px] font-semibold text-slate-600 text-center leading-tight">Agent<br/>Tier</span>
            </div>
          </div>

          {/* BALANCE CARD */}
          <div className="bg-white rounded-3xl p-5 shadow-lg border border-slate-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-slate-500">Total Assets</h3>
                  <button onClick={() => setShowBalance(!showBalance)} className="text-slate-400 hover:text-slate-600">
                    {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                </div>
                <div className="text-3xl font-black text-slate-800 tracking-tight">
                  {showBalance ? "₹ 12,847.50" : "₹ •••••••"}
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-100">
                <ShieldCheck className="h-3.5 w-3.5" /> Trust: 95
              </div>
              <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-100">
                <Sparkles className="h-3.5 w-3.5" /> Aaj Earned: ₹248
              </div>
            </div>
          </div>

          {/* REWARDS TITLE */}
          <div className="pt-2">
            <h3 className="text-lg font-black text-slate-800 mb-1">Top Rewards Today</h3>
            <p className="text-xs text-slate-500 font-medium">Claim your daily bonuses</p>
          </div>

          {/* REWARD CARDS (Exact styling) */}
          <div className="space-y-3">
            {/* UPI Reward */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 border border-orange-200 p-4 shadow-md">
              <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-400 to-rose-400 text-white text-[10px] font-black tracking-wide shadow">
                <Sparkles className="h-2.5 w-2.5" /> HOT
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-md shrink-0">
                  <IndianRupee className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-orange-700/70">Buy Rupee</div>
                  <div className="text-base font-black text-slate-900 leading-tight">UPI REWARD UP TO 6%</div>
                </div>
              </div>
              <div className="mt-3 rounded-2xl bg-white/80 border border-orange-200 px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white transition-colors shadow-sm">
                <div className="flex items-center gap-2 text-[13px] font-bold text-slate-800">
                  <span className="text-orange-700">Pay ₹10,000</span>
                  <ChevronRight className="h-3 w-3 text-orange-400" />
                  <span className="text-emerald-700">+₹300 bonus</span>
                </div>
                <ChevronRight className="h-4 w-4 text-orange-400" />
              </div>
            </div>

            {/* USDT Reward */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 ring-1 ring-amber-400/30 p-4 shadow-lg">
              <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 text-[10px] font-black tracking-wide shadow">
                <Sparkles className="h-2.5 w-2.5" /> POPULAR
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-md shrink-0">
                  <Coins className="h-6 w-6 text-slate-900" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-amber-300/70">Buy USDT</div>
                  <div className="text-base font-black text-white leading-tight">USDT REWARD</div>
                  <div className="text-[11px] text-amber-200/90 mt-0.5">Platform price ₹89.50 + 2% bonus</div>
                </div>
              </div>
              <div className="mt-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-amber-300/20 px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/15 transition-colors shadow-sm">
                <div className="flex items-center gap-2 text-[13px] font-bold">
                  <span className="text-amber-200">100 USDT</span>
                  <ChevronRight className="h-3 w-3 text-amber-400/60" />
                  <span className="text-emerald-300">₹9,129 (+₹179 bonus)</span>
                </div>
                <ChevronRight className="h-4 w-4 text-amber-400/70" />
              </div>
            </div>
          </div>

          {/* ACTIVE ORDERS SNAPSHOT */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <h3 className="font-bold text-slate-800 text-sm">Live Orders</h3>
              </div>
              <button className="text-blue-600 font-bold text-xs flex items-center hover:underline">
                View All <ChevronRight className="h-3 w-3 ml-0.5" />
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {/* Order 1 */}
              <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition cursor-pointer">
                <div className="p-2 rounded-xl bg-blue-50">
                  <TrendingDown className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-slate-800">₹ 5,000.00</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">Pending</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-500">Buy · Order #10492</div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
              </div>
              {/* Order 2 */}
              <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition cursor-pointer">
                <div className="p-2 rounded-xl bg-purple-50">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-slate-800">₹ 2,500.00</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700">Matched</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-500">Sell · Order #10488</div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
              </div>
            </div>
          </div>

          {/* RULES TEASER */}
          <div className="bg-blue-50/50 rounded-3xl p-5 border border-blue-100 flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 mb-1">Trading Rules</h3>
              <p className="text-xs font-medium text-slate-500">Keep your account safe</p>
            </div>
            <button className="bg-white text-blue-600 text-xs font-bold px-4 py-2 rounded-xl shadow-sm border border-blue-100 flex items-center gap-1 hover:bg-blue-50 transition">
              Read <ChevronRight className="h-3 w-3" />
            </button>
          </div>

        </div>

        {/* BOTTOM NAVIGATION */}
        <div className="fixed bottom-0 left-0 right-0 w-full max-w-[420px] mx-auto bg-white border-t border-slate-100 pb-safe pt-2 px-6 flex justify-between items-center z-50 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pb-6">
          <div className="flex flex-col items-center gap-1 cursor-pointer text-blue-600">
            <Home className="h-6 w-6" />
            <span className="text-[10px] font-bold">Home</span>
          </div>
          <div className="flex flex-col items-center gap-1 cursor-pointer text-slate-400 hover:text-slate-600 transition">
            <ArrowDownCircle className="h-6 w-6" />
            <span className="text-[10px] font-semibold">Buy</span>
          </div>
          {/* Center Action Button (optional stylized sell/buy) */}
          <div className="flex flex-col items-center gap-1 cursor-pointer -mt-5">
            <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 text-white">
              <Banknote className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold text-slate-600 mt-0.5">Pay</span>
          </div>
          <div className="flex flex-col items-center gap-1 cursor-pointer text-slate-400 hover:text-slate-600 transition">
            <ListOrdered className="h-6 w-6" />
            <span className="text-[10px] font-semibold">Orders</span>
          </div>
          <div className="flex flex-col items-center gap-1 cursor-pointer text-slate-400 hover:text-slate-600 transition">
            <User className="h-6 w-6" />
            <span className="text-[10px] font-semibold">Profile</span>
          </div>
        </div>

      </div>
    </div>
  );
}
