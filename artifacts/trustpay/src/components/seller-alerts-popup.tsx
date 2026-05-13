import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Clock, AlertTriangle, Loader2, ShieldCheck, ShieldAlert, Search, Lock } from "lucide-react";
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
  // OCR fraud-check results — populated by the async OCR pipeline shortly
  // after the buyer submits payment proof. Used to render the verification
  // banner inside the popup so the seller can see flags BEFORE confirming.
  ocrStatus?: "pending" | "done" | "failed" | "unreadable" | null;
  ocrAmount?: string | null;
  ocrUtr?: string | null;
  ocrAmountMatch?: "match" | "mismatch" | "not_extracted" | null;
  ocrUtrMatch?: "match" | "mismatch" | "not_extracted" | null;
};

type VerificationState =
  | { kind: "pending" }
  | { kind: "clean" }
  | { kind: "partial"; notes: string[] }
  | { kind: "flagged"; issues: string[] };

function buildVerificationState(a: SellerAlert): VerificationState {
  const status = a.ocrStatus;
  if (!status || status === "pending") return { kind: "pending" };
  const issues: string[] = [];
  if (status === "failed" || status === "unreadable") {
    issues.push("System could not read the screenshot clearly. Verify manually in your bank app.");
  }
  if (a.ocrAmountMatch === "mismatch") {
    const shown = a.ocrAmount ? `₹${a.ocrAmount}` : "different amount";
    issues.push(`Amount mismatch: screenshot shows ${shown}, order is ₹${Number(a.amount).toFixed(2)}.`);
  }
  if (a.ocrUtrMatch === "mismatch") {
    const shown = a.ocrUtr ? a.ocrUtr : "different UTR";
    issues.push(`UTR mismatch: screenshot shows ${shown}, buyer submitted ${a.utrNumber || "—"}.`);
  }
  if (issues.length > 0) return { kind: "flagged", issues };

  // OCR ran successfully but couldn't extract one or both fields. This is
  // NOT a clean verification — show an amber "could not auto-verify" note
  // so the seller doesn't see a misleading green "verified" badge.
  const notes: string[] = [];
  if (a.ocrAmountMatch === "not_extracted") {
    notes.push("Could not auto-read the amount from the screenshot.");
  }
  if (a.ocrUtrMatch === "not_extracted") {
    notes.push("Could not auto-read the UTR from the screenshot.");
  }
  if (notes.length > 0) return { kind: "partial", notes };
  return { kind: "clean" };
}

import { API_BASE } from "@/lib/api-config";

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
  const token = getAuthToken();
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
    refetchInterval: (q) => {
      const data = q.state.data as SellerAlert[] | undefined;
      const hasPendingOcr = data?.some((a) => a.ocrStatus === "pending" || !a.ocrStatus);
      return hasPendingOcr ? 2000 : 4000;
    },
    enabled: !!token,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Audible alarm only for payment_pending_confirmation — locked/cancel alerts are silent.
  const lastAlertIdRef = useRef<number>(0);
  useEffect(() => {
    if (!alerts || alerts.length === 0) return;
    const confirmAlerts = alerts.filter((a) => a.status === "pending_confirmation");
    if (confirmAlerts.length === 0) return;
    const maxId = Math.max(...confirmAlerts.map((a) => a.id));
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

  const pendingConfirm = alerts.find((a) => a.status === "pending_confirmation") || null;
  const lockedAlert = !pendingConfirm ? (alerts.find((a) => a.status === "locked") || null) : null;
  const current = pendingConfirm;

  // Show "order locked" popup when seller's order is locked but no payment submitted yet
  if (lockedAlert && !current) {
    const lockedRemaining = lockedAlert.confirmDeadline
      ? Math.max(0, new Date(lockedAlert.confirmDeadline).getTime() - now)
      : 0;
    return (
      <div className="fixed bottom-20 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[440px] rounded-3xl overflow-hidden shadow-[0_12px_48px_rgba(99,102,241,0.35)] animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0 animate-pulse">
              <BellRing className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-widest text-indigo-200">Order Locked</div>
              <div className="text-[16px] font-extrabold text-white">₹{Number(lockedAlert.amount).toFixed(0)} — Payment Aane Wali Hai</div>
            </div>
          </div>
          <div className="bg-white px-5 py-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[13px] text-slate-600">Buyer: <span className="font-semibold text-slate-800">{lockedAlert.buyer?.username || `#${lockedAlert.buyer?.id}`}</span></div>
              {lockedRemaining > 0 && (
                <div className="text-[12px] text-indigo-600 font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Buyer ke paas {fmtCountdown(lockedRemaining)} bacha hai
                </div>
              )}
            </div>
            <div className="text-[11px] text-slate-400 text-right">Online rahein<br />payment ka wait karein</div>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const remaining = current.confirmDeadline
    ? Math.max(0, new Date(current.confirmDeadline).getTime() - now)
    : 0;

  const verification = buildVerificationState(current);
  const isFlagged = verification.kind === "flagged";

  return (
    <>
      <Dialog open={true}>
        <DialogContent
          className="max-w-[95vw] w-[440px] rounded-2xl p-0 overflow-hidden [&>button]:hidden"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
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
                {/* Verification banner — surfaces system OCR fraud-check
                    result inline so the seller cannot miss it. Notifications
                    in the bell tray were being ignored; this banner sits
                    directly above the amount block where the eye lands first. */}
                {verification.kind === "flagged" && (
                  <div
                    role="alert"
                    className="rounded-2xl border-2 border-red-400 bg-gradient-to-br from-red-50 to-rose-50 p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-red-100 p-2 shrink-0">
                        <ShieldAlert className="h-5 w-5 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black text-red-700 uppercase tracking-wide">
                          System flagged this payment
                        </div>
                        <p className="text-[12px] text-red-700/90 mt-0.5 font-medium">
                          Verify carefully in your bank app before confirming.
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {verification.issues.map((issue, i) => (
                            <li key={i} className="flex items-start gap-2 text-[13px] text-red-800 leading-snug">
                              <span className="text-red-500 font-bold mt-0.5">•</span>
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                {verification.kind === "pending" && (
                  <div role="status" aria-live="polite" className="rounded-2xl border border-sky-200 bg-sky-50 p-3 flex items-center gap-3">
                    <Loader2 className="h-4 w-4 text-sky-600 animate-spin shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-sky-800">
                        System verification in progress
                      </div>
                      <p className="text-[11px] text-sky-700/80 leading-snug">
                        Screenshot check chal raha hai. Aap abhi bhi YES dabaa sakte hain — payment bank mein check karein.
                      </p>
                    </div>
                  </div>
                )}
                {verification.kind === "partial" && (
                  <div role="status" aria-live="polite" className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-3 flex items-start gap-3">
                    <Search className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-amber-800">
                        Could not auto-verify
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {verification.notes.map((n, i) => (
                          <li key={i} className="text-[12px] text-amber-800/90 leading-snug">• {n}</li>
                        ))}
                      </ul>
                      <p className="text-[11px] text-amber-700 mt-1.5 font-medium">
                        Match the amount and UTR manually before confirming.
                      </p>
                    </div>
                  </div>
                )}
                {verification.kind === "clean" && (
                  <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-3">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-emerald-800">
                        System verified — amount and UTR match
                      </div>
                      <p className="text-[11px] text-emerald-700/80 leading-snug">
                        Still confirm the credit in your bank app before pressing YES.
                      </p>
                    </div>
                  </div>
                )}
                <div className={`rounded-2xl p-4 ${isFlagged ? "bg-red-50/40 border border-red-200" : "bg-muted/50"}`}>
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
                    className={`h-12 ${
                      isFlagged
                        ? "bg-amber-600 hover:bg-amber-700 ring-2 ring-red-300 ring-offset-2"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                    onClick={() => setShowHistoryWarning(true)}
                  >
                    {isFlagged ? "YES — Confirm anyway" : "YES — Payment Received"}
                  </Button>
                  <Button
                    variant={isFlagged ? "destructive" : "outline"}
                    className="h-11"
                    onClick={() => setShowDisputeWarning(true)}
                  >
                    NOT received — Open Dispute
                  </Button>
                  {isFlagged && (
                    <p className="text-[11px] text-center text-red-700 font-medium leading-snug">
                      Confirm only if the credit is visible in your bank statement. False confirmations cannot be reversed.
                    </p>
                  )}
                </div>
                <div className="text-[11px] text-center text-muted-foreground">
                  This popup will stay open until you confirm or dispute.
                </div>
              </div>
          </>
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
