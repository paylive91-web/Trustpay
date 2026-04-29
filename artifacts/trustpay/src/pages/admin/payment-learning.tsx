import React from "react";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { API_BASE } from "@/lib/api-config";
import { Brain, CheckCircle, ImageIcon, Hash, TrendingUp, AlertTriangle, ShieldCheck } from "lucide-react";

async function adminApi(path: string) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-xl ${color || "bg-purple-100 text-purple-700"}`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-black">{value}</div>
          <div className="text-xs font-semibold text-slate-700">{label}</div>
          {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-2.5">
      <div
        className={`h-2.5 rounded-full transition-all ${color || "bg-purple-500"}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

export default function AdminPaymentLearning() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-payment-learning"],
    queryFn: () => adminApi("/admin/payment-learning"),
    refetchInterval: 15000,
  });

  const ss = data?.screenshots;
  const utrs = data?.utrs;

  return (
    <AdminLayout>
      <div className="p-4 space-y-5 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" /> Payment Learning
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              System improves fraud detection automatically from real transactions
            </p>
          </div>
          <button onClick={() => refetch()} className="text-xs text-purple-600 underline">Refresh</button>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-10 text-sm">Loading...</div>
        ) : (
          <>
            {/* Screenshot Learning */}
            <div className="space-y-3">
              <h2 className="font-bold text-sm flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-sky-600" /> Screenshot Intelligence
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={<ImageIcon className="w-4 h-4" />}
                  label="Total Screenshots"
                  value={ss?.totalScreenshots ?? 0}
                  sub="Ever submitted"
                  color="bg-sky-100 text-sky-700"
                />
                <StatCard
                  icon={<ShieldCheck className="w-4 h-4" />}
                  label="Verified by Sellers"
                  value={ss?.verifiedScreenshots ?? 0}
                  sub="Confirmed real payments"
                  color="bg-green-100 text-green-700"
                />
                <StatCard
                  icon={<CheckCircle className="w-4 h-4" />}
                  label="Payment Detected"
                  value={ss?.withPaymentIndicators ?? 0}
                  sub="Had payment keywords/amount"
                  color="bg-emerald-100 text-emerald-700"
                />
                <StatCard
                  icon={<AlertTriangle className="w-4 h-4" />}
                  label="Duplicate Attempts"
                  value={ss?.duplicateAttempts ?? 0}
                  sub="Same/similar screenshot reused"
                  color="bg-orange-100 text-orange-700"
                />
              </div>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">Screenshot Learning Progress</span>
                    <span className="text-purple-700 font-bold">{ss?.learningProgress ?? 0}%</span>
                  </div>
                  <ProgressBar value={ss?.learningProgress ?? 0} />
                  <p className="text-xs text-muted-foreground">
                    Based on seller-confirmed screenshots. Higher % = stronger detection.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-1 text-sm">
                  <div className="font-semibold mb-2">Last 7 Days</div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New screenshots</span>
                    <span className="font-bold">{ss?.last7Days ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Verified in 7 days</span>
                    <span className="font-bold text-green-600">{ss?.last7DaysVerified ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">No payment indicators</span>
                    <span className="font-bold text-orange-600">{ss?.withoutPaymentIndicators ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* UTR Learning */}
            <div className="space-y-3">
              <h2 className="font-bold text-sm flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-fuchsia-600" /> UTR Intelligence
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={<Hash className="w-4 h-4" />}
                  label="Total UTRs Seen"
                  value={utrs?.total ?? 0}
                  sub="Submitted across all orders"
                  color="bg-fuchsia-100 text-fuchsia-700"
                />
                <StatCard
                  icon={<ShieldCheck className="w-4 h-4" />}
                  label="Verified UTRs"
                  value={utrs?.verified ?? 0}
                  sub="Seller confirmed real"
                  color="bg-green-100 text-green-700"
                />
                <StatCard
                  icon={<TrendingUp className="w-4 h-4" />}
                  label="Unique UTRs"
                  value={utrs?.unique ?? 0}
                  sub="Distinct reference numbers"
                  color="bg-blue-100 text-blue-700"
                />
                <StatCard
                  icon={<AlertTriangle className="w-4 h-4" />}
                  label="Duplicate Attempts"
                  value={utrs?.duplicateAttempts ?? 0}
                  sub="Same UTR reused"
                  color="bg-red-100 text-red-700"
                />
              </div>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">UTR Learning Progress</span>
                    <span className="text-fuchsia-700 font-bold">{utrs?.learningProgress ?? 0}%</span>
                  </div>
                  <ProgressBar value={utrs?.learningProgress ?? 0} color="bg-fuchsia-500" />
                  <p className="text-xs text-muted-foreground">
                    % of submitted UTRs confirmed real by sellers.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* How it works */}
            <Card className="border-purple-200 bg-purple-50/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-bold text-purple-800">How System Learns</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2 text-xs text-purple-900">
                <div className="flex gap-2">
                  <span className="font-bold">1.</span>
                  <span>Buyer uploads screenshot → system checks for duplicates (exact + visually similar via perceptual hash)</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold">2.</span>
                  <span>OCR scans for ₹ amount, UTR, payment keywords — no platform restriction</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold">3.</span>
                  <span>Seller confirms payment → UTR + screenshot marked as "verified" → added to learning database</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold">4.</span>
                  <span>Over time: duplicate attempts get caught earlier, fake screenshots detected faster</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
