declare global {
  interface Window {
    TrustPayNative?: {
      requestSmsPermission?: () => void;
      isSmsPermissionGranted?: () => boolean;
      onSmsReceived?: (sms: string) => void;
    };
  }
}

export interface SmsMessage {
  sms: string;
  sender: string;
}

type SmsListener = (msg: SmsMessage) => void;

const ALLOWED_SENDERS = new Set([
  "HDFCBK", "HDFC", "HDFCBN", "SBIINB", "SBIPSG", "SBISMS",
  "ICICIB", "ICICI", "AXISBK", "AXISNB", "KOTAKB", "KOTAKN",
  "PNBSMS", "PNBMOB", "BOIBNK", "IDBIBN", "YESBNK", "FEDBKL",
  "CANBNK", "UNIONB", "INDBNK", "CENTBK", "OBCBNK", "SNDBNK",
  "INDBLL", "RBLBNK", "IOBSMS", "ALLBNK", "VIJBNK", "DENABNK",
  "PHONEPE", "GPAYOK", "GPAY", "PAYTM", "PAYTMB", "AMZPAY",
  "NPCIUP", "UPIBNK", "BHIMUPI",
]);

const listeners = new Set<SmsListener>();
let bridgeInstalled = false;

function installBridge() {
  if (bridgeInstalled || !window.TrustPayNative) return;
  bridgeInstalled = true;
  window.TrustPayNative.onSmsReceived = (sms: string, sender: string = "") => {
    const msg: SmsMessage = { sms, sender: sender.toUpperCase().trim() };
    listeners.forEach((fn) => fn(msg));
  };
}

export function addSmsListener(fn: SmsListener): () => void {
  listeners.add(fn);
  installBridge();
  return () => listeners.delete(fn);
}

export function isTrustedSender(sender: string): boolean {
  if (!sender) return false;
  const s = sender.toUpperCase().trim();
  return ALLOWED_SENDERS.has(s);
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
