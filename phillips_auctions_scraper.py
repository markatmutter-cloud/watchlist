#!/usr/bin/env python3
"""
Phillips watch auctions calendar scraper.
Run: python3 phillips_auctions_scraper.py
Requires: pip install requests
Output: phillips_auctions_listings.csv

Phillips' site is Next.js, but the /watches department landing page
server-renders its upcoming-auction cards. Each card carries
<span class="atc_date_start"> / <span class="atc_date_end"> with
ISO-8601 datetimes, plus title, location, and a link to a sale at
/auction/{CODE}. We parse that directly — no Playwright needed.

Only upcoming/live sales are emitted. Past sales are ignored; the
app's merge.py derives "past" from dateEnd vs today anyway.
"""
import requests
import csv
import re
import sys
from datetime import datetime, date, timezone

URL = "https://www.phillips.com/watches"
BASE = "https://www.phillips.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
}


def strip_html(t):
    t = re.sub(r'<[^>]+>', ' ', t)
    t = re.sub(r'&amp;', '&', t)
    t = re.sub(r'&#[0-9]+;', '', t)
    t = re.sub(r'\s+', ' ', t)
    return t.strip()


def parse_dt(s):
    """'2026-05-09 14:00:00' → '2026-05-09' (just the date portion)."""
    s = (s or "").strip()
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})', s)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else ""


def scrape():
    print(f"Fetching {URL} ...")
    r = requests.get(URL, headers=HEADERS, timeout=30)
    r.raise_for_status()
    html = r.text

    # The Department Info + Upcoming Auctions section is followed by grid
    # cards. Each card is anchored by a <span class="atc_date_start"> tag;
    # the start & end datetimes sit back-to-back, followed by the sale
    # title, location, and later the Phillips contact line.
    today = date.today().isoformat()
    results = []

    # Find every atc_date_start occurrence and the matching atc_date_end right after it.
    for sm in re.finditer(r'atc_date_start"[^>]*>([^<]+)', html):
        idx = sm.start()
        start_raw = sm.group(1).strip()
        date_start = parse_dt(start_raw)
        if not date_start:
            continue

        # Look for atc_date_end just after the start span.
        em = re.search(r'atc_date_end"[^>]*>([^<]+)', html[idx:idx + 500])
        date_end = parse_dt(em.group(1)) if em else date_start

        # Skip past sales.
        if date_end < today:
            continue

        # Grab the 2-4KB window after the dates for title + location + href.
        window = html[idx: idx + 3500]
        text = strip_html(window)
        # Each card's structure post-date: "{timezone} {Sale Title} {Location} Phillips info@phillips.com"
        # Capture title + location before " Phillips " anchor.
        tm = re.search(r'(?:Europe/Paris|Asia/Hong_Kong|America/New_York|America/Los_Angeles|Asia/Tokyo|Europe/London|UTC|GMT)\s+(.+?)\s+Phillips\s+info@phillips', text)
        if not tm:
            continue
        body = tm.group(1).strip()
        # Body looks like "The Geneva Watch Auction: XXIII Geneva" — title +
        # trailing location word(s). Strip trailing city to find the title.
        loc_m = re.search(r'\s+(Geneva|Hong Kong|New York|London|Paris|Milan|Tokyo|Dubai|Los Angeles|Online)$', body)
        if loc_m:
            location = loc_m.group(1)
            title = body[: loc_m.start()].strip()
        else:
            location = ''
            title = body

        # Auction code URL ("/auction/CH080226") — Phillips puts each card's
        # href at the TOP of the card, BEFORE the atc_date block. Walk
        # backward from the date marker to the nearest auction link that
        # belongs to THIS card (i.e. not one we already used).
        url = ""
        back = html[max(0, idx - 3500):idx]
        hrefs_back = list(re.finditer(r'href="(https://www\.phillips\.com/auction/[A-Z0-9]+)"', back))
        if hrefs_back:
            url = hrefs_back[-1].group(1)   # nearest preceding href = this card's

        # has_catalog: Phillips publishes catalogs alongside the auction URL
        # once the sale is announced. The sale page itself exists for every
        # announced sale, so we mark has_catalog True whenever we have a URL.
        has_catalog = bool(url)

        results.append({
            'house':      'Phillips',
            'title':      title,
            'location':   location,
            'date_start': date_start,
            'date_end':   date_end,
            'date_label': (f"{date_start} – {date_end}" if date_end != date_start else date_start),
            'url':        url,
            'has_catalog': 'True' if has_catalog else 'False',
            'source':     'Phillips',
        })

    # Dedup by url or (house, date_start, title) — the landing page
    # sometimes repeats a sale in nav/teaser blocks.
    seen = set()
    unique = []
    for r in results:
        key = r['url'] or f"{r['date_start']}|{r['title']}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(r)
    return unique


def main():
    print("Scraping Phillips watch auctions calendar...")
    auctions = scrape()
    if not auctions:
        print("No auctions parsed — site template may have changed.")
        sys.exit(0)

    print(f"\nFound {len(auctions)} auction(s):")
    for a in auctions:
        print(f"  {a['date_start']:10s}  {a['location']:12s}  {a['title']}")

    output = 'phillips_auctions_listings.csv'
    with open(output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['house','title','location','date_start','date_end','date_label','url','has_catalog','source'])
        writer.writeheader()
        writer.writerows(auctions)
    print(f"\nSaved {len(auctions)} auctions to {output}")


if __name__ == "__main__":
    main()
