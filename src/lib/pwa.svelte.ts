import { registerSW } from "virtual:pwa-register";

export const pwa = $state({ needRefresh: false, offlineReady: false, canInstall: false });

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let deferred: InstallPromptEvent | null = null;

let update: ((reload?: boolean) => Promise<void>) | undefined;

/** Registers the service worker from a bundled module (no inline script, so the CSP holds). */
export function initPwa(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    pwa.canInstall = true;
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    pwa.canInstall = false;
  });
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;
  update = registerSW({
    immediate: true,
    onNeedRefresh() {
      pwa.needRefresh = true;
    },
    onOfflineReady() {
      pwa.offlineReady = true;
    },
  });
}

/** Activates the waiting service worker and reloads. Only called from the user's "Reload" button. */
export function applyUpdate(): void {
  void update?.(true);
}

/** Shows the browser's own install dialog (Chromium). */
export async function promptInstall(): Promise<void> {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  pwa.canInstall = false;
}
