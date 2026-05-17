"""Per-auction-house parsers for the structured fields buried inside
each house's `description` and `title` strings.

The auction scrapers emit the raw description; this module pulls out
the discrete fields (reference_no, model_name, movement_no, case_no,
year_circa, dial, calibre, material, case_size) for downstream
matching against the reference index (Epic 0) and surfacing in the
per-reference research view (Epic 5).

Each `parse_*` returns a dict with whichever fields it could extract.
Missing fields are simply omitted (NOT set to None) so a caller can
spread the result into a record dict without trampling existing keys.

Formats handled today:

Sotheby's — HTML in `description`:
    <p><strong>Dial:</strong>&nbsp;mother of pearl...</p>
    <p><strong>Calibre:</strong> cal. GP3300 automatic...</p>
    <p><strong>Case: </strong>18k pink gold...</p>
    <p><strong>Case number: </strong>OR N° 3/18</p>
    <p><strong>Size: </strong>40 mm diameter</p>
    <p><strong>Signed: </strong>case, dial and movement</p>
    + sometimes "Reference X" or "Reference X-Y-Z" in title

Christie's — comma-separated key:value in `description`:
    "NAUTILUS MODEL, REF. 5711/1A-001, MOVEMENT NO. 3'402'799, CASE NO. 4'342'015, CIRCA 2006"
    "REF. 5035G, MOVEMENT NO. 3'056'447 CASE NO. 4'019'137, MANUFACTURED IN 1997"

Phillips — already pulled at scrape time from the Turbo-Stream payload
    (referenceNo + modelName on the lot dict). Nothing to parse here;
    `_phillips_lot_to_record` in auction_lots_scraper handles it directly.

Antiquorum — title-only today (their `truncated_description` is empty
    in the auction-page payload). Title format:
    "A.R. & J.E. MEYLAN, SWITZERLAND, TYPE A7 HACK WATCH, DELIVERED TO THE US ARMY, CHROME"
    The maker is the first segment, the rest is loosely structured
    prose. Returns model_name only when a "REF. X" or "REFERENCE X"
    appears in the title.
"""

from __future__ import annotations

import re


# ── Sotheby's ──────────────────────────────────────────────────────────

# Each field renders as `<strong>Label:</strong> value</p>` — sometimes
# with the colon inside the <strong>, sometimes outside, sometimes with
# trailing &nbsp; in either spot. Anchor on the structural tags and
# accept anything in between.
_SOTHEBYS_STRONG_RE = re.compile(
    r"<strong>([^<:]+):?\s*</strong>\s*([^<]+?)</p>",
    re.IGNORECASE,
)

_SOTHEBYS_LABEL_MAP = {
    "dial": "dial",
    "calibre": "calibre",
    "caliber": "calibre",
    "case": "case_material",
    "case number": "case_no",
    "case no": "case_no",
    "case no.": "case_no",
    "movement": "movement",
    "movement number": "movement_no",
    "movement no": "movement_no",
    "movement no.": "movement_no",
    "closure": "closure",
    "size": "case_size",
    "signed": "signed",
    "box": "box",
    "papers": "papers",
    "accessories": "accessories",
    "reference": "reference_no",
}

# "Reference 49534-52-R23-BB60" anywhere in title.
_REFERENCE_TITLE_RE = re.compile(
    r"\bReference\s+([A-Z0-9][A-Z0-9\-/.]{2,})", re.IGNORECASE,
)


def parse_sothebys_description(desc_html: str, title: str = "") -> dict:
    """Pull structured fields out of Sotheby's HTML description block.

    Returns a dict of whichever fields were found. `title` is consulted
    only for the reference_no fallback (their title often carries
    "Reference X" even when the description doesn't).
    """
    out: dict = {}
    if not desc_html:
        # Title-only fallback still tries reference_no.
        m = _REFERENCE_TITLE_RE.search(title or "")
        if m:
            out["reference_no"] = m.group(1).strip()
        return out

    # Strip non-breaking spaces and decode the lightest of entities so
    # the regex lands cleanly. Don't fully unescape — we want to keep
    # exotic characters (°, accents) in the values.
    text = desc_html.replace("&nbsp;", " ").replace("&amp;", "&")

    for m in _SOTHEBYS_STRONG_RE.finditer(text):
        label = m.group(1).strip().lower().rstrip(":")
        value = m.group(2).strip()
        # Drop trailing "<br>" / stray whitespace artefacts.
        value = re.sub(r"\s*<br\s*/?>\s*$", "", value, flags=re.IGNORECASE).strip()
        if not value or value.lower() in ("no", "-", "n/a", "none"):
            continue
        key = _SOTHEBYS_LABEL_MAP.get(label)
        if key:
            out[key] = value

    # Pull reference_no out of the title if the description didn't carry one.
    if "reference_no" not in out and title:
        m = _REFERENCE_TITLE_RE.search(title)
        if m:
            out["reference_no"] = m.group(1).strip()

    return out


# ── Christie's ─────────────────────────────────────────────────────────

# Christie's descriptions look like:
#   "NAUTILUS MODEL, REF. 5711/1A-001, MOVEMENT NO. 3'402'799, CASE NO. 4'342'015, CIRCA 2006"
# Apostrophe is a Unicode right-single-quote (’) for the thousands
# separator on some lots, plain ASCII on others. Handle both.

_CHRISTIES_MODEL_RE = re.compile(
    r"^\s*([A-Z][A-Z0-9 &\-/']{2,40}?)\s+MODEL\b", re.MULTILINE,
)
_CHRISTIES_REF_RE = re.compile(
    r"\bREF\.?\s+([A-Z0-9][A-Z0-9\-/.]+)", re.IGNORECASE,
)
_CHRISTIES_MOVEMENT_NO_RE = re.compile(
    r"\bMOVEMENT\s+NO\.?\s+([\d'’]+(?:[\d'’]*[\d])?)", re.IGNORECASE,
)
_CHRISTIES_CASE_NO_RE = re.compile(
    r"\bCASE\s+NO\.?\s+([\d'’]+(?:[\d'’]*[\d])?)", re.IGNORECASE,
)
_CHRISTIES_YEAR_RE = re.compile(
    r"\b(?:CIRCA|MANUFACTURED\s+IN|DATED)\s+(\d{4})\b", re.IGNORECASE,
)


def parse_christies_description(desc: str, title: str = "") -> dict:
    """Extract structured fields from Christie's compact prose."""
    out: dict = {}
    if not desc:
        return out

    m = _CHRISTIES_MODEL_RE.search(desc)
    if m:
        out["model_name"] = m.group(1).strip().title()

    m = _CHRISTIES_REF_RE.search(desc)
    if m:
        out["reference_no"] = m.group(1).strip()

    m = _CHRISTIES_MOVEMENT_NO_RE.search(desc)
    if m:
        # Normalise thousands separator to ASCII apostrophe so values
        # match across lots that use ’ vs ' randomly.
        out["movement_no"] = m.group(1).replace("’", "'").strip()

    m = _CHRISTIES_CASE_NO_RE.search(desc)
    if m:
        out["case_no"] = m.group(1).replace("’", "'").strip()

    m = _CHRISTIES_YEAR_RE.search(desc)
    if m:
        out["year_circa"] = m.group(1).strip()

    return out


# ── Antiquorum ─────────────────────────────────────────────────────────

# Antiquorum titles are comma-separated: "<MAKER>, <COUNTRY>, <MODEL>, <MATERIAL>"
# When a reference number appears it's usually mid-string as "REF. X" or
# "REFERENCE X", and rarely as "PROBABLY FOR REFERENCE X".

_ANT_REF_RE = re.compile(
    r"\bREF(?:ERENCE)?\.?\s+(?:PROBABLY\s+FOR\s+REFERENCE\s+)?([A-Z0-9][A-Z0-9\-/.]+)",
    re.IGNORECASE,
)


def parse_antiquorum_title(title: str) -> dict:
    """Extract reference_no from Antiquorum's title-only data."""
    out: dict = {}
    if not title:
        return out
    m = _ANT_REF_RE.search(title)
    if m:
        out["reference_no"] = m.group(1).strip()
    return out


# ── Brand resolution ──────────────────────────────────────────────────

# Canonical brand names — match the vocabulary listings.json uses so
# auction-lot brand values are consistent across the data layer.
# Longer / more specific names first so "Patek Philippe" beats "Patek".
CANONICAL_BRANDS = [
    "Patek Philippe", "Audemars Piguet", "Vacheron Constantin",
    "Jaeger-LeCoultre", "A. Lange & Söhne", "Universal Genève",
    "Richard Mille", "F.P. Journe", "Grand Seiko", "TAG Heuer",
    "Girard-Perregaux", "H. Moser & Cie", "Daniel Roth", "Gerald Genta",
    "Franck Muller", "Charles Frodsham", "Greubel Forsey", "MB&F",
    "Rolex", "Omega", "Heuer", "Cartier", "Tudor", "Piaget", "IWC",
    "Breitling", "Longines", "Movado", "Zenith", "Breguet", "Seiko",
    "Panerai", "Blancpain", "Bulgari", "Chopard", "Hermès", "Hublot",
    "Tissot", "Ebel", "Doxa", "Tag Heuer",  # alias of TAG Heuer
]

BRAND_ALIASES = {
    "Tag Heuer": "TAG Heuer",
    "Jaeger LeCoultre": "Jaeger-LeCoultre",
    "Jlc": "Jaeger-LeCoultre",
    "JLC": "Jaeger-LeCoultre",
    "A. Lange & Sohne": "A. Lange & Söhne",
    "Lange & Söhne": "A. Lange & Söhne",
    "Universal Geneve": "Universal Genève",
    "F.P.Journe": "F.P. Journe",
    "FP Journe": "F.P. Journe",
}

_BRAND_TOKEN_RES = [
    (b, re.compile(rf"\b{re.escape(b)}\b", re.IGNORECASE))
    for b in CANONICAL_BRANDS
]


def canonical_brand(raw: str) -> str:
    """Canonicalize a maker / brand string.

    Handles trailing ", <city>" suffixes (Sotheby's stores
    "Cartier, Paris"; we want "Cartier") and known aliases. Returns
    empty string if no canonical match.
    """
    if not raw:
        return ""
    s = raw.strip()
    # Strip trailing ", <Place>" — Sotheby's stores "Cartier, Paris",
    # "Patek Philippe, Geneva" etc.
    s = re.sub(r",\s*[A-Z][a-zA-Z]+\s*$", "", s)
    s = s.strip()
    # Direct alias hit
    if s in BRAND_ALIASES:
        return BRAND_ALIASES[s]
    # Exact canonical hit (case-sensitive first for speed)
    if s in CANONICAL_BRANDS:
        return s
    # Case-insensitive scan against canonical list
    sl = s.lower()
    for b in CANONICAL_BRANDS:
        if b.lower() == sl:
            return BRAND_ALIASES.get(b, b)
    return ""


def infer_brand(title: str) -> str:
    """Find the first canonical brand mentioned in a title string."""
    if not title:
        return ""
    for b, regex in _BRAND_TOKEN_RES:
        if regex.search(title):
            return BRAND_ALIASES.get(b, b)
    return ""


def resolve_brand(rec: dict) -> str:
    """Decide a record's canonical brand, in priority order:
       1. existing rec['brand']
       2. canonical(rec['maker'])
       3. infer from title

    Returns empty string if nothing matches — caller decides whether
    to default to "Other" or leave unset.
    """
    existing = (rec.get("brand") or "").strip()
    if existing:
        return existing
    from_maker = canonical_brand(rec.get("maker") or "")
    if from_maker:
        return from_maker
    return infer_brand(rec.get("title") or "")


# ── Public entry point ────────────────────────────────────────────────

def extract_lot_structured_fields(house: str, title: str, description: str) -> dict:
    """Dispatch on house and return a dict of structured fields.

    Empty dict if nothing was extractable. Use this from
    auction_lots_scraper when constructing the per-house record so a
    single call gives you {reference_no, model_name, ...} where
    available.
    """
    if not house:
        return {}
    if house == "Sotheby's":
        return parse_sothebys_description(description or "", title or "")
    if house == "Christie's":
        return parse_christies_description(description or "", title or "")
    if house == "Antiquorum":
        return parse_antiquorum_title(title or "")
    # Phillips is handled inline in _phillips_lot_to_record (the
    # Turbo-Stream payload carries discrete fields).
    return {}
