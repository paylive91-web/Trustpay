declare global {
  interface Window {
    TrustPayNative?: {
      toast?: (msg: string) => void;
      exitApp?: () => void;
      isNotifPermissionGranted?: () => boolean;
      requestNotifPermission?: () => void;
      onNotifReceived?: (title: string, body: string, pkg: string) => void;
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
 */
const ALLOWED_SENDERS = new Set<string>([
  // UPI APPS
  "PHONEPE", "PHONPE", "PHPEPL", "PHPEUP", "PHPE",
  "GPAY", "GPAYIN", "GOOGLEPAY", "GOOGPY", "GPAYTM",
  "PAYTM", "PAYTMB", "PYTM", "PAYTMS", "PYTMUP",
  "AMZNPY", "AMZPAY", "AMAZONPAY", "AMAZPY", "AMZUPI",
  "BHIM", "BHIMUPI", "BHIMPL", "NPCIBHIM", "NPCI", "NPCIUP", "NPCIPN",
  "WHTSPP", "WAPAY", "WHATSAPP", "WAPAYM",
  "MOBKWK", "MOBIKWIK", "MBKWIK", "MBKWK", "MOBWIK",
  "CRED", "CREDPAY", "CREDIT", "CREDPY", "CREDCL",
  "SLICE", "SLICEP", "SLCEPY",
  "JUPITER", "JPITER", "JPTRMY", "JUPMNY",
  "FIMONY", "FIMONEY", "FIBANK", "FIPAY", "FIMNYC",
  "NIYO", "NIYOIN", "NIYOPY", "NIYOSL",
  "FREO", "FREOPY", "MNTPAY", "MNYTAP",
  "FAMPAY", "FAMPYS", "FAMAPP",
  "LAZPAY", "LAZYPAY", "LAZYPY",
  "SIMPL", "SIMPLB", "SIMPLE", "SMPLPY",
  "OLAMNY", "OLAMONEY", "OLAFIN", "OLAMON",
  "AIRTEL", "AIRPYB", "APBANK", "AIRTPB", "AIRBNK", "AIRMNY",
  "JIOMNY", "JIOPAY", "JIOFIN", "JIOPB", "JIOBNK",
  "FRCRGE", "FREECG", "FREECHRG", "FRCRG",
  "PAYZAP", "PAYZPP", "PYZAPP",
  "RUPAY", "RPAYIN",
  "UPI", "UPIBNK", "UPIPN", "UPIPAY",

  // PUBLIC SECTOR BANKS
  "SBI", "SBIINB", "SBIPSG", "SBISMS", "SBIBNK", "SBIUPI", "SBIBKN", "SBIATM",
  "PNB", "PNBSMS", "PNBMOB", "PNBBNK", "PNBSBI",
  "BOB", "BARODA", "BARODB", "BOBANK", "BOBSMS", "BOBIBN",
  "CANBNK", "CANARA", "CANBKK",
  "UNION", "UNIONB", "UBOFI", "UBIBKN", "UBINET",
  "BOI", "BOIBNK", "BOIIND", "BOIINB",
  "INDB", "INDBNK", "INDIANB", "INDBLL",
  "CENTBK", "CBOI", "CBOIIN", "CBINET",
  "IOB", "IOBSMS", "IOBANK", "IOBKNT",
  "UCO", "UCOBNK", "UCOBKN",
  "BOMBNK", "BOMHRA", "MAHBNK", "BOMSMS",
  "PSB", "PSBANK", "PSBSND", "PSBSMS",

  // PRIVATE BANKS
  "HDFC", "HDFCBK", "HDFCBN", "HDFCNT", "HDFCBNK",
  "ICICI", "ICICIB", "ICICIBK", "ICICIN", "ICCIBN",
  "AXIS", "AXISBK", "AXISBN", "AXISNB", "AXISMS",
  "KOTAK", "KOTAKB", "KOTAKM", "KOTAKN", "KMBANK",
  "INDUS", "INDUSB", "INDSND", "INDSBN", "IBLBNK",
  "YES", "YESBNK", "YESBK", "YESBKN",
  "IDFC", "IDFCB", "IDFCFB", "IDFCFST", "IDFFRST",
  "FED", "FEDBNK", "FEDRAL", "FEDBKL",
  "RBL", "RBLBNK", "RBLCRD", "RBLBKN",
  "BNDHN", "BANDHN", "BNDHBK", "BANDHAN",
  "SIB", "SOUTHB", "SIBANK", "SIBL",
  "KVB", "KARVYB", "KARURVB", "KARVYS",
  "CITY", "CTYUNI", "CUBSMS", "CITYUN",
  "DCB", "DCBANK", "DCBBNK",
  "TMB", "TMBLTD", "TMBANK",
  "JKBANK", "JKBNK", "JKBK",
  "KBL", "KARBNK", "KARNTK",
  "NTNL", "NAINIB", "NTLBNK",
  "DHAN", "DHANBK", "DHNBNK", "DLBNET",
  "CSB", "CTHSYR", "CSBANK", "CSBNET",
  "LVB", "LVBANK",
  "IDBI", "IDBIBN", "IDBIBK", "IDBINET",
  "SARSWT", "SARASW", "SARASWAT",
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
  "HSBC", "HSBCBK", "HSBCBN", "HSBCIN",
  "CITI", "CITIBK", "CITIBN", "CITINT",
  "SCBANK", "STDCH", "STDCHB", "SCB", "SCBNET",
  "DBS", "DBSBK", "DBSBNK", "DBSIN",
  "DEUTSC", "DBANK", "DEUTBK",
  "COSMOS", "CSMOSB",
  "ABHYUD", "ABHBNK",
  "NKGSB", "TJSB",
  "ANDHRA", "ANDBNK",
  "VIJAYA", "VIJBNK",
  "DENA", "DENABNK",
  "ALLAHABAD", "ALLBNK",
  "SYNDIC", "SNDBNK",
  "ORIENT", "OBC", "OBCBNK",
  "CORPBK", "CORPBANK",
]);

const DLT_CATEGORY_SUFFIXES = new Set(["S", "P", "T", "G", "M"]);

export function isTrustedSender(sender: string): boolean {
  if (!sender) return false;
  const upper = sender.toUpperCase().trim();
  if (!upper) return false;
  const segments = upper.split(/[-_.\s+/\\]+/).filter((s) => s.length >= 3);
  for (const seg of segments) {
    if (ALLOWED_SENDERS.has(seg)) return true;
    if (seg.length > 4) {
      const last = seg.slice(-1);
      if (DLT_CATEGORY_SUFFIXES.has(last)) {
        if (ALLOWED_SENDERS.has(seg.slice(0, -1))) return true;
      }
    }
  }
  return false;
}

function pkgToSender(pkg: string): string {
  if (pkg.includes("phonepe"))    return "PHONEPE";
  if (pkg.includes("nbu.paisa")) return "GPAY";
  if (pkg.includes("gpay"))       return "GPAY";
  if (pkg.includes("paytm"))      return "PAYTM";
  if (pkg.includes("amazon"))     return "AMZNPY";
  if (pkg.includes("bhim"))       return "BHIM";
  if (pkg.includes("mobikwik"))   return "MOBKWK";
  if (pkg.includes("whatsapp"))   return "WHTSPP";
  if (pkg.includes("sbi"))        return "SBIINB";
  if (pkg.includes("hdfcbank"))   return "HDFCBK";
  if (pkg.includes("icicibankltd")) return "ICICIB";
  if (pkg.includes("axisbank"))   return "AXISBK";
  if (pkg.includes("kotak"))      return "KOTAKB";
  if (pkg.includes("yesbank"))    return "YESBNK";
  if (pkg.includes("freecharge")) return "FRCRGE";
  if (pkg.includes("airtel"))     return "AIRTEL";
  if (pkg.includes("jio"))        return "JIOMNY";
  return "UPIBNK";
}

const listeners = new Set<SmsListener>();
let bridgeInstalled = false;

function dispatch(msg: SmsMessage) {
  listeners.forEach((fn) => fn(msg));
}

function installBridge() {
  if (bridgeInstalled || !window.TrustPayNative) return;
  bridgeInstalled = true;

  window.TrustPayNative.onNotifReceived = (title: string, body: string, pkg: string) => {
    const text = (body || title || "").trim();
    if (!text) return;
    const sender = pkgToSender(pkg);
    dispatch({ sms: text, sender });
  };
}

export function addSmsListener(fn: SmsListener): () => void {
  listeners.add(fn);
  installBridge();
  return () => listeners.delete(fn);
}

export function requestSmsPermission() {
  window.TrustPayNative?.requestNotifPermission?.();
}

export function isSmsPermissionGranted(): boolean {
  if (window.TrustPayNative?.isNotifPermissionGranted) {
    return window.TrustPayNative.isNotifPermissionGranted();
  }
  return false;
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
