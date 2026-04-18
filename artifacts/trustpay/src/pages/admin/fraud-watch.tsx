import React, { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { getAuthToken } from "@/lib/auth";
import { resolveFraudAlert } from "@/lib/admin-actions";
import { Snowflake } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export default function FraudWatch() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");
  const [sevFilter, setSevFilter] = useState<"all" | "critical" | "warn" | "info">("all");
  const [ruleFilter, setRuleFilter] = useState<string>("all");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = filter === "all" ? "" : `?resolved=${filter === "resolved" ? "true" : "false"}`;
      const r = await fetch(`${API_BASE}/admin/fraud-alerts${params}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const d = await r.json();
      if (Array.isArray(d)) setRows(d);
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const resolve = async (id: number) => {
    try {
      await resolveFraudAlert(id);
      toast({ title: "Marked resolved" });
      load();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const freezeUser = async (userId: number, username: string) => {
    if (!confirm(`Freeze user ${username}? They won't be able to lock new chunks.`)) return;
    try {
      const r = await fetch(`${API_BASE}/admin/users/${userId}/freeze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast({ title: `Froze ${username}` });
    } catch (e: any) {
      toast({ title: "Freeze failed", description: e.message, variant: "destructive" });
    }
  };

  const sevColor = (s: string) =>
    s === "critical" ? "bg-red-100 text-red-800 border-red-200" :
    s === "warn" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
    "bg-blue-100 text-blue-800 border-blue-200";

  const ruleOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.rule))).sort(), [rows]);
  const visible = useMemo(
    () => rows.filter((r) =>
      (sevFilter === "all" || r.severity === sevFilter) &&
      (ruleFilter === "all" || r.rule === ruleFilter)),
    [rows, sevFilter, ruleFilter],
  );
  const grouped = visible.reduce<Record<string, any[]>>((acc, r) => {
    (acc[r.severity] ||= []).push(r);
    return acc;
  }, {});
  const criticalOpenCount = rows.filter((r) => !r.resolved && r.severity === "critical").length;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Fraud Watch
              {criticalOpenCount > 0 && (
                <Badge variant="outline" className="ml-2 bg-red-100 text-red-800 border-red-200">{criticalOpenCount} critical open</Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">All triggered fraud rules across the platform.</p>
          </div>
          <div className="flex gap-2">
            <Select value={sevFilter} onValueChange={(v) => setSevFilter(v as any)}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All severities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ruleFilter} onValueChange={setRuleFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="All rules" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rules</SelectItem>
                {ruleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          ["critical", "warn", "info"].map((sev) => (
            (grouped[sev] || []).length > 0 && (
              <Card key={sev}>
                <CardHeader>
                  <CardTitle className="capitalize flex items-center gap-2">
                    {sev}
                    <Badge variant="outline" className={sevColor(sev)}>{(grouped[sev] || []).length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(grouped[sev] || []).map((a) => (
                    <div key={a.id} className="border rounded-lg p-3 flex justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={sevColor(a.severity)}>{a.severity}</Badge>
                          <span className="font-mono text-sm font-medium">{a.rule}</span>
                          {a.user && <span className="text-xs text-muted-foreground">user: {a.user.username} (trust {a.user.trustScore})</span>}
                          {a.orderId && <span className="text-xs text-muted-foreground">order #{a.orderId}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 break-words">{a.evidence}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(a.createdAt), "MMM dd HH:mm:ss")}</p>
                      </div>
                      <div className="flex gap-2 items-start">
                        {a.user && !a.resolved && (
                          <Button size="sm" variant="outline" onClick={() => freezeUser(a.user.id, a.user.username)}>
                            <Snowflake className="h-3.5 w-3.5 mr-1" />Freeze
                          </Button>
                        )}
                        {!a.resolved && (
                          <Button size="sm" variant="outline" onClick={() => resolve(a.id)}>Resolve</Button>
                        )}
                        {a.resolved && <Badge variant="outline" className="bg-green-50 text-green-700">resolved</Badge>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          ))
        )}
        {!loading && visible.length === 0 && (
          <div className="text-center text-muted-foreground p-12">No fraud alerts.</div>
        )}
      </div>
    </AdminLayout>
  );
}
