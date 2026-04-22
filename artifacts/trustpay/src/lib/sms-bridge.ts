declare global {
  interface Window {
    TrustPayNative?: {
      requestSmsPermission?: () => void;
      isSmsPermissionGranted?: () => boolean;
      onSmsReceived?: (sms: string) => void;
    };
  }
}

type SmsListener = (sms: string) => void;

const listeners = new Set<SmsListener>();
let bridgeInstalled = false;

function installBridge() {
  if (bridgeInstalled || !window.TrustPayNative) return;
  bridgeInstalled = true;
  window.TrustPayNative.onSmsReceived = (sms: string) => {
    listeners.forEach((fn) => fn(sms));
  };
}

export function addSmsListener(fn: SmsListener): () => void {
  listeners.add(fn);
  installBridge();
  return () => listeners.delete(fn);
}

export function requestSmsPermission() {
  window.TrustPayNative?.requestSmsPermission?.();
}

export function isSmsPermissionGranted(): boolean {
  if (window.TrustPayNative?.isSmsPermissionGranted) {
    return window.TrustPayNative.isSmsPermissionGranted();
  }
  return localStorage.getItem("tp_sms_permission_granted") === "granted";
}

export function hasNativeBridge(): boolean {
  return typeof window !== "undefined" && !!window.TrustPayNative;
}
