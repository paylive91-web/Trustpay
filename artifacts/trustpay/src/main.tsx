import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { getAuthToken } from "./lib/auth";
import { capturePWAInstallPrompt } from "./lib/pwa-install";

setBaseUrl("https://api.trustpayapp.in");
setAuthTokenGetter(() => getAuthToken());
capturePWAInstallPrompt();

createRoot(document.getElementById("root")!).render(<App />);
