import React, { useState, useEffect } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminGetSettings, useAdminUpdateSettings } from "@workspace/api-client-react";
import { getAdminGetSettingsQueryKey, getGetAppSettingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Users, Award, Flame, IndianRupee, ShieldCheck, Plus, Trash2, Pencil, Check, X, Info } from "lucide-react";

import { BASE_ORIGIN as BASE } from "@/lib/api-config";

interface AgentTier {
  minActiveDeposits: number;
  reward: number;
  label: string;
}

export default function AdminAgents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: adminSettings, isLoading: settingsLoading } = useAdminGetSettings({
    query: { queryKey: getAdminGetSettingsQueryKey(), retry: false, refetchOnWindowFocus: false },
  });

  const [tiers, setTiers] = useState<AgentTier[]>([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (adminSettings) {
      const raw = Array.isArray((adminSettings as any).agentTiers) ? (adminSettings as any).agentTiers : [];
      setTiers(raw.map((t: any) => ({
        minActiveDeposits: Number(t.minActiveDeposits) || 0,
        reward: Number(t.reward) || 0,
        label: String(t.label || ""),
      })));
    }
  }, [adminSettings]);

  const updateMut = useAdminUpdateSettings({
    mutation: {
      onSuccess: () => {
        toast({ title: "Agent tiers saved!" });
        queryClient.invalidateQueries({ queryKey: getAdminGetSettingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAppSettingsQueryKey() });
        setEditing(false);
      },
      onError: (err: any) => {
        toast({ title: "Save failed", description: err?.message, variant: "destructive" });
      },
    },
  });

  const handleSave = () => {
    updateMut.mutate({ data: { agentTiers: tiers } as any });
  };

  const addTier = () => {
    const last = tiers[tiers.length - 1];
    setTiers((prev) => [
      ...prev,
      {
        minActiveDeposits: last ? last.minActiveDeposits + 25 : 20,
        reward: 50,
        label: `Tier ${prev.length + 1}`,
      },
    ]);
  };

  const removeTier = (i: number) => setTiers((prev) => prev.filter((_, idx) => idx !== i));

  const updateTier = (i: number, field: keyof AgentTier, val: any) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: val } : t)));

  const cancelEdit = () => {
    if (adminSettings) {
      const raw = Array.isArray((adminSettings as any).agentTiers) ? (adminSettings as any).agentTiers : [];
      setTiers(raw.map((t: any) => ({
        minActiveDeposits: Number(t.minActiveDeposits) || 0,
        reward: Number(t.reward) || 0,
        label: String(t.label || ""),
      })));
    }
    setEditing(false);
  };

  const { data: agents = [], isLoading: agentsLoading } = useQuery<any[]>({
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
          <p className="text-muted-foreground mt-1">
            Manage agent reward tiers and monitor verified agents' daily activity.
          </p>
        </div>

        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800">
              <strong>Agent Tiers</strong> define the reward structure for verified agents based on their active deposit count. Each tier specifies a minimum number of active deposits and the flat ₹ reward they earn.
              Changes to tiers take effect immediately for all active agents. Agents who drop below a tier's minimum will lose that tier's reward until they recover.
              <strong className="ml-1">Active Deposits</strong> = deposits currently in an open/locked state that the agent directly placed.
            </p>
          </CardContent>
        </Card>

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
              <div className="text-xs text-muted-foreground mb-1">Tiers Configured</div>
              <div className="text-2xl font-bold text-violet-600">{tiers.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Agent Reward Tiers — Editable */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" />
                  Agent Reward Tiers
                </CardTitle>
                <CardDescription className="mt-0.5">
                  Set tier names, minimum active invite deposits, and daily reward amounts. Changes reflect in the app instantly.
                </CardDescription>
              </div>
              {!editing && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {settingsLoading ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                  <div className="col-span-4">Name (e.g. Gold)</div>
                  <div className="col-span-3">Min Active Invites</div>
                  <div className="col-span-4">Daily Reward (₹)</div>
                  <div className="col-span-1"></div>
                </div>
                {tiers.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No tiers yet — click "Add Tier" below.</p>
                )}
                {tiers.map((tier, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      className="col-span-4"
                      placeholder="e.g. Gold Agent"
                      value={tier.label}
                      onChange={(e) => updateTier(idx, "label", e.target.value)}
                    />
                    <Input
                      type="number"
                      className="col-span-3"
                      placeholder="20"
                      value={tier.minActiveDeposits}
                      onChange={(e) => updateTier(idx, "minActiveDeposits", parseInt(e.target.value) || 0)}
                    />
                    <Input
                      type="number"
                      className="col-span-4"
                      placeholder="50"
                      value={tier.reward}
                      onChange={(e) => updateTier(idx, "reward", parseFloat(e.target.value) || 0)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-span-1"
                      onClick={() => removeTier(idx)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addTier} className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> Add Tier
                </Button>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={cancelEdit}
                    disabled={updateMut.isPending}
                  >
                    <X className="w-4 h-4 mr-1.5" /> Cancel
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={handleSave}
                    disabled={updateMut.isPending}
                  >
                    <Check className="w-4 h-4 mr-1.5" />
                    {updateMut.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            ) : tiers.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">
                No tiers configured. Click <strong>Edit</strong> to add tiers.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {tiers.map((tier, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border bg-muted/30 p-3 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-sm">{tier.label || `Tier ${idx + 1}`}</div>
                      <div className="text-xs text-muted-foreground">
                        {tier.minActiveDeposits}+ active invites today
                      </div>
                    </div>
                    <div className="font-bold text-emerald-700 text-sm">
                      ₹{Number(tier.reward || 0).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agents List */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              All Verified Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agentsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center text-muted-foreground py-10 text-sm">
                No verified agents yet. Agents earn the badge when they qualify for a tier today.
              </div>
            ) : (
              <div className="space-y-2">
                {agents.map((agent: any) => {
                  const todayActive = agent.todayActiveInvitees || 0;
                  const qualifiedTier = [...tiers]
                    .filter((t) => todayActive >= Number(t.minActiveDeposits || 0))
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
                              <Badge className="bg-red-500 text-white text-[9px] px-1.5 py-0 rounded-full shrink-0">
                                Verified Agent
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              @{agent.username} {agent.phone ? `· ${agent.phone}` : ""}
                            </div>
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
                          <div className="text-sm font-bold text-emerald-700">
                            ₹{Number(agent.inviteEarnings || 0).toFixed(2)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-violet-50 p-2 text-center">
                          <div className="text-[10px] text-violet-600 uppercase">Today Tier</div>
                          <div className="text-sm font-bold text-violet-700">
                            {qualifiedTier ? qualifiedTier.label : "—"}
                          </div>
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
