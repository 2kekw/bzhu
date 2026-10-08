// Offline support: app files are cached on install, fonts are cached on first use.
// VERSION must match APP_VERSION in index.html (major.minor.patch). Bump it on every release so phones pick up the new version.
const VERSION = "bzhu-2.0.0";
const ASSETS = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "zxing.min.js", "firebase-config.js", "firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js"];

self.addEventListener("install", e => {
  // cache: "reload" — берём файлы с сервера, а не из кэша браузера, иначе в новую версию может попасть старый файл
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== location.origin && !isFont) return;

  // Network first for the page itself so updates arrive; cache as fallback offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        // кэшируем только настоящую страницу приложения: не ошибку сервера и не страницу входа в Wi-Fi
        if (res.ok && res.type === "basic" && !res.redirected) {
          const copy = res.clone();
          e.waitUntil(caches.open(VERSION).then(c => c.put("index.html", copy)));
          return res;
        }
        return caches.match("index.html").then(hit => hit || res);
      }).catch(() => caches.match("index.html"))
    );
    return;
  }

  // Cache first for icons, manifest and fonts.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || (isFont && res.type === "opaque")) {
        const copy = res.clone();
        e.waitUntil(caches.open(VERSION).then(c => c.put(req, copy)));
      }
      return res;
    }))
  );
});
