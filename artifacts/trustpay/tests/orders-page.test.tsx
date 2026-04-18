import { describe, test, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@workspace/api-client-react", () => ({
  useGetOrders: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/components/layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const toastSpy = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastSpy }),
}));

import OrdersPage from "../src/pages/orders";

interface Captured { url: string; method?: string; body?: unknown }
function setupFetch(): Captured[] {
  const calls: Captured[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ url, method: init?.method, body });
    if (url.includes("/api/disputes/my")) {
      return {
        ok: true, status: 200,
        json: async () => [
          {
            id: 11,
            role: "buyer",
            status: "open",
            reason: "no payment received",
            createdAt: new Date().toISOString(),
            buyerProofAt: null,
            sellerProofAt: null,
            order: { id: 99, amount: "250" },
          },
        ],
      } as Response;
    }
    if (url.includes("/api/disputes/buyer-proof/")) {
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  }));
  return calls;
}

beforeEach(() => {
  toastSpy.mockReset();
  localStorage.setItem("authToken", "buyer-token");
});

describe("Orders page — buyer dispute proof upload", () => {
  test("loads disputes, opens the upload dialog, submits a file, and POSTs to buyer-proof", async () => {
    const calls = setupFetch();
    const user = userEvent.setup();

    render(<OrdersPage />);

    // Switch to Disputes tab
    await user.click(await screen.findByRole("tab", { name: /disputes/i }));

    // The dispute card appears with an Upload Proof button
    const uploadBtn = await screen.findByRole("button", { name: /upload proof/i });
    await user.click(uploadBtn);

    // Dialog opens with title "Upload Buyer Proof"
    expect(await screen.findByText(/upload buyer proof/i)).toBeTruthy();

    // Attach a small PNG file
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "bank.png",
      { type: "image/png" },
    );
    const fileInput = document.querySelector("input[type=file]") as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    // userEvent.upload is unreliable in happy-dom for file inputs; use fireEvent.change.
    fireEvent.change(fileInput, { target: { files: [file] } });

    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    // Wait for the POST to happen
    await waitFor(() => {
      expect(calls.some((c) => /\/api\/disputes\/buyer-proof\/11$/.test(c.url) && c.method === "POST")).toBe(true);
    });

    // The POST body carries the base64 data URL of the uploaded file
    const post = calls.find((c) => /\/api\/disputes\/buyer-proof\/11$/.test(c.url))!;
    const body = post.body as { bankStatementUrl: string };
    expect(body.bankStatementUrl.startsWith("data:image/png;base64,")).toBe(true);

    // Success toast was triggered
    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalled();
      const titles = toastSpy.mock.calls.map((c) => (c[0] as { title?: string }).title);
      expect(titles.some((t) => /proof uploaded successfully/i.test(t ?? ""))).toBe(true);
    });
  });
});
