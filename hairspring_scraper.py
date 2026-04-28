#!/usr/bin/env python3
"""
Hairspring scraper - Shopify public products API.
Run: python3 hairspring_scraper.py
Requires: pip install requests
Output: hairspring_listings.csv

Only covers Hairspring's own inventory. The editorial "finds" blog at
/blogs/finds features watches from other dealers and needs a different
approach — left for later.
"""
import requests
import csv
import json
import re
import time

BASE = "https://hairspring.com"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

BRANDS = [
    'Rolex', 'Omega', 'Patek Philippe', 'Tudor', 'Breitling', 'IWC', 'Cartier',
    'Jaeger-LeCoultre', 'Panerai', 'Audemars Piguet', 'Vacheron Constantin',
    'A. Lange', 'Aquastar', 'Seiko', 'Universal Geneve', 'Heuer', 'Longines',
    'Movado', 'Czapek', 'Urwerk', 'Zenith', 'Breguet',
]


def normalize_brand(raw):
    """Map a brand string from JSON-LD to the canonical form used in
    merge.py BRANDS list. Examples: "A. Lange & Söhne" → "A. Lange",
    "Patek Philippe SA" → "Patek Philippe". Pure-string match for the
    rest, returned as-is so unknown brands ("Laurent Ferrier", "Urban
    Jürgensen") still propagate cleanly."""
    if not raw:
        return ''
    raw = raw.replace('&amp;', '&').strip()
    # First check substring against canonical BRANDS so common variants
    # (with/without trademark text, ampersand, etc.) collapse to one.
    for b in BRANDS:
        if b.lower() in raw.lower():
            return b
    return raw


# Hairspring's titles often lead with a reference number or a model
# name and omit the manufacturer entirely. When their JSON-LD also
# fails (returns "Hairspring" — the dealer's own name — or nothing),
# we fall back to this lookup. Keys are matched against the title
# substring-style (case-insensitive); first match wins. Order matters
# only where one key is a substring of another.
MODEL_TO_BRAND = [
    # Model names — distinctive enough to identify the maker.
    ("Mirage", "Berneron"),
    ("Royal Oak", "Audemars Piguet"),
    ("Calatrava", "Patek Philippe"),
    ("Nautilus", "Patek Philippe"),
    ("Aquanaut", "Patek Philippe"),
    ("Tank Cintrée", "Cartier"),
    ("Tank Louis", "Cartier"),
    ("Tank Basculante", "Cartier"),
    ("Tank Asymétrique", "Cartier"),
    ("Tank Américaine", "Cartier"),
    ("Tank Française", "Cartier"),
    ("Tank Must", "Cartier"),
    ("Crash", "Cartier"),
    ("Tonneau", "Cartier"),
    ("Pasha", "Cartier"),
    ("Daytona", "Rolex"),
    ("Submariner", "Rolex"),
    ("GMT-Master", "Rolex"),
    ("Datejust", "Rolex"),
    ("Day-Date", "Rolex"),
    ("Explorer", "Rolex"),
    ("Sea-Dweller", "Rolex"),
    ("Speedmaster", "Omega"),
    ("Seamaster", "Omega"),
    ("Constellation", "Omega"),
    ("Reverso", "Jaeger-LeCoultre"),
    ("Memovox", "Jaeger-LeCoultre"),
    ("Polaris", "Jaeger-LeCoultre"),
    ("Lange 1", "A. Lange"),
    ("Datograph", "A. Lange"),
    ("Saxonia", "A. Lange"),
    ("Zeitwerk", "A. Lange"),
    ("Odysseus", "A. Lange"),
    ("Polerouter", "Universal Geneve"),
    ("Carrera", "Tag Heuer"),
    ("Autavia", "Heuer"),
    ("Monaco", "Heuer"),
    ("Black Bay", "Tudor"),
    ("Pelagos", "Tudor"),
    # Independents + niche models that orphan-out in Hairspring's catalog.
    ("LUC XPS", "Chopard"),
    ("LUC ", "Chopard"),
    ("Grönograaf", "Grönefeld"),
    ("Chronomètre Souverain", "F.P. Journe"),
    ("Chonomètre Souverain", "F.P. Journe"),  # observed misspelling
    ("Chronomètre Bleu", "F.P. Journe"),
    ("Élégante", "F.P. Journe"),
    ("Elegante", "F.P. Journe"),
    ("Insight Micro-Rotor", "Laurent Ferrier"),
    ("Galet", "Laurent Ferrier"),
    ("Quadruple Tourbillon", "Greubel Forsey"),
    ("Fifty Fathoms", "Blancpain"),
    ("Star Wheel", "Audemars Piguet"),
    # Reference-number prefixes done separately below.
]

# Reference-number → brand. Matched as a leading token in the title
# (digits + optional letter suffix) so "5270R, Perpetual Calendar..." resolves
# to Patek. Curated for the references Hairspring has surfaced as orphans.
REF_TO_BRAND = [
    # Patek Philippe
    (r"^3970", "Patek Philippe"),
    (r"^5270", "Patek Philippe"),
    (r"^5711", "Patek Philippe"),
    (r"^5712", "Patek Philippe"),
    (r"^5167", "Patek Philippe"),
    (r"^5168", "Patek Philippe"),
    (r"^5980", "Patek Philippe"),
    (r"^5990", "Patek Philippe"),
    (r"^2526", "Patek Philippe"),
    (r"^2577", "Patek Philippe"),
    (r"^3940", "Patek Philippe"),
    (r"^5950", "Patek Philippe"),
    (r"^5004", "Patek Philippe"),
    # Audemars Piguet
    (r"^25720", "Audemars Piguet"),
    (r"^15202", "Audemars Piguet"),
    (r"^15400", "Audemars Piguet"),
    (r"^15500", "Audemars Piguet"),
    (r"^15710", "Audemars Piguet"),
    (r"^15720", "Audemars Piguet"),
    (r"^26240", "Audemars Piguet"),
    (r"^5402", "Audemars Piguet"),
    # Vacheron Constantin
    (r"^5500", "Vacheron Constantin"),
    (r"^4500", "Vacheron Constantin"),
    # A. Lange
    (r"^110\.\d", "A. Lange"),
    (r"^113\.\d", "A. Lange"),
    (r"^140\.\d", "A. Lange"),
    (r"^211\.\d", "A. Lange"),
    (r"^215\.\d", "A. Lange"),
    (r"^217\.\d", "A. Lange"),
    # Cartier
    (r"^WGTA", "Cartier"),
    (r"^CRWS", "Cartier"),
]


def _match_model_brand(title):
    t = title.lower()
    for needle, brand in MODEL_TO_BRAND:
        if needle.lower() in t:
            return brand
    for pattern, brand in REF_TO_BRAND:
        if re.match(pattern, title, re.IGNORECASE):
            return brand
    return None


def fetch_brand_from_detail(url, product_title):
    """Pull the brand for THIS product's JSON-LD entry from a Hairspring
    detail page. The page also embeds JSON-LD blocks for every related
    product (often dozens) — taking the first "brand" match in document
    order conflates them with the main listing.

    Strategy: parse each <script type="application/ld+json"> block;
    find the @type=Product entry whose `name` matches the product
    title we already know; use its brand. If the brand is "Hairspring"
    (the dealer's own name, which they sometimes mis-set on their own
    products) or empty, return None so the model-name fallback in
    detect_brand() runs."""
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
    except Exception:
        return ""

    # Pull each ld+json block, JSON-decode, walk for Product entries.
    blocks = re.findall(
        r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
        r.text, re.DOTALL,
    )
    target = (product_title or "").strip().lower()

    def brand_of(entry):
        b = entry.get("brand")
        if isinstance(b, dict):
            b = b.get("name", "")
        return (b or "").strip()

    def visit(node, found):
        if isinstance(node, dict):
            t = node.get("@type")
            if t == "Product" or (isinstance(t, list) and "Product" in t):
                name = (node.get("name") or "").strip().lower()
                # Match the main product by exact name; the related-
                # product blocks have different names so they're skipped.
                if target and name == target:
                    found.append(brand_of(node))
            for v in node.values():
                visit(v, found)
        elif isinstance(node, list):
            for v in node:
                visit(v, found)

    found = []
    for raw in blocks:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        visit(data, found)

    # Pick the first non-empty, non-"Hairspring" brand. If only the
    # mis-labelled "Hairspring" string is present, return empty so the
    # model-name fallback can take over.
    for cand in found:
        if cand and cand.lower() != "hairspring":
            return cand
    return ""


def detect_brand(name):
    """Title-only brand detection (used when JSON-LD scrape failed)."""
    # Try the curated model/ref lookup first — handles the orphan cases
    # where the title leads with a model name (Mirage 38) or a reference
    # number (3970EJ, 5402ST) without the manufacturer.
    model_hit = _match_model_brand(name)
    if model_hit:
        return model_hit
    for b in BRANDS:
        if b.lower() in name.lower():
            return b
    return 'Other'


def strip_html(text):
    if not text:
        return ''
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&#[0-9]+;', '', text)
    text = re.sub(r'&[a-z]+;', '', text)
    return re.sub(r'\s+', ' ', text).strip()


def get_all_products():
    all_products = []
    page = 1
    limit = 250
    while True:
        print(f"Fetching page {page}...")
        r = requests.get(f"{BASE}/products.json", headers=HEADERS,
                         params={'limit': limit, 'page': page}, timeout=20)
        r.raise_for_status()
        products = r.json().get('products', [])
        if not products:
            break
        all_products.extend(products)
        print(f"  Got {len(products)} (total: {len(all_products)})")
        if len(products) < limit:
            break
        page += 1
        time.sleep(0.3)
    return all_products


def parse_product(p):
    title = p.get('title', '')
    body = strip_html(p.get('body_html', ''))[:400]
    published_at = p.get('published_at', '')[:10] or ''
    handle = p.get('handle', '')
    url = f"{BASE}/products/{handle}"

    variants = p.get('variants', [])
    price = 0
    available = False
    if variants:
        v = variants[0]
        try:
            price = int(float(v.get('price', '0')))
        except (ValueError, TypeError):
            price = 0
        available = v.get('available', False)

    images = p.get('images', [])
    img = images[0]['src'] if images else ''

    # Visit the detail page for the JSON-LD brand. Title-only fallback
    # would bucket most of Hairspring as "Other" because their titles
    # lead with the model name (Tank, Royal Oak, Lange 1) rather than
    # the manufacturer.
    brand = ''
    if available and price > 0:
        time.sleep(0.2)
        brand = normalize_brand(fetch_brand_from_detail(url, title))
    if not brand:
        brand = detect_brand(title)

    return {
        'title': title,
        'brand': brand,
        'price': price,
        'url': url,
        'img': img,
        'description': body,
        'source': 'Hairspring',
        'date': published_at,
        'sold': not available,
    }


def main():
    print("Fetching Hairspring inventory (Shopify)...")
    products = get_all_products()
    print(f"\nTotal products: {len(products)}")

    results = []
    skipped_sold = skipped_no_price = 0
    for p in products:
        parsed = parse_product(p)
        if parsed['price'] == 0:
            skipped_no_price += 1; continue
        if parsed['sold']:
            skipped_sold += 1; continue
        results.append(parsed)

    print(f"\nSkipped: {skipped_sold} sold, {skipped_no_price} no price")

    output = 'hairspring_listings.csv'
    with open(output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['title','brand','price','url','img','description','source','date','sold'])
        writer.writeheader()
        writer.writerows(results)

    if results:
        prices = [r['price'] for r in results]
        print(f"\nSaved {len(results)} listings to {output}")
        print(f"  Min: ${min(prices):,} | Max: ${max(prices):,} | Avg: ${sum(prices)//len(prices):,}")
        from collections import Counter
        for b, c in Counter(r['brand'] for r in results).most_common():
            print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
