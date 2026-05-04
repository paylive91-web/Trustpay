import React, { useEffect, useState } from "react";
import { useGetAppSettings } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout";
import { Phone, Lock, Loader2, ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react";
import { API_BASE } from "@/lib/api-config";

const logoPath = `${import.meta.env.BASE_URL}trustpay-logo.png`;

type Step = "phone" | "otp" | "reset" | "done";

export default function ForgotPassword() {
  const { data: settings } = useGetAppSettings();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [verifiedToken, setVerifiedToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendOtp = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "forgot", website: honeypot }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to send OTP (${res.status})`);
      toast({ title: "OTP sent", description: `Code sent to +91 ${phone}` });
      setStep("otp");
      setResendIn(60);
    } catch (err: any) {
      toast({ title: "OTP error", description: err?.message || "Failed to send OTP", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    await sendOtp();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) { toast({ title: "Enter the 6-digit OTP", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "forgot", code: otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Verification failed (${res.status})`);
      setVerifiedToken(data.verifiedToken);
      setStep("reset");
    } catch (err: any) {
      toast({ title: "Verification failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return; }
    if (newPassword !== confirmPassword) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, newPassword, verifiedToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Reset failed (${res.status})`);
      setStep("done");
    } catch (err: any) {
      toast({ title: "Reset failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const appName = (settings as any)?.appName || "TrustPay";
  const logoUrl = (settings as any)?.appLogoUrl || logoPath;

  return (
    <Layout showBottomNav={false}>
      <div className="min-h-screen w-full bg-white relative overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-gradient-to-br from-indigo-200/60 via-violet-200/50 to-fuchsia-100/40 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[26rem] h-[26rem] rounded-full bg-gradient-to-tr from-cyan-100/50 via-sky-100/40 to-transparent blur-3xl pointer-events-none" />

        <div className="relative max-w-md mx-auto px-5 pt-10 pb-12">
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-3">
              <div className="absolute inset-0 rounded-[26px] bg-indigo-500/20 blur-xl scale-110" />
              <img src={logoUrl} alt={`${appName} Logo`} className="relative w-20 h-20 rounded-[26px] object-contain shadow-xl ring-1 ring-slate-200/60 bg-white" />
            </div>
            <div className="text-[22px] font-extrabold text-slate-900 tracking-tight">{appName}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.14em]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Account Recovery
            </div>
          </div>

          <div className="rounded-[28px] bg-white border border-slate-100 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.18)] p-6">
            {step === "phone" && (
              <>
                <h1 className="text-[24px] font-extrabold text-slate-900 mb-1">Forgot Password</h1>
                <p className="text-sm text-slate-500 mb-6">Enter your registered mobile number — we'll send a 6-digit code.</p>
                <form onSubmit={handleSubmitPhone} className="space-y-4">
                  <input type="text" name="website" autoComplete="off" tabIndex={-1} value={honeypot} onChange={(e) => setHoneypot(e.target.value)} style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-semibold text-slate-700">Mobile Number</Label>
                    <div className="flex gap-2">
                      <div className="flex items-center px-3 bg-slate-100 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">+91</div>
                      <div className="relative flex-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input type="tel" inputMode="numeric" placeholder="10-digit mobile" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10} className="pl-10 h-12 rounded-xl bg-slate-50/70 border-slate-200" />
                      </div>
                    </div>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-lg shadow-indigo-500/25">
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending OTP...</> : "Send OTP"}
                  </Button>
                </form>
              </>
            )}

            {step === "otp" && (
              <>
                <button type="button" onClick={() => setStep("phone")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <h1 className="text-[24px] font-extrabold text-slate-900 mb-1">Verify OTP</h1>
                <p className="text-sm text-slate-500 mb-5">Code sent to <span className="font-semibold text-slate-900">+91 {phone}</span></p>
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <Input
                    type="tel"
                    inputMode="numeric"
                    autoFocus
                    placeholder="• • • • • •"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    className="h-14 rounded-xl bg-slate-50/70 border-slate-200 text-center text-2xl tracking-[0.5em] font-bold"
                  />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Didn't receive it?</span>
                    {resendIn > 0 ? (
                      <span className="text-slate-400 font-medium">Resend in {resendIn}s</span>
                    ) : (
                      <button type="button" onClick={sendOtp} disabled={loading} className="text-indigo-600 font-semibold hover:underline">Resend OTP</button>
                    )}
                  </div>
                  <Button type="submit" disabled={loading || otp.length !== 6} className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-lg shadow-indigo-500/25">
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</> : "Verify OTP"}
                  </Button>
                </form>
              </>
            )}

            {step === "reset" && (
              <>
                <h1 className="text-[24px] font-extrabold text-slate-900 mb-1">New Password</h1>
                <p className="text-sm text-slate-500 mb-5">Set a new password for your account.</p>
                <form onSubmit={handleReset} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-semibold text-slate-700">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="password" placeholder="At least 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pl-10 h-12 rounded-xl bg-slate-50/70 border-slate-200" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-semibold text-slate-700">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="password" placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-12 rounded-xl bg-slate-50/70 border-slate-200" />
                    </div>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-lg shadow-indigo-500/25">
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...</> : "Update Password"}
                  </Button>
                </form>
              </>
            )}

            {step === "done" && (
              <div className="flex flex-col items-center py-6 gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <div className="text-center">
                  <p className="text-[18px] font-bold text-slate-900 mb-1">Password Updated!</p>
                  <p className="text-[13px] text-slate-500 leading-relaxed">Login with your new password to continue.</p>
                </div>
                <Button onClick={() => setLocation("/login")} className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-lg shadow-indigo-500/25">
                  Go to Login
                </Button>
              </div>
            )}
          </div>

          <div className="mt-6 text-center text-sm text-slate-500">
            Remembered your password? <Link href="/login" className="text-indigo-600 font-semibold">Login here</Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
