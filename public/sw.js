const CACHE = "vesper-shell-v13-live-tools";
const SHELL = [
  "./",
  "./manifest-v8.webmanifest",
  "./icon-192-20260823-v8.png",
  "./icon-512-20260823-v8.png",
  "./icon-maskable-512-20260823-v8.png",
  "./apple-touch-icon-20260823-v8.png",
  "./favicon-20260823-v8.png",
  "./vesper-default-bg.webp",
  "./vesper-drawer-bg.webp",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  const isNavigation = event.request.mode === "navigate" || event.request.destination === "document";
  event.respondWith(
    fetch(event.request, isNavigation ? { cache: "no-store" } : undefined)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((cached) => cached || (isNavigation ? caches.match("./") : undefined)),
      ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const existing = windows[0];
        return existing ? existing.focus() : self.clients.openWindow("./");
      }),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Vesper", body: "你有一条新消息", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192-20260823-v8.png",
      badge: "/favicon-20260823-v8.png",
      tag: payload.tag || "vesper",
      data: { url: payload.url || "/" },
    }),
  );
});
