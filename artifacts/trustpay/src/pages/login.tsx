import React, { useEffect, useState } from "react";
import { useGetMe, useGetAppSettings } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { setAuthToken } from "@/lib/auth";
import { getDeviceFingerprint } from "@/lib/fingerprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2 } from "lucide-react";
import logoPath from "@assets/file_00000000da60720ba5a8a74acd96c937_1776335785514.png";
import Layout from "@/components/layout";
import { getGoogleIdToken } from "@/lib/google-id";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type LoginStep = "login" | "forgot_google";

export default function Login() {
  const { data: settings } = useGetAppSettings();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: isUserLoading } = useGetMe({ query: { queryKey: ["me"], retry: false } });
  const [step, setStep] = useState<LoginStep>("login");
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [googleIdToken, setGoogleIdToken] = useState<string | null>(null);
  const [verifiedHint, setVerifiedHint] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const googleClientId = settings?.googleClientId;

  useEffect(() => {
    if (user && !isUserLoading) {
      setLocation("/");
    }
  }, [user, isUserLoading, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast({ title: "Please enter username/mobile and password", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, deviceFingerprint: getDeviceFingerprint() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Login failed (${res.status})`);
      setAuthToken(data.token);
      localStorage.removeItem("popup_seen_session");
      toast({ title: "Login successful" });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Login failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyWithGoogle = async () => {
    if (!googleClientId) {
      toast({ title: "Google verification configured nahi hai. Support se sampark karein.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const idToken = await getGoogleIdToken(googleClientId);
      let hint = "";
      try {
        const payload = JSON.parse(atob(idToken.split(".")[1]));
        hint = payload?.email || "";
      } catch {}
      setGoogleIdToken(idToken);
      setVerifiedHint(hint);
      toast({ title: "Google verified", description: hint });
    } catch (err: any) {
      toast({ title: "Verification failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordWithGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleIdToken) {
      toast({ title: "Pehle Google verification karein", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmNewPassword) {
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
      toast({ title: "Password badal diya!", description: "Ab naye password se login karein." });
      setStep("login");
      setPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setGoogleIdToken(null);
      setVerifiedHint("");
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showBottomNav={false}>
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <img src={settings?.appLogoUrl || logoPath} alt={`${settings?.appName || "TrustPay"} Logo`} className="w-24 h-24 mb-2 rounded-2xl object-contain" />
        <div className="text-xl font-bold mb-6 text-primary">{settings?.appName || "TrustPay"}</div>

        {step === "login" && (
          <>
            <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
            <p className="text-muted-foreground mb-8 text-center">Login with your username or mobile number</p>
            <form onSubmit={handleLogin} className="w-full space-y-4">
              <div className="space-y-2">
                <Label>Username or Mobile Number</Label>
                <Input type="text" placeholder="Username or 10-digit mobile" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="text-right">
                <button
                  type="button"
                  className="text-sm text-primary font-medium"
                  onClick={() => {
                    setStep("forgot_google");
                    setGoogleIdToken(null);
                    setVerifiedHint("");
                  }}
                  data-testid="link-forgot-password"
                >
                  Forgot Password?
                </button>
              </div>
              <Button type="submit" className="w-full mt-2 h-12 text-base" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </Button>
            </form>
            <div className="mt-8 text-sm">
              Don't have an account? <Link href="/register" className="text-primary font-medium">Register here</Link>
            </div>
          </>
        )}

        {step === "forgot_google" && (
          <>
            <h1 className="text-2xl font-bold mb-2">Forgot Password</h1>
            <p className="text-muted-foreground mb-6 text-center">Apne bound Google account se verify karke naya password set karein.</p>
            <form onSubmit={handleResetPasswordWithGoogle} className="w-full space-y-4">
              <div className="rounded-xl border p-4 bg-muted/30">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${googleIdToken ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">Step 1 — Google Verification</div>
                    {googleIdToken ? (
                      <div className="text-xs text-green-700 mt-0.5 truncate">Verified: {verifiedHint || "OK"}</div>
                    ) : (
                      <div className="text-xs text-muted-foreground mt-0.5">Sirf wahi user reset kar sakta hai jo profile me Gmail bind kar chuka ho.</div>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant={googleIdToken ? "outline" : "default"}
                  className="w-full"
                  onClick={handleVerifyWithGoogle}
                  disabled={loading}
                  data-testid="button-google-forgot-verify"
                >
                  {loading && !googleIdToken ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {googleIdToken ? "Re-verify with Google" : "Verify with Google"}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" placeholder="At least 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={!googleIdToken} />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" placeholder="Repeat new password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} disabled={!googleIdToken} />
              </div>
              <Button type="submit" className="w-full h-12 text-base" disabled={loading || !googleIdToken} data-testid="button-reset-password">
                {loading ? "Saving..." : "Save New Password"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("login")}>Back to Login</Button>
            </form>
          </>
        )}
      </div>
    </Layout>
  );
}
