// Pure utility functions and constants. No React, no DOM access — safe
// to import from anywhere including non-component code.

export const GLOBAL_MAX = 600000;
export const CURRENCY_SYM = { USD: "$", GBP: "£", EUR: "€", CHF: "CHF " };

// Watchfid hot-link-protects their images (returns 404 to cross-origin
// browser fetches that include image/webp in Accept). Routing through
// /api/img — a small Vercel function that fetches with stripped headers
// — gets around it. Other dealers serve cleanly without the proxy.
export const PROXIED_IMG_HOSTS = ["watchfid.com"];

// Brand-name variants we want to collapse onto a single canonical chip.
// Mirrors merge.py's BRAND_ALIASES so the frontend can normalize saved
// snapshots that were captured before merge.py learned the alias.
// (Watchlist saves a frozen snapshot of the listing into Supabase —
// those rows pre-date any merge-time normalization and need to be
// canonicalized at read.)
//
// Lookup is case-insensitive with whitespace runs collapsed. Add a
// new alias here AND in merge.py BRAND_ALIASES so frontend + backend
// stay in sync.
const BRAND_ALIASES = {
  // JLC
  "jaeger lecoultre":  "Jaeger-LeCoultre",
  "jaeger-lecoultre":  "Jaeger-LeCoultre",
  "jaeger le coultre": "Jaeger-LeCoultre",
  "jaegerlecoultre":   "Jaeger-LeCoultre",
  "lecoultre":         "Jaeger-LeCoultre",
  "le coultre":        "Jaeger-LeCoultre",
  // A. Lange & Söhne
  "a. lange":           "A. Lange & Söhne",
  "a lange":            "A. Lange & Söhne",
  "a. lange & söhne":   "A. Lange & Söhne",
  "a. lange & sohne":   "A. Lange & Söhne",
  "a. lange and söhne": "A. Lange & Söhne",
  "lange & söhne":      "A. Lange & Söhne",
  "lange & sohne":      "A. Lange & Söhne",
  // TAG Heuer
  "tag heuer":         "TAG Heuer",
  // Universal Genève
  "universal geneve":  "Universal Genève",
  "universal genève":  "Universal Genève",
  // Hermès
  "hermes":            "Hermès",
  "hermès":            "Hermès",
  // Tiffany & Co.
  "tiffany & co.":     "Tiffany & Co.",
  "tiffany & co":      "Tiffany & Co.",
  "tiffany and co.":   "Tiffany & Co.",
  "tiffany and co":    "Tiffany & Co.",
  // Girard-Perregaux
  "girard-perregaux":  "Girard-Perregaux",
  "girard perregaux":  "Girard-Perregaux",
  // Ulysse Nardin (also fixes "Ulysee" typo)
  "ulysse nardin":     "Ulysse Nardin",
  "ulysee nardin":     "Ulysse Nardin",
  // Franck Muller — excluded brand; aliases catch typos.
  "frank muller":      "Franck Muller",
  "franck muller":     "Franck Muller",
  "franck-muller":     "Franck Muller",
};

export function canonicalizeBrand(brand) {
  if (!brand) return brand;
  const key = String(brand).replace(/\s+/g, " ").trim().toLowerCase();
  return BRAND_ALIASES[key] || brand;
}

// Lightweight brand detector for surfaces that have a title but no
// scraper-set brand field — e.g. tracked auction lots projected into
// the unified Watchlist render. Mirrors merge.py BRANDS in spirit;
// kept narrower since the frontend just needs basic substring
// matching to hand off to the existing brand chip logic. Order
// matters where one brand is a substring of another (Grand Seiko
// before Seiko, TAG Heuer before Heuer, Patek Philippe before
// Philippe).
const FRONTEND_BRANDS = [
  "Patek Philippe", "Audemars Piguet", "Vacheron Constantin",
  "Jaeger-LeCoultre", "A. Lange & Söhne", "A. Lange",
  "Grand Seiko", "Seiko", "TAG Heuer", "Tag Heuer", "Heuer",
  "Universal Genève", "Universal Geneve", "Girard-Perregaux",
  "Tiffany & Co.", "F.P. Journe", "Baume & Mercier", "Daniel Roth",
  "Ulysse Nardin", "Ralph Lauren", "Roger Dubuis",
  "Rolex", "Omega", "Tudor", "Breitling", "IWC", "Cartier",
  "Panerai", "Longines", "Movado", "Czapek", "Urwerk", "Zenith",
  "Breguet", "Blancpain", "Tissot", "Eberhard", "Aquastar",
  "Hermès", "Hermes", "Bvlgari", "Doxa", "Piaget", "Ebel",
  "Vulcain", "Favre-Leuba", "Lemania", "Yema", "Glycine",
];
export function detectBrandFromTitle(title) {
  if (!title) return "Other";
  const lower = title.toLowerCase();
  for (const b of FRONTEND_BRANDS) {
    if (lower.includes(b.toLowerCase())) return b;
  }
  return "Other";
}

// Friendly "X days left" / "ended Y hours ago" countdown for auction
// cards. Mirrors AuctionsTab's render style so the chip looks the
// same wherever auction-format items appear (Watchlist, Calendar,
// future surfaces).
export function fmtCountdown(endIso) {
  if (!endIso) return "";
  const ms = new Date(endIso).getTime() - Date.now();
  if (Number.isNaN(ms)) return "";
  const past = ms < 0;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const mins = Math.floor((abs % 3600000) / 60000);
  let label;
  if (days >= 1) label = `${days} day${days === 1 ? "" : "s"}`;
  else if (hours >= 1) label = `${hours} hour${hours === 1 ? "" : "s"}`;
  else label = `${mins} min${mins === 1 ? "" : "s"}`;
  return past ? `ended ${label} ago` : `${label} left`;
}

// Format an auction-currency price ("CHF 30,000"). Returns null if
// value is missing so callers can branch on truthy.
export function fmtLotPrice(val, currency) {
  if (val === null || val === undefined || val === "") return null;
  const n = typeof val === "number" ? val : parseFloat(val);
  if (Number.isNaN(n)) return null;
  return `${currency || ""} ${Math.round(n).toLocaleString()}`.trim();
}

// Tiny deterministic hash → 12-char hex. Used to mint stable item
// IDs from URLs so projected tracked-lot items share the dedup key
// with anything that reaches the same URL via another path. NOT
// a cryptographic hash; sufficient for "same URL → same id" within
// the app.
export function shortHash(str) {
  if (!str) return "";
  let h1 = 0x811c9dc5 | 0;       // FNV-ish, two hashes interleaved
  let h2 = 0x9e3779b9 | 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul((h2 ^ c) + ((h2 << 5) | 0), 0x85ebca6b);
  }
  const a = (h1 >>> 0).toString(16).padStart(8, "0");
  const b = (h2 >>> 0).toString(16).padStart(8, "0");
  return (a + b).slice(0, 12);
}

export function fmt(price, currency) {
  return (CURRENCY_SYM[currency] || "$") + price.toLocaleString();
}

export function fmtUSD(p) {
  return "$" + Math.round(p).toLocaleString();
}

export function daysAgo(dateStr) {
  if (!dateStr) return 9999;
  // Parse "YYYY-MM-DD" as local-tz midnight, not UTC midnight. With the
  // default `new Date("2026-04-27")` parse, the day boundary lands at
  // 5pm PT (= midnight UTC), so NEW badges flip mid-afternoon. This
  // keeps the boundary at the user's actual midnight.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return 9999;
  const then = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.floor((today - then) / 86400000);
}

// Prefer firstSeen (from state.json) over the scrape-stamped date.
// Falls back for listings that predate the state-tracking change.
export function freshDate(item) {
  return item.firstSeen || item.date;
}

// Age-bucket label for date-grouped views. Same buckets used on the
// Available feed and the Watchlist tab so the chip set + group key
// labels read identically across surfaces. Caller decides which
// date field to feed in (firstSeen for live listings, savedAt for
// watchlist snapshots, etc.).
export function ageBucketFromDate(dateStr) {
  const d = daysAgo(dateStr);
  if (d <= 1) return "Today";
  if (d <= 3) return "Last 3 days";
  if (d <= 7) return "This week";
  return "Older";
}

export function imgSrc(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (PROXIED_IMG_HOSTS.some(h => u.hostname.endsWith(h))) {
      return `/api/img?u=${encodeURIComponent(url)}`;
    }
  } catch { /* malformed URL — fall through to the raw value */ }
  return url;
}

export function logToPrice(pos) {
  if (pos >= 100) return GLOBAL_MAX;
  const minL = Math.log(500), maxL = Math.log(GLOBAL_MAX);
  return Math.round(Math.exp(minL + (pos / 100) * (maxL - minL)));
}

// First non-year 3-6 digit number in a title, used for grouping the
// watchlist by reference. Mirrors the regex behind the REFS chips.
export function extractRef(title) {
  const matches = (title || "").match(/\b\d{3,6}(?:\.\d{1,3})?\b/g) || [];
  for (const m of matches) {
    if (!m.includes(".")) {
      const n = parseInt(m, 10);
      if (n >= 1900 && n <= 2099 && m.length === 4) continue;
    }
    return m;
  }
  return null;
}
