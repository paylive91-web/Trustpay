import React, { useEffect, useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { setAuthToken } from "@/lib/auth";
import { getDeviceFingerprint } from "@/lib/fingerprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import logoPath from "@assets/file_00000000da60720ba5a8a74acd96c937_1776335785514.png";
import { useGetAppSettings } from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { Download, ShieldCheck, Zap, Star, ShieldAlert, LogIn } from "lucide-react";

import { API_BASE } from "@/lib/api-config";

function PWAInstallPopup({ onDone, appName, logoUrl }: { onDone: () => void; appName: string; logoUrl: string }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Locked backdrop — no click to dismiss */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      <div className="relative w-[min(92vw,400px)] rounded-[36px] overflow-hidden shadow-[0_40px_120px_rgba(79,70,229,0.55)] animate-in fade-in zoom-in-95 duration-300">

        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-[36px] ring-1 ring-inset ring-white/20 pointer-events-none z-10" />

        {/* Hero gradient header */}
        <div className="relative bg-gradient-to-br from-[#312e81] via-[#4f46e5] to-[#7c3aed] px-6 pt-10 pb-8 flex flex-col items-center overflow-hidden">
          {/* Decorative orbs */}
          <div className="absolute -top-10 -left-10 w-44 h-44 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-6 -right-6 w-36 h-36 rounded-full bg-violet-400/20 blur-2xl pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

          {/* App icon */}
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-[22px] bg-white/20 blur-md scale-110" />
            <img
              src={logoUrl}
              alt={appName}
              className="relative w-20 h-20 rounded-[22px] object-contain shadow-xl ring-2 ring-white/30"
            />
          </div>

          {/* Stars */}
          <div className="flex gap-0.5 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
            ))}
          </div>

          <h2 className="text-[24px] font-extrabold text-white tracking-tight text-center drop-shadow">
            {appName}
          </h2>
          <p className="mt-1 text-indigo-200 text-[13px] text-center font-medium">
            Secure P2P UPI Trading
          </p>
        </div>

        {/* Feature pills */}
        <div className="bg-white px-6 pt-5 pb-4">
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { icon: <Zap className="w-4 h-4 text-amber-500" />, label: "Fast" },
              { icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />, label: "Secure" },
              { icon: <Download className="w-4 h-4 text-indigo-500" />, label: "Free" },
            ].map((f) => (
              <div key={f.label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-slate-50 border border-slate-100 py-3 px-2">
                {f.icon}
                <span className="text-[11px] font-semibold text-slate-600">{f.label}</span>
              </div>
            ))}
          </div>

          {/* Download button */}
          <button
            onClick={onDone}
            className="w-full h-14 rounded-2xl flex items-center justify-center gap-2.5 font-bold text-[17px] text-white relative overflow-hidden active:scale-[0.97] transition-transform disabled:opacity-70"
            style={{
              background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)",
              boxShadow: "0 8px 32px rgba(99,66,237,0.45), 0 2px 8px rgba(99,66,237,0.25)",
            }}
          >
            <Download className="w-5 h-5 relative z-10" />
            <span className="relative z-10">Download APK</span>
          </button>

        </div>
      </div>
    </div>
  );
}

export default function Register() {
  const { data: brandSettings } = useGetAppSettings();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: isUserLoading } = useGetMe({ query: { queryKey: ["me"], retry: false } });

  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const appName = (brandSettings as any)?.appName || "TrustPay";
  const logoUrl = (brandSettings as any)?.appLogoUrl || logoPath;
  const apkDownloadUrl = (brandSettings as any)?.apkDownloadUrl || "";

  useEffect(() => {
    if (user && !isUserLoading) setLocation("/");
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setReferralCode(ref.toUpperCase());
  }, [user, isUserLoading, setLocation]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      toast({ title: "Username must be 3-20 chars (letters, numbers, _)", variant: "destructive" });
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const body: any = { username, phone, password, deviceFingerprint: getDeviceFingerprint(), referralCode: (referralCode.trim() || "TP000001").toUpperCase() };
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setAuthToken(data.token);
      toast({ title: "Account created successfully!" });

      // Show APK download popup after registration
      if ((brandSettings as any)?.forceAppDownload || apkDownloadUrl) {
        setShowInstallPopup(true);
      } else {
        setLocation("/");
      }
    } catch (err: any) {
      if (err.message && (err.message.includes("1 account is allowed") || err.message.includes("accounts are allowed per mobile device"))) {
        setShowDuplicateDialog(true);
      } else {
        toast({ title: "Registration failed", description: err.message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showBottomNav={false}>
      {showInstallPopup && (
        <PWAInstallPopup
          appName={appName}
          logoUrl={logoUrl}
          onDone={() => {
            setShowInstallPopup(false);
            if (apkDownloadUrl) window.open(apkDownloadUrl, "_blank");
            setLocation("/");
          }}
        />
      )}

      {showDuplicateDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
          <div className="relative w-[min(92vw,400px)] rounded-[32px] overflow-hidden shadow-[0_32px_100px_rgba(220,38,38,0.35)] animate-in fade-in zoom-in-95 duration-300">
            <div className="absolute inset-0 rounded-[32px] ring-1 ring-inset ring-white/20 pointer-events-none z-10" />

            {/* Header */}
            <div className="relative bg-gradient-to-br from-[#7f1d1d] via-[#991b1b] to-[#b91c1c] px-5 pt-8 pb-6 flex flex-col items-center overflow-hidden">
              <div className="absolute -top-8 -left-8 w-36 h-36 rounded-full bg-white/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-4 -right-4 w-28 h-28 rounded-full bg-red-400/20 blur-2xl pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

              <div className="relative z-10 w-16 h-16 rounded-full bg-white/15 border border-white/25 flex items-center justify-center mb-4 shadow-lg">
                <ShieldAlert className="w-8 h-8 text-white" />
              </div>
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-red-200 mb-1">Security Alert</p>
              <h2 className="text-center text-[20px] font-extrabold tracking-tight text-white drop-shadow-sm">Device Already Registered</h2>
            </div>

            {/* Body */}
            <div className="bg-white px-6 pt-5 pb-2">
              <p className="text-[15px] leading-[1.65] text-slate-600 text-center">
                Is device par pehle se ek account registered hai.
              </p>
              <p className="text-[14px] leading-[1.6] text-slate-500 text-center mt-2">
                Ek mobile par sirf <span className="font-semibold text-red-600">1 account</span> allowed hai. Apne purane account mein login karo.
              </p>
            </div>

            {/* Footer */}
            <div className="bg-white px-5 pt-4 pb-6 flex flex-col gap-3">
              <Button
                onClick={() => { setShowDuplicateDialog(false); setLocation("/login"); }}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-white text-[15px] font-bold shadow-lg shadow-red-500/30 hover:opacity-95 active:scale-[0.98] transition-all"
              >
                <LogIn className="w-4 h-4 mr-2" /> Login Karo
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowDuplicateDialog(false)}
                className="w-full h-10 rounded-2xl text-slate-400 text-sm hover:bg-slate-50"
              >
                Wapas Jao
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <img src={logoUrl} alt={`${appName} Logo`} className="w-24 h-24 mb-2 rounded-2xl object-contain" />
        <div className="text-xl font-bold mb-6 text-primary">{appName}</div>
        <h1 className="text-2xl font-bold mb-2">Create Account</h1>
        <p className="text-muted-foreground mb-8 text-center">Sign up with your mobile number</p>
        <form onSubmit={handleRegister} className="w-full space-y-4">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input
              type="text"
              placeholder="3-20 chars, letters/numbers/underscore"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))}
              maxLength={20}
            />
          </div>
          <div className="space-y-2">
            <Label>Mobile Number</Label>
            <div className="flex gap-2">
              <div className="flex items-center px-3 bg-muted rounded-md border text-sm font-medium">+91</div>
              <Input
                type="tel"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                maxLength={10}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Confirm Password</Label>
            <Input
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Referral Code</Label>
            <Input
              placeholder="Enter invite code"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              required
            />
          </div>
          <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </Button>
        </form>
        <div className="mt-8 text-sm">
          Already have an account? <Link href="/login" className="text-primary font-medium">Login here</Link>
        </div>
      </div>
    </Layout>
  );
}
