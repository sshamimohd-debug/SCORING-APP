/* Simple offline cache for MPGB Premier League PWA */
const CACHE = "mpgb-pl-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./scorecard.html",
  "./stats.html",
  "./points.html",
  "./settings.html",
  "./css/theme-dark.css",
  "./js/app.js",
  "./js/rules-engine.js",
  "./js/storage.js",
  "./js/ui.js",
  "./js/firebase.js",
  "./assets/icons/shield.svg",
  "./assets/icons/trophy.svg",
  "./manifest.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE ? caches.delete(k) : null))).then(()=>self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(()=>cached))
  );
});
