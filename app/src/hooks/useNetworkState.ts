import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * Reactive hook that tracks browser online/offline state.
 * Returns `true` when online, `false` when offline.
 */
export function useNetworkState(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
