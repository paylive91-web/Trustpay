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
import { ShieldCheck, Zap, Star, User as UserIcon, Lock, Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/api-config";

const logoPath = `${import.meta.env.BASE_URL}trustpay-logo.png`;

export default function Login() {
  const { data: settings } = useGetAppSettings();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading } = useGetMe({ query: { queryKey: ["me"], retry: false } });

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && !isLoading) setLocation("/");
  }, [user, isLoading, setLocation]);

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
      <div className="min-h-screen w-full bg-white relative overflow-hidden">
        {/* Soft gradient corner accents */}
        <div className="absolute -top-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-gradient-to-br from-indigo-200/60 via-violet-200/50 to-fuchsia-100/40 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[26rem] h-[26rem] rounded-full bg-gradient-to-tr from-cyan-100/50 via-sky-100/40 to-transparent blur-3xl pointer-events-none" />

        <div className="relative max-w-md mx-auto px-5 pt-10 pb-12">
          {/* Brand header */}
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

          <div className="rounded-[28px] bg-white border border-slate-100 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.18)] p-6">
            <h1 className="text-[24px] font-extrabold text-slate-900 mb-1">Welcome Back</h1>
            <p className="text-sm text-slate-500 mb-6">Login with your username or mobile number.</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold text-slate-700">Username or Mobile</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="username or 10-digit mobile"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="pl-10 h-12 rounded-xl bg-slate-50/70 border-slate-200 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-300"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold text-slate-700">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12 rounded-xl bg-slate-50/70 border-slate-200 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-300"
                  />
                </div>
              </div>

              <div className="text-right">
                <Link href="/forgot-password" className="text-sm text-indigo-600 font-semibold hover:underline" data-testid="link-forgot-password">
                  Forgot Password?
                </Link>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-lg shadow-indigo-500/25">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Logging in...</> : "Login"}
              </Button>
            </form>

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
          </div>

          <div className="mt-6 text-center text-sm text-slate-500">
            Don't have an account? <Link href="/register" className="text-indigo-600 font-semibold">Register here</Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
