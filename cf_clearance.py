#!/usr/bin/env python3
"""Get past a Cloudflare MANAGED challenge with a real browser.

WHY THIS EXISTS, AND WHY NOTHING CHEAPER WORKS. A Cloudflare *managed*
challenge (`cf-mitigated: challenge`, `_cf_chl_opt` with
`cType: 'managed'`) demands that the client execute JavaScript. It is
not an IP reputation block and not a TLS-fingerprint check, so neither
curl_cffi impersonation nor moving to a residential host defeats it —
both were tried on Watches of Lancashire and the source sat silently
frozen for 23 days (B-99). The only client that passes is one that
actually runs the challenge script: a browser.

HOW IT IS USED. Cloudflare issues a `cf_clearance` cookie once the
challenge passes, so the expensive part happens once and the rest of the
walk is ordinary HTTP. This module keeps the browser *context* around
and fetches through it (`context.request`), which is deliberately
simpler than harvesting the cookie into another HTTP client: clearance
is bound to the (IP, User-Agent) pair that earned it, and the moment you
re-send it from a different client you are back to hand-matching a
User-Agent to a TLS fingerprint — exactly the mismatch that already bit
this scraper once (see the header comment in
watchesoflancashire_scraper.py).

RESIDENTIAL ONLY. This runs on the laptop agent, never in CI: a runner
solving the challenge would just earn clearance for a datacenter IP that
Cloudflare is minded to challenge again immediately.

Requires: pip install -r requirements-residential.txt
          python3 -m playwright install chromium
"""

from __future__ import annotations

import json
import time
from pathlib import Path

# Markers that mean "this response is a challenge, not your data".
# Header first: `cf-mitigated: challenge` is unambiguous and survives any
# body change Cloudflare makes to the interstitial.
CHALLENGE_HEADER = ("cf-mitigated", "challenge")
CHALLENGE_BODY_MARKERS = (
    "just a moment", "_cf_chl_opt", "challenge-platform",
    "enable javascript and cookies to continue", "cf_chl_",
)


def looks_like_challenge(status: int, headers: dict | None,
                         body: str | None) -> bool:
    """True when a response is Cloudflare's interstitial rather than data.

    Status alone is useless here: the challenge has been served as 403
    and, on other hosts, as 200 and even 202. The header and the body
    markers are what actually identify it.
    """
    head = {str(k).lower(): str(v).lower() for k, v in (headers or {}).items()}
    if CHALLENGE_HEADER[1] in head.get(CHALLENGE_HEADER[0], ""):
        return True
    text = (body or "")[:4000].lower()
    return any(m in text for m in CHALLENGE_BODY_MARKERS)


class ChallengeNotSolved(RuntimeError):
    """The browser ran but never got past the interstitial."""


class BrowserSession:
    """A Chromium context that has passed the challenge for one origin.

    Used as a context manager so the browser is always torn down, even
    when a fetch mid-walk raises — a leaked headless Chromium on a laptop
    that runs this hourly would pile up until something gets killed.
    """

    def __init__(self, origin: str, *, timeout_ms: int = 45_000,
                 headless: bool = True):
        self.origin = origin.rstrip("/")
        self.timeout_ms = timeout_ms
        self.headless = headless
        self._pw = None
        self._browser = None
        self._context = None

    def __enter__(self) -> "BrowserSession":
        from playwright.sync_api import sync_playwright

        self._pw = sync_playwright().start()
        # Chromium rather than WebKit/Firefox: the challenge is tuned
        # against real-world traffic and Chromium is the least
        # interesting thing to see.
        self._browser = self._pw.chromium.launch(headless=self.headless)
        self._context = self._browser.new_context()
        self._solve()
        return self

    def __exit__(self, *exc) -> None:
        for closer in (self._context, self._browser):
            try:
                if closer:
                    closer.close()
            except Exception:
                pass
        try:
            if self._pw:
                self._pw.stop()
        except Exception:
            pass

    def _solve(self) -> None:
        """Load the origin and wait for the interstitial to go away.

        The challenge resolves itself: the page runs its script, posts
        back, and navigates. So the wait is for the cf_clearance cookie
        to appear rather than for any particular selector, which is the
        one signal that does not depend on the dealer's own markup.
        """
        page = self._context.new_page()
        try:
            page.goto(self.origin, timeout=self.timeout_ms,
                      wait_until="domcontentloaded")
            deadline = time.monotonic() + self.timeout_ms / 1000
            while time.monotonic() < deadline:
                if any(c["name"] == "cf_clearance"
                       for c in self._context.cookies()):
                    return
                page.wait_for_timeout(500)
            # No clearance cookie. If the body no longer looks like a
            # challenge we are through anyway (some zones drop the
            # interstitial without issuing one).
            if not looks_like_challenge(200, None, page.content()):
                return
            raise ChallengeNotSolved(
                f"{self.origin}: still showing the interstitial after "
                f"{self.timeout_ms / 1000:.0f}s")
        finally:
            page.close()

    def get_json(self, url: str, params: dict | None = None):
        """Fetch JSON through the cleared browser context."""
        resp = self._context.request.get(url, params=params or {},
                                         timeout=self.timeout_ms)
        body = resp.text()
        if looks_like_challenge(resp.status, dict(resp.headers), body):
            raise ChallengeNotSolved(
                f"{url}: challenged again mid-walk (clearance expired?)")
        if resp.status != 200:
            raise RuntimeError(f"{url}: HTTP {resp.status}")
        return json.loads(body)


def write_status(source: str, ok: bool, detail: str = "",
                 path: str | Path = "data/residential_status.json",
                 now: str | None = None) -> dict:
    """Record the outcome of one residential source's scrape.

    A CI source that stops producing trips the scrape-health gate within
    three runs. A residential one produces nothing the gate can see — it
    is not in the workflow's move step — so B-99 went unnoticed for 23
    days behind a 21-day freshness budget. This file is the missing
    signal: committed with the data, readable by a gate, and honest about
    failures rather than silently keeping yesterday's CSV.
    """
    from datetime import date

    today = now or date.today().isoformat()
    p = Path(path)
    try:
        state = json.loads(p.read_text())
        if not isinstance(state, dict):
            state = {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        state = {}

    entry = state.get(source) if isinstance(state.get(source), dict) else {}
    entry["lastRun"] = today
    if ok:
        entry["lastSuccess"] = today
        entry.pop("lastError", None)
    else:
        # lastSuccess is deliberately left alone: the gap between it and
        # lastRun is the whole point.
        entry["lastError"] = detail[:300] or "scrape produced no data"
    state[source] = entry

    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n")
    return state
