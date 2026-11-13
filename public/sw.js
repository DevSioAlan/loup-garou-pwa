// Service Worker PWA — Stratégie Network-First pour toujours servir la dernière version en ligne
const CACHE_NAME = "lune-de-sang-network-first-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Ne jamais intercepter les requêtes cross-origin (ex: Supabase) ni le HMR Next.js
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/_next/webpack-hmr")
  ) {
    return;
  }

  // Stratégie Network-First : réseau prioritaire, cache uniquement en secours hors-ligne
  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(request, { cache: "no-store" });
        if (networkResponse && networkResponse.ok && networkResponse.type === "basic") {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone()).catch(() => {});
        }
        return networkResponse;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw new Error("Réseau indisponible et ressource absente du cache.");
      }
    })()
  );
});
