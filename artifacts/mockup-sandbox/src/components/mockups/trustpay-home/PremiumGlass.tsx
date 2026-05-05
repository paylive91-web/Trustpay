import React, { useState } from 'react';
import './_group.css';
import { Bell, Download, Wallet, Eye, EyeOff, ArrowDownCircle, ArrowUpCircle, Plus, ChevronRight, Sparkles, Coins, IndianRupee, ShieldCheck, TrendingUp, TrendingDown, Home, Banknote, ListOrdered, User, ShieldAlert, Award } from 'lucide-react';

export function PremiumGlass() {
  const [showBalance, setShowBalance] = useState(true);

  return (
    <div className="tp-root bg-slate-50 min-h-screen pb-24">
      <div className="max-w-[420px] mx-auto bg-slate-50 min-h-screen relative shadow-2xl overflow-hidden">
        
        {/* Dark Hero Section */}
        <div className="bg-gradient-to-b from-slate-950 to-slate-900 px-4 pt-12 pb-24 relative rounded-b-[40px] shadow-[0_10px_40px_rgba(0,0,0,0.2)]">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl translate-y-1/4 -translate-x-1/4"></div>

          {/* Header overlaying hero */}
          <div className="flex items-center justify-between relative z-10 mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-1.5 ring-1 ring-white/20">
                <img src="/__mockup/images/trustpay-logo-clean.png" alt="TrustPay" className="w-8 h-8 rounded object-contain" onError={(e) => { e.currentTarget.src = 'https://placehold.co/100x100/blue/white?text=TP' }} />
              </div>
              <div>
                <div className="font-bold text-[19px] text-white leading-none tracking-tight">TrustPay</div>
                <div className="text-[11px] text-slate-400 mt-1">Hello, Rahul</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-white">
              <button className="bg-white/10 p-2 rounded-full ring-1 ring-white/20">
                <Download className="h-4 w-4" />
              </button>
              <div className="relative bg-white/10 p-2 rounded-full ring-1 ring-white/20">
                <Bell className="h-4 w-4" />
                <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-slate-950"></div>
              </div>
            </div>
          </div>

          {/* Balance Card */}
          <div className="relative z-10 bg-white/5 backdrop-blur-xl rounded-3xl p-6 ring-1 ring-amber-400/30 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
                <Wallet className="h-4 w-4 text-amber-400" />
                Total Assets
              </div>
              <button onClick={() => setShowBalance(!showBalance)} className="text-slate-400 hover:text-white transition-colors">
                {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            
            <div className="flex items-end gap-2 mb-6">
              <span className="text-4xl font-[800] text-white tracking-tight leading-none font-serif">
                {showBalance ? '₹12,847.50' : '••••••••'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ring-emerald-500/30">
                <ShieldCheck className="h-3.5 w-3.5" />
                Trust 95
              </div>
              <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ring-amber-500/30">
                <Award className="h-3.5 w-3.5" />
                +₹248 Today
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions (Overlapping the hero boundary) */}
        <div className="px-4 -mt-8 relative z-20 mb-6">
          <div className="bg-white rounded-2xl p-2 shadow-xl ring-1 ring-slate-100 flex justify-between items-center gap-2">
            {[
              { icon: ArrowDownCircle, label: 'Buy', color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { icon: ArrowUpCircle, label: 'Sell', color: 'text-rose-600', bg: 'bg-rose-50' },
              { icon: Plus, label: 'Deposit', color: 'text-blue-600', bg: 'bg-blue-50' },
              { icon: Banknote, label: 'Withdraw', color: 'text-violet-600', bg: 'bg-violet-50' },
            ].map((action, i) => (
              <button key={i} className="flex-1 flex flex-col items-center justify-center py-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className={`w-12 h-12 rounded-full ${action.bg} flex items-center justify-center mb-2`}>
                  <action.icon className={`h-6 w-6 ${action.color}`} strokeWidth={2.5} />
                </div>
                <span className="text-[11px] font-bold text-slate-700">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Banners */}
        <div className="px-4 mb-8">
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-2" style={{ scrollbarWidth: 'none' }}>
            {[
              { title: "Zero Fee Trading", subtitle: "Trade directly with verified users", bg: "from-blue-600 to-indigo-700" },
              { title: "Refer & Earn", subtitle: "Get ₹50 for every active friend", bg: "from-amber-500 to-orange-600" },
              { title: "Agent Program", subtitle: "Earn daily commissions", bg: "from-emerald-600 to-teal-700" },
            ].map((banner, i) => (
              <div key={i} className={`snap-center shrink-0 w-[85%] rounded-2xl bg-gradient-to-br ${banner.bg} p-5 text-white shadow-md relative overflow-hidden`}>
                <div className="absolute top-0 right-0 opacity-20 transform translate-x-1/4 -translate-y-1/4">
                  <Sparkles className="w-24 h-24" />
                </div>
                <div className="relative z-10">
                  <h3 className="font-bold text-lg mb-1">{banner.title}</h3>
                  <p className="text-white/80 text-xs font-medium">{banner.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rewards Section */}
        <div className="px-4 mb-8 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-800 px-1">Exclusive Rewards</h2>
          </div>
          
          {/* UPI Reward */}
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

          {/* USDT Reward */}
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
                <div className="text-[11px] text-amber-200/90 mt-0.5">Platform price ₹89.5 + 2% bonus</div>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-white/10 backdrop-blur-sm border border-amber-300/20 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-white/15 transition-colors">
              <div className="flex items-center gap-2 text-[13px] font-bold">
                <span className="text-amber-200">100 USDT</span>
                <ChevronRight className="h-3 w-3 text-amber-400/60" />
                <span className="text-emerald-300">₹9,129 (+₹179 bonus)</span>
              </div>
              <ChevronRight className="h-4 w-4 text-amber-400/70" />
            </div>
          </div>
        </div>

        {/* Active Orders Snapshot */}
        <div className="px-4 mb-8">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <h2 className="text-sm font-bold text-slate-800">Live Orders</h2>
            </div>
            <button className="text-xs font-bold text-primary flex items-center">View All <ChevronRight className="h-3 w-3" /></button>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden divide-y divide-slate-100">
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50">
              <div className="p-2 rounded-full bg-emerald-100">
                <TrendingDown className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">₹5,000.00</span>
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Pending</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">Buy · Order #8892</div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50">
              <div className="p-2 rounded-full bg-rose-100">
                <TrendingUp className="h-4 w-4 text-rose-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">₹1,500.00</span>
                  <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Disputed
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">Sell · Order #8891</div>
              </div>
            </div>
          </div>
        </div>

        {/* Rules */}
        <div className="px-4 mb-8">
          <div className="bg-gradient-to-r from-slate-100 to-slate-50 rounded-2xl p-4 ring-1 ring-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Trading Rules</h3>
                <p className="text-xs text-slate-500 font-medium">Stay safe, read before trading</p>
              </div>
              <button className="bg-white text-xs font-bold text-slate-700 px-3 py-1.5 rounded-full shadow-sm ring-1 ring-slate-200 flex items-center gap-1">
                Read <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                <div className="text-[10px] font-bold text-primary mb-1 uppercase tracking-wider">Buy Rules</div>
                <div className="text-[10px] text-slate-600 leading-relaxed">Always verify name matches payment app before sending money.</div>
              </div>
              <div className="flex-1 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                <div className="text-[10px] font-bold text-fuchsia-600 mb-1 uppercase tracking-wider">Sell Rules</div>
                <div className="text-[10px] text-slate-600 leading-relaxed">Wait for exact amount in bank. Don't trust screenshots.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Nav */}
        <div className="fixed bottom-0 w-full max-w-[420px] bg-white border-t border-slate-200 px-2 py-2 flex justify-between items-center z-50 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.05)] rounded-t-2xl">
          {[
            { icon: Home, label: 'Home', active: true },
            { icon: ArrowDownCircle, label: 'Buy' },
            { icon: ArrowUpCircle, label: 'Sell' },
            { icon: ListOrdered, label: 'Orders' },
            { icon: User, label: 'Profile' },
          ].map((item, i) => (
            <button key={i} className={`flex-1 flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${item.active ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
              <item.icon className={`h-5 w-5 mb-1 ${item.active ? 'fill-primary/20' : ''}`} strokeWidth={item.active ? 2.5 : 2} />
              <span className={`text-[10px] ${item.active ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
