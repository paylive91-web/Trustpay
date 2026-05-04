import React, { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Phone, Lock, Loader2, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { API_BASE } from "@/lib/api-config";
import { AuthShell, PremiumInputWrap, PremiumButton } from "@/components/auth-shell";

type Step = "phone" | "otp" | "reset" | "done";

export default function ForgotPassword() {
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

  return (
    <AuthShell badge="Account Recovery">
      {step === "phone" && (
        <>
          <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">Forgot Password</h1>
          <p className="text-[13px] text-slate-500 mb-4">Enter your registered mobile — we'll send a 6-digit code.</p>
          <form onSubmit={handleSubmitPhone} className="space-y-3">
            <input type="text" name="website" autoComplete="off" tabIndex={-1} value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-slate-700 tracking-wide">Mobile Number</Label>
              <div className="flex gap-2">
                <div className="flex items-center px-3 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-indigo-100 text-sm font-bold text-indigo-700">+91</div>
                <PremiumInputWrap>
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
                  <Input type="tel" inputMode="numeric" placeholder="10-digit mobile" value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10}
                    className="pl-10 h-11 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                </PremiumInputWrap>
              </div>
            </div>
            <PremiumButton disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...</> : <>Send OTP <ArrowRight className="w-4 h-4" /></>}
            </PremiumButton>
          </form>
        </>
      )}

      {step === "otp" && (
        <>
          <button type="button" onClick={() => setStep("phone")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">Verify OTP</h1>
          <p className="text-[13px] text-slate-500 mb-4">Code sent to <span className="font-semibold text-slate-900">+91 {phone}</span></p>
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <PremiumInputWrap>
              <Input type="tel" inputMode="numeric" autoFocus placeholder="• • • • • •" value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6}
                className="h-14 bg-transparent border-0 text-center text-2xl tracking-[0.5em] font-bold focus-visible:ring-0 focus-visible:ring-offset-0" />
            </PremiumInputWrap>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500">Didn't receive it?</span>
              {resendIn > 0 ? (
                <span className="text-slate-400 font-medium">Resend in {resendIn}s</span>
              ) : (
                <button type="button" onClick={sendOtp} disabled={loading} className="text-indigo-600 font-semibold hover:underline">Resend OTP</button>
              )}
            </div>
            <PremiumButton disabled={loading || otp.length !== 6}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : <>Verify OTP <ArrowRight className="w-4 h-4" /></>}
            </PremiumButton>
          </form>
        </>
      )}

      {step === "reset" && (
        <>
          <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">New Password</h1>
          <p className="text-[13px] text-slate-500 mb-4">Set a new password for your account.</p>
          <form onSubmit={handleReset} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-slate-700 tracking-wide">New Password</Label>
              <PremiumInputWrap>
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
                <Input type="password" placeholder="At least 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 h-11 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
              </PremiumInputWrap>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-slate-700 tracking-wide">Confirm Password</Label>
              <PremiumInputWrap>
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
                <Input type="password" placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 h-11 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
              </PremiumInputWrap>
            </div>
            <PremiumButton disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : <>Update Password <ArrowRight className="w-4 h-4" /></>}
            </PremiumButton>
          </form>
        </>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center py-4 gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-400/30 blur-xl scale-110" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-9 h-9 text-white" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[18px] font-extrabold text-slate-900 mb-1">Password Updated!</p>
            <p className="text-[13px] text-slate-500 leading-relaxed">Login with your new password to continue.</p>
          </div>
          <PremiumButton type="button" onClick={() => setLocation("/login")}>
            Go to Login <ArrowRight className="w-4 h-4" />
          </PremiumButton>
        </div>
      )}

      <div className="mt-4 text-center text-[13px] text-slate-500">
        Remembered your password?{" "}
        <Link href="/login" className="text-indigo-600 font-semibold hover:underline">Login here</Link>
      </div>
    </AuthShell>
  );
}
