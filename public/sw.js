// VIIPA service worker: lets the site be installed as an app, and shows a simple page when there is no network.
// Pages and data always come from the network (nothing is cached but the offline page), so the app never shows
// stale bookings, prices or availability.
const OFFLINE = "/offline.html";
const CACHE = "viipa-offline-v2";
const LOGO = "/brand/viipa-logo.png";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE, LOGO])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  // The offline page's logo, when there is no network.
  if (new URL(request.url).pathname === LOGO) {
    event.respondWith(fetch(request).catch(() => caches.match(LOGO)));
    return;
  }
  if (request.mode !== "navigate") return;
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
});
