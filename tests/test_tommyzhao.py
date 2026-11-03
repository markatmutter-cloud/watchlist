"""Tommy Zhao: Shopify availability, brand, write guards, and the Falco freeze.

Tommy Zhao replaces Falco Watches. Falco stops being scraped but its rows
stay in the feed as a frozen record, so those two facts are pinned here too.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

import pytest
import requests

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import merge  # noqa: E402
import tommyzhao_scraper as tz  # noqa: E402


def _product(i, *, price="49500.00", available=True, vendor="Rolex",
             title=None, body="<p dir=\"ltr\">In 2022, Rolex introduced a fluted bezel.</p>"):
    return {
        "id": i, "title": title or f"ROLEX DAY-DATE {i}", "handle": f"day-date-{i}",
        "vendor": vendor, "product_type": "Watches", "body_html": body,
        "variants": [{"price": price, "available": available}],
        "images": [{"src": f"https://cdn.shopify.com/{i}.jpg"}],
    }


@pytest.fixture
def run_in(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "data").mkdir()
    return tmp_path


def _write_prior(tmp_path, rows):
    with open(tmp_path / "data" / "tommyzhao.csv", "w",
              newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["title", "brand", "price", "url",
                                          "img", "description", "source", "sold"])
        w.writeheader()
        for i in range(rows):
            w.writerow({"title": f"t{i}", "brand": "Rolex", "price": 1000,
                        "url": f"https://x/{i}", "img": "", "description": "",
                        "source": tz.SOURCE, "sold": False})


def _out(tmp_path):
    p = tmp_path / "tommyzhao_listings.csv"
    if not p.exists():
        return None
    with open(p, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def test_sold_pieces_are_dropped_and_live_ones_kept(run_in, monkeypatch):
    monkeypatch.setattr(tz, "get_all_products", lambda: [
        _product(1), _product(2, available=False), _product(3)])

    tz.main()

    rows = _out(run_in)
    assert [r["url"] for r in rows] == [
        "https://tommyzhao.watch/products/day-date-1",
        "https://tommyzhao.watch/products/day-date-3"]
    assert {r["source"] for r in rows} == {"Tommy Zhao"}
    assert rows[0]["price"] == "49500"


def test_prose_description_is_kept_without_html(run_in, monkeypatch):
    monkeypatch.setattr(tz, "get_all_products", lambda: [_product(1)])

    tz.main()

    assert _out(run_in)[0]["description"] == "In 2022, Rolex introduced a fluted bezel."


def test_vendor_is_the_brand_and_the_dealer_name_never_leaks():
    assert tz.parse_product(_product(1, vendor="Heuer"))["brand"] == "Heuer"
    leaked = _product(2, vendor="No.67 by Tommy Zhao", title="OMEGA SPEEDMASTER 145.022")
    assert tz.parse_product(leaked)["brand"] == "Omega"


def test_a_throttled_first_page_exits_nonzero(monkeypatch):
    """Shopify's 429 local_rate_limited must page, not read as an empty catalog."""
    def throttled(*a, **k):
        raise requests.HTTPError("429 Client Error")
    monkeypatch.setattr(tz, "fetch_json_with_retry", throttled)

    with pytest.raises(SystemExit) as e:
        tz.get_all_products()

    assert e.value.code == 1


def test_an_empty_parse_exits_nonzero_and_writes_no_csv(run_in, monkeypatch):
    _write_prior(run_in, 30)
    monkeypatch.setattr(tz, "get_all_products", lambda: [])

    with pytest.raises(SystemExit) as e:
        tz.main()

    assert e.value.code == 1
    assert _out(run_in) is None, "writing nothing is what preserves the prior CSV"


def test_a_truncated_parse_keeps_the_prior_csv(run_in, monkeypatch):
    """30 live yesterday, 4 today is a broken walk, not a sell-out."""
    _write_prior(run_in, 30)
    monkeypatch.setattr(tz, "get_all_products", lambda: [_product(i) for i in range(4)])

    with pytest.raises(SystemExit) as e:
        tz.main()

    assert e.value.code == 0
    assert _out(run_in) is None


def test_an_ordinary_run_of_sales_still_writes(run_in, monkeypatch):
    """30 -> 16 is a good month for a boutique dealer; the guard must not wedge."""
    _write_prior(run_in, 30)
    monkeypatch.setattr(tz, "get_all_products", lambda: [_product(i) for i in range(16)])

    tz.main()

    assert len(_out(run_in)) == 16


def test_tommy_zhao_is_a_gbp_source():
    assert ("data/tommyzhao.csv", "Tommy Zhao", "GBP") in merge.LISTING_SOURCES


def test_falco_is_frozen_but_stays_in_the_feed():
    """Retired dealer: rows stay, nothing scrapes them, nothing pages on them."""
    assert ("data/falco.csv", "Falco Watches", "GBP") in merge.LISTING_SOURCES
    assert (ROOT / "data" / "falco.csv").exists()

    for wf in (ROOT / ".github" / "workflows").glob("*.yml"):
        text = wf.read_text()
        assert "falco_scraper" not in text, f"{wf.name} still runs the retired Falco scraper"
        assert "scraper: falco" not in text, f"{wf.name} still matrixes Falco"

    import scrape_health_gate as gate
    assert "falco" in gate.load_snoozes(), "a static CSV would trip the 21-day freshness check"
