#!/usr/bin/env python3
"""
Merge scraper CSVs into public/listings.json with cross-run state tracking.

State model (public/state.json):
  {
    "<stable_id>": {
      "firstSeen":   "YYYY-MM-DD",
      "lastSeen":    "YYYY-MM-DD",
      "priceHistory": [{"date": "YYYY-MM-DD", "price": int, "currency": "USD"}],
      "lastSource":  "Wind Vintage",
      "lastUrl":     "https://...",
      "lastTitle":   "1978 Rolex 6263 ...",   # cached so inactive listings
      "lastBrand":   "Rolex",                 # can still render in the
      "lastImg":     "https://.../img.jpg",   # Archive tab without needing
      "lastCurrency": "USD",                  # a fresh scrape.
      "active":      true,                     # False once it stops appearing.
      "soldAt":      "YYYY-MM-DD",             # Set when active flips false.
      "missCount":   0                         # Consecutive runs absent from the
                                               # scrape (disappearance debounce).
    },
    ...
  }

Stable ID: first 12 chars of SHA1 over a normalized URL (lowercase, no scheme,
no query, no trailing slash). URL is the most durable identifier the dealers
expose. Index-based IDs (wv-0, wv-1) are not stable: a new listing at the top
shifts every other ID and breaks the watchlist.
"""
import csv, json, re, os, hashlib
from datetime import datetime
from zoneinfo import ZoneInfo
from collections import Counter

# Per-dealer structured-field parsers — extracts reference_no, model_name,
# year, material, case_size, dial, movement, etc. from each source's
# spec block. Same shape as auction_lot_parsers attaches to auction lots.
from dealer_parsers import parse_dealer_description

# Reference-index matcher (Epic 0 slice B, 2026-05-19). Wires the
# curated `docs/watch_references.md` index into the dealer pipeline so
# every listing picks up `reference_id` + `model` + `sub_model` +
# `model_line` when its brand+ref hits the curated index. Same pattern
# as hodinkee_shop_scraper / hairspring_finds_scraper.
#
# Falls back to no-op when the matcher module or index isn't present
# (defensive — keeps merge.py runnable in stripped-down environments).
try:
    from pathlib import Path as _Path
    from reference_index_match import (
        parse_index as _ref_parse_index,
        build_ref_index as _ref_build_ref_index,
        build_model_name_index as _ref_build_model_name_index,
        match_or_extract as _ref_match_or_extract,
    )
    _REF_INDEX_PATH = _Path(__file__).parent / "docs" / "watch_references.md"
    _REF_CACHE = None

    def _ref_indices():
        """Lazy-build the matcher's three indices on first call.

        Returns (ref_index, model_name_index, brands_in_index) or
        (None, None, None) when the index file isn't present.
        """
        global _REF_CACHE
        if _REF_CACHE is None:
            if not _REF_INDEX_PATH.exists():
                _REF_CACHE = (None, None, None)
            else:
                brands = _ref_parse_index(_REF_INDEX_PATH.read_text())
                _REF_CACHE = (
                    _ref_build_ref_index(brands),
                    _ref_build_model_name_index(brands),
                    set(brands.keys()),
                )
        return _REF_CACHE

    def enrich_with_reference_match(item):
        """Populate item['reference_id' / 'model' / 'sub_model' /
        'model_line'] when the curated index matches.

        Probes (in order): `brand + reference_no` (most precise),
        title (fallback). Stops on first hit. Existing fields on the
        item are preserved — only fills empty values.
        """
        ref_idx, model_name_idx, brands_in_idx = _ref_indices()
        if not ref_idx:
            return
        brand = item.get("brand") or None
        ref_no = item.get("reference_no") or ""
        title = item.get("ref") or ""
        probes = []
        if brand and ref_no:
            probes.append(f"{brand} {ref_no}")
        if title:
            probes.append(title)
        for probe in probes:
            if not probe:
                continue
            hit = _ref_match_or_extract(
                probe, ref_idx,
                brand=brand,
                brands_in_index=brands_in_idx,
                model_name_index=model_name_idx,
            )
            if hit:
                hit_brand = hit.get("brand")
                # Cross-pollination guard (2026-05-20): if the matcher's
                # brand DISAGREES with our known brand, reject the hit.
                # Without this, "TUDOR Heritage M70330N ... 2018" had
                # "2018" matched as Cartier Crash reference 2018,
                # planting `model=Crash` on Tudor items. Year-vs-ref
                # collisions like this happen any time a numeric token
                # in a title happens to be a registered reference for a
                # different brand. Only apply the hit when brands agree
                # or when our brand was empty/Other (matcher fills in).
                brand_known = bool(brand) and brand != "Other"
                if hit_brand and brand_known and hit_brand != brand:
                    continue
                # Trust the matcher's canonical brand when our existing
                # value is empty / Other (e.g. scraper failed to detect).
                if hit_brand and not brand_known:
                    item["brand"] = hit_brand
                # Fill structured fields only when our parser didn't.
                if hit.get("reference_id") and not item.get("reference_id"):
                    item["reference_id"] = hit["reference_id"]
                if hit.get("reference_no") and not item.get("reference_no"):
                    item["reference_no"] = hit["reference_no"]
                if hit.get("model") and not item.get("model"):
                    item["model"] = hit["model"]
                if hit.get("sub_model") and not item.get("sub_model"):
                    item["sub_model"] = hit["sub_model"]
                if hit.get("model_line") and not item.get("model_line"):
                    item["model_line"] = hit["model_line"]
                return
except Exception as _e:
    # Module-level failure — log + no-op stub so the rest of merge.py
    # runs unaffected. Same defensive posture as the other optional
    # imports in this file.
    def enrich_with_reference_match(item):  # type: ignore
        return

BRANDS = [
    'Rolex', 'Omega', 'Patek Philippe', 'Tudor', 'Breitling', 'IWC', 'Cartier',
    'Jaeger-LeCoultre', 'Panerai', 'Audemars Piguet', 'Vacheron Constantin',
    'A. Lange', 'Aquastar', 'Ralph Lauren',
    # Grand Seiko must come BEFORE Seiko so substring match grabs the
    # full name first.
    'Grand Seiko', 'Seiko',
    'Universal Geneve',
    # Tag Heuer must come BEFORE Heuer so substring match doesn't grab "Heuer" first.
    'Tag Heuer', 'Heuer',
    'Longines', 'Movado', 'Czapek', 'Urwerk', 'Zenith', 'Breguet',
    'Blancpain', 'Tissot', 'Gallet', 'Girard-Perregaux', 'Eberhard',
    # Added 2026-04-29 — Mark requested Favre-Leuba + Vulcain; Ebel /
    # Ikepod / Piaget were sitting in the Other bucket despite clearly
    # branded titles.
    'Favre-Leuba', 'Vulcain', 'Ebel', 'Ikepod', 'Piaget',
    # Added 2026-05-05: Gerald Genta + Bulgari were sitting in Other
    # because the brand wasn't on the substring list. Nivada Grenchen
    # added so titles like "Nivada Grenchen Antarctic" detect cleanly
    # (Croton + bare "Nivada" titles route through canonicalize_brand
    # aliases). Mulco removed from BRANDS — promoted to the front-end
    # FORCE_OTHER_BRANDS list (kept on the data side, pooled into the
    # Other chip in the UI per Mark's brand-cleanup pass).
    'Gerald Genta', 'Bulgari', 'Nivada Grenchen',
    # Added 2026-05-28 (B-26): a Wind Vintage "Richard Mille RM 002-V2"
    # listing landed in Other (brand undetected), so the reference
    # matcher matched the bare "002" token against Enicar Sherpa Graph
    # ref 002 and planted brand=Enicar + that model_line on a Richard
    # Mille. Detecting the brand here trips the cross-pollination guard
    # in enrich_with_reference_match and rejects the bogus hit.
    'Richard Mille',
]

# Brand-name variants we want to collapse onto a single canonical chip.
# Lookup is case-insensitive with whitespace + punctuation normalised.
# Add new aliases here when a dealer uses a non-standard spelling that
# leaks through detect_brand or comes from a scraper's own brand field.
#
# JLC group: "LeCoultre" (without "Jaeger") is the historic pre-1937
# brand line. Modern collectors (and Mark) treat all of these as the
# same maison for filter purposes.
BRAND_ALIASES = {
    # JLC variants → canonical hyphenated form. JLC appears in titles
    # as "Jaeger LeCoultre" (no hyphen), "Jaeger-LeCoultre" (canonical),
    # "Jaeger  LeCoultre" (double space), "LeCoultre" alone (historic),
    # "JLC" (collector shorthand). Mark 2026-05-17: noticed JLC titles
    # leaking into the "Other" bucket — alias map below + detect_brand
    # checking aliases (added 2026-05-17) catches every spelling.
    'jaeger lecoultre':   'Jaeger-LeCoultre',
    'jaeger-lecoultre':   'Jaeger-LeCoultre',
    'jaeger le coultre':  'Jaeger-LeCoultre',
    'jaegerlecoultre':    'Jaeger-LeCoultre',
    'lecoultre':          'Jaeger-LeCoultre',
    'le coultre':         'Jaeger-LeCoultre',
    'jlc':                'Jaeger-LeCoultre',

    # A. Lange variants — full Maison name as canonical. detect_brand
    # returns 'A. Lange' (substring match against the BRANDS list); the
    # alias step upgrades that to the proper Maison form.
    'a. lange':           'A. Lange & Söhne',
    'a lange':            'A. Lange & Söhne',
    'a. lange & söhne':   'A. Lange & Söhne',
    'a. lange & sohne':   'A. Lange & Söhne',
    'a. lange and söhne': 'A. Lange & Söhne',
    'lange & söhne':      'A. Lange & Söhne',
    'lange & sohne':      'A. Lange & Söhne',

    # TAG Heuer — Maison's own all-caps spelling.
    'tag heuer':          'TAG Heuer',

    # Universal Genève — accent on the canonical form.
    'universal geneve':   'Universal Genève',
    'universal genève':   'Universal Genève',

    # Hermès — accent on the canonical form.
    'hermes':             'Hermès',
    'hermès':             'Hermès',

    # Tiffany & Co.
    'tiffany & co.':      'Tiffany & Co.',
    'tiffany & co':       'Tiffany & Co.',
    'tiffany and co.':    'Tiffany & Co.',
    'tiffany and co':     'Tiffany & Co.',

    # Girard-Perregaux — hyphenated canonical.
    'girard-perregaux':   'Girard-Perregaux',
    'girard perregaux':   'Girard-Perregaux',

    # Ulysse Nardin — fixes the "Ulysee" typo too.
    'ulysse nardin':      'Ulysse Nardin',
    'ulysee nardin':      'Ulysse Nardin',

    # Franck Muller variants — collapsed before the EXCLUDED_BRANDS
    # check below so typo'd rows ("Frank Muller") get filtered out too.
    'frank muller':       'Franck Muller',
    'franck muller':      'Franck Muller',
    'franck-muller':      'Franck Muller',

    # Vacheron variants — Maison's modern name is the canonical;
    # "Vacheron & Constantin" is the historic 19th-century lockup
    # but Mark + most collectors treat them as one filter. Bare
    # "Vacheron" added 2026-05-05 — turned up as its own filter
    # chip with 2 listings.
    'vacheron':                'Vacheron Constantin',
    'vacheron constantin':     'Vacheron Constantin',
    'vacheron-constantin':     'Vacheron Constantin',
    'vacheron & constantin':   'Vacheron Constantin',
    'vacheron and constantin': 'Vacheron Constantin',

    # Doxa: dealer scrapers ship a mix of "Doxa" and "DOXA".
    # canonicalize_brand is case-insensitive on the lookup side,
    # so this entry collapses both onto the title-cased canonical.
    'doxa':                  'Doxa',

    # Nivada Grenchen / Croton — same Swiss maker, sold under the
    # Croton name in the US through the 1960s. Mark wants every
    # variant filed under one chip.
    'nivada':                'Nivada Grenchen',
    'nivada grenchen':       'Nivada Grenchen',
    'nivada-grenchen':       'Nivada Grenchen',
    'croton':                'Nivada Grenchen',

    # Favre-Leuba is the canonical hyphenated form (already in
    # BRANDS). Catch the unhyphenated variant.
    'favre leuba':           'Favre-Leuba',

    # Gerald Genta variants — the maison spells with a single
    # consonant; some scraper rows / dealer titles drift to
    # "Genta" alone or with extra spacing.
    'gerald genta':          'Gerald Genta',
    'genta':                 'Gerald Genta',

    # Bulgari is the brand's own spelling on most products;
    # "Bvlgari" is the Latin lockup the maison also uses. Treating
    # them as one for filter purposes.
    'bvlgari':               'Bulgari',
}


# Brands we never want in the user-facing feed. Matched after
# canonicalize_brand so any spelling variant gets caught. Lowercase;
# canonical name (post-canonicalize_brand) is checked case-insensitively.
# 2026-05-05: Mark added Corum (low quality / not interesting to him)
# and Scatola Del Tempo (these are watch boxes from Craft & Tailored,
# not actual watches — kept showing up as a brand chip on its own).
EXCLUDED_BRANDS = {
    'Franck Muller', 'Hublot', 'Gucci', 'Harry Winston',
    'Corum', 'Scatola Del Tempo',
}


# Standalone bracelet / strap listings we want to filter out at
# scrape-merge time. Wind Vintage in particular sells vintage Gay
# Frères bracelets as their own listings — interesting inventory
# but not watches. Pattern: title starts with a width measurement
# (`<digits>mm`) AND contains "bracelet". Watches that come "on
# Bracelet" don't lead with a width, so they pass through.
# Verified 2026-05-05 against the active feed: 58 hits, 0 false
# positives in the matched set. False-NEGATIVE risk (a real watch
# whose title starts with mm) is acceptable — those would be
# unusual titles anyway and any watch that slips through still
# costs nothing to leave in.
BRACELET_TITLE_PATTERN = re.compile(
    r'^\s*\d+(?:\.\d+)?\s?mm\b.*\bbracelet\b',
    re.IGNORECASE,
)

# Per-model exclusions — title patterns Mark explicitly doesn't want
# in the feed regardless of brand. Audemars Piguet stays as a brand;
# the Royal Oak Offshore sub-line specifically gets filtered out
# (Mark 2026-05-05). Whitespace-tolerant so "Royal Oak Offshore",
# "Royal-Oak Offshore", "Royal  Oak Offshore" all match.
EXCLUDED_TITLE_PATTERNS = [
    re.compile(r'\broyal[\s\-]+oak[\s\-]+offshore\b', re.IGNORECASE),
]


def canonicalize_brand(brand):
    """Map any known variant of a brand name to its canonical form.

    Idempotent — passing an already-canonical brand returns it
    unchanged. Whitespace runs collapse, case is ignored, and
    apostrophes/diacritics are stripped before lookup so e.g.
    "Jaeger  LeCoultre" with extra spaces still hits the alias map.
    """
    if not brand:
        return brand
    key = re.sub(r'\s+', ' ', brand).strip().lower()
    return BRAND_ALIASES.get(key, brand)


# Set of brand strings we trust as legitimate. Anything outside this
# set that comes through a scraper's brand column (e.g. dealer names
# like "Oliver & Clarke Vintage Watches", "Collectors Corner NY",
# "bulangandsons-backend" — Shopify vendor leaks) gets overridden by
# title-derived detect_brand. Built lazily after BRAND_ALIASES is
# defined so canonical alias values are also accepted.
KNOWN_BRANDS_SET = (
    set(BRANDS)
    | {b.strip() for b in BRAND_ALIASES.values()}
    | {'Other'}  # Treat literal "Other" as known so we don't loop on it.
)

FX = {'GBP': 1.27, 'EUR': 1.08, 'CHF': 1.13, 'JPY': 0.0067, 'CNY': 0.14, 'HKD': 0.128, 'DKK': 0.145, 'USD': 1.0}

# Disappearance debounce (B-15). A listing must be ABSENT from this many
# consecutive runs before it flips to sold. 1 = the old behavior, where a
# single empty/failed scrape (a dealer 503, an empty-but-HTTP-200 catalog, a
# truncated page) marked an entire source SOLD — permanently, in the archive,
# with no alert because every workflow step is continue-on-error. 2 rides out a
# single bad run; genuine sellouts still surface on the next run (~hours at
# 3×/day). Raise it for more grace during longer outages, at the cost of
# slower sold-detection. See BUGS.md B-15 / docs/audits/2026-05-24-vibe-code.
DISAPPEARANCE_MISS_THRESHOLD = 2

STATE_PATH = 'public/state.json'
LISTINGS_PATH = 'public/listings.json'
# Frontend live/sold split. listings.json stays the canonical full file
# (backend tools — verify_sources, reference matcher, health — and any
# stale-cached PWA bundle still read it). The frontend reads these two
# instead: listings_live.json eager (critical render path), then
# listings_sold.json lazy after first paint. live+sold partition the same
# `enriched` array by the `sold` flag, so concatenating them == listings.json.
LISTINGS_LIVE_PATH = 'public/listings_live.json'
LISTINGS_SOLD_PATH = 'public/listings_sold.json'
LISTINGS_DESC_PATH = 'public/listings_desc.json'
AUCTIONS_PATH = 'public/auctions.json'
AUCTIONS_STATE_PATH = 'public/auctions_state.json'
# PT-anchored date so firstSeen/lastSeen/priceHistory align with Mark's
# local day. The cron is already PT-scheduled (6am + 7pm PT) — using
# UTC here meant the evening run wrote tomorrow's date, inflating "new
# today" counts the next morning. zoneinfo handles DST automatically.
TODAY = datetime.now(ZoneInfo("America/Los_Angeles")).date().isoformat()


def detect_brand(name):
    """Find a canonical brand by substring-matching the title.

    Walks BRANDS in order first (priority preserved — Grand Seiko
    before Seiko, Tag Heuer before Heuer), then falls back to
    BRAND_ALIASES keys. The alias-key pass catches accent / hyphen /
    spacing variants the canonical BRANDS list doesn't lexically
    include — "Jaeger LeCoultre" (no hyphen), "Universal Genève"
    (grave when BRANDS has "Universal Geneve"), "JLC" shorthand, etc.

    Normalises whitespace + case before matching so quirks like
    double-spaces ("Jaeger  LeCoultre") match cleanly. Mark report
    2026-05-17 found JLC + UG titles leaking into the "Other"
    bucket because of these spelling mismatches.
    """
    n = re.sub(r'\s+', ' ', name).strip().lower()
    for b in BRANDS:
        if b.lower() in n:
            return b
    for alias_key, canonical in BRAND_ALIASES.items():
        if alias_key in n:
            return canonical
    return 'Other'


def clean(s):
    s = re.sub(r'&#[0-9]+;', '', s)
    s = re.sub(r'&amp;', '&', s)
    s = re.sub(r'&[a-z]+;', '', s)
    return s.strip()


def parse_bool(v):
    return str(v).lower() in ('true', '1', 'yes')


def normalize_url(url):
    """Strip scheme, query, trailing slash, lowercase. Same listing -> same key."""
    if not url:
        return ''
    url = url.strip().lower()
    url = re.sub(r'^https?://', '', url)
    url = url.split('?')[0].split('#')[0]
    return url.rstrip('/')


def stable_id(url, fallback_key=''):
    """12-char hash of normalized URL. Fallback to source+title for URL-less rows."""
    key = normalize_url(url) or fallback_key
    return hashlib.sha1(key.encode('utf-8')).hexdigest()[:12]


def load_state():
    if not os.path.exists(STATE_PATH):
        return {}
    try:
        with open(STATE_PATH) as f:
            return json.load(f)
    except Exception as e:
        print(f"  WARNING: could not read {STATE_PATH}: {e}. Starting fresh.")
        return {}


def save_state(state):
    os.makedirs('public', exist_ok=True)
    with open(STATE_PATH, 'w') as f:
        json.dump(state, f, separators=(',', ':'), sort_keys=True)


def split_live_sold(enriched):
    """Partition the enriched listings into (live, sold) by the `sold` flag.
    The frontend fetches live eager and sold lazy; concatenating the two
    reproduces listings.json exactly (order within each half preserved)."""
    live = [it for it in enriched if not it.get('sold')]
    sold = [it for it in enriched if it.get('sold')]
    return live, sold


def load_csv(path, source_name, currency='USD'):
    """Return list of partial listing dicts from one scraper CSV."""
    items = []
    if not os.path.exists(path):
        print(f"  WARNING: {path} not found, skipping")
        return items
    with open(path, encoding='utf-8') as f:
        for r in csv.DictReader(f):
            try:
                price = int(r.get('price', 0))
            except (ValueError, TypeError):
                continue
            price_on_request = parse_bool(r.get('priceOnRequest', False))
            # Price floor exists to drop obvious parse errors (a $5 listing
            # is almost always a bug, not a real watch). priceOnRequest
            # listings legitimately have price=0 — let those through.
            if price < 500 and not price_on_request:
                continue
            title = clean(r.get('title', ''))
            # Standalone bracelet / strap listings — kept off the
            # feed at merge time. Pattern + rationale in the
            # BRACELET_TITLE_PATTERN definition. Most affected:
            # Wind Vintage's Gay Frères inventory.
            if BRACELET_TITLE_PATTERN.search(title):
                continue
            # Per-model title exclusions — see EXCLUDED_TITLE_PATTERNS.
            if any(p.search(title) for p in EXCLUDED_TITLE_PATTERNS):
                continue
            url = r.get('url', '')
            # Per-row currency support: eBay's Browse API returns
            # listings priced in their seller's native currency, so the
            # eBay CSV emits one row per (item, currency) and we honor
            # the per-row value. Existing dealer scrapers don't write
            # this column → fall back to the source default. Same FX
            # table either way.
            row_currency = (r.get('currency') or '').strip().upper()
            effective_currency = row_currency if row_currency in FX else currency
            rate = FX.get(effective_currency, 1.0)
            # Prefer the scraper's brand column when it's set to a known
            # brand or a non-"Other" value — most scrapers fill this from
            # the title (same regex as detect_brand) but Hairspring and
            # similar sources can set it from structured data the title
            # alone wouldn't reveal. Fall back to title-based detection
            # when the column is missing or "Other".
            # Brand resolution with a dealer-name-leak guard. Trust
            # the scraper's value when it's a known brand (Hairspring
            # passes Czapek/Urwerk from structured data the title
            # alone wouldn't reveal). Fall back to title-derived
            # detection when the scraper's value is unrecognised — that
            # catches cases where the scraper accidentally passed the
            # dealer's own store name (Shopify "vendor" field leak):
            # "Oliver & Clarke Vintage Watches", "Collectors Corner NY",
            # "bulangandsons-backend" all came in via this path.
            scraped_brand = canonicalize_brand((r.get('brand') or '').strip())
            title_brand = detect_brand(title)
            if scraped_brand and scraped_brand in KNOWN_BRANDS_SET and scraped_brand != 'Other':
                brand = scraped_brand
            elif title_brand != 'Other':
                brand = title_brand
            else:
                brand = scraped_brand or 'Other'
            brand = canonicalize_brand(brand)
            # Drop excluded brands entirely — never reach the feed.
            # Mark removed Franck Muller from the lineup; if the source
            # CSV still ships rows tagged that way, skip them here so
            # the scraper code itself doesn't need per-source patches.
            if brand in EXCLUDED_BRANDS:
                continue
            desc_full = r.get('description', '') or ''
            structured = parse_dealer_description(source_name, desc_full)
            item = {
                'id': stable_id(url, fallback_key=f"{source_name}|{title}"),
                'brand': brand,
                'ref': title,
                'price': price,
                'currency': effective_currency,
                'priceUSD': round(price * rate),
                'source': source_name,
                'url': url,
                'img': r.get('img', ''),
                'sold': parse_bool(r.get('sold', False)),
                'priceOnRequest': price_on_request,
                # `desc` carries the full dealer-description text (up
                # to 1500 chars). Kept on the item DURING merge so
                # process_listings can extract it into the separate
                # public/listings_desc.json sidecar — then zeroed out
                # on the in-memory item before listings.json is written
                # (per PR #437 the field stays empty in the wire
                # payload). The sidecar is lazy-loaded by the frontend
                # so users who heart a dealer listing get its
                # description preserved in the Supabase snapshot, even
                # after the dealer pulls the page.
                'desc': desc_full[:1500],
            }
            # Spread structured fields (reference_no, model_name, year,
            # material, case_size, dial, movement, etc.) only when the
            # per-dealer parser found them. Same key vocabulary as the
            # auction_lot_parsers output so the frontend / reference
            # matcher sees one shape across surfaces.
            for k, v in structured.items():
                if v:
                    item[k] = v
            # Reference-index match — picks up model / sub_model /
            # model_line / reference_id when brand+ref or title hits
            # the curated index. Layered after dealer_parsers so the
            # dealer's structured field wins when both fire; matcher
            # fills the rest.
            enrich_with_reference_match(item)
            items.append(item)
    return items


def _build_live_from_cache(sid, entry):
    """Reconstruct a still-live listing row from cached state fields, for an
    item that's missing from THIS run's scrape but hasn't yet crossed the
    disappearance threshold (B-15 debounce). Lets a held listing keep showing
    in the live feed (last-known-good) during a transient/failed scrape instead
    of vanishing then reappearing. Returns None when the entry lacks enough
    cached data to render or its brand is excluded."""
    if not entry.get('lastTitle'):
        return None
    history = entry.get('priceHistory') or []
    last_price = history[-1]['price'] if history else 0
    currency = history[-1].get('currency') if history else entry.get('lastCurrency', 'USD')
    brand = canonicalize_brand(entry.get('lastBrand') or detect_brand(entry.get('lastTitle', '')))
    if brand in EXCLUDED_BRANDS:
        return None
    rate = FX.get(currency, 1.0)
    prices = [h.get('price') or 0 for h in history]
    peak = max(prices) if prices else last_price
    last_meaningful = next(
        (h['price'] for h in reversed(history) if (h.get('price') or 0) > 0),
        last_price,
    )
    row = {
        'id':            sid,
        'brand':         brand,
        'ref':           entry.get('lastTitle', ''),
        'price':         last_price,
        'currency':      currency,
        'priceUSD':      round(last_price * rate),
        'lastMeaningfulPrice': last_meaningful,
        'source':        entry.get('lastSource', ''),
        'url':           entry.get('lastUrl', ''),
        'img':           entry.get('lastImg', ''),
        'desc':          '',
        'sold':          False,
        'soldAt':        None,
        'firstSeen':     entry.get('firstSeen', ''),
        'lastSeen':      entry.get('lastSeen', ''),
        'priceHistory':  history,
        'priceChange':   0,
        'priceDropTotal': max(0, peak - last_price),
        'pricePeak':     peak,
        'priceDropAt':   entry.get('priceDropAt'),
    }
    enrich_with_reference_match(row)
    return row


def update_state(items, state):
    """Enrich each item with firstSeen/lastSeen/priceHistory and update state in place.

    Returns a list of dicts covering BOTH currently-active listings (from `items`)
    and inactive/sold listings reconstructed from state — so the downstream
    listings.json can serve both the Feed and the Archive tab off one file.
    """
    seen_today = set()
    enriched = []

    for it in items:
        sid = it['id']
        seen_today.add(sid)
        entry = state.get(sid)

        if entry is None:
            # First time we've seen this listing.
            entry = {
                'firstSeen': TODAY,
                'lastSeen':  TODAY,
                'priceHistory': [{'date': TODAY, 'price': it['price'], 'currency': it['currency']}],
                'active':     True,
            }
        else:
            entry['lastSeen'] = TODAY
            entry['active'] = True
            # Append to price history only when price changes.
            history = entry.get('priceHistory') or []
            last_price = history[-1]['price'] if history else None
            if last_price != it['price']:
                history.append({'date': TODAY, 'price': it['price'], 'currency': it['currency']})
            entry['priceHistory'] = history

        # Track when an active listing flips to sold/reserved (Wind Vintage
        # marks its "on hold" items as sold=true). We treat reserved as sold
        # for archive purposes. Preserve the first date we noticed; clear
        # when the listing goes back to available.
        if it['sold']:
            if not entry.get('soldAt'):
                entry['soldAt'] = TODAY
        else:
            entry.pop('soldAt', None)

        # Always cache latest display fields on every seen run so the Archive
        # can render the listing after it disappears from source sites.
        entry['lastSource']   = it['source']
        entry['lastUrl']      = it['url']
        entry['lastTitle']    = it['ref']
        entry['lastBrand']    = it['brand']
        entry['lastImg']      = it['img']
        entry['lastCurrency'] = it['currency']

        # Seen this run → reset the disappearance debounce counter.
        entry.pop('missCount', None)

        state[sid] = entry

        history = entry['priceHistory']
        # Last-step change: most recent transition (just the latest move).
        price_change = 0
        if len(history) >= 2:
            price_change = history[-1]['price'] - history[-2]['price']

        # Cumulative drop from peak: total price reduction since the
        # listing's highest historical price. Positive number means
        # "this much cheaper than it's ever been at." 0 = no drop, or
        # currently at peak. Used by the frontend to surface big-mover
        # items at the top of the listings grid and show a chip like
        # "↓ $800" reflecting two consecutive $400 cuts.
        prices = [h.get('price') or 0 for h in history]
        price_peak = max(prices) if prices else (it.get('price') or 0)
        price_drop_total = max(0, price_peak - (it.get('price') or 0))

        # Date of the most recent step where price decreased. Lets the
        # sort bubble freshly-cut items back to the top even if firstSeen
        # is old.
        price_drop_at = None
        for h_prev, h_now in zip(history, history[1:]):
            if (h_now.get('price') or 0) < (h_prev.get('price') or 0):
                price_drop_at = h_now.get('date')
        # Persist on the state entry so it survives across runs even
        # when no new drop happens this run.
        if price_drop_at:
            entry['priceDropAt'] = price_drop_at
        elif 'priceDropAt' in entry:
            # Stale field cleanup — nothing if the history shows no drop.
            entry.pop('priceDropAt', None)

        # Last meaningful (non-zero) price. Surfaces a usable display
        # value for items whose CURRENT price is 0 — typically because
        # they've gone "Price on request" or "On hold" but were
        # advertised at a real price earlier. The frontend's Card
        # component had been deriving this inline by walking
        # priceHistory; baking it into the output entry means
        # consumers (Card render + future analytics) don't have to
        # re-derive. Falls back to it['price'] when no history exists,
        # which keeps the field non-null for fresh listings.
        last_meaningful_price = next(
            (h['price'] for h in reversed(history) if (h.get('price') or 0) > 0),
            (it.get('price') or 0) if (it.get('price') or 0) > 0 else 0,
        )

        enriched.append({
            **it,
            'firstSeen':    entry['firstSeen'],
            'lastSeen':     entry['lastSeen'],
            'priceHistory': history,
            'priceChange':       price_change,
            'priceDropTotal':    price_drop_total,
            'pricePeak':         price_peak,
            'priceDropAt':       entry.get('priceDropAt'),
            'lastMeaningfulPrice': last_meaningful_price,
            # soldAt is set for both Wind Vintage "on hold" items (still in
            # the live scrape but flagged reserved) and items that disappeared
            # entirely — both get archived.
            'soldAt':       entry.get('soldAt'),
        })

    # Anything in state but not seen today: debounce, then mark inactive and
    # emit as a sold listing so the Archive tab can show it.
    disappeared_this_run = 0
    held_this_run = 0
    archived_count = 0
    for sid, entry in state.items():
        if sid in seen_today:
            continue

        if entry.get('active'):
            # B-15 debounce. A single missing run is almost always a
            # transient/failed scrape — a dealer 503, an empty-but-HTTP-200
            # catalog, a truncated page — NOT a genuine sellout. Flipping to
            # sold on the first miss let one bad scrape mark an entire source
            # SOLD (permanently, in the archive). Hold the listing live —
            # re-emitting last-known-good from cache — until it's been absent
            # for DISAPPEARANCE_MISS_THRESHOLD consecutive runs. A seen run
            # resets the counter, so an every-other-run flap never flips.
            miss = entry.get('missCount', 0) + 1
            if miss < DISAPPEARANCE_MISS_THRESHOLD:
                entry['missCount'] = miss
                held_this_run += 1
                held_row = _build_live_from_cache(sid, entry)
                if held_row is not None:
                    enriched.append(held_row)
                continue
            # Absent long enough — treat as genuinely gone.
            entry['active'] = False
            entry['soldAt'] = TODAY
            entry.pop('missCount', None)
            disappeared_this_run += 1

        # Only emit an archive row if we have enough cached display data.
        # Older state entries written before we started caching won't have
        # lastTitle — skip them silently (they'll appear once they reappear
        # in a scrape and get re-cached, or just never, which is fine).
        if not entry.get('lastTitle'):
            continue

        history = entry.get('priceHistory') or []
        last_price = history[-1]['price'] if history else 0
        currency = history[-1].get('currency') if history else entry.get('lastCurrency', 'USD')
        rate = FX.get(currency, 1.0)
        price_usd = round(last_price * rate)

        # Last non-zero price for items whose final history entry is 0
        # (item went POR / "On hold" before disappearing). Roughly 40%
        # of sold dealer items hit this — most dealers replace the
        # price label with "SOLD" on the page, so the next scrape
        # captures price=0 and the item disappears with that as its
        # final history entry. Frontend prefers this over walking
        # priceHistory inline.
        last_meaningful_price = next(
            (h['price'] for h in reversed(history) if (h.get('price') or 0) > 0),
            last_price,
        )

        archive_brand = canonicalize_brand(
            entry.get('lastBrand') or detect_brand(entry.get('lastTitle', ''))
        )
        # Excluded brands stay out of the archive feed too — Mark
        # doesn't want them surfacing in either Available or Sold.
        if archive_brand in EXCLUDED_BRANDS:
            continue

        ghost = {
            'id':            sid,
            'brand':         archive_brand,
            'ref':           entry.get('lastTitle', ''),
            'price':         last_price,
            'currency':      currency,
            'priceUSD':      price_usd,
            'lastMeaningfulPrice': last_meaningful_price,
            'source':        entry.get('lastSource', ''),
            'url':           entry.get('lastUrl', ''),
            'img':           entry.get('lastImg', ''),
            'desc':          '',
            'sold':          True,
            'soldAt':        entry.get('soldAt') or entry.get('lastSeen', ''),
            'firstSeen':     entry.get('firstSeen', ''),
            'lastSeen':      entry.get('lastSeen', ''),
            'priceHistory':  history,
            'priceChange':   0,
        }
        # Re-run the reference-index matcher on ghost-sold rows too.
        # Mark feedback 2026-05-20: 9 sold Tudor Submariners had
        # model_line=null because they were last scraped before
        # enrich_with_reference_match was wired into merge.py (#378,
        # 2026-05-19). The dealer scraper doesn't re-emit them (they're
        # gone from the dealer's site), so the in-CSV enrichment never
        # runs for them. This second pass catches them via the
        # archived title + cached brand. Cheap (in-process, no API).
        enrich_with_reference_match(ghost)
        enriched.append(ghost)
        archived_count += 1

    if disappeared_this_run:
        print(f"  {disappeared_this_run} listings disappeared from scrape this run (marked sold)")
    if held_this_run:
        print(f"  {held_this_run} missing listings held live (disappearance debounce — likely a failed/partial scrape)")
    if archived_count:
        print(f"  {archived_count} sold/inactive listings emitted to archive")

    # Backfill detection: if a single source suddenly contributes ≥10 listings
    # whose firstSeen == TODAY, those almost certainly aren't genuinely new
    # inventory — more likely a scraper change picked up listings that were
    # already on the dealer's site (e.g. the Wind Vintage bracelet filter
    # being relaxed picked up ~107 listings in one run). Tag them so the
    # frontend doesn't show NEW badges for the bulk.
    new_per_source = {}
    for e in enriched:
        if e.get('firstSeen') == TODAY and not e.get('sold'):
            new_per_source[e['source']] = new_per_source.get(e['source'], 0) + 1
    backfilled_sources = {s for s, c in new_per_source.items() if c >= 10}
    if backfilled_sources:
        for src in backfilled_sources:
            print(f"  Backfill detected: {src} ({new_per_source[src]} listings first seen today)")
        for e in enriched:
            if (e.get('firstSeen') == TODAY
                and e['source'] in backfilled_sources
                and not e.get('sold')):
                e['backfilled'] = True
                # Also persist on the state entry so it survives re-runs.
                if e['id'] in state:
                    state[e['id']]['backfilled'] = True
    # Carry forward an existing backfilled flag from previous runs.
    for e in enriched:
        if not e.get('backfilled') and e['id'] in state and state[e['id']].get('backfilled'):
            e['backfilled'] = True

    return enriched


# The dealer source table: (csv path, display name, source-default currency).
# Module-level so other tools can consume it as the single source of truth
# rather than keeping a parallel copy that silently drifts —
# source_freshness.py reads it to know which sources are expected to exist.
# process_listings() below is the only writer of the merged feed.
LISTING_SOURCES = [
    ('data/windvintage.csv',          'Wind Vintage',          'USD'),
    ('data/tropicalwatch.csv',        'Tropical Watch',        'USD'),
    ('data/menta.csv',                'Menta Watches',         'USD'),
    ('data/collectorscorner.csv',     'Collectors Corner NY',  'USD'),
    ('data/falco.csv',                'Falco Watches',         'GBP'),
    ('data/pascalkarp.csv',           'Pascal Karp',           'EUR'),
    ('data/tokant.csv',               'Tokant',                'EUR'),
    ('data/romainrea.csv',            'Romain Réa',            'EUR'),
    ('data/greyandpatina.csv',        'Grey & Patina',         'USD'),
    ('data/oliverandclarke.csv',      'Oliver & Clarke',       'USD'),
    ('data/craftandtailored.csv',     'Craft & Tailored',      'USD'),
    ('data/watchbrotherslondon.csv',  'Watch Brothers London', 'GBP'),
    # Rebranded from MVV Watches to Sierra Time Co (Squarespace ->
    # Shopify, 2026-08). CSV/source key stays `mvvwatches`; only the
    # display name follows the storefront. USD confirmed on-site.
    ('data/mvvwatches.csv',           'Sierra Time Co',        'USD'),
    ('data/db1983.csv',               'DB1983',                'CHF'),
    ('data/hairspring.csv',           'Hairspring',            'USD'),
    ('data/somlo.csv',                'Somlo',                 'GBP'),
    ('data/analogshift.csv',          'Analog Shift',          'USD'),
    ('data/watchesofknightsbridge.csv', 'Watches of Knightsbridge', 'GBP'),
    ('data/belmont.csv',              'Belmont Watches',       'USD'),
    ('data/bobswatches.csv',          "Bob's Watches",         'USD'),
    ('data/watchfid.csv',             'Watchfid',              'EUR'),
    ('data/bulangandsons.csv',        'Bulang & Sons',         'EUR'),
    ('data/moonphase.csv',            'Moonphase',             'EUR'),
    ('data/huntington.csv',           'Huntington Company',    'USD'),
    ('data/thevintagewatch.csv',      'The Vintage Watch',     'USD'),
    ('data/chronoholic.csv',          'Chronoholic',           'USD'),
    ('data/vintagewatchfam.csv',      'Vintage Watch Fam',     'USD'),
    ('data/shucktheoyster.csv',       'Shuck the Oyster',      'EUR'),
    ('data/centralwatch.csv',         'Central Watch',         'USD'),
    ('data/europeanwatch.csv',        'European Watch',        'USD'),
    ('data/vintagewatchcollective.csv','Vintage Watch Collective','EUR'),
    ('data/visionvintagewatches.csv', 'Vision Vintage Watches', 'GBP'),
    ('data/watchurbia.csv',           'Watchurbia',            'EUR'),
    ('data/maunderwatches.csv',       'Maunder Watches',       'GBP'),
    ('data/watchclub.csv',            'Watch Club',            'GBP'),
    ('data/vintagewatchshop.csv',     'Vintage Watch Shop',    'GBP'),
    ('data/watchesoflancashire.csv',  'Watches of Lancashire', 'GBP'),
    ('data/heuertime.csv',            'Heuertime',             'EUR'),
    ('data/classicheuer.csv',         'ClassicHeuer',          'EUR'),
    ('data/lunaroyster.csv',          'Luna Royster',          'USD'),
    ('data/ssongwatches.csv',         'S.Song Watches',        'USD'),
    ('data/swisshours.csv',           'Swiss Hours',           'HKD'),
    ('data/watchcenter.csv',          'Watch Center',          'CHF'),
    # eBay is multi-currency by design — the source-default 'USD'
    # is just a fallback for rows where the per-row `currency`
    # column is missing or unrecognized. Each Browse API result
    # carries its own currency in the CSV.
    ('data/ebay.csv',                 'eBay',                  'USD'),
]


def process_listings():
    """The listings half of the pipeline. Loads every dealer CSV, merges
    against state.json (firstSeen / priceHistory / sold detection),
    writes public/listings.json. Independent of the auctions pipeline."""
    sources = LISTING_SOURCES

    state = load_state()
    state_size_before = len(state)

    all_items = []
    for path, name, currency in sources:
        items = load_csv(path, name, currency)
        print(f"  {name}: {len(items)} listings")
        all_items.extend(items)

    # Dedupe within this run (same stable ID across sources/duplicates in one CSV).
    by_id = {}
    for it in all_items:
        by_id[it['id']] = it
    if len(by_id) != len(all_items):
        print(f"  Deduped {len(all_items) - len(by_id)} duplicate ID(s) within this run")
    all_items = list(by_id.values())

    enriched = update_state(all_items, state)

    # Count how many are genuinely new today (firstSeen == TODAY).
    new_today = sum(1 for e in enriched if e['firstSeen'] == TODAY)
    price_drops = sum(1 for e in enriched if e['priceChange'] < 0)

    print(f"\nTotal: {len(enriched)} listings")
    print(f"  State entries: {state_size_before} -> {len(state)}")
    print(f"  First seen today: {new_today}")
    print(f"  Price drops this run: {price_drops}")

    os.makedirs('public', exist_ok=True)
    # Sidecar: id → description for the frontend's heart handler to
    # hydrate before writing listing_snapshot. Built BEFORE we zero
    # `desc` on the in-memory items so the main listings.json wire
    # payload stays slim (PR #437). Frontend lazy-loads this file
    # after first paint so it's never on the critical render path.
    desc_map = {it['id']: it['desc'] for it in enriched if it.get('desc')}
    with open(LISTINGS_DESC_PATH, 'w') as f:
        json.dump(desc_map, f, separators=(',', ':'))
    for it in enriched:
        it['desc'] = ''
    with open(LISTINGS_PATH, 'w') as f:
        json.dump(enriched, f, separators=(',', ':'))
    # Frontend live/sold split (see path constants). Partition by `sold`;
    # the two files concatenated reproduce listings.json exactly.
    live, sold = split_live_sold(enriched)
    with open(LISTINGS_LIVE_PATH, 'w') as f:
        json.dump(live, f, separators=(',', ':'))
    with open(LISTINGS_SOLD_PATH, 'w') as f:
        json.dump(sold, f, separators=(',', ':'))
    save_state(state)
    print(f"Written {LISTINGS_PATH} ({len(enriched)} items: "
          f"{len(live)} live + {len(sold)} sold) and "
          f"{LISTINGS_DESC_PATH} ({len(desc_map)} descriptions) and {STATE_PATH}")


def main():
    """CLI entry. Default behavior runs both halves of the pipeline.
    Flags let the GitHub Actions workflows pick just the half they care
    about: scrape-listings.yml runs --listings-only, scrape-auctions.yml
    runs --auctions-only."""
    import sys
    args = sys.argv[1:]
    do_listings = ('--auctions-only' not in args)
    do_auctions = ('--listings-only' not in args)
    if do_listings:
        process_listings()
    if do_auctions:
        # Separate, much smaller data pipeline — different semantics
        # (status from dates, no price history, no NEW badge).
        process_auctions()


# ── AUCTIONS ──────────────────────────────────────────────────────────────────

def load_json(path, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


# Catalog-level exclusions: drop ENTIRE non-watch sales (jewels / art /
# spy memorabilia that carry a few watch lots) from the auction calendar.
# Applied in process_auctions() both when upserting CSV rows into the
# registry and when emitting auctions.json, so a blocklisted sale never
# surfaces and any stale registry entry stops being emitted.
# LOCKSTEP: auction_lots_scraper.py holds the same list for the LOT
# scrapers (it can't be imported here — it pulls `requests`, absent from
# the pytest env). Keep the two in sync — same convention as BRAND_ALIASES.
EXCLUDE_CATALOG_TITLES = [
    "Noble & Private Collections",   # Sotheby's L26035 — jewels/art, 245 lots
    "Espionage: Fact & Fiction",     # Bonhams 32384 — spy memorabilia
    "Fine Jewelry",                  # Sotheby's L26050 — jewels (~6 watches in ~225 lots);
                                     # recurring Sotheby's sale name, all non-watch
    "Artistic Luxury",               # Sotheby's N12xxx — Fabergé/gold boxes/silver/ceramics (Mark 2026-06-13)
    "Maurice Tempelsman",            # Sotheby's "A Marvelous Journey: The Collection of…" — jewels/objets (Mark 2026-06-13)
]
# URL-slug blocklist — the calendar sometimes carries a MISLEADING title: the
# Sotheby's L26050 jewels sale is cross-listed in the watches category with the
# generic title "Fine Watches" but a `…/fine-jewelry-l26050` URL. Title alone
# can't catch it, so also block by URL slug. Any path containing one of these is
# a non-watch sale. (LOCKSTEP with auction_lots_scraper.py — keep in sync.)
EXCLUDE_CATALOG_URL_SLUGS = ["fine-jewelry", "jewels", "jewellery", "jewelry"]


def is_excluded_catalog(title, url=""):
    """True iff the SALE/catalog is a blocklisted non-watch sale —
    by title OR by URL slug (the calendar title can be misleading)."""
    t = (title or "").lower()
    if any(x.lower() in t for x in EXCLUDE_CATALOG_TITLES):
        return True
    u = (url or "").lower()
    return any(x in u for x in EXCLUDE_CATALOG_URL_SLUGS)


def auction_id(house, date_start, title):
    """Stable hash so the same auction keeps the same key across runs."""
    key = f"{house}|{date_start}|{title}".lower()
    return hashlib.sha1(key.encode('utf-8')).hexdigest()[:12]


def auction_status(date_start, date_end, today=TODAY):
    if not date_start:
        return 'upcoming'  # unknown date, assume not yet
    end = date_end or date_start
    if today > end:
        return 'past'
    if today >= date_start:
        return 'live'
    return 'upcoming'


# Past auctions are kept in the emitted feed indefinitely so the
# Archive section in AuctionCalendar can surface them — these are
# the same auctions whose lots end up in the sold-archive view.
# 2026-05-10: the previous 30-day prune was dropped per Mark spec.
# State entries already persisted indefinitely.


def _days_since(date_str, today=TODAY):
    """Return the number of days from `date_str` to `today`, or None
    if either date is unparseable. Negative if `date_str` is in the
    future."""
    if not date_str:
        return None
    try:
        from datetime import datetime as _dt
        d  = _dt.strptime(date_str, '%Y-%m-%d').date()
        td = _dt.strptime(today,    '%Y-%m-%d').date()
        return (td - d).days
    except (ValueError, TypeError):
        return None


def emit_auction_status(date_start, date_end, hint, today=TODAY):
    """The status auctions.json emits for one registry entry: trust the
    scraper's statusHint when present, else derive from dates — THEN apply a
    date-sanity override.

    The override matters because statusHint is frozen in the registry from the
    last scrape that touched the row. A 'live' OR 'upcoming' hint can't outlast
    the sale's end date: Bonhams recycles its weekly-sale ids, so a long-closed
    "Weekly Watches" sale stays flagged 'upcoming' forever otherwise (B-78,
    2026-06-18). Once the end date has passed, the sale is 'past' regardless of
    the stale hint. Past sales are still emitted (kept indefinitely for the
    Archive) — this only fixes their bucket, it doesn't drop them.
    """
    status = hint if hint in ('live', 'upcoming', 'past') else auction_status(date_start, date_end, today)
    end = date_end or date_start
    if end:
        ds = _days_since(end, today)
        if ds is not None and ds > 0 and status in ('live', 'upcoming'):
            status = 'past'
    return status


def superseded_auction_ids(state):
    """Registry ids of sales that were RESCHEDULED: a newer entry from the
    same house, city and sale title replaced it on the house calendar.

    The registry keys on (house, dateStart, title), so a date change mints a
    new entry and the old one lingers forever. Antiquorum moved its New York
    sale Jul 18 -> Sep 15 -> Oct 18 and its Hong Kong sale Nov 29 -> Nov 28,
    leaving two "past" sales that never happened and a duplicate upcoming one.

    Deliberately narrow: the old entry must have left the calendar BEFORE its
    own sale date, never had a catalog, and a same-house/city/title entry must
    have appeared once it left and still be listed after. A sale that simply
    ran and dropped off keeps being emitted (the Archive needs it).
    """
    out = set()
    for aid, e in state.items():
        last = e.get('lastSeen') or ''
        start = e.get('dateStart') or ''
        if not (last and start and last < start) or e.get('catalogLiveAt'):
            continue
        key = (e.get('house'), e.get('title'), (e.get('location') or '').lower())
        for oid, o in state.items():
            if oid == aid:
                continue
            if (o.get('house'), o.get('title'), (o.get('location') or '').lower()) != key:
                continue
            if (o.get('firstSeen') or '') >= last and (o.get('lastSeen') or '') > last:
                out.add(aid)
                break
    return out


def process_auctions():
    """Build public/auctions.json from public/auctions_state.json (the
    registry of every auction we've ever seen) — NOT just from the
    current scrape. Mark spec 2026-05-11: "I want auction sales to be
    kept with price permanently". Without registry-driven emission, a
    sale falling out of any per-house calendar scrape (Phillips drops
    past sales from /watches; Antiquorum reverts to a generic URL once
    a sale ends; etc.) would disappear from auctions.json on the next
    run, taking its lot enumeration trigger with it.

    Flow:
      1. Read every data/*_auctions.csv. For each row, upsert a full
         entry into the registry — house, title, location, dates, URL,
         hasCatalog, statusHint, firstSeen, lastSeen, catalogLiveAt.
         Old fields preserved unless the new scrape supersedes them.
      2. Walk the WHOLE registry (not just rows present in this run's
         CSVs) to build the auctions array. Recompute status fresh
         off dates + statusHint so a sale that was 'live' yesterday
         is now 'past' today even if no scrape re-touched its row.
      3. Drop registry entries lacking the bare minimum (house + title)
         — happens when the schema was extended after the row landed.
    """
    import glob
    auction_csvs = sorted(glob.glob('data/*_auctions.csv'))

    state = load_json(AUCTIONS_STATE_PATH, {})
    state_before = len(state)
    seen_in_run = 0

    # --- Pass 1: upsert current CSV rows into the registry ----------------
    for path in auction_csvs:
        with open(path, encoding='utf-8') as f:
            rows = list(csv.DictReader(f))
        print(f"  auctions: {path}: {len(rows)} row(s)")
        for r in rows:
            house      = clean(r.get('house', ''))
            title      = clean(r.get('title', ''))
            location   = clean(r.get('location', ''))
            date_start = r.get('date_start', '') or ''
            date_end   = r.get('date_end', '') or ''
            date_label = r.get('date_label', '')
            url        = r.get('url', '')
            image      = (r.get('image') or '').strip()

            if not house or not title:
                continue
            # Catalog-level exclusion: never let a blocklisted non-watch
            # sale into the registry (so it stops being refreshed/re-added).
            if is_excluded_catalog(title, url):
                continue

            aid = auction_id(house, date_start or title, title)
            entry = state.get(aid) or {}
            seen_in_run += 1

            # Catalog-live signal: trust the scraper's explicit flag
            # when present; heuristic otherwise.
            raw_flag = (r.get('has_catalog') or '').strip().lower()
            if raw_flag in ('true', 'false'):
                has_real_catalog = raw_flag == 'true'
            else:
                generic_catalog = url.rstrip('/').endswith(('antiquorum.swiss/catalog', 'catalog.antiquorum.swiss'))
                has_real_catalog = bool(url) and not generic_catalog
            if has_real_catalog and not entry.get('catalogLiveAt'):
                entry['catalogLiveAt'] = TODAY

            # Upsert full sale identity into the registry. Preserve
            # firstSeen; everything else is a "latest known" snapshot.
            if not entry.get('firstSeen'):
                entry['firstSeen'] = TODAY
            entry['lastSeen']   = TODAY
            entry['house']      = house
            entry['title']      = title
            entry['location']   = location
            entry['dateStart']  = date_start
            entry['dateEnd']    = date_end or date_start
            entry['dateLabel']  = date_label
            entry['lastUrl']    = url
            entry['lastTitle']  = title
            entry['hasCatalog'] = has_real_catalog
            # Sale cover image (Phase 4 cover scraping). Preserve the
            # last-known cover if a later scrape omits it (don't blank it).
            if image:
                entry['image'] = image
            # Preserve the BEST known catalog URL separately from
            # lastUrl. Per-house scrapers may revert their lastUrl to
            # a generic listings page once a sale ends (Antiquorum
            # canonical case) — without this preservation, downstream
            # lot enumeration loses the working catalog URL forever
            # on the first post-sale run. catalogUrl is only ever
            # SET (not overwritten) when has_real_catalog is true.
            if has_real_catalog and url:
                entry['catalogUrl'] = url
            hint = (r.get('status_hint') or '').strip().lower()
            if hint in ('live', 'upcoming', 'past'):
                entry['statusHint'] = hint
            state[aid] = entry

    # --- Pass 2: emit auctions.json from the FULL registry ----------------
    auctions = []
    rescheduled = superseded_auction_ids(state)
    if rescheduled:
        print(f"  auctions: hiding {len(rescheduled)} rescheduled sale(s)")
    for aid, entry in state.items():
        if aid in rescheduled:
            continue
        house = entry.get('house') or ''
        title = entry.get('title') or entry.get('lastTitle') or ''
        if not house or not title:
            # Pre-registry-expansion entries (only had firstSeen +
            # lastSeen + lastUrl/lastTitle) get backfilled the next
            # time their CSV row appears. Skip until then.
            continue
        # Catalog-level exclusion: don't emit a blocklisted non-watch sale
        # even if a stale registry entry persists from before the blocklist.
        if is_excluded_catalog(title, entry.get('url') or entry.get('lastUrl') or ''):
            continue
        date_start = entry.get('dateStart') or ''
        date_end   = entry.get('dateEnd') or date_start

        # Status: scraper hint else dates, with a date-sanity override that
        # demotes a stale 'live'/'upcoming' hint to 'past' once the sale's end
        # date has passed (B-78). See emit_auction_status.
        status = emit_auction_status(date_start, date_end, entry.get('statusHint') or '')

        auctions.append({
            # Prefer the preserved catalogUrl over lastUrl — catalogUrl
            # is the durable per-sale URL that survives the calendar
            # scraper reverting lastUrl to a generic listings page
            # after a sale ends. lastUrl remains the fallback for
            # sales that never had a confirmed catalog.
            'id':            aid,
            'house':         house,
            'title':         title,
            'location':      entry.get('location', ''),
            'dateStart':     date_start,
            'dateEnd':       date_end,
            'dateLabel':     entry.get('dateLabel', ''),
            'url':           entry.get('catalogUrl') or entry.get('lastUrl', ''),
            'hasCatalog':    bool(entry.get('hasCatalog')),
            'catalogLiveAt': entry.get('catalogLiveAt'),
            'status':        status,
            'firstSeen':     entry.get('firstSeen'),
            'image':         entry.get('image', ''),
        })

    # Sort: live first, then upcoming by start date, then past.
    status_rank = {'live': 0, 'upcoming': 1, 'past': 2}
    auctions.sort(key=lambda a: (status_rank.get(a['status'], 9), a['dateStart'] or '9999-99-99'))

    with open(AUCTIONS_PATH, 'w') as f:
        json.dump(auctions, f, separators=(',', ':'))
    with open(AUCTIONS_STATE_PATH, 'w') as f:
        json.dump(state, f, separators=(',', ':'), sort_keys=True)

    live_count = sum(1 for a in auctions if a['status'] == 'live')
    past_count = sum(1 for a in auctions if a['status'] == 'past')
    print(f"\nAuctions: {len(auctions)} emitted ({live_count} live · {past_count} past · {len(auctions)-live_count-past_count} upcoming)")
    print(f"  Registry: {state_before} entries before, {len(state)} after (this run touched {seen_in_run} via CSVs)")
    print(f"Written {AUCTIONS_PATH} and {AUCTIONS_STATE_PATH}")


if __name__ == '__main__':
    main()
