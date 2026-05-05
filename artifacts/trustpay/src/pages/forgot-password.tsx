import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { useGetAppSettings } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { API_BASE } from "@/lib/api-config";
import { AuthShell, PremiumInputWrap, PremiumButton } from "@/components/auth-shell";
import { getGoogleIdToken } from "@/lib/google-id";

type Step = "verify" | "reset" | "done";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: settings } = useGetAppSettings();
  const googleClientId = (settings as any)?.googleClientId as string | undefined;

  const [step, setStep] = useState<Step>("verify");
  const [googleIdToken, setGoogleIdToken] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerifyWithGoogle = async () => {
    if (!googleClientId) {
      toast({ title: "Google verification is not configured. Please contact support.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const idToken = await getGoogleIdToken(googleClientId);
      let email = "";
      try {
        const payload = JSON.parse(atob(idToken.split(".")[1]));
        email = payload?.email || "";
      } catch {}
      setGoogleIdToken(idToken);
      setVerifiedEmail(email);
      setStep("reset");
      toast({ title: "Google verified", description: email });
    } catch (err: any) {
      toast({ title: "Verification failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleIdToken) {
      toast({ title: "Please verify with Google first", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/google/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: googleIdToken, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to reset password (${res.status})`);
      setStep("done");
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-[22px] font-extrabold text-slate-900 text-center mb-1">
        {step === "done" ? "Password Updated" : step === "reset" ? "Set New Password" : "Forgot Password"}
      </h1>
      <p className="text-[13px] text-slate-600 text-center mb-5">
        {step === "done"
          ? "You can now log in with your new password."
          : step === "reset"
          ? "Choose a new password for your TrustPay account."
          : "Verify with the Google account you linked in your profile, then set a new password."}
      </p>

      {step === "verify" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-xs text-amber-900 leading-relaxed">
                Sirf wahi user reset kar sakta hai jisne profile me apna Gmail bind kar rakha ho. Agar tune Gmail bind nahi kiya, toh pehle login karo aur Profile → Google Verification se Gmail link karo.
              </div>
            </div>
          </div>

          <PremiumButton
            type="button"
            onClick={handleVerifyWithGoogle}
            disabled={loading || !googleClientId}
          >
            {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin inline" /> : <ShieldCheck className="w-5 h-5 mr-2 inline" />}
            {googleClientId ? "Verify with Google" : "Loading…"}
          </PremiumButton>

          <div className="text-center">
            <Link href="/login" className="text-sm text-indigo-600 font-medium inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Back to login
            </Link>
          </div>
        </div>
      )}

      {step === "reset" && (
        <form onSubmit={resetPassword} className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="flex items-center gap-2 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="truncate">Verified: {verifiedEmail || "Google account"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">New password</Label>
            <PremiumInputWrap>
              <Input
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-11 text-base"
                data-testid="input-new-password"
              />
            </PremiumInputWrap>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Confirm new password</Label>
            <PremiumInputWrap>
              <Input
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-11 text-base"
                data-testid="input-confirm-password"
              />
            </PremiumInputWrap>
          </div>

          <PremiumButton type="submit" disabled={loading}>
            {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin inline" /> : null}
            Save New Password
          </PremiumButton>

          <button
            type="button"
            className="w-full text-sm text-slate-500 hover:text-slate-700"
            onClick={() => { setStep("verify"); setGoogleIdToken(null); setVerifiedEmail(""); }}
          >
            Re-verify with a different Google account
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="space-y-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div className="text-sm text-slate-600">
            Tumhare account ka password update ho gaya hai. Ab naye password se login karo.
          </div>
          <PremiumButton type="button" onClick={() => setLocation("/login")}>
            Go to Login
          </PremiumButton>
        </div>
      )}
    </AuthShell>
  );
}
