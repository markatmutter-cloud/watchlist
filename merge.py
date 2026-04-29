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
      "soldAt":      "YYYY-MM-DD"              # Set when active flips false.
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

BRANDS = [
    'Rolex', 'Omega', 'Patek Philippe', 'Tudor', 'Breitling', 'IWC', 'Cartier',
    'Jaeger-LeCoultre', 'Panerai', 'Audemars Piguet', 'Vacheron Constantin',
    'A. Lange', 'Aquastar', 'Ralph Lauren', 'Seiko', 'Universal Geneve',
    # Tag Heuer must come BEFORE Heuer so substring match doesn't grab "Heuer" first.
    'Tag Heuer', 'Heuer',
    'Longines', 'Movado', 'Czapek', 'Urwerk', 'Zenith', 'Breguet',
    'Blancpain', 'Tissot', 'Gallet', 'Mulco', 'Girard-Perregaux', 'Eberhard',
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
    # JLC variants → canonical hyphenated form
    'jaeger lecoultre':   'Jaeger-LeCoultre',
    'jaeger-lecoultre':   'Jaeger-LeCoultre',
    'jaeger le coultre':  'Jaeger-LeCoultre',
    'jaegerlecoultre':    'Jaeger-LeCoultre',
    'lecoultre':          'Jaeger-LeCoultre',
    'le coultre':         'Jaeger-LeCoultre',
    # Franck Muller variants — collapsed before the EXCLUDED_BRANDS
    # check below so typo'd rows ("Frank Muller") get filtered out too.
    'frank muller':       'Franck Muller',
    'franck muller':      'Franck Muller',
    'franck-muller':      'Franck Muller',
}


# Brands we never want in the user-facing feed. Matched after
# canonicalize_brand so any spelling variant gets caught. Lowercase;
# canonical name (post-canonicalize_brand) is checked case-insensitively.
EXCLUDED_BRANDS = {'Franck Muller', 'Hublot', 'Gucci', 'Harry Winston'}


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

FX = {'GBP': 1.27, 'EUR': 1.08, 'CHF': 1.13, 'JPY': 0.0067, 'CNY': 0.14, 'USD': 1.0}

STATE_PATH = 'public/state.json'
LISTINGS_PATH = 'public/listings.json'
AUCTIONS_PATH = 'public/auctions.json'
AUCTIONS_STATE_PATH = 'public/auctions_state.json'
# PT-anchored date so firstSeen/lastSeen/priceHistory align with Mark's
# local day. The cron is already PT-scheduled (6am + 7pm PT) — using
# UTC here meant the evening run wrote tomorrow's date, inflating "new
# today" counts the next morning. zoneinfo handles DST automatically.
TODAY = datetime.now(ZoneInfo("America/Los_Angeles")).date().isoformat()


def detect_brand(name):
    for b in BRANDS:
        if b.lower() in name.lower():
            return b
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
            url = r.get('url', '')
            rate = FX.get(currency, 1.0)
            # Prefer the scraper's brand column when it's set to a known
            # brand or a non-"Other" value — most scrapers fill this from
            # the title (same regex as detect_brand) but Hairspring and
            # similar sources can set it from structured data the title
            # alone wouldn't reveal. Fall back to title-based detection
            # when the column is missing or "Other".
            scraped_brand = (r.get('brand') or '').strip()
            if scraped_brand and scraped_brand != 'Other':
                brand = scraped_brand
            else:
                brand = detect_brand(title)
            brand = canonicalize_brand(brand)
            # Drop excluded brands entirely — never reach the feed.
            # Mark removed Franck Muller from the lineup; if the source
            # CSV still ships rows tagged that way, skip them here so
            # the scraper code itself doesn't need per-source patches.
            if brand in EXCLUDED_BRANDS:
                continue
            items.append({
                'id': stable_id(url, fallback_key=f"{source_name}|{title}"),
                'brand': brand,
                'ref': title,
                'price': price,
                'currency': currency,
                'priceUSD': round(price * rate),
                'source': source_name,
                'url': url,
                'img': r.get('img', ''),
                'sold': parse_bool(r.get('sold', False)),
                'priceOnRequest': price_on_request,
                'desc': r.get('description', '')[:300],
            })
    return items


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

        enriched.append({
            **it,
            'firstSeen':    entry['firstSeen'],
            'lastSeen':     entry['lastSeen'],
            'priceHistory': history,
            'priceChange':       price_change,
            'priceDropTotal':    price_drop_total,
            'pricePeak':         price_peak,
            'priceDropAt':       entry.get('priceDropAt'),
            # soldAt is set for both Wind Vintage "on hold" items (still in
            # the live scrape but flagged reserved) and items that disappeared
            # entirely — both get archived.
            'soldAt':       entry.get('soldAt'),
        })

    # Anything in state but not seen today: mark inactive and emit as a sold
    # listing so the Archive tab can show it.
    disappeared_this_run = 0
    archived_count = 0
    for sid, entry in state.items():
        if sid in seen_today:
            continue

        # Flip to inactive on first miss, recording when it disappeared.
        if entry.get('active'):
            entry['active'] = False
            entry['soldAt'] = TODAY
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

        archive_brand = canonicalize_brand(
            entry.get('lastBrand') or detect_brand(entry.get('lastTitle', ''))
        )
        # Excluded brands stay out of the archive feed too — Mark
        # doesn't want them surfacing in either Available or Sold.
        if archive_brand in EXCLUDED_BRANDS:
            continue

        enriched.append({
            'id':            sid,
            'brand':         archive_brand,
            'ref':           entry.get('lastTitle', ''),
            'price':         last_price,
            'currency':      currency,
            'priceUSD':      price_usd,
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
        })
        archived_count += 1

    if disappeared_this_run:
        print(f"  {disappeared_this_run} listings disappeared from scrape this run (marked sold)")
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


def process_listings():
    """The listings half of the pipeline. Loads every dealer CSV, merges
    against state.json (firstSeen / priceHistory / sold detection),
    writes public/listings.json. Independent of the auctions pipeline."""
    sources = [
        ('data/windvintage.csv',          'Wind Vintage',          'USD'),
        ('data/tropicalwatch.csv',        'Tropical Watch',        'USD'),
        ('data/menta.csv',                'Menta Watches',         'USD'),
        ('data/collectorscorner.csv',     'Collectors Corner NY',  'USD'),
        ('data/falco.csv',                'Falco Watches',         'GBP'),
        ('data/greyandpatina.csv',        'Grey & Patina',         'USD'),
        ('data/oliverandclarke.csv',      'Oliver & Clarke',       'USD'),
        ('data/craftandtailored.csv',     'Craft & Tailored',      'USD'),
        ('data/watchbrotherslondon.csv',  'Watch Brothers London', 'GBP'),
        ('data/mvvwatches.csv',           'MVV Watches',           'USD'),
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
        ('data/avocadovintage.csv',       'Avocado Vintage',       'USD'),
        ('data/chronoholic.csv',          'Chronoholic',           'USD'),
        ('data/vintagewatchfam.csv',      'Vintage Watch Fam',     'USD'),
        ('data/shucktheoyster.csv',       'Shuck the Oyster',      'EUR'),
    ]

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
    with open(LISTINGS_PATH, 'w') as f:
        json.dump(enriched, f, separators=(',', ':'))
    save_state(state)
    print(f"Written {LISTINGS_PATH} and {STATE_PATH}")


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


# Days after an auction's date_end that we keep showing it on the
# calendar with a CLOSED chip. After this window the auction drops
# off the rolling calendar but its state entry sticks around for any
# future analytics surfaces.
PAST_AUCTION_RETENTION_DAYS = 30


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


def process_auctions():
    """Read every data/*_auctions.csv, enrich with firstSeen + catalogLiveAt
    from auctions_state.json, emit public/auctions.json. Past auctions are
    dropped from the emitted feed (we don't keep a sold-auction archive yet)
    but their state entries are preserved for future use.
    """
    import glob
    auction_csvs = sorted(glob.glob('data/*_auctions.csv'))
    if not auction_csvs:
        print("\nNo auction CSVs found, skipping auctions.json.")
        return

    state = load_json(AUCTIONS_STATE_PATH, {})
    state_before = len(state)
    auctions = []

    for path in auction_csvs:
        with open(path, encoding='utf-8') as f:
            rows = list(csv.DictReader(f))
        print(f"  auctions: {path}: {len(rows)} row(s)")
        for r in rows:
            house      = clean(r.get('house', ''))
            title      = clean(r.get('title', ''))
            location   = clean(r.get('location', ''))
            date_start = r.get('date_start', '')
            date_end   = r.get('date_end', '')
            date_label = r.get('date_label', '')
            url        = r.get('url', '')

            if not house or not title:
                continue

            aid = auction_id(house, date_start or title, title)
            entry = state.get(aid) or {}

            if not entry.get('firstSeen'):
                entry['firstSeen'] = TODAY
            entry['lastSeen'] = TODAY

            # Catalog-live signal: if the scraper told us explicitly via a
            # `has_catalog` column, trust it — the scraper knows best whether
            # the URL goes to a real catalog (vs a landing page or generic
            # portal). Fall back to a heuristic otherwise.
            raw_flag = (r.get('has_catalog') or '').strip().lower()
            if raw_flag in ('true', 'false'):
                has_real_catalog = raw_flag == 'true'
            else:
                generic_catalog = url.rstrip('/').endswith(('antiquorum.swiss/catalog', 'catalog.antiquorum.swiss'))
                has_real_catalog = bool(url) and not generic_catalog
            if has_real_catalog and not entry.get('catalogLiveAt'):
                entry['catalogLiveAt'] = TODAY

            entry['lastUrl']   = url
            entry['lastTitle'] = title
            state[aid] = entry

            # Prefer the scraper's explicit status hint when present
            # (e.g. Monaco Legend's "Bidding Open" = live even before
            # the auction's stated start date — pre-bidding phase).
            # Fall back to date-based derivation otherwise.
            hint = (r.get('status_hint') or '').strip().lower()
            if hint in ('live', 'upcoming', 'past'):
                status = hint
            else:
                status = auction_status(date_start, date_end)

            # Date-sanity override: hints can go stale (Monaco Legend
            # left Exclusive Timepieces 40 marked "live" on its calendar
            # for days after April 26 ended). The auction can't be live
            # past its end date, full stop.
            if (date_end or date_start) and _days_since(date_end or date_start) is not None and _days_since(date_end or date_start) > 0:
                if status == 'live':
                    status = 'past'

            # 30-day post-auction window: keep recently-finished auctions
            # on the calendar with a CLOSED chip so users can pull up
            # results, but drop them after a month so the rolling
            # calendar doesn't grow without bound. State entry is
            # preserved either way.
            if status == 'past':
                age = _days_since(date_end or date_start)
                if age is None or age > PAST_AUCTION_RETENTION_DAYS:
                    continue

            auctions.append({
                'id':            aid,
                'house':         house,
                'title':         title,
                'location':      location,
                'dateStart':     date_start,
                'dateEnd':       date_end or date_start,
                'dateLabel':     date_label,
                'url':           url,
                'hasCatalog':    has_real_catalog,
                'catalogLiveAt': entry.get('catalogLiveAt'),
                'status':        status,
                'firstSeen':     entry['firstSeen'],
            })

    # Sort: live first, then upcoming by start date
    status_rank = {'live': 0, 'upcoming': 1, 'past': 2}
    auctions.sort(key=lambda a: (status_rank.get(a['status'], 9), a['dateStart'] or '9999-99-99'))

    with open(AUCTIONS_PATH, 'w') as f:
        json.dump(auctions, f, separators=(',', ':'))
    with open(AUCTIONS_STATE_PATH, 'w') as f:
        json.dump(state, f, separators=(',', ':'), sort_keys=True)

    live_count = sum(1 for a in auctions if a['status'] == 'live')
    print(f"\nAuctions: {len(auctions)} upcoming/live ({live_count} live now)")
    print(f"  State entries: {state_before} -> {len(state)}")
    print(f"Written {AUCTIONS_PATH} and {AUCTIONS_STATE_PATH}")


if __name__ == '__main__':
    main()
