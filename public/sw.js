const CACHE_PREFIX = "rotacomercial-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const CORE_ASSETS = ["/offline", "/manifest.webmanifest", "/icon.svg"];
const IS_LOCALHOST = self.location.hostname === "localhost";

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
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === "CACHE_URLS" && Array.isArray(event.data.urls)) {
    const urls = event.data.urls.filter((url) => {
      const parsed = new URL(url, self.location.origin);
      return (
        parsed.origin === self.location.origin &&
        (parsed.pathname.startsWith("/_next/static/") ||
          parsed.pathname === "/offline" ||
          parsed.pathname === "/manifest.webmanifest" ||
          parsed.pathname === "/icon.svg")
      );
    });
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) =>
        Promise.allSettled(urls.map((url) => cache.add(url)))
      )
    );
  }
});

async function staticAssetResponse(request) {
  const cache = await caches.open(CACHE_NAME);

  if (!IS_LOCALHOST) {
    const cached = await cache.match(request);
    if (cached) return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (
          (await cache.match("/offline")) ||
          new Response("Aplicação indisponível offline.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      })
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/icon.svg"
  ) {
    event.respondWith(staticAssetResponse(request));
  }
});

