import React, { useState, useEffect, useMemo, useRef } from "react";
import { useGetDepositTasks, useCreateOrder, useGetAppSettings, useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Copy, IndianRupee, Timer, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type BuyStep = "list" | "payment" | "utr" | "timer";

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
  const [selectedUpiIndex, setSelectedUpiIndex] = useState(0);
  const [utr, setUtr] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(600); // 10 min
  const [timerExpired, setTimerExpired] = useState(false);
  const [extendedTimer, setExtendedTimer] = useState(7200); // 2 hr
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Shuffled tasks with periodic re-shuffle for fake traffic effect
  const [shuffledTasks, setShuffledTasks] = useState<any[]>([]);

  useEffect(() => {
    if (tasks && tasks.length > 0) {
      setShuffledTasks(shuffleArray(tasks));
      const interval = setInterval(() => {
        setShuffledTasks((prev) => shuffleArray(prev));
      }, 4000 + Math.random() * 3000); // shuffle every 4-7 seconds
      return () => clearInterval(interval);
    }
  }, [tasks]);

  // Timer countdown
  useEffect(() => {
    if (step === "timer") {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setTimerExpired(true);
            clearInterval(timerRef.current!);
            // Start 2hr timer
            startExtendedTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step]);

  const startExtendedTimer = () => {
    timerRef.current = setInterval(() => {
      setExtendedTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
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

  // Determine UPI IDs to show
  const upiIds = useMemo(() => {
    const multi = (settings as any)?.multipleUpiIds;
    if (multi && Array.isArray(multi) && multi.length > 0) return multi;
    if (settings?.upiId) return [{ upiId: settings.upiId, upiName: settings.upiName }];
    return [];
  }, [settings]);

  const activeUpi = upiIds[selectedUpiIndex] || upiIds[0];

  const handleBuyClick = (task: any) => {
    setSelectedTask(task);
    setUserName(user?.username || "");
    setSelectedUpiIndex(Math.floor(Math.random() * Math.max(upiIds.length, 1)));
    setStep("payment");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `Copied ${label}` });
  };

  const handleProceedToUtr = () => {
    if (!userName) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    setUtr("");
    setStep("utr");
  };

  const handleSubmitUtr = () => {
    if (!utr || utr.trim().length < 6) {
      toast({ title: "Please enter a valid UTR number", variant: "destructive" });
      return;
    }
    createOrder.mutate({
      data: {
        type: "deposit",
        amount: selectedTask.amount,
        depositTaskId: selectedTask.id,
        userName: userName,
        notes: `UTR: ${utr.trim()}`,
      }
    }, {
      onSuccess: () => {
        setTimerSeconds(600);
        setTimerExpired(false);
        setExtendedTimer(7200);
        setStep("timer");
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.error || "Failed to submit", variant: "destructive" });
      }
    });
  };

  const handleDoneTimer = () => {
    setStep("list");
    setSelectedTask(null);
    setUtr("");
    if (timerRef.current) clearInterval(timerRef.current);
    setLocation("/orders");
  };

  const handleClose = () => {
    setStep("list");
    setSelectedTask(null);
    setUtr("");
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return (
    <Layout>
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold">Buy</h1>
        <p className="text-sm text-muted-foreground mb-4">Select a task to deposit and earn rewards.</p>

        {isLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl mb-4" />)
        ) : shuffledTasks.length > 0 ? (
          shuffledTasks.map((task) => (
            <Card key={task.id} className="overflow-hidden transition-all duration-700">
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center border-b pb-3">
                  <div className="flex items-center text-xl font-bold text-primary">
                    <IndianRupee className="w-5 h-5 mr-1" />
                    {task.amount.toFixed(2)}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-green-600">
                      Income: {task.rewardPercent}% (+₹{task.rewardAmount.toFixed(2)})
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <div>
                    <div className="text-xs text-muted-foreground">Total Return</div>
                    <div className="font-semibold text-foreground">₹ {task.totalAmount.toFixed(2)}</div>
                  </div>
                  <Button
                    onClick={() => handleBuyClick(task)}
                    className="px-8 rounded-full shadow-md"
                  >
                    Buy
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center p-8 text-muted-foreground">
            No tasks available right now.
          </div>
        )}
      </div>

      {/* Payment Details Dialog */}
      <Dialog open={step === "payment"} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-[380px] rounded-xl">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>Pay the exact amount to the UPI ID below.</DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 py-2">
              <div className="bg-primary/5 p-4 rounded-lg flex justify-between items-center border border-primary/20">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Amount to Pay</div>
                  <div className="text-2xl font-bold text-primary flex items-center">
                    <IndianRupee className="w-5 h-5 mr-1" />
                    {selectedTask.amount.toFixed(2)}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(selectedTask.amount.toString(), "Amount")}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>

              {/* UPI ID selector if multiple */}
              {upiIds.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {upiIds.map((u: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedUpiIndex(idx)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${selectedUpiIndex === idx ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                    >
                      UPI {idx + 1}
                    </button>
                  ))}
                </div>
              )}

              {activeUpi && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">UPI ID</label>
                    <div className="flex bg-muted p-3 rounded-lg items-center justify-between">
                      <span className="font-medium text-sm break-all mr-2">{activeUpi.upiId}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(activeUpi.upiId, "UPI ID")}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">UPI Name</label>
                    <div className="flex bg-muted p-3 rounded-lg items-center justify-between">
                      <span className="font-medium text-sm break-all mr-2">{activeUpi.upiName}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(activeUpi.upiName, "UPI Name")}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Your Name (as in bank)</Label>
                <Input
                  placeholder="Enter name on your bank account"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </div>

              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <p className="text-xs text-yellow-800 text-center">
                  Reward: {selectedTask.rewardPercent}% (+₹{selectedTask.rewardAmount.toFixed(2)}) added on approval.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} className="w-full">Cancel</Button>
            <Button onClick={handleProceedToUtr} className="w-full">I have Paid</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UTR Dialog */}
      <Dialog open={step === "utr"} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-[380px] rounded-xl">
          <DialogHeader>
            <DialogTitle>Enter UTR Number</DialogTitle>
            <DialogDescription>
              Enter the 12-digit UTR/Reference number from your payment confirmation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>UTR / Reference Number</Label>
              <Input
                placeholder="e.g. 123456789012"
                value={utr}
                onChange={(e) => setUtr(e.target.value.replace(/\D/g, "").slice(0, 20))}
              />
              <p className="text-xs text-muted-foreground">
                Find UTR in your bank app's transaction history or payment receipt.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("payment")} className="w-full">Back</Button>
            <Button onClick={handleSubmitUtr} disabled={createOrder.isPending} className="w-full">
              {createOrder.isPending ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Timer Dialog */}
      <Dialog open={step === "timer"} onOpenChange={() => {}}>
        <DialogContent className="max-w-[380px] rounded-xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" />
              Payment Verification
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {!timerExpired ? (
              <>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    Your UTR is being verified. Funds will be added to your account within:
                  </p>
                  <div className="text-5xl font-bold text-primary font-mono">
                    {formatTime(timerSeconds)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">minutes remaining</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-800">
                    UTR: <span className="font-bold">{utr}</span> submitted successfully.
                    Our team is verifying your payment.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                  <p className="font-semibold text-amber-700 mb-2">Verification taking longer than usual</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    Please contact customer care and send your payment proof. Your funds will be added within:
                  </p>
                  <div className="text-4xl font-bold text-amber-600 font-mono">
                    {formatTime(extendedTimer)}
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800 text-center">
                    Send your payment screenshot to our customer care on Telegram. Your payment will be verified and credited quickly.
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleDoneTimer} variant="outline" className="w-full">
              View Orders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
