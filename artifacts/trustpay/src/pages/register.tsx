import React, { useEffect, useRef, useState } from "react";
import { useGetMe, useGetAppSettings } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { setAuthToken } from "@/lib/auth";
import { getDeviceFingerprint } from "@/lib/fingerprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Download, ShieldCheck, Zap, Star, ShieldAlert, LogIn,
  Phone, Lock, Gift, ArrowRight, Loader2, Eye, EyeOff, RefreshCw,
} from "lucide-react";
import { API_BASE } from "@/lib/api-config";
import { AuthShell, PremiumInputWrap, PremiumButton, TrustRow, useBranding } from "@/components/auth-shell";

function PWAInstallPopup({ onDownload, onContinue, appName, logoUrl }: { onDownload: () => void; onContinue: () => void; appName: string; logoUrl: string }) {
  const [downloaded, setDownloaded] = useState(false);
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div className="relative w-[min(92vw,400px)] rounded-[36px] overflow-hidden shadow-[0_40px_120px_rgba(234,88,12,0.45)] animate-in fade-in zoom-in-95 duration-300">
        <div className="absolute inset-0 rounded-[36px] ring-1 ring-inset ring-white/20 pointer-events-none z-10" />
        <div className="relative bg-gradient-to-br from-[#c2410c] via-[#ea580c] to-[#f97316] px-6 pt-10 pb-8 flex flex-col items-center overflow-hidden">
          <div className="absolute -top-10 -left-10 w-44 h-44 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-6 -right-6 w-36 h-36 rounded-full bg-amber-300/20 blur-2xl" />
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-orange-300/30 blur-2xl scale-125 animate-pulse" />
            <img src={logoUrl} alt={appName} className="relative w-20 h-20 object-contain drop-shadow-xl" />
          </div>
          <div className="flex gap-0.5 mb-2">{[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-200 text-amber-200" />)}</div>
          <h2 className="text-[24px] font-extrabold text-white tracking-tight text-center drop-shadow">{appName}</h2>
          <p className="mt-1 text-orange-100 text-[13px] text-center font-medium">Secure P2P UPI Trading</p>
        </div>
        <div className="bg-white px-6 pt-5 pb-6">
          {!downloaded ? (
            <>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {[
                  { icon: <Zap className="w-4 h-4 text-amber-500" />, label: "Fast" },
                  { icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />, label: "Secure" },
                  { icon: <Download className="w-4 h-4 text-orange-500" />, label: "Free" },
                ].map((f) => (
                  <div key={f.label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-orange-50 border border-orange-100 py-3 px-2">
                    {f.icon}
                    <span className="text-[11px] font-semibold text-slate-600">{f.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-[13px] text-center text-slate-600 mb-4 leading-relaxed">
                Account created! Download the app and login to get started.
              </p>
              <button
                onClick={() => { onDownload(); setDownloaded(true); }}
                className="w-full h-14 rounded-2xl flex items-center justify-center gap-2.5 font-bold text-[17px] text-white relative overflow-hidden active:scale-[0.97] transition-transform"
                style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)", boxShadow: "0 8px 32px rgba(234,88,12,0.50), 0 4px 10px -4px rgba(249,115,22,0.30), inset 0 1px 0 rgba(255,255,255,0.18)" }}
              >
                <Download className="w-5 h-5" />
                <span>Download APK</span>
              </button>
            </>
          ) : (
              <div className="flex flex-col items-center py-4 gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-emerald-500" />
                </div>
                <div className="text-center">
                  <p className="text-[17px] font-bold text-slate-800 mb-1">Download Started!</p>
                  <p className="text-[13px] text-slate-500 leading-relaxed">
                    APK install hone ke baad mobile me <span className="font-semibold text-orange-600">app</span> automatically aa jayegi.
                    Tab tak aap website pe bhi continue kar sakte hain.
                  </p>
                </div>
                {/* Continue to website: dismiss popup and unlock the web app for the user. */}
                {/* They're already authenticated (token saved), so they land on home logged-in. */}
                <button
                  onClick={onContinue}
                  className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-bold text-[15px] text-white active:scale-[0.97] transition-transform"
                  style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)", boxShadow: "0 6px 20px rgba(234,88,12,0.40)" }}
                >
                  Continue to Website
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function DuplicateDialog({ title, message, onClose, onLogin }: { title: string; message: string; onClose: () => void; onLogin: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div className="relative w-[min(92vw,400px)] rounded-[32px] overflow-hidden shadow-[0_32px_100px_rgba(220,38,38,0.35)] animate-in fade-in zoom-in-95 duration-300">
        <div className="relative bg-gradient-to-br from-[#7f1d1d] via-[#991b1b] to-[#b91c1c] px-5 pt-8 pb-6 flex flex-col items-center overflow-hidden">
          <div className="relative w-16 h-16 rounded-full bg-white/15 border border-white/25 flex items-center justify-center mb-4 shadow-lg">
            <ShieldAlert className="w-8 h-8 text-white" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-200 mb-1">Security Alert</p>
          <h2 className="text-[20px] font-extrabold text-white text-center">{title}</h2>
        </div>
        <div className="bg-white px-6 pt-5 pb-2">
          <p className="text-[15px] text-slate-600 text-center leading-relaxed">{message}</p>
        </div>
        <div className="bg-white px-5 pt-4 pb-6 flex flex-col gap-3">
          <Button onClick={onLogin} className="w-full h-12 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold shadow-lg shadow-red-500/30">
            <LogIn className="w-4 h-4 mr-2" /> Go to Login
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full h-10 rounded-2xl text-slate-400 text-sm">Go Back</Button>
        </div>
      </div>
    </div>
  );
}

function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input type="text" name="website" autoComplete="off" tabIndex={-1} value={value} onChange={(e) => onChange(e.target.value)}
      style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
  );
}

// ─── OTP Input (6 boxes) ──────────────────────────────────────────────────────
function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, "").split("").slice(0, 6);

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      const d = [...digits];
      if (d[i]) { d[i] = ""; onChange(d.join("").trim()); }
      else if (i > 0) { d[i - 1] = ""; onChange(d.join("").trim()); refs.current[i - 1]?.focus(); }
    }
  };
  const handleChange = (i: number, v: string) => {
    const ch = v.replace(/\D/g, "").slice(-1);
    if (!ch) return;
    const d = [...digits];
    d[i] = ch;
    onChange(d.join("").trim());
    if (i < 5) refs.current[i + 1]?.focus();
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text) { onChange(text); refs.current[Math.min(text.length, 5)]?.focus(); }
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }}
          type="tel" inputMode="numeric" maxLength={1}
          value={digits[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          className="w-11 h-12 rounded-xl border-2 border-indigo-200 bg-indigo-50 text-center text-[20px] font-bold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none transition-colors"
        />
      ))}
    </div>
  );
}

function useResendTimer(initial = 60) {
  const [secs, setSecs] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const start = () => {
    setSecs(initial);
    if (ref.current) clearInterval(ref.current);
    ref.current = setInterval(() => setSecs((s) => { if (s <= 1) { clearInterval(ref.current!); return 0; } return s - 1; }), 1000);
  };
  useEffect(() => () => { if (ref.current) clearInterval(ref.current); }, []);
  return { secs, start };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Register() {
  const { data: brandSettings } = useGetAppSettings();
  const { appName, logoUrl } = useBranding();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: isUserLoading } = useGetMe({ query: { queryKey: ["me"], retry: false } });

  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [honeypot, setHoneypot] = useState("");

  // OTP step
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifiedToken, setVerifiedToken] = useState("");
  const { secs, start: startTimer } = useResendTimer(60);

  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [duplicate, setDuplicate] = useState<{ title: string; message: string } | null>(null);

  const apkDownloadUrl = (brandSettings as any)?.apkDownloadUrl || "https://trustpayapp.in";

  useEffect(() => {
    if (user && !isUserLoading && !showInstallPopup) setLocation("/");
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setReferralCode(ref.toUpperCase());
  }, [user, isUserLoading, setLocation, showInstallPopup]);

  const validateForm = (): string | null => {
    if (!/^[6-9]\d{9}$/.test(phone)) return "Enter a valid 10-digit mobile number";
    if (password.length < 6) return "Password must be at least 6 characters";
    if (password !== confirmPassword) return "Passwords don't match";
    if (!referralCode.trim()) return "Referral code is required";
    return null;
  };

  // Step 1: validate form → send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateForm();
    if (err) { toast({ title: err, variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "register", website: honeypot }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || "Failed to send OTP";
        if (msg.includes("already registered") || msg.includes("already registered")) {
          setDuplicate({ title: "Mobile Already Registered", message: "An account already exists for this mobile number. Please login instead." });
          return;
        }
        throw new Error(msg);
      }
      setOtpSent(true);
      setOtp("");
      startTimer();
      toast({ title: "OTP Sent!", description: `A 6-digit OTP has been sent to ${phone}` });
    } catch (err: any) {
      toast({ title: "Failed to send OTP", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: verify OTP → register
  const handleVerifyAndRegister = async () => {
    if (otp.length !== 6) { toast({ title: "Enter the 6-digit OTP", variant: "destructive" }); return; }
    setLoading(true);
    try {
      // Verify OTP
      const vRes = await fetch(`${API_BASE}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "register", code: otp }),
      });
      const vData = await vRes.json().catch(() => ({}));
      if (!vRes.ok) throw new Error(vData?.error || "Wrong OTP. Please try again.");
      const token = vData.verifiedToken;
      setVerifiedToken(token);

      // Register
      const rRes = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone, password, verifiedToken: token,
          deviceFingerprint: getDeviceFingerprint(),
          referralCode: (referralCode.trim() || "TP000001").toUpperCase(),
          website: honeypot,
        }),
      });
      const rData = await rRes.json().catch(() => ({}));
      if (!rRes.ok) {
        const msg = rData?.error || `Registration failed (${rRes.status})`;
        if (rData?.code === "device_limit_reached") {
          setDuplicate({ title: "Device Limit Reached", message: "This device has reached its allowed account limit. Please use your existing account or contact support." });
          return;
        }
        if (msg.includes("1 account is allowed") || msg.includes("already registered")) {
          setDuplicate({ title: "Mobile Already Registered", message: "An account already exists for this mobile number. Please login instead." });
          return;
        }
        throw new Error(msg);
      }
      setShowInstallPopup(true);
      setAuthToken(rData.token);
      toast({ title: "Account created!" });
    } catch (err: any) {
      toast({ title: "Verification failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setOtp("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "register" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to resend OTP");
      startTimer();
      toast({ title: "OTP Resent!", description: `New OTP sent to ${phone}` });
    } catch (err: any) {
      toast({ title: "Resend failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

    const handleWhatsAppOtp = async () => {
      setOtp("");
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/auth/otp/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, purpose: "register", channel: "whatsapp" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to send OTP on WhatsApp");
        startTimer();
        toast({ title: "OTP sent on WhatsApp", description: "Please check your WhatsApp for the OTP." });
      } catch (err: any) {
        toast({ title: "WhatsApp OTP failed", description: err?.message || "Unknown error", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
  
  return (
    <>
      {showInstallPopup && (
          <PWAInstallPopup appName={appName} logoUrl={logoUrl}
            onDownload={async () => {
              // iOS Safari doesn't support beforeinstallprompt, and our APK is
              // Android-only. So on iPhone/iPad we skip the download entirely
              // and just unlock the web app — user can later use Safari's
              // Share → "Add to Home Screen" to get a PWA icon themselves.
              const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
              const isIOS = /iPad|iPhone|iPod/.test(ua)
                || (ua.includes("Mac") && (navigator as any).maxTouchPoints > 1);
              const prompt = (window as any).__pwaPrompt;
              if (prompt) {
                // Android Chrome / supported browser → fire native PWA install.
                await prompt.prompt();
                return;
              }
              if (isIOS) {
                // No native install possible on iOS — send them straight to home.
                setShowInstallPopup(false);
                setLocation("/");
                return;
              }
              // Android (no PWA prompt yet) → APK download.
              if (apkDownloadUrl) window.open(apkDownloadUrl, "_blank");
            }}
            onContinue={() => {
              // User has triggered the download; unlock the web app.
              // They're authenticated already, so we send them straight to home.
              setShowInstallPopup(false);
              setLocation("/");
            }}
          />
        )}
      {duplicate && (
        <DuplicateDialog title={duplicate.title} message={duplicate.message}
          onClose={() => setDuplicate(null)}
          onLogin={() => { setDuplicate(null); setLocation("/login"); }}
        />
      )}

      <AuthShell badge="Join Trusted P2P Network">
        <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">Registration</h1>
        <p className="text-[13px] text-slate-500 mb-4">Create your TrustPay account in seconds.</p>

        <form onSubmit={handleSendOtp} className="space-y-3">
          <Honeypot value={honeypot} onChange={setHoneypot} />

          {/* Mobile Number */}
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold text-slate-700 tracking-wide">Mobile Number</Label>
            <div className="flex gap-2">
              <div className="flex items-center px-3 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-indigo-100 text-sm font-bold text-indigo-700">+91</div>
              <PremiumInputWrap>
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
                <Input type="tel" inputMode="numeric" placeholder="10-digit mobile" value={phone}
                  onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setOtpSent(false); setOtp(""); }}
                  maxLength={10} disabled={otpSent}
                  className="pl-10 h-11 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
              </PremiumInputWrap>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold text-slate-700 tracking-wide">Password</Label>
            <PremiumInputWrap>
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
              <Input type={showPassword ? "text" : "password"} placeholder="At least 6 characters"
                value={password} onChange={(e) => setPassword(e.target.value)} disabled={otpSent}
                className="pl-10 pr-10 h-11 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
              <button type="button" onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </PremiumInputWrap>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold text-slate-700 tracking-wide">Confirm Password</Label>
            <PremiumInputWrap>
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
              <Input type="text" placeholder="Repeat password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} disabled={otpSent}
                className="pl-10 h-11 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
            </PremiumInputWrap>
            <p className="text-[11px] text-slate-400">Shown in plain text so you can verify before submitting.</p>
          </div>

          {/* Referral Code */}
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold text-slate-700 tracking-wide">Referral Code</Label>
            <PremiumInputWrap>
              <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
              <Input placeholder="Invite code" value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())} required disabled={otpSent}
                className="pl-10 h-11 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
            </PremiumInputWrap>
          </div>

          {/* OTP Section — appears after OTP sent */}
          {otpSent && (
            <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-slate-700">Enter OTP</p>
                  <p className="text-[11px] text-slate-500">Sent to +91 {phone}</p>
                </div>
                <button type="button" onClick={() => { setOtpSent(false); setOtp(""); }} className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium">Change number</button>
              </div>
              <OtpBoxes value={otp} onChange={setOtp} />
              <div className="text-[11px] text-slate-400">OTP valid for 5 minutes</div>
                <div className="pt-2 border-t border-indigo-100">
                  <button type="button" onClick={handleWhatsAppOtp} disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[12px] font-semibold transition-colors">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                    Didn't receive OTP? Get it on WhatsApp
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
          {!otpSent ? (
            <PremiumButton disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...</> : <>Verify <ArrowRight className="w-4 h-4" /></>}
            </PremiumButton>
          ) : (
            <PremiumButton type="button" disabled={loading || otp.length !== 6} onClick={handleVerifyAndRegister}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : <><ShieldCheck className="w-4 h-4" /> Create Account</>}
            </PremiumButton>
          )}
        </form>

        <TrustRow />

        <div className="mt-4 text-center text-[13px] text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-600 font-semibold hover:underline">Login here</Link>
        </div>
      </AuthShell>
    </>
  );
}
