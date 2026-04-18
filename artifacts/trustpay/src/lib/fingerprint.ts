const KEY = "trustpay_device_fp";

function rand() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getDeviceFingerprint(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const parts = [
      navigator.userAgent || "",
      navigator.language || "",
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      String(new Date().getTimezoneOffset()),
      String((navigator as any).hardwareConcurrency || 0),
      rand(),
    ];
    const fp = btoa(parts.join("|")).replace(/[^a-zA-Z0-9]/g, "").slice(0, 64);
    localStorage.setItem(KEY, fp);
    return fp;
  } catch {
    return rand();
  }
}
