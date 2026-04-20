/**
 * Tiny wrapper around Google Identity Services (GIS).
 *
 * We avoid the official `@react-oauth/google` package — pulling it in just to
 * render one button isn't worth the bundle weight. Instead, we lazy-load the
 * GIS script on first use and expose two helpers:
 *   - `getGoogleIdToken(clientId)`: prompts the user with the One Tap / popup
 *     account chooser and resolves with a verified ID-token JWT.
 *   - `isGoogleAvailable()`: cheap check for callers to gate UI on script load
 *     (used after a successful prompt).
 *
 * The returned ID token is sent to the backend, which calls
 * `verifyIdToken({ audience: GOOGLE_CLIENT_ID })` with `google-auth-library`.
 * That round-trip — not anything in this file — is what proves the user
 * actually owns the Google account; never trust the token client-side.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (cb?: (notification: any) => void) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          disableAutoSelect: () => void;
          cancel: () => void;
        };
      };
    };
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google script failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google script failed to load"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function isGoogleAvailable(): boolean {
  return typeof window !== "undefined" && !!window.google?.accounts?.id;
}

/**
 * Triggers the GIS account chooser and resolves with the ID token string.
 * Rejects on user cancel, browser block (3rd-party cookies, etc), or timeout.
 *
 * Implementation note: GIS doesn't expose a Promise API; we wire the
 * `callback` option to resolve and use `prompt(notification)` to surface
 * "user dismissed" / "browser blocked" cases as rejections. We also render
 * an offscreen button as a fallback — calling `.click()` on it is the most
 * reliable way to open the popup when One Tap isn't shown (e.g. user already
 * dismissed it once today).
 */
export async function getGoogleIdToken(clientId: string): Promise<string> {
  if (!clientId) throw new Error("Google verification not configured");
  await loadScript();
  if (!window.google?.accounts?.id) throw new Error("Google script not ready");

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    window.google!.accounts.id.initialize({
      client_id: clientId,
      callback: (resp: any) => {
        if (resp?.credential) finish(() => resolve(resp.credential));
        else finish(() => reject(new Error("Google verification cancelled")));
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      ux_mode: "popup",
    });

    // Render an invisible button and click it — this is more reliable than
    // `prompt()` alone because GIS will silently no-op `prompt()` after a
    // recent dismissal but the button-flow always opens the popup.
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-10000px";
    host.style.top = "-10000px";
    document.body.appendChild(host);
    try {
      window.google!.accounts.id.renderButton(host, { type: "standard", theme: "outline", size: "large" });
      const btn = host.querySelector("div[role=button]") as HTMLElement | null;
      if (btn) {
        btn.click();
      } else {
        // Fallback to One Tap prompt.
        window.google!.accounts.id.prompt((notification: any) => {
          if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
            finish(() => reject(new Error("Google sign-in popup was blocked. Please allow popups for this site.")));
          }
        });
      }
    } catch (err: any) {
      finish(() => reject(new Error(err?.message || "Failed to open Google sign-in")));
    }

    // Safety timeout — never hang forever.
    setTimeout(() => {
      finish(() => reject(new Error("Google verification timed out")));
      try { host.remove(); } catch {}
    }, 120_000);
  });
}
