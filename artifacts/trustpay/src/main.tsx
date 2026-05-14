import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { getAuthToken } from "./lib/auth";
import { capturePWAInstallPrompt } from "./lib/pwa-install";

setBaseUrl("https://api.trustpayapp.in");
setAuthTokenGetter(() => getAuthToken());
capturePWAInstallPrompt();

// Remove the static HTML splash once React mounts —
// the React WebSplashScreen takes over from here.
function removeStaticSplash() {
  const el = document.getElementById("static-splash");
  if (!el) return;
  el.classList.add("fade-out");
  setTimeout(() => el.remove(), 500);
}

createRoot(document.getElementById("root")!).render(<App />);

// Give React one frame to paint before hiding the static splash
// so there's no blank-white flash between the two splash screens.
requestAnimationFrame(() => {
  requestAnimationFrame(removeStaticSplash);
});
