#!/usr/bin/env python3
"""Turn a failed workflow's log into one plain-English sentence.

notify-scrape-failure.yml opens a GitHub Issue whenever a scheduled
workflow fails. Until now that issue said only *which* workflow failed
and linked the run — so every alert cost a trip to the Actions tab and a
scroll through a few thousand log lines before you knew whether a dealer
had blocked us, two runs had collided pushing to main, or a test had
simply rotted. Mark's actual question on seeing an alert is "why?", and
the answer was never in the alert.

This reads the failed steps' log (`gh run view --log-failed`) and prints
a short markdown block naming the most likely cause, with the evidence
that led there. It is deliberately a best-effort classifier: an
unrecognised failure prints an honest "not recognised" plus the tail of
the log, which is still strictly more than the alert used to carry.

WHY A PATTERN LADDER AND NOT SOMETHING CLEVERER: every rule below was
written off a real failure in this repo's Actions history. Ordering is
most-specific-first, because several markers co-occur — a Cloudflare
block shows up inside a Python traceback, and a jest failure ends with
the same "exit code 1" as everything else.

Run: python3 scrape_failure_reason.py <log-file>
Output: markdown on stdout (never fails; worst case it says so).
"""

from __future__ import annotations

import re
import sys

# The tail is all that matters: a scrape log is ~4k lines of per-listing
# progress and the failure is at the end. Capping keeps both the regex
# sweep and the quoted excerpt cheap.
MAX_LINES = 4000
EXCERPT_LINES = 25

ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
# `gh run view --log` prefixes every line with "job<TAB>step<TAB>" and the
# runner prefixes the message itself with an ISO timestamp. Both are noise
# in a quoted excerpt, but the job/step prefix is how we name the failing
# step, so it's stripped late rather than on read.
TIMESTAMP = re.compile(r"^\d{4}-\d\d-\d\dT[\d:.]+Z\s*")


def _step_of(line: str) -> tuple[str, str] | None:
    """('job', 'step') from a `gh run view --log` prefix, if present."""
    parts = ANSI.sub("", line).split("\t")
    if len(parts) >= 3 and parts[0] and parts[1]:
        return parts[0].strip(), parts[1].strip()
    return None


def _message(line: str) -> str:
    """The log line with job/step prefix, timestamp and ANSI removed."""
    parts = ANSI.sub("", line.rstrip("\n")).split("\t")
    return TIMESTAMP.sub("", (parts[-1] if len(parts) >= 3 else parts[0]).strip())


def failing_step(lines: list[str], anchor: int | None = None) -> str:
    """Name the step to open, for the alert's first bullet.

    `--log-failed` can carry SEVERAL failed steps: the health report fails
    health.py AND the freshness gate, and naming the first one sends the
    reader to a step that is not the one being described. When a rule
    knows which line it read the cause from, the step that owns THAT line
    is the honest answer.
    """
    if anchor is not None:
        for line in reversed(lines[:anchor + 1]):
            found = _step_of(line)
            if found:
                job, step = found
                return f"{job} / {step}" if job != step else step
    for line in lines:
        found = _step_of(line)
        if found:
            job, step = found
            return f"{job} / {step}" if job != step else step
    return ""


# ── the rules ─────────────────────────────────────────────────────────────
# Each takes the cleaned message lines and returns (headline, details) or
# None. Keep headlines to one sentence a non-coder can act on.

def _jest(lines: list[str]) -> tuple[str, list[str]] | None:
    failed = [l for l in lines if re.match(r"●\s+\S.*›", l)]
    summary = next((l for l in lines if l.startswith("Tests:") and "failed" in l), "")
    if not failed and not summary:
        return None
    name = failed[0].lstrip("● ").strip() if failed else "a front-end test"
    head = (f"A front-end (jest) test failed: `{name}`. That test renders a "
            "component and checks what it puts on screen, so either the "
            "component changed or the test's expectation went stale.")
    details = []
    if summary:
        details.append(summary)
    assertion = next((l for l in lines if "Unable to find an element" in l), "")
    if assertion:
        details.append(assertion)
    return head, details


def _pytest(lines: list[str]) -> tuple[str, list[str]] | None:
    failed = [l for l in lines if l.startswith("FAILED ")]
    if not failed:
        return None
    head = (f"A Python test failed: `{failed[0][len('FAILED '):].strip()}`. "
            "The merge/scraper logic and its test disagree.")
    return head, failed[1:4]


def _push_race(lines: list[str]) -> tuple[str, list[str]] | None:
    """Only when the retry ladder actually gave up.

    A single `! [rejected]` is the NORMAL shape of a healthy scrape run:
    two crons collide, the workflow rebases and pushes again, and the run
    goes green. Firing on the rejection alone made this rule claim a push
    race on a run that had recovered seconds later — checked against a
    real log, which is the only reason it was caught.
    """
    rejected = [i for i, l in enumerate(lines) if "[rejected]" in l
                or "failed to push some refs" in l]
    if not rejected:
        return None
    gave_up = any("Push still failing after" in l for l in lines)
    if not gave_up:
        # A later successful push ("  abc1234..def5678  main -> main")
        # means the ladder worked and this is not the failure.
        recovered = any(re.search(r"\.\.\w+\s+\S+\s*->\s*\S+", l)
                        for l in lines[rejected[-1] + 1:])
        if recovered:
            return None
    head = ("Two runs tried to push to `main` at the same time and the retry "
            "ladder ran out. Nothing is wrong with the data — this run "
            "scraped fine, its commit just never landed.")
    return head, [l for l in lines if "[rejected]" in l][:2]


# A script printing `::error::x` shows up in the FETCHED log as
# `##[error]x` — the runner rewrites its own annotation syntax on the way
# out. Matching only the `::` form meant these two rules never fired on a
# real log, which is how a health-gate failure reached Mark's inbox
# labelled "not a failure shape this alert recognises yet". Accept both.
ERROR_MARKERS = ("::error::", "##[error]")


def _is_error(line: str, needle: str) -> bool:
    return needle in line and any(m in line for m in ERROR_MARKERS)


# The gate prints sources two ways: `- name: N consecutive` when recording
# and `- name — missed N consecutive run(s)` when it pages. Only the second
# ever appears in a failing run, but both are cheap to accept.
SOURCE_NAME = re.compile(r"^([A-Za-z0-9_.-]+)\s*(?::|—|--)")


def _our_gate(lines: list[str]) -> tuple[str, list[str]] | None:
    """Any of our own health checks, named by its own error line.

    Written after missing TWICE by adding one rule per gate: the
    scrape-health gate, then the freshness gate ("Freshness gate: 3
    source(s) stale") which reported to Mark as an unrecognised failure.
    There are six of these checks and more will be added, so matching
    them one at a time is a standing bug.

    Our gates all annotate with `::error::<Name>: <what and how many>`,
    which is a better sentence than anything a matcher could compose —
    so quote it rather than paraphrase. Runs after the specific rules,
    which add wording this cannot know.
    """
    for i, line in enumerate(lines):
        if not any(m in line for m in ERROR_MARKERS):
            continue
        msg = line.split("##[error]")[-1].split("::error::")[-1].strip()
        # The runner's own step-failed annotation says nothing.
        if not msg or msg.startswith("Process completed with exit code"):
            continue
        detail = []
        for nxt in lines[i + 1:]:
            if not nxt.startswith("- "):
                break
            detail.append(nxt.lstrip("- ").strip())
        head = (f"One of our own health checks stopped the run: “{msg}”. "
                "These read the committed data rather than the scrape's "
                "exit code, so the run itself may well have worked — the "
                "check is reporting rot it found afterwards.")
        return head, detail[:4], i
    return None


def _health_gate(lines: list[str]) -> tuple[str, list[str]] | None:
    at = next((i for i, l in enumerate(lines)
               if _is_error(l, "Scrape-health gate:")), -1)
    if at < 0:
        return None
    # ONLY the sources listed after the gate's error line. The same log
    # also carries the recording step's roster and a `##[notice]` line per
    # SNOOZED source — naming a snoozed one (watchcenter, a known dealer
    # outage) as the cause sends Mark after something deliberately muted.
    sources, seen, names = [], set(), []
    for line in lines[at + 1:]:
        if not line.startswith("- ") or "consecutive" not in line:
            break
        entry = line.lstrip("- ").strip()
        m = SOURCE_NAME.match(entry)
        name = m.group(1) if m else entry
        if name not in seen:
            seen.add(name)
            names.append(name)
            sources.append(entry)
    named = ", ".join(names) or "see the run"
    head = (f"A source has gone quiet: {named} produced no data for three runs "
            "in a row. The scrape itself finished — the health gate is "
            "flagging rot, not a crash.")
    return head, sources[:4]


def _canary(lines: list[str]) -> tuple[str, list[str]] | None:
    hit = next((l for l in lines if _is_error(l, "Calendar canary:")), "")
    if not hit:
        return None
    houses = [l.lstrip("- ").strip() for l in lines if l.startswith("- ")]
    head = ("An auction house's calendar returned zero sales, which normally "
            "means that house redesigned its page and the parser no longer "
            "finds anything.")
    return head, houses[:4]


def _blocked(lines: list[str]) -> tuple[str, list[str]] | None:
    markers = ("cf-mitigated", "Just a moment", "challenge-platform",
               "Attention Required", "403 Client Error", "HTTP status: 403")
    hit = next((l for l in lines if any(m.lower() in l.lower() for m in markers)), "")
    if not hit:
        return None
    head = ("A source blocked the CI runner (403 / Cloudflare challenge). "
            "Datacenter IPs get treated differently from home broadband, so "
            "this usually needs the residential agent rather than a code fix.")
    return head, [hit]


def _timeout(lines: list[str]) -> tuple[str, list[str]] | None:
    markers = ("Read timed out", "Max retries exceeded", "ConnectTimeout",
               "Connection aborted", "timed out")
    hit = next((l for l in lines if any(m in l for m in markers)), "")
    if not hit:
        return None
    head = ("A source stopped responding (network timeout). Usually the "
            "dealer's site being slow or briefly down, not our code.")
    return head, [hit]


def _job_cancelled(lines: list[str]) -> tuple[str, list[str]] | None:
    markers = ("exceeded the maximum execution time", "The operation was canceled",
               "The job running on runner")
    hit = next((l for l in lines if any(m in l for m in markers)), "")
    if not hit:
        return None
    head = ("The job hit its time limit and was cancelled before it finished. "
            "Whatever it had scraped up to that point was thrown away.")
    return head, [hit]


def _runner_limits(lines: list[str]) -> tuple[str, list[str]] | None:
    for line in lines:
        if "No space left on device" in line:
            return ("The runner ran out of disk part-way through, so the run "
                    "could not write its output."), [line]
        if "exit code 137" in line or line.strip() == "Killed":
            return ("The job ran out of memory and was killed."), [line]
    return None


def _dependencies(lines: list[str]) -> tuple[str, list[str]] | None:
    hit = next((l for l in lines if l.startswith("ModuleNotFoundError")
                or "Could not find a version that satisfies" in l
                or "npm ERR!" in l), "")
    if not hit:
        return None
    head = ("Installing dependencies failed, so the job never got as far as "
            "running anything.")
    return head, [hit]


def _credentials(lines: list[str]) -> tuple[str, list[str]] | None:
    markers = ("authentication_error", "invalid x-api-key", "AuthenticationError",
               "401 Client Error", "Bad credentials")
    hit = next((l for l in lines if any(m.lower() in l.lower() for m in markers)), "")
    if not hit:
        return None
    head = ("An API key was rejected. The repo secret is missing, expired or "
            "wrong — nothing will work until it's replaced.")
    return head, [hit]


def _traceback(lines: list[str]) -> tuple[str, list[str]] | None:
    if not any(l.startswith("Traceback (most recent call last)") for l in lines):
        return None
    # The exception is the last "SomeError: message" line in the log; the
    # nearest preceding `File "..."` line says where it was raised.
    exc_at = -1
    for i, line in enumerate(lines):
        if re.match(r"^[A-Za-z_.]*(Error|Exception)\b", line):
            exc_at = i
    if exc_at < 0:
        return None
    where = next((lines[j] for j in range(exc_at - 1, max(exc_at - 8, -1), -1)
                  if lines[j].startswith('File "')), "")
    head = f"The script crashed: `{lines[exc_at][:160]}`."
    return head, [where] if where else []


RULES = (
    _health_gate,     # our own gates name their cause outright — trust them first
    _canary,
    _push_race,       # a rejected push often sits alongside unrelated 403 noise
    _our_gate,        # any other gate of ours, quoted from its own annotation
    _credentials,
    _runner_limits,
    _job_cancelled,
    _dependencies,
    _jest,
    _pytest,
    _blocked,         # after the suites: a 403 inside a test log is the test's story
    _timeout,
    _traceback,       # last: almost every failure above can also print one
)


def _drop_command_echo(lines: list[str]) -> list[str]:
    """Remove the `##[group]Run …` blocks: script text, not output.

    Every `run:` step opens by echoing its own source and its env into a
    collapsed group. That echo is indistinguishable from real output once
    ANSI is stripped, and it lies: the commit step echoes
    `echo "Push still failing after 3 retries"`, so matching that string
    anywhere reported a push race on a run whose push had SUCCEEDED. Same
    trap for any rule keyed to a string a script also prints.
    """
    kept, skipping = [], False
    for line in lines:
        if line.startswith("##[group]Run "):
            skipping = True
            continue
        if skipping:
            if line.startswith("##[endgroup]"):
                skipping = False
            continue
        kept.append(line)
    return kept


def explain(log_text: str) -> str:
    raw = log_text.splitlines()[-MAX_LINES:]
    lines = [_message(l) for l in raw]
    lines = _drop_command_echo([l for l in lines if l])

    headline, details, anchor = "", [], None
    for rule in RULES:
        found = rule(lines)
        if found:
            # A rule may add the line index it read the cause from, so the
            # bullet can name the step that actually owns it.
            headline, details = found[0], found[1]
            anchor = found[2] if len(found) > 2 else None
            break

    out = []
    if headline:
        out.append(f"**Why it failed:** {headline}")
    else:
        out.append("**Why it failed:** Not a failure shape this alert "
                   "recognises yet. The tail of the log is below — if it "
                   "turns out to be a recurring one, add it to "
                   "`scrape_failure_reason.py`.")

    step = failing_step(raw, anchor)
    bullets = ([f"Failing step: `{step}`"] if step else []) + [d for d in details if d]
    if bullets:
        out.append("")
        out.extend(f"- {b[:300]}" for b in bullets)

    tail = [l for l in lines if l][-EXCERPT_LINES:]
    if tail:
        out.append("")
        out.append("<details><summary>Last lines of the failing step</summary>")
        out.append("")
        out.append("```")
        out.extend(tail)
        out.append("```")
        out.append("</details>")
    return "\n".join(out)


def main(argv: list[str]) -> int:
    args = argv[1:]
    if not args:
        print("usage: scrape_failure_reason.py <log-file>", file=sys.stderr)
        return 2
    try:
        with open(args[0], encoding="utf-8", errors="replace") as f:
            text = f.read()
    except OSError as e:
        # Never fail the alert over the diagnosis: an unreadable log still
        # deserves an issue, just without the "why".
        print(f"**Why it failed:** couldn't read the run log ({e}). "
              "See the run link above.")
        return 0
    print(explain(text))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
