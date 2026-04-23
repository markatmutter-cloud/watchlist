#!/usr/bin/env python3
"""
Merge scraper CSVs into public/listings.json with cross-run state tracking.

State model (public/state.json):
  {
    "<stable_id>": {
      "firstSeen": "YYYY-MM-DD",
      "lastSeen":  "YYYY-MM-DD",
      "priceHistory": [{"date": "YYYY-MM-DD", "price": int, "currency": "USD"}],
      "lastSource": "Wind Vintage",
      "lastUrl":    "https://...",
      "active":     true        # False once it stops appearing in scrapes
    },
    ...
  }

Stable ID: first 12 chars of SHA1 over a normalized URL (lowercase, no scheme,
no query, no trailing slash). URL is the most durable identifier the dealers
expose. Index-based IDs (wv-0, wv-1) are not stable: a new listing at the top
shifts every other ID and breaks the watchlist.
"""
import csv, json, re, os, hashlib
from datetime import date
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

FX = {'GBP': 1.27, 'EUR': 1.08, 'JPY': 0.0067, 'CNY': 0.14, 'USD': 1.0}

STATE_PATH = 'public/state.json'
LISTINGS_PATH = 'public/listings.json'
TODAY = str(date.today())


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
            if price < 500:
                continue
            title = clean(r.get('title', ''))
            url = r.get('url', '')
            rate = FX.get(currency, 1.0)
            items.append({
                'id': stable_id(url, fallback_key=f"{source_name}|{title}"),
                'brand': detect_brand(title),
                'ref': title,
                'price': price,
                'currency': currency,
                'priceUSD': round(price * rate),
                'source': source_name,
                'url': url,
                'img': r.get('img', ''),
                'sold': parse_bool(r.get('sold', False)),
                'desc': r.get('description', '')[:300],
            })
    return items


def update_state(items, state):
    """Enrich each item with firstSeen/lastSeen/priceHistory and update state in place."""
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
                'lastSource': it['source'],
                'lastUrl':    it['url'],
                'active':     True,
            }
        else:
            entry['lastSeen'] = TODAY
            entry['lastSource'] = it['source']
            entry['lastUrl'] = it['url']
            entry['active'] = True
            # Append to price history only when price changes.
            history = entry.get('priceHistory') or []
            last_price = history[-1]['price'] if history else None
            if last_price != it['price']:
                history.append({'date': TODAY, 'price': it['price'], 'currency': it['currency']})
            entry['priceHistory'] = history

        state[sid] = entry

        history = entry['priceHistory']
        price_change = 0
        if len(history) >= 2:
            # Compare current price to the one before it in history.
            price_change = history[-1]['price'] - history[-2]['price']

        enriched.append({
            **it,
            'firstSeen':    entry['firstSeen'],
            'lastSeen':     entry['lastSeen'],
            'priceHistory': history,
            'priceChange':  price_change,   # negative = price dropped
        })

    # Anything in state but not seen today: mark inactive (groundwork for sold archive).
    disappeared = 0
    for sid, entry in state.items():
        if sid not in seen_today and entry.get('active'):
            entry['active'] = False
            disappeared += 1
    if disappeared:
        print(f"  {disappeared} listings disappeared from scrape this run (marked inactive)")

    return enriched


def main():
    sources = [
        ('data/windvintage.csv',      'Wind Vintage',         'USD'),
        ('data/tropicalwatch.csv',    'Tropical Watch',       'USD'),
        ('data/menta.csv',            'Menta Watches',        'USD'),
        ('data/collectorscorner.csv', 'Collectors Corner NY', 'USD'),
        ('data/falco.csv',            'Falco Watches',        'GBP'),
        ('data/greyandpatina.csv',    'Grey & Patina',        'USD'),
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


if __name__ == '__main__':
    main()
