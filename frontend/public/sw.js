const CACHE_NAME = "do-it-services-cache-v1";
const OFFLINE_URLS = [
  "/",
  "/login",
  "/collection",
  "/deposit",
  "/admin",
  "/manifest.json",
  "/globe.svg"
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event Interceptor (Network-First falling back to Cache)
self.addEventListener("fetch", (event) => {
  // Only intercept GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip hot module reloading (HMR) / dev server internal requests so development updates are instantaneous!
  if (
    url.pathname.startsWith("/_next") || 
    url.pathname.includes("webpack") || 
    url.pathname.includes("hot-update") ||
    url.hostname === "localhost" && url.port === "3000" && url.pathname.includes("hmr")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Update cache dynamically with the freshest online response
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed (Offline mode) -> Fallback to Cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Default root fallback
          return caches.match("/");
        });
      })
  );
});
