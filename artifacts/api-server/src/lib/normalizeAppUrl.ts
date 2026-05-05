// Strip the host/origin from absolute URLs that we know point back to *this*
// app. Older uploads stored an absolute URL using whatever host the admin
// happened to be on at upload time (e.g. an expired Replit dev domain),
// which 404s the moment the app is opened from a different origin (preview
// vs deployed vs another session). Reducing the URL to a relative path
// makes the browser resolve it against the current page origin so the
// asset loads on every host.
//
// Safety: we deliberately match only URL paths that THIS app actually
// generates from its upload endpoints, so a third-party CDN URL whose path
// happens to contain "/api/media/" or similar is never silently rewritten
// to point at our server. Patterns map 1:1 to the URL formats produced by
// admin POST /upload-image and the static /storage/public-objects route:
//   - /api/storage/objects/uploads/admin-img-<uuid>.<ext>
//   - /api/storage/public-objects/<file-path>
//   - /api/media/<positive-integer>      (media_blobs.id is SERIAL)
const APP_OWNED_PATH_PATTERNS: RegExp[] = [
  /^\/api\/storage\/objects\/uploads\/admin-img-[0-9a-f-]+\.[a-z0-9]+$/i,
  /^\/api\/storage\/public-objects\/[^?#]+$/i,
  /^\/api\/media\/[1-9][0-9]*$/,
];

export function normalizeAppUrl(raw: string): string {
  if (!raw) return "";
  if (raw.startsWith("data:")) return raw;
  // Match http(s)://host[:port] prefix and capture the path that follows.
  const m = raw.match(/^https?:\/\/[^/]+(\/.*)?$/);
  if (!m) return raw;
  const path = m[1] || "/";
  // Only rewrite when the path matches a URL format that our own endpoints
  // produce. Anything else (external CDN, third-party image host, manually
  // entered link) passes through untouched.
  if (APP_OWNED_PATH_PATTERNS.some((re) => re.test(path))) {
    return path;
  }
  return raw;
}

export function normalizeAppUrlList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((u) => (typeof u === "string" ? normalizeAppUrl(u) : ""))
    .filter(Boolean);
}
