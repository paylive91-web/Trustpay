import React, { useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  useAdminGetFraudAlerts,
  useAdminResolveFraudAlert,
  useAdminFreezeUser,
  useAdminGetFraudRules,
  useAdminToggleFraudRule,
  getAdminGetFraudAlertsQueryKey,
  getAdminGetFraudRulesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { Snowflake, BellRing } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const sevColor = (s: string) =>
  s === "critical" ? "bg-red-100 text-red-800 border-red-200" :
  s === "warn" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
  "bg-blue-100 text-blue-800 border-blue-200";

export default function FraudWatch() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");
  const [sevFilter, setSevFilter] = useState<"all" | "critical" | "warn" | "info">("all");
  const [ruleFilter, setRuleFilter] = useState<string>("all");

  const queryParams = filter === "all" ? undefined : { resolved: filter === "resolved" ? "true" as const : "false" as const };
  const { data, isLoading, refetch } = useAdminGetFraudAlerts(queryParams);
  const rows = data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getAdminGetFraudAlertsQueryKey(queryParams) });

  const resolveMut = useAdminResolveFraudAlert({
    mutation: {
      onSuccess: () => { toast({ title: "Marked resolved" }); invalidate(); },
      onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const freezeMut = useAdminFreezeUser({
    mutation: {
      onSuccess: () => { refetch(); },
      onError: (e: any) => toast({ title: "Freeze failed", description: e.message, variant: "destructive" }),
    },
  });

  const notifyAlert = async (id: number) => {
    try {
      const r = await fetch(`${API_BASE}/admin/fraud-alerts/${id}/notify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast({ title: "User notified" });
      invalidate();
    } catch (e: any) {
      toast({ title: "Notify failed", description: e.message, variant: "destructive" });
    }
  };

  const freezeUser = (userId: number, username: string) => {
    if (!confirm(`Freeze user ${username}? They won't be able to lock new chunks.`)) return;
    freezeMut.mutate({ id: userId }, { onSuccess: () => toast({ title: `Froze ${username}` }) });
  };

  const ruleOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.rule))).sort(), [rows]);
  const visible = useMemo(
    () => rows.filter((r) =>
      (sevFilter === "all" || r.severity === sevFilter) &&
      (ruleFilter === "all" || r.rule === ruleFilter)),
    [rows, sevFilter, ruleFilter],
  );
  const grouped = visible.reduce<Record<string, typeof rows>>((acc, r) => {
    (acc[r.severity] ||= []).push(r);
    return acc;
  }, {});
  const criticalOpenCount = rows.filter((r) => !r.resolved && r.severity === "critical").length;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Fraud Watch
            {criticalOpenCount > 0 && (
              <Badge variant="outline" className="ml-2 bg-red-100 text-red-800 border-red-200">{criticalOpenCount} critical open</Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">All triggered fraud rules across the platform.</p>
        </div>

        <Tabs defaultValue="alerts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="space-y-4">
            <div className="flex flex-wrap gap-2 justify-end">
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

            {isLoading ? (
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
                          <div className="flex gap-2 items-start flex-wrap">
                            {a.notifiedAt ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                <BellRing className="h-3 w-3 mr-1" />notified {format(new Date(a.notifiedAt), "MMM dd HH:mm")}
                              </Badge>
                            ) : (
                              a.user && (
                                <Button size="sm" variant="outline" onClick={() => notifyAlert(a.id)}>
                                  <BellRing className="h-3.5 w-3.5 mr-1" />Notify user
                                </Button>
                              )
                            )}
                            {a.user && !a.resolved && (
                              <Button size="sm" variant="outline" onClick={() => freezeUser(a.user!.id, a.user!.username)}>
                                <Snowflake className="h-3.5 w-3.5 mr-1" />Freeze
                              </Button>
                            )}
                            {!a.resolved && (
                              <Button size="sm" variant="outline" onClick={() => resolveMut.mutate({ id: a.id })}>Resolve</Button>
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
            {!isLoading && visible.length === 0 && (
              <div className="text-center text-muted-foreground p-12">No fraud alerts.</div>
            )}
          </TabsContent>

          <TabsContent value="rules">
            <RulesPanel />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function RulesPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminGetFraudRules();
  const rules = data ?? [];

  const toggleMut = useAdminToggleFraudRule({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminGetFraudRulesQueryKey() }),
      onError: (e: any) => toast({ title: "Toggle failed", description: e.message, variant: "destructive" }),
    },
  });

  const onToggle = (rule: string, enabled: boolean) => {
    toggleMut.mutate(
      { data: { rule, enabled } },
      { onSuccess: () => toast({ title: `${rule} ${enabled ? "enabled" : "disabled"}` }) },
    );
  };

  const groups = useMemo(() => {
    const g: Record<string, typeof rules> = { critical: [], warn: [], info: [] };
    for (const r of rules) (g[r.severity] ||= []).push(r);
    return g;
  }, [rules]);

  const disabledCount = rules.filter((r) => !r.enabled).length;

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {disabledCount === 0 ? "All rules are active." : `${disabledCount} rule${disabledCount === 1 ? "" : "s"} disabled — those checks will not fire.`}
      </div>
      {(["critical", "warn", "info"] as const).map((sev) => (
        (groups[sev] || []).length > 0 && (
          <Card key={sev}>
            <CardHeader>
              <CardTitle className="capitalize flex items-center gap-2">
                {sev}
                <Badge variant="outline" className={sevColor(sev)}>{(groups[sev] || []).length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(groups[sev] || []).map((r) => (
                <div key={r.rule} className="border rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.label}</span>
                      <Badge variant="outline" className={sevColor(r.severity)}>{r.severity}</Badge>
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground mt-1">{r.rule}</p>
                    {!r.enabled && r.updatedAt && (
                      <p className="text-[10px] text-muted-foreground mt-1">disabled {format(new Date(r.updatedAt), "MMM dd HH:mm")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${r.enabled ? "text-green-700" : "text-muted-foreground"}`}>
                      {r.enabled ? "On" : "Off"}
                    </span>
                    <Switch
                      checked={r.enabled}
                      onCheckedChange={(v) => onToggle(r.rule, v)}
                      disabled={toggleMut.isPending}
                      aria-label={`Toggle ${r.label}`}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      ))}
    </div>
  );
}
