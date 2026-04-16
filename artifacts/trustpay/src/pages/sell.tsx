import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateOrder, useGetWithdrawalOrders, usePayWithdrawalOrder, useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { IndianRupee } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { getGetWithdrawalOrdersQueryKey, getGetMeQueryKey } from "@workspace/api-client-react";

const WITHDRAWAL_AMOUNTS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1500, 2000, 2500, 3000, 5000, 10000];

const sellSchema = z.object({
  amount: z.coerce.number().min(100, "Minimum withdrawal is 100"),
  userUpiId: z.string().min(5, "Valid UPI ID is required"),
  userUpiName: z.string().min(2, "Name is required"),
});

type SellValues = z.infer<typeof sellSchema>;

export default function Sell() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const { data: openOrders, isLoading: ordersLoading } = useGetWithdrawalOrders();
  const createOrder = useCreateOrder();
  const payOrder = usePayWithdrawalOrder();

  const [activeTab, setActiveTab] = useState("create");
  const [selectedOrderToPay, setSelectedOrderToPay] = useState<any>(null);

  const form = useForm<SellValues>({
    resolver: zodResolver(sellSchema),
    defaultValues: {
      amount: 100,
      userUpiId: "",
      userUpiName: "",
    },
  });

  const onSubmit = (data: SellValues) => {
    if (user && data.amount > user.balance) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    createOrder.mutate({
      data: {
        type: "withdrawal",
        ...data,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Withdrawal request submitted" });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/orders");
      },
      onError: (err) => {
        toast({ title: "Error", description: err.error || "Failed to request withdrawal", variant: "destructive" });
      }
    });
  };

  const handlePayOrder = () => {
    if (!selectedOrderToPay) return;
    
    payOrder.mutate({
      data: { orderId: selectedOrderToPay.id }
    }, {
      onSuccess: () => {
        toast({ title: "Order accepted", description: "Please complete payment" });
        setSelectedOrderToPay(null);
        queryClient.invalidateQueries({ queryKey: getGetWithdrawalOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Error", description: err.error || "Failed to accept order", variant: "destructive" });
      }
    });
  };

  const calculateReward = (amount: number) => {
    if (amount >= 100 && amount <= 1000) return { percent: 5, value: amount * 0.05 };
    if (amount >= 1001 && amount <= 2000) return { percent: 4, value: amount * 0.04 };
    if (amount >= 2001) return { percent: 3, value: amount * 0.03 };
    return { percent: 0, value: 0 };
  };

  const watchAmount = form.watch("amount");
  const reward = calculateReward(watchAmount || 0);

  return (
    <Layout>
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold">Withdraw / Sell</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="create">Withdraw Funds</TabsTrigger>
            <TabsTrigger value="pay">Fulfill Orders</TabsTrigger>
          </TabsList>
          
          <TabsContent value="create">
            <Card>
              <CardContent className="p-4 pt-6">
                <div className="bg-primary/5 rounded-lg p-4 mb-6 flex justify-between items-center">
                  <span className="text-sm font-medium">Available Balance</span>
                  <span className="text-lg font-bold text-primary">₹ {user?.balance?.toFixed(2) || "0.00"}</span>
                </div>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount</FormLabel>
                          <Select 
                            onValueChange={(val) => field.onChange(Number(val))} 
                            defaultValue={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select amount" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {WITHDRAWAL_AMOUNTS.map(amt => (
                                <SelectItem key={amt} value={amt.toString()}>
                                  ₹ {amt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="bg-muted p-3 rounded-lg mt-2 text-sm flex justify-between items-center">
                      <span className="text-muted-foreground">Bonus Reward ({reward.percent}%):</span>
                      <span className="font-semibold text-green-600">+ ₹{reward.value.toFixed(2)}</span>
                    </div>

                    <FormField
                      control={form.control}
                      name="userUpiId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your UPI ID</FormLabel>
                          <FormControl>
                            <Input placeholder="example@upi" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="userUpiName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name on Bank Account</FormLabel>
                          <FormControl>
                            <Input placeholder="Your full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full mt-6 h-12 text-lg rounded-xl" disabled={createOrder.isPending}>
                      {createOrder.isPending ? "Submitting..." : "Submit Withdrawal"}
                    </Button>
                  </form>
                </Form>

                <div className="mt-8 text-xs text-muted-foreground space-y-2">
                  <p className="font-semibold">Bonus Tiers:</p>
                  <p>• 100 - 1,000 INR = +5% Bonus</p>
                  <p>• 1,001 - 2,000 INR = +4% Bonus</p>
                  <p>• 2,001 - 50,000 INR = +3% Bonus</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="pay">
            <p className="text-sm text-muted-foreground mb-4">Pay other users' withdrawal requests to earn rewards.</p>
            
            {ordersLoading ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl mb-4" />)
            ) : openOrders && openOrders.length > 0 ? (
              openOrders.map((order) => (
                <Card key={order.id} className="overflow-hidden mb-4">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center border-b pb-3">
                      <div className="flex items-center text-xl font-bold text-primary">
                        <IndianRupee className="w-5 h-5 mr-1" />
                        {order.amount.toFixed(2)}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-600">
                          Earn: {order.rewardPercent}% (+₹{order.rewardAmount.toFixed(2)})
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-1">
                      <div>
                        <div className="text-xs text-muted-foreground">Total Payout</div>
                        <div className="font-semibold text-foreground">₹ {order.totalAmount.toFixed(2)}</div>
                      </div>
                      <Button 
                        onClick={() => setSelectedOrderToPay(order)}
                        className="px-6 rounded-full shadow-md"
                        variant="secondary"
                      >
                        Accept & Pay
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center p-8 text-muted-foreground bg-card rounded-xl border border-dashed">
                No open withdrawal requests available right now. Check back later.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedOrderToPay} onOpenChange={(open) => !open && setSelectedOrderToPay(null)}>
        <DialogContent className="max-w-[380px] rounded-xl">
          <DialogHeader>
            <DialogTitle>Accept Order</DialogTitle>
            <DialogDescription>
              You will need to pay ₹{selectedOrderToPay?.amount.toFixed(2)} to the user's UPI ID. Once they confirm, you will receive ₹{selectedOrderToPay?.totalAmount.toFixed(2)}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setSelectedOrderToPay(null)} className="w-full">
              Cancel
            </Button>
            <Button onClick={handlePayOrder} disabled={payOrder.isPending} className="w-full">
              {payOrder.isPending ? "Accepting..." : "Confirm Acceptance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
