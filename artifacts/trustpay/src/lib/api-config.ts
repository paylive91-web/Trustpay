export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export const BASE_ORIGIN =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/api$/, "") || "";
