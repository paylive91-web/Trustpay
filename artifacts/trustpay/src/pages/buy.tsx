import React, { useState } from "react";
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
import { Copy, IndianRupee } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Buy() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user } = useGetMe();
  const { data: tasks, isLoading } = useGetDepositTasks();
  const { data: settings } = useGetAppSettings();
  const createOrder = useCreateOrder();

  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [userName, setUserName] = useState("");

  const handleBuyClick = (task: any) => {
    setSelectedTask(task);
    setUserName(user?.username || "");
  };

  const handleConfirmPayment = () => {
    if (!userName) {
      toast({ title: "Please enter your Name", variant: "destructive" });
      return;
    }
    
    createOrder.mutate({
      data: {
        type: "deposit",
        amount: selectedTask.amount,
        depositTaskId: selectedTask.id,
        userName: userName,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Order created", description: "Wait for admin approval" });
        setSelectedTask(null);
        setLocation("/orders");
      },
      onError: (err) => {
        toast({ title: "Error", description: err.error || "Failed to create order", variant: "destructive" });
      }
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `Copied ${label} to clipboard` });
  };

  return (
    <Layout>
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold">Deposit / Buy</h1>
        <p className="text-sm text-muted-foreground mb-4">Complete a deposit task to earn rewards.</p>

        {isLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl mb-4" />)
        ) : tasks && tasks.length > 0 ? (
          tasks.map((task) => (
            <Card key={task.id} className="overflow-hidden">
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
                    <div className="text-xs text-muted-foreground">Total Quota</div>
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
            No deposit tasks available right now.
          </div>
        )}
      </div>

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-[380px] rounded-xl">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>
              Please pay the exact amount below to the specified UPI ID.
            </DialogDescription>
          </DialogHeader>

          {selectedTask && settings && (
            <div className="space-y-4 py-4">
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

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">UPI ID</label>
                  <div className="flex bg-muted p-3 rounded-lg items-center justify-between">
                    <span className="font-medium text-sm break-all mr-2">{settings.upiId}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(settings.upiId, "UPI ID")}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">UPI Name</label>
                  <div className="flex bg-muted p-3 rounded-lg items-center justify-between">
                    <span className="font-medium text-sm break-all mr-2">{settings.upiName}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(settings.upiName, "UPI Name")}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Your Name (Remitter)</label>
                  <Input 
                    placeholder="Enter the name on your bank account" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mt-2">
                <p className="text-xs text-yellow-800 text-center">
                  Reward: {selectedTask.rewardPercent}% (+₹{selectedTask.rewardAmount.toFixed(2)}) will be added upon approval.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTask(null)} className="w-full">
              Cancel
            </Button>
            <Button onClick={handleConfirmPayment} disabled={createOrder.isPending} className="w-full">
              {createOrder.isPending ? "Submitting..." : "I have Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
