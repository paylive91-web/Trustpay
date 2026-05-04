import React, { useEffect, useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { setAuthToken } from "@/lib/auth";
import { getDeviceFingerprint } from "@/lib/fingerprint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Phone, Lock, Loader2, ArrowRight } from "lucide-react";
import { API_BASE } from "@/lib/api-config";
import { AuthShell, PremiumInputWrap, PremiumButton, TrustRow } from "@/components/auth-shell";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading } = useGetMe({ query: { queryKey: ["me"], retry: false } });

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && !isLoading) setLocation("/");
  }, [user, isLoading, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    if (!password) {
      toast({ title: "Enter your password", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: phone, password, deviceFingerprint: getDeviceFingerprint() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Login failed");
      setAuthToken(data.token);
      toast({ title: "Welcome back!" });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Login failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell badge="Secure UPI Platform">
      <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">Welcome Back</h1>
      <p className="text-[13px] text-slate-500 mb-4">Login with your registered mobile number.</p>

      <form onSubmit={handleLogin} className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-[12px] font-semibold text-slate-700 tracking-wide">Mobile Number</Label>
          <div className="flex gap-2">
            <div className="flex items-center px-3 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-indigo-100 text-sm font-bold text-indigo-700">
              +91
            </div>
            <PremiumInputWrap>
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
              <Input
                type="tel"
                inputMode="numeric"
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                maxLength={10}
                className="pl-10 h-11 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </PremiumInputWrap>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[12px] font-semibold text-slate-700 tracking-wide">Password</Label>
          <PremiumInputWrap>
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-11 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </PremiumInputWrap>
        </div>

        <div className="flex justify-end -mt-1">
          <Link href="/forgot-password" className="text-[12.5px] text-indigo-600 font-semibold hover:underline" data-testid="link-forgot-password">
            Forgot Password?
          </Link>
        </div>

        <PremiumButton disabled={loading}>
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Logging in...</>
          ) : (
            <>Login <ArrowRight className="w-4 h-4" /></>
          )}
        </PremiumButton>
      </form>

      <TrustRow />

      <div className="mt-4 text-center text-[13px] text-slate-500">
        New to TrustPay?{" "}
        <Link href="/register" className="text-indigo-600 font-semibold hover:underline">
          Create account
        </Link>
      </div>
    </AuthShell>
  );
}
