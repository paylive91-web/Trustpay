import React, { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  useAdminGetHighValue,
  useAdminReviewHighValue,
  getAdminGetHighValueQueryKey,
  getAdminGetHighValueUrl,
  type AdminGetHighValueParams,
  type HighValueEvent,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { Download } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export default function HighValue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"unreviewed" | "reviewed" | "all">("unreviewed");
  const [tier, setTier] = useState<"all" | "warn" | "critical">("all");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reviewing, setReviewing] = useState<HighValueEvent | null>(null);
  const [notes, setNotes] = useState("");

  const params: AdminGetHighValueParams = {};
  if (tab !== "all") params.reviewed = tab === "reviewed" ? "true" : "false";
  if (tier !== "all") params.tier = tier;
  if (submittedSearch.trim()) params.search = submittedSearch.trim();
  if (from) params.from = new Date(from).toISOString();
  if (to) params.to = new Date(to).toISOString();

  const { data, isLoading } = useAdminGetHighValue(params);
  const rows = data ?? [];

  const reviewMut = useAdminReviewHighValue({
    mutation: {
      onSuccess: () => {
        toast({ title: "Reviewed" });
        setReviewing(null); setNotes("");
        queryClient.invalidateQueries({ queryKey: getAdminGetHighValueQueryKey(params) });
      },
      onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const exportCsv = async () => {
    try {
      // CSV download endpoint — keep raw fetch since it returns a binary blob, not JSON.
      const url = getAdminGetHighValueUrl(params).replace("/admin/high-value", "/admin/high-value/export.csv");
      const r = await fetch(`${API_BASE.replace("/api", "")}${url}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!r.ok) throw new Error("Export failed");
      const blob = await r.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl; a.download = `high-value-${Date.now()}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    }
  };

  const submitReview = () => {
    if (!reviewing) return;
    reviewMut.mutate({ id: reviewing.id, data: { notes } });
  };

  const tierColor = (t: string) => t === "critical" ? "bg-red-100 text-red-800 border-red-200" : "bg-yellow-100 text-yellow-800 border-yellow-200";

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">High-Value Trades</h1>
            <p className="text-sm text-muted-foreground">Trades crossing the warn (₹5k) and critical (₹10k) thresholds.</p>
          </div>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
        </div>

        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Search username / order #</label>
              <div className="flex gap-2">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="user or order id" onKeyDown={(e) => e.key === "Enter" && setSubmittedSearch(search)} />
                <Button variant="secondary" onClick={() => setSubmittedSearch(search)}>Go</Button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tier</label>
              <Select value={tier} onValueChange={(v) => setTier(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tiers</SelectItem>
                  <SelectItem value="warn">Warn (₹5k+)</SelectItem>
                  <SelectItem value="critical">Critical (₹10k+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="unreviewed">Unreviewed</TabsTrigger>
            <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? <Skeleton className="h-96 w-full" /> : (
          <Card>
            <CardHeader><CardTitle>{rows.length} event(s)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {rows.length === 0 && <div className="text-center text-muted-foreground p-8">Nothing here.</div>}
              {rows.map((r) => (
                <div key={r.id} className="border rounded-lg p-3 flex flex-wrap items-center gap-3 justify-between">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={tierColor(r.tier)}>{r.tier}</Badge>
                      <span className="font-bold text-lg">₹{r.amount.toLocaleString()}</span>
                      {r.user && <span className="text-sm text-muted-foreground">{r.user.username} (trust {r.user.trustScore})</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Order #{r.orderId} · {format(new Date(r.createdAt), "MMM dd HH:mm")}
                      {r.reviewedAt && ` · Reviewed ${format(new Date(r.reviewedAt), "MMM dd")}`}
                    </div>
                    {r.notes && <div className="text-xs mt-1 italic">"{r.notes}"</div>}
                  </div>
                  {!r.reviewedAt && (
                    <Button size="sm" variant="outline" onClick={() => { setReviewing(r); setNotes(""); }}>Mark Reviewed</Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review High-Value Trade #{reviewing?.orderId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <strong>{reviewing?.user?.username}</strong> — ₹{reviewing?.amount?.toLocaleString()} ({reviewing?.tier})
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Notes (optional)</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Verified KYC / contacted user / ..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)}>Cancel</Button>
            <Button onClick={submitReview} disabled={reviewMut.isPending}>{reviewMut.isPending ? "Saving..." : "Save Review"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
