import { describe, test, expect, vi, beforeEach } from "vitest";
import { resolveFraudAlert } from "../src/lib/admin-actions";

interface CapturedRequest {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
}

function mockFetch(status = 200, json: unknown = {}): { calls: CapturedRequest[] } {
  const calls: CapturedRequest[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => json,
    } as Response;
  }));
  return { calls };
}

beforeEach(() => {
  localStorage.setItem("authToken", "admin-token");
});

describe("resolveFraudAlert", () => {
  test("POSTs to the resolve endpoint with the admin auth token", async () => {
    const { calls } = mockFetch(200);

    await resolveFraudAlert(123);

    expect(calls).toHaveLength(1);
    const c = calls[0];
    expect(c.url).toMatch(/\/api\/admin\/fraud-alerts\/123\/resolve$/);
    expect(c.method).toBe("POST");
    expect(c.headers.Authorization).toBe("Bearer admin-token");
  });

  test("throws with the server-provided error message on non-2xx", async () => {
    mockFetch(403, { error: "forbidden" });
    await expect(resolveFraudAlert(5)).rejects.toThrow(/forbidden/);
  });
});
