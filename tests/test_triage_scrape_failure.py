"""Triage has to answer one question correctly: is this ours?

Getting that backwards is worse than staying quiet. "Not ours" on a
broken parser means a dealer silently rots; "ours" on a dealer outage
sends someone hunting through code that was never wrong. So the
classifier's verdict is asserted directly, not just its prose.

The gate log fixture is the real one from run 34151928856.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from triage_scrape_failure import (  # noqa: E402
    classify, implicated, probe_target, source_map, triage,
)

REPO = Path(__file__).resolve().parent.parent

G = "scrape\tScrape-health gate (B-60, debounced B-66)\t"

GATE_LOG = f"""{G}2026-09-07T19:14:18.7Z ##[notice]Scrape-health (snoozed, not paging): watchcenter — missed 63 consecutive run(s) (no CSV produced this run) — snoozed until 2026-09-13 (B-80)
{G}2026-09-07T19:14:18.8Z ##[error]Scrape-health gate: 2 source(s) missing 3+ consecutive runs
{G}2026-09-07T19:14:18.9Z - maunderwatches — missed 3 consecutive run(s) (no CSV produced this run)
{G}2026-09-07T19:14:19.0Z - wok — missed 3 consecutive run(s) (no CSV produced this run)
{G}2026-09-07T19:14:19.1Z ##[error]Process completed with exit code 1.
"""

WORKFLOW_SNIPPET = '''
          [ -f maunderwatches_listings.csv ] && mv maunderwatches_listings.csv data/maunderwatches.csv || echo "maunderwatches missing"
          [ -f watchesofknightsbridge_listings.csv ] && mv watchesofknightsbridge_listings.csv data/watchesofknightsbridge.csv || echo "wok missing"
'''


def test_implicated_names_only_the_paging_sources():
    assert implicated(GATE_LOG) == ["maunderwatches", "wok"]


def test_a_snoozed_source_is_never_probed():
    """watchcenter is muted on purpose and prints in the same step.

    Probing it would put a "not ours" line about a known outage into
    every future alert, which is how a report becomes wallpaper.
    """
    assert "watchcenter" not in implicated(GATE_LOG)


def test_source_map_reads_the_workflows_own_labels():
    """`wok` is neither the scraper name nor the CSV stem.

    The move step is the only place all three appear together, so it is
    the mapping — inventing a second one guarantees drift.
    """
    m = source_map(WORKFLOW_SNIPPET)
    assert m["wok"] == "watchesofknightsbridge"
    assert m["maunderwatches"] == "maunderwatches"


def test_the_real_workflow_maps_every_source_it_can_page_about():
    """A key the gate can name but triage can't map probes nothing."""
    workflow = (REPO / ".github/workflows/scrape-listings.yml").read_text()
    m = source_map(workflow)
    assert len(m) > 35, f"only mapped {len(m)} sources — the move step changed shape?"
    assert m.get("wok") == "watchesofknightsbridge"


def test_probe_target_resolves_the_api_fstring_not_just_the_homepage():
    """`API = f"{BASE}/wp-json/..."` is the endpoint that actually broke.

    Probing BASE instead would report a healthy front page while the
    data endpoint is the thing serving an interstitial.
    """
    url = probe_target("maunderwatches")
    assert url == "https://www.maunderwatches.co.uk/wp-json/wc/store/v1/products"


# The two REAL probe responses, captured from a CI runner 2026-09-08.
# Maunder's is the whole body: 221 bytes, no Cloudflare wording anywhere,
# which is why a body-text-only matcher called it a bare 202.
MAUNDER_BODY = ('<html><head><link rel="icon" href="data:;">'
                '<meta http-equiv="refresh" content="0;'
                '/.well-known/sgcaptcha/?r=%2Fwp-json%2Fwc%2Fstore%2Fv1%2F'
                'products&y=ipr:172.182.243.250:1788839562.048"></meta>'
                "</head></html>")
MAUNDER_HEADERS = {"Server": "nginx", "Content-Type": "text/html",
                   "sg-captcha": "challenge", "x-robots-tag": "noindex"}

WOK_BODY = '[{"id":15381,"name":"Jaeger-LeCoultre Atmos Clock Lapis Dial"}]'
WOK_HEADERS = {"Server": "cloudflare", "Content-Type": "application/json",
               "x-wp-total": "573", "cf-cache-status": "DYNAMIC"}


def test_the_real_maunder_captcha_is_not_called_a_plain_202():
    """A captcha cannot be impersonated past, so the advice must differ.

    The live response is HTTP 202 whose body is a meta-refresh to
    SiteGround's captcha and whose `sg-captcha: challenge` header says so
    outright. Classified as a bare 202, the report recommends curl_cffi
    Chrome impersonation, which cannot possibly work here and would cost
    a day finding that out.
    """
    seen, ours, advice = classify(202, MAUNDER_BODY, "", MAUNDER_HEADERS)
    assert ours is False
    assert "captcha" in seen
    assert "sg-captcha: challenge" in seen
    assert "residential-agent path" in advice
    assert "impersonating will not get through" in advice


def test_the_real_knightsbridge_response_is_called_ours():
    """WoK is NOT blocked: the API served 573 products to CI just now.

    Which makes its three missed runs our own scraper's problem, and the
    report has to say so rather than blaming the dealer.
    """
    seen, ours, advice = classify(200, WOK_BODY, "", WOK_HEADERS)
    assert ours is True
    assert "our parser" in advice


def test_5xx_is_not_ours():
    seen, ours, advice = classify(503, "<html>Service Unavailable</html>")
    assert ours is False
    assert "down, not our access" in advice


def test_js_challenge_says_impersonation_will_not_help():
    seen, ours, advice = classify(403, "<html><title>Just a moment...</title>")
    assert ours is False
    assert "never JavaScript" in advice


def test_202_is_the_anti_bot_interstitial():
    seen, ours, advice = classify(202, "")
    assert ours is False
    assert "202" in seen


def test_200_with_json_points_back_at_our_own_code():
    """The fork that matters: site fine, so the fault is ours."""
    seen, ours, advice = classify(200, '[{"id": 1, "name": "A watch"}]')
    assert ours is True
    assert "our parser" in advice


def test_200_with_html_where_json_belongs_is_not_called_ours():
    seen, ours, advice = classify(200, "<!doctype html><html><body>hi</body></html>")
    assert ours is False
    assert "HTML page where data should be" in seen


def test_429_is_ours():
    seen, ours, advice = classify(429, "")
    assert ours is True


def test_triage_reports_each_source_with_a_verdict():
    calls = []

    def fake_fetch(url):
        calls.append(url)
        if "maunder" in url:
            return 202, MAUNDER_BODY, "", MAUNDER_HEADERS
        return 200, WOK_BODY, "", WOK_HEADERS

    out = triage(GATE_LOG, fake_fetch, WORKFLOW_SNIPPET, REPO)
    assert len(calls) == 2
    assert "maunderwatches" in out and "wok" in out
    assert "not ours" in out
    assert "watchcenter" not in out


def test_a_probe_that_throws_does_not_take_the_report_down():
    def exploding_fetch(url):
        raise RuntimeError("dns is having a day")

    out = triage(GATE_LOG, exploding_fetch, WORKFLOW_SNIPPET, REPO)
    assert "maunderwatches" in out
    assert "dns is having a day" in out


def test_a_failure_naming_no_source_says_so_rather_than_guessing():
    """No source named means nothing to probe, and it must say so.

    Guessing a source here would send the reader to a dealer over what
    is really a build or pipeline failure.
    """
    probed = []
    out = triage("scrape\tRun merge\t2026-09-07T00:00:00Z KeyError: 'brand'\n",
                 lambda u: probed.append(u) or (200, "", "", {}),
                 WORKFLOW_SNIPPET, REPO)
    assert "does not name any source" in out
    assert probed == []


def test_triage_never_claims_to_have_changed_anything():
    """The report is read-only and says so, every time.

    If that promise ever stops being true, this test is the thing that
    should have to be deleted first.
    """
    out = triage(GATE_LOG, lambda u: (200, "[]", "", {}), WORKFLOW_SNIPPET, REPO)
    assert "read-only" in out
