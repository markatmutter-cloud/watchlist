#!/usr/bin/env python3
"""
Antiquorum auction calendar scraper.
Run: python3 antiquorum_auctions_scraper.py
Requires: pip install requests
Output: antiquorum_auctions_listings.csv

Antiquorum's upcoming-auctions page is WordPress HTML. Each auction
appears as a block containing: location, date range (e.g. "May 9th
-10th, 2026" or a single day), and a title ("Important Modern &
Vintage Timepieces" is the standard watch sale).

This scrapes the calendar only — not individual lots. Lot-level
scraping is a future phase (requires visiting catalog.antiquorum.swiss
per sale, and many lots aren't previewable until shortly before the
auction).
"""
import requests
import csv
import re
import sys
from datetime import datetime

URL = "https://www.antiquorum.swiss/en/auctions/upcoming"
CATALOG_URL = "https://catalog.antiquorum.swiss/"  # generic catalog portal
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
}

MONTHS = {
    'january':1, 'february':2, 'march':3, 'april':4, 'may':5, 'june':6,
    'july':7, 'august':8, 'september':9, 'october':10, 'november':11, 'december':12,
}


def parse_date_range(date_str):
    """Parse strings like:
      'May 9th -10th, 2026'
      'May 31st, 2026'
      'November 7th -8th, 2026'
      'April 23, 2026'

    Returns (start_iso, end_iso) as YYYY-MM-DD strings, or (None, None).
    """
    s = date_str.strip()
    # Drop ordinal suffixes
    s = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', s, flags=re.IGNORECASE)
    # "May 9 -10, 2026"  →  month=May, day_start=9, day_end=10, year=2026
    m = re.match(r'([A-Za-z]+)\s+(\d+)(?:\s*-\s*(\d+))?,?\s*(\d{4})', s)
    if not m:
        return (None, None)
    month_name, d1, d2, year = m.group(1).lower(), int(m.group(2)), m.group(3), int(m.group(4))
    month = MONTHS.get(month_name)
    if not month:
        return (None, None)
    try:
        start = datetime(year, month, d1).date().isoformat()
        end_day = int(d2) if d2 else d1
        end = datetime(year, month, end_day).date().isoformat()
    except ValueError:
        return (None, None)
    return (start, end)


def strip_tags(html):
    return re.sub(r'<[^>]+>', ' ', html)


def scrape():
    print(f"Fetching {URL} ...")
    r = requests.get(URL, headers=HEADERS, timeout=30)
    r.raise_for_status()
    html = r.text

    # Flatten HTML to text so we can pattern-match across tag boundaries.
    text = strip_tags(html)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&#[0-9]+;', '', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'\s+', ' ', text)

    # Match "<Location> <Date> Important Modern & Vintage Timepieces". Location
    # is 1–3 Titlecase words (handles "New York", "Hong Kong"). Title is
    # currently always "Important Modern & Vintage Timepieces" for watches.
    pattern = re.compile(
        r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+'
        r'([A-Z][a-z]+\s+\d+(?:st|nd|rd|th)?(?:\s*-\s*\d+(?:st|nd|rd|th)?)?,?\s*\d{4})\s+'
        r'(Important Modern\s*&\s*Vintage Timepieces)'
    )

    results = []
    seen = set()
    for m in pattern.finditer(text):
        location = m.group(1).strip()
        date_str = m.group(2).strip()
        title = m.group(3).strip()
        start, end = parse_date_range(date_str)
        if not start:
            print(f"  ? skipped (unparseable date): {date_str!r}")
            continue

        key = (location, start, title)
        if key in seen:
            continue
        seen.add(key)

        results.append({
            'house':       'Antiquorum',
            'title':       title,
            'location':    location,
            'date_start':  start,
            'date_end':    end,
            'date_label':  date_str,     # original pretty string for display
            'url':         CATALOG_URL,  # no per-sale catalog URL on the upcoming page
            'source':      'Antiquorum',
        })

    return results


def main():
    print("Scraping Antiquorum upcoming auctions calendar...")
    auctions = scrape()
    if not auctions:
        print("No auctions parsed. Dumping page signature for debugging:")
        # Print a 200-char window around "Timepieces" so future edits to the
        # page template can be diagnosed without grabbing the whole HTML.
        r = requests.get(URL, headers=HEADERS, timeout=30)
        text = re.sub(r'\s+', ' ', strip_tags(r.text))
        idx = text.find('Timepieces')
        if idx >= 0:
            print(f"  Context around 'Timepieces': {text[max(0,idx-150):idx+50]!r}")
        sys.exit(0)

    print(f"\nFound {len(auctions)} upcoming auction(s):")
    for a in auctions:
        print(f"  {a['date_start']}  {a['location']:20s}  {a['title']}")

    output = 'antiquorum_auctions_listings.csv'
    with open(output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['house','title','location','date_start','date_end','date_label','url','source'])
        writer.writeheader()
        writer.writerows(auctions)
    print(f"\nSaved {len(auctions)} auctions to {output}")


if __name__ == "__main__":
    main()
