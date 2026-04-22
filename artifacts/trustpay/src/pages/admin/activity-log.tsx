import React, { useState, useEffect } from "react";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";
import { format } from "date-fns";
import { Activity, Info, RefreshCw, Filter } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

async function apiFetch(path: string) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || "Request failed");
  }
  return res.json();
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  freeze_user: "Freeze User",
  unfreeze_user: "Unfreeze User",
  force_close_order: "Force-Close Order",
  trade_pair_block: "Trade Pair Block",
  trade_pair_unblock: "Trade Pair Unblock",
  matching_paused: "Matching Paused",
  matching_resumed: "Matching Resumed",
  bulk_resolve_alerts: "Bulk Resolve Alerts",
  mark_trusted: "Mark Trusted",
  unmark_trusted: "Unmark Trusted",
  reset_fraud_warnings: "Reset Fraud Warnings",
  transaction_reversal: "Transaction Reversal",
  extend_dispute_deadline: "Extend Dispute Deadline",
  balance_adjust: "Balance Adjust",
  resolve_dispute: "Resolve Dispute",
};

const ACTION_COLORS: Record<string, string> = {
  freeze_user: "bg-red-100 text-red-800",
  unfreeze_user: "bg-green-100 text-green-800",
  force_close_order: "bg-orange-100 text-orange-800",
  trade_pair_block: "bg-purple-100 text-purple-800",
  trade_pair_unblock: "bg-purple-50 text-purple-600",
  matching_paused: "bg-red-100 text-red-700",
  matching_resumed: "bg-emerald-100 text-emerald-700",
  bulk_resolve_alerts: "bg-blue-100 text-blue-800",
  mark_trusted: "bg-teal-100 text-teal-800",
  unmark_trusted: "bg-slate-100 text-slate-700",
  reset_fraud_warnings: "bg-yellow-100 text-yellow-800",
  transaction_reversal: "bg-rose-100 text-rose-800",
  extend_dispute_deadline: "bg-sky-100 text-sky-800",
};

export default function AdminActivityLog() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionTypeFilter, setActionTypeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [adminIdFilter, setAdminIdFilter] = useState("");

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionTypeFilter !== "all") params.set("actionType", actionTypeFilter);
      if (fromDate) params.set("from", fromDate + "T00:00:00Z");
      if (toDate) params.set("to", toDate + "T23:59:59Z");
      if (adminIdFilter.trim()) params.set("adminId", adminIdFilter.trim());
      params.set("limit", "200");
      const data = await apiFetch(`/admin/action-logs?${params}`);
      setLogs(data);
    } catch (e: any) {
      toast({ title: "Failed to load logs", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-100">
            <Activity className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Activity Log</h1>
            <p className="text-sm text-muted-foreground">
              Every significant admin action is recorded here — freezes, reversals, balance changes, matching engine toggles, and more.
            </p>
          </div>
        </div>

        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-800">
              Use this log to audit all admin activity. You can filter by action type and date range. Each entry shows which admin performed the action, what entity was affected, and any relevant details.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Filter className="h-4 w-4" /> Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label>Action Type</Label>
              <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {Object.keys(ACTION_TYPE_LABELS).map((k) => (
                    <SelectItem key={k} value={k}>{ACTION_TYPE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Admin User ID</Label>
              <Input type="number" placeholder="e.g. 1" value={adminIdFilter} onChange={(e) => setAdminIdFilter(e.target.value)} className="w-[130px]" />
            </div>
            <div className="space-y-1">
              <Label>From Date</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[160px]" />
            </div>
            <div className="space-y-1">
              <Label>To Date</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[160px]" />
            </div>
            <Button onClick={loadLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Loading..." : "Apply Filters"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Log Entries ({logs.length})</CardTitle>
            <CardDescription>Most recent first. Showing up to 200 entries.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">No activity logs yet.</div>
            ) : (
              <div className="divide-y">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-4">
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-xs ${ACTION_COLORS[log.actionType] || "bg-slate-100 text-slate-700"}`}
                    >
                      {ACTION_TYPE_LABELS[log.actionType] || log.actionType}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-primary">{log.adminUsername}</span>
                        {log.targetType && log.targetId && (
                          <span className="text-muted-foreground text-xs">→ {log.targetType} #{log.targetId}</span>
                        )}
                      </div>
                      {log.details && (
                        <p className="text-xs text-muted-foreground mt-0.5 break-words">{log.details}</p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                      {format(new Date(log.createdAt), "MMM dd HH:mm")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
