import React, { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";
import { BarChart3, Download, Info, TrendingUp, TrendingDown, DollarSign, ShieldAlert, Trash2, Ban } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || "Request failed");
  }
  return res.json();
}

type BlockedPair = { id: number; userId1: number; userId2: number; reason: string | null; createdAt: string };

export default function AdminReports() {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [blockedPairs, setBlockedPairs] = useState<BlockedPair[] | null>(null);
  const [blockedPairsLoading, setBlockedPairsLoading] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/admin/reports/daily?date=${date}`);
      setReport(data);
    } catch (e: any) {
      toast({ title: "Failed to load report", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadBlockedPairs = async () => {
    setBlockedPairsLoading(true);
    try {
      const data = await apiFetch("/admin/trade-pair-blocks");
      setBlockedPairs(data);
    } catch (e: any) {
      toast({ title: "Failed to load blocked pairs", description: e.message, variant: "destructive" });
    } finally {
      setBlockedPairsLoading(false);
    }
  };

  const removeBlock = async (id: number) => {
    setRemovingId(id);
    try {
      await apiFetch(`/admin/trade-pair-blocks/${id}`, { method: "DELETE" });
      setBlockedPairs((prev) => prev ? prev.filter((p) => p.id !== id) : prev);
      toast({ title: "Block removed" });
    } catch (e: any) {
      toast({ title: "Failed to remove block", description: e.message, variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const downloadCsv = () => {
    const token = getAuthToken();
    const url = `${API_BASE}/admin/reports/daily/export.csv?date=${date}`;
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", `settlement-${date}.csv`);
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        a.href = URL.createObjectURL(blob);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      })
      .catch(() => toast({ title: "Download failed", variant: "destructive" }));
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-100">
            <BarChart3 className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Daily Settlement Report</h1>
            <p className="text-sm text-muted-foreground">
              View a summary of platform activity for any given day — deposits, withdrawals, fees collected, rewards paid, and dispute count.
            </p>
          </div>
        </div>

        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-800">
              Select a date to generate a full settlement summary. All amounts are in INR (₹). You can also download the raw confirmed order data as a CSV for external analysis or accounting.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generate Report</CardTitle>
            <CardDescription>Pick a date and click Generate to view the summary.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label>Report Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[180px]" max={today} />
            </div>
            <Button onClick={loadReport} disabled={loading}>
              {loading ? "Loading..." : "Generate Report"}
            </Button>
            {report && (
              <Button variant="outline" onClick={downloadCsv}>
                <Download className="h-4 w-4 mr-2" /> Download CSV
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Ban className="h-5 w-5 text-rose-600" /> Blocked Trade Pairs</CardTitle>
                <CardDescription>User pairs blocked from being matched with each other. Remove a block to allow them to trade again.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadBlockedPairs} disabled={blockedPairsLoading}>
                {blockedPairsLoading ? "Loading..." : blockedPairs ? "Refresh" : "Load Blocks"}
              </Button>
            </div>
          </CardHeader>
          {blockedPairs !== null && (
            <CardContent>
              {blockedPairs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No trade pair blocks active.</p>
              ) : (
                <div className="space-y-2">
                  {blockedPairs.map((pair) => (
                    <div key={pair.id} className="flex items-center justify-between rounded-lg border px-4 py-3 bg-muted/30">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">
                          User <span className="font-bold">#{pair.userId1}</span> ↔ User <span className="font-bold">#{pair.userId2}</span>
                        </div>
                        {pair.reason && <div className="text-xs text-muted-foreground">{pair.reason}</div>}
                        <div className="text-xs text-muted-foreground">Added: {new Date(pair.createdAt).toLocaleString()}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => removeBlock(pair.id)}
                        disabled={removingId === pair.id}
                        title="Remove block"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {report && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Total Deposits"
              value={`₹ ${report.totalDeposits.toFixed(2)}`}
              sub={`${report.depositCount} confirmed orders`}
              icon={<TrendingDown className="h-5 w-5" />}
              color="emerald"
            />
            <StatCard
              title="Total Withdrawals"
              value={`₹ ${report.totalWithdrawals.toFixed(2)}`}
              sub={`${report.withdrawalCount} confirmed orders`}
              icon={<TrendingUp className="h-5 w-5" />}
              color="blue"
            />
            <StatCard
              title="Fees Collected"
              value={`₹ ${report.feesCollected.toFixed(2)}`}
              sub={`${report.feeCount} fee transactions`}
              icon={<DollarSign className="h-5 w-5" />}
              color="violet"
            />
            <StatCard
              title="Rewards Paid"
              value={`₹ ${report.rewardsPaid.toFixed(2)}`}
              sub={`${report.rewardCount} reward credits`}
              icon={<TrendingUp className="h-5 w-5" />}
              color="amber"
            />
            <StatCard
              title="Disputes Opened"
              value={report.disputeCount.toString()}
              sub="Disputes created on this day"
              icon={<ShieldAlert className="h-5 w-5" />}
              color={report.disputeCount > 0 ? "red" : "slate"}
            />
            <Card className="border-none shadow-sm bg-muted/30 flex flex-col justify-center items-center p-6">
              <div className="text-xs text-muted-foreground mb-1">Report Date</div>
              <Badge variant="outline" className="text-sm font-bold px-3 py-1">{report.date}</Badge>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function StatCard({ title, value, sub, icon, color }: { title: string; value: string; sub: string; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-600",
    blue: "from-sky-500 to-blue-600",
    violet: "from-violet-500 to-purple-600",
    amber: "from-amber-500 to-orange-500",
    red: "from-rose-500 to-red-600",
    slate: "from-slate-400 to-slate-500",
  };
  return (
    <Card className="relative overflow-hidden border-none shadow-md rounded-2xl">
      <div className={`absolute inset-0 bg-gradient-to-br ${colors[color] || colors.slate} opacity-95`} />
      <CardContent className="relative text-white p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wider text-white/80">{title}</div>
          <div className="bg-white/20 p-1.5 rounded-lg">{icon}</div>
        </div>
        <div className="text-2xl font-black">{value}</div>
        <div className="text-xs text-white/75 mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}
