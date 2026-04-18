import { getAuthToken } from "./auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export interface BuyerProofPayload {
  bankStatementUrl: string;
}

export interface SellerProofPayload {
  bankStatementUrl: string;
  recordingUrl: string;
  lastTxnScreenshotUrl: string;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function postJson(path: string, body: unknown) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAuthToken()}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = "Upload failed";
    try { msg = (await r.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
  return r;
}

export async function submitBuyerProof(disputeId: number | string, file: File) {
  const dataUrl = await fileToDataUrl(file);
  const payload: BuyerProofPayload = { bankStatementUrl: dataUrl };
  await postJson(`/disputes/buyer-proof/${disputeId}`, payload);
}

export async function submitSellerProof(
  disputeId: number | string,
  bank: File,
  recording: File,
  lastTxn: File,
) {
  const [b, rec, lt] = await Promise.all([
    fileToDataUrl(bank),
    fileToDataUrl(recording),
    fileToDataUrl(lastTxn),
  ]);
  const payload: SellerProofPayload = { bankStatementUrl: b, recordingUrl: rec, lastTxnScreenshotUrl: lt };
  await postJson(`/disputes/seller-proof/${disputeId}`, payload);
}
