import React from "react";
import Layout from "@/components/layout";
import { useGetAppSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ShieldAlert, AlertTriangle } from "lucide-react";

export default function Info() {
  const { data: settings } = useGetAppSettings();
  const buy = settings?.buyRules;
  const sell = settings?.sellRules;
  const buyImg = settings?.buyRulesImageUrl;
  const sellImg = settings?.sellRulesImageUrl;

  return (
    <Layout>
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold">Info & Rules</h1>

        <Card id="buy">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="w-4 h-4 text-primary" />Buy Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {buyImg && (
              <img
                src={buyImg}
                alt="Buy Rules"
                className="w-full rounded-xl object-contain max-h-80"
              />
            )}
            {buy ? (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{buy}</div>
            ) : !buyImg ? (
              <p className="text-sm text-muted-foreground">No buy rules configured.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card id="sell">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="w-4 h-4 text-secondary" />Sell Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sellImg && (
              <img
                src={sellImg}
                alt="Sell Rules"
                className="w-full rounded-xl object-contain max-h-80"
              />
            )}
            {sell ? (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{sell}</div>
            ) : !sellImg ? (
              <p className="text-sm text-muted-foreground">No sell rules configured.</p>
            ) : null}
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
