import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLogin, useGetMe } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { setAuthToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import logoPath from "@assets/file_00000000da60720ba5a8a74acd96c937_1776335785514.png";
import Layout from "@/components/layout";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: isUserLoading } = useGetMe({ query: { retry: false } });
  const loginMutation = useLogin();

  useEffect(() => {
    if (user && !isUserLoading) {
      setLocation("/");
    }
  }, [user, isUserLoading, setLocation]);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = (data: LoginValues) => {
    loginMutation.mutate({ data }, {
      onSuccess: (res) => {
        setAuthToken(res.token);
        toast({ title: "Login successful" });
        setLocation("/");
      },
      onError: (err) => {
        toast({ title: "Login failed", description: err.error || "Unknown error", variant: "destructive" });
      }
    });
  };

  return (
    <Layout showBottomNav={false}>
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <img src={logoPath} alt="TrustPay Logo" className="w-24 h-24 mb-8" />
        <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
        <p className="text-muted-foreground mb-8 text-center">Login to your TrustPay account to continue</p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Enter password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full mt-6" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Logging in..." : "Login"}
            </Button>
          </form>
        </Form>

        <div className="mt-8 text-sm">
          Don't have an account? <Link href="/register" className="text-primary font-medium">Register here</Link>
        </div>
      </div>
    </Layout>
  );
}
