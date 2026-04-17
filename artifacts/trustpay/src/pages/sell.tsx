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

const sellSchema = z.object({
  amount: z.coerce.number()
    .min(1, "Amount required")
    .refine((v) => v % 100 === 0, "Amount must be a multiple of 100"),
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
        toast({ title: "Sell request submitted successfully" });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/orders");
      },
      onError: (err) => {
        toast({ title: "Error", description: err.error || "Failed to submit sell request", variant: "destructive" });
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

  return (
    <Layout>
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold">Sell</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="create">Sell Funds</TabsTrigger>
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
                          <FormLabel>Amount to Sell (multiples of 100)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                              <Input
                                type="number"
                                step={100}
                                min={100}
                                placeholder="e.g. 500"
                                className="pl-8"
                                value={field.value || ""}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : "")}
                              />
                            </div>
                          </FormControl>
                          <p className="text-xs text-muted-foreground">Enter amount in multiples of 100 (e.g. 100, 200, 500)</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                      {createOrder.isPending ? "Submitting..." : "Submit Sell Request"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pay">
            <p className="text-sm text-muted-foreground mb-4">Pay other users' sell requests.</p>

            {ordersLoading ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl mb-4" />)
            ) : openOrders && openOrders.length > 0 ? (
              openOrders.map((order: any) => (
                <Card key={order.id} className="overflow-hidden mb-4">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center border-b pb-3">
                      <div className="flex items-center text-xl font-bold text-primary">
                        <IndianRupee className="w-5 h-5 mr-1" />
                        {order.amount.toFixed(2)}
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <div>
                        <div className="text-xs text-muted-foreground">You Pay</div>
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
                No open sell requests available right now.
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
              Pay ₹{selectedOrderToPay?.amount.toFixed(2)} to the user's UPI ID. Once confirmed, you receive the reward amount.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setSelectedOrderToPay(null)} className="w-full">Cancel</Button>
            <Button onClick={handlePayOrder} disabled={payOrder.isPending} className="w-full">
              {payOrder.isPending ? "Accepting..." : "Confirm Acceptance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
