import { getAuthToken } from "./auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export async function resolveFraudAlert(alertId: number | string): Promise<void> {
  const r = await fetch(`${API_BASE}/admin/fraud-alerts/${alertId}/resolve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAuthToken() ?? ""}` },
  });
  if (!r.ok) {
    let msg = "Failed to resolve";
    try { msg = (await r.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
}
