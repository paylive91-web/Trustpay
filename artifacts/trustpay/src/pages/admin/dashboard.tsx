import React from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminGetDailyStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownCircle, ArrowUpCircle, Users, Clock, TrendingUp, Sparkles, ListOrdered, Settings as SettingsIcon, ShieldAlert } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminGetDailyStats();

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Gradient hero header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white p-6 shadow-xl">
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-12 -left-8 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/80">
              <Sparkles className="w-3.5 h-3.5" /> Admin Console
            </div>
            <h1 className="text-3xl font-black tracking-tight mt-2">Dashboard Overview</h1>
            <p className="text-sm text-white/85 mt-1">Daily performance and pending tasks at a glance.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
        ) : stats ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Today's Deposits"
              value={`₹ ${stats.todayDeposits.toFixed(2)}`}
              subtitle={`${stats.todayDepositCount} orders`}
              icon={<ArrowDownCircle className="h-5 w-5" />}
              gradient="from-emerald-500 to-teal-600"
            />
            <StatCard
              title="Today's Withdrawals"
              value={`₹ ${stats.todayWithdrawals.toFixed(2)}`}
              subtitle={`${stats.todayWithdrawalCount} orders`}
              icon={<ArrowUpCircle className="h-5 w-5" />}
              gradient="from-rose-500 to-red-600"
            />
            <StatCard
              title="Total Users"
              value={stats.totalUsers.toString()}
              subtitle="Registered accounts"
              icon={<Users className="h-5 w-5" />}
              gradient="from-sky-500 to-blue-600"
            />
            <StatCard
              title="Pending Orders"
              value={stats.pendingOrders.toString()}
              subtitle="Action required"
              icon={<Clock className="h-5 w-5" />}
              gradient={stats.pendingOrders > 0 ? "from-amber-500 to-orange-600" : "from-slate-400 to-slate-500"}
              urgent={stats.pendingOrders > 0}
            />
          </div>
        ) : (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">Failed to load stats</CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-none shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 p-3">
              <QuickAction
                href="/admin/orders?status=pending"
                icon={<ListOrdered className="w-4 h-4 text-indigo-600" />}
                title="Review Pending Orders"
                desc="Approve or reject recent deposits and withdrawals"
              />
              <QuickAction
                href="/admin/deposit-tasks"
                icon={<ArrowDownCircle className="w-4 h-4 text-emerald-600" />}
                title="Manage Deposit Tasks"
                desc="Create or update available deposit packages"
              />
              <QuickAction
                href="/admin/settings"
                icon={<SettingsIcon className="w-4 h-4 text-sky-600" />}
                title="Update App Settings"
                desc="Change UPI details or announcement popup"
              />
              <QuickAction
                href="/admin/disputes"
                icon={<ShieldAlert className="w-4 h-4 text-red-600" />}
                title="Review Disputes"
                desc="Resolve open cases and assign final winner"
                accent="danger"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({
  title, value, subtitle, icon, gradient, urgent = false,
}: {
  title: string; value: string; subtitle: string; icon: React.ReactNode; gradient: string; urgent?: boolean;
}) {
  return (
    <Card className={`relative overflow-hidden border-none shadow-md rounded-2xl ${urgent ? "ring-2 ring-amber-300" : ""}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-95`} />
      <div className="relative text-white">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-white/85">{title}</CardTitle>
          <div className="bg-white/20 backdrop-blur p-2 rounded-xl">{icon}</div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-black">{value}</div>
          <p className="text-xs mt-1 text-white/80">{subtitle}</p>
        </CardContent>
      </div>
    </Card>
  );
}

function QuickAction({
  href, icon, title, desc, accent,
}: { href: string; icon: React.ReactNode; title: string; desc: string; accent?: "danger" }) {
  const base = "flex items-start gap-3 p-3 rounded-xl border transition-all hover:shadow-sm";
  const cls = accent === "danger"
    ? `${base} bg-red-50 border-red-200 hover:bg-red-100`
    : `${base} bg-muted/40 border-border hover:bg-muted`;
  return (
    <a href={href} className={cls}>
      <div className={`shrink-0 mt-0.5 p-1.5 rounded-lg ${accent === "danger" ? "bg-red-100" : "bg-white"}`}>{icon}</div>
      <div className="min-w-0">
        <div className={`font-semibold text-sm ${accent === "danger" ? "text-red-700" : ""}`}>{title}</div>
        <div className={`text-xs ${accent === "danger" ? "text-red-600" : "text-muted-foreground"}`}>{desc}</div>
      </div>
    </a>
  );
}
