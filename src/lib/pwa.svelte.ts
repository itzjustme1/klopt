import { registerSW } from "virtual:pwa-register";

export const pwa = $state({ needRefresh: false, offlineReady: false });

let update: ((reload?: boolean) => Promise<void>) | undefined;

/** Registers the service worker from a bundled module (no inline script, so the CSP holds). */
export function initPwa(): void {
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
