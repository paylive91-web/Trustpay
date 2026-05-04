import React, { useEffect, useState } from "react";
import { useGetMe, useGetAppSettings } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { setAuthToken } from "@/lib/auth";
import { getDeviceFingerprint } from "@/lib/fingerprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout";
import { Download, ShieldCheck, Zap, Star, ShieldAlert, LogIn, Phone, Lock, User as UserIcon, Gift, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/api-config";

const logoPath = `${import.meta.env.BASE_URL}trustpay-logo.png`;

// ─── PWA install popup (shown post-registration) ──────────────────────────
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

// ─── Premium duplicate-account dialog ─────────────────────────────────────
function DuplicateDialog({ onClose, onLogin }: { onClose: () => void; onLogin: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div className="relative w-[min(92vw,400px)] rounded-[32px] overflow-hidden shadow-[0_32px_100px_rgba(220,38,38,0.35)] animate-in fade-in zoom-in-95 duration-300">
        <div className="relative bg-gradient-to-br from-[#7f1d1d] via-[#991b1b] to-[#b91c1c] px-5 pt-8 pb-6 flex flex-col items-center overflow-hidden">
          <div className="relative w-16 h-16 rounded-full bg-white/15 border border-white/25 flex items-center justify-center mb-4 shadow-lg">
            <ShieldAlert className="w-8 h-8 text-white" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-200 mb-1">Security Alert</p>
          <h2 className="text-[20px] font-extrabold text-white">Mobile Already Registered</h2>
        </div>
        <div className="bg-white px-6 pt-5 pb-2">
          <p className="text-[15px] text-slate-600 text-center leading-relaxed">
            Is mobile number par pehle se ek account hai. Ek mobile par sirf <span className="font-semibold text-red-600">1 account</span> allowed hai.
          </p>
        </div>
        <div className="bg-white px-5 pt-4 pb-6 flex flex-col gap-3">
          <Button onClick={onLogin} className="w-full h-12 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold shadow-lg shadow-red-500/30">
            <LogIn className="w-4 h-4 mr-2" /> Login Karo
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full h-10 rounded-2xl text-slate-400 text-sm">Wapas Jao</Button>
        </div>
      </div>
    </div>
  );
}

// Hidden honeypot field — bots auto-fill all visible inputs. Real users
// never see or touch this, so any non-empty value is silently dropped.
function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      name="website"
      autoComplete="off"
      tabIndex={-1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      aria-hidden="true"
    />
  );
}

type Step = "form" | "otp";

export default function Register() {
  const { data: brandSettings } = useGetAppSettings();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: isUserLoading } = useGetMe({ query: { queryKey: ["me"], retry: false } });

  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [otp, setOtp] = useState("");
  const [verifiedToken, setVerifiedToken] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const appName = (brandSettings as any)?.appName || "TrustPay";
  const logoUrl = (brandSettings as any)?.appLogoUrl || logoPath;
  const apkDownloadUrl = (brandSettings as any)?.apkDownloadUrl || "https://trustpay-l0xq.onrender.com";

  useEffect(() => {
    if (user && !isUserLoading && !showInstallPopup) setLocation("/");
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setReferralCode(ref.toUpperCase());
  }, [user, isUserLoading, setLocation, showInstallPopup]);

  // Resend cooldown ticker — driven entirely client-side; the server is
  // the real authority and will reject early resends with a 429.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const validateForm = (): string | null => {
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return "Username must be 3-20 chars (letters, numbers, _)";
    if (!/^[6-9]\d{9}$/.test(phone)) return "Enter a valid 10-digit mobile number";
    if (password.length < 6) return "Password must be at least 6 characters";
    if (password !== confirmPassword) return "Passwords don't match";
    if (!referralCode.trim()) return "Referral code required";
    return null;
  };

  const sendOtp = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "register", website: honeypot }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to send OTP (${res.status})`);
      toast({ title: "OTP sent", description: `Code sent to +91 ${phone}` });
      setStep("otp");
      setResendIn(60);
    } catch (err: any) {
      const msg = err?.message || "Failed to send OTP";
      if (msg.includes("already registered")) setShowDuplicateDialog(true);
      else toast({ title: "OTP error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateForm();
    if (err) { toast({ title: err, variant: "destructive" }); return; }
    await sendOtp();
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) { toast({ title: "Enter the 6-digit OTP", variant: "destructive" }); return; }
    setLoading(true);
    try {
      // Step 1 — verify the OTP and get a short-lived verifiedToken.
      const vres = await fetch(`${API_BASE}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "register", code: otp }),
      });
      const vdata = await vres.json().catch(() => ({}));
      if (!vres.ok) throw new Error(vdata.error || `OTP verification failed (${vres.status})`);
      const tok = vdata.verifiedToken as string;
      setVerifiedToken(tok);

      // Step 2 — actually create the account, presenting the verifiedToken
      // so the server knows this phone was just OTP-verified.
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username, phone, password,
          deviceFingerprint: getDeviceFingerprint(),
          referralCode: (referralCode.trim() || "TP000001").toUpperCase(),
          verifiedToken: tok,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Registration failed (${res.status})`);
      setAuthToken(data.token);
      toast({ title: "Account created!" });
      setShowInstallPopup(true);
    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      if (msg.includes("1 account is allowed") || msg.includes("already registered")) {
        setShowDuplicateDialog(true);
      } else {
        toast({ title: "Registration failed", description: msg, variant: "destructive" });
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
          onDownload={async () => {
            const prompt = (window as any).__pwaPrompt;
            if (prompt) await prompt.prompt();
            else if (apkDownloadUrl) window.open(apkDownloadUrl, "_blank");
          }}
        />
      )}
      {showDuplicateDialog && (
        <DuplicateDialog
          onClose={() => setShowDuplicateDialog(false)}
          onLogin={() => { setShowDuplicateDialog(false); setLocation("/login"); }}
        />
      )}

      <div className="min-h-screen w-full bg-white relative overflow-hidden">
        {/* Soft gradient corner — light, premium feel without overpowering the form */}
        <div className="absolute -top-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-gradient-to-br from-indigo-200/60 via-violet-200/50 to-fuchsia-100/40 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[26rem] h-[26rem] rounded-full bg-gradient-to-tr from-cyan-100/50 via-sky-100/40 to-transparent blur-3xl pointer-events-none" />

        <div className="relative max-w-md mx-auto px-5 pt-8 pb-12">
          {/* Logo + brand header */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-3">
              <div className="absolute inset-0 rounded-[26px] bg-indigo-500/20 blur-xl scale-110" />
              <img src={logoUrl} alt={`${appName} Logo`} className="relative w-20 h-20 rounded-[26px] object-contain shadow-xl ring-1 ring-slate-200/60 bg-white" />
            </div>
            <div className="text-[22px] font-extrabold text-slate-900 tracking-tight">{appName}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.14em]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Secure P2P UPI Platform
            </div>
          </div>

          {/* Card */}
          <div className="rounded-[28px] bg-white border border-slate-100 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.18)] p-6">
            {step === "form" && (
              <>
                <h1 className="text-[24px] font-extrabold text-slate-900 mb-1">Create Account</h1>
                <p className="text-sm text-slate-500 mb-6">Sign up with your mobile number — we'll send a verification code.</p>

                <form onSubmit={handleSubmitForm} className="space-y-4">
                  <Honeypot value={honeypot} onChange={setHoneypot} />

                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-semibold text-slate-700">Username</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="3-20 chars (letters, numbers, _)"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))}
                        maxLength={20}
                        className="pl-10 h-12 rounded-xl bg-slate-50/70 border-slate-200 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-300"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-semibold text-slate-700">Mobile Number</Label>
                    <div className="flex gap-2">
                      <div className="flex items-center px-3 bg-slate-100 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">+91</div>
                      <div className="relative flex-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="tel"
                          inputMode="numeric"
                          placeholder="10-digit mobile"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          maxLength={10}
                          className="pl-10 h-12 rounded-xl bg-slate-50/70 border-slate-200 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-300"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-semibold text-slate-700">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12 rounded-xl bg-slate-50/70 border-slate-200 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-300" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-semibold text-slate-700">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="password" placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-12 rounded-xl bg-slate-50/70 border-slate-200 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-300" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-semibold text-slate-700">Referral Code</Label>
                    <div className="relative">
                      <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input placeholder="Invite code" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} required className="pl-10 h-12 rounded-xl bg-slate-50/70 border-slate-200 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-300" />
                    </div>
                  </div>

                  <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-lg shadow-indigo-500/25 hover:opacity-95 active:scale-[0.99]">
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending OTP...</> : "Send OTP & Continue"}
                  </Button>
                </form>

                {/* Trust badges */}
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    { icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />, label: "Encrypted" },
                    { icon: <Zap className="w-3.5 h-3.5 text-amber-500" />, label: "Instant" },
                    { icon: <Star className="w-3.5 h-3.5 text-indigo-500" />, label: "Trusted" },
                  ].map((b) => (
                    <div key={b.label} className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 border border-slate-100 py-2">
                      {b.icon}
                      <span className="text-[11px] font-semibold text-slate-600">{b.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === "otp" && (
              <>
                <button type="button" onClick={() => setStep("form")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <h1 className="text-[24px] font-extrabold text-slate-900 mb-1">Verify Mobile</h1>
                <p className="text-sm text-slate-500 mb-5">
                  6-digit code sent to <span className="font-semibold text-slate-900">+91 {phone}</span>
                </p>

                <form onSubmit={handleVerifyAndRegister} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-semibold text-slate-700">Enter OTP</Label>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      autoFocus
                      placeholder="• • • • • •"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                      className="h-14 rounded-xl bg-slate-50/70 border-slate-200 text-center text-2xl tracking-[0.5em] font-bold focus-visible:ring-indigo-500/40 focus-visible:border-indigo-300"
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Didn't receive it?</span>
                    {resendIn > 0 ? (
                      <span className="text-slate-400 font-medium">Resend in {resendIn}s</span>
                    ) : (
                      <button type="button" onClick={sendOtp} disabled={loading} className="text-indigo-600 font-semibold hover:underline disabled:opacity-50">
                        Resend OTP
                      </button>
                    )}
                  </div>

                  <Button type="submit" disabled={loading || otp.length !== 6} className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-lg shadow-indigo-500/25">
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Verify & Create Account</>}
                  </Button>
                </form>
              </>
            )}
          </div>

          <div className="mt-6 text-center text-sm text-slate-500">
            Already have an account? <Link href="/login" className="text-indigo-600 font-semibold">Login here</Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
