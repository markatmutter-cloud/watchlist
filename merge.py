#!/usr/bin/env python3
"""
merge.py - combines all scraper CSVs into public/listings.json
Run after scrapers: python3 merge.py
"""

import csv, json, re, os
from datetime import date
from collections import Counter

BRANDS = ['Rolex','Omega','Patek Philippe','Tudor','Breitling','IWC','Cartier',
          'Jaeger-LeCoultre','Panerai','Audemars Piguet','Vacheron Constantin',
          'A. Lange','Aquastar','Ralph Lauren','Seiko','Universal Geneve',
          'Heuer','Longines','Movado','Czapek','Urwerk','Zenith','Breguet',
          'Blancpain','Tissot','Gallet','Mulco','Girard-Perregaux','Eberhard']

# Approximate exchange rates to USD
FX = {'GBP': 1.27, 'EUR': 1.08, 'JPY': 0.0067, 'CNY': 0.14, 'USD': 1.0}

def detect_brand(name, existing=''):
    if existing and existing not in ['Other','Collectors Corner NY','Falco','Falco Watches','']:
        return existing
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
    return str(v).lower() in ('true','1','yes')

def load_csv(path, prefix, source_name, currency='USD'):
    items = []
    if not os.path.exists(path):
        print(f"  WARNING: {path} not found, skipping")
        return items
    with open(path, encoding='utf-8') as f:
        for i, r in enumerate(csv.DictReader(f)):
            try: price = int(r.get('price',0))
            except: continue
            if price < 500: continue
            brand = detect_brand(r.get('title',''), r.get('brand',''))
            if brand == 'Universal Genève': brand = 'Universal Geneve'
            rate = FX.get(currency, 1.0)
            price_usd = round(price * rate)
            items.append({
                'id': f'{prefix}-{i}',
                'brand': brand,
                'ref': clean(r.get('title','')),
                'price': price,
                'currency': currency,
                'priceUSD': price_usd,
                'source': source_name,
                'url': r.get('url',''),
                'img': r.get('img',''),
                'date': r.get('date', str(date.today())),
                'sold': parse_bool(r.get('sold', False)),
                'desc': r.get('description','')[:300],
            })
    return items

def main():
    sources = [
        ('data/windvintage.csv',      'wv', 'Wind Vintage',          'USD'),
        ('data/tropicalwatch.csv',    'tw', 'Tropical Watch',        'USD'),
        ('data/menta.csv',            'me', 'Menta Watches',         'USD'),
        ('data/collectorscorner.csv', 'cc', 'Collectors Corner NY',  'USD'),
        ('data/falco.csv',            'fa', 'Falco Watches',         'GBP'),
    ]

    all_items = []
    for path, prefix, name, currency in sources:
        items = load_csv(path, prefix, name, currency)
        print(f"  {name}: {len(items)} listings ({currency})")
        all_items.extend(items)

    print(f"\nTotal: {len(all_items)} listings")

    os.makedirs('public', exist_ok=True)
    output_path = 'public/listings.json'
    with open(output_path, 'w') as f:
        json.dump(all_items, f, separators=(',',':'))

    size_kb = os.path.getsize(output_path) // 1024
    print(f"Written to {output_path} ({size_kb}kb)")

if __name__ == '__main__':
    main()
