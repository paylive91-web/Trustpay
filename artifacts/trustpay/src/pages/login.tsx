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
import { ShieldCheck, Phone, Lock, Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/api-config";

const logoPath = `${import.meta.env.BASE_URL}trustpay-logo.png`;

export default function Login() {
  const { data: settings } = useGetAppSettings();
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
      toast({ title: "Login successful" });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Login failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const appName = (settings as any)?.appName || "TrustPay";
  const logoUrl = (settings as any)?.appLogoUrl || logoPath;

  return (
    <Layout showBottomNav={false}>
      <div className="min-h-[100svh] w-full bg-white relative overflow-hidden flex flex-col">
        <div className="absolute -top-32 -right-32 w-[22rem] h-[22rem] rounded-full bg-gradient-to-br from-indigo-200/60 via-violet-200/50 to-fuchsia-100/40 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[22rem] h-[22rem] rounded-full bg-gradient-to-tr from-cyan-100/50 via-sky-100/40 to-transparent blur-3xl pointer-events-none" />

        <div className="relative max-w-md w-full mx-auto px-5 py-4 flex-1 flex flex-col justify-center">
          {/* Brand header — logo + app name in one premium row */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-indigo-500/25 blur-lg scale-110" />
              <img src={logoUrl} alt={`${appName} Logo`} className="relative w-14 h-14 rounded-2xl object-contain shadow-lg ring-1 ring-slate-200/60 bg-white" />
            </div>
            <div className="flex flex-col">
              <div className="text-[22px] font-extrabold text-slate-900 tracking-tight leading-tight">{appName}</div>
              <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.12em]">
                <ShieldCheck className="w-3 h-3 text-emerald-500" /> Secure UPI Platform
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-slate-100 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.18)] p-5">
            <h1 className="text-[20px] font-extrabold text-slate-900 mb-0.5">Welcome Back</h1>
            <p className="text-[13px] text-slate-500 mb-4">Login with your mobile number.</p>

            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[12px] font-semibold text-slate-700">Mobile Number</Label>
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
                      className="pl-10 h-11 rounded-xl bg-slate-50/70 border-slate-200 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-300"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[12px] font-semibold text-slate-700">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-slate-50/70 border-slate-200 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-300"
                  />
                </div>
              </div>

              <div className="text-right -mt-1">
                <Link href="/forgot-password" className="text-[13px] text-indigo-600 font-semibold hover:underline" data-testid="link-forgot-password">
                  Forgot Password?
                </Link>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-lg shadow-indigo-500/25">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Logging in...</> : "Login"}
              </Button>
            </form>
          </div>

          <div className="mt-4 text-center text-[13px] text-slate-500">
            Don't have an account? <Link href="/register" className="text-indigo-600 font-semibold">Register here</Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
