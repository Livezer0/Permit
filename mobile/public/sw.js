// Minimal app-shell service worker for installability + basic offline.
const CACHE = "ptw-mobile-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Always go to network for API calls; never cache them.
  if (url.pathname.includes("/api/")) return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
