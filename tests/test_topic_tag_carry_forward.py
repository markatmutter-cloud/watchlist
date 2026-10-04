"""Tagger re-pay regression tests.

Scrapers rebuilt re-fetched records without `themes`, and Rolex Magazine /
On The Dash re-walked their whole feed every run, so the weekly Haiku
indexer re-tagged ~72k articles for a ~13k corpus. These pin the three
fixes: write_split carry-forward, stop-at-first-held-post, and the
indexer's cost guard.
"""
import json

import pytest

import corpus_topic_indexer as indexer
import onthedash_scraper
import rolex_magazine_scraper
from editorial_corpus_io import write_split


# ── write_split carry-forward ─────────────────────────────────────


def _write(tmp_path, records):
    meta = tmp_path / "src.json"
    write_split(records, meta, tmp_path / "src_bodies.json")
    return json.loads(meta.read_text())


def test_write_split_keeps_themes_when_rewritten_without_them(tmp_path):
    url = "https://example.com/a"
    _write(tmp_path, {url: {"url": url, "title": "A", "themes": ["racing"]}})
    # Scraper re-fetches the article and rebuilds it from scratch.
    out = _write(tmp_path, {url: {"url": url, "title": "A (updated)", "body_text": "x"}})
    assert out[url]["themes"] == ["racing"]
    assert out[url]["title"] == "A (updated)"


def test_write_split_new_nonempty_themes_win(tmp_path):
    url = "https://example.com/a"
    _write(tmp_path, {url: {"url": url, "themes": ["racing"]}})
    out = _write(tmp_path, {url: {"url": url, "themes": ["diving", "military"]}})
    assert out[url]["themes"] == ["diving", "military"]


def test_write_split_empty_themes_filled_from_disk(tmp_path):
    url = "https://example.com/a"
    _write(tmp_path, {url: {"url": url, "themes": ["space"]}})
    out = _write(tmp_path, {url: {"url": url, "themes": []}})
    assert out[url]["themes"] == ["space"]


def test_write_split_keeps_paid_for_empty_list(tmp_path):
    # [] = "indexer ran, no theme applies" — must survive, or it's re-paid weekly.
    url = "https://example.com/a"
    _write(tmp_path, {url: {"url": url, "themes": []}})
    out = _write(tmp_path, {url: {"url": url, "title": "A"}})
    assert out[url]["themes"] == []


def test_write_split_new_record_has_no_themes(tmp_path):
    old, new = "https://example.com/old", "https://example.com/new"
    _write(tmp_path, {old: {"url": old, "themes": ["news"]}})
    out = _write(tmp_path, {old: {"url": old}, new: {"url": new}})
    assert "themes" not in out[new]
    assert out[old]["themes"] == ["news"]


# ── Incremental stop: first held post, not max(scraped_at) ────────


def test_rolex_walk_stops_at_newest_held_post(monkeypatch):
    # Feed is newest-first by published: 20, 19 are new; 18 is the newest held.
    page1 = [{"n": n} for n in (20, 19, 18, 17, 16)]
    pages_fetched = []

    def fake_fetch(start_index, *a, **kw):
        pages_fetched.append(start_index)
        return {"feed": {"entry": page1 if start_index == 1 else [{"n": 1}]}}

    monkeypatch.setattr(rolex_magazine_scraper, "fetch_feed_page", fake_fetch)
    monkeypatch.setattr(rolex_magazine_scraper, "parse_entry",
                        lambda raw: {"url": f"https://rolexmagazine.com/{raw['n']}"})
    monkeypatch.setattr(rolex_magazine_scraper.time, "sleep", lambda *_: None)

    held = {f"https://rolexmagazine.com/{n}" for n in (18, 17, 16, 1)}
    got = [r["url"] for r in rolex_magazine_scraper.walk_feed(known_urls=held)]

    assert got == ["https://rolexmagazine.com/20", "https://rolexmagazine.com/19"]
    assert pages_fetched == [1]  # never walked past the head


def test_onthedash_walk_stops_at_newest_held_post(monkeypatch):
    posts = [{"n": n} for n in (9, 8, 7, 6)]

    def fake_fetch(url, params=None, **kw):
        off = params["offset"]
        return (posts[off:off + params["per_page"]], None)

    monkeypatch.setattr(onthedash_scraper, "fetch_json", fake_fetch)
    monkeypatch.setattr(onthedash_scraper, "parse_post",
                        lambda raw: {"url": f"https://onthedash.com/{raw['n']}"})
    monkeypatch.setattr(onthedash_scraper.time, "sleep", lambda *_: None)

    held = {"https://onthedash.com/7", "https://onthedash.com/6"}
    got = [r["url"] for r in onthedash_scraper.walk_posts(known_urls=held)]
    assert got == ["https://onthedash.com/9", "https://onthedash.com/8"]


# ── Indexer cost guard ────────────────────────────────────────────


def test_guard_trips_above_threshold_on_default_run():
    assert indexer.cost_guard_message(301, retag=False, limit=0, threshold=300)


def test_guard_quiet_at_or_below_threshold():
    assert indexer.cost_guard_message(300, retag=False, limit=0, threshold=300) is None


def test_guard_bypassed_by_retag_or_limit():
    assert indexer.cost_guard_message(5000, retag=True, limit=0) is None
    assert indexer.cost_guard_message(5000, retag=False, limit=1000) is None


def test_main_exits_nonzero_before_api(tmp_path, monkeypatch):
    meta = tmp_path / "big.json"
    meta.write_text(json.dumps({f"u{i}": {"title": "t"} for i in range(301)}))
    monkeypatch.setattr(indexer, "SOURCE_META_PATHS", [str(meta)])
    monkeypatch.setattr("sys.argv", ["corpus_topic_indexer.py"])
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(SystemExit) as exc:
        indexer.main()
    # 2 = guard; 1 would mean it got as far as the API-key / SDK check.
    assert exc.value.code == 2


def test_needs_tagging_treats_empty_list_as_tagged():
    assert indexer.needs_tagging({"title": "t"})
    assert not indexer.needs_tagging({"themes": []})
    assert not indexer.needs_tagging({"themes": ["racing"]})
    assert indexer.needs_tagging({"themes": ["racing"]}, retag=True)
