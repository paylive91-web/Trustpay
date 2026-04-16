import React from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminGetDailyStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownCircle, ArrowUpCircle, Users, Clock, TrendingUp } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminGetDailyStats();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-muted-foreground">Daily performance and pending tasks.</p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : stats ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title="Today's Deposits" 
              value={`₹ ${stats.todayDeposits.toFixed(2)}`} 
              subtitle={`${stats.todayDepositCount} orders`}
              icon={<ArrowDownCircle className="h-4 w-4 text-green-500" />} 
            />
            <StatCard 
              title="Today's Withdrawals" 
              value={`₹ ${stats.todayWithdrawals.toFixed(2)}`} 
              subtitle={`${stats.todayWithdrawalCount} orders`}
              icon={<ArrowUpCircle className="h-4 w-4 text-red-500" />} 
            />
            <StatCard 
              title="Total Users" 
              value={stats.totalUsers.toString()} 
              subtitle="Registered accounts"
              icon={<Users className="h-4 w-4 text-blue-500" />} 
            />
            <StatCard 
              title="Pending Orders" 
              value={stats.pendingOrders.toString()} 
              subtitle="Action required"
              icon={<Clock className="h-4 w-4 text-yellow-500" />} 
              urgent={stats.pendingOrders > 0}
            />
          </div>
        ) : (
          <div>Failed to load stats</div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <a href="/admin/orders?status=pending" className="block p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors border border-border">
                <div className="font-semibold text-sm">Review Pending Orders</div>
                <div className="text-xs text-muted-foreground">Approve or reject recent deposits and withdrawals</div>
              </a>
              <a href="/admin/deposit-tasks" className="block p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors border border-border">
                <div className="font-semibold text-sm">Manage Deposit Tasks</div>
                <div className="text-xs text-muted-foreground">Create or update available deposit packages</div>
              </a>
              <a href="/admin/settings" className="block p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors border border-border">
                <div className="font-semibold text-sm">Update App Settings</div>
                <div className="text-xs text-muted-foreground">Change UPI details or announcement popup</div>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({ title, value, subtitle, icon, urgent = false }: { title: string, value: string, subtitle: string, icon: React.ReactNode, urgent?: boolean }) {
  return (
    <Card className={urgent ? "border-yellow-400 bg-yellow-50/30 shadow-sm" : "shadow-sm border-border"}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className={`text-xs mt-1 ${urgent ? "text-yellow-600 font-medium" : "text-muted-foreground"}`}>
          {subtitle}
        </p>
      </CardContent>
    </Card>
  );
}
