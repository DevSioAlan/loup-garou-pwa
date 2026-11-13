"use client";

import { useEffect } from "react";

/**
 * Enregistre le Service Worker minimal pour permettre l'installation PWA
 * sur Android Chrome et iOS Safari.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;
    let reloaded = false;

    const handleControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    );

    const registerAndRefresh = async () => {
      try {
        // Purge préventive des anciens caches PWA si une ancienne version traîne encore
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((key) => key !== "lune-de-sang-network-first-v2")
              .map((key) => caches.delete(key))
          );
        }

        if (cancelled) return;

        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        await registration.update().catch(() => {});
      } catch {
        // Silencieux en cas de restriction navigateur / navigation privée
      }
    };

    void registerAndRefresh();

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      );
    };
  }, []);

  return null;
}
