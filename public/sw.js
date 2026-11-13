// Service Worker minimal pour l'installabilité PWA (Phase 1)
const CACHE_NAME = "lune-de-sang-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Pass-through réseau pour garder les futures données temps réel fraîches
  event.respondWith(fetch(event.request));
});
