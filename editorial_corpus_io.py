"""Shared persistence helpers for editorial-corpus scrapers.

Splits the per-source corpus into two files:
  • public/<source>.json         — metadata, one record per article
                                   minus body_text. Smaller, eagerly
                                   loaded by the frontend.
  • public/<source>_bodies.json  — {url: body_text} map. Larger, lazy-
                                   loaded on first search keystroke.

Schema in-memory while the scraper runs stays unchanged — records
still carry body_text. The split is purely a persistence concern,
handled at read/write boundaries by `load_existing()` + `write_split()`.

Adding a new editorial scraper: import these helpers and call them at
the boundaries. Don't reach for json.load / json.dump on the corpus
files directly — that bypasses the split contract.

Backwards compat: load_existing() accepts a single legacy file (full
shape, body_text baked in) and lifts it into the in-memory shape so
the first write after migration produces both split files cleanly.
"""

from __future__ import annotations

import json
from pathlib import Path


def load_existing(meta_path: str | Path, bodies_path: str | Path) -> dict:
    """Read the metadata + bodies files and stitch back into the
    pre-split records shape. Body texts merged onto their meta rows
    by URL.

    Falls back to single-file legacy load when the bodies file isn't
    on disk yet — the next write will produce the split.
    Returns {} when neither file exists.
    """
    meta_p = Path(meta_path)
    bodies_p = Path(bodies_path)
    try:
        meta = json.loads(meta_p.read_text()) if meta_p.exists() else {}
    except json.JSONDecodeError:
        meta = {}
    try:
        bodies = json.loads(bodies_p.read_text()) if bodies_p.exists() else {}
    except json.JSONDecodeError:
        bodies = {}
    # Stitch — if a record already has body_text (legacy single-file
    # path), keep it; otherwise pull from the bodies map.
    for url, rec in meta.items():
        if not rec.get("body_text"):
            rec["body_text"] = bodies.get(url, "")
    return meta


EXCERPT_CHARS = 240


def _make_excerpt(body: str) -> str:
    """Short teaser the card grid renders without needing the full
    body file. ~240 chars, trimmed at the last word boundary so we
    don't end mid-token. Empty body → empty excerpt."""
    if not body:
        return ""
    body = body.strip()
    if len(body) <= EXCERPT_CHARS:
        return body
    cut = body[:EXCERPT_CHARS]
    last_space = cut.rfind(" ")
    if last_space > EXCERPT_CHARS - 60:
        cut = cut[:last_space]
    return cut.rstrip(".,;:!? ")


def write_split(records: dict, meta_path: str | Path, bodies_path: str | Path) -> None:
    """Write the in-memory records dict back to disk as the two
    split files.

    Records keyed by URL; each record may carry a body_text field
    which gets diverted into the bodies file. Empty / missing
    body_text values are dropped from the bodies file rather than
    written as empty strings — keeps that file as lean as possible.

    The meta record gets:
      • everything from `rec` minus body_text
      • `excerpt`: a ~240-char teaser derived from body_text so the
        card grid can show a snippet without fetching the full body.

    word_count stays on the meta record (already derived, useful for
    display + sort without the body itself).
    """
    meta_out: dict = {}
    bodies_out: dict = {}
    for url, rec in records.items():
        body = rec.get("body_text") or ""
        meta_rec = {k: v for k, v in rec.items() if k != "body_text"}
        meta_rec["excerpt"] = _make_excerpt(body)
        meta_out[url] = meta_rec
        if body:
            bodies_out[url] = body

    meta_p = Path(meta_path)
    bodies_p = Path(bodies_path)
    meta_p.parent.mkdir(parents=True, exist_ok=True)
    bodies_p.parent.mkdir(parents=True, exist_ok=True)
    meta_p.write_text(
        json.dumps(meta_out, indent=2, ensure_ascii=False, sort_keys=True)
    )
    bodies_p.write_text(
        json.dumps(bodies_out, indent=2, ensure_ascii=False, sort_keys=True)
    )


def derive_bodies_path(meta_path: str | Path) -> str:
    """Convenience — derive the bodies file path from the meta path
    so scrapers can declare just one constant. Inserts `_bodies`
    before the `.json` suffix.

        public/bring_a_loupe.json → public/bring_a_loupe_bodies.json
    """
    p = Path(meta_path)
    return str(p.with_name(f"{p.stem}_bodies{p.suffix}"))
