let deferredPrompt: any = null;

export function capturePWAInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
}

export function getPWAInstallPrompt(): any {
  return deferredPrompt;
}

export function clearPWAInstallPrompt() {
  deferredPrompt = null;
}
