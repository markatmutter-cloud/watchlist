"""Tests for the CSV -> auctions.json coverage reconciler.

This closes the third link in the auction chain. The lot enumerator only
visits sales present in auctions.json, so a sale dropped during the merge
takes its lots with it and neither fact surfaces on its own.

The identity tests matter most. URL is the obvious key and it is wrong:
Antiquorum points five different upcoming sales at one placeholder page,
and Sotheby's reuses slugs. Keying on URL let a dropped sale hide behind
a namesake — on real data it collapsed 89 sales into 70 lookup entries.
"""
import json

import pytest

import calendar_coverage as cc
import merge


HEADER = "house,title,location,date_start,date_end,url\n"


def _csv(tmp_path, name, rows):
    p = tmp_path / f"{name}_auctions.csv"
    p.write_text(HEADER + "".join(rows))
    return p


def _row(house, title, start, end="", url="https://x/1"):
    return f"{house},{title},Geneva,{start},{end or start},{url}\n"


def _merged(tmp_path, sales):
    p = tmp_path / "auctions.json"
    p.write_text(json.dumps([
        {"id": merge.auction_id(h, d, t), "house": h, "title": t,
         "dateStart": d, "url": u}
        for h, t, d, u in sales
    ]))
    return p


FUTURE = "2099-01-01"
PAST = "2000-01-01"


# --- identity -------------------------------------------------------------

def test_reuses_merge_auction_id_not_a_parallel_key():
    """The reconciler must agree with the merge about sale identity."""
    assert cc._auction_id("Phillips", "2026-11-07", "Geneva XXIV") == \
        merge.auction_id("Phillips", "2026-11-07", "Geneva XXIV")


def test_same_url_different_sales_are_distinct():
    """Antiquorum's real shape: five sales, one placeholder URL."""
    url = "https://www.antiquorum.swiss/upcoming-auctions-and-viewings"
    ids = {
        cc._auction_id("Antiquorum", d, "Important Modern & Vintage Timepieces")
        for d in ("2026-09-15", "2026-10-18", "2026-11-07", "2026-11-29")
    }
    assert len(ids) == 4, "URL-shaped keying would collapse these to one"
    assert url  # the URL is genuinely shared; identity must not depend on it


# --- the drop it exists to catch -----------------------------------------

def test_scraped_sale_missing_from_merge_is_reported(tmp_path):
    _csv(tmp_path, "phillips", [_row("Phillips", "Geneva XXIV", FUTURE)])
    merged = _merged(tmp_path, [])
    got = cc.dropped_sales(tmp_path, merged, today="2026-08-17")
    assert len(got) == 1
    assert got[0]["house"] == "Phillips"


def test_sale_present_in_merge_is_not_reported(tmp_path):
    _csv(tmp_path, "phillips", [_row("Phillips", "Geneva XXIV", FUTURE)])
    merged = _merged(tmp_path,
                     [("Phillips", "Geneva XXIV", FUTURE, "https://x/1")])
    assert cc.dropped_sales(tmp_path, merged, today="2026-08-17") == []


def test_one_dropped_sale_among_many_is_found(tmp_path):
    _csv(tmp_path, "phillips", [
        _row("Phillips", "Kept One", FUTURE),
        _row("Phillips", "Dropped One", FUTURE),
    ])
    merged = _merged(tmp_path,
                     [("Phillips", "Kept One", FUTURE, "https://x/1")])
    got = cc.dropped_sales(tmp_path, merged, today="2026-08-17")
    assert [g["title"] for g in got] == ["Dropped One"]


def test_a_namesake_does_not_mask_a_drop(tmp_path):
    """Two Sotheby's 'Fine Watches' sharing a slug; only one merged."""
    url = "https://www.sothebys.com/en/buy/auction/2026/fine-watches"
    _csv(tmp_path, "sothebys", [
        _row("Sotheby's", "Fine Watches", "2099-09-10", url=url),
        _row("Sotheby's", "Fine Watches", "2099-10-07", url=url),
    ])
    merged = _merged(tmp_path,
                     [("Sotheby's", "Fine Watches", "2099-09-10", url)])
    got = cc.dropped_sales(tmp_path, merged, today="2026-08-17")
    assert len(got) == 1
    assert got[0]["date_start"] == "2099-10-07"


# --- scope: past sales legitimately age out ------------------------------

def test_past_sales_are_not_enforced(tmp_path):
    _csv(tmp_path, "phillips", [_row("Phillips", "Old Sale", PAST)])
    assert cc.dropped_sales(tmp_path, _merged(tmp_path, []),
                            today="2026-08-17") == []


def test_a_sale_ending_today_is_still_enforced(tmp_path):
    _csv(tmp_path, "phillips",
         [_row("Phillips", "Ends Today", "2026-08-10", end="2026-08-17")])
    assert len(cc.dropped_sales(tmp_path, _merged(tmp_path, []),
                                today="2026-08-17")) == 1


# --- robustness -----------------------------------------------------------

def test_rows_without_house_or_title_are_skipped(tmp_path):
    p = tmp_path / "junk_auctions.csv"
    p.write_text(HEADER + f",,Geneva,{FUTURE},{FUTURE},https://x/1\n")
    assert cc.dropped_sales(tmp_path, _merged(tmp_path, []),
                            today="2026-08-17") == []


def test_missing_auctions_json_yields_no_lookup(tmp_path):
    assert cc.load_merged(tmp_path / "nope.json") == {}


def test_corrupt_auctions_json_does_not_crash(tmp_path):
    p = tmp_path / "auctions.json"
    p.write_text("{not json")
    assert cc.load_merged(p) == {}


def test_no_csvs_exits_zero_rather_than_double_paging(tmp_path, monkeypatch):
    """auction_calendar_health.py owns the 'no CSVs at all' failure."""
    monkeypatch.setattr(cc, "DATA", tmp_path)
    assert cc.main(["calendar_coverage.py"]) == 0


def test_exit_codes(tmp_path, monkeypatch):
    _csv(tmp_path, "phillips", [_row("Phillips", "Geneva XXIV", FUTURE)])
    monkeypatch.setattr(cc, "DATA", tmp_path)
    monkeypatch.setattr(cc, "AUCTIONS_JSON", _merged(tmp_path, []))
    assert cc.main(["calendar_coverage.py"]) == 1
    assert cc.main(["calendar_coverage.py", "--warn"]) == 0


def test_blocklisted_non_watch_sale_is_not_reported(tmp_path):
    # merge.py drops these on purpose (Mark 2026-10-23); the gate must agree.
    _csv(tmp_path, "christies", [_row("Christie's", "Retromobile New York Auctions", FUTURE)])
    merged = _merged(tmp_path, [])
    assert cc.dropped_sales(tmp_path, merged, today="2026-08-17") == []
