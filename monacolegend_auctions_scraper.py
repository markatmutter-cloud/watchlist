#!/usr/bin/env python3
"""
Monaco Legend Auctions calendar scraper.
Run: python3 monacolegend_auctions_scraper.py
Requires: pip install requests
Output: monacolegend_auctions_listings.csv

Monaco Legend doesn't publish a dedicated calendar page; the homepage
lists upcoming + live + past sales with per-auction URLs. We parse
the homepage, extract auction URLs and their surrounding context, and
emit only upcoming + live ones.

Status signals in the HTML:
  'Bidding Open'       — live right now
  'Upcoming Auction'   — future sale (may or may not have published dates yet)
  'Auction Result'     — past sale (skipped)
"""
import requests
import csv
import re
import sys
from datetime import datetime

BASE = "https://www.monacolegendauctions.com"
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


def parse_date_range(text):
    """Parse '25 - 26 April 2026' or '14 April 2026' etc. Return (start, end)."""
    # Normalize dashes + whitespace
    t = text.replace('–', '-').replace('—', '-')
    t = re.sub(r'\s+', ' ', t).strip()
    # '25 - 26 April 2026'
    m = re.match(r'(\d+)\s*-\s*(\d+)\s+([A-Za-z]+)\s+(\d{4})', t)
    if m:
        d1, d2, month, year = int(m.group(1)), int(m.group(2)), m.group(3).lower(), int(m.group(4))
        mi = MONTHS.get(month)
        if mi:
            try:
                return (datetime(year, mi, d1).date().isoformat(),
                        datetime(year, mi, d2).date().isoformat())
            except ValueError:
                pass
    # '14 April 2026'
    m = re.match(r'(\d+)\s+([A-Za-z]+)\s+(\d{4})', t)
    if m:
        d, month, year = int(m.group(1)), m.group(2).lower(), int(m.group(3))
        mi = MONTHS.get(month)
        if mi:
            try:
                iso = datetime(year, mi, d).date().isoformat()
                return (iso, iso)
            except ValueError:
                pass
    return (None, None)


def scrape():
    print(f"Fetching {BASE} ...")
    r = requests.get(BASE, headers=HEADERS, timeout=30)
    r.raise_for_status()
    html = r.text

    by_path = {}  # dedup on path; prefer records that parsed a real date

    # For each auction link, scope the text window to start at the nearest
    # preceding status marker — that keeps adjacent cards' dates from
    # bleeding into this auction's record (the previous version wrongly
    # assigned Exclusive Timepieces 41's date to 40 because both cards fit
    # inside a 2000-char backwards window).
    for m in re.finditer(r'href="(auction/[^"#?]+)"', html):
        path = m.group(1)
        idx = m.start()

        status_candidates = [
            (html.rfind('Bidding Open', 0, idx), 'live'),
            (html.rfind('Upcoming Auction', 0, idx), 'upcoming'),
            (html.rfind('Auction Result', 0, idx), 'past'),
        ]
        status_candidates = [(pos, s) for pos, s in status_candidates if pos >= 0]
        if not status_candidates:
            continue
        # Nearest preceding marker wins — that's this card's status line.
        status_candidates.sort(key=lambda x: -x[0])
        start_pos, status = status_candidates[0]

        if status == 'past':
            continue

        chunk = html[start_pos:idx + 200]
        text = re.sub(r'<[^>]+>', ' ', chunk)
        text = re.sub(r'&#8211;|–|—', '-', text)
        text = re.sub(r'&#8288;|&nbsp;', ' ', text)
        text = re.sub(r'&amp;', '&', text)
        text = re.sub(r'\s+', ' ', text).strip()

        # Title guess: everything between the status phrase and the next date
        # or "View Auction" looks messy in practice; keep simple — use the
        # URL slug, title-cased and de-hyphenated.
        slug = path.split('/', 1)[-1]
        title = slug.replace('-', ' ').strip().title()

        # Date: look in the chunk for "dd - dd Month YYYY" or "dd Month YYYY"
        date_start = date_end = None
        date_label = ''
        for dm in re.finditer(r'\d+\s*[\-\s]*\s*\d*\s*[A-Z][a-z]+\s+202[4-7]', text):
            candidate = dm.group(0).strip()
            s, e = parse_date_range(candidate)
            if s:
                date_start, date_end, date_label = s, e, candidate
                break

        # Location is typically right after the date: '25 - 26 April 2026 | Monaco'.
        # Most Monaco Legend sales ARE in Monaco; default to that if no match.
        location = 'Monaco'
        lm = re.search(r'\| ?\s*([A-Z][a-z]+(?: [A-Z][a-z]+)?)\s*(?:View Auction|$)', text)
        if lm:
            location = lm.group(1).strip()

        # Dedup: keep the first occurrence only. Later occurrences of the
        # same href tend to be teaser cards inside another sale's section,
        # which causes status + date bleed-over if we merge them in.
        if path in by_path:
            continue

        # Monaco Legend's per-auction URL goes to a sale landing page, but
        # the actual catalog (with lots + bidding) only opens for "Bidding
        # Open" sales. Mark 'has_catalog' true only for live ones so the
        # Catalog chip doesn't promise a catalog that isn't published yet.
        has_catalog = 'True' if status == 'live' else 'False'

        by_path[path] = {
            'house':       'Monaco Legend',
            'title':       title,
            'location':    location,
            'date_start':  date_start or '',
            'date_end':    date_end or '',
            'date_label':  date_label,
            'url':         f"{BASE}/{path}",
            'has_catalog': has_catalog,
            'source':      'Monaco Legend',
            'status_hint': status,
        }

    return list(by_path.values())


def main():
    print("Scraping Monaco Legend Auctions calendar...")
    auctions = scrape()
    if not auctions:
        print("No auctions parsed — site template may have changed.")
        sys.exit(0)

    print(f"\nFound {len(auctions)} auction(s):")
    for a in auctions:
        print(f"  [{a['status_hint']:8s}] {a['date_start']:10s}  {a['location']:15s}  {a['title']}")

    output = 'monacolegend_auctions_listings.csv'
    with open(output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['house','title','location','date_start','date_end','date_label','url','has_catalog','source','status_hint'])
        writer.writeheader()
        writer.writerows(auctions)
    print(f"\nSaved {len(auctions)} auctions to {output}")


if __name__ == "__main__":
    main()
