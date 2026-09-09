"""Tests for the unified per-source freshness ledger.

This is the one check that doesn't need a theory about how a source
breaks — it only asks when each source last produced data. Every rot
found in the 2026-08 sweep (dealer rebrand, Cloudflare block, dead
calendar selectors, month-frozen editorial corpus) reduces to that
question, so these tests pin the two signals it tracks and the
per-surface budgets that keep it quiet.
"""
import json

import source_freshness as sf


def _reg(tmp_path, spec):
    """spec: {key: bytes|None}. None = artifact absent."""
    out = {}
    for key, body in spec.items():
        path = tmp_path / f"{key.replace(':', '_')}.csv"
        if body is not None:
            path.write_bytes(body)
        out[key] = path
    return out


CSV1 = b"title,price\nSubmariner,9000\n"
CSV2 = b"title,price\nSubmariner,9500\n"
HEADER_ONLY = b"title,price\n"


# --- registry: assembled from existing lists, not a parallel copy ---------

def test_registry_reuses_merge_source_table():
    """A hand-copied dealer list is the exact drift this module catches."""
    import merge
    reg = sf.registry()
    for _path, name, _cur in merge.LISTING_SOURCES:
        assert name in reg, f"{name} is in merge.py but not tracked"


def test_registry_covers_every_surface():
    surfaces = {sf.surface_of(k) for k in sf.registry()}
    assert surfaces == {"dealer", "calendar", "editorial", "merged"}


def test_editorial_is_tracked():
    """The surface that had no health coverage at all."""
    assert any(k.startswith("editorial:") for k in sf.registry())


# --- observe --------------------------------------------------------------

def test_empty_artifact_is_not_counted_as_fresh(tmp_path):
    """Header-only output must not advance lastSeen.

    This is the Watches of Knightsbridge calendar shape: a scraper that
    keeps writing an empty file on schedule. Treating it as fresh would
    make 'writes nothing forever' invisible.
    """
    reg = _reg(tmp_path, {"Dealer A": HEADER_ONLY})
    assert sf.observe(reg) == {}


def test_absent_artifact_is_not_counted(tmp_path):
    assert sf.observe(_reg(tmp_path, {"Dealer A": None})) == {}


def test_populated_artifact_is_observed(tmp_path):
    obs = sf.observe(_reg(tmp_path, {"Dealer A": CSV1}))
    assert obs["Dealer A"]["rows"] == 1


# --- record: the two signals ---------------------------------------------

def test_unchanged_content_advances_seen_but_not_changed(tmp_path):
    led = tmp_path / "ledger.json"
    reg = _reg(tmp_path, {"Dealer A": CSV1})
    sf.record(reg, led, today="2026-08-01")
    after = sf.record(reg, led, today="2026-08-05")
    assert after["Dealer A"]["lastSeen"] == "2026-08-05"
    assert after["Dealer A"]["lastChanged"] == "2026-08-01"


def test_changed_content_advances_both(tmp_path):
    led = tmp_path / "ledger.json"
    path = (tmp_path / "Dealer A.csv")
    reg = {"Dealer A": path}
    path.write_bytes(CSV1)
    sf.record(reg, led, today="2026-08-01")
    path.write_bytes(CSV2)
    after = sf.record(reg, led, today="2026-08-05")
    assert after["Dealer A"]["lastChanged"] == "2026-08-05"


def test_record_does_not_blank_sources_absent_from_this_checkout(tmp_path):
    """Workflows produce different subsets; --record must be additive.

    scrape-listings only has dealer CSVs, scrape-auctions only calendar
    ones. If either wiped the entries it couldn't see, the ledger would
    thrash and every source would look permanently fresh.
    """
    led = tmp_path / "ledger.json"
    sf.record(_reg(tmp_path, {"Dealer A": CSV1}), led, today="2026-08-01")
    after = sf.record(_reg(tmp_path, {"Dealer B": CSV1}), led, today="2026-08-02")
    assert after["Dealer A"]["lastSeen"] == "2026-08-01"
    assert after["Dealer B"]["lastSeen"] == "2026-08-02"


def test_corrupt_ledger_does_not_crash(tmp_path):
    led = tmp_path / "ledger.json"
    led.write_text("{not json")
    assert "Dealer A" in sf.record(_reg(tmp_path, {"Dealer A": CSV1}), led,
                                  today="2026-08-01")


# --- stale: budgets -------------------------------------------------------

def _ledger(tmp_path, entries):
    p = tmp_path / "ledger.json"
    p.write_text(json.dumps(entries))
    return p


def test_fresh_source_is_not_stale(tmp_path):
    led = _ledger(tmp_path, {"Dealer A": {
        "lastSeen": "2026-08-17", "lastChanged": "2026-08-17"}})
    assert sf.stale(led, today="2026-08-17") == []


def test_dealer_silent_past_budget_is_stale(tmp_path):
    led = _ledger(tmp_path, {"Dealer A": {
        "lastSeen": "2026-08-01", "lastChanged": "2026-08-01"}})
    out = sf.stale(led, today="2026-08-17")
    assert out and out[0]["key"] == "Dealer A"
    assert "no data for 16d" in out[0]["reasons"][0]


def test_editorial_gets_a_longer_leash_than_dealers(tmp_path):
    """Editorial publishes nothing some weeks; dealers change hourly."""
    entries = {
        "Dealer A": {"lastSeen": "2026-08-12", "lastChanged": "2026-08-12"},
        "editorial:fratello": {"lastSeen": "2026-08-12",
                               "lastChanged": "2026-08-12"},
    }
    keys = {r["key"] for r in sf.stale(_ledger(tmp_path, entries),
                                       today="2026-08-17")}
    assert keys == {"Dealer A"}


def test_month_frozen_editorial_is_caught(tmp_path):
    """The actual 2026-07-12 → 08-16 corpus freeze."""
    led = _ledger(tmp_path, {"editorial:fratello": {
        "lastSeen": "2026-07-12", "lastChanged": "2026-07-12"}})
    assert sf.stale(led, today="2026-08-16")


def test_frozen_content_is_caught_even_while_still_being_written(tmp_path):
    """lastSeen current, lastChanged ancient — the subtle rot."""
    led = _ledger(tmp_path, {"Dealer A": {
        "lastSeen": "2026-08-17", "lastChanged": "2026-06-01"}})
    out = sf.stale(led, today="2026-08-17")
    assert out and "unchanged" in out[0]["reasons"][0]


def test_missing_dates_do_not_crash(tmp_path):
    led = _ledger(tmp_path, {"Dealer A": {}})
    assert sf.stale(led, today="2026-08-17")


def test_check_exit_codes(tmp_path, monkeypatch):
    monkeypatch.setattr(sf, "LEDGER", _ledger(tmp_path, {"Dealer A": {
        "lastSeen": "2026-08-17", "lastChanged": "2026-08-17"}}))
    monkeypatch.setattr(sf, "_today", lambda: "2026-08-17")
    assert sf.main(["source_freshness.py", "--check"]) == 0

    monkeypatch.setattr(sf, "LEDGER", _ledger(tmp_path, {"Dealer A": {
        "lastSeen": "2026-07-01", "lastChanged": "2026-07-01"}}))
    assert sf.main(["source_freshness.py", "--check"]) == 1


def test_report_renders_without_a_ledger(tmp_path, monkeypatch):
    monkeypatch.setattr(sf, "LEDGER", tmp_path / "nope.json")
    assert "No freshness ledger yet" in sf.report(sf.LEDGER)


# ── snooze awareness (2026-09-09) ────────────────────────────────────────
# B-80's snooze muted watchcenter in the scrape-health gate, but this gate
# never read the same file, so a source we had deliberately muted paged
# every day through a second door. One mute has to hold everywhere, or
# the snooze buys nothing and the channel gets tuned out.

def test_a_snoozed_source_is_not_reported_stale(tmp_path, monkeypatch):
    import source_freshness as sf

    ledger = tmp_path / "freshness.json"
    ledger.write_text(json.dumps({
        "Watch Center": {"lastSeen": "2026-09-09", "lastChanged": "2026-08-17",
                         "rows": 429, "fingerprint": "x"},
        "Chronoholic": {"lastSeen": "2026-09-09", "lastChanged": "2026-08-17",
                        "rows": 119, "fingerprint": "y"},
    }))
    monkeypatch.setattr(sf, "snoozed_names",
                        lambda today=None: {"Watch Center": "B-80 dealer outage"})

    keys = [r["key"] for r in sf.stale(ledger, today="2026-09-09")]
    assert "Chronoholic" in keys, "a genuinely stale source must still page"
    assert "Watch Center" not in keys, "a snoozed source must not page here too"


def test_an_expired_snooze_pages_again_by_itself(tmp_path):
    """The snooze buys time; it never closes the question."""
    import source_freshness as sf

    snooze = tmp_path / "snooze.json"
    snooze.write_text(json.dumps(
        {"watchcenter": {"until": "2026-09-01", "reason": "B-80"}}))

    import scrape_health_gate as gate
    from datetime import date
    entry = json.loads(snooze.read_text())["watchcenter"]
    assert gate._snooze_state(entry, date(2026, 9, 9)) == "expired"


def test_an_undated_snooze_mutes_nothing():
    """A malformed entry must never buy silence."""
    import scrape_health_gate as gate
    from datetime import date
    assert gate._snooze_state({"reason": "no date"}, date(2026, 9, 9)) == "invalid"
    assert gate._snooze_state("just a string", date(2026, 9, 9)) == "invalid"
