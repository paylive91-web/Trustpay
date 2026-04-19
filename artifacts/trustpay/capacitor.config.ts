import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wrapper config for the TrustPay Android APK.
 *
 * Important details:
 *  - `appendUserAgent` adds the "TrustPayAndroid/1.0" suffix to every request
 *    made by the in-app WebView. The web layer (see `components/install-lock.tsx`)
 *    sniffs this string to know the page is running inside the installed APK
 *    and therefore skips the "must install" overlay.
 *  - `server.url` points the WebView at the production web build instead of
 *    bundling assets, so we don't have to ship a new APK every time the React
 *    code changes — only when native plugins or the wrapper itself updates.
 *
 * Build steps (run on a machine with Android SDK + JDK 17, NOT on Replit):
 *   pnpm --filter @workspace/trustpay add -D @capacitor/cli @capacitor/core @capacitor/android
 *   pnpm --filter @workspace/trustpay exec cap add android
 *   pnpm --filter @workspace/trustpay exec cap sync android
 *   cd artifacts/trustpay/android && ./gradlew assembleRelease
 *   # signed APK appears in app/build/outputs/apk/release/
 *   # upload it somewhere public and paste the URL into Admin → Settings → Android App.
 */
const config: CapacitorConfig = {
  appId: "com.trustpay.app",
  appName: "TrustPay",
  webDir: "dist",
  server: {
    // Replace with the production URL of the deployed web app.
    url: "https://trustpay.example.com",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    appendUserAgent: "TrustPayAndroid/1.0",
    allowMixedContent: false,
  },
};

export default config;
