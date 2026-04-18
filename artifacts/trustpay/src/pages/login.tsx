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
import Layout from "@/components/layout";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type LoginStep = "login" | "forgot_phone" | "forgot_otp" | "forgot_newpass";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: isUserLoading } = useGetMe({ query: { retry: false } });

  const [step, setStep] = useState<LoginStep>("login");
  const [loading, setLoading] = useState(false);

  // Login form state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // Forgot password state
  const [resetPhone, setResetPhone] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [sentOtp, setSentOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      setAuthToken(data.token);
      toast({ title: "Login successful" });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(resetPhone)) {
      toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/send-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: resetPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setSentOtp(data.otp || "");
      toast({ title: "OTP sent!", description: data.otp ? `Demo OTP: ${data.otp}` : "Check your messages" });
      setStep("forgot_otp");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetOtp || resetOtp.length !== 6) {
      toast({ title: "Enter the 6-digit OTP", variant: "destructive" });
      return;
    }
    if (resetOtp !== sentOtp && sentOtp) {
      toast({ title: "Incorrect OTP", variant: "destructive" });
      return;
    }
    setStep("forgot_newpass");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: resetPhone, otp: resetOtp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      toast({ title: "Password changed successfully!", description: "Please login with your new password." });
      setStep("login");
      setPassword("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showBottomNav={false}>
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <img src={logoPath} alt="TrustPay Logo" className="w-24 h-24 mb-8" />

        {step === "login" && (
          <>
            <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
            <p className="text-muted-foreground mb-8 text-center">Login with your username or mobile number</p>
            <form onSubmit={handleLogin} className="w-full space-y-4">
              <div className="space-y-2">
                <Label>Username or Mobile Number</Label>
                <Input
                  type="text"
                  placeholder="Username or 10-digit mobile"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="text-right">
                <button
                  type="button"
                  className="text-sm text-primary font-medium"
                  onClick={() => { setStep("forgot_phone"); setResetPhone(""); }}
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

        {step === "forgot_phone" && (
          <>
            <h1 className="text-2xl font-bold mb-2">Forgot Password</h1>
            <p className="text-muted-foreground mb-8 text-center">Enter your registered mobile number</p>
            <form onSubmit={handleSendResetOtp} className="w-full space-y-4">
              <div className="space-y-2">
                <Label>Mobile Number</Label>
                <Input
                  type="tel"
                  placeholder="Enter 10-digit mobile number"
                  value={resetPhone}
                  onChange={(e) => setResetPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  maxLength={10}
                />
              </div>
              <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                {loading ? "Sending..." : "Send OTP"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("login")}>
                Back to Login
              </Button>
            </form>
          </>
        )}

        {step === "forgot_otp" && (
          <>
            <h1 className="text-2xl font-bold mb-2">Enter OTP</h1>
            <p className="text-muted-foreground mb-8 text-center">
              OTP sent to +91 {resetPhone}
              {sentOtp && <span className="block text-green-600 font-bold mt-2">Demo OTP: {sentOtp}</span>}
            </p>
            <form onSubmit={handleVerifyResetOtp} className="w-full space-y-4">
              <div className="space-y-2">
                <Label>6-digit OTP</Label>
                <Input
                  type="number"
                  placeholder="Enter OTP"
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value.slice(0, 6))}
                  maxLength={6}
                />
              </div>
              <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                Verify OTP
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("forgot_phone")}>
                Resend OTP
              </Button>
            </form>
          </>
        )}

        {step === "forgot_newpass" && (
          <>
            <h1 className="text-2xl font-bold mb-2">New Password</h1>
            <p className="text-muted-foreground mb-8 text-center">Set a new password for your account</p>
            <form onSubmit={handleResetPassword} className="w-full space-y-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                {loading ? "Saving..." : "Save New Password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </Layout>
  );
}
