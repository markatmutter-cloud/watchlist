"""This scraper must never replace 54 real listings with nothing.

Before today it wrote its CSV unconditionally, so an API that answered
200 with an empty list would have produced a header-only file that the
agent then moved into place — silently wiping the source. That never
fired only because the scraper was failing earlier, which is not a
safety property.

The caller only moves the CSV if the file exists, so "refuse to write"
IS the mechanism that preserves the prior data.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import watchesoflancashire_scraper as wol  # noqa: E402


def _item(i, price="150000"):
    return {"id": i, "name": f"Omega {i}", "permalink": f"https://x/{i}",
            "prices": {"price": price, "currency_minor_unit": 2},
            "images": [], "categories": [], "short_description": ""}


@pytest.fixture
def run_in(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "data").mkdir()
    return tmp_path


def _write_prior(tmp_path, rows):
    p = tmp_path / "data" / "watchesoflancashire.csv"
    with open(p, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["title", "brand", "price", "url",
                                          "img", "description", "source", "sold"])
        w.writeheader()
        for i in range(rows):
            w.writerow({"title": f"t{i}", "brand": "Omega", "price": 1000,
                        "url": f"https://x/{i}", "img": "", "description": "",
                        "source": "Watches of Lancashire", "sold": False})
    return p


def test_an_empty_parse_writes_no_csv_and_exits_nonzero(run_in, monkeypatch):
    _write_prior(run_in, 54)
    monkeypatch.setattr(wol, "get_all_listings", lambda: [])

    assert wol.main() == 1
    assert not (run_in / "watchesoflancashire_listings.csv").exists(), \
        "writing nothing is what preserves the prior CSV"


def test_a_truncated_parse_is_refused(run_in, monkeypatch):
    """54 rows yesterday, 3 today is a broken walk, not a sell-out."""
    _write_prior(run_in, 54)
    monkeypatch.setattr(wol, "get_all_listings", lambda: [_item(i) for i in range(3)])

    assert wol.main() == 1
    assert not (run_in / "watchesoflancashire_listings.csv").exists()


def test_a_healthy_run_writes_the_csv(run_in, monkeypatch):
    _write_prior(run_in, 54)
    monkeypatch.setattr(wol, "get_all_listings",
                        lambda: [_item(i) for i in range(61)])

    assert wol.main() == 0
    out = run_in / "watchesoflancashire_listings.csv"
    assert out.exists()
    with open(out, newline="", encoding="utf-8") as f:
        assert len(list(csv.DictReader(f))) == 61


def test_a_small_dealer_shrinking_honestly_is_not_blocked(run_in, monkeypatch):
    """The guard must not trap a genuinely tiny catalogue.

    Below 25 prior rows the absolute floor applies, so a dealer going
    10 -> 4 still writes; only a big proportional drop is refused.
    """
    _write_prior(run_in, 10)
    monkeypatch.setattr(wol, "get_all_listings", lambda: [_item(i) for i in range(4)])

    assert wol.main() == 0
    assert (run_in / "watchesoflancashire_listings.csv").exists()


def test_the_cheap_path_escalates_rather_than_retrying_a_challenge(monkeypatch):
    """Retrying a managed challenge is pure delay — it needs a browser.

    fetch_page must surface it as Challenged on the FIRST response, not
    grind through the retry ladder and then report a generic failure.
    """
    calls = []

    class FakeResp:
        status_code = 403
        headers = {"cf-mitigated": "challenge"}
        text = "<title>Just a moment...</title>"

    monkeypatch.setattr(wol.SESSION, "get",
                        lambda *a, **k: calls.append(1) or FakeResp())

    with pytest.raises(wol.Challenged):
        wol.fetch_page(1, 100)
    assert len(calls) == 1, "a challenge must not be retried"
