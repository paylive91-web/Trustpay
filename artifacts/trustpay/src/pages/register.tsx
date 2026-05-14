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
  Phone, Lock, Gift, ArrowRight, Loader2, Eye, EyeOff,
  KeyRound, RefreshCw,
} from "lucide-react";
import { API_BASE } from "@/lib/api-config";
import { AuthShell, PremiumInputWrap, PremiumButton, TrustRow, useBranding } from "@/components/auth-shell";

// ─── PWA Install Popup ────────────────────────────────────────────────────────
function PWAInstallPopup({ onDownload, appName, logoUrl }: { onDownload: () => void; appName: string; logoUrl: string }) {
  const [downloaded, setDownloaded] = useState(false);
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div className="relative w-[min(92vw,400px)] rounded-[36px] overflow-hidden shadow-[0_40px_120px_rgba(79,70,229,0.55)] animate-in fade-in zoom-in-95 duration-300">
        <div className="absolute inset-0 rounded-[36px] ring-1 ring-inset ring-white/20 pointer-events-none z-10" />
        <div className="relative bg-gradient-to-br from-[#312e81] via-[#4f46e5] to-[#7c3aed] px-6 pt-10 pb-8 flex flex-col items-center overflow-hidden">
          <div className="absolute -top-10 -left-10 w-44 h-44 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-6 -right-6 w-36 h-36 rounded-full bg-violet-400/20 blur-2xl" />
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-[22px] bg-white/20 blur-md scale-110" />
            <img src={logoUrl} alt={appName} className="relative w-20 h-20 rounded-[22px] object-contain shadow-xl ring-2 ring-white/30" />
          </div>
          <div className="flex gap-0.5 mb-2">{[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />)}</div>
          <h2 className="text-[24px] font-extrabold text-white tracking-tight text-center drop-shadow">{appName}</h2>
          <p className="mt-1 text-indigo-200 text-[13px] text-center font-medium">Secure P2P UPI Trading</p>
        </div>
        <div className="bg-white px-6 pt-5 pb-6">
          {!downloaded ? (
            <>
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
              <p className="text-[13px] text-center text-slate-600 mb-4 leading-relaxed">
                Account created! Download the app and login to get started.
              </p>
              <button
                onClick={() => { onDownload(); setDownloaded(true); }}
                className="w-full h-14 rounded-2xl flex items-center justify-center gap-2.5 font-bold text-[17px] text-white relative overflow-hidden active:scale-[0.97] transition-transform"
                style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)", boxShadow: "0 8px 32px rgba(99,66,237,0.45)" }}
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
                  Install the APK, then open the app and <span className="font-semibold text-indigo-600">Login</span> with your mobile number and password.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Duplicate Account Dialog ─────────────────────────────────────────────────
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
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="tel"
          inputMode="numeric"
          maxLength={1}
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

// ─── Resend countdown ─────────────────────────────────────────────────────────
function useResendTimer(initial = 60) {
  const [secs, setSecs] = useState(initial);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const start = () => {
    setSecs(initial);
    if (ref.current) clearInterval(ref.current);
    ref.current = setInterval(() => setSecs((s) => { if (s <= 1) { clearInterval(ref.current!); return 0; } return s - 1; }), 1000);
  };
  useEffect(() => { return () => { if (ref.current) clearInterval(ref.current); }; }, []);
  return { secs, start };
}

// ─── Main Register Page ───────────────────────────────────────────────────────
type Step = "phone" | "otp" | "form";

export default function Register() {
  const { data: brandSettings } = useGetAppSettings();
  const { appName, logoUrl } = useBranding();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: isUserLoading } = useGetMe({ query: { queryKey: ["me"], retry: false } });

  // Steps: phone → otp → form
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [verifiedToken, setVerifiedToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [duplicate, setDuplicate] = useState<{ title: string; message: string } | null>(null);
  const { secs, start: startTimer } = useResendTimer(60);

  const apkDownloadUrl = (brandSettings as any)?.apkDownloadUrl || "https://trustpayapp.in";

  useEffect(() => {
    if (user && !isUserLoading && !showInstallPopup) setLocation("/");
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setReferralCode(ref.toUpperCase());
  }, [user, isUserLoading, setLocation, showInstallPopup]);

  // ── Step 1: Send OTP ────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast({ title: "Valid 10-digit mobile number enter karein", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "register", website: honeypot }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || "OTP send nahi hua";
        if (msg.includes("already registered") || msg.includes("already registered")) {
          setDuplicate({ title: "Mobile Already Registered", message: "Is number se pehle se account bana hua hai. Please login karein." });
          return;
        }
        throw new Error(msg);
      }
      setStep("otp");
      startTimer();
      toast({ title: "OTP bheji gayi!", description: `${phone} par 6-digit OTP bheja gaya hai` });
    } catch (err: any) {
      toast({ title: "OTP send failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ──────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast({ title: "6-digit OTP enter karein", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "register", code: otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "OTP galat hai");
      setVerifiedToken(data.verifiedToken);
      setStep("form");
      toast({ title: "Mobile verify ho gaya!", description: "Ab account details bharo" });
    } catch (err: any) {
      toast({ title: "OTP verify nahi hua", description: err?.message || "Wrong OTP", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Register ────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast({ title: "Password kam se kam 6 characters ka hona chahiye", variant: "destructive" }); return; }
    if (password !== confirmPassword) { toast({ title: "Passwords match nahi kar rahe", variant: "destructive" }); return; }
    if (!referralCode.trim()) { toast({ title: "Referral code required hai", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone, password, verifiedToken,
          deviceFingerprint: getDeviceFingerprint(),
          referralCode: (referralCode.trim() || "TP000001").toUpperCase(),
          website: honeypot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || `Registration failed (${res.status})`;
        if (data?.code === "device_limit_reached") {
          setDuplicate({ title: "Device Limit Reached", message: "Is device se max accounts ban gaye hain. Pehle wala account use karein ya support se contact karein." });
          return;
        }
        if (msg.includes("1 account is allowed") || msg.includes("already registered")) {
          setDuplicate({ title: "Mobile Already Registered", message: "Is number se pehle se account hai. Please login karein." });
          return;
        }
        throw new Error(msg);
      }
      setShowInstallPopup(true);
      setAuthToken(data.token);
      toast({ title: "Account ban gaya!" });
    } catch (err: any) {
      toast({ title: "Registration failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showInstallPopup && (
        <PWAInstallPopup appName={appName} logoUrl={logoUrl}
          onDownload={async () => {
            const prompt = (window as any).__pwaPrompt;
            if (prompt) await prompt.prompt();
            else if (apkDownloadUrl) window.open(apkDownloadUrl, "_blank");
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
        <Honeypot value={honeypot} onChange={setHoneypot} />

        {/* ── Step Indicator ── */}
        <div className="flex items-center gap-2 mb-5">
          {(["phone", "otp", "form"] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold transition-colors ${step === s ? "bg-indigo-600 text-white" : (["phone","otp","form"].indexOf(step) > i ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400")}`}>
                {["phone","otp","form"].indexOf(step) > i ? <ShieldCheck className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < 2 && <div className={`flex-1 h-0.5 rounded-full transition-colors ${["phone","otp","form"].indexOf(step) > i ? "bg-emerald-400" : "bg-slate-100"}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* ── Step 1: Phone ── */}
        {step === "phone" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">Mobile Verify Karein</h1>
              <p className="text-[13px] text-slate-500 mt-0.5">Registration ke liye OTP se mobile verify karein</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-slate-700 tracking-wide">Mobile Number</Label>
              <div className="flex gap-2">
                <div className="flex items-center px-3 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-indigo-100 text-sm font-bold text-indigo-700">+91</div>
                <PremiumInputWrap>
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
                  <Input type="tel" inputMode="numeric" placeholder="10-digit mobile" value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    maxLength={10} onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    className="pl-10 h-11 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                </PremiumInputWrap>
              </div>
            </div>
            <PremiumButton disabled={loading || phone.length !== 10} onClick={handleSendOtp} type="button">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> OTP bhej rahe hain...</> : <>OTP Bhejo <ArrowRight className="w-4 h-4" /></>}
            </PremiumButton>
          </div>
        )}

        {/* ── Step 2: OTP ── */}
        {step === "otp" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">OTP Enter Karein</h1>
              <p className="text-[13px] text-slate-500 mt-0.5">
                +91 {phone} par 6-digit OTP bheja gaya hai
              </p>
            </div>
            <div className="space-y-3">
              <OtpBoxes value={otp} onChange={setOtp} />
              <p className="text-[11px] text-slate-400 text-center">OTP 5 minutes mein expire ho jaata hai</p>
            </div>
            <PremiumButton disabled={loading || otp.length !== 6} onClick={handleVerifyOtp} type="button">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verify kar rahe hain...</> : <>OTP Verify Karein <ShieldCheck className="w-4 h-4" /></>}
            </PremiumButton>
            <div className="flex items-center justify-between text-[12px]">
              <button type="button" onClick={() => { setStep("phone"); setOtp(""); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                ← Number badlo
              </button>
              {secs > 0 ? (
                <span className="text-slate-400">Resend {secs}s mein</span>
              ) : (
                <button type="button" disabled={loading}
                  onClick={async () => { setOtp(""); await handleSendOtp(); }}
                  className="text-indigo-600 font-semibold flex items-center gap-1 hover:text-indigo-800 transition-colors">
                  <RefreshCw className="w-3 h-3" /> Resend OTP
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Account Details ── */}
        {step === "form" && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">Account Details</h1>
              <p className="text-[13px] text-slate-500 mt-0.5">
                <ShieldCheck className="inline w-3.5 h-3.5 text-emerald-500 mr-1" />
                <span className="text-emerald-600 font-semibold">+91 {phone}</span> verify ho gaya
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-slate-700 tracking-wide">Password</Label>
              <PremiumInputWrap>
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
                <Input type={showPassword ? "text" : "password"} placeholder="Kam se kam 6 characters"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                <button type="button" onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </PremiumInputWrap>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-slate-700 tracking-wide">Confirm Password</Label>
              <PremiumInputWrap>
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
                <Input type="text" placeholder="Password dobara likhein"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 h-11 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
              </PremiumInputWrap>
              <p className="text-[11px] text-slate-400">Plain text mein dikhta hai taaki aap verify kar sakein</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-slate-700 tracking-wide">Referral Code</Label>
              <PremiumInputWrap>
                <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
                <Input placeholder="Invite code" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} required
                  className="pl-10 h-11 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
              </PremiumInputWrap>
            </div>

            <PremiumButton disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Account ban raha hai...</> : <>Account Banao <ArrowRight className="w-4 h-4" /></>}
            </PremiumButton>
          </form>
        )}

        <TrustRow />

        <div className="mt-4 text-center text-[13px] text-slate-500">
          Pehle se account hai?{" "}
          <Link href="/login" className="text-indigo-600 font-semibold hover:underline">Login karein</Link>
        </div>
      </AuthShell>
    </>
  );
}
