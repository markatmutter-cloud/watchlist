"""Per-dealer structured-field parsers for the spec blocks embedded
in scraped descriptions.

Mirrors the auction_lot_parsers.py pattern: each parser pulls discrete
fields out of free-text descriptions so listings land with the same
shape as auction lots (reference_no, model_name, year, material,
case_size, dial, movement, ...). Wired into merge.py at the dealer-
item construction site.

Five dealers covered today, all confirmed via the per-dealer audit
agents:

| Dealer            | Format                                |
|-------------------|---------------------------------------|
| Bulang & Sons     | Line-based "Specifications:" prose    |
| Craft & Tailored  | Inline KV (no colon): "SPECS Brand X Style Y Model Z…" |
| Falco Watches     | Inline KV (with colon): "THE ESSENTIALS MAKE: X MODEL: Y…" |
| Somlo             | Inline KV: "Brand: X Made: Y Model: Z Reference: W…" |
| Huntington Co.    | Inline KV (HTML-stripped <strong>):  "Reference: X Model: Y…" |

Parsers are defensive — a parsing failure returns an empty dict, never
raises. The merged result spreads into the listing item via `**`.

These parsers will only have data to work against AFTER:
  1. PR #324 / #325 per-scraper desc caps propagate via the next cron
     (lifted Bulang / C&T / Falco / Somlo / Huntington from 400 chars
     up to 2500–3000 chars each).
  2. PR #324's merge.py truncation lift (300 → 1500) is already live.

Until then the current CSVs only carry the first 400 chars of body_html,
which is usually the prose intro rather than the spec block, so initial
coverage will be low. After the next cron the structured blocks land
in CSV → merge.py → listings.json end-to-end.
"""

from __future__ import annotations

import re


# ── Per-dealer parsers ──────────────────────────────────────────────────

def parse_bulang(desc: str) -> dict:
    """Bulang & Sons — line-based 'Specifications:' block.

    Sample (from agent audit):
        Rolex Datejust Reference 16234
        36mm steel case
        White gold bezel
        Serial dating to 2000
        Silver colour change dial "pana cotta patina"
        Solid link Oyster bracelet ref 78360
    """
    out: dict = {}
    if not desc:
        return out
    m = re.search(r"\bReference\s+([A-Z0-9][A-Z0-9\-/.]{2,})", desc)
    if m:
        out["reference_no"] = m.group(1).strip()
    m = re.search(r"\b(\d{2,3})\s*mm\s+(\w+)\s+case", desc, re.IGNORECASE)
    if m:
        out["case_size"] = f"{m.group(1)}mm"
        out["material"] = m.group(2).strip().title()
    m = re.search(r"Serial dating to\s+(\d{4})", desc, re.IGNORECASE)
    if m:
        out["year"] = m.group(1)
    return out


def _kv_extract(text: str, pairs: list[tuple[str, str | None]],
                colon: bool = True) -> dict:
    """Generic inline-KV extractor.

    `pairs` is a list of (source_label, output_field) — None field means
    skip (used to terminate prior captures even though we don't emit).
    `colon` toggles between "Label: value" and "Label value" formats.
    """
    out: dict = {}
    if not text:
        return out
    label_alt = "|".join(re.escape(lbl) for lbl, _ in pairs)
    sep = r"\s*:\s*" if colon else r"\s+"
    for label, field in pairs:
        if not field:
            continue
        pattern = rf"\b{re.escape(label)}{sep}(.+?)(?=\s+(?:{label_alt}){sep}|\s*$)"
        m = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if m:
            v = m.group(1).strip().strip(",").strip(".").strip("-").strip()
            if v and v != "-" and v.lower() not in {"n/a", "none"}:
                out[field] = v
    return out


def parse_craftandtailored(desc: str) -> dict:
    """Craft & Tailored — 'SPECS' block, inline KV without colons.

    Sample:
        SPECS Stock # MOVUFO1794 Brand Movado Style Dress Watch "UFO"
        Model 1794 Serial 15XXXX Size Men's/Unisex Material 18K Yellow Gold
        Dial Silver "Aged" Millimeters 32 Strap 2pc Handmade Leather Strap
    """
    if not desc or "SPECS" not in desc:
        return {}
    block = desc.split("SPECS", 1)[1]
    pairs = [
        ("Stock #", None),  # terminate but don't emit
        ("Brand", None),    # already on the listing
        ("Style", "model_name"),
        ("Model", "reference_no"),
        ("Serial", None),
        ("Size", None),
        ("Material", "material"),
        ("Dial", "dial"),
        ("Millimeters", "case_size"),
        ("Strap", "strap"),
    ]
    out = _kv_extract(block, pairs, colon=False)
    # case_size needs "mm" suffix if pure-numeric
    if out.get("case_size", "").isdigit():
        out["case_size"] = f"{out['case_size']}mm"
    return out


def parse_falco(desc: str) -> dict:
    """Falco Watches — 'THE ESSENTIALS' block, colon-separated KV.

    Sample:
        THE ESSENTIALS MAKE: ROLEX MODEL: 16570 YEAR: 2000
        CASE DIAMETER: 40 MM CASE MATERIAL: STAINLESS STEEL
        BRACELET MATERIAL: STAINLESS STEEL MOVEMENT: AUTOMATIC
    """
    if not desc or "ESSENTIALS" not in desc.upper():
        return {}
    pairs = [
        ("MAKE", None),
        ("MODEL", "reference_no"),
        ("YEAR", "year"),
        ("CASE DIAMETER", "case_size"),
        ("CASE MATERIAL", "material"),
        ("BRACELET MATERIAL", "bracelet_material"),
        ("MOVEMENT", "movement"),
    ]
    out = _kv_extract(desc, pairs, colon=True)
    # Normalise YEAR — Falco prefixes "c" for circa sometimes ("c1966")
    if "year" in out:
        m = re.search(r"\d{4}", out["year"])
        if m:
            out["year"] = m.group()
    return out


def parse_somlo(desc: str) -> dict:
    """Somlo — colon-separated KV with a wide label set.

    Sample:
        Brand: OMEGA Made: 1953 Model: Military Reference: CK 2777
        Calibre: 283 Movement: Manual Material: Stainless steel
        Features/complications: - Dial: Black dial ... Case Dimensions: 36mm
        Bracelet/Strap: NATO Strap Accessories: - SKU: 03463
    """
    if not desc:
        return {}
    pairs = [
        ("Brand", None),
        ("Made", "year"),
        ("Model", "model_name"),
        ("Reference", "reference_no"),
        ("Calibre", "calibre"),
        ("Movement", "movement"),
        ("Material", "material"),
        ("Features/complications", "complications"),
        ("Dial", "dial"),
        ("Case dimensions", "case_size"),
        ("Bracelet/Strap", "bracelet"),
        ("Accessories", None),
        ("SKU", None),
    ]
    out = _kv_extract(desc, pairs, colon=True)
    if "year" in out:
        m = re.search(r"\d{4}", out["year"])
        if m:
            out["year"] = m.group()
    return out


def parse_huntington(desc: str) -> dict:
    """Huntington Company — colon-separated KV (HTML-stripped from <strong>).

    Sample (post-strip):
        Reference: 15550ST Model: Royal Oak Year: 2024
        Case Size: 37mm Case Material: Steel
        Dial: Blue "Grande Tapisserie" dial with applied markers
        Movement: Automatic Audemars Piguet caliber 5900
    """
    if not desc:
        return {}
    pairs = [
        ("Reference", "reference_no"),
        ("Model", "model_name"),
        ("Year", "year"),
        ("Case Material", "material"),
        ("Case Size", "case_size"),
        ("Dial", "dial"),
        ("Movement", "movement"),
        ("Bezel", "bezel"),
        ("Strap", "strap"),
        ("Bracelet", "bracelet"),
        ("Buckle", None),
        ("Clasp", None),
        ("Crystal", None),
        ("Contents", None),
    ]
    return _kv_extract(desc, pairs, colon=True)


# ── Dispatch ─────────────────────────────────────────────────────────────

DEALER_PARSERS = {
    "Bulang & Sons": parse_bulang,
    "Craft & Tailored": parse_craftandtailored,
    "Falco Watches": parse_falco,
    "Somlo": parse_somlo,
    "Huntington Company": parse_huntington,
}


def parse_dealer_description(source: str, description: str) -> dict:
    """Dispatch on source. Empty dict if no parser registered or
    description is empty. Defensive — parser exceptions return {}."""
    parser = DEALER_PARSERS.get(source)
    if not parser or not description:
        return {}
    try:
        return parser(description)
    except Exception:
        return {}
