/**
 * Dynamic Open Graph preview for share links.
 *
 * Problem: iMessage / Slack / Discord etc. fetch the URL with their
 * preview-bot User-Agent and scrape og:image + og:title to render the
 * rich-link card. The static `public/index.html` ships the site logo
 * and a generic site-wide description, so every share looked
 * identical regardless of which listing the user actually shared
 * (Mark's iMessage screenshot 2026-05-06: hourglass logo, no watch).
 *
 * Fix: route share-link clicks through this serverless endpoint via
 * the `/share/:id` rewrite in vercel.json. We look the listing up in
 * the deployed listings.json, emit per-listing og:image + og:title,
 * then redirect real browsers to the SPA's existing share-receive
 * URL (`/?listing=<id>&shared=1`) which ShareReceiver already
 * handles. Preview bots stop after the head-scrape so they never see
 * the redirect — and humans land on the focused share surface.
 *
 * Listings.json is read from disk on each cold start and cached for
 * a minute; that's plenty for a 3×/day scrape cadence.
 */

const fs = require('fs');
const path = require('path');

let listingsCache = null;
let listingsCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000;

// Mirrors `shortHash` in src/utils.js — keep in sync. FNV-style
// double-hash producing a stable 12-char hex id from a URL. Used so
// auction-lot share URLs map to the same `shortHash(url)` id the
// frontend uses.
function shortHash(str) {
  if (!str) return '';
  let h1 = 0x811c9dc5 | 0;
  let h2 = 0x9e3779b9 | 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul((h2 ^ c) + ((h2 << 5) | 0), 0x85ebca6b);
  }
  const a = (h1 >>> 0).toString(16).padStart(8, '0');
  const b = (h2 >>> 0).toString(16).padStart(8, '0');
  return (a + b).slice(0, 12);
}

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (e) { return null; }
}

function loadListings() {
  const now = Date.now();
  if (listingsCache && now - listingsCacheTime < CACHE_TTL_MS) return listingsCache;
  const out = [];
  // 1. Dealer feed (already array-shaped, has `id`).
  const dealers = readJson(path.join(process.cwd(), 'public', 'listings.json'));
  if (Array.isArray(dealers)) {
    for (const d of dealers) if (d) out.push(d);
  }
  // 2. Auction lots (comprehensive scrape + manual archive). Both
  //    files are keyed `{url: lot_data}` — flatten into the same
  //    array shape as `listings.json` so the lookup-by-id below works
  //    uniformly. id is shortHash(url) to match the frontend's
  //    auctionLotItems projection in App.js.
  for (const fname of ['auction_lots.json', 'manual_archive_lots.json']) {
    const blob = readJson(path.join(process.cwd(), 'public', fname));
    if (!blob || typeof blob !== 'object') continue;
    for (const url of Object.keys(blob)) {
      const data = blob[url] || {};
      out.push({
        id: shortHash(url),
        url,
        brand: data.maker || data.house || '',
        ref: data.title || '',
        title: data.title || '',
        img: data.cached_img_url || data.image || '',
        // Carry the source so OG copy can hint at what kind of share
        // this is ("Sotheby's lot", "Phillips lot") — currently the
        // OG description is site-wide, but a future iteration may
        // want this field.
        source: data.house || '',
      });
    }
  }
  listingsCache = out;
  listingsCacheTime = now;
  return listingsCache;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

// Mirrors PROXIED_IMG_HOSTS in src/utils.js — keep in sync. Image
// hosts that hot-link-protect won't render in the OG card unless we
// route them through /api/img which strips Referer + Accept.
const PROXIED_IMG_HOSTS = ['watchfid.com'];

function resolveOgImage(rawUrl, siteUrl) {
  if (!rawUrl) return `${siteUrl}/apple-touch-icon.png`;
  try {
    const u = new URL(rawUrl);
    if (PROXIED_IMG_HOSTS.some((h) => u.hostname.endsWith(h))) {
      return `${siteUrl}/api/img?u=${encodeURIComponent(rawUrl)}`;
    }
  } catch {
    // malformed URL — fall through to raw
  }
  return rawUrl;
}

module.exports = function handler(req, res) {
  const id = (req.query && (req.query.listing || req.query.id)) || '';
  const siteUrl = 'https://the-watch-list.app';

  const listings = loadListings();
  const item = id ? (listings.find((l) => l && l.id === id) || null) : null;

  // Default fallback (no listing matched): site-wide preview, same
  // shape the static index.html had before this function existed.
  let ogImage = `${siteUrl}/apple-touch-icon.png`;
  let ogTitle = 'Watchlist · Vintage watches in one feed';
  let ogDesc = 'Aggregator for vintage watches from independent dealers and auction houses.';
  let twitterCard = 'summary';

  if (item) {
    ogImage = resolveOgImage(item.img, siteUrl);
    const watchTitle = [item.brand, item.ref].filter(Boolean).join(' ').trim();
    if (watchTitle) {
      ogTitle = `${watchTitle} · Watchlist`;
    } else if (item.title) {
      ogTitle = `${String(item.title).slice(0, 80)} · Watchlist`;
    }
    // Mark-specified caption (2026-05-06): keep it about the site,
    // not the watch — recipient should know what app they're being
    // sent to before opening.
    ogDesc = 'Watchlist — Vintage watches in one feed';
    twitterCard = 'summary_large_image';
  }

  // Real browsers redirect to the SPA's existing share-receive
  // surface. ShareReceiver parses ?listing=&shared=1 on mount and
  // takes over the content area. Preview bots stop after the head
  // and never see the redirect.
  const redirectUrl = `${siteUrl}/?listing=${encodeURIComponent(id)}&shared=1`;

  // Canonical points at the SPA root so search engines don't index
  // /share/<id> as a separate page from the main app.
  const canonicalUrl = `${siteUrl}/`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(ogTitle)}</title>
<link rel="canonical" href="${escapeHtml(canonicalUrl)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Watchlist">
<meta property="og:title" content="${escapeHtml(ogTitle)}">
<meta property="og:description" content="${escapeHtml(ogDesc)}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta property="og:url" content="${escapeHtml(redirectUrl)}">
<meta name="twitter:card" content="${twitterCard}">
<meta name="twitter:title" content="${escapeHtml(ogTitle)}">
<meta name="twitter:description" content="${escapeHtml(ogDesc)}">
<meta name="twitter:image" content="${escapeHtml(ogImage)}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}">
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:60px auto;padding:0 20px;color:#333;line-height:1.5}</style>
</head>
<body>
<p>Opening Watchlist…</p>
<p><a href="${escapeHtml(redirectUrl)}">Continue to Watchlist</a> if you're not redirected automatically.</p>
<script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Short edge cache so listings.json updates propagate to OG previews
  // within a minute — preview-bots tend to re-fetch on demand anyway.
  res.setHeader('Cache-Control', 'public, s-maxage=60, max-age=60');
  res.status(200).send(html);
};
