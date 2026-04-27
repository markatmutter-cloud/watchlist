/**
 * Image proxy.
 *
 * Some dealers (Watchfid) hot-link-protect their images: any cross-origin
 * fetch from a browser fails. Browsers always send Accept + Referer
 * headers we can't strip from <img> tags, so the only way around it is
 * a server-side fetch with stripped headers.
 *
 * Usage: `<img src="/api/img?u=https%3A%2F%2Fexample.com%2Fimg.jpg" />`.
 *
 * Allow-listed to specific dealer domains so this can't be abused as
 * an open proxy.
 */

const ALLOWED_HOSTS = new Set([
  "www.watchfid.com",
  "watchfid.com",
]);

// Hot-link-protected hosts require their own domain in Referer or the
// CDN returns 404. Watchfid's .jpg uploads enforce this; their .webp
// uploads happen to be exempt, which masked the bug for a while.
const REFERER_BY_HOST = {
  "www.watchfid.com": "https://www.watchfid.com/",
  "watchfid.com": "https://www.watchfid.com/",
};

export default async function handler(req, res) {
  const u = (req.query && req.query.u) || "";
  if (!u) {
    res.status(400).send("missing ?u");
    return;
  }

  let target;
  try {
    target = new URL(u);
  } catch {
    res.status(400).send("bad url");
    return;
  }
  if (!ALLOWED_HOSTS.has(target.hostname)) {
    res.status(403).send("host not allowed");
    return;
  }

  try {
    // Minimal headers. Watchfid's Apache rules return 404 when Accept
    // includes image/webp, so we don't pass it through. Referer is set
    // per-host above for the dealers that hot-link protect — the host
    // allow-list keeps the proxy from being abused for other purposes.
    const headers = {
      "User-Agent": "Mozilla/5.0 (compatible; Watchlist/1.0; +https://the-watch-list.app)",
    };
    if (REFERER_BY_HOST[target.hostname]) {
      headers["Referer"] = REFERER_BY_HOST[target.hostname];
    }
    const upstream = await fetch(target.toString(), {
      headers,
      redirect: "follow",
    });

    if (!upstream.ok) {
      res.status(upstream.status).send("upstream error");
      return;
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("content-type", contentType);
    // Cache aggressively at the edge — images don't change once
    // uploaded by the dealer.
    res.setHeader("cache-control", "public, max-age=86400, s-maxage=604800");

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(200).send(buf);
  } catch (err) {
    res.status(502).send(`fetch failed: ${err.message}`);
  }
}
