#!/usr/bin/env python3
"""
Sotheby's watch auctions calendar scraper.

Uses Sotheby's calendar URL with the watches-category filter applied
(`f4=00000164-609a-d1db-a5e6-e9fffc050000`). The calendar page server-
renders every upcoming watch auction's title, date range, time/timezone,
and location in flat text. One HTTP request, regex over flat text.

Format observed (after HTML strip + whitespace collapse):
  Type: auction Category: Upcoming Auction <TITLE> <DATE> | <TIME> <TZ> | <LOCATION> View Auction

Date variants:
  '10 May 2026'                      single-day
  '10–12 May 2026'                   day-range, single month
  '29 April–13 May 2026'             range across months
  '24 November–9 December 2026'      range across months

Run: python3 sothebys_auctions_scraper.py
Output: sothebys_auctions_listings.csv
"""

import csv
import re
import sys
from datetime import datetime

import requests

CAL_URL = (
    "https://www.sothebys.com/en/calendar?"
    "s=0&from=&to=&f4=00000164-609a-d1db-a5e6-e9fffc050000&q="
)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/132.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

MONTH = {m.lower(): i for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June",
     "July", "August", "September", "October", "November", "December"], 1
)}


def strip_flat(html):
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&#[0-9]+;", "", text)
    text = re.sub(r"&[a-z]+;", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


_MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"

# Try patterns in priority order. Each returns (d1, m1, d2, m2, year)
# where m2 may be None.
PATTERNS = [
    # Cross-month range: "29 April–13 May 2026" / "24 November–9 December 2026"
    re.compile(
        rf"(\d{{1,2}})\s+({_MONTHS})\s*[–-]\s*(\d{{1,2}})\s+({_MONTHS})\s+(\d{{4}})",
        re.IGNORECASE,
    ),
    # Same-month range: "10–12 May 2026" / "3–17 June 2026"
    re.compile(
        rf"(\d{{1,2}})\s*[–-]\s*(\d{{1,2}})\s+({_MONTHS})\s+(\d{{4}})",
        re.IGNORECASE,
    ),
    # Single day: "10 May 2026"
    re.compile(
        rf"(\d{{1,2}})\s+({_MONTHS})\s+(\d{{4}})",
        re.IGNORECASE,
    ),
]


def find_date(text):
    """Match the date in `text` against the priority pattern list.
    Returns (match_obj, kind) where kind is 'cross', 'range', or 'single'.
    First-match wins so cross-month is tried before same-month."""
    for kind, pat in zip(("cross", "range", "single"), PATTERNS):
        m = pat.search(text)
        if m:
            return m, kind
    return None, None


def parse_date_range(text):
    """Returns (match_start_idx, date_start, date_end). The match-start
    index is where the date actually begins in `text` so the caller can
    extract the title as everything before it."""
    m, kind = find_date(text)
    if not m:
        return -1, "", ""
    if kind == "cross":
        d1, m1, d2, m2, yr = m.groups()
        date_start = f"{int(yr):04d}-{MONTH[m1.lower()]:02d}-{int(d1):02d}"
        date_end = f"{int(yr):04d}-{MONTH[m2.lower()]:02d}-{int(d2):02d}"
    elif kind == "range":
        d1, d2, mo, yr = m.groups()
        month = MONTH[mo.lower()]
        date_start = f"{int(yr):04d}-{month:02d}-{int(d1):02d}"
        date_end = f"{int(yr):04d}-{month:02d}-{int(d2):02d}"
    else:
        d1, mo, yr = m.groups()
        month = MONTH[mo.lower()]
        date_start = f"{int(yr):04d}-{month:02d}-{int(d1):02d}"
        date_end = date_start
    return m.start(), date_start, date_end


# Card matcher: anchored on `Category: Upcoming Auction`, captures the
# rest of one card up to the next `Type:` or `View Auction` boundary.
# We then split that capture by the regex below.
CARD_RE = re.compile(
    r"Category:\s*Upcoming\s+Auction\s+(.+?)\s+View\s+Auction",
    re.IGNORECASE,
)


def parse_card(card_text):
    """`card_text` looks like:
       'TITLE <DATE> | <TIME> <TZ> | <LOCATION>'
    Splits on `|` → [title+date, time+tz, location]."""
    parts = card_text.split("|")
    if len(parts) < 2:
        return None
    head = parts[0].strip()
    location = parts[-1].strip() if len(parts) >= 3 else ""

    date_start_idx, date_start, date_end = parse_date_range(head)
    if not date_start:
        return None
    title = head[:date_start_idx].strip().rstrip("-").strip()
    return title, date_start, date_end, location


def list_unique_auction_urls(html):
    """Return distinct ``/en/buy/auction/YYYY/<slug>`` paths in raw-HTML
    document order. Same slug appears 5x per card (image tile, title
    anchor, CTA, etc.); we collapse to first occurrence."""
    seen = set()
    out = []
    for m in re.finditer(r"/en/buy/auction/\d{4}/[a-z0-9-]+", html):
        url = m.group(0)
        if url not in seen:
            seen.add(url)
            out.append(url)
    return out


def assign_url_for_card(available, title):
    """Pop the first URL whose slug contains the title's first word.

    Sotheby's runs multiple sales with the same title each season
    ("Fine Watches" in Geneva AND New York AND Paris) — distinguished
    by slug suffixes (``-ge2611`` Geneva, ``-pf2660`` Paris, bare or
    ``-N`` for New York). Cards in flat-text order and unique URLs in
    raw-HTML document order both follow the same Sotheby's calendar
    order, so the greedy first-fit pop matches each card to its own
    URL even when multiple candidates contain the title word.

    The first-word filter skips obviously-unrelated sales (e.g. a
    "Précieuses Reliures" books auction interleaved with the watch
    calendar).
    """
    if not title:
        return ""
    first_word = title.split()[0].lower()
    for i, url in enumerate(available):
        slug = url.rsplit("/", 1)[-1]
        if first_word in slug:
            available.pop(i)
            return "https://www.sothebys.com" + url
    return ""


def scrape():
    print(f"Fetching {CAL_URL}")
    r = requests.get(CAL_URL, headers=HEADERS, timeout=30)
    r.raise_for_status()
    flat = strip_flat(r.text)
    today = datetime.utcnow().date().isoformat()

    # Pre-build the list of unique auction URLs in document order so
    # we can greedy-assign one to each card. The greedy approach
    # disambiguates when multiple sales share a title (e.g. two
    # "Fine Watches" — Geneva + New York).
    available_urls = list_unique_auction_urls(r.text)

    results = []
    for m in CARD_RE.finditer(flat):
        card = m.group(1)
        parsed = parse_card(card)
        if not parsed:
            continue
        title, date_start, date_end, location = parsed
        if not title or not date_start:
            continue
        if date_end < today:
            continue
        url = assign_url_for_card(available_urls, title)
        date_label = (f"{date_start} – {date_end}"
                      if date_end != date_start else date_start)
        results.append({
            "house":       "Sotheby's",
            "title":       title,
            "location":    location,
            "date_start":  date_start,
            "date_end":    date_end,
            "date_label":  date_label,
            "url":         url,
            "has_catalog": "True" if url else "False",
            "source":      "Sotheby's",
        })

    # Dedup by (date_start, title) since URL matching is best-effort.
    seen = set()
    unique = []
    for row in results:
        key = (row["date_start"], row["title"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def main():
    print("Scraping Sotheby's watch auctions calendar...")
    auctions = scrape()
    out_file = "sothebys_auctions_listings.csv"
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "house", "title", "location", "date_start", "date_end",
            "date_label", "url", "has_catalog", "source",
        ])
        writer.writeheader()
        writer.writerows(auctions)
    print(f"\n✓ Saved {len(auctions)} auction(s) to {out_file}")
    for a in auctions:
        print(f"  {a['date_label']:25s} {a['location']:15s} {a['title']}")


if __name__ == "__main__":
    main()
