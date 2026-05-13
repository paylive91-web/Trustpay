import React, { useState } from "react";
import Layout from "@/components/layout";
import { Link } from "wouter";
import { ChevronLeft, ChevronDown, ChevronUp, ShoppingCart, Store, Shield, AlertCircle, CheckCircle2, Clock, Banknote, Smartphone, Upload, Star, Info } from "lucide-react";

type Step = { icon: React.ReactNode; title: string; desc: string; tip?: string };
type Section = { id: string; color: string; bg: string; border: string; icon: React.ReactNode; heading: string; badge: string; steps: Step[]; warnings?: string[] };

const SECTIONS: Section[] = [
  {
    id: "buy",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: <ShoppingCart className="w-5 h-5" />,
    heading: "Buy Kaise Karein?",
    badge: "Buyer Guide",
    steps: [
      {
        icon: <Smartphone className="w-5 h-5 text-blue-500" />,
        title: "Buy Button Dabao",
        desc: "Home screen pe 'Buy' button dabao. Amount enter karo jo tumhe chahiye.",
        tip: "Minimum aur maximum limit dhyan se padho.",
      },
      {
        icon: <Banknote className="w-5 h-5 text-blue-500" />,
        title: "Seller ka UPI ID Milega",
        desc: "System automatically ek seller dhundega. Seller ka UPI ID, naam aur platform (GPay, PhonePe, Paytm) screen pe aayega.",
        tip: "UPI ID copy karke direct app se payment karo.",
      },
      {
        icon: <CheckCircle2 className="w-5 h-5 text-blue-500" />,
        title: "Exact Amount Bhejo",
        desc: "Jo amount screen pe dikh raha hai, bilkul waisi hi bhejo — ek rupee bhi kam ya zyada nahi. UPI reference note karo.",
        tip: "Payment karte waqt UPI note/remark mein kuch mat likho.",
      },
      {
        icon: <Upload className="w-5 h-5 text-blue-500" />,
        title: "UTR Number aur Screenshot Submit Karo",
        desc: "Payment ke baad UTR number (12 digit) enter karo aur payment screenshot upload karo. 'Submit' dabao.",
        tip: "UTR number payment app ke transaction history mein milta hai.",
      },
      {
        icon: <Clock className="w-5 h-5 text-blue-500" />,
        title: "Seller Confirm Kare",
        desc: "Seller ko kuch minutes milte hain confirm karne ke liye. Confirm hote hi tumhara wallet credit ho jaayega.",
        tip: "Agar seller time pe confirm nahi karta, system auto-confirm ya dispute khol deta hai.",
      },
    ],
    warnings: [
      "Fake UTR ya duplicate screenshot upload karne par -10 Trust penalty lagti hai",
      "Hamesha same amount bhejo jo screen pe dikh raha ho",
    ],
  },
  {
    id: "sell",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: <Store className="w-5 h-5" />,
    heading: "Sell Kaise Karein?",
    badge: "Seller Guide",
    steps: [
      {
        icon: <Smartphone className="w-5 h-5 text-orange-500" />,
        title: "Sell Page Pe Jao",
        desc: "Home screen se 'Sell' button dabao. Apna UPI ID verify karo — yahi buyer ko dikhega.",
        tip: "Ek hi active UPI ID rakho confusion se bachne ke liye.",
      },
      {
        icon: <Store className="w-5 h-5 text-orange-500" />,
        title: "'Start Matching' Dabao",
        desc: "Sell page pe 'Start Matching' button dabao. Ab system tumhe buyers se match karna shuru karega.",
        tip: "Jab tak matching on hai, phone lock mat karo aur app open rakho.",
      },
      {
        icon: <AlertCircle className="w-5 h-5 text-orange-500" />,
        title: "Order Lock Hoga — Alert Aayega",
        desc: "Jab koi buyer match hoga, screen pe 'Order Locked' banner aayega aur alarm bajega. Turant dekho!",
        tip: "Push notifications ON rakho taaki miss na ho.",
      },
      {
        icon: <CheckCircle2 className="w-5 h-5 text-orange-500" />,
        title: "Payment Check Karo",
        desc: "Apne UPI app (GPay/PhonePe/Paytm) mein check karo — exact amount aayi ya nahi. UTR number bhi match karo.",
        tip: "Kabhi bhi sirf screenshot dekh ke confirm mat karo — actual UPI credit check karo.",
      },
      {
        icon: <CheckCircle2 className="w-5 h-5 text-orange-500" />,
        title: "'Yes — Confirm' Dabao",
        desc: "Payment sahi lagi ho toh popup mein 'YES — Confirm' dabao. Tumhara amount release ho jaayega.",
        tip: "Agar payment nahi aayi, 'Dispute' button dabao — turant proof upload karo.",
      },
    ],
    warnings: [
      "Order lock hone ke baad offline mat jao — dispute khul sakta hai aur -2 Trust milega",
      "Confirm karne ki time limit hoti hai — jaldi check karo",
      "Fake payment ya wrong confirm karne par account freeze ho sakta hai",
    ],
  },
  {
    id: "trust",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    icon: <Shield className="w-5 h-5" />,
    heading: "Trust Score kya hai?",
    badge: "Trust System",
    steps: [
      {
        icon: <Star className="w-5 h-5 text-purple-500" />,
        title: "Trust Score kya hota hai?",
        desc: "Har user ka ek Trust Score hota hai. Yeh dikhata hai ki tum platform pe kitne trustworthy ho. Score jitna zyada, utna better.",
      },
      {
        icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
        title: "Score kab badhta hai? (+)",
        desc: "Seller ne payment confirm ki → Buyer ko +10\nSeller offline tha, dispute khula → Buyer ko +2",
      },
      {
        icon: <AlertCircle className="w-5 h-5 text-red-500" />,
        title: "Score kab ghatta hai? (−)",
        desc: "Fake UTR ya duplicate screenshot → -10\nSeller order ke waqt offline → Seller ko -2",
      },
      {
        icon: <Shield className="w-5 h-5 text-red-600" />,
        title: "Account Freeze",
        desc: "Agar Trust Score -50 ya usse neeche chala jaaye, account freeze ho jaata hai aur trading band ho jaati hai.",
        tip: "Score recover hone par (−50 se upar) account auto-unfreeze ho jaata hai.",
      },
    ],
  },
];

function SectionCard({ section }: { section: Section }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`rounded-2xl border ${section.border} overflow-hidden shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between p-4 ${section.bg} text-left`}
      >
        <div className="flex items-center gap-3">
          <span className={`p-2 rounded-xl bg-white/70 shadow-sm ${section.color}`}>{section.icon}</span>
          <div>
            <span className={`text-xs font-semibold uppercase tracking-wide ${section.color} opacity-70`}>{section.badge}</span>
            <h2 className={`font-bold text-base ${section.color}`}>{section.heading}</h2>
          </div>
        </div>
        {open ? <ChevronUp className={`w-5 h-5 ${section.color}`} /> : <ChevronDown className={`w-5 h-5 ${section.color}`} />}
      </button>

      {open && (
        <div className="bg-white px-4 pt-3 pb-4 space-y-4">
          {section.steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className={`w-7 h-7 rounded-full ${section.bg} flex items-center justify-center text-xs font-bold ${section.color} shadow-sm`}>
                  {i + 1}
                </div>
                {i < section.steps.length - 1 && <div className={`w-0.5 flex-1 min-h-[20px] ${section.bg}`} style={{ background: "repeating-linear-gradient(to bottom, #d1d5db 0px, #d1d5db 4px, transparent 4px, transparent 8px)" }} />}
              </div>
              <div className="flex-1 pt-0.5 pb-2">
                <div className="flex items-center gap-2 mb-0.5">
                  {step.icon}
                  <span className="font-semibold text-sm text-gray-800">{step.title}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{step.desc}</p>
                {step.tip && (
                  <div className={`mt-1.5 flex items-start gap-1.5 rounded-lg ${section.bg} px-2.5 py-1.5`}>
                    <Info className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${section.color}`} />
                    <span className={`text-xs ${section.color} font-medium leading-snug`}>{step.tip}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {section.warnings && section.warnings.length > 0 && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-1.5 mt-2">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">Dhyan Rakhein</p>
              {section.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                  <span className="text-xs text-red-700 leading-snug">{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HowToUse() {
  return (
    <Layout>
      <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 border-b border-orange-200 px-4 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <Link href="/support">
            <button className="p-1.5 rounded-lg bg-white/70 hover:bg-white shadow-sm">
              <ChevronLeft className="w-5 h-5 text-orange-700" />
            </button>
          </Link>
          <div>
            <p className="text-xs text-orange-500 font-semibold uppercase tracking-wider">Guide</p>
            <h1 className="text-xl font-bold text-orange-900">How to Use TrustPay</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground text-center px-2">
          Neeche Buy, Sell aur Trust Score ka poora tarika samjhaya gaya hai. Kisi bhi section ko tap karke expand/collapse karo.
        </p>

        {SECTIONS.map(section => (
          <SectionCard key={section.id} section={section} />
        ))}

        <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 p-4 text-center space-y-1">
          <p className="text-sm font-semibold text-gray-700">Koi aur sawaal hai?</p>
          <p className="text-xs text-gray-500">Support se baat karo — Telegram pe available hain</p>
          <Link href="/support">
            <button className="mt-2 px-4 py-2 rounded-full bg-orange-500 text-white text-xs font-bold shadow hover:bg-orange-600 transition-colors">
              Support se Contact Karo
            </button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
