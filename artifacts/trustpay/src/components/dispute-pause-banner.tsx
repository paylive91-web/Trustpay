import React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertOctagon } from "lucide-react";
import { Link } from "wouter";
import { getAuthToken } from "@/lib/auth";

import { API_BASE } from "@/lib/api-config";

export default function DisputePauseBanner() {
  const { data } = useQuery<any[]>({
    queryKey: ["my-disputes-banner"],
    queryFn: async () => {
      if (!getAuthToken()) return [];
      const r = await fetch(`${API_BASE}/disputes/my`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!r.ok) return [];
      return await r.json();
    },
    refetchInterval: 30000,
  });
  const open = (data || []).filter((d) => d.status === "open");
  if (!open.length) return null;
  return (
    <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 flex items-start gap-2 text-sm">
      <AlertOctagon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="font-semibold">Account paused — {open.length} open dispute{open.length > 1 ? "s" : ""}</div>
        <div className="text-xs">
          Auto-sell is paused, but you can still place new orders.{" "}
          <Link href="/orders" className="underline font-medium">Resolve now</Link>
        </div>
      </div>
    </div>
  );
}
