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
from datetime import datetime, date

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

    # The homepage has three regions:
    #   1. "Upcoming Auction" hero banner at the top — a promo card that
    #      links to the featured sale with no date/location text around it.
    #      Ignore this — it's what caused the previous version to capture
    #      auctions with empty date fields and then bleed adjacent cards'
    #      dates into them on dedup.
    #   2. "Bidding Open" — actual card grid of currently-bidding auctions
    #      (includes both today's live sale and any pre-bidding upcoming
    #      ones). This is the only region we parse.
    #   3. "Auction Result" — past auctions. Skipped.
    bidding_start = html.find('Bidding Open')
    if bidding_start < 0:
        print("No 'Bidding Open' section found; skipping.")
        return []
    # End of the section is wherever Auction Result starts next (if any).
    enders = [p for p in [html.find('Auction Result', bidding_start + 1)] if p >= 0]
    section_end = min(enders) if enders else len(html)
    section = html[bidding_start:section_end]

    # Monaco Legend renders two card templates — a featured layout for the
    # currently-live sale and a grid layout for everything else — but both
    # contain <p class="auction-date">{date} | {location}</p>. Anchor on
    # that tag: the date+location come from its text, the href comes from
    # the nearest auction link within a reasonable window, and the card
    # spans from one auction-date tag to the next.
    date_tags = list(re.finditer(
        r'<p class="auction-date">([^<]+)</p>',
        section,
    ))

    by_path = {}
    today = date.today()

    for i, dm in enumerate(date_tags):
        next_pos = date_tags[i + 1].start() if i + 1 < len(date_tags) else len(section)
        chunk = section[dm.start():next_pos]
        date_raw = dm.group(1)

        hm = re.search(r'href="(auction/[^"#?]+)"', chunk)
        if not hm:
            continue
        path = hm.group(1)
        if path in by_path:
            continue

        # Clean the date+location text from the <p> tag
        text = date_raw
        text = re.sub(r'&#8211;|–|—', '-', text)
        text = re.sub(r'&#8288;|&nbsp;', ' ', text)
        text = re.sub(r'&amp;', '&', text)
        text = re.sub(r'\s+', ' ', text).strip()

        # The auction-date <p> reads like "25 - 26 April 2026 | Monaco" or
        # "4 June 2026 | Lugano". Parse date-then-location.
        m = re.match(
            r'(\d+\s*(?:-\s*\d+\s*)?[A-Z][a-z]+\s+202[4-7])'
            r'\s*\|\s*'
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
            text,
        )
        if not m:
            continue
        date_label = m.group(1).strip()
        location   = m.group(2).strip()
        date_start, date_end = parse_date_range(date_label)
        if not date_start:
            continue

        # Title: pull auction number from slug, e.g. exclusive-timepieces-41 → 41.
        slug = path.split('/', 1)[-1]
        title = slug.replace('-', ' ').strip().title()

        # Derive live vs upcoming from the actual dates rather than
        # Monaco Legend's section header — their "Bidding Open" grid
        # includes sales whose auction day is still weeks away (pre-bid
        # phase). For our UI, "live" should mean "the auction day is
        # today", so timers and catalog chips are accurate.
        today_iso = today.isoformat()
        is_live = date_start <= today_iso <= (date_end or date_start)
        status = 'live' if is_live else 'upcoming'
        has_catalog = 'True' if is_live else 'False'

        by_path[path] = {
            'house':       'Monaco Legend',
            'title':       title,
            'location':    location,
            'date_start':  date_start,
            'date_end':    date_end or date_start,
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
