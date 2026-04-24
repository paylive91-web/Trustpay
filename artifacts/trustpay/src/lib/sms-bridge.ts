declare global {
  interface Window {
    TrustPayNative?: {
      requestSmsPermission?: () => void;
      isSmsPermissionGranted?: () => boolean;
      onSmsReceived?: (sms: string, sender?: string) => void;
      readSmsSince?: (sinceMs: number, limit: number) => string;
      readSMS?: (limit: number) => string;
    };
  }
}

export interface SmsMessage {
  sms: string;
  sender: string;
}

type SmsListener = (msg: SmsMessage) => void;

/**
 * Trusted SMS sender IDs for Indian banks, UPI apps, and wallets.
 * 
 * Real Indian SMS senders use DLT (Distributed Ledger Technology) headers in the format:
 *   <2-letter operator/region prefix>-<6-char header>[-<1-char category: S/P/T/G>]
 * 
 * Examples seen in the wild:
 *   "VK-HDFCBK", "JD-HDFCBK-S", "AX-HDFCBK", "BP-SBIINB", "BH-PAYTM-S",
 *   "AD-PHONEPE", "JM-GPAYIN-S", "TM-AMZNPY"
 * 
 * isTrustedSender() splits sender on common separators and matches each
 * segment against this list — so prefixes/suffixes don't break detection.
 */
const ALLOWED_SENDERS = new Set<string>([
  // ===== UPI APPS / WALLETS (notify before bank SMS) =====
  // PhonePe
  "PHONEPE", "PHONPE", "PHPEPL", "PHPEUP", "PHPE",
  // Google Pay
  "GPAY", "GPAYIN", "GOOGLEPAY", "GOOGPY", "GPAYTM",
  // Paytm
  "PAYTM", "PAYTMB", "PYTM", "PAYTMS", "PYTMUP",
  // Amazon Pay
  "AMZNPY", "AMZPAY", "AMAZONPAY", "AMAZPY", "AMZUPI",
  // BHIM / NPCI
  "BHIM", "BHIMUPI", "BHIMPL", "NPCIBHIM", "NPCI", "NPCIUP", "NPCIPN",
  // WhatsApp Pay
  "WHTSPP", "WAPAY", "WHATSAPP", "WAPAYM",
  // MobiKwik
  "MOBKWK", "MOBIKWIK", "MBKWIK", "MBKWK", "MOBWIK",
  // CRED
  "CRED", "CREDPAY", "CREDIT", "CREDPY", "CREDCL",
  // Slice
  "SLICE", "SLICEP", "SLCEPY",
  // Jupiter
  "JUPITER", "JPITER", "JPTRMY", "JUPMNY",
  // Fi Money
  "FIMONY", "FIMONEY", "FIBANK", "FIPAY", "FIMNYC",
  // Niyo
  "NIYO", "NIYOIN", "NIYOPY", "NIYOSL",
  // Freo / MoneyTap
  "FREO", "FREOPY", "MNTPAY", "MNYTAP",
  // FamPay
  "FAMPAY", "FAMPYS", "FAMAPP",
  // LazyPay
  "LAZPAY", "LAZYPAY", "LAZYPY",
  // Simpl
  "SIMPL", "SIMPLB", "SIMPLE", "SMPLPY",
  // Ola Money
  "OLAMNY", "OLAMONEY", "OLAFIN", "OLAMON",
  // Airtel Payments Bank
  "AIRTEL", "AIRPYB", "APBANK", "AIRTPB", "AIRBNK", "AIRMNY",
  // JioMoney / Jio Payments Bank
  "JIOMNY", "JIOPAY", "JIOFIN", "JIOPB", "JIOBNK",
  // FreeCharge
  "FRCRGE", "FREECG", "FREECHRG", "FRCRG",
  // PayZapp
  "PAYZAP", "PAYZPP", "PYZAPP",
  // RuPay infra
  "RUPAY", "RPAYIN",
  // UPI generic
  "UPI", "UPIBNK", "UPIPN", "UPIPAY",

  // ===== PUBLIC SECTOR BANKS (12 main) =====
  // SBI
  "SBI", "SBIINB", "SBIPSG", "SBISMS", "SBIBNK", "SBIUPI", "SBIBKN", "SBIATM",
  // PNB (Punjab National Bank)
  "PNB", "PNBSMS", "PNBMOB", "PNBBNK", "PNBSBI",
  // Bank of Baroda
  "BOB", "BARODA", "BARODB", "BOBANK", "BOBSMS", "BOBIBN",
  // Canara Bank
  "CANBNK", "CANARA", "CANBKK", "CANBNK",
  // Union Bank of India
  "UNION", "UNIONB", "UBOFI", "UBIBKN", "UBINET",
  // Bank of India
  "BOI", "BOIBNK", "BOIIND", "BOIINB",
  // Indian Bank
  "INDB", "INDBNK", "INDIANB", "INDBLL",
  // Central Bank of India
  "CENTBK", "CBOI", "CBOIIN", "CBINET",
  // Indian Overseas Bank
  "IOB", "IOBSMS", "IOBANK", "IOBKNT",
  // UCO Bank
  "UCO", "UCOBNK", "UCOBKN",
  // Bank of Maharashtra
  "BOMBNK", "BOMHRA", "MAHBNK", "BOMSMS",
  // Punjab & Sind Bank
  "PSB", "PSBANK", "PSBSND", "PSBSMS",

  // ===== PRIVATE BANKS (15 major) =====
  // HDFC
  "HDFC", "HDFCBK", "HDFCBN", "HDFCNT", "HDFCBNK",
  // ICICI
  "ICICI", "ICICIB", "ICICIBK", "ICICIN", "ICCIBN",
  // Axis
  "AXIS", "AXISBK", "AXISBN", "AXISNB", "AXISMS",
  // Kotak Mahindra
  "KOTAK", "KOTAKB", "KOTAKM", "KOTAKN", "KMBANK",
  // IndusInd
  "INDUS", "INDUSB", "INDSND", "INDSBN", "IBLBNK",
  // Yes Bank
  "YES", "YESBNK", "YESBK", "YESBKN",
  // IDFC First
  "IDFC", "IDFCB", "IDFCFB", "IDFCFRST", "IDFFRST",
  // Federal Bank
  "FED", "FEDBNK", "FEDRAL", "FEDBKL",
  // RBL Bank
  "RBL", "RBLBNK", "RBLCRD", "RBLBKN",
  // Bandhan
  "BNDHN", "BANDHN", "BNDHBK", "BANDHAN",
  // South Indian Bank
  "SIB", "SOUTHB", "SIBANK", "SIBL",
  // Karur Vysya Bank
  "KVB", "KARVYB", "KARURVB", "KARVYS",
  // City Union Bank
  "CITY", "CTYUNI", "CUBSMS", "CITYUN",
  // DCB Bank
  "DCB", "DCBANK", "DCBBNK",
  // Tamilnad Mercantile
  "TMB", "TMBLTD", "TMBANK",

  // ===== OLD PRIVATE / REGIONAL BANKS (8) =====
  // J&K Bank
  "JKBANK", "JKBNK", "JKBK",
  // Karnataka Bank
  "KBL", "KARBNK", "KARNTK",
  // Nainital Bank
  "NTNL", "NAINIB", "NTLBNK",
  // Dhanlaxmi Bank
  "DHAN", "DHANBK", "DHNBNK", "DLBNET",
  // Catholic Syrian Bank / CSB
  "CSB", "CTHSYR", "CSBANK", "CSBNET",
  // Lakshmi Vilas Bank (now DBS)
  "LVB", "LVBANK",
  // IDBI
  "IDBI", "IDBIBN", "IDBIBK", "IDBINET",
  // Saraswat Cooperative
  "SARSWT", "SARASW", "SARASWAT",

  // ===== SMALL FINANCE BANKS (10) =====
  "AUSFB", "AUBNK", "AUFBNK", "AUSMAL",
  "EQUITS", "EQTSFB", "EQUSFB", "EQTBNK",
  "UJVSFB", "UJJVAN", "UJJSFB", "UJVBNK",
  "ESAFSFB", "ESAFBN", "ESAFBK", "ESAFSF",
  "SURYDY", "SRYDFB", "SURFB", "SURYBK",
  "JANASF", "JANSFB", "JANBNK",
  "CAPSFB", "CPTSFB", "CAPBNK",
  "FINCRE", "FINCAR", "FNCRSFB", "FINBNK",
  "SHIVLK", "SHVLK", "SHIVBK",
  "UNITY", "UNTYFB", "UNTYBK",

  // ===== FOREIGN BANKS IN INDIA (5) =====
  "HSBC", "HSBCBK", "HSBCBN", "HSBCIN",
  "CITI", "CITIBK", "CITIBN", "CITINT",
  "SCBANK", "STDCH", "STDCHB", "SCB", "SCBNET",
  "DBS", "DBSBK", "DBSBNK", "DBSIN",
  "DEUTSC", "DBANK", "DEUTBK",

  // ===== COOPERATIVE / OTHER (extra) =====
  "COSMOS", "CSMOSB",
  "ABHYUD", "ABHBNK",
  "NKGSB",
  "TJSB",
  "ANDHRA", "ANDBNK",
  "VIJAYA", "VIJBNK",
  "DENA", "DENABNK",
  "ALLAHABAD", "ALLBNK",
  "SYNDIC", "SNDBNK",
  "ORIENT", "OBC", "OBCBNK",
  "CORPBK", "CORPBANK",
]);

/**
 * DLT category single-char suffixes that may be appended without a separator.
 * Strip these and re-check the allowlist.
 */
const DLT_CATEGORY_SUFFIXES = new Set(["S", "P", "T", "G", "M"]);

/**
 * Validate an SMS sender ID against the trusted-sender allowlist.
 * Tolerates DLT operator prefixes and category suffixes.
 *
 * Examples accepted:
 *   "HDFCBK", "VK-HDFCBK", "JD-HDFCBK-S", "BP-SBIINB",
 *   "AD-PHONEPE", "JM-GPAYIN-S", "BH-PAYTM-S"
 *
 * Examples rejected:
 *   "+919876543210", "1234567", "RANDOM-TEXT", ""
 */
export function isTrustedSender(sender: string): boolean {
  if (!sender) return false;
  const upper = sender.toUpperCase().trim();
  if (!upper) return false;

  // Split on every common separator: dash, underscore, dot, space, plus, slash
  const segments = upper.split(/[-_.\s+/\\]+/).filter((s) => s.length >= 3);

  for (const seg of segments) {
    if (ALLOWED_SENDERS.has(seg)) return true;

    // Try stripping a single DLT category suffix (S/P/T/G/M) attached without dash
    if (seg.length > 4) {
      const last = seg.slice(-1);
      if (DLT_CATEGORY_SUFFIXES.has(last)) {
        if (ALLOWED_SENDERS.has(seg.slice(0, -1))) return true;
      }
    }
  }
  return false;
}

const listeners = new Set<SmsListener>();
let bridgeInstalled = false;
let pollTimer: number | null = null;
let lastSeenTs = 0;

function dispatch(msg: SmsMessage) {
  listeners.forEach((fn) => fn(msg));
}

function startSmsPolling() {
  if (pollTimer !== null || !window.TrustPayNative?.readSmsSince) return;
  lastSeenTs = Date.now();
  pollTimer = window.setInterval(() => {
    try {
      if (!window.TrustPayNative?.isSmsPermissionGranted?.()) return;
      const raw = window.TrustPayNative.readSmsSince!(lastSeenTs, 20);
      const arr: Array<{ sms: string; sender: string; date: number }> = JSON.parse(raw || "[]");
      if (!Array.isArray(arr) || arr.length === 0) return;
      const sorted = arr.slice().sort((a, b) => a.date - b.date);
      for (const item of sorted) {
        if (item.date <= lastSeenTs) continue;
        lastSeenTs = item.date;
        dispatch({ sms: item.sms || "", sender: (item.sender || "").toUpperCase().trim() });
      }
    } catch {
    }
  }, 3000);
}

function installBridge() {
  if (bridgeInstalled || !window.TrustPayNative) return;
  bridgeInstalled = true;
  window.TrustPayNative.onSmsReceived = (sms: string, sender: string = "") => {
    dispatch({ sms, sender: sender.toUpperCase().trim() });
  };
  startSmsPolling();
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

const claimedOrderIds = new Set<number>();

export function claimOrderConfirm(orderId: number): boolean {
  if (claimedOrderIds.has(orderId)) return false;
  claimedOrderIds.add(orderId);
  return true;
}

export function releaseOrderClaim(orderId: number): void {
  claimedOrderIds.delete(orderId);
}
