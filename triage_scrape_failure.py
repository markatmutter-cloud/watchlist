#!/usr/bin/env python3
"""Answer "is this ours?" for a failed scrape, from the runner.

`scrape_failure_reason.py` says WHAT failed by reading the log. That is
half an answer. When the log says "maunderwatches produced no data for
three runs", the next question is always the same and always needs a
fresh HTTP request to settle: is the dealer's site down, is it blocking
our runner, or is it fine and our parser broke? Those three have
completely different fixes — a snooze, a residential move, a code
change — and the log alone cannot tell them apart.

So this runs after the alert, probes each implicated source from the
same datacenter IP the scrape uses, and writes a triage note onto the
issue the notifier already opened.

WHAT IT DELIBERATELY DOES NOT DO: change any code, touch the snooze
file, or close anything. It reports. Every fix it suggests is a
judgement call with a cost (a snooze mutes a real alert; a residential
move adds a machine that has to stay up), and those are Mark's to make.
The moment a diagnostician can also silence the thing it diagnoses, its
incentives stop matching yours.

Run: python3 triage_scrape_failure.py <failed-step-log>
Output: markdown on stdout.
"""

from __future__ import annotations

import ast
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent
WORKFLOW = REPO / ".github" / "workflows" / "scrape-listings.yml"

TIMESTAMP = re.compile(r"^\d{4}-\d\d-\d\dT[\d:.]+Z\s*")
ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")

# A source's short key ("wok") is whatever the move step echoes, which is
# not the scraper name ("watchesofknightsbridge") and not the CSV stem.
# The workflow line carries all three, so it is the one honest mapping:
#   [ -f wok_listings.csv ] && mv wok_listings.csv data/x.csv || echo "wok missing"
MOVE_LINE = re.compile(
    r"mv\s+(?P<scraper>[a-z0-9_]+)_listings\.csv\s+data/(?P<stem>[a-z0-9_]+)\.csv"
    r".*?echo\s+\"(?P<key>[a-z0-9_]+) missing\"",
    re.DOTALL,
)

# Sources the gate names when it pages, in its --check form.
GATE_SOURCE = re.compile(r"^-\s*([A-Za-z0-9_.-]+)\s*(?:—|--|:)")

CHALLENGE_MARKERS = (
    "just a moment", "cf_chl", "challenge-platform", "cf-mitigated",
    "attention required", "checking your browser", "__cf_bm",
    # SiteGround's captcha, found on Maunder 2026-09-08: a 221-byte body
    # that is nothing but a meta-refresh to the captcha path. None of the
    # Cloudflare wording appears anywhere in it, so a body-text-only
    # matcher reads it as a bare 202 and recommends TLS impersonation —
    # advice that cannot possibly work against a captcha.
    "sgcaptcha", "/.well-known/sgcaptcha",
)

# Some protections announce themselves in a header far more clearly than
# in the body. Header name -> substring that means "challenge".
CHALLENGE_HEADERS = {
    "sg-captcha": "challenge",
    "cf-mitigated": "challenge",
}


def _lines(log_text: str) -> list[str]:
    out = []
    for raw in log_text.splitlines():
        parts = ANSI.sub("", raw).split("\t")
        out.append(TIMESTAMP.sub("", (parts[-1] if len(parts) >= 3 else parts[0]).strip()))
    return [l for l in out if l]


def source_map(workflow_text: str) -> dict[str, str]:
    """key -> scraper basename, read off the workflow's move step."""
    return {m.group("key"): m.group("scraper")
            for m in MOVE_LINE.finditer(workflow_text)}


def implicated(log_text: str) -> list[str]:
    """Source keys this failure is actually about.

    Only the ones listed after the gate's own error line. A snoozed
    source prints a `##[notice]` in the same step and must not be
    dragged in — it is muted on purpose (B-80).
    """
    lines = _lines(log_text)
    keys: list[str] = []
    at = next((i for i, l in enumerate(lines)
               if "Scrape-health gate:" in l
               and ("##[error]" in l or "::error::" in l)), -1)
    if at >= 0:
        for line in lines[at + 1:]:
            if not line.startswith("- "):
                break
            m = GATE_SOURCE.match(line)
            if m:
                keys.append(m.group(1))
    # Fallback: the move step's own "<key> missing" echo, for a failure
    # that never reached the gate.
    if not keys:
        keys = [m.group(1) for l in lines
                if (m := re.match(r"^([a-z0-9_]+) missing$", l))]
    seen, ordered = set(), []
    for k in keys:
        if k not in seen:
            seen.add(k)
            ordered.append(k)
    return ordered


def probe_target(scraper: str, repo: Path = REPO) -> str | None:
    """The URL the scraper actually calls, read out of its source.

    Parsed with `ast`, never imported: importing a scraper module runs
    its top level, and several of them build sessions or read env vars.
    Prefers API (the endpoint that broke) over BASE (the front page,
    which is often up while the API is not — precisely the distinction
    this whole script exists to draw).
    """
    path = repo / f"{scraper}_scraper.py"
    if not path.exists():
        return None
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except SyntaxError:
        return None
    consts: dict[str, str] = {}
    for node in tree.body:
        if not isinstance(node, ast.Assign) or len(node.targets) != 1:
            continue
        target = node.targets[0]
        if not isinstance(target, ast.Name) or not target.id.isupper():
            continue
        value = node.value
        if isinstance(value, ast.Constant) and isinstance(value.value, str):
            consts[target.id] = value.value
        elif isinstance(value, ast.JoinedStr):
            # f"{BASE}/wp-json/..." — resolvable only from constants we
            # have already seen, which is the only form used here.
            parts = []
            for piece in value.values:
                if isinstance(piece, ast.Constant):
                    parts.append(str(piece.value))
                elif (isinstance(piece, ast.FormattedValue)
                      and isinstance(piece.value, ast.Name)
                      and piece.value.id in consts):
                    parts.append(consts[piece.value.id])
                else:
                    parts = []
                    break
            if parts:
                consts[target.id] = "".join(parts)
    for name in ("API", "CATALOG", "ENDPOINT", "PRODUCTS", "BASE", "URL"):
        url = consts.get(name, "")
        if url.startswith("http"):
            return url
    return None


def classify(status: int, body: str, error: str = "",
             headers: dict[str, str] | None = None) -> tuple[str, bool, str]:
    """(what the probe saw, is-it-ours, what to do about it)."""
    lowered = body[:4000].lower()
    head = {k.lower(): str(v).lower() for k, v in (headers or {}).items()}
    if error:
        return (f"the request itself failed ({error})",
                False,
                "Usually the host being unreachable rather than a block. "
                "Re-probe next run before doing anything.")
    if status >= 500:
        return (f"the dealer's server answered HTTP {status}",
                False,
                "Their site is down, not our access to it. Nothing in this "
                "repo can fix it — check it in a browser, and if it stays "
                "down consider a dated snooze (the B-80 pattern).")
    flagged = next((f"{k}: {v}" for k, v in head.items()
                    if k in CHALLENGE_HEADERS and CHALLENGE_HEADERS[k] in v), "")
    if flagged or any(m in lowered for m in CHALLENGE_MARKERS):
        why = f" (`{flagged}`)" if flagged else ""
        return (f"a bot-challenge/captcha page, HTTP {status}{why}",
                False,
                "curl_cffi fixes TLS fingerprints, never JavaScript or a "
                "captcha (B-81), so impersonating will not get through and "
                "relocating only moves the challenge somewhere quieter. "
                "This is the residential-agent path, or a dated snooze "
                "while it lasts.")
    if status == 202:
        return ("HTTP 202 with no data — the anti-bot 'accepted, come back "
                "later' interstitial",
                False,
                "Worth one try with curl_cffi Chrome impersonation if the "
                "scraper still uses plain requests; if it already "
                "impersonates, this is the residential-agent path.")
    if status in (401, 403):
        return (f"HTTP {status}, the runner is being refused",
                False,
                "Prove it is the IP before moving hosts: probe from "
                "residential first (CLAUDE.md). curl_cffi impersonation is "
                "the cheaper first try.")
    if status == 429:
        return ("HTTP 429, rate limited",
                True,
                "Ours to fix: slow the walk or add backoff.")
    if status == 200:
        stripped = lowered.lstrip()
        if stripped.startswith("{") or stripped.startswith("["):
            return ("HTTP 200 with valid-looking data",
                    True,
                    "The source answers CI fine right now. That points at "
                    "our parser or a transient miss, not a block — read the "
                    "scraper's own error in the run log.")
        return ("HTTP 200 but an HTML page where data should be",
                False,
                "The endpoint stopped serving data. Either it moved (ours "
                "to follow) or something is interposing a page — compare "
                "the body excerpt against what a browser gets.")
    return (f"HTTP {status}", True,
            "Not a response shape this triage knows. Read the excerpt below.")


def triage(log_text: str, fetch, workflow_text: str = "",
           repo: Path = REPO) -> str:
    if not workflow_text:
        workflow_text = WORKFLOW.read_text(encoding="utf-8") if WORKFLOW.exists() else ""
    keys = implicated(log_text)
    if not keys:
        return ("**Triage:** this failure does not name any source, so there "
                "was nothing for me to probe. It is likely a build or "
                "pipeline failure rather than a dealer one.")

    mapping = source_map(workflow_text)
    out = [f"**Triage:** probed {len(keys)} source(s) from a CI runner "
           "just now, the same datacenter IP the scrape uses.", ""]
    ours_any = False
    for key in keys:
        scraper = mapping.get(key)
        url = probe_target(scraper, repo) if scraper else None
        if not url:
            out.append(f"- **{key}** — could not work out which URL this "
                       "source calls, so it went unprobed.")
            continue
        try:
            status, body, error, headers = fetch(url)
        except Exception as e:  # a probe must never take the report down
            status, body, error, headers = 0, "", str(e), {}
        seen, ours, advice = classify(status, body, error, headers)
        ours_any = ours_any or ours
        verdict = "**ours to fix**" if ours else "**not ours**"
        out.append(f"- **{key}** ({scraper}) → {verdict}. Probing `{url}` "
                   f"returned {seen}. {advice}")
    out.append("")
    out.append("_Triage is read-only: it does not change code, edit the "
               "snooze file, or close this issue._" if not ours_any else
               "_At least one of these looks like our code rather than the "
               "dealer. Triage is read-only and has changed nothing._")
    return "\n".join(out)


def _requests_fetch(url: str):
    import requests
    headers = {
        "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/124.0.0.0 Safari/537.36"),
        "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
    }
    r = requests.get(url, headers=headers, timeout=30)
    return r.status_code, r.text[:8000], "", dict(r.headers)


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: triage_scrape_failure.py <failed-step-log>",
              file=sys.stderr)
        return 2
    try:
        log_text = Path(argv[1]).read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        print(f"**Triage:** could not read the run log ({e}).")
        return 0
    print(triage(log_text, _requests_fetch))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
