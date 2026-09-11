const CACHE = "kanna-draft-v0332-crow4";
const CORE = [
  "/",
  "/draft",
  "/live",
  "/counters",
  "/maps",
  "/meta",
  "/manifest.webmanifest?crow=4",
  "/favicon-32.png?crow=4",
  "/favicon-48.png?crow=4",
  "/apple-touch-icon.png?crow=4",
  "/icon-192.png?crow=4",
  "/icon-512.png?crow=4",
  "/icon-maskable-512.png?crow=4",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) await cache.put(url, response);
      } catch {
        // Un recurso opcional no debe impedir la instalación del service worker.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: "no-store" });
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(event.request)) || (await caches.match("/"));
      }
    })());
    return;
  }

  const isBrandAsset = requestUrl.searchParams.get("crow") === "4";
  if (isBrandAsset) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: "reload" });
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(event.request)) || new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) {
      event.waitUntil(fetch(event.request).then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, response);
        }
      }).catch(() => undefined));
      return cached;
    }

    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return new Response("Offline", { status: 503, statusText: "Offline" });
    }
  })());
});
