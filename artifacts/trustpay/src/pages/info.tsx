import React from "react";
import Layout from "@/components/layout";
import { useGetAppSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ShieldAlert, AlertTriangle, IndianRupee } from "lucide-react";

export default function Info() {
  const { data: settings } = useGetAppSettings();
  const buy = (settings as any)?.buyRules;
  const sell = (settings as any)?.sellRules;

  return (
    <Layout>
      <div className="p-4 space-y-4 pb-24">
        <h1 className="text-xl font-bold">Info & Rules</h1>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="w-4 h-4 text-primary" />Buy Rules</CardTitle>
          </CardHeader>
          <CardContent>
            {buy ? (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{buy}</div>
            ) : (
              <p className="text-sm text-muted-foreground">No buy rules configured.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="w-4 h-4 text-secondary" />Sell Rules</CardTitle>
          </CardHeader>
          <CardContent>
            {sell ? (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{sell}</div>
            ) : (
              <p className="text-sm text-muted-foreground">No sell rules configured.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><IndianRupee className="w-4 h-4" />High-Value Trades</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>Trades over <span className="font-semibold text-amber-600">₹5,000</span> are flagged for review.</p>
            <p>Trades over <span className="font-semibold text-red-600">₹10,000</span> are critical and may be paused for verification.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="w-4 h-4 text-destructive" />Fraud Protection</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>Suspicious activity (fake UTRs, duplicate proofs, multi-account devices, lock spamming) is automatically detected and may freeze your account.</p>
            <p>Disputes have a 24-hour proof window. Failure to upload proof on time results in auto-resolution.</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
