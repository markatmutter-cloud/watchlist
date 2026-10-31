"""Salt Vintage Watches: Shopify availability, brand, and the write guards.

Sold pieces stay in Salt's products.json, so availability on the variant is
the only thing separating live stock from the archive. And like every dealer
source, a scrape that parsed nothing must not replace yesterday's CSV.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import saltvintagewatches_scraper as salt  # noqa: E402


def _product(i, *, price="9995.00", available=True, vendor="Rolex",
             title=None, product_type="Watches"):
    return {
        "id": i, "title": title or f"ROLEX SUBMARINER {i}", "handle": f"sub-{i}",
        "vendor": vendor, "product_type": product_type, "body_html": "",
        "variants": [{"price": price, "available": available}],
        "images": [{"src": f"https://cdn.shopify.com/{i}.jpg"}],
    }


@pytest.fixture
def run_in(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "data").mkdir()
    return tmp_path


def _write_prior(tmp_path, rows):
    with open(tmp_path / "data" / "saltvintagewatches.csv", "w",
              newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["title", "brand", "price", "url",
                                          "img", "description", "source", "sold"])
        w.writeheader()
        for i in range(rows):
            w.writerow({"title": f"t{i}", "brand": "Rolex", "price": 1000,
                        "url": f"https://x/{i}", "img": "", "description": "",
                        "source": salt.SOURCE, "sold": False})


def _out(tmp_path):
    p = tmp_path / "saltvintagewatches_listings.csv"
    if not p.exists():
        return None
    with open(p, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def test_sold_pieces_are_dropped_and_live_ones_kept(run_in, monkeypatch):
    monkeypatch.setattr(salt, "get_all_products", lambda: [
        _product(1), _product(2, available=False), _product(3)])

    salt.main()

    rows = _out(run_in)
    assert [r["url"] for r in rows] == [
        "https://saltvintagewatches.com/products/sub-1",
        "https://saltvintagewatches.com/products/sub-3"]
    assert {r["source"] for r in rows} == {"Salt Vintage Watches"}
    assert rows[0]["price"] == "9995"


def test_vendor_is_the_brand_and_the_dealer_name_never_leaks():
    assert salt.parse_product(_product(1, vendor="Heuer"))["brand"] == "Heuer"
    leaked = _product(2, vendor="Salt Vintage Watches", title="OMEGA SPEEDMASTER 145.022")
    assert salt.parse_product(leaked)["brand"] == "Omega"


def test_non_watch_product_types_are_skipped(run_in, monkeypatch):
    monkeypatch.setattr(salt, "get_all_products", lambda: [
        _product(1), _product(2, product_type="Straps")])

    salt.main()

    assert len(_out(run_in)) == 1


def test_an_empty_parse_exits_nonzero_and_writes_no_csv(run_in, monkeypatch):
    _write_prior(run_in, 35)
    monkeypatch.setattr(salt, "get_all_products", lambda: [])

    with pytest.raises(SystemExit) as e:
        salt.main()

    assert e.value.code == 1
    assert _out(run_in) is None, "writing nothing is what preserves the prior CSV"


def test_a_truncated_parse_keeps_the_prior_csv(run_in, monkeypatch):
    """35 live yesterday, 4 today is a broken walk, not a sell-out."""
    _write_prior(run_in, 35)
    monkeypatch.setattr(salt, "get_all_products",
                        lambda: [_product(i) for i in range(4)])

    with pytest.raises(SystemExit) as e:
        salt.main()

    assert e.value.code == 0
    assert _out(run_in) is None


def test_an_ordinary_run_of_sales_still_writes(run_in, monkeypatch):
    """35 -> 20 is a good month for a small dealer; the guard must not wedge."""
    _write_prior(run_in, 35)
    monkeypatch.setattr(salt, "get_all_products",
                        lambda: [_product(i) for i in range(20)])

    salt.main()

    assert len(_out(run_in)) == 20
