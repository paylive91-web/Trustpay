import React, { useEffect, useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { setAuthToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import logoPath from "@assets/file_00000000da60720ba5a8a74acd96c937_1776335785514.png";
import Layout from "@/components/layout";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type RegisterStep = "phone" | "otp" | "password";

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: isUserLoading } = useGetMe({ query: { retry: false } });

  const [step, setStep] = useState<RegisterStep>("phone");
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sentOtp, setSentOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    if (user && !isUserLoading) {
      setLocation("/");
    }
    // Pre-fill referral code from URL param
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setReferralCode(ref.toUpperCase());
  }, [user, isUserLoading, setLocation]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setSentOtp(data.otp || "");
      toast({ title: "OTP sent!", description: data.otp ? `Demo OTP: ${data.otp}` : "Check your messages" });
      setStep("otp");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast({ title: "Enter the 6-digit OTP", variant: "destructive" });
      return;
    }
    if (otp !== sentOtp && sentOtp) {
      toast({ title: "Incorrect OTP. Please try again.", variant: "destructive" });
      return;
    }
    setStep("password");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const body: any = { phone, password };
      if (referralCode.trim()) body.referralCode = referralCode.trim().toUpperCase();
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setAuthToken(data.token);
      toast({ title: "Account created successfully!" });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showBottomNav={false}>
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <img src={logoPath} alt="TrustPay Logo" className="w-24 h-24 mb-8" />

        <div className="flex items-center gap-2 mb-8">
          {["phone", "otp", "password"].map((s, i) => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step === s ? "bg-primary text-primary-foreground" :
                (["phone","otp","password"].indexOf(step) > i ? "bg-green-500 text-white" : "bg-muted text-muted-foreground")
              }`}>{i + 1}</div>
              {i < 2 && <div className={`h-0.5 w-8 ${["phone","otp","password"].indexOf(step) > i ? "bg-green-500" : "bg-muted"}`} />}
            </React.Fragment>
          ))}
        </div>

        {step === "phone" && (
          <>
            <h1 className="text-2xl font-bold mb-2">Create Account</h1>
            <p className="text-muted-foreground mb-8 text-center">Enter your mobile number to get started</p>
            <form onSubmit={handleSendOtp} className="w-full space-y-4">
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
              <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                {loading ? "Sending OTP..." : "Get OTP"}
              </Button>
            </form>
            <div className="mt-8 text-sm">
              Already have an account? <Link href="/login" className="text-primary font-medium">Login here</Link>
            </div>
          </>
        )}

        {step === "otp" && (
          <>
            <h1 className="text-2xl font-bold mb-2">Verify Mobile</h1>
            <p className="text-muted-foreground mb-2 text-center">OTP sent to +91 {phone}</p>
            {sentOtp && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-center">
                <span className="text-xs text-green-700">Demo OTP: </span>
                <span className="text-lg font-bold text-green-700">{sentOtp}</span>
              </div>
            )}
            <form onSubmit={handleVerifyOtp} className="w-full space-y-4">
              <div className="space-y-2">
                <Label>Enter OTP</Label>
                <Input
                  type="number"
                  placeholder="6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest h-14"
                />
              </div>
              <Button type="submit" className="w-full h-12 text-base">
                Verify OTP
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setStep("phone"); setOtp(""); }}>
                Change Number
              </Button>
            </form>
          </>
        )}

        {step === "password" && (
          <>
            <h1 className="text-2xl font-bold mb-2">Set Password</h1>
            <p className="text-muted-foreground mb-8 text-center">Create a secure password for your account</p>
            <form onSubmit={handleRegister} className="w-full space-y-4">
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
                <Label>Referral Code <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                <Input
                  placeholder="e.g. TP000001"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                />
              </div>
              <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                {loading ? "Creating Account..." : "Create Account"}
              </Button>
            </form>
          </>
        )}
      </div>
    </Layout>
  );
}
