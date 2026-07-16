/* ============================================================
   FICHA RECICLADOR — Service Worker
   - HTML: network-first (al estar online siempre baja la última versión)
   - SDK Firebase / fuentes: cache-first (offline)
   - APIs (Firestore / Drive / googleapis): NUNCA se cachean
   Sube la versión (CACHE) cuando publiques cambios.
   ============================================================ */
const CACHE = "ficha-rec-v2";

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(["./", "./index.html"]).catch(() => {})
    )
  );
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Nunca cachear llamadas a APIs (deben ir siempre a la red)
  if (
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("firebase.googleapis.com") ||
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("identitytoolkit") ||
    url.hostname.includes("google.com")
  ) {
    return; // deja pasar a la red por defecto
  }

  // HTML / navegación → network-first
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    e.respondWith(
      fetch(req)
        .then(r => { caches.open(CACHE).then(c => c.put("./index.html", r.clone())); return r; })
        .catch(() => caches.match("./index.html").then(m => m || caches.match("./")))
    );
    return;
  }

  // SDK Firebase (gstatic) y fuentes → cache-first
  if (
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com")
  ) {
    e.respondWith(
      caches.match(req).then(c =>
        c || fetch(req).then(r => {
          const clone = r.clone();
          caches.open(CACHE).then(cc => cc.put(req, clone));
          return r;
        }).catch(() => c)
      )
    );
    return;
  }

  // Resto (mismo origen) → cache-first con relleno
  e.respondWith(
    caches.match(req).then(c =>
      c || fetch(req).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(cc => cc.put(req, clone));
        return r;
      }).catch(() => c)
    )
  );
});
