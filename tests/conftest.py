"""Shared fixtures for merge.py state-transition tests.

The state-transition logic in `update_state(items, state)` is a pure
function over its arguments — no file I/O — so tests can drive it with
synthetic input dicts and assert against the returned `state` and the
enriched output. The one wrinkle is `merge.TODAY`, a module-level
constant set at import time. The `at_date` fixture monkey-patches it
so each call to `update_state` runs as if it were that day.
"""
import sys
from pathlib import Path

import pytest

# Make the repo root importable so `import merge` works without an
# installed package.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import merge  # noqa: E402


@pytest.fixture
def at_date(monkeypatch):
    """Returns a callable that pins `merge.TODAY` to the supplied date.

    Use it to script multi-day scenarios:

        def test_xxx(at_date):
            at_date("2026-04-01"); merge.update_state(items, state)
            at_date("2026-04-02"); merge.update_state(items, state)
    """
    def _set(date_str):
        monkeypatch.setattr(merge, "TODAY", date_str)
    return _set


def make_item(
    *,
    url="https://example.com/products/test-watch",
    price=5000,
    currency="USD",
    title="Rolex Submariner Reference 5513",
    brand="Rolex",
    source="Test Dealer",
    img="https://example.com/img.jpg",
    sold=False,
    price_on_request=False,
    desc="",
):
    """Build the dict shape that `update_state` expects (one entry from
    `load_csv`'s output). All fields default to plausible values; pass
    overrides for the field(s) under test.

    `id` is computed the same way `merge.stable_id` does it so each
    URL maps to a stable 12-char hex key — same listing across calls
    gets the same key.
    """
    rate = merge.FX.get(currency, 1.0)
    return {
        "id":             merge.stable_id(url, fallback_key=f"{source}|{title}"),
        "brand":          brand,
        "ref":            title,
        "price":          price,
        "currency":       currency,
        "priceUSD":       round(price * rate),
        "source":         source,
        "url":            url,
        "img":            img,
        "sold":           sold,
        "priceOnRequest": price_on_request,
        "desc":           desc,
    }
