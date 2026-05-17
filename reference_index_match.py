"""Match watchlist data against the curated reference index.

Reads docs/watch_references.md, parses each brand → model line → refs
into an in-memory index, then walks every listing / auction lot in
public/*.json and reports how many find a match.

This is the index-based alternative to reference_survey.py's regex-
extraction approach: instead of guessing which token in a title might
be a ref, we look up known refs against the curated list.

Output is a printed report. Doesn't modify any files. Re-runnable as
the index grows.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).parent
INDEX_PATH = ROOT / "docs" / "watch_references.md"
PUBLIC = ROOT / "public"


# ── Parser ───────────────────────────────────────────────────────────

# Match lines like:
#   ## Brand: Rolex
#   ### Model line: Submariner
#   - **Refs**: `6204`, `6205`, ...
#   - **Common nicknames**: ...
RE_BRAND = re.compile(r"^##\s+Brand:\s+(.+?)\s*$")
RE_MODEL = re.compile(r"^###\s+Model line:\s+(.+?)\s*$")
RE_FIELD = re.compile(r"^-\s+\*\*([^*]+)\*\*:\s*(.+?)\s*$")
RE_TICKED = re.compile(r"`([^`]+)`")
RE_PAREN_ANNOTATION = re.compile(r"\s*\([^)]*\)\s*")


def parse_index(text: str) -> dict:
    """Parse the curated reference markdown into a brand/model dict."""
    brands: dict[str, list[dict]] = {}
    cur_brand = None
    cur_model = None
    for line in text.splitlines():
        m = RE_BRAND.match(line)
        if m:
            cur_brand = m.group(1).strip()
            brands.setdefault(cur_brand, [])
            cur_model = None
            continue
        m = RE_MODEL.match(line)
        if m and cur_brand:
            cur_model = {
                "model_line": m.group(1).strip(),
                "refs": [],
                "nicknames": [],
                "years": "",
                "notes": "",
            }
            brands[cur_brand].append(cur_model)
            continue
        m = RE_FIELD.match(line)
        if m and cur_model:
            key = m.group(1).strip().lower()
            value = m.group(2).strip()
            if key == "refs":
                refs = []
                for raw in RE_TICKED.findall(value):
                    # Drop parenthetical annotations like "(n/a—Explorer)"
                    cleaned = RE_PAREN_ANNOTATION.sub("", raw).strip()
                    # Strip stray quote chars
                    cleaned = cleaned.strip('"').strip("'").strip()
                    # Some entries are slash-separated dual refs like
                    # `5513/5512 Maxi` — split on slash and on whitespace.
                    parts = re.split(r"[/\s]+", cleaned)
                    for p in parts:
                        p = p.strip().strip(',').strip('.')
                        if len(p) >= 3 and re.search(r"\d", p):
                            refs.append(p)
                cur_model["refs"] = refs
            elif key in {"common nicknames", "nicknames"}:
                # Extract quoted strings as the nickname list.
                cur_model["nicknames"] = re.findall(r'"([^"]+)"', value) or \
                                          re.findall(r"“([^”]+)”", value)
            elif key == "years":
                cur_model["years"] = value
            elif key == "notes":
                cur_model["notes"] = value
    return brands


# ── Index ────────────────────────────────────────────────────────────

def normalize_ref(ref: str) -> str:
    """Lowercase + strip separators + strip boutique prefix/suffix."""
    if not ref:
        return ""
    s = ref.lower().strip()
    # Rolex boutique -0001 / -0002 dial-variant suffix
    s = re.sub(r"-000\d$", "", s)
    # Strip leading 'm' on Rolex boutique refs (m116610ln)
    s = re.sub(r"^m(?=\d)", "", s)
    # Strip whitespace, hyphens, slashes, dots
    s = re.sub(r"[\s\-/.]+", "", s)
    return s


def build_ref_index(brands: dict) -> dict[str, list[tuple[str, str, str]]]:
    """{normalized_ref → [(brand, model_line, raw_ref)]}"""
    idx: dict[str, list] = defaultdict(list)
    for brand, models in brands.items():
        for m in models:
            for raw in m["refs"]:
                norm = normalize_ref(raw)
                if len(norm) >= 3:
                    idx[norm].append((brand, m["model_line"], raw))
    return idx


def build_nickname_index(brands: dict) -> dict[str, list[tuple[str, str, str]]]:
    """{lowercase_nickname → [(brand, model_line, nickname)]}"""
    idx: dict[str, list] = defaultdict(list)
    for brand, models in brands.items():
        for m in models:
            for nick in m["nicknames"]:
                k = nick.lower().strip()
                if k:
                    idx[k].append((brand, m["model_line"], nick))
    return idx


# ── Matching ────────────────────────────────────────────────────────

# Candidate ref tokens look like 4-6 digit numbers optionally followed
# by uppercase letters / suffix codes / digits. Allow a leading "Ref."
# or "Reference" lead-in (handled separately via regex preference) and
# slashes / hyphens inside the ref proper (5711/1A-001).
RE_REF_CANDIDATE = re.compile(
    r"""\b
        (?:m)?              # boutique 'm' prefix
        \d{3,6}             # 3-6 digit base
        (?:[A-Z]{1,6})?     # optional letter suffix (LN, BLRO, etc)
        (?:[/.\-]\d{1,4}    # dotted/slashed extension (5711/1A-001, 101.021)
           (?:[A-Z]{0,4})?
        )?
    \b""",
    re.VERBOSE,
)

# Also match dotted Omega-style refs like 145.022-69 (handled by RE_REF
# above), AP/Patek style `XXXXX(material)` like 15510ST.OO.1320ST.04,
# and Cartier W-codes (WGTA0043, WSSA0018).
RE_AP_PATEK = re.compile(r"\b\d{4,5}[A-Z]{2}(?:\.[A-Z0-9]+)*\b")
RE_CARTIER_W = re.compile(r"\b[Ww][A-Za-z]{2,4}\d{4,5}\b")
RE_REF_LEADIN = re.compile(
    r"\b(?:Reference|Ref\.?|Ref|Réf\.?)\s+", re.IGNORECASE,
)


def candidate_tokens(text: str) -> list[str]:
    """Return all plausible ref tokens in a string."""
    if not text:
        return []
    seen = set()
    out = []
    # Leading "Reference X" gets priority — emit X first.
    m = RE_REF_LEADIN.search(text)
    if m:
        tail = text[m.end():]
        for r in [RE_REF_CANDIDATE, RE_AP_PATEK, RE_CARTIER_W]:
            for tok in r.findall(tail[:40]):
                if tok not in seen:
                    seen.add(tok)
                    out.append(tok)
    for r in [RE_REF_CANDIDATE, RE_AP_PATEK, RE_CARTIER_W]:
        for tok in r.findall(text):
            if tok not in seen:
                seen.add(tok)
                out.append(tok)
    return out


def progressive_normalizations(ref: str):
    """Yield normalizations in most-specific-first order.

    Listings often carry full ref variants (5120G-001) while the index
    holds the base ref (5120) or an intermediate variant (5120G). Try
    the full token first so we get the dial-specific match when
    possible, then fall back to bracelet variant, then base.
    """
    n = normalize_ref(ref)
    if not n:
        return
    seen = {n}
    yield n

    # Strip a trailing "letter + N-digit dial code" (5120g001 -> 5120,
    # 5905p024 -> 5905, 14813bc014 -> 14813bc which then falls through
    # to the next step). Matches Patek + similar dial-suffix patterns.
    m = re.match(r"^(\d+[a-z]?[a-z]?)([a-z]\d{2,4})$", n)
    if m:
        v = m.group(1)
        if v not in seen and len(v) >= 3:
            seen.add(v)
            yield v

    # Strip all trailing letters (1533g -> 1533, 116710blro -> 116710).
    # This handles Rolex suffix codes and Heuer letter variants.
    stripped = re.sub(r"[a-z]+$", "", n)
    if stripped != n and stripped not in seen and len(stripped) >= 3:
        seen.add(stripped)
        yield stripped

    # Strip a trailing 2-digit year code (Omega 145.022-69 -> 145.022
    # after normalize is 14502269 -> 145022).
    if len(n) >= 6:
        candidate = n[:-2]
        if candidate not in seen and len(candidate) >= 4:
            yield candidate


def match_against_index(text: str, ref_index: dict) -> tuple[str, str, str] | None:
    """Try each candidate token; return first index hit as (brand, model_line, raw_ref).

    For each token, tries progressive normalizations (full → variant
    → base) and stops at the first match.
    """
    for tok in candidate_tokens(text):
        for norm in progressive_normalizations(tok):
            if norm in ref_index:
                return ref_index[norm][0]
    return None


# ── Runner ──────────────────────────────────────────────────────────

def title_of(item: dict) -> str:
    return item.get("title") or item.get("ref") or ""


def survey_source(items, label: str, ref_index: dict, brands_in_index: set):
    if isinstance(items, dict):
        items = list(items.values())
    n = len(items)
    if n == 0:
        return
    print()
    print("=" * 72)
    print(f"{label}: {n} items")
    print("=" * 72)

    brand_total = Counter()
    brand_hit = Counter()
    in_index_total = Counter()
    in_index_hit = Counter()
    source_total = Counter()
    source_hit = Counter()
    misses_by_brand = defaultdict(list)
    hits = []
    text_used = Counter()

    for it in items:
        title = title_of(it)
        desc = it.get("desc") or it.get("description") or ""
        brand = (it.get("brand") or "").strip()
        source = it.get("source") or it.get("house") or "Unknown"

        brand_total[brand] += 1
        source_total[source] += 1
        is_in_index = brand in brands_in_index
        if is_in_index:
            in_index_total[brand] += 1

        # Try title first.
        hit = match_against_index(title, ref_index)
        used = "title"
        if not hit:
            # Then description (stripped of HTML).
            clean = re.sub(r"<[^>]+>", " ", desc)
            hit = match_against_index(clean[:2000], ref_index)
            used = "desc" if hit else "—"

        if hit:
            brand_hit[brand] += 1
            source_hit[source] += 1
            text_used[used] += 1
            if is_in_index:
                in_index_hit[brand] += 1
            hits.append((brand, title[:80], hit))
        else:
            if is_in_index and len(misses_by_brand[brand]) < 6:
                misses_by_brand[brand].append(title)

    total_hit = sum(brand_hit.values())
    in_index_t = sum(in_index_total.values())
    in_index_h = sum(in_index_hit.values())
    print(f"\nOverall: {total_hit}/{n} = {total_hit/n:.1%}")
    if in_index_t:
        print(f"In-index brands only: {in_index_h}/{in_index_t} = {in_index_h/in_index_t:.1%}")
    print(f"  via title: {text_used['title']}  via desc: {text_used['desc']}")
    print()

    # Per-brand: rank by share-of-corpus
    print("Per-brand (top 20):")
    print(f"  {'brand':<24} {'hit':>6} {'total':>6} {'rate':>6}  in_index")
    for brand, n_b in brand_total.most_common(20):
        in_idx = brand in brands_in_index
        rate = brand_hit[brand] / n_b if n_b else 0
        flag = " " if rate >= 0.75 else ("·" if rate >= 0.40 else "✗")
        idx_marker = "✓" if in_idx else " "
        print(f"  {flag} {brand:<22} {brand_hit[brand]:>6} {n_b:>6} {rate:>6.1%}     {idx_marker}")

    # Misses per in-index brand (these are the actionable gaps)
    print("\nSample misses on in-index brands (showing where index could grow):")
    for brand, titles in sorted(misses_by_brand.items(), key=lambda kv: -in_index_total[kv[0]])[:6]:
        if not titles:
            continue
        print(f"\n  --- {brand} ({in_index_total[brand]-in_index_hit[brand]} misses) ---")
        for t in titles[:5]:
            print(f"    {t[:120]}")

    # Sample hits sanity-check
    print("\nSample hits (10 random):")
    import random
    random.seed(0)
    for brand, title, (b2, model_line, raw_ref) in random.sample(hits, min(10, len(hits))):
        print(f"  [{brand:<18}] → {b2} / {model_line} via {raw_ref!r}")


def write_gap_report(brands: dict, ref_index: dict, out_path: Path):
    """Walk every source, collect ref-shaped tokens that didn't match,
    and write a brand-grouped markdown report so the index author can
    grow the index against real-world gaps.
    """
    in_index = set(brands.keys())
    miss_tokens: dict[str, Counter] = defaultdict(Counter)
    listing_examples: dict[str, list] = defaultdict(list)

    sources = [
        PUBLIC / "listings.json",
        PUBLIC / "auction_lots.json",
        PUBLIC / "loupethis_lots.json",
    ]
    for p in sources:
        if not p.exists():
            continue
        with open(p) as f:
            data = json.load(f)
        if isinstance(data, dict):
            data = list(data.values())
        for it in data:
            title = title_of(it)
            desc = it.get("desc") or it.get("description") or ""
            brand = (it.get("brand") or "").strip()
            if brand not in in_index:
                continue
            if match_against_index(title, ref_index):
                continue
            text_clean = re.sub(r"<[^>]+>", " ", desc)
            if match_against_index(text_clean[:2000], ref_index):
                continue
            for t in candidate_tokens(title):
                if any(n in ref_index for n in progressive_normalizations(t)):
                    continue
                # Filter obvious noise: short / pure year.
                if len(t) < 4:
                    continue
                if t.isdigit() and 1900 <= int(t) <= 2099:
                    continue
                miss_tokens[brand][t] += 1
                seen = {x[0] for x in listing_examples[brand]}
                if t not in seen and len(listing_examples[brand]) < 50:
                    listing_examples[brand].append((t, title[:120]))

    lines = ["# Reference index gaps — concrete miss report",
             "",
             "Generated by `python3 reference_index_match.py`. These are tokens that look like reference numbers in real listings whose brand IS covered by the index, but the specific ref isn't.",
             "",
             "For each brand below, skim the table and decide which refs deserve to be added to the corresponding model line in `docs/watch_references.md`. Treat the count as priority (high-count refs first). If a ref doesn't fit any existing model line, propose a new one.",
             ""]
    for brand in sorted(miss_tokens.keys(), key=lambda b: -sum(miss_tokens[b].values())):
        tokens = miss_tokens[brand]
        examples = dict(listing_examples[brand])
        lines.append(f"## {brand}")
        lines.append("")
        lines.append(f"{sum(tokens.values())} miss events across {len(tokens)} distinct tokens.")
        lines.append("")
        lines.append("| Token | Count | Example title |")
        lines.append("|---|---:|---|")
        for tok, c in tokens.most_common(40):
            ex = examples.get(tok, "").replace("|", "\\|")
            lines.append(f"| `{tok}` | {c} | {ex} |")
        lines.append("")

    out_path.write_text("\n".join(lines))
    total_events = sum(sum(c.values()) for c in miss_tokens.values())
    print(f"\nWrote {out_path} — {len(miss_tokens)} brands, {total_events} miss events")


def main():
    print(f"Parsing {INDEX_PATH}...")
    brands = parse_index(INDEX_PATH.read_text())
    print(f"  Brands in index: {len(brands)}")
    total_models = sum(len(v) for v in brands.values())
    print(f"  Model lines:     {total_models}")
    ref_index = build_ref_index(brands)
    print(f"  Distinct refs:   {len(ref_index)}")
    total_ref_entries = sum(len(v) for v in ref_index.values())
    print(f"  Ref entries:     {total_ref_entries}")
    nick_index = build_nickname_index(brands)
    print(f"  Nicknames:       {len(nick_index)}")
    print()
    print(f"Brands covered: {', '.join(sorted(brands.keys()))}")

    brands_in_index = set(brands.keys())

    sources = [
        ("listings", PUBLIC / "listings.json"),
        ("auction_lots", PUBLIC / "auction_lots.json"),
        ("loupethis_lots", PUBLIC / "loupethis_lots.json"),
        ("manual_archive_lots", PUBLIC / "manual_archive_lots.json"),
    ]
    for name, p in sources:
        if not p.exists():
            continue
        with open(p) as f:
            data = json.load(f)
        survey_source(data, str(p), ref_index, brands_in_index)

    # Side effect: regenerate the gap report so the index author has
    # a concrete list of refs to grow toward.
    write_gap_report(brands, ref_index, ROOT / "docs" / "watch_references_gaps.md")


if __name__ == "__main__":
    main()
