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


# ── Model / sub-model derivation ─────────────────────────────────────

# Per-brand non-lexical sub-line parents. The index stores some sub-
# models as their own `### Model line:` entries — e.g. "Planet Ocean"
# is structurally a Seamaster sub-line but you'd never know from the
# string. Add an entry here when a sub-model's parent isn't lexically
# present in the model_line string. Lexical cases (e.g. "Speedmaster
# Reduced" → model=Speedmaster, sub_model=Reduced) are handled by the
# split logic below; this override only catches the disconnected ones.
SUB_LINE_PARENTS = {
    "Omega": {
        "Planet Ocean": "Seamaster",
        "Ploprof": "Seamaster",
        "Flightmaster": "Speedmaster",  # debatable; Mark may want it standalone
    },
    # Tudor entries added when Tudor lands in the index.
    # Patek: Aquanaut + Calatrava are sibling lines, not Nautilus subs.
    # AP: Royal Oak variants all lexically start with "Royal Oak".
}

# Multi-word model names that should be treated as a single token by
# the model/sub_model split. Without this list, "Royal Oak Selfwinding"
# gets split as model="Royal" / sub_model="Oak Selfwinding" — wrong.
# Order matters: longer/more-specific first so "Royal Oak Offshore"
# wins over "Royal Oak" when both match a prefix.
KNOWN_MULTIWORD_MODELS = {
    "Audemars Piguet": [
        "Royal Oak Offshore", "Royal Oak Concept", "Royal Oak",
        "Jules Audemars", "Edward Piguet", "Code 11.59", "AP Square",
    ],
    "Patek Philippe": [
        "Annual Calendar", "World Time", "Perpetual Calendar",
        "Grand Complications", "Golden Ellipse", "Twenty~4",
    ],
    "Rolex": ["Oyster Perpetual"],
    "Heuer": ["Triple Calendar"],
    "Jaeger-LeCoultre": ["Master Control", "Reverso Tribute", "Reverso Squadra"],
    "Vacheron Constantin": ["Métiers d'Art", "Les Cabinotiers"],  # for when VC lands
    "A. Lange & Söhne": ["Grand Lange 1", "Lange 1"],
    "Universal Genève": ["Tri-Compax", "Uni-Compax"],
}

# Parenthetical annotations that are metadata, not a sub-model.
# "Carrera (vintage)" → model=Carrera, sub_model=None (era stripped).
_ERA_ANNOTATIONS = re.compile(
    r"^(vintage|modern|early|additions?|additional|"
    r"additions?\s+(?:and|—)\s+.+|"
    r"addition\s+—.+|"
    r"two[\s-]?tone\s+additions?|"
    r"new\s+model\s+line|"
    r"separate\s+sub[\s-]?line|"
    r"clarification.*|"
    r"historical\s+addition.*|"
    r"e[\d]+\s+executions?|"
    r"ref\s+\d+.*|"
    r".*\bdial\s+variants?\b.*|"
    r".*\bsub[\s-]?references?\b.*)$",
    re.IGNORECASE,
)


def derive_model_sub_model(brand: str, model_line: str) -> tuple[str | None, str | None]:
    """Return (model, sub_model) derived from a brand + model_line.

    Heuristic, not perfect — designed to give the recommender + the
    eventual per-reference UI a structured handle on the hierarchy
    without forcing a full index restructure. Iterate the overrides
    table when new brands surface counter-examples.

    Examples:
      ("Omega",  "Speedmaster")                       → ("Speedmaster", None)
      ("Omega",  "Speedmaster Reduced")               → ("Speedmaster", "Reduced")
      ("Omega",  "Planet Ocean")                      → ("Seamaster",  "Planet Ocean")
      ("Omega",  "Seamaster Aqua Terra")              → ("Seamaster", "Aqua Terra")
      ("Omega",  "Seamaster 300 / SMP Diver 300M")    → ("Seamaster", "300 / SMP Diver 300M")
      ("Heuer",  "Carrera (vintage)")                 → ("Carrera",   None)
      ("Rolex",  "Daytona / Cosmograph")              → ("Daytona",   "Cosmograph")
      ("Rolex",  "Datejust (Two-tone additions)")     → ("Datejust",  None)
    """
    if not model_line:
        return None, None

    # Strip parenthetical annotation — usually era / "additions" metadata.
    m = re.match(r"^(.+?)\s*\((.+)\)\s*$", model_line)
    if m:
        bare = m.group(1).strip()
        annotation = m.group(2).strip()
        if _ERA_ANNOTATIONS.match(annotation):
            # Pure metadata — strip and continue with the bare name.
            model_line = bare
        else:
            # Real annotation that names refs / variants — keep but
            # parse the bare for model/sub_model.
            model_line = bare

    # Brand-specific non-lexical sub-line parents take precedence
    # (e.g. Planet Ocean → Seamaster).
    overrides = SUB_LINE_PARENTS.get(brand, {})
    if model_line in overrides:
        return overrides[model_line], model_line

    # Multi-word model names ("Royal Oak", "Annual Calendar", "Oyster
    # Perpetual" etc.) — match the longest known multi-word model that
    # prefixes the model_line and split there. KNOWN_MULTIWORD_MODELS
    # is already ordered longest-first per brand.
    for known in KNOWN_MULTIWORD_MODELS.get(brand, []):
        if model_line == known:
            return known, None
        if model_line.startswith(known + " ") or model_line.startswith(known + "/"):
            tail = model_line[len(known):].strip(" /") or None
            return known, tail

    # Compound "X / Y" — first segment is the model, rest becomes sub_model
    # when it actually adds information (Daytona / Cosmograph names two
    # aliases for the same watch — sub_model="Cosmograph" works fine as
    # a label). Drop trivial " / Y" cases where Y is the same word with
    # a number suffix ("GMT-Master / GMT-Master II" → just take primary
    # since the II is itself a sub_model handled at the listing level).
    if "/" in model_line:
        primary, *rest = [p.strip() for p in model_line.split("/")]
        sub = " / ".join(rest) if rest else None
        # If sub starts with the same word as primary, drop it (it's the
        # versioned variant — let listing-level matching identify which
        # generation; the model_line stays at "GMT-Master").
        if sub and primary and sub.split()[0].lower() == primary.split()[0].lower():
            return primary, None
        return primary, sub

    # Single-word model_line.
    words = model_line.split()
    if len(words) == 1:
        return model_line, None

    # Multi-word, no slash, no brand override → first word is model,
    # the rest is sub_model.
    return words[0], " ".join(words[1:])


# ── Tokenizer expansion (Lever 2, 2026-05-17) ─────────────────────────

# Tokens that LOOK like ref numbers but ARE NOT (bracelet refs, depth
# ratings, caliber refs, strap codes). From patch 01's "Tokenizer
# Implementation Notes" section + Mark's 2026-05-17 spec. Stored
# normalized; the match path skips any candidate token whose
# normalized form lands in this set.
#
# Without this set, e.g. `1171` (an Omega folded-link bracelet ref)
# matched against any in-index ref happening to normalize to `1171`,
# producing a false-positive watch match on bracelet-only listings.
EXCLUDED_TOKENS: set[str] = {
    # Bracelet refs
    "1171",   # Omega folded-link
    "78350",  # Rolex solid-link Oyster
    "78360",  # Rolex Oyster
    # Caliber refs commonly in titles + descriptions
    "8531",   # IWC Ingenieur
    "8541",   # IWC Ingenieur / Aquatimer
    "146hp",  # Zenith El Primero variant caliber
    # Strap codes
    "1001",   # Zenith
    # Depth ratings (always written as "Nm" or "NM"; these stay in)
    "100m", "120m", "150m", "200m", "300m", "600m", "1000m",
}

# Partial-prefix maps for Omega + Zenith. When a listing has a long
# modern ref like `Omega Speedmaster 311.30.42.30.01.005`, the index
# typically has either the full ref OR just the model-line entry —
# neither lexically matches the listing's token. These maps
# additionally register the 2-segment prefix (e.g. `311.30`) so the
# match lands on the model line. Built from patch 01's Tokenizer
# Implementation Notes section.
OMEGA_PREFIX_MAP: dict[str, tuple[str, str]] = {
    "311.30": ("Omega", "Speedmaster"),
    "311.32": ("Omega", "Speedmaster"),
    "310.30": ("Omega", "Speedmaster"),
    "310.32": ("Omega", "Speedmaster"),
    "310.60": ("Omega", "Speedmaster"),
    "311.10": ("Omega", "Speedmaster"),
    "311.12": ("Omega", "Speedmaster"),
    "311.92": ("Omega", "Speedmaster"),
    "233.32": ("Omega", "Seamaster 300 / SMP Diver 300M"),
    "234.30": ("Omega", "Seamaster 300 / SMP Diver 300M"),
    "212.30": ("Omega", "Seamaster 300 / SMP Diver 300M"),
    "232.30": ("Omega", "Seamaster 300 / SMP Diver 300M"),
    "210.30": ("Omega", "Seamaster 300 / SMP Diver 300M"),
    "210.32": ("Omega", "Seamaster 300 / SMP Diver 300M"),
    "215.30": ("Omega", "Planet Ocean"),
    "215.33": ("Omega", "Planet Ocean"),
    "215.92": ("Omega", "Planet Ocean"),
    "220.10": ("Omega", "Seamaster Aqua Terra"),
    "220.12": ("Omega", "Seamaster Aqua Terra"),
    "231.10": ("Omega", "Seamaster Aqua Terra"),
    "231.12": ("Omega", "Seamaster Aqua Terra"),
}

ZENITH_PREFIX_MAP: dict[str, tuple[str, str]] = {
    "3100.3600": ("Zenith", "Chronomaster"),
    "3201.3600": ("Zenith", "Chronomaster"),
    "3114.3600": ("Zenith", "Chronomaster"),
    "3119.3600": ("Zenith", "Chronomaster"),
    "3200.3600": ("Zenith", "Chronomaster"),
    "3200.3800": ("Zenith", "Chronomaster"),
    "9300.3630": ("Zenith", "Defy"),
    "9301.3620": ("Zenith", "Defy"),
    "9100.9020": ("Zenith", "Defy"),
    "4000.3652": ("Zenith", "Pilot"),
    "400.57":    ("Zenith", "El Primero"),
    "400.69":    ("Zenith", "El Primero"),
    "400.70":    ("Zenith", "El Primero"),
}


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
    """{normalized_ref → [(brand, model_line, raw_ref)]}

    Also registers Omega + Zenith partial-prefix entries so long
    modern refs (e.g. Omega 311.30.42.30.01.005) match by their
    2-segment prefix when the full ref isn't in the index.
    """
    idx: dict[str, list] = defaultdict(list)
    for brand, models in brands.items():
        for m in models:
            for raw in m["refs"]:
                norm = normalize_ref(raw)
                if len(norm) >= 3 and norm not in EXCLUDED_TOKENS:
                    idx[norm].append((brand, m["model_line"], raw))

    # Inject partial-prefix entries. These only register if there's no
    # exact-ref entry already at that normalized key (so curated index
    # entries always win).
    for prefix, (brand, model_line) in {**OMEGA_PREFIX_MAP,
                                         **ZENITH_PREFIX_MAP}.items():
        norm = normalize_ref(prefix)
        if norm and norm not in idx:
            idx[norm].append((brand, model_line, prefix))
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
    if n not in EXCLUDED_TOKENS:
        yield n

    # Dash- and slash-segmented refs (Enicar 144-35-02 → 144,
    # Blancpain 5015A-1130-52A → 5015A → 5015). Try the first segment
    # of the raw input BEFORE normalization, so we don't lose the
    # dash boundaries that normalize_ref strips.
    if any(sep in ref for sep in ("-", "/")):
        first_segment = re.split(r"[\-/]", ref, maxsplit=1)[0]
        first_norm = normalize_ref(first_segment)
        if first_norm and first_norm not in seen and first_norm not in EXCLUDED_TOKENS:
            seen.add(first_norm)
            yield first_norm

    # Strip a trailing "letter + N-digit dial code" (5120g001 -> 5120,
    # 5905p024 -> 5905, 14813bc014 -> 14813bc which then falls through
    # to the next step). Matches Patek + similar dial-suffix patterns.
    m = re.match(r"^(\d+[a-z]?[a-z]?)([a-z]\d{2,4})$", n)
    if m:
        v = m.group(1)
        if v not in seen and len(v) >= 3 and v not in EXCLUDED_TOKENS:
            seen.add(v)
            yield v

    # Strip all trailing letters (1533g -> 1533, 116710blro -> 116710).
    # This handles Rolex suffix codes and Heuer letter variants.
    stripped = re.sub(r"[a-z]+$", "", n)
    if (stripped != n and stripped not in seen and len(stripped) >= 3
            and stripped not in EXCLUDED_TOKENS):
        seen.add(stripped)
        yield stripped

    # Strip a trailing 2-digit year code (Omega 145.022-69 -> 145.022
    # after normalize is 14502269 -> 145022).
    if len(n) >= 6:
        candidate = n[:-2]
        if (candidate not in seen and len(candidate) >= 4
                and candidate not in EXCLUDED_TOKENS):
            yield candidate


def match_against_index(text: str, ref_index: dict):
    """Try each candidate token; return first index hit as a dict:
        {brand, model_line, model, sub_model, raw_ref}
    or None on no match.

    `model_line` is the literal label from the index (e.g.
    "Seamaster 300 / SMP Diver 300M" or "Planet Ocean").
    `model` + `sub_model` are derived via derive_model_sub_model so
    consumers can facet at the cleaner Brand > Model > Sub-model
    hierarchy without forcing the index to be restructured.

    For each token, tries progressive normalizations (full → variant
    → base) and stops at the first match.
    """
    for tok in candidate_tokens(text):
        for norm in progressive_normalizations(tok):
            if norm in ref_index:
                brand, model_line, raw_ref = ref_index[norm][0]
                model, sub_model = derive_model_sub_model(brand, model_line)
                return {
                    "brand": brand,
                    "model_line": model_line,
                    "model": model,
                    "sub_model": sub_model,
                    "raw_ref": raw_ref,
                }
    return None


# ── Hybrid match (Lever 3, 2026-05-17) ────────────────────────────────

def match_or_extract(
    text: str,
    ref_index: dict,
    brand: str | None = None,
    brands_in_index: set | None = None,
):
    """Hybrid match: full index lookup first, bare-ref extraction
    fallback when brand is in-index but no full ref-match landed.

    Returns a dict with `reference_id` set to the canonical raw_ref
    when a full match lands (matched listing → indexed entity), or
    `reference_id=None` with `reference_no` populated when only the
    bare ref token could be extracted (matched brand, unindexed ref).

    The "matched brand, unindexed ref" case is what the strategy doc
    calls the hybrid layer — gives the per-reference page a hook to
    group "Rolex (other refs)" rather than dropping the listing
    entirely. Same partial signal the original regex baseline gave
    pre-index.

    Shape:
      Full match     → {brand, reference_id, reference_no, model, sub_model, model_line, source: "index"}
      Hybrid match   → {brand, reference_id: None, reference_no: <bare>, model: None, sub_model: None, model_line: None, source: "regex"}
      No match       → None
    """
    # Layer 1: full index match.
    hit = match_against_index(text, ref_index)
    if hit:
        return {
            "brand": hit["brand"],
            "reference_id": hit["raw_ref"],     # canonical id from index
            "reference_no": hit["raw_ref"],     # same — full match
            "model": hit["model"],
            "sub_model": hit["sub_model"],
            "model_line": hit["model_line"],
            "source": "index",
        }
    # Layer 2: brand-known fallback — extract bare ref via the same
    # candidate-token machinery, return partial info. Only fires when
    # the listing's brand is in-index (otherwise we'd produce
    # uncontextualised ref numbers).
    if brand and brands_in_index and brand in brands_in_index:
        for tok in candidate_tokens(text):
            # Skip excluded tokens (bracelet refs / depth ratings /
            # caliber refs) just like full match does.
            norm = normalize_ref(tok)
            if not norm or norm in EXCLUDED_TOKENS:
                continue
            # Filter pure-year tokens — same defensive rule as the
            # original regex survey. 1900-2099 are years, not refs.
            if tok.isdigit() and 1900 <= int(tok) <= 2099:
                continue
            if len(norm) < 3:
                continue
            return {
                "brand": brand,
                "reference_id": None,           # not in index
                "reference_no": tok,            # bare extracted token
                "model": None,
                "sub_model": None,
                "model_line": None,
                "source": "regex",
            }
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
    # Lever 3 — hybrid match counter. Tracks listings where the brand
    # is in-index but no full ref-match landed; we extracted a bare
    # ref token via regex. Partial info, gives the per-reference page
    # a "Rolex (other refs)" grouping hook.
    hybrid_hits = Counter()

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
        if not hit and is_in_index:
            # Lever 3 fallback — bare-ref regex extraction when brand
            # is known. Doesn't count toward `brand_hit` (which tracks
            # full index matches), but does count toward partial info.
            hybrid = match_or_extract(title, ref_index, brand=brand,
                                       brands_in_index=brands_in_index)
            if not hybrid:
                clean = re.sub(r"<[^>]+>", " ", desc)
                hybrid = match_or_extract(clean[:2000], ref_index,
                                           brand=brand,
                                           brands_in_index=brands_in_index)
            if hybrid and hybrid.get("source") == "regex":
                hybrid_hits[brand] += 1

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
    total_hybrid = sum(hybrid_hits.values())
    combined = total_hit + total_hybrid
    print(f"\nFull index match:   {total_hit}/{n} = {total_hit/n:.1%}")
    if in_index_t:
        print(f"In-index brands:    {in_index_h}/{in_index_t} = {in_index_h/in_index_t:.1%}")
    print(f"Hybrid (brand+ref): {total_hybrid}/{n} = {total_hybrid/n:.1%}  "
          f"(brand known, ref not in index — bare token extracted)")
    print(f"Combined positive:  {combined}/{n} = {combined/n:.1%}")
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

    # Sample hits sanity-check — now shows the derived model + sub_model.
    print("\nSample hits (10 random):")
    import random
    random.seed(0)
    for brand, title, hit in random.sample(hits, min(10, len(hits))):
        sub = f" [{hit['sub_model']}]" if hit.get("sub_model") else ""
        print(f"  [{brand:<18}] → {hit['brand']} / {hit['model']}{sub} "
              f"via {hit['raw_ref']!r}  (model_line: {hit['model_line']})")


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
