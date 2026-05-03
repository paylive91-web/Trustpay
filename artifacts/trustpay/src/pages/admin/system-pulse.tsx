import React from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/admin-layout";
import { getAuthToken } from "@/lib/auth";
import { BASE_ORIGIN as BASE } from "@/lib/api-config";
import {
  Activity,
  Users,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  Database,
  Cpu,
  Clock,
  IndianRupee,
  CheckCircle2,
  ShieldAlert,
  Zap,
  Server,
  HardDrive,
  Lightbulb,
  Radio,
} from "lucide-react";

interface PulseData {
  generatedAt: string;
  live: { activeUsers: number; inProgressOrders: number; pendingDisputes: number };
  today: {
    newSignups: number;
    ordersConfirmed: number;
    volume: number;
    withdrawals: number;
    disputesOpened: number;
    disputesResolved: number;
    fraudAlerts: number;
  };
  system: {
    uptimeSec: number;
    memUsedMB: number;
    memLimitMB: number;
    memPercent: number;
    dbSizeBytes: number;
    dbLimitBytes: number;
    dbPercent: number;
    dbConnections: number;
  };
  plans: {
    render: {
      plan: string;
      memUsedMB: number;
      memLimitMB: number;
      memPercent: number;
      continuousUptimeHours: number;
      projectedMonthlyHours: number;
      freeMonthlyHours: number;
      upgradeTrigger: string;
      upgradeCost: string;
    };
    database: {
      plan: string;
      sizeBytes: number;
      limitBytes: number;
      percent: number;
      connections: number;
      upgradeTrigger: string;
    };
  };
  recommendations: Array<{ severity: "info" | "warning" | "critical"; title: string; action: string }>;
  activity: Array<{ ts: string; kind: string; label: string }>;
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleString("en-IN");
}

function severityColor(p: number) {
  if (p >= 80) return { bar: "bg-rose-500", text: "text-rose-400" };
  if (p >= 60) return { bar: "bg-amber-500", text: "text-amber-400" };
  return { bar: "bg-emerald-500", text: "text-emerald-400" };
}

export default function AdminSystemPulse() {
  const { data, isLoading, dataUpdatedAt } = useQuery<PulseData>({
    queryKey: ["admin-system-pulse"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/system-pulse`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!r.ok) throw new Error("Failed to load system pulse");
      return r.json();
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  return (
    <AdminLayout>
      <div className="min-h-full bg-slate-950 text-slate-100 -m-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Radio className="h-6 w-6 text-emerald-400 animate-pulse" />
              System Pulse
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Tera personal watchman · Auto-refresh every 30s ·{" "}
              {dataUpdatedAt ? `Updated ${fmtTime(new Date(dataUpdatedAt).toISOString())}` : "Loading…"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </div>
        </div>

        {isLoading || !data ? (
          <div className="text-center text-slate-500 py-12">Loading pulse…</div>
        ) : (
          <div className="space-y-6">
            {/* LIVE NOW STRIP */}
            <section>
              <h2 className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase mb-2 flex items-center gap-1.5">
                <Activity className="h-3 w-3" /> Live Now
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <LiveTile icon={Users} label="Active Users (5 min)" value={data.live.activeUsers} accent="emerald" />
                <LiveTile icon={ShoppingCart} label="In-Progress Orders" value={data.live.inProgressOrders} accent="indigo" />
                <LiveTile icon={ShieldAlert} label="Pending Disputes" value={data.live.pendingDisputes} accent={data.live.pendingDisputes > 5 ? "rose" : "amber"} />
              </div>
            </section>

            {/* TODAY'S SUMMARY */}
            <section>
              <h2 className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3" /> Aaj Ka Summary <span className="text-slate-500 font-normal normal-case tracking-normal">(resets midnight IST)</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryTile icon={Users} label="New Signups" value={data.today.newSignups} />
                <SummaryTile icon={CheckCircle2} label="Orders Confirmed" value={data.today.ordersConfirmed} />
                <SummaryTile icon={IndianRupee} label="Volume Today" value={`₹${data.today.volume.toFixed(0)}`} />
                <SummaryTile icon={Zap} label="Withdrawals" value={data.today.withdrawals} />
                <SummaryTile icon={ShieldAlert} label="Disputes Opened" value={data.today.disputesOpened} accent={data.today.disputesOpened > 5 ? "amber" : undefined} />
                <SummaryTile icon={CheckCircle2} label="Disputes Resolved" value={data.today.disputesResolved} accent="emerald" />
                <SummaryTile icon={AlertTriangle} label="Fraud Alerts" value={data.today.fraudAlerts} accent={data.today.fraudAlerts > 5 ? "rose" : undefined} />
                <SummaryTile icon={Clock} label="System Uptime" value={fmtUptime(data.system.uptimeSec)} />
              </div>
            </section>

            {/* SYSTEM HEALTH */}
            <section>
              <h2 className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase mb-2 flex items-center gap-1.5">
                <Cpu className="h-3 w-3" /> System Health
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <MeterCard
                  icon={Server}
                  title="Server Memory"
                  used={`${data.system.memUsedMB} MB`}
                  limit={`${data.system.memLimitMB} MB`}
                  percent={data.system.memPercent}
                />
                <MeterCard
                  icon={Database}
                  title="Database Storage"
                  used={fmtBytes(data.system.dbSizeBytes)}
                  limit={fmtBytes(data.system.dbLimitBytes)}
                  percent={data.system.dbPercent}
                  extra={`${data.system.dbConnections} active connections`}
                />
              </div>
            </section>

            {/* PLAN WATCHTOWER */}
            <section>
              <h2 className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase mb-2 flex items-center gap-1.5">
                <HardDrive className="h-3 w-3" /> Plan Watchtower
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <PlanCard
                  title="Render (Hosting)"
                  plan={data.plans.render.plan}
                  rows={[
                    { k: "Memory", v: `${data.plans.render.memUsedMB} / ${data.plans.render.memLimitMB} MB (${data.plans.render.memPercent}%)` },
                    { k: "Continuous Uptime", v: `${data.plans.render.continuousUptimeHours} hr` },
                    { k: "Free Tier Cap", v: `${data.plans.render.freeMonthlyHours} hr/mo (24/7 ≈ ${data.plans.render.projectedMonthlyHours} hr)` },
                  ]}
                  trigger={data.plans.render.upgradeTrigger}
                  cost={data.plans.render.upgradeCost}
                />
                <PlanCard
                  title="Database"
                  plan={data.plans.database.plan}
                  rows={[
                    { k: "Storage", v: `${fmtBytes(data.plans.database.sizeBytes)} / ${fmtBytes(data.plans.database.limitBytes)} (${data.plans.database.percent}%)` },
                    { k: "Connections", v: String(data.plans.database.connections) },
                  ]}
                  trigger={data.plans.database.upgradeTrigger}
                  cost="Varies by provider"
                />
              </div>
            </section>

            {/* SMART RECOMMENDATIONS */}
            <section>
              <h2 className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase mb-2 flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3" /> Smart Recommendations
              </h2>
              <div className="space-y-2">
                {data.recommendations.map((r, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-3 flex items-start gap-3 ${
                      r.severity === "critical"
                        ? "bg-rose-950/40 border-rose-900/60"
                        : r.severity === "warning"
                        ? "bg-amber-950/30 border-amber-900/50"
                        : "bg-slate-900 border-slate-800"
                    }`}
                  >
                    <div
                      className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                        r.severity === "critical" ? "bg-rose-500" : r.severity === "warning" ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-100">{r.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{r.action}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ACTIVITY FEED */}
            <section>
              <h2 className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase mb-2 flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> 24h Activity Feed
              </h2>
              <div className="rounded-xl border border-slate-800 bg-slate-900 divide-y divide-slate-800 max-h-96 overflow-y-auto">
                {data.activity.length === 0 ? (
                  <div className="text-center text-slate-500 text-sm py-6">No recent activity.</div>
                ) : (
                  data.activity.map((a, i) => (
                    <div key={i} className="flex items-start gap-3 px-3 py-2 text-xs">
                      <span
                        className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${
                          a.kind === "dispute"
                            ? "bg-amber-400"
                            : a.kind === "admin"
                            ? "bg-indigo-400"
                            : a.kind === "sell"
                            ? "bg-emerald-400"
                            : "bg-sky-400"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-200 truncate">{a.label}</div>
                        <div className="text-slate-500 text-[10px]">{fmtTime(a.ts)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function LiveTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: number | string;
  accent: "emerald" | "amber" | "rose" | "indigo";
}) {
  const accentMap = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    indigo: "text-indigo-400",
  } as const;
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400">
        <Icon className={`h-3 w-3 ${accentMap[accent]}`} />
        {label}
      </div>
      <div className={`text-3xl font-bold mt-1 font-mono ${accentMap[accent]}`}>{value}</div>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: number | string;
  accent?: "emerald" | "amber" | "rose";
}) {
  const accentMap: Record<string, string> = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
  };
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={`text-xl font-bold mt-1 font-mono ${accent ? accentMap[accent] : "text-slate-100"}`}>{value}</div>
    </div>
  );
}

function MeterCard({
  icon: Icon,
  title,
  used,
  limit,
  percent,
  extra,
}: {
  icon: any;
  title: string;
  used: string;
  limit: string;
  percent: number;
  extra?: string;
}) {
  const c = severityColor(percent);
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Icon className="h-4 w-4 text-slate-400" />
          {title}
        </div>
        <div className={`text-sm font-bold font-mono ${c.text}`}>{percent}%</div>
      </div>
      <div className="text-xs text-slate-400 font-mono">
        {used} / {limit}
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full ${c.bar}`} style={{ width: `${Math.max(2, percent)}%` }} />
      </div>
      {extra && <div className="text-[11px] text-slate-500 mt-2">{extra}</div>}
    </div>
  );
}

function PlanCard({
  title,
  plan,
  rows,
  trigger,
  cost,
}: {
  title: string;
  plan: string;
  rows: Array<{ k: string; v: string }>;
  trigger: string;
  cost: string;
}) {
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-200">{title}</div>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
          {plan}
        </span>
      </div>
      <div className="space-y-1.5 text-xs">
        {rows.map((r) => (
          <div key={r.k} className="flex items-center justify-between">
            <span className="text-slate-500">{r.k}</span>
            <span className="font-mono text-slate-200">{r.v}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-800 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-amber-400">Upgrade Trigger</div>
        <div className="text-[11px] text-slate-300 leading-snug">{trigger}</div>
        <div className="text-[10px] text-slate-500 mt-1">Cost: {cost}</div>
      </div>
    </div>
  );
}
