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

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // Silencieux en cas de restriction navigateur / navigation privée
      });
  }, []);

  return null;
}
