export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export const BASE_ORIGIN =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/api$/, "") || "";

// Resolve an admin-uploaded media URL for use in <img src>, <audio src>,
// <a href>, navigator.share fetch(), etc.
//
// The API server stores these as RELATIVE paths (e.g. "/api/media/10",
// "/api/storage/objects/uploads/admin-img-<uuid>.png") so the same value
// works across hosts. But on Render the frontend (trustpay.onrender.com)
// and the API (trustpay-api.onrender.com) live on DIFFERENT origins, so
// a bare "/api/media/10" in an <img src> resolves to the frontend host
// and 404s. This helper prepends the API origin for any /api/* path
// when BASE_ORIGIN is configured (i.e. cross-origin deploys), and is a
// no-op for absolute URLs, data: URLs, and same-origin dev where
// BASE_ORIGIN is empty.
export function assetUrl(raw: string | null | undefined): string {
  if (!raw) return "";
  if (raw.startsWith("data:")) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/api/") && BASE_ORIGIN) return `${BASE_ORIGIN}${raw}`;
  return raw;
}
