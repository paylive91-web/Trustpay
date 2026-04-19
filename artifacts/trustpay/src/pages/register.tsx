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

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: isUserLoading } = useGetMe({ query: { retry: false } });

  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    if (user && !isUserLoading) {
      setLocation("/");
    }
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
    if (!referralCode.trim()) {
      setReferralCode("TP000001");
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
