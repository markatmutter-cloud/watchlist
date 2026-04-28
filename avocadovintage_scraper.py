#!/usr/bin/env python3
"""
Avocado Vintage Watches scraper — Squarespace Commerce items[] API.

Same `?format=json` pattern as Watch Brothers London / MVV Watches.
USD-priced.

Run: python3 avocadovintage_scraper.py
Output: avocadovintage_listings.csv
"""

import csv
import re
import time

import requests

BASE = "https://www.avocadovintagewatches.com"
PATH = "/watches"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

BRANDS = [
    "Rolex", "Omega", "Patek Philippe", "Tudor", "Breitling", "IWC", "Cartier",
    "Jaeger-LeCoultre", "Panerai", "Audemars Piguet", "Vacheron Constantin",
    "A. Lange", "Aquastar", "Seiko", "Universal Geneve", "Heuer", "Longines",
    "Movado", "Czapek", "Urwerk", "Zenith", "Breguet", "Eberhard", "Tissot",
    "Blancpain", "Girard-Perregaux", "Gallet", "Minerva", "Lemania", "Enicar",
    "Doxa", "Ebel", "Hamilton", "Bulova", "Mido", "Oris", "Junghans",
    "Grand Seiko", "Chopard", "Piaget",
]


def detect_brand(name):
    for b in BRANDS:
        if b.lower() in name.lower():
            return b
    return "Other"


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&#[0-9]+;", "", text)
    text = re.sub(r"&[a-z]+;", "", text)
    return re.sub(r"\s+", " ", text).strip()


def get_all_items():
    out = []
    offset = 0
    while True:
        params = {"format": "json"}
        if offset:
            params["offset"] = offset
        r = requests.get(f"{BASE}{PATH}", headers=HEADERS, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        items = data.get("items", [])
        if not items:
            break
        out.extend(items)
        print(f"  offset {offset}: got {len(items)} (total: {len(out)})")
        pag = data.get("pagination", {})
        if not pag.get("nextPage"):
            break
        offset = pag.get("nextPageOffset")
        if not offset:
            break
        time.sleep(0.5)
    return out


def parse_item(i):
    title = i.get("title", "")
    full_url = i.get("fullUrl") or f"{PATH}/p/{i.get('urlId', '')}"
    url = BASE + full_url if full_url.startswith("/") else full_url

    # Squarespace item images: prefer the nested items[] media list
    # (the top-level assetUrl is sometimes a placeholder).
    asset = ""
    for m in (i.get("items") or []):
        if m.get("recordTypeLabel") == "image" and m.get("assetUrl"):
            asset = m["assetUrl"]
            break
    if not asset:
        asset = i.get("assetUrl") or ""

    sc = i.get("structuredContent", {}) or {}
    variants = sc.get("variants", [])

    price = 0
    available = False
    if variants:
        v = variants[0]
        pm = v.get("priceMoney", {}) or {}
        try:
            price = int(float(pm.get("value") or "0"))
        except (ValueError, TypeError):
            price = 0
        if not price:
            raw = v.get("price", 0)
            try:
                price = int(raw) // 100
            except (ValueError, TypeError):
                price = 0
        unlimited = v.get("unlimited", False)
        qty = v.get("qtyInStock", 0) or 0
        available = unlimited or qty > 0

    desc = strip_html(i.get("excerpt", "") or i.get("body", ""))[:400]

    return {
        "title": title,
        "brand": detect_brand(title),
        "price": price,
        "url": url,
        "img": asset,
        "description": desc,
        "source": "Avocado Vintage",
        "sold": not available,
    }


def main():
    print("Fetching Avocado Vintage Watches inventory (Squarespace)...")
    items = get_all_items()
    print(f"\nTotal items: {len(items)}")

    results = []
    skipped_sold = skipped_no_price = 0
    for i in items:
        parsed = parse_item(i)
        if parsed["price"] == 0:
            skipped_no_price += 1
            continue
        if parsed["sold"]:
            skipped_sold += 1
            continue
        results.append(parsed)

    out_file = "avocadovintage_listings.csv"
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "title", "brand", "price", "url", "img",
            "description", "source", "sold",
        ])
        writer.writeheader()
        writer.writerows(results)

    print(f"\n✓ Saved {len(results)} listings to {out_file}")
    print(f"  Skipped: {skipped_sold} sold, {skipped_no_price} no price")
    if results:
        from collections import Counter
        for b, c in Counter(r["brand"] for r in results).most_common():
            print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
