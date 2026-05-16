"""
Epic 0 kickoff — survey current listings.json + auction lot files
and measure what % of titles parse cleanly with a regex-first pass.

Output is a written report (stdout) describing:
  - overall hit rate
  - per-brand hit rate (top 15)
  - per-source hit rate (so we can see which dealers structure their
    refs well vs which are free-text noise)
  - sample misses (5 per brand) to inform fallback investment

Re-run any time the data shifts. Does not write any files.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Optional, Tuple

ROOT = Path(__file__).parent
PUBLIC = ROOT / "public"

# Per-brand reference patterns.
# Each entry: (brand_canonical, [list of regex patterns to try in order]).
# Patterns are case-sensitive on letter suffixes by design (Rolex 126710BLRO
# is a real ref; "blro" lowercase isn't). They're applied to the title with
# a normalized lead-in word so "Reference", "Ref.", "Ref" all match.

# Strip common lead-ins before pattern matching.
REF_LEADIN = re.compile(
    r"\b(?:Reference|Ref\.?|Ref|Réf\.?)\s*"
    r"(?:no\.?\s*)?",
    re.IGNORECASE,
)

# --- Pattern catalogue ---------------------------------------------------

# Rolex: 4-6 digit base, optional letter/digit suffix (e.g. 16520,
# 126576TBR, 126710BLRO, 116520LN, 14000, 6263, 1675, 5514).
# Most common modern refs are 5-6 digits; 4-digit vintage refs (1675, 5513)
# also valid. Anchor to word boundary, allow suffix of 1-6 upper-letters
# or digits.
ROLEX = re.compile(r"\b(\d{4,6}[A-Z]{0,6}(?:LN|LV|LB|LRO)?)\b")

# Omega: dotted reference like 145.022-69 (vintage) or 311.30.42.30.01.005
# (modern, 6 dotted segments) or 145.012; trailing -NN allowed.
# Also: bare 3-4 digit refs like 2914-4 / 2998-4 (with optional letter).
OMEGA_DOT = re.compile(
    r"\b(\d{3}\.\d{2,3}(?:\.\d{2,3}){0,4}(?:\.\d{2,3})?(?:-\d{1,3})?)\b"
)
OMEGA_DASH = re.compile(r"\b(\d{3,4}-\d{1,3}(?:\s?[A-Z]{1,3})?)\b")
OMEGA_MODERN = re.compile(r"\b(\d{12,14})\b")  # e.g. 31032425002001

# Patek: 4-digit base + optional letter (J/G/P/R/A) + optional -NNN suffix
# (e.g. 5120G-001, 5905P-001, 5035J-001, 2526, 5146G-010, 1463, 5231J-001).
PATEK = re.compile(r"\b(\d{4}[A-Z]?(?:-\d{3})?)\b")

# AP: complex like 2657OR.OO.12200R.02, 25819PT/O/0002/01, 15510ST.OO.1320ST.04
# or simpler 4-5 digit base + 2-letter material code (5402ST, 14813BC, 6005SA).
AP_COMPLEX = re.compile(
    r"\b(\d{4,5}[A-Z]{2}(?:[./][A-Z0-9]+){1,5})\b"
)
AP_SIMPLE = re.compile(r"\b(\d{4,5}[A-Z]{2})\b")

# Heuer / TAG Heuer: 3-4 digit base + optional letter / -N (e.g. 3147N,
# 1133, 1133G, 2446, 2446C, 1533G, 2447S, 1153).
HEUER = re.compile(r"\b(\d{3,4}[A-Z]?[NSGCT]?(?:-\d{1,2})?)\b")

# Tudor: 4-5 digit + optional /N suffix or 1-4 letter material/colour code
# (79090, 7159/0, 79170, 94010, 7016, 79030N, 79010SG, 79360DK, 79250BB).
TUDOR = re.compile(r"\b(\d{4,5}(?:/\d{1,2}|[A-Z]{1,4})?)\b")

# Cartier: WGTA0043-style alphanumeric (W + 3 letters + 4 digits) OR
# 4-5 digit numeric (2656, 66014, 78090, 78097, 0906).
CARTIER_ALPHA = re.compile(r"\b(W[A-Z]{2,4}\d{3,5})\b")
CARTIER_NUM = re.compile(r"\b(\d{4,5})\b")

# Vacheron / IWC / JLC / Breitling: generic 4-6 digit refs.
GENERIC_NUM = re.compile(r"\b(\d{4,6}[A-Z]{0,4})\b")

# Map canonical brand → list of (regex, label) to try, in priority order.
PATTERNS = {
    "Rolex": [(ROLEX, "rolex")],
    "Omega": [(OMEGA_DOT, "omega-dot"), (OMEGA_DASH, "omega-dash"), (OMEGA_MODERN, "omega-modern")],
    "Patek Philippe": [(PATEK, "patek")],
    "Audemars Piguet": [(AP_COMPLEX, "ap-complex"), (AP_SIMPLE, "ap-simple")],
    "Heuer": [(HEUER, "heuer")],
    "TAG Heuer": [(HEUER, "heuer")],
    "Tudor": [(TUDOR, "tudor")],
    "Cartier": [(CARTIER_ALPHA, "cartier-alpha"), (CARTIER_NUM, "cartier-num")],
    "Vacheron Constantin": [(GENERIC_NUM, "generic")],
    "IWC": [(GENERIC_NUM, "generic")],
    "Jaeger-LeCoultre": [(GENERIC_NUM, "generic")],
    "Breitling": [(GENERIC_NUM, "generic")],
    "Piaget": [(GENERIC_NUM, "generic")],
    "Movado": [(GENERIC_NUM, "generic")],
    "Universal Genève": [(GENERIC_NUM, "generic")],
    "Zenith": [(GENERIC_NUM, "generic")],
    "Breguet": [(GENERIC_NUM, "generic")],
    "Longines": [(GENERIC_NUM, "generic")],
    "A. Lange & Söhne": [(GENERIC_NUM, "generic")],
    "Panerai": [(GENERIC_NUM, "generic")],
    "F.P. Journe": [(GENERIC_NUM, "generic")],
    "Richard Mille": [(GENERIC_NUM, "generic")],
    "Seiko": [(GENERIC_NUM, "generic")],
    "Grand Seiko": [(GENERIC_NUM, "generic")],
    "Other": [(GENERIC_NUM, "generic")],
}

# Brand-name canonicalization — different sources spell brands differently.
# Map alternate spellings → the canonical key used in PATTERNS.
BRAND_CANONICAL = {
    "Jaeger LeCoultre": "Jaeger-LeCoultre",
    "JLC": "Jaeger-LeCoultre",
    "A. Lange & Sohne": "A. Lange & Söhne",
    "A. Lange and Sohne": "A. Lange & Söhne",
    "Lange & Sohne": "A. Lange & Söhne",
    "F.P.Journe": "F.P. Journe",
    "FP Journe": "F.P. Journe",
    "Universal Geneve": "Universal Genève",
    "Tag Heuer": "TAG Heuer",
}


def canonical_brand(brand):
    if not brand:
        return "Other"
    return BRAND_CANONICAL.get(brand, brand)

# Words that look numeric but aren't refs (years, calibers, sizes, dial
# diameter, etc.) — used to filter false positives in a second pass.
DENY_TOKENS = {
    # Years 1900-2099 covered separately via numeric range
    "1171",  # Omega bracelet ref — actually IS a ref, leave in
}

# Year-of-manufacture / case-size / strap-width values that look like refs.
YEAR_RANGE = (1900, 2099)
SIZE_RANGE_MM = (12, 60)  # case/lug widths


def is_plausible_ref(token: str, brand: str) -> bool:
    """Filter false positives. Returns False if the token is clearly
    a year, a case-size, or otherwise noise rather than a real ref."""
    if not token:
        return False
    # Pure 4-digit year filter (e.g. "1967", "2025")
    if token.isdigit() and len(token) == 4:
        n = int(token)
        if YEAR_RANGE[0] <= n <= YEAR_RANGE[1]:
            return False
    # Pure 2-digit "size" (12mm, 36mm — usually preceded by mm so they
    # wouldn't be standalone tokens, but defense-in-depth).
    if token.isdigit() and len(token) == 2:
        n = int(token)
        if SIZE_RANGE_MM[0] <= n <= SIZE_RANGE_MM[1]:
            return False
    # Single-digit or extremely short numerics: noise.
    if token.isdigit() and len(token) < 3:
        return False
    return True


def extract_ref(title: str, brand: str) -> Tuple[Optional[str], Optional[str]]:
    """Run brand-appropriate regex(es) against the title. Return
    (ref, pattern_label) or (None, None). The 'Reference' / 'Ref'
    lead-in is preferred over a bare match — if the title contains
    that lead-in, the match anchored after it wins."""
    if not title:
        return None, None
    if brand not in PATTERNS:
        return None, None

    # Strip diacritics-light: nothing fancy, just normalize.
    text = title

    # Preferred: anchor after "Reference" / "Ref." / "Ref" — these are
    # almost always the real ref.
    leadin = REF_LEADIN.search(text)
    if leadin:
        tail = text[leadin.end():]
        for regex, label in PATTERNS[brand]:
            m = regex.search(tail)
            if m and is_plausible_ref(m.group(1), brand):
                return m.group(1), label + "+leadin"

    # Fallback: bare match anywhere in the title.
    for regex, label in PATTERNS[brand]:
        for m in regex.finditer(text):
            tok = m.group(1)
            if is_plausible_ref(tok, brand):
                return tok, label
    return None, None


# --- Survey runner -------------------------------------------------------

def load_data():
    paths = [
        ("listings", PUBLIC / "listings.json"),
        ("auction_lots", PUBLIC / "auction_lots.json"),
        ("manual_archive_lots", PUBLIC / "manual_archive_lots.json"),
        ("loupethis_lots", PUBLIC / "loupethis_lots.json"),
    ]
    out = {}
    for name, p in paths:
        try:
            with open(p) as f:
                out[name] = json.load(f)
        except FileNotFoundError:
            out[name] = []
    return out


def title_of(item: dict) -> str:
    """Each surface stores the human title in a different field.
    listings.json — `ref` is the full free-text title.
    auction_lots / loupethis_lots — `title` field.
    """
    return item.get("title") or item.get("ref") or ""


# Auction lots don't carry a `brand` field (loupethis does). Infer it from
# the title by matching the brand name as a token. Order matters — match
# longer / more specific brand names first.
BRAND_TOKENS = [
    ("Patek Philippe", re.compile(r"\bPatek\s*Philippe\b", re.IGNORECASE)),
    ("Audemars Piguet", re.compile(r"\bAudemars\s*Piguet\b", re.IGNORECASE)),
    ("Vacheron Constantin", re.compile(r"\bVacheron\s*Constantin\b", re.IGNORECASE)),
    ("Jaeger-LeCoultre", re.compile(r"\bJaeger[-\s]?LeCoultre\b", re.IGNORECASE)),
    ("A. Lange & Söhne", re.compile(r"\bA\.?\s*Lange\b", re.IGNORECASE)),
    ("TAG Heuer", re.compile(r"\bTAG\s*Heuer\b", re.IGNORECASE)),
    ("Universal Genève", re.compile(r"\bUniversal\s*Gen[eè]ve\b", re.IGNORECASE)),
    ("Richard Mille", re.compile(r"\bRichard\s*Mille\b", re.IGNORECASE)),
    ("F.P. Journe", re.compile(r"\bF\.?\s*P\.?\s*Journe\b", re.IGNORECASE)),
    ("Rolex", re.compile(r"\bRolex\b", re.IGNORECASE)),
    ("Omega", re.compile(r"\bOmega\b", re.IGNORECASE)),
    ("Heuer", re.compile(r"\bHeuer\b", re.IGNORECASE)),
    ("Cartier", re.compile(r"\bCartier\b", re.IGNORECASE)),
    ("Tudor", re.compile(r"\bTudor\b", re.IGNORECASE)),
    ("Piaget", re.compile(r"\bPiaget\b", re.IGNORECASE)),
    ("IWC", re.compile(r"\bIWC\b")),
    ("Breitling", re.compile(r"\bBreitling\b", re.IGNORECASE)),
    ("Longines", re.compile(r"\bLongines\b", re.IGNORECASE)),
    ("Movado", re.compile(r"\bMovado\b", re.IGNORECASE)),
    ("Zenith", re.compile(r"\bZenith\b", re.IGNORECASE)),
    ("Breguet", re.compile(r"\bBreguet\b", re.IGNORECASE)),
    ("Seiko", re.compile(r"\bSeiko\b", re.IGNORECASE)),
    ("Tissot", re.compile(r"\bTissot\b", re.IGNORECASE)),
]


def infer_brand(title: str) -> str:
    for canonical, regex in BRAND_TOKENS:
        if regex.search(title):
            return canonical
    return "Other"


def survey(items, label: str):
    # Accept either a list or a dict (keyed by url, value is the item).
    if isinstance(items, dict):
        items = list(items.values())
    print()
    print("=" * 72)
    print(f"{label}: {len(items)} items")
    print("=" * 72)

    brand_total = Counter()
    brand_hit = Counter()
    source_total = Counter()
    source_hit = Counter()
    pattern_hits = Counter()

    hits = []
    misses_by_brand = defaultdict(list)

    title_only_hit = 0
    desc_only_hit = 0

    for it in items:
        title = title_of(it)
        desc = it.get("desc") or it.get("description") or ""
        raw_brand = it.get("brand") or infer_brand(title)
        brand = canonical_brand(raw_brand)
        source = it.get("source") or it.get("house") or "Unknown"

        ref, pattern = extract_ref(title, brand)
        if ref:
            title_only_hit += 1
        else:
            # Strip HTML for a chance at description-buried refs.
            desc_clean = re.sub(r"<[^>]+>", " ", desc)
            ref, pattern = extract_ref(desc_clean[:1500], brand)
            if ref:
                desc_only_hit += 1
                pattern = pattern + "+desc" if pattern else None

        brand_total[brand] += 1
        source_total[source] += 1
        if ref:
            brand_hit[brand] += 1
            source_hit[source] += 1
            pattern_hits[pattern] += 1
            hits.append((brand, title, ref, pattern))
        else:
            if len(misses_by_brand[brand]) < 8:
                misses_by_brand[brand].append(title)

    total = sum(brand_total.values())
    total_hit = sum(brand_hit.values())
    print(f"\nOverall: {total_hit}/{total} = {total_hit / total:.1%} regex-parsed")
    print(f"  title-match  : {title_only_hit} ({title_only_hit / total:.1%})")
    print(f"  desc-fallback: {desc_only_hit} ({desc_only_hit / total:.1%})\n")

    # Per-brand
    print("Per-brand hit rate (sorted by count, top 20):")
    print(f"  {'brand':<22} {'hit':>6} {'total':>6} {'rate':>6}")
    for brand, n in brand_total.most_common(20):
        h = brand_hit[brand]
        rate = (h / n) if n else 0
        flag = " " if rate >= 0.75 else ("·" if rate >= 0.40 else "✗")
        print(f"  {flag} {brand:<20} {h:>6} {n:>6} {rate:>6.1%}")

    # Per-source
    print("\nPer-source hit rate (sorted by count, top 25):")
    print(f"  {'source':<26} {'hit':>6} {'total':>6} {'rate':>6}")
    for src, n in source_total.most_common(25):
        h = source_hit[src]
        rate = (h / n) if n else 0
        flag = " " if rate >= 0.75 else ("·" if rate >= 0.40 else "✗")
        print(f"  {flag} {src:<24} {h:>6} {n:>6} {rate:>6.1%}")

    # Pattern attribution
    print("\nWhich regex flavour fired:")
    for pat, n in pattern_hits.most_common():
        print(f"  {n:>5}  {pat}")

    # Sample misses for the brands we have patterns for
    print("\nSample misses (per brand, up to 5):")
    for brand in ["Rolex", "Omega", "Patek Philippe", "Audemars Piguet",
                  "Heuer", "Tudor", "Cartier", "Other"]:
        if not misses_by_brand[brand]:
            continue
        print(f"\n  --- {brand} ---")
        for t in misses_by_brand[brand][:5]:
            print(f"    {t[:120]}")

    # Sample hits — sanity check the regexes aren't grabbing junk
    print("\nSample hits (10 random):")
    import random
    random.seed(0)
    sample = random.sample(hits, min(10, len(hits)))
    for brand, title, ref, pattern in sample:
        print(f"  [{brand:<18}] ref={ref!r:<28} ({pattern}) — {title[:80]}")


def aggregate_summary(data):
    """One-screen headline summary for Mark, printed after the per-source detail."""
    sources = [
        ("listings.json", data["listings"]),
        ("auction_lots.json", data["auction_lots"]),
        ("loupethis_lots.json", data["loupethis_lots"]),
        ("manual_archive_lots.json", data["manual_archive_lots"]),
    ]
    print()
    print("=" * 72)
    print("SUMMARY")
    print("=" * 72)
    grand_total = 0
    grand_hit = 0
    grand_title = 0
    grand_desc = 0
    rows = []
    for label, items in sources:
        if isinstance(items, dict):
            items = list(items.values())
        total = len(items)
        if total == 0:
            continue
        t_hit = d_hit = 0
        for it in items:
            title = title_of(it)
            desc = it.get("desc") or it.get("description") or ""
            raw_brand = it.get("brand") or infer_brand(title)
            brand = canonical_brand(raw_brand)
            ref, _ = extract_ref(title, brand)
            if ref:
                t_hit += 1
                continue
            desc_clean = re.sub(r"<[^>]+>", " ", desc)
            ref, _ = extract_ref(desc_clean[:1500], brand)
            if ref:
                d_hit += 1
        rows.append((label, total, t_hit, d_hit))
        grand_total += total
        grand_hit += t_hit + d_hit
        grand_title += t_hit
        grand_desc += d_hit

    print(f"  {'source':<28} {'items':>7} {'title%':>8} {'+desc%':>8} {'total%':>8}")
    for label, total, t, d in rows:
        print(f"  {label:<28} {total:>7} "
              f"{t / total:>7.1%} {d / total:>7.1%} {(t + d) / total:>7.1%}")
    print(f"  {'GRAND TOTAL':<28} {grand_total:>7} "
          f"{grand_title / grand_total:>7.1%} {grand_desc / grand_total:>7.1%} "
          f"{grand_hit / grand_total:>7.1%}")


def main():
    data = load_data()
    survey(data["listings"], "listings.json (dealer inventory)")
    survey(data["auction_lots"], "auction_lots.json (auction house lots)")
    survey(data["loupethis_lots"], "loupethis_lots.json")
    survey(data["manual_archive_lots"], "manual_archive_lots.json")
    aggregate_summary(data)


if __name__ == "__main__":
    main()
