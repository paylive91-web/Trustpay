import React, { useState } from "react";
import Layout from "@/components/layout";
import { Link } from "wouter";
import {
  ChevronLeft, ChevronDown, ChevronUp, ShoppingCart, Store, Shield,
  AlertCircle, CheckCircle2, Clock, Banknote, Smartphone, Upload, Star, Info,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;

function PrivacyImg({ src, overlays, alt }: {
  src: string;
  alt: string;
  overlays?: { top: string; left: string; width: string; height: string }[];
}) {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-black">
      <img src={src} alt={alt} className="w-full block" loading="lazy" />
      {overlays?.map((o, i) => (
        <div
          key={i}
          className="absolute bg-slate-800 rounded"
          style={{ top: o.top, left: o.left, width: o.width, height: o.height }}
        />
      ))}
    </div>
  );
}

type BuyStep = {
  num: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
  tip?: string;
  img?: string;
  overlays?: { top: string; left: string; width: string; height: string }[];
};

const BUY_STEPS: BuyStep[] = [
  {
    num: 1,
    icon: <Smartphone className="w-5 h-5 text-blue-500" />,
    title: "Home pe 'BUY' dabao",
    desc: "Home screen pe neela 'BUY' button dabao.",
    tip: "Make sure tumhara UPI ID linked hai — 'Manage' se dekh sakte ho.",
    img: `${BASE}guide-buy-1-home.jpg`,
    overlays: [
      { top: "3.5%", left: "52%", width: "43%", height: "5.5%" },
    ],
  },
  {
    num: 2,
    icon: <Banknote className="w-5 h-5 text-blue-500" />,
    title: "Order chunno aur 'Buy' dabao",
    desc: "Available Orders mein se koi bhi order chuno aur 'Buy' button dabao. Amount, Income aur Quota sab dikh raha hai.",
    tip: "Online wale orders prefer karo — seller turant confirm karega.",
    img: `${BASE}guide-buy-2-orders.jpg`,
  },
  {
    num: 3,
    icon: <CheckCircle2 className="w-5 h-5 text-blue-500" />,
    title: "QR scan karo ya UPI ID copy karo",
    desc: "Order lock hone ke baad seller ka UPI ID milega. QR scan karo ya Copy button se ID copy karo — exactly itni hi amount bhejo jo screen pe dikh rahi hai.",
    tip: "Payment karte waqt UPI remark/note mein kuch mat likho.",
    img: `${BASE}guide-buy-3-payment.jpg`,
    overlays: [
      { top: "67.5%", left: "2%", width: "67%", height: "5%" },
      { top: "71%",  left: "2%", width: "55%", height: "4%" },
    ],
  },
  {
    num: 4,
    icon: <Upload className="w-5 h-5 text-blue-500" />,
    title: "UTR daalo aur Screenshot upload karo",
    desc: "Payment ke baad apne UPI app se UTR number (12 digit) copy karo — isko 'UTR / Reference Number' field mein daalo. Phir payment ka screenshot upload karo.",
    tip: "UTR number GPay / PhonePe / Paytm ke transaction history mein milta hai.",
    img: `${BASE}guide-buy-4-utr.jpg`,
    overlays: [
      { top: "7%", left: "2%", width: "67%", height: "5%" },
      { top: "11%", left: "2%", width: "55%", height: "4%" },
    ],
  },
  {
    num: 5,
    icon: <CheckCircle2 className="w-5 h-5 text-blue-500" />,
    title: "Confirm karo aur 'Yes, Submit' dabao",
    desc: "Submit Payment Proof dabane pe ek confirmation popup aayega. Dhyan se padho aur 'Yes, Submit' dabao — sirf tab jab tumne actually payment kar di ho.",
    tip: "Fake UTR ya galat screenshot submit karne par -10 Trust penalty lagti hai.",
    img: `${BASE}guide-buy-5-confirm.jpg`,
    overlays: [
      { top: "63%", left: "2%", width: "68%", height: "5%" },
    ],
  },
  {
    num: 6,
    icon: <Clock className="w-5 h-5 text-blue-500" />,
    title: "Seller ka wait karo",
    desc: "Proof submit hone ke baad 'Payment submitted — waiting for seller' screen dikhegi. Seller 15 minute mein confirm karega — auto-confirm countdown bhi dikh raha hai.",
    tip: "Agar seller 15 minute mein confirm nahi karta, Dispute button activate ho jaayega.",
    img: `${BASE}guide-buy-6-submitted.jpg`,
  },
  {
    num: 7,
    icon: <Star className="w-5 h-5 text-blue-500" />,
    title: "Confirmed! Orders mein dekho",
    desc: "Seller confirm karte hi tumhara order 'Confirmed' ho jaayega aur reward ke saath wallet mein amount aa jaayegi. My Orders mein sabkuch track kar sakte ho.",
    img: `${BASE}guide-buy-7-orders.jpg`,
    overlays: [
      { top: "53%", left: "37%", width: "55%", height: "3.5%" },
      { top: "66%", left: "37%", width: "55%", height: "3.5%" },
      { top: "79%", left: "37%", width: "55%", height: "3.5%" },
    ],
  },
];

type SellStep = { icon: React.ReactNode; title: string; desc: string; tip?: string };

const SELL_STEPS: SellStep[] = [
  {
    icon: <Smartphone className="w-5 h-5 text-orange-500" />,
    title: "Sell page pe jao",
    desc: "Home screen se 'SELL' button dabao. Apna UPI ID verify karo — yahi buyer ko dikhega.",
    tip: "Ek hi active UPI ID rakho confusion se bachne ke liye.",
  },
  {
    icon: <Store className="w-5 h-5 text-orange-500" />,
    title: "'Start Matching' dabao",
    desc: "Sell page pe 'Start Matching' button dabao. Ab system tumhe buyers se match karna shuru karega.",
    tip: "Jab tak matching on hai, phone lock mat karo aur app open rakho.",
  },
  {
    icon: <AlertCircle className="w-5 h-5 text-orange-500" />,
    title: "Order Lock hoga — Alert aayega",
    desc: "Jab koi buyer match hoga, screen pe 'Order Locked' banner aayega aur alarm bajega. Turant dekho!",
    tip: "Push notifications ON rakho taaki miss na ho.",
  },
  {
    icon: <CheckCircle2 className="w-5 h-5 text-orange-500" />,
    title: "Payment check karo apne UPI app mein",
    desc: "Apne UPI app (GPay / PhonePe / Paytm) mein check karo — exact amount aayi ya nahi. UTR bhi match karo.",
    tip: "Kabhi bhi sirf screenshot dekh ke confirm mat karo — actual UPI credit check karo.",
  },
  {
    icon: <CheckCircle2 className="w-5 h-5 text-orange-500" />,
    title: "'YES — Confirm' dabao",
    desc: "Payment sahi lagi ho toh popup mein 'YES — Received' dabao. Amount release ho jaayega.",
    tip: "Agar payment nahi aayi toh 'Dispute' dabao — proof upload karo turant.",
  },
];

const TRUST_STEPS = [
  {
    icon: <Star className="w-5 h-5 text-purple-500" />,
    title: "Trust Score kya hota hai?",
    desc: "Har user ka ek Trust Score hota hai jo dikhata hai tum platform pe kitne trustworthy ho. Score jitna zyada, utna better.",
  },
  {
    icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    title: "Score kab badhta hai? (+)",
    desc: "Seller ne payment confirm ki → Buyer ko +10\nSeller offline tha, dispute khula → Buyer ko +2",
  },
  {
    icon: <AlertCircle className="w-5 h-5 text-red-500" />,
    title: "Score kab ghatta hai? (−)",
    desc: "Fake UTR ya duplicate screenshot → −10\nSeller order ke waqt offline → Seller ko −2",
  },
  {
    icon: <Shield className="w-5 h-5 text-red-600" />,
    title: "Account Freeze",
    desc: "Agar Trust Score −50 ya usse neeche chala jaaye, account freeze ho jaata hai aur trading band ho jaati hai.",
    tip: "Score recover hone par (−50 se upar) account auto-unfreeze ho jaata hai.",
  },
];

function TipBox({ tip, color }: { tip: string; color: string }) {
  return (
    <div className={`flex items-start gap-1.5 rounded-lg ${color} px-2.5 py-1.5 mt-1.5`}>
      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-inherit opacity-70" />
      <span className="text-xs font-medium leading-snug">{tip}</span>
    </div>
  );
}

function BuySection() {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border border-blue-200 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 bg-blue-50 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-white/70 shadow-sm text-blue-700"><ShoppingCart className="w-5 h-5" /></span>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 opacity-70">Buyer Guide</span>
            <h2 className="font-bold text-base text-blue-700">Buy Kaise Karein?</h2>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-blue-700" /> : <ChevronDown className="w-5 h-5 text-blue-700" />}
      </button>

      {open && (
        <div className="bg-white px-4 pt-3 pb-4 space-y-6">
          {BUY_STEPS.map((step) => (
            <div key={step.num} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-700 shadow-sm shrink-0">
                  {step.num}
                </div>
                {step.icon}
                <span className="font-semibold text-sm text-gray-800">{step.title}</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed pl-9">{step.desc}</p>
              {step.tip && <div className="pl-9"><TipBox tip={step.tip} color="bg-blue-50 text-blue-800" /></div>}
              {step.img && (
                <div className="pl-2 pr-0">
                  <PrivacyImg src={step.img} alt={`Step ${step.num}`} overlays={step.overlays} />
                </div>
              )}
            </div>
          ))}

          <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-1.5">
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">Dhyan Rakhein</p>
            {[
              "Fake UTR ya duplicate screenshot upload karne par -10 Trust penalty lagti hai",
              "Hamesha same amount bhejo jo screen pe dikh raha ho",
            ].map((w, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                <span className="text-xs text-red-700 leading-snug">{w}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SellSection() {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border border-orange-200 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 bg-orange-50 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-white/70 shadow-sm text-orange-700"><Store className="w-5 h-5" /></span>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-orange-700 opacity-70">Seller Guide</span>
            <h2 className="font-bold text-base text-orange-700">Sell Kaise Karein?</h2>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-orange-700" /> : <ChevronDown className="w-5 h-5 text-orange-700" />}
      </button>

      {open && (
        <div className="bg-white px-4 pt-3 pb-4 space-y-4">
          {SELL_STEPS.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center text-xs font-bold text-orange-700 shadow-sm">
                  {i + 1}
                </div>
                {i < SELL_STEPS.length - 1 && (
                  <div className="w-0.5 flex-1 min-h-[20px]" style={{ background: "repeating-linear-gradient(to bottom, #d1d5db 0px, #d1d5db 4px, transparent 4px, transparent 8px)" }} />
                )}
              </div>
              <div className="flex-1 pt-0.5 pb-2">
                <div className="flex items-center gap-2 mb-0.5">
                  {step.icon}
                  <span className="font-semibold text-sm text-gray-800">{step.title}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{step.desc}</p>
                {step.tip && <TipBox tip={step.tip} color="bg-orange-50 text-orange-800" />}
              </div>
            </div>
          ))}

          <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-1.5">
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">Dhyan Rakhein</p>
            {[
              "Order lock hone ke baad offline mat jao — dispute khul sakta hai aur -2 Trust milega",
              "Confirm karne ki time limit hoti hai — jaldi check karo",
            ].map((w, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                <span className="text-xs text-red-700 leading-snug">{w}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TrustSection() {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border border-purple-200 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 bg-purple-50 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-white/70 shadow-sm text-purple-700"><Shield className="w-5 h-5" /></span>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-purple-700 opacity-70">Trust System</span>
            <h2 className="font-bold text-base text-purple-700">Trust Score kya hai?</h2>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-purple-700" /> : <ChevronDown className="w-5 h-5 text-purple-700" />}
      </button>

      {open && (
        <div className="bg-white px-4 pt-3 pb-4 space-y-4">
          {TRUST_STEPS.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-7 h-7 rounded-full bg-purple-50 flex items-center justify-center text-xs font-bold text-purple-700 shadow-sm">
                  {i + 1}
                </div>
                {i < TRUST_STEPS.length - 1 && (
                  <div className="w-0.5 flex-1 min-h-[20px]" style={{ background: "repeating-linear-gradient(to bottom, #d1d5db 0px, #d1d5db 4px, transparent 4px, transparent 8px)" }} />
                )}
              </div>
              <div className="flex-1 pt-0.5 pb-2">
                <div className="flex items-center gap-2 mb-0.5">
                  {step.icon}
                  <span className="font-semibold text-sm text-gray-800">{step.title}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{step.desc}</p>
                {step.tip && <TipBox tip={step.tip} color="bg-purple-50 text-purple-800" />}
              </div>
            </div>
          ))}
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
          Real screenshots ke saath step-by-step guide. Kisi bhi section ko tap karke expand/collapse karo.
        </p>

        <BuySection />
        <SellSection />
        <TrustSection />

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
