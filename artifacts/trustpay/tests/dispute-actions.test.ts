import { describe, test, expect, vi, beforeEach } from "vitest";
import { submitBuyerProof, submitSellerProof, fileToDataUrl } from "../src/lib/dispute-actions";

function pngFile(name = "bank.png"): File {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], name, { type: "image/png" });
}

interface CapturedRequest {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  body: unknown;
}

function mockFetch(status = 200, json: unknown = {}): { fetch: ReturnType<typeof vi.fn>; calls: CapturedRequest[] } {
  const calls: CapturedRequest[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({
      url,
      method: init?.method,
      headers,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => json,
    } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetch: fetchMock, calls };
}

beforeEach(() => {
  localStorage.setItem("authToken", "test-token");
});

describe("fileToDataUrl", () => {
  test("encodes a file as a base64 data URL", async () => {
    const url = await fileToDataUrl(pngFile());
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(url.length).toBeGreaterThan("data:image/png;base64,".length);
  });
});

describe("submitBuyerProof", () => {
  test("POSTs the bank statement data URL to the buyer-proof endpoint with auth", async () => {
    const { calls } = mockFetch(200);

    await submitBuyerProof(42, pngFile());

    expect(calls).toHaveLength(1);
    const c = calls[0];
    expect(c.url).toMatch(/\/api\/disputes\/buyer-proof\/42$/);
    expect(c.method).toBe("POST");
    expect(c.headers.Authorization).toBe("Bearer test-token");
    expect(c.headers["Content-Type"]).toBe("application/json");
    const body = c.body as { bankStatementUrl: string };
    expect(body.bankStatementUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  test("throws with the server-provided error message on non-2xx", async () => {
    mockFetch(400, { error: "Invalid file type" });
    await expect(submitBuyerProof(99, pngFile())).rejects.toThrow(/Invalid file type/);
  });
});

describe("submitSellerProof", () => {
  test("POSTs all three data URLs to the seller-proof endpoint", async () => {
    const { calls } = mockFetch(200);

    await submitSellerProof(7, pngFile("bank.png"), pngFile("rec.png"), pngFile("last.png"));

    expect(calls).toHaveLength(1);
    const c = calls[0];
    expect(c.url).toMatch(/\/api\/disputes\/seller-proof\/7$/);
    const body = c.body as { bankStatementUrl: string; recordingUrl: string; lastTxnScreenshotUrl: string };
    expect(body.bankStatementUrl).toMatch(/^data:image\/png;base64,/);
    expect(body.recordingUrl).toMatch(/^data:image\/png;base64,/);
    expect(body.lastTxnScreenshotUrl).toMatch(/^data:image\/png;base64,/);
  });
});
