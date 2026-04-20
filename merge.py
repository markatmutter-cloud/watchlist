#!/usr/bin/env python3
"""
merge.py - combines all scraper CSVs into listings.json
Run after all scrapers: python3 merge.py
Output: public/listings.json
"""

import csv, json, re, os
from datetime import date
from collections import Counter

BRANDS = ['Rolex','Omega','Patek Philippe','Tudor','Breitling','IWC','Cartier',
          'Jaeger-LeCoultre','Panerai','Audemars Piguet','Vacheron Constantin',
          'A. Lange','Aquastar','Ralph Lauren','Seiko','Universal Geneve',
          'Heuer','Longines','Movado','Czapek','Urwerk','Zenith','Breguet',
          'Blancpain','Tissot','Gallet','Mulco','Girard-Perregaux','Eberhard']

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

def load_csv(path, prefix, source_name):
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
            items.append({
                'id': f'{prefix}-{i}',
                'brand': brand,
                'ref': clean(r.get('title','')),
                'price': price,
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
        ('data/windvintage.csv',       'wv', 'Wind Vintage'),
        ('data/tropicalwatch.csv',     'tw', 'Tropical Watch'),
        ('data/menta.csv',             'me', 'Menta Watches'),
        ('data/collectorscorner.csv',  'cc', 'Collectors Corner NY'),
        ('data/falco.csv',             'fa', 'Falco Watches'),
    ]

    all_items = []
    for path, prefix, name in sources:
        items = load_csv(path, prefix, name)
        print(f"  {name}: {len(items)} listings")
        all_items.extend(items)

    print(f"\nTotal: {len(all_items)} listings")

    # Write output
    os.makedirs('public', exist_ok=True)
    output_path = 'public/listings.json'
    with open(output_path, 'w') as f:
        json.dump(all_items, f, separators=(',',':'))

    print(f"Written to {output_path} ({os.path.getsize(output_path)//1024}kb)")

    # Summary
    for src in [s[2] for s in sources]:
        si = [i for i in all_items if i['source']==src]
        if not si: continue
        prices = [i['price'] for i in si]
        sold = sum(1 for i in si if i['sold'])
        print(f"  {src}: {len(si)} | avg ${sum(prices)//len(prices):,} | {sold} on hold")

if __name__ == '__main__':
    main()
