import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useGetDepositTasks, useCreateOrder, useGetAppSettings, useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Copy, IndianRupee, Timer, AlertCircle, Upload, X, CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type BuyStep = "list" | "payment" | "submitted";

export default function Buy() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user } = useGetMe();
  const { data: tasks, isLoading } = useGetDepositTasks();
  const { data: settings } = useGetAppSettings();
  const createOrder = useCreateOrder();

  const [step, setStep] = useState<BuyStep>("list");
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [userName, setUserName] = useState("");
  const [selectedUpi, setSelectedUpi] = useState<any>(null);
  const [utr, setUtr] = useState("");
  const [screenshot, setScreenshot] = useState<string>("");
  const [screenshotName, setScreenshotName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Active deposit tracking
  const [activeDeposit, setActiveDeposit] = useState<any>(null);
  const [timerSeconds, setTimerSeconds] = useState(600);
  const [timerExpired, setTimerExpired] = useState(false);
  const [extendedTimer, setExtendedTimer] = useState(7200);
  const [showTimer, setShowTimer] = useState(false);
  const [orderApproved, setOrderApproved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [shuffledTasks, setShuffledTasks] = useState<any[]>([]);

  const token = localStorage.getItem("authToken");

  const fetchActiveDeposit = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/orders/active-deposit`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveDeposit(data);
        return data;
      }
    } catch {}
    return null;
  }, [token]);

  useEffect(() => {
    fetchActiveDeposit();
  }, [fetchActiveDeposit]);

  useEffect(() => {
    if (tasks && tasks.length > 0) {
      setShuffledTasks(shuffleArray(tasks));
      const interval = setInterval(() => {
        setShuffledTasks((prev) => shuffleArray(prev));
      }, 2000 + Math.random() * 1500);
      return () => clearInterval(interval);
    }
  }, [tasks]);

  // Start countdown timer when submitted
  useEffect(() => {
    if (showTimer && !timerExpired) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setTimerExpired(true);
            clearInterval(timerRef.current!);
            startExtendedTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [showTimer]);

  // Poll for approval
  useEffect(() => {
    if (showTimer && !orderApproved) {
      pollRef.current = setInterval(async () => {
        const data = await fetchActiveDeposit();
        if (data === null) {
          // Order was approved or cancelled - check orders
          clearInterval(pollRef.current!);
          setOrderApproved(true);
        }
      }, 30000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [showTimer, orderApproved, fetchActiveDeposit]);

  const startExtendedTimer = () => {
    timerRef.current = setInterval(() => {
      setExtendedTimer((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const upiIds = useMemo(() => {
    const multi = (settings as any)?.multipleUpiIds;
    if (multi && Array.isArray(multi) && multi.length > 0) return multi;
    if (settings?.upiId) return [{ upiId: settings.upiId, upiName: settings.upiName }];
    return [];
  }, [settings]);

  const handleBuyClick = (task: any) => {
    if (activeDeposit) {
      toast({ title: "You have a pending deposit", description: "Please wait for it to be approved before making a new deposit.", variant: "destructive" });
      return;
    }
    const randomUpi = upiIds[Math.floor(Math.random() * Math.max(upiIds.length, 1))];
    setSelectedTask(task);
    setSelectedUpi(randomUpi);
    setUserName(user?.username || "");
    setUtr("");
    setScreenshot("");
    setScreenshotName("");
    setStep("payment");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB allowed", variant: "destructive" });
      return;
    }
    setScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setScreenshot(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!userName.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    if (!utr.trim() || utr.trim().length < 6) {
      toast({ title: "Please enter a valid UTR number", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    createOrder.mutate({
      data: {
        type: "deposit",
        amount: selectedTask.amount,
        depositTaskId: selectedTask.id,
        userName: userName.trim(),
        utrNumber: utr.trim(),
        screenshotUrl: screenshot || undefined,
      } as any
    }, {
      onSuccess: (order) => {
        setActiveDeposit(order);
        setTimerSeconds(600);
        setTimerExpired(false);
        setExtendedTimer(7200);
        setOrderApproved(false);
        setShowTimer(true);
        setStep("submitted");
        setSubmitting(false);
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.error || "Failed to submit", variant: "destructive" });
        setSubmitting(false);
      }
    });
  };

  const handleDone = () => {
    setStep("list");
    setSelectedTask(null);
    setShowTimer(false);
    setOrderApproved(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    fetchActiveDeposit();
    setLocation("/orders");
  };

  const handleShowActiveTimer = () => {
    setShowTimer(true);
    setStep("submitted");
  };

  // Submitted / Timer screen
  if (step === "submitted") {
    return (
      <Layout>
        <div className="flex flex-col h-full p-4">
          {orderApproved ? (
            <div className="flex flex-col items-center justify-center flex-1 space-y-6 text-center py-12">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-green-700 mb-2">Payment Approved!</h2>
                <p className="text-muted-foreground">Your deposit has been verified and credited to your account.</p>
              </div>
              <Button onClick={handleDone} className="w-full max-w-xs rounded-xl" size="lg">View Orders</Button>
            </div>
          ) : !timerExpired ? (
            <div className="flex flex-col items-center justify-center flex-1 space-y-6 py-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <Timer className="w-10 h-10 text-primary" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold mb-2">Payment Under Review</h2>
                <p className="text-sm text-muted-foreground mb-4">Your payment is being verified. Funds will be credited within:</p>
                <div className="text-6xl font-bold text-primary font-mono">{formatTime(timerSeconds)}</div>
                <p className="text-xs text-muted-foreground mt-2">minutes remaining</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 w-full text-center">
                <p className="text-sm text-green-800 font-medium">UTR: {utr || activeDeposit?.utrNumber || "submitted"}</p>
                <p className="text-xs text-green-600 mt-1">Our team is verifying your payment</p>
              </div>
              <Button onClick={handleDone} variant="outline" className="w-full rounded-xl">View Orders</Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 space-y-6 py-8">
              <AlertCircle className="w-16 h-16 text-amber-500" />
              <div className="text-center">
                <h2 className="text-xl font-bold text-amber-700 mb-2">Verification Taking Longer</h2>
                <p className="text-sm text-muted-foreground mb-4">Please contact customer care with your payment screenshot. Funds will be added within:</p>
                <div className="text-5xl font-bold text-amber-600 font-mono">{formatTime(extendedTimer)}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 w-full text-center">
                <p className="text-sm text-amber-800">Send your payment screenshot to our support on Telegram.</p>
              </div>
              <Button onClick={handleDone} variant="outline" className="w-full rounded-xl">View Orders</Button>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // Payment screen - full screen overlay
  if (step === "payment" && selectedTask) {
    return (
      <Layout>
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 px-4 pt-4 pb-2 border-b">
            <button onClick={() => setStep("list")} className="p-2 hover:bg-muted rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-bold text-lg">Payment Details</h2>
              <p className="text-xs text-muted-foreground">Pay exact amount to complete your deposit</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-6">
            {/* Amount */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex justify-between items-center">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Amount to Pay</div>
                <div className="text-3xl font-bold text-primary flex items-center">
                  <IndianRupee className="w-6 h-6 mr-1" />
                  {selectedTask.amount.toFixed(2)}
                </div>
                <div className="text-xs text-green-600 mt-1">+{selectedTask.rewardPercent}% reward (₹{selectedTask.rewardAmount.toFixed(2)}) on approval</div>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => copyToClipboard(selectedTask.amount.toString(), "Amount")}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            {/* UPI Details */}
            {selectedUpi && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pay to UPI</div>
                  <div className="flex bg-muted rounded-lg items-center p-3 justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">UPI ID</div>
                      <div className="font-bold text-base break-all">{selectedUpi.upiId}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => copyToClipboard(selectedUpi.upiId, "UPI ID")}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex bg-muted rounded-lg items-center p-3 justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">Name</div>
                      <div className="font-medium">{selectedUpi.upiName}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => copyToClipboard(selectedUpi.upiName, "UPI Name")}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  {(selectedUpi as any).qrImageUrl && (
                    <div className="flex flex-col items-center p-3 bg-white rounded-lg border">
                      <div className="text-xs text-muted-foreground mb-2">Scan QR Code</div>
                      <img src={(selectedUpi as any).qrImageUrl} alt="QR Code" className="w-40 h-40 object-contain" />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Your Name */}
            <div className="space-y-2">
              <Label>Your Name (as shown in UPI app)</Label>
              <Input
                placeholder="Enter your bank account name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>

            {/* UTR Number */}
            <div className="space-y-2">
              <Label>UTR / Reference Number <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. 123456789012 (12 digits)"
                value={utr}
                onChange={(e) => setUtr(e.target.value.replace(/\D/g, "").slice(0, 20))}
              />
              <p className="text-xs text-muted-foreground">Find UTR in your UPI app's transaction history after payment.</p>
            </div>

            {/* Screenshot Upload */}
            <div className="space-y-2">
              <Label>Payment Screenshot (Optional)</Label>
              {screenshot ? (
                <div className="relative">
                  <img src={screenshot} alt="Screenshot" className="w-full rounded-lg max-h-48 object-cover border" />
                  <button
                    onClick={() => { setScreenshot(""); setScreenshotName(""); }}
                    className="absolute top-2 right-2 bg-black/50 rounded-full p-1 text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:bg-muted/30 transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Tap to upload screenshot</span>
                  <span className="text-xs text-muted-foreground mt-1">JPG, PNG up to 5MB</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleScreenshotChange} />
                </label>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-800">Pay ₹{selectedTask.amount.toFixed(2)} to the UPI above, then fill UTR and submit.</p>
            </div>
          </div>

          <div className="p-4 border-t bg-card">
            <Button
              className="w-full rounded-xl h-12 text-base font-semibold"
              onClick={handleSubmit}
              disabled={submitting || createOrder.isPending}
            >
              {submitting || createOrder.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
              ) : (
                "I have Paid — Submit"
              )}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // List view
  return (
    <Layout>
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold">Buy</h1>
        <p className="text-sm text-muted-foreground">Select a task to deposit and earn rewards.</p>

        {/* Active deposit banner */}
        {activeDeposit && (
          <div
            className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 cursor-pointer"
            onClick={handleShowActiveTimer}
          >
            <Timer className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-800 text-sm">Pending Deposit — ₹{parseFloat(activeDeposit.amount).toFixed(2)}</div>
              <div className="text-xs text-amber-600 mt-0.5">Tap to check verification status. No new deposit allowed until this is resolved.</div>
            </div>
          </div>
        )}

        {isLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl mb-4" />)
        ) : shuffledTasks.length > 0 ? (
          shuffledTasks.map((task) => (
            <Card key={task.id} className={`overflow-hidden transition-all duration-700 ${activeDeposit ? "opacity-60" : ""}`}>
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center border-b pb-3">
                  <div className="flex items-center text-xl font-bold text-primary">
                    <IndianRupee className="w-5 h-5 mr-1" />
                    {task.amount.toFixed(2)}
                  </div>
                  <div className="text-sm font-medium text-green-600">
                    Income: {task.rewardPercent}% (+₹{task.rewardAmount.toFixed(2)})
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs text-muted-foreground">Total Return</div>
                    <div className="font-semibold">₹ {task.totalAmount.toFixed(2)}</div>
                  </div>
                  <Button
                    onClick={() => handleBuyClick(task)}
                    className="px-8 rounded-full shadow-md"
                    disabled={!!activeDeposit}
                  >
                    Buy
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center p-8 text-muted-foreground">No tasks available right now.</div>
        )}
      </div>
    </Layout>
  );
}
