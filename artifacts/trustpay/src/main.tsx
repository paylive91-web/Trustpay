import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getAuthToken } from "./lib/auth";
import { capturePWAInstallPrompt } from "./lib/pwa-install";

setAuthTokenGetter(() => getAuthToken());
capturePWAInstallPrompt();

createRoot(document.getElementById("root")!).render(<App />);
