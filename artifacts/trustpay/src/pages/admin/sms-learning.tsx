import React, { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { getAuthToken } from "@/lib/auth";
import { MessageSquare, Shield, Zap, Trash2, CheckCircle2, XCircle, RefreshCw, Plus, Info } from "lucide-react";

import { API_BASE } from "@/lib/api-config";

async function adminApi(path: string, opts: RequestInit = {}) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const bucketColor = (b: string) =>
  b === "suspicious"
    ? "bg-yellow-100 text-yellow-800 border-yellow-200"
    : "bg-red-100 text-red-800 border-red-200";

const statusColor = (s: string) =>
  s === "approved"
    ? "bg-green-100 text-green-800 border-green-200"
    : s === "rejected"
    ? "bg-red-100 text-red-800 border-red-200"
    : s === "proposed"
    ? "bg-blue-100 text-blue-800 border-blue-200"
    : "bg-gray-100 text-gray-700 border-gray-200";

export default function SmsLearning() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [bucketFilter, setBucketFilter] = useState<string>("all");
  const [newSender, setNewSender] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [addingLoading, setAddingLoading] = useState(false);

  const queueQuery = useQuery<any[]>({
    queryKey: ["sms-queue", bucketFilter],
    queryFn: () =>
      adminApi(`/admin/sms-learning/queue?status=pending&limit=100${bucketFilter !== "all" ? "&bucket=" + bucketFilter : ""}`),
  });

  const candidatesQuery = useQuery<any[]>({
    queryKey: ["sms-candidates"],
    queryFn: () => adminApi("/admin/sms-learning/candidates"),
  });

  const safeSendersQuery = useQuery<any[]>({
    queryKey: ["sms-safe-senders"],
    queryFn: () => adminApi("/admin/sms-learning/safe-senders"),
  });

  const queue = queueQuery.data ?? [];
  const candidates = candidatesQuery.data ?? [];
  const safeSenders = safeSendersQuery.data ?? [];

  const proposedCount = candidates.filter((c) => c.status === "proposed").length;

  async function propose() {
    try {
      const r = await adminApi("/admin/sms-learning/propose", { method: "POST" });
      toast({ title: `Pattern proposer ran: ${r.proposed} proposed, ${r.skipped} skipped` });
      qc.invalidateQueries({ queryKey: ["sms-candidates"] });
      qc.invalidateQueries({ queryKey: ["sms-queue"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  }

  async function dismiss(id: number) {
    try {
      await adminApi(`/admin/sms-learning/queue/${id}/dismiss`, { method: "POST" });
      toast({ title: "Rejected" });
      qc.invalidateQueries({ queryKey: ["sms-queue"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  }

  async function approvePattern(id: number) {
    try {
      await adminApi(`/admin/sms-learning/queue/${id}/approve-pattern`, { method: "POST" });
      toast({ title: "Pattern approved — active rule created for this sender" });
      qc.invalidateQueries({ queryKey: ["sms-queue"] });
      qc.invalidateQueries({ queryKey: ["sms-safe-senders"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  }

  async function markSafeSender(id: number) {
    try {
      await adminApi(`/admin/sms-learning/queue/${id}/safe-sender`, { method: "POST" });
      toast({ title: "Sender marked safe — all matching queue items dismissed" });
      qc.invalidateQueries({ queryKey: ["sms-queue", "all"] });
      qc.invalidateQueries({ queryKey: ["sms-queue", "suspicious"] });
      qc.invalidateQueries({ queryKey: ["sms-queue", "unparsed"] });
      qc.invalidateQueries({ queryKey: ["sms-safe-senders"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  }

  async function reviewCandidate(id: number, action: "approve" | "reject") {
    try {
      await adminApi(`/admin/sms-learning/candidates/${id}/${action}`, { method: "POST" });
      toast({ title: action === "approve" ? "Pattern approved — sender added to safe list" : "Pattern rejected" });
      qc.invalidateQueries({ queryKey: ["sms-candidates"] });
      qc.invalidateQueries({ queryKey: ["sms-safe-senders"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  }

  async function addSafeSender(e: React.FormEvent) {
    e.preventDefault();
    if (!newSender.trim()) return;
    setAddingLoading(true);
    try {
      await adminApi("/admin/sms-learning/safe-senders", {
        method: "POST",
        body: JSON.stringify({ senderKey: newSender.trim(), label: newLabel.trim() || undefined }),
      });
      toast({ title: `Safe sender "${newSender.trim().toUpperCase()}" added` });
      setNewSender("");
      setNewLabel("");
      qc.invalidateQueries({ queryKey: ["sms-safe-senders"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setAddingLoading(false);
    }
  }

  async function deleteSafeSender(id: number, key: string) {
    if (!confirm(`Remove "${key}" from safe senders?`)) return;
    try {
      await adminApi(`/admin/sms-learning/safe-senders/${id}`, { method: "DELETE" });
      toast({ title: `Removed ${key}` });
      qc.invalidateQueries({ queryKey: ["sms-safe-senders"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            SMS Safe Learning
            {proposedCount > 0 && (
              <Badge variant="outline" className="ml-1 bg-blue-100 text-blue-800 border-blue-200">
                {proposedCount} patterns pending review
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Unmatched SMS from users. Approve senders or patterns to improve auto-confirm coverage.
          </p>
        </div>

        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800">
              <strong>How it works:</strong> When a seller's device receives an SMS that doesn't match any pending order,
              it's stored here for review. <strong>Suspicious</strong> = trusted sender but no order match (excess/timing issue).
              <strong className="ml-1">Unparsed</strong> = unknown sender or non-standard SMS format. Run
              <strong className="ml-1">Propose Patterns</strong> to auto-cluster similar SMS templates and review them in bulk.
            </p>
          </CardContent>
        </Card>

        <Tabs defaultValue="queue" className="space-y-4">
          <TabsList>
            <TabsTrigger value="queue">
              Learning Queue
              {queue.length > 0 && (
                <Badge variant="outline" className="ml-1 text-xs py-0 px-1 h-4">{queue.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="candidates">
              Pattern Candidates
              {proposedCount > 0 && (
                <Badge variant="outline" className="ml-1 bg-blue-100 text-blue-800 border-blue-200 text-xs py-0 px-1 h-4">
                  {proposedCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="safe-senders">
              Safe Senders
              {safeSenders.length > 0 && (
                <Badge variant="outline" className="ml-1 text-xs py-0 px-1 h-4">{safeSenders.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="space-y-3">
            <div className="flex items-center gap-2 justify-between flex-wrap">
              <div className="flex gap-2">
                {["all", "suspicious", "unparsed"].map((b) => (
                  <Button
                    key={b}
                    size="sm"
                    variant={bucketFilter === b ? "default" : "outline"}
                    onClick={() => setBucketFilter(b)}
                    className="capitalize text-xs h-7"
                  >
                    {b}
                  </Button>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={propose} className="gap-1">
                <Zap className="h-3.5 w-3.5" />
                Propose Patterns
              </Button>
            </div>

            {queueQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : queue.length === 0 ? (
              <div className="text-center text-muted-foreground p-12">
                No pending SMS in queue.
              </div>
            ) : (
              <div className="space-y-2">
                {queue.map((item) => (
                  <Card key={item.id} className="border border-gray-200">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={bucketColor(item.bucket)}>
                          {item.bucket}
                        </Badge>
                        <span className="font-mono text-sm font-medium text-gray-800">{item.sender}</span>
                        <span className="font-mono text-xs text-muted-foreground">key: {item.senderKey}</span>
                        {item.parsedUtr && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-xs">
                            UTR: {item.parsedUtr}
                          </Badge>
                        )}
                        {item.parsedAmount && (
                          <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                            ₹{item.parsedAmount}
                          </Badge>
                        )}
                        {item.isDebit && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">DEBIT</Badge>
                        )}
                      </div>

                      <div className="bg-gray-50 rounded p-2 font-mono text-xs text-gray-700 break-all leading-relaxed border border-gray-100">
                        {item.body}
                      </div>

                      {item.templateBody && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Template:</span>{" "}
                          <span className="font-mono">{item.templateBody}</span>
                        </div>
                      )}

                      {item.reason && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Reason:</span>{" "}
                          <span className="font-mono bg-gray-100 px-1 rounded">{item.reason}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          #{item.id} · {format(new Date(item.createdAt), "MMM dd HH:mm")}
                          {item.userId && ` · user #${item.userId}`}
                        </span>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-emerald-700 border-emerald-300"
                            onClick={() => approvePattern(item.id)}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Approve Pattern
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-teal-700 border-teal-300"
                            onClick={() => markSafeSender(item.id)}
                          >
                            <Shield className="h-3 w-3 mr-1" />
                            Safe Sender
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-500 border-red-200"
                            onClick={() => dismiss(item.id)}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="candidates" className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Clusters of ≥5 similar SMS from the same sender. Approve to add sender to safe list.
              </p>
              <Button size="sm" variant="outline" onClick={propose} className="gap-1">
                <RefreshCw className="h-3.5 w-3.5" />
                Re-run Proposer
              </Button>
            </div>

            {candidatesQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : candidates.length === 0 ? (
              <div className="text-center text-muted-foreground p-12">
                No candidate patterns. Run "Propose Patterns" after collecting ≥5 similar SMS.
              </div>
            ) : (
              <div className="space-y-2">
                {candidates.map((c) => (
                  <Card key={c.id} className="border border-gray-200">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={statusColor(c.status)}>{c.status}</Badge>
                        <span className="font-mono text-sm font-bold text-gray-800">{c.senderKey}</span>
                        <Badge variant="outline" className="text-xs">
                          {c.sampleCount} samples
                        </Badge>
                        {c.utrSample && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-xs">
                            UTR eg: {c.utrSample}
                          </Badge>
                        )}
                        {c.amountSample && (
                          <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                            ₹{c.amountSample}
                          </Badge>
                        )}
                      </div>

                      <div className="bg-gray-50 rounded p-2 font-mono text-xs text-gray-700 break-all leading-relaxed border border-gray-100">
                        {c.templateBody}
                      </div>

                      {c.reviewedAt && (
                        <p className="text-[10px] text-muted-foreground">
                          Reviewed {format(new Date(c.reviewedAt), "MMM dd HH:mm")}
                          {c.notes && ` — ${c.notes}`}
                        </p>
                      )}

                      {c.status === "proposed" && (
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => reviewCandidate(c.id, "approve")}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Approve + Trust Sender
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-600 border-red-300"
                            onClick={() => reviewCandidate(c.id, "reject")}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}

                      <p className="text-[10px] text-muted-foreground">
                        #{c.id} · created {format(new Date(c.createdAt), "MMM dd HH:mm")}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="safe-senders" className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Add Custom Safe Sender</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={addSafeSender} className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-xs text-muted-foreground mb-1 block">Sender Key (e.g. MYBANK)</label>
                    <Input
                      value={newSender}
                      onChange={(e) => setNewSender(e.target.value)}
                      placeholder="MYCOOPBANK"
                      className="h-8 text-sm font-mono uppercase"
                    />
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-xs text-muted-foreground mb-1 block">Label (optional)</label>
                    <Input
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="My Cooperative Bank"
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button type="submit" size="sm" className="h-8 gap-1" disabled={!newSender.trim() || addingLoading}>
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </form>
              </CardContent>
            </Card>

            {safeSendersQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : safeSenders.length === 0 ? (
              <div className="text-center text-muted-foreground p-8">
                No custom safe senders added yet.
              </div>
            ) : (
              <div className="space-y-2">
                {safeSenders.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg bg-white gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-teal-600" />
                        <span className="font-mono font-bold text-sm">{s.senderKey}</span>
                        {s.label && <span className="text-sm text-muted-foreground">{s.label}</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Added by {s.addedByUsername} · {format(new Date(s.createdAt), "MMM dd yyyy HH:mm")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-red-600 border-red-300 text-xs"
                      onClick={() => deleteSafeSender(s.id, s.senderKey)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
