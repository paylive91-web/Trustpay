import React from "react";
import AdminLayout from "@/components/admin-layout";
import { useGetAppSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { Users, Award, Flame, IndianRupee, ShieldCheck } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AdminAgents() {
  const { data: appSettings } = useGetAppSettings();
  const agentTiers = Array.isArray((appSettings as any)?.agentTiers) ? (appSettings as any).agentTiers : [];

  const { data: agents = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin-agents"],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/api/admin/agents`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const totalTodayActive = agents.reduce((sum, a) => sum + (a.todayActiveInvitees || 0), 0);
  const totalEarnings = agents.reduce((sum, a) => sum + (a.inviteEarnings || 0), 0);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Verified Agents
          </h1>
          <p className="text-muted-foreground mt-1">Users who have earned the Verified Agent badge. Live invite activity updates every 30s.</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">Total Agents</div>
              <div className="text-2xl font-bold text-primary">{agents.length}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">Today Active Invites</div>
              <div className="text-2xl font-bold text-orange-500 flex items-center justify-center gap-1">
                <Flame className="w-5 h-5" />
                {totalTodayActive}
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">Total Invite Earnings</div>
              <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                <IndianRupee className="w-4 h-4" />
                {totalEarnings.toFixed(0)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">Agent Tiers Configured</div>
              <div className="text-2xl font-bold text-violet-600">{agentTiers.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Agent Tiers Reference */}
        {agentTiers.length > 0 && (
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                Agent Reward Tiers (Reference)
              </CardTitle>
              <CardDescription>Rewards credited when an agent's daily active invite deposit count crosses the threshold.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {agentTiers.map((tier: any, idx: number) => (
                  <div key={idx} className="rounded-xl border bg-muted/30 p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">{tier.label || `Tier ${idx + 1}`}</div>
                      <div className="text-xs text-muted-foreground">{tier.minActiveDeposits}+ active invites today</div>
                    </div>
                    <div className="font-bold text-emerald-700 text-sm">₹{Number(tier.reward || 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Agents List */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              All Verified Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center text-muted-foreground py-10 text-sm">
                No verified agents yet. Agents earn the badge when they first qualify for a tier.
              </div>
            ) : (
              <div className="space-y-2">
                {agents.map((agent: any) => {
                  const todayActive = agent.todayActiveInvitees || 0;
                  const qualifiedTier = [...agentTiers]
                    .filter((t: any) => todayActive >= Number(t.minActiveDeposits || 0))
                    .pop();

                  return (
                    <div key={agent.id} className="rounded-2xl border border-muted bg-white p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-base">
                            {(agent.displayName || agent.username || "?")[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                              {agent.displayName || agent.username}
                              <Badge className="bg-red-500 text-white text-[9px] px-1.5 py-0 rounded-full shrink-0">Verified Agent</Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground">@{agent.username} {agent.phone ? `· ${agent.phone}` : ""}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-muted-foreground uppercase">Today Active</div>
                          <div className={`text-lg font-bold flex items-center gap-1 ${todayActive > 0 ? "text-orange-500" : "text-slate-400"}`}>
                            <Flame className="w-4 h-4" />
                            {todayActive}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-blue-50 p-2 text-center">
                          <div className="text-[10px] text-blue-600 uppercase">Total Invitees</div>
                          <div className="text-sm font-bold text-blue-700">{agent.totalInvitees || 0}</div>
                        </div>
                        <div className="rounded-lg bg-emerald-50 p-2 text-center">
                          <div className="text-[10px] text-emerald-600 uppercase">Invite Earnings</div>
                          <div className="text-sm font-bold text-emerald-700">₹{Number(agent.inviteEarnings || 0).toFixed(2)}</div>
                        </div>
                        <div className="rounded-lg bg-violet-50 p-2 text-center">
                          <div className="text-[10px] text-violet-600 uppercase">Today Tier</div>
                          <div className="text-sm font-bold text-violet-700">{qualifiedTier ? qualifiedTier.label : "—"}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
