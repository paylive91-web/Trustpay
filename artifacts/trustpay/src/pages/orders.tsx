import React, { useState, useEffect } from "react";
import { useSearch } from "wouter";
import {
  useGetOrders,
  useGetMyDisputes,
  useGetAppSettings,
  type MyDispute,
} from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import {
  IndianRupee,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ShieldCheck,
  Send,
  ImageIcon,
  FileText,
  Video,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lock,
  Timer,
  Copy as CopyIcon,
} from "lucide-react";

export default function Orders() {
  // Read initial tab from ?tab= query param so deep-links from the
  // home Live Orders card and the Buy "Open Disputes" button can land
  // directly on the Disputes tab instead of defaulting to "All".
  const search = useSearch();
  const initialTab: "all" | "deposit" | "withdrawal" | "disputes" = (() => {
    const p = new URLSearchParams(search);
    const t = p.get("tab");
    if (t === "disputes" || t === "deposit" || t === "withdrawal" || t === "all") return t;
    return "all";
  })();
  const [filterType, setFilterType] = useState<"all" | "deposit" | "withdrawal" | "disputes">(initialTab);
  // If the URL changes to a different ?tab= while we're on this page
  // (e.g. user clicks another deep-link), keep state in sync.
  useEffect(() => {
    const p = new URLSearchParams(search);
    const t = p.get("tab");
    if (t === "disputes" || t === "deposit" || t === "withdrawal" || t === "all") {
      setFilterType(t);
    }
  }, [search]);

  const ordersTypeParam = filterType === "deposit" || filterType === "withdrawal" ? filterType : undefined;
  const { data: orders, isLoading } = useGetOrders(ordersTypeParam ? { type: ordersTypeParam } : undefined);

  const filteredOrders = orders?.filter(o => filterType === "all" || filterType === "disputes" || o.type === filterType) || [];

  // Disputes — read-only here. All proof submission has moved to the
  // Telegram support flow (see ContactSupportDialog below). The user
  // collects 3 things (screenshot / bank statement / video) and forwards
  // them to TrustPay support directly via Telegram with a pre-filled
  // message containing the dispute identifier so admin can match the
  // conversation to the right row in the admin panel.
  const { data: disputesData, isLoading: loadingDisputes } = useGetMyDisputes();
  const disputes = disputesData ?? [];
  const { data: appSettings } = useGetAppSettings();
  // telegramSupportUrl falls back to telegramLink server-side, but we
  // also fall back here defensively so an empty string from a stale
  // cached settings response still produces a working button.
  const supportUrl =
    (appSettings as any)?.telegramSupportUrl ||
    (appSettings as any)?.telegramLink ||
    "https://t.me/trustpay";
  const [activeContact, setActiveContact] = useState<MyDispute | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
      case "approved": return <CheckCircle2 className="w-4 h-4 text-green-500 mr-1" />;
      case "rejected":
      case "cancelled":
      case "expired": return <XCircle className="w-4 h-4 text-destructive mr-1" />;
      case "disputed": return <ShieldAlert className="w-4 h-4 text-red-500 mr-1" />;
      default: return <Clock className="w-4 h-4 text-yellow-500 mr-1" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
      case "approved": return "bg-green-100 text-green-800 border-green-200";
      case "rejected":
      case "cancelled":
      case "expired": return "bg-red-100 text-red-800 border-red-200";
      case "disputed": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
  };

  const dispStatusColor = (s: string) =>
    s === "open" ? "bg-yellow-100 text-yellow-800" :
    s === "buyer_won" || s === "auto_resolved" ? "bg-green-100 text-green-800" :
    "bg-red-100 text-red-800";

  return (
    <Layout>
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold">My Orders</h1>

        <Tabs value={filterType} onValueChange={(v) => setFilterType(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="deposit">Buy</TabsTrigger>
            <TabsTrigger value="withdrawal">Sell</TabsTrigger>
            <TabsTrigger value="disputes">
              Disputes{disputes.filter((d) => d.status === "open").length > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">{disputes.filter((d) => d.status === "open").length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-3 pb-4">
          {filterType === "disputes" ? (
            loadingDisputes ? (
              Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
            ) : disputes.length > 0 ? (
              disputes.map((d) => (
                <Card key={d.id} className={`border-2 ${d.status === "open" ? "border-red-200" : "border-muted"}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-red-500" />
                          Dispute #{d.id} ({d.role})
                        </div>
                        <div className="text-xs text-muted-foreground">{d.createdAt ? format(new Date(d.createdAt), "MMM dd HH:mm") : ""}</div>
                      </div>
                      <Badge variant="outline" className={dispStatusColor(d.status)}>{d.status}</Badge>
                    </div>
                    {d.order && (
                      <div className="bg-muted/40 rounded p-2 text-sm">
                        Order #{d.order.id} · ₹{parseFloat(d.order.amount).toFixed(2)}
                      </div>
                    )}
                    <div className="text-sm"><span className="text-muted-foreground">Reason:</span> {d.reason}</div>
                    {d.adminNotes && <div className="text-xs italic text-muted-foreground">Admin: {d.adminNotes}</div>}

                    {d.status === "open" && (
                      <div className="border-t pt-3 space-y-2">
                        <div className="text-xs text-muted-foreground">
                          {d.role === "buyer"
                            ? "Send your payment screenshot, bank statement and screen recording to TrustPay support to defend your dispute."
                            : "Send your last-transaction screenshot, bank statement and screen recording to TrustPay support to defend your dispute."}
                        </div>
                        {(() => {
                          const deadline = new Date(new Date(d.createdAt).getTime() + 24 * 3600 * 1000).getTime();
                          const ms = deadline - Date.now();
                          if (ms <= 0) return <div className="text-xs text-red-600 font-medium">Proof window expired — admin will auto-resolve.</div>;
                          const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
                          return <div className="text-xs text-amber-700 font-medium">Time left to contact support: {h}h {m}m</div>;
                        })()}
                        <Button
                          size="sm"
                          onClick={() => setActiveContact(d)}
                          className="bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 hover:from-sky-600 hover:via-cyan-600 hover:to-blue-700 text-white shadow-md shadow-sky-200 rounded-full px-4 h-9 font-semibold gap-2"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Contact Support
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center p-8 text-muted-foreground">No disputes — keep it clean!</div>
            )
          ) : isLoading ? (
            Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
          ) : filteredOrders.length > 0 ? (
            filteredOrders.map((order: any) => (
              <Card key={order.id} className="overflow-hidden border shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-full mr-3 ${order.type === "deposit" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"}`}>
                        {order.type === "deposit" ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-semibold capitalize text-base">{order.type === "deposit" ? "Buy" : "Sell"}</div>
                        <div className="text-xs text-muted-foreground">
                          {order.createdAt ? format(new Date(order.createdAt), "MMM dd, yyyy HH:mm") : ""}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={`flex items-center rounded-full px-2 py-0.5 border ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      <span className="capitalize">{order.status}</span>
                    </Badge>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-2">
                    <div className="flex justify-between">
                      <div>
                        <div className="text-muted-foreground text-xs mb-0.5">Amount</div>
                        <div className="font-semibold flex items-center"><IndianRupee className="w-3.5 h-3.5 mr-0.5" />{order.amount.toFixed(2)}</div>
                      </div>
                      {order.type === "deposit" && order.rewardPercent > 0 ? (
                        <div className="text-right">
                          <div className="text-muted-foreground text-xs mb-0.5">Reward ({order.rewardPercent}%)</div>
                          <div className="font-semibold text-green-600 flex items-center justify-end">
                            +<IndianRupee className="w-3.5 h-3.5 mr-0.5 ml-1" />{order.rewardAmount.toFixed(2)}
                          </div>
                        </div>
                      ) : order.type === "withdrawal" && (order as any).sellRewardAmount > 0 ? (
                        <div className="text-right">
                          <div className="text-muted-foreground text-xs mb-0.5">Sell Reward ({(order as any).sellRewardPercent}%)</div>
                          <div className="font-semibold text-emerald-600 flex items-center justify-end">
                            +<IndianRupee className="w-3.5 h-3.5 mr-0.5 ml-1" />{Number((order as any).sellRewardAmount).toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-right">
                          <div className="text-muted-foreground text-xs mb-0.5">UPI</div>
                          <div className="font-medium text-xs">{order.userUpiId || "-"}</div>
                        </div>
                      )}
                    </div>
                    {order.utrNumber && (
                      <div className="border-t pt-2 text-xs text-muted-foreground">UTR: <span className="font-medium text-foreground">{order.utrNumber}</span></div>
                    )}
                  </div>
                  {order.type === "withdrawal" && order.status === "confirmed" && (order as any).sellRewardAmount > 0 && (
                    <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 leading-snug">
                      <span className="font-semibold">✓ Sold ₹{Number(order.amount).toFixed(2)}</span>
                      <span className="mx-1">·</span>
                      <span>Bonus </span>
                      <span className="font-bold text-emerald-700">+₹{Number((order as any).sellRewardAmount).toFixed(2)} ({(order as any).sellRewardPercent}%)</span>
                      <span> credited to your main balance.</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center p-8 text-muted-foreground h-full flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p>No orders found.</p>
            </div>
          )}
        </div>
      </div>

      <ContactSupportDialog
        dispute={activeContact}
        supportUrl={supportUrl}
        onClose={() => setActiveContact(null)}
      />
    </Layout>
  );
}

/**
 * Premium dispute support modal. Replaces the old in-app proof upload.
 * The user collects 3 things (per-role checklist) and is redirected to
 * Telegram with a pre-filled message so admin can identify the dispute
 * with a single glance. Files travel through Telegram, never our DB.
 */
function ContactSupportDialog({
  dispute,
  supportUrl,
  onClose,
}: {
  dispute: MyDispute | null;
  supportUrl: string;
  onClose: () => void;
}) {
  if (!dispute) return null;
  const isBuyer = dispute.role === "buyer";
  const orderId = dispute.order?.id;
  const amount = dispute.order?.amount ? parseFloat(dispute.order.amount as any).toFixed(2) : "—";
  const openedAt = dispute.createdAt ? format(new Date(dispute.createdAt), "MMM dd, yyyy · HH:mm") : "—";

  // Pre-filled message — kept short on purpose. Admin uses Dispute # to
  // pull the rest from the admin panel rather than reading a wall of
  // text in Telegram.
  const message =
    `Hi TrustPay Support,\n\n` +
    `I need help with my dispute.\n\n` +
    `• Dispute #${dispute.id}\n` +
    `• Order #${orderId ?? "—"}\n` +
    `• Amount: ₹${amount}\n` +
    `• Opened: ${openedAt}\n\n` +
    `Proof attached below.`;

  const buildSupportLink = () => {
    const base = supportUrl.trim() || "https://t.me/trustpay";
    // Telegram supports ?text= only on /share/url. For a direct chat
    // link like t.me/<handle> the message text is sent via the
    // start parameter, but in practice users still need to paste it.
    // We append it as a fragment so the user can copy-paste from URL
    // if needed; the primary copy button is the reliable path.
    try {
      const u = new URL(base);
      // Keep raw URL clean — we rely on the Copy Message button.
      return u.toString();
    } catch {
      return base;
    }
  };

  const checklist = isBuyer
    ? [
        { icon: ImageIcon, label: "Payment Screenshot", hint: "Screenshot of the payment you sent" },
        { icon: FileText, label: "Bank Statement", hint: "PDF showing the debit from your account" },
        {
          icon: Video,
          label: "Video Recording",
          hint: "Open Play Store → search the app you paid from → open it → show this transaction in your history",
        },
      ]
    : [
        { icon: ImageIcon, label: "Last Transaction Screenshot", hint: "Screenshot of your most recent received payment" },
        { icon: FileText, label: "Bank Statement", hint: "PDF showing recent credits to your account" },
        {
          icon: Video,
          label: "Video Recording",
          hint: "Open Play Store → search the app the buyer paid from → open it → show your transaction history",
        },
      ];

  const [copied, setCopied] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore — the textarea below remains visible for manual copy
    }
  };

  const handleOpenSupport = async () => {
    await handleCopyMessage();
    window.open(buildSupportLink(), "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={!!dispute} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
        {/* Calm slate-indigo header — trust over marketing */}
        <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 text-white px-5 pt-5 pb-5">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
          <DialogHeader className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/30 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-white text-lg leading-tight font-semibold">
                  We've got you
                </DialogTitle>
                <div className="text-[11px] text-slate-300">
                  Dispute #{dispute.id} · {isBuyer ? "Buyer" : "Seller"} side
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Trust signals row — the two things users want to know NOW */}
          <div className="relative grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-300 font-semibold uppercase tracking-wider">
                <Lock className="h-3 w-3" /> Held Safely
              </div>
              <div className="text-base font-bold text-white flex items-center mt-0.5">
                <IndianRupee className="h-3.5 w-3.5" />{amount}
              </div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-300 font-semibold uppercase tracking-wider">
                <Timer className="h-3 w-3" /> Avg Reply
              </div>
              <div className="text-base font-bold text-white mt-0.5">~15 min</div>
            </div>
          </div>
        </div>

        <div className="px-5 pt-4 pb-5 space-y-4 bg-white">
          {/* PRIMARY ACTION — top of body, single tap to support */}
          <Button
            onClick={handleOpenSupport}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold shadow-md shadow-indigo-200 gap-2 text-base"
          >
            <Send className="h-4 w-4" />
            Open Support on Telegram
          </Button>
          <p className="text-[11px] text-center text-slate-500 -mt-2">
            We'll copy your dispute details — paste them in the chat
          </p>

          {/* Compact proof checklist — icons only, single line each */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
            <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
              What to share when asked
            </div>
            {checklist.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="shrink-0 w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-slate-800 leading-tight">{item.label}</div>
                    <div className="text-[11px] text-slate-500 leading-tight">{item.hint}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Safety strip — Hindi warning kept verbatim per project rules */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-700 mt-0.5 shrink-0" />
            <div className="text-[11px] text-amber-900 leading-snug">
              <strong>TrustPay कभी भी आपको call नहीं करता।</strong> Never share your OTP, password or PIN. Support is <strong>only</strong> via the official Telegram link above.
            </div>
          </div>

          {/* Pre-filled message — collapsed by default */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setShowMessage((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 rounded-xl transition-colors"
            >
              <span className="text-[12px] font-medium text-slate-700">
                {showMessage ? "Hide pre-filled message" : "Show pre-filled message"}
              </span>
              {showMessage ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </button>
            {showMessage && (
              <div className="px-3 pb-3 pt-1 border-t border-slate-100">
                <pre className="text-[11px] text-slate-700 whitespace-pre-wrap font-sans leading-snug max-h-32 overflow-y-auto bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                  {message}
                </pre>
                <button
                  onClick={handleCopyMessage}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-indigo-700 hover:text-indigo-900 py-1.5"
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                  {copied ? "Copied!" : "Copy message"}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full text-xs text-muted-foreground hover:text-slate-700 py-1"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
