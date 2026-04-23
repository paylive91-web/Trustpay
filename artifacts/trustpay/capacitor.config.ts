import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.trustpay.app",
  appName: "TrustPay",
  webDir: "dist/public",
  server: {
    url: "https://trustpay-l0xq.onrender.com",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    appendUserAgent: "TrustPayAndroid/1.0",
    allowMixedContent: false,
  },
};

export default config;
