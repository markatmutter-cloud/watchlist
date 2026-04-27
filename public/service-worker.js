/**
 * Watchlist service worker.
 *
 * Goals:
 *   1. Always deliver the freshest index.html so users pick up new
 *      bundle hashes promptly. iOS PWA standalone mode aggressively
 *      caches HTML — without this, a deployed fix can sit invisible
 *      on the user's phone for hours / days.
 *   2. Cache hashed static assets (CRA's main.<hash>.js / .css under
 *      /static/) with a cache-first strategy so subsequent loads are
 *      fast and offline-tolerant.
 *   3. Network-first the JSON files (listings.json, auctions.json,
 *      tracked_lots.json) so fresh scraper data lands without manual
 *      refresh.
 *   4. Auto-clean old caches on activate.
 *
 * Update strategy:
 *   - skipWaiting() + clients.claim() so a new SW takes over without
 *     waiting for tabs to close.
 *   - Bumping CACHE_VERSION invalidates the static cache entirely.
 */

const CACHE_VERSION = "watchlist-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

self.addEventListener("install", (event) => {
  // Take over immediately rather than waiting for all tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Drop any caches from older versions.
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(n => n.startsWith("watchlist-") && !n.startsWith(CACHE_VERSION))
        .map(n => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

function isHashedStaticAsset(url) {
  // CRA emits files with content hashes under /static/, plus root-level
  // assets with hashed names. They're immutable — safe to cache hard.
  return url.pathname.startsWith("/static/")
      || /\/[^/]+\.[a-f0-9]{8,}\.(js|css|woff2?|ttf|otf|png|jpg|svg|webp)$/i.test(url.pathname);
}

function isJsonData(url) {
  // The scraper output JSONs we want freshness-first on.
  return /\/(listings|auctions|tracked_lots|state|auctions_state)\.json$/i.test(url.pathname)
      || /raw\.githubusercontent\.com\/.+\/(listings|auctions|tracked_lots|state|auctions_state)\.json$/i.test(url.href);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch { return; }

  // 1. Hashed static assets — cache-first. They're immutable; safe to
  //    hit cache forever and skip the network entirely once seeded.
  if (isHashedStaticAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const resp = await fetch(req);
        if (resp && resp.ok) cache.put(req, resp.clone());
        return resp;
      } catch (err) {
        return hit || Response.error();
      }
    })());
    return;
  }

  // 2. JSON data files — network-first, no caching of stale bodies.
  //    `no-store` so each request hits the server (which still 304s
  //    via the browser HTTP cache when ETag matches).
  if (isJsonData(url)) {
    event.respondWith((async () => {
      try {
        return await fetch(req, { cache: "no-store" });
      } catch (err) {
        // Offline fallback: try a stale cache entry if we have one.
        const cache = await caches.open(STATIC_CACHE);
        const hit = await cache.match(req);
        return hit || Response.error();
      }
    })());
    return;
  }

  // 3. HTML navigations — network-first so users always get the latest
  //    bundle hash references on the page they load.
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch (err) {
        const cache = await caches.open(STATIC_CACHE);
        const hit = await cache.match(req) || await cache.match("/");
        return hit || Response.error();
      }
    })());
    return;
  }

  // 4. Everything else — pass through.
});
