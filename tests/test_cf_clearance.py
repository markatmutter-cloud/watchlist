"""The parts of the Cloudflare-challenge path that can be tested here.

The browser leg cannot be: this sandbox cannot reach the dealer, and the
challenge only exists against a real request. So the honest split is to
test hard everything *around* it — is this response a challenge, does a
failure get recorded, does a truncated parse refuse to overwrite good
data — and to leave the browser itself to a verified run on the laptop.

That split is the point. B-99 happened because a fix shipped with no
check that it produced data, so the value here is less "does Chromium
work" than "if it doesn't, does anyone find out".
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cf_clearance  # noqa: E402

# The real interstitial served by watchesoflancashire.com to a runner on
# 2026-09-16, trimmed. Note what is NOT in it: no 403, no "blocked", none
# of the wording a naive matcher looks for.
REAL_CHALLENGE_BODY = (
    '<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title>'
    '<meta name="robots" content="noindex,nofollow">'
    '<script>(function(){window._cf_chl_opt = {cFPWv: \'g\','
    "cType: 'managed',cZone: 'watchesoflancashire.com'}})();</script>"
    "</head><body><noscript>Enable JavaScript and cookies to continue"
    "</noscript></body></html>"
)
REAL_CHALLENGE_HEADERS = {
    "Server": "cloudflare",
    "cf-mitigated": "challenge",
    "Content-Type": "text/html; charset=UTF-8",
}

REAL_PRODUCTS_BODY = '[{"id": 1, "name": "Omega Speedmaster", "prices": {}}]'


def test_the_real_interstitial_is_recognised():
    assert cf_clearance.looks_like_challenge(
        403, REAL_CHALLENGE_HEADERS, REAL_CHALLENGE_BODY) is True


def test_the_header_alone_is_enough():
    """`cf-mitigated: challenge` survives any rewording of the page.

    Cloudflare changes the interstitial's copy; it does not change this
    header. Relying on body text alone is how the Maunder captcha got
    misread as a plain 202.
    """
    assert cf_clearance.looks_like_challenge(200, {"CF-Mitigated": "challenge"}, "") is True


def test_a_challenge_served_as_200_is_still_a_challenge():
    """Status is not the signal — this has arrived as 403, 200 and 202."""
    assert cf_clearance.looks_like_challenge(200, {}, REAL_CHALLENGE_BODY) is True


def test_real_product_json_is_not_flagged():
    """The expensive false positive: launching a browser for nothing."""
    assert cf_clearance.looks_like_challenge(
        200, {"Content-Type": "application/json"}, REAL_PRODUCTS_BODY) is False


def test_an_empty_body_is_not_a_challenge():
    assert cf_clearance.looks_like_challenge(204, {}, "") is False


def test_status_records_a_success(tmp_path):
    p = tmp_path / "residential_status.json"
    state = cf_clearance.write_status("watchesoflancashire", True,
                                      path=p, now="2026-09-18")
    assert state["watchesoflancashire"]["lastSuccess"] == "2026-09-18"
    assert "lastError" not in state["watchesoflancashire"]


def test_a_failure_does_not_move_lastSuccess(tmp_path):
    """The gap between lastSuccess and lastRun is the whole signal.

    Stamping lastSuccess on a failed run would make a dead source look
    alive forever, which is precisely the silence B-99 is about.
    """
    p = tmp_path / "residential_status.json"
    cf_clearance.write_status("watchesoflancashire", True, path=p,
                              now="2026-09-01")
    state = cf_clearance.write_status("watchesoflancashire", False,
                                      "challenge not solved", path=p,
                                      now="2026-09-18")
    entry = state["watchesoflancashire"]
    assert entry["lastSuccess"] == "2026-09-01", "must not advance on failure"
    assert entry["lastRun"] == "2026-09-18"
    assert "challenge not solved" in entry["lastError"]


def test_a_recovery_clears_the_error(tmp_path):
    p = tmp_path / "residential_status.json"
    cf_clearance.write_status("x", False, "boom", path=p, now="2026-09-17")
    state = cf_clearance.write_status("x", True, path=p, now="2026-09-18")
    assert "lastError" not in state["x"]
    assert state["x"]["lastSuccess"] == "2026-09-18"


def test_a_corrupt_status_file_does_not_take_the_scrape_down(tmp_path):
    """The status file is diagnostics; it must never be load-bearing."""
    p = tmp_path / "residential_status.json"
    p.write_text("{not json at all")
    state = cf_clearance.write_status("x", True, path=p, now="2026-09-18")
    assert state["x"]["lastSuccess"] == "2026-09-18"


def test_sources_do_not_clobber_each_other(tmp_path):
    p = tmp_path / "residential_status.json"
    cf_clearance.write_status("bonhams_lots", True, path=p, now="2026-09-18")
    state = cf_clearance.write_status("watchesoflancashire", False, "x",
                                      path=p, now="2026-09-18")
    assert set(state) == {"bonhams_lots", "watchesoflancashire"}
    assert json.loads(p.read_text())["bonhams_lots"]["lastSuccess"] == "2026-09-18"
