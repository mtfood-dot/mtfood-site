// Service Worker - MT Delivery
// Cache légère des pages/assets statiques pour l'installabilité PWA et un
// minimum de confort hors-ligne. Les appels API (Apps Script) ne sont
// JAMAIS mis en cache : toujours réseau, pour ne jamais servir des
// commandes/statuts périmés.

const CACHE_NAME = "mtdelivery-v3";
const CORE_ASSETS = [
  "/index.html",
  "/offline.html",
  "/logo.png",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ne jamais intercepter les appels vers Google Apps Script (données
  // toujours fraîches : commandes, statuts, GPS...).
  if (url.hostname.includes("script.google.com")) return;

  // Uniquement les requêtes GET du même site.
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          if (cached) return cached;
          // Navigation sans cache ni réseau : page hors ligne.
          if (event.request.mode === "navigate") return caches.match("/offline.html");
          return Response.error();
        });
      // Cache d'abord si disponible (rapide), sinon réseau.
      return cached || fetchPromise;
    })
  );
});

// --- Notifications push -----------------------------------------------
// Prêt à recevoir des notifications push (ex. nouvelle commande disponible
// pour un livreur, changement de statut pour un client) le jour où le
// backend enverra de vraies notifications (nécessite un projet Firebase
// Cloud Messaging, pas encore configuré à ce stade).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "MT Delivery", body: event.data ? event.data.text() : "" };
  }
  // Format FCM : { notification: {title, body}, data: {url, ...} } ; format brut : {title, body, url}.
  const n = data.notification || {};
  const d = data.data || {};
  const title = n.title || data.title || d.title || "MT Delivery";
  const options = {
    body: n.body || data.body || d.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: d.url || data.url || "/index.html" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/index.html";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(targetUrl));
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});
