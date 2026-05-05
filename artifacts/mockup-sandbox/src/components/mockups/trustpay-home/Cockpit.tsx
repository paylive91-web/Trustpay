import React, { useState } from "react";
import { 
  Bell, 
  Download, 
  Wallet, 
  Eye, 
  EyeOff, 
  TrendingDown, 
  TrendingUp, 
  Plus, 
  Banknote, 
  ChevronRight, 
  Sparkles, 
  IndianRupee, 
  Coins, 
  ShieldCheck,
  Home,
  ArrowDownCircle,
  ArrowUpCircle,
  User,
  ListOrdered
} from "lucide-react";
import './_group.css';

export function Cockpit() {
  const [showBalance, setShowBalance] = useState(true);

  return (
    <div className="tp-root min-h-screen bg-slate-50 text-slate-900 mx-auto max-w-[420px] relative pb-20 overflow-x-hidden">
      {/* Slim Header */}
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white shadow-sm">
            TP
          </div>
          <div>
            <div className="text-sm font-bold leading-none tracking-tight">TrustPay</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Pro Trader</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Status</div>
            <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              Active
            </div>
          </div>
          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800 transition-colors">
            <Download className="w-4 h-4 text-slate-300" />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 relative">
            <Bell className="w-4 h-4 text-slate-300" />
            <div className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-red-500 border border-slate-900"></div>
          </button>
        </div>
      </header>

      {/* Main Cockpit Area */}
      <div className="px-4 py-4 space-y-4">
        {/* Balance & Trust Signal Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
          
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Assets</span>
                <button onClick={() => setShowBalance(!showBalance)} className="text-slate-400 hover:text-slate-600">
                  {showBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="text-3xl font-black font-mono tracking-tight text-slate-900">
                {showBalance ? "₹ 12,847.50" : "₹ ••••••"}
              </div>
            </div>
            
            {/* Trust Dial Visualization */}
            <div className="relative w-12 h-12">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <path
                  className="text-slate-100"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="text-emerald-500"
                  strokeDasharray="95, 100"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <ShieldCheck className="w-3 h-3 text-emerald-600 mb-0.5" />
                <span className="text-[10px] font-bold text-slate-800 leading-none">95</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded border border-emerald-100 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              + ₹ 248 today
            </div>
            <div className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded border border-slate-200">
              3 Active Orders
            </div>
          </div>
        </div>

        {/* Quick Actions - Pills in a single horizontal row */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-full font-semibold text-sm shadow-sm whitespace-nowrap shrink-0 hover:bg-blue-700 transition-colors">
            <ArrowDownCircle className="w-4 h-4" />
            Buy INR
          </button>
          <button className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-full font-semibold text-sm shadow-sm whitespace-nowrap shrink-0 hover:bg-slate-800 transition-colors">
            <ArrowUpCircle className="w-4 h-4" />
            Sell INR
          </button>
          <button className="flex items-center gap-1.5 bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-full font-semibold text-sm shadow-sm whitespace-nowrap shrink-0 hover:bg-slate-50 transition-colors">
            <Plus className="w-4 h-4" />
            Deposit
          </button>
          <button className="flex items-center gap-1.5 bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-full font-semibold text-sm shadow-sm whitespace-nowrap shrink-0 hover:bg-slate-50 transition-colors">
            <Banknote className="w-4 h-4" />
            Withdraw
          </button>
        </div>

        {/* Banner Carousel Placeholder */}
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="snap-center shrink-0 w-72 h-28 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 p-4 relative overflow-hidden flex flex-col justify-center">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/20 rounded-full blur-xl"></div>
              <div className="absolute right-4 bottom-4 w-12 h-12 bg-emerald-500/20 rounded-full blur-xl"></div>
              <div className="text-white z-10">
                <div className="text-[10px] uppercase tracking-wider text-blue-300 font-bold mb-1">Trading Signal</div>
                <div className="text-base font-bold leading-tight max-w-[180px]">New high-liquidity pairs available.</div>
                <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">View markets <ChevronRight className="w-3 h-3" /></div>
              </div>
            </div>
          ))}
        </div>

        {/* Reward Cards (Keeping the required styling) */}
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 border border-orange-200 p-4 shadow-sm">
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
            <div className="mt-3 rounded-xl bg-white/80 border border-orange-200 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-white transition-colors">
              <div className="flex items-center gap-2 text-[13px] font-bold text-slate-800">
                <span className="text-orange-700">Pay ₹10,000</span>
                <ChevronRight className="h-3 w-3 text-orange-400" />
                <span className="text-emerald-700">+₹300 bonus</span>
              </div>
              <ChevronRight className="h-4 w-4 text-orange-400" />
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 ring-1 ring-amber-400/30 p-4 shadow-lg">
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
                <div className="text-[11px] text-amber-200/90 mt-0.5">Platform price ₹91.50 + 2% bonus</div>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-white/10 backdrop-blur-sm border border-amber-300/20 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-white/15 transition-colors">
              <div className="flex items-center gap-2 text-[13px] font-bold">
                <span className="text-amber-200">100 USDT</span>
                <ChevronRight className="h-3 w-3 text-amber-400/60" />
                <span className="text-emerald-300">₹9,150 (+₹183 bonus)</span>
              </div>
              <ChevronRight className="h-4 w-4 text-amber-400/70" />
            </div>
          </div>
        </div>

        {/* Active Orders Snapshot - Compact List Style */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"></div>
              Live Orders
            </h3>
            <button className="text-xs font-semibold text-blue-600 hover:text-blue-700">View All</button>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center shrink-0">
                    <TrendingDown className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm font-bold font-mono text-slate-900">₹ 5,000.00</div>
                    <div className="text-[10px] text-slate-500 font-medium">Buy • Order #8821</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">Pending</span>
                  <span className="text-[10px] text-slate-400 font-mono">04:12</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-emerald-50 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-bold font-mono text-slate-900">₹ 2,500.00</div>
                    <div className="text-[10px] text-slate-500 font-medium">Sell • Order #8819</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">Processing</span>
                  <span className="text-[10px] text-slate-400 font-mono">01:45</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rules Teaser */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-0.5">Trading Rules & Limits</h4>
            <p className="text-xs text-slate-500">Review guidelines to maintain high trust score</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-[420px] mx-auto bg-white border-t border-slate-200 flex justify-between px-6 py-2 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50">
        <button className="flex flex-col items-center gap-1 p-2 text-blue-600">
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-slate-600">
          <ArrowDownCircle className="w-5 h-5" />
          <span className="text-[10px] font-medium">Buy</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-slate-600">
          <ArrowUpCircle className="w-5 h-5" />
          <span className="text-[10px] font-medium">Sell</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-slate-600 relative">
          <ListOrdered className="w-5 h-5" />
          <span className="text-[10px] font-medium">Orders</span>
          <div className="absolute top-1.5 right-2.5 w-2 h-2 rounded-full bg-orange-500 border-2 border-white"></div>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-slate-600">
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </nav>
    </div>
  );
}
