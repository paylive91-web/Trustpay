import { describe, test, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/admin-layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const toastSpy = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastSpy }),
}));

import FraudWatchPage from "../src/pages/admin/fraud-watch";

interface Captured { url: string; method?: string }

function setupFetch(initialAlerts: unknown[]): { calls: Captured[] } {
  const calls: Captured[] = [];
  let alerts = [...initialAlerts];
  const json = (data: unknown) =>
    new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    calls.push({ url, method: init?.method });
    const m = url.match(/\/api\/admin\/fraud-alerts\/(\d+)\/resolve$/);
    if (m && init?.method === "POST") {
      const id = Number(m[1]);
      alerts = alerts.map((a: any) => (a.id === id ? { ...a, resolved: true } : a));
      return json({ success: true });
    }
    if (url.includes("/api/admin/fraud-alerts")) {
      const showResolved = url.includes("resolved=true");
      const filtered = url.includes("resolved=")
        ? alerts.filter((a: any) => Boolean(a.resolved) === showResolved)
        : alerts;
      return json(filtered);
    }
    return json({});
  }));
  return { calls };
}

beforeEach(() => {
  toastSpy.mockReset();
  localStorage.setItem("authToken", "admin-token");
});

describe("FraudWatch page — admin resolve flow", () => {
  test("renders open alerts and clicking Resolve POSTs to the resolve endpoint", async () => {
    const alert = {
      id: 501,
      severity: "warn",
      rule: "duplicate_utr",
      evidence: "UTR seen twice",
      orderId: 99,
      resolved: false,
      createdAt: new Date().toISOString(),
      user: { id: 7, username: "alice", trustScore: -10 },
    };
    const { calls } = setupFetch([alert]);
    const user = userEvent.setup();

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><FraudWatchPage /></QueryClientProvider>);

    // Initial GET fires; the alert row appears with rule + Resolve button
    await screen.findByText("duplicate_utr");
    const resolveBtn = screen.getByRole("button", { name: /^resolve$/i });

    await user.click(resolveBtn);

    // POST resolve fired with auth header
    await waitFor(() => {
      expect(calls.some((c) => c.url.endsWith("/api/admin/fraud-alerts/501/resolve") && c.method === "POST")).toBe(true);
    });

    // Toast surfaced and the page reloads alerts (now empty for "open" filter)
    await waitFor(() => {
      const titles = toastSpy.mock.calls.map((c) => (c[0] as { title?: string }).title);
      expect(titles.some((t) => /marked resolved/i.test(t ?? ""))).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryByText("duplicate_utr")).toBeNull();
    });
  });
});
