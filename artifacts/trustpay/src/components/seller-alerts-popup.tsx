import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Lock, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { getAuthToken } from "@/lib/auth";
import { playAlarm } from "@/lib/alarm";
import { useToast } from "@/hooks/use-toast";

type SellerAlert = {
  id: number;
  amount: number;
  status: "locked" | "pending_confirmation";
  utrNumber?: string | null;
  screenshotUrl?: string | null;
  recordingUrl?: string | null;
  buyer?: { id?: number; username?: string } | null;
  confirmDeadline?: string | null;
  lockedAt?: string | null;
};

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

async function api(path: string, opts: RequestInit = {}) {
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

function fmtCountdown(ms: number) {
  if (ms <= 0) return "00:00";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function SellerAlertsPopup() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [proofViewer, setProofViewer] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showHistoryWarning, setShowHistoryWarning] = useState(false);
  const [showDisputeWarning, setShowDisputeWarning] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  const { data: alerts = [], refetch } = useQuery<SellerAlert[]>({
    queryKey: ["seller-alerts"],
    queryFn: () => api("/p2p/my-seller-alerts"),
    refetchInterval: 4000,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Audible alarm whenever a brand-new alert id arrives. Tracking the highest
  // id ensures the alarm fires once per arrival, not on every poll tick.
  const lastAlertIdRef = useRef<number>(0);
  useEffect(() => {
    if (!alerts || alerts.length === 0) return;
    const maxId = Math.max(...alerts.map((a) => a.id));
    if (lastAlertIdRef.current === 0) {
      lastAlertIdRef.current = maxId;
      return;
    }
    if (maxId > lastAlertIdRef.current) {
      playAlarm();
      lastAlertIdRef.current = maxId;
    }
  }, [alerts]);

  const confirmReceipt = async (id: number) => {
    await api(`/p2p/confirm/${id}`, { method: "POST" });
    await qc.invalidateQueries({ queryKey: ["my-buy"] });
    await qc.invalidateQueries({ queryKey: ["my-chunks"] });
    await qc.invalidateQueries({ queryKey: ["pending-confirms"] });
    await qc.invalidateQueries({ queryKey: ["me"] });
    await refetch();
  };

  const submitDispute = async (id: number) => {
    setDisputeSubmitting(true);
    try {
      await api(`/p2p/dispute/${id}`, {
        method: "POST",
        body: JSON.stringify({ reason: disputeReason || "Seller did not receive payment" }),
      });
      toast({ title: "Dispute opened", description: "Upload your supporting proof within 24 hours." });
      setShowDisputeForm(false);
      setDisputeReason("");
      await qc.invalidateQueries({ queryKey: ["my-chunks"] });
      await qc.invalidateQueries({ queryKey: ["pending-confirms"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
      await refetch();
    } catch (e: any) {
      toast({ title: "Failed to open dispute", description: e.message, variant: "destructive" });
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const openProof = (url?: string | null) => {
    if (!url) return;
    setProofViewer(url);
  };

  const current = alerts[0];
  if (!current) return null;

  const remaining = current.confirmDeadline
    ? Math.max(0, new Date(current.confirmDeadline).getTime() - now)
    : 0;
  const isLocked = current.status === "locked";

  return (
    <>
      <Dialog open={true}>
        <DialogContent
          className="max-w-[95vw] w-[440px] rounded-2xl p-0 overflow-hidden [&>button]:hidden"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {isLocked ? (
            <>
              <DialogHeader className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle className="text-left text-xl font-black">ORDER LOCKED</DialogTitle>
                    <p className="text-sm font-medium mt-1">A buyer has locked your order. Awaiting their payment proof.</p>
                  </div>
                  <Lock className="h-6 w-6 shrink-0 animate-pulse" />
                </div>
              </DialogHeader>
              <div className="p-4 space-y-4">
                <div className="rounded-2xl bg-muted/50 p-4">
                  <div className="text-sm text-muted-foreground">Amount</div>
                  <div className="text-3xl font-black">₹{Number(current.amount).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Buyer: {current.buyer?.username || `#${current.buyer?.id || "?"}`}
                  </div>
                  <div className="text-xs text-blue-700 mt-2 font-medium flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Lock expires in {fmtCountdown(remaining)}
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-dashed border-blue-400/40 bg-blue-50 p-3 text-sm text-blue-900">
                  Please stay on this screen. As soon as the buyer submits their payment proof, you will be able to confirm it here.
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader className="p-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle className="text-left text-xl font-black">PAYMENT INCOMING</DialogTitle>
                    <p className="text-sm font-medium mt-1">The buyer has shared payment proof. Please verify and confirm.</p>
                  </div>
                  <BellRing className="h-6 w-6 shrink-0 animate-pulse" />
                </div>
              </DialogHeader>
              <div className="p-4 space-y-4">
                <div className="rounded-2xl bg-muted/50 p-4">
                  <div className="text-sm text-muted-foreground">Amount</div>
                  <div className="text-3xl font-black">₹{Number(current.amount).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Buyer: {current.buyer?.username || `#${current.buyer?.id || current.id}`}
                  </div>
                  {current.utrNumber && (
                    <div className="text-xs mt-2">
                      UTR: <span className="font-mono font-semibold">{current.utrNumber}</span>
                    </div>
                  )}
                  <div className="text-xs text-orange-700 mt-2 font-medium">
                    Auto-confirms in {fmtCountdown(remaining)}
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4">
                  <button
                    type="button"
                    onClick={() => openProof(current.screenshotUrl)}
                    className="w-full text-left"
                  >
                    <div className="text-base font-black tracking-wide text-primary">VIEW PAYMENT PROOF</div>
                    <div className="text-sm text-muted-foreground mt-1">Tap to open the buyer's screenshot in full screen.</div>
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    className="h-12 bg-green-600 hover:bg-green-700"
                    onClick={() => setShowHistoryWarning(true)}
                  >
                    YES — Payment Received
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => setShowDisputeWarning(true)}
                  >
                    NOT received — Open Dispute
                  </Button>
                </div>
                <div className="text-[11px] text-center text-muted-foreground">
                  This popup will stay open until you confirm or dispute.
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Step 1 — Confirm-by-history warning before releasing funds */}
      <Dialog open={showHistoryWarning} onOpenChange={setShowHistoryWarning}>
        <DialogContent className="max-w-[92vw] w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" /> Please verify in your bank app first
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Open the UPI app linked to this order (PhonePe, Google Pay, or Paytm) and check the recent transaction history. Confirm that ₹{Number(current.amount).toFixed(2)} has actually credited to your account.
            </p>
            <p className="font-medium text-foreground">
              Only press Continue if the amount is visible in your bank statement. False confirmations cannot be reversed.
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowHistoryWarning(false)}
            >
              Go back
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => {
                setShowHistoryWarning(false);
                confirmReceipt(current.id);
              }}
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 1 — Dispute warning with penalty disclosure */}
      <Dialog open={showDisputeWarning} onOpenChange={setShowDisputeWarning}>
        <DialogContent className="max-w-[92vw] w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" /> Open dispute carefully
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Before you raise a dispute, open your UPI app (PhonePe, Google Pay, or Paytm) and re-check the recent history. Many payments take a minute or two to reflect in the bank statement.
            </p>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 space-y-1">
              <div className="font-semibold">If your dispute is found wrong:</div>
              <ul className="list-disc list-inside text-[13px] leading-snug">
                <li>−10 trust score per wrong dispute</li>
                <li>Account is automatically suspended once your trust score reaches −50</li>
                <li>You will need to upload bank statement, screen recording and last-transaction screenshot within 24 hours</li>
              </ul>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowDisputeWarning(false)}
            >
              Re-check history
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                setShowDisputeWarning(false);
                setShowDisputeForm(true);
              }}
            >
              Continue to dispute
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 2 — Inline dispute reason form */}
      <Dialog open={showDisputeForm} onOpenChange={(open) => { if (!open && !disputeSubmitting) setShowDisputeForm(false); }}>
        <DialogContent className="max-w-[92vw] w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" /> Open dispute for ₹{Number(current.amount).toFixed(2)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              className="w-full border rounded-2xl p-3 text-sm"
              rows={3}
              placeholder="Briefly describe why the payment was not received (optional)"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
            />
            <div className="text-xs text-red-700">
              ⚠ You will need to upload your bank statement, a full screen recording and the last transaction screenshot within 24 hours.
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={disputeSubmitting}
              onClick={() => setShowDisputeForm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={disputeSubmitting}
              onClick={() => submitDispute(current.id)}
            >
              {disputeSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Submit dispute
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!proofViewer} onOpenChange={(open) => !open && setProofViewer(null)}>
        <DialogContent className="max-w-[96vw] w-[96vw] p-0 overflow-hidden bg-black">
          <div className="p-3 flex items-center justify-between bg-black text-white">
            <div className="text-base font-bold">Payment proof</div>
            <Button variant="outline" className="text-black bg-white hover:bg-white/90" onClick={() => setProofViewer(null)}>Close</Button>
          </div>
          {proofViewer && (
            <img src={proofViewer} alt="Payment proof" className="w-full max-h-[80vh] object-contain bg-black" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
