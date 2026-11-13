"use client";

import { useEffect, useState } from "react";

/**
 * Maintient l'écran du smartphone éveillé pendant une partie en cours
 * via navigator.wakeLock.request('screen') avec ré-acquisition automatique.
 */
export function useWakeLock(active: boolean): boolean {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const requestLock = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (!cancelled) {
          setLocked(true);
        }
        sentinel.addEventListener("release", () => {
          if (!cancelled) setLocked(false);
        });
      } catch {
        if (!cancelled) setLocked(false);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void requestLock();
      }
    };

    void requestLock();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (sentinel) {
        void sentinel.release().catch(() => {});
      }
      setLocked(false);
    };
  }, [active]);

  return locked;
}
