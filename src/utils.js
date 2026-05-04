// Pure utility functions and constants. No React, no DOM access — safe
// to import from anywhere including non-component code.

export const GLOBAL_MAX = 600000;
export const CURRENCY_SYM = { USD: "$", GBP: "£", EUR: "€", CHF: "CHF ", HKD: "HK$", JPY: "¥" };

// USD-per-unit rates for client-side conversion to the user's primary
// display currency. Mirrors merge.py's FX dict (line 144) so backend
// + frontend agree on direction. Only the 4 currencies in v1's user
// picker (USD/GBP/EUR/HKD) need to be lookup-able as TARGETS;
// listings can arrive in any currency, but priceUSD is the canonical
// anchor — to convert, divide priceUSD by RATES[target].
//
// Rates are approximate; vintage-watch prices don't need fx-trader
// precision. Update this dict when the merge.py one moves.
export const FX_RATES_USD_PER = {
  USD: 1.0,
  GBP: 1.27,
  EUR: 1.08,
  HKD: 0.128,
  CHF: 1.13,
  JPY: 0.0067,
  CNY: 0.14,
};

// Convert an item's price to a target display currency using priceUSD
// as the bridge. Returns the integer price in the target currency, or
// null if we can't compute it (priceUSD missing AND currency mismatch).
//
//   - If item.currency === target → return item.price (exact native).
//   - Else if priceUSD is set → priceUSD / RATES[target].
//   - Else → null (caller falls back to native).
export function priceIn(item, target) {
  if (!item || !target) return null;
  if (item.currency && item.currency.toUpperCase() === target) {
    return item.price ?? null;
  }
  if (item.priceUSD == null) return null;
  const rate = FX_RATES_USD_PER[target];
  if (!rate) return null;
  if (target === "USD") return Math.round(item.priceUSD);
  return Math.round(item.priceUSD / rate);
}

// Free-text search match. Splits the query into whitespace tokens and
// requires every token to appear (case-insensitively) somewhere in the
// item's brand+ref haystack. Word ORDER is irrelevant — "rolex gold"
// and "gold rolex" match the same listings.
//
// Pre-2026-04-30 this was an inline `.includes(q)` that treated the
// whole query as one substring; "rolex gold" would miss the listing
// "1978 Rolex 1675/8 Yellow Gold Tropical GMT" because "rolex" and
// "gold" aren't adjacent.
//
// Returns true on empty/whitespace-only queries (the search input
// being empty isn't a filter).
export function matchesSearch(item, query) {
  if (!query) return true;
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = `${item.brand || ""} ${item.ref || ""}`.toLowerCase();
  return tokens.every(t => haystack.includes(t));
}

// Hosts whose images we route through `/api/img` because they
// hot-link-protect (different mechanisms per dealer, but both refuse
// browser fetches with a cross-origin Referer):
//   - Watchfid: Apache returns 404 for cross-origin requests whose
//     Accept header includes image/webp.
//   - Watches of Lancashire: Cloudflare returns 403 (with `vary:
//     referer` in the response) when Referer != watchesoflancashire.com.
// The proxy strips the Accept and substitutes the dealer's own domain
// as Referer per REFERER_BY_HOST in api/img.js. Add new dealers here
// AND in api/img.js's ALLOWED_HOSTS together — the host allow-list
// in the proxy keeps it from being abused.
export const PROXIED_IMG_HOSTS = ["watchfid.com", "watchesoflancashire.com"];

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

// Friendly "Sold today" / "Sold 5 days ago" / "Sold 2026-03-12" label
// for the secondary line on sold cards. Recent → relative; older →
// absolute date so the value reads clearly without arithmetic.
export function fmtSoldDate(dateStr) {
  if (!dateStr) return null;
  const date = String(dateStr).slice(0, 10);
  const days = daysAgo(date);
  if (days < 0 || days === 9999) return null;
  if (days === 0) return "Sold today";
  if (days === 1) return "Sold yesterday";
  if (days < 30) return `Sold ${days} days ago`;
  return `Sold ${date}`;
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

// Age-bucket label for date-grouped views (Available + Watchlist).
// Weekday-based for the last week so the labels feel natural in
// daily browsing — Mark's mental model is "what came in on
// Wednesday" rather than "what came in 2-3 days ago". Buckets:
//   - Today                   (0 days ago)
//   - Yesterday                (1)
//   - <weekday name>           (2-6 days ago — Monday / Tuesday / ...)
//   - Last week                (7-13)
//   - Older                    (14+)
// Caller decides which date field to feed in (firstSeen for live
// listings, savedAt for watchlist snapshots, etc.).
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function ageBucketFromDate(dateStr) {
  const d = daysAgo(dateStr);
  if (d < 0 || d === 9999) return "Older";
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d <= 6) {
    // Look up the actual weekday for this item's date so the label
    // is stable as today rolls forward.
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
    if (m) {
      const dt = new Date(+m[1], +m[2] - 1, +m[3]);
      return WEEKDAYS[dt.getDay()];
    }
    return "Older";
  }
  if (d <= 13) return "Last week";
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
