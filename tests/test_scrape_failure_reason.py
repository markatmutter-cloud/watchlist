"""The failure alert has to say WHY, and say it correctly.

Every fixture below is the real shape of a failure this repo has actually
had — copied from the Actions logs, `gh run view --log-failed` prefixes
and runner timestamps included, because those prefixes are exactly what
a naive matcher trips over.

The bar these tests hold: a wrong headline is worse than none. An alert
that says "a dealer blocked us" when two runs collided pushing to main
sends Mark to the wrong place, so the ordering cases (a log that carries
two markers at once) matter as much as the single-cause ones.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scrape_failure_reason import explain  # noqa: E402

P = "jest\tRun jest (CI mode — single run, no watch)\t"
S = "scrape\tCommit and push\t"


JEST_LOG = f"""{P}2026-09-04T13:44:26.5697074Z   ● HomeAuctionModule › renders the upcoming sale with its date
{P}2026-09-04T13:44:26.5698411Z     Unable to find an element with the text: Rare Watches
{P}2026-09-04T13:44:26.5723490Z     > 38 |     expect(screen.getByText("Rare Watches")).toBeInTheDocument();
{P}2026-09-04T13:44:26.5747147Z Test Suites: 1 failed, 1 skipped, 55 passed, 56 of 57 total
{P}2026-09-04T13:44:26.5747949Z Tests:       1 failed, 24 skipped, 312 passed, 337 total
{P}2026-09-04T13:44:26.5941711Z ##[error]Process completed with exit code 1.
"""

PUSH_RACE_LOG = f"""{S}2026-09-04T07:23:12.0622833Z [main 18e29b1] Listings update 2026-09-04 07:23 UTC
{S}2026-09-04T07:23:12.7363936Z To https://github.com/markatmutter-cloud/watchlist
{S}2026-09-04T07:23:12.7364514Z  ! [rejected]        main -> main (fetch first)
{S}2026-09-04T07:23:12.7365127Z error: failed to push some refs to 'https://github.com/markatmutter-cloud/watchlist'
{S}2026-09-04T07:23:12.7376813Z Push still failing after 3 retries
"""

HEALTH_GATE_LOG = """scrape\tScrape-health gate (B-60, debounced B-66)\t2026-09-04T07:24:31.0764749Z ::error::Scrape-health gate: 2 source(s) missing 3+ consecutive runs
scrape\tScrape-health gate (B-60, debounced B-66)\t2026-09-04T07:24:31.0765749Z   - watchcenter: 53 consecutive (no CSV produced this run)
scrape\tScrape-health gate (B-60, debounced B-66)\t2026-09-04T07:24:31.0766749Z   - visionvintagewatches: 4 consecutive (no CSV produced this run)
"""

CANARY_LOG = """canary\tRun calendar canary\t2026-09-04T05:10:01.0Z ::error::Calendar canary: 1 house(s) returned zero sales
canary\tRun calendar canary\t2026-09-04T05:10:01.1Z   - Bonhams: 0 sales parsed — the page shape has probably changed
"""

BLOCKED_LOG = """scrape\tRun Bonhams scraper\t2026-09-04T06:10:00.0Z   fetching department page
scrape\tRun Bonhams scraper\t2026-09-04T06:10:02.0Z requests.exceptions.HTTPError: 403 Client Error: Forbidden for url: https://www.bonhams.com/departments/WAT/
"""

TIMEOUT_LOG = """scrape\tRun Somlo scraper\t2026-09-04T06:12:00.0Z   page 3 failed: HTTPSConnectionPool(host='somlolondon.com', port=443): Read timed out. (read timeout=20)
"""

TRACEBACK_LOG = """scrape\tRun merge\t2026-09-04T07:00:00.0Z Traceback (most recent call last):
scrape\tRun merge\t2026-09-04T07:00:00.1Z   File "/home/runner/work/watchlist/watchlist/merge.py", line 512, in load_csv
scrape\tRun merge\t2026-09-04T07:00:00.2Z     brand = KNOWN[row['brand']]
scrape\tRun merge\t2026-09-04T07:00:00.3Z KeyError: 'brand'
"""

CANCELLED_LOG = """scrape\tRun Watchfid scraper\t2026-09-04T06:55:00.0Z The job running on runner GitHub Actions 12 has exceeded the maximum execution time of 360 minutes.
"""

UNKNOWN_LOG = """scrape\tRun something new\t2026-09-04T06:55:00.0Z segfault in a thing we have never seen
scrape\tRun something new\t2026-09-04T06:55:01.0Z ##[error]Process completed with exit code 1.
"""


def test_jest_failure_names_the_test():
    out = explain(JEST_LOG)
    assert "front-end (jest) test failed" in out
    assert "HomeAuctionModule › renders the upcoming sale with its date" in out
    # The step name comes off the gh log prefix, not a second API call.
    assert "Failing step: `jest / Run jest (CI mode — single run, no watch)`" in out
    assert "Tests:       1 failed, 24 skipped, 312 passed, 337 total" in out


def test_push_race_says_the_data_was_fine():
    out = explain(PUSH_RACE_LOG)
    assert "push to `main` at the same time" in out
    # This is the distinction that decides whether Mark needs to do
    # anything at all, so it is asserted, not left to phrasing drift.
    assert "scraped fine" in out


def test_health_gate_names_the_quiet_sources():
    out = explain(HEALTH_GATE_LOG)
    assert "gone quiet" in out
    assert "watchcenter" in out
    assert "visionvintagewatches" in out


# The REAL failing-step log from run 34151928856 (2026-09-07), the first
# production failure this classifier saw. It got it wrong: the runner
# rewrites a script's `::error::` annotation to `##[error]` on the way
# into the log, so the rule never matched and the alert told Mark
# "not a failure shape this alert recognises yet".
REAL_GATE_LOG = """scrape	Scrape-health gate (B-60, debounced B-66)	2026-09-07T19:14:18.7Z ##[notice]Scrape-health (snoozed, not paging): watchcenter — missed 63 consecutive run(s) (no CSV produced this run) — snoozed until 2026-09-13 (B-80 - dealer-side outage.)
scrape	Scrape-health gate (B-60, debounced B-66)	2026-09-07T19:14:18.8Z ##[error]Scrape-health gate: 2 source(s) missing 3+ consecutive runs
scrape	Scrape-health gate (B-60, debounced B-66)	2026-09-07T19:14:18.9Z - maunderwatches — missed 3 consecutive run(s) (no CSV produced this run)
scrape	Scrape-health gate (B-60, debounced B-66)	2026-09-07T19:14:19.0Z - wok — missed 3 consecutive run(s) (no CSV produced this run)
scrape	Scrape-health gate (B-60, debounced B-66)	2026-09-07T19:14:19.1Z ##[error]Process completed with exit code 1.
"""


def test_the_runners_hash_error_form_is_recognised():
    """`::error::` never survives into a fetched log; `##[error]` does."""
    out = explain(REAL_GATE_LOG)
    assert "gone quiet" in out
    assert "maunderwatches, wok" in out


def test_a_snoozed_source_is_not_named_as_the_cause():
    """watchcenter is a deliberately muted dealer outage (B-80).

    It prints a `##[notice]` line in the very same step. Naming it would
    send Mark after something we chose not to page on.
    """
    out = explain(REAL_GATE_LOG)
    assert "watchcenter" not in out.split("<details>")[0]


# The real Health report failure of 2026-09-09, which reported to Mark as
# an unrecognised shape. Two failed steps in one log, and the one that
# names the cause is the SECOND.
R = "report\tRun python3 health.py\t"
F = "report\tRun python3 source_freshness.py --check\t"
FRESHNESS_LOG = f"""{R}2026-09-09T18:19:21.7Z   1 issue(s) flagged — see sections above
{R}2026-09-09T18:19:21.7Z ##[error]Process completed with exit code 1.
{F}2026-09-09T18:19:21.7Z ##[error]Freshness gate: 3 source(s) stale
{F}2026-09-09T18:19:21.7Z   - Chronoholic [dealer]: content unchanged for 23d (budget 21d)
{F}2026-09-09T18:19:21.7Z   - ClassicHeuer [dealer]: content unchanged for 22d (budget 21d)
{F}2026-09-09T18:19:21.7Z ##[error]Process completed with exit code 1.
"""


def test_any_gate_of_ours_is_recognised_not_just_the_ones_with_a_rule():
    """Adding one rule per gate was itself the bug.

    Six of these checks exist and more will be added; the freshness gate
    had no rule and so reached Mark as "not a failure shape this alert
    recognises yet". Our gates state their own cause better than a
    matcher could, so the generic rule quotes them.
    """
    out = explain(FRESHNESS_LOG)
    assert "Freshness gate: 3 source(s) stale" in out
    assert "Not a failure shape" not in out
    assert "Chronoholic" in out


def test_the_step_named_is_the_one_that_owns_the_cause():
    """Two steps failed; naming the first sends the reader to the wrong log."""
    out = explain(FRESHNESS_LOG)
    assert "Failing step: `report / Run python3 source_freshness.py --check`" in out


def test_the_runners_own_step_annotation_is_not_treated_as_a_cause():
    """`##[error]Process completed with exit code 1.` says nothing.

    It is present in every failing log, so matching it would make the
    generic rule fire on everything and explain nothing.
    """
    bare = f"{R}2026-09-09T18:19:21.7Z ##[error]Process completed with exit code 1.\n"
    out = explain(bare)
    assert "Not a failure shape this alert recognises yet" in out


def test_canary_blames_the_page_shape():
    out = explain(CANARY_LOG)
    assert "zero sales" in out
    assert "Bonhams" in out


def test_block_points_at_the_residential_agent():
    out = explain(BLOCKED_LOG)
    assert "blocked the CI runner" in out
    assert "residential agent" in out


def test_timeout_is_not_reported_as_a_block():
    out = explain(TIMEOUT_LOG)
    assert "stopped responding" in out
    assert "blocked the CI runner" not in out


def test_traceback_quotes_the_exception_and_the_file():
    out = explain(TRACEBACK_LOG)
    assert "KeyError: 'brand'" in out
    assert "merge.py" in out


def test_cancelled_job_says_the_work_was_thrown_away():
    out = explain(CANCELLED_LOG)
    assert "time limit" in out


def test_unrecognised_failure_admits_it_and_still_shows_the_log():
    out = explain(UNKNOWN_LOG)
    assert "Not a failure shape this alert recognises yet" in out
    assert "segfault in a thing we have never seen" in out


RECOVERED_PUSH_LOG = f"""{S}2026-09-04T07:23:12.7364514Z  ! [rejected]        main -> main (fetch first)
{S}2026-09-04T07:23:12.7365127Z error: failed to push some refs to 'https://github.com/markatmutter-cloud/watchlist'
{S}2026-09-04T07:23:12.7376813Z Push rejected, rebasing and retrying (1/3)...
{S}2026-09-04T07:24:28.1304703Z Successfully rebased and updated refs/heads/main.
{S}2026-09-04T07:24:31.0416065Z    868aa212..f2833145  main -> main
{S}2026-09-04T07:24:31.5000000Z requests.exceptions.HTTPError: 403 Client Error: Forbidden for url: https://www.bonhams.com/
"""


def test_a_recovered_push_is_not_a_push_race():
    """The normal shape of a HEALTHY run, and it must not win.

    Two crons collide most days: the push is rejected, the workflow
    rebases, the second push lands, the run goes green. Matching on the
    rejection alone made this rule claim a push race on exactly that log
    — caught only by running the classifier over a real one.
    """
    out = explain(RECOVERED_PUSH_LOG)
    assert "push to `main` at the same time" not in out
    # It falls through to whatever else the log carries.
    assert "blocked the CI runner" in out


ECHOED_SCRIPT_LOG = f"""{S}2026-09-04T07:23:11.2964008Z ##[group]Run git config user.name "github-actions[bot]"
{S}2026-09-04T07:23:11.2967010Z for i in 1 2 3; do
{S}2026-09-04T07:23:11.2967263Z   if git push; then exit 0; fi
{S}2026-09-04T07:23:11.2967602Z   echo "Push rejected, rebasing and retrying ($i/3)..."
{S}2026-09-04T07:23:11.2971864Z echo "Push still failing after 3 retries"
{S}2026-09-04T07:23:11.2994891Z shell: /usr/bin/bash -e {{0}}
{S}2026-09-04T07:23:11.2995169Z ##[endgroup]
{S}2026-09-04T07:23:12.7364514Z  ! [rejected]        main -> main (fetch first)
{S}2026-09-04T07:24:31.0416065Z    868aa212..f2833145  main -> main
{S}2026-09-04T07:24:31.5000000Z requests.exceptions.HTTPError: 403 Client Error: Forbidden for url: https://www.bonhams.com/
"""


def test_the_step_echoing_its_own_script_does_not_drive_the_verdict():
    """Every `run:` step opens by echoing its source into a group block.

    The commit step's source contains the literal string
    `Push still failing after 3 retries`, so a matcher that reads the
    echo concludes the push gave up on a run where it plainly succeeded
    two lines later. Found by running this over a real log, not imagined.
    """
    out = explain(ECHOED_SCRIPT_LOG)
    assert "push to `main` at the same time" not in out
    assert "blocked the CI runner" in out


def test_push_race_wins_over_unrelated_403_noise():
    """A scrape log carries a dealer's 403 in almost every run.

    That 403 is `continue-on-error` noise — the batch survived it. If it
    outranked the rejected push, the alert would send Mark to a dealer
    site over a failure that is purely ours.
    """
    mixed = BLOCKED_LOG + PUSH_RACE_LOG
    out = explain(mixed)
    assert "push to `main` at the same time" in out
    assert "blocked the CI runner" not in out


def test_every_output_carries_the_log_excerpt():
    for log in (JEST_LOG, PUSH_RACE_LOG, HEALTH_GATE_LOG, UNKNOWN_LOG):
        out = explain(log)
        assert "<details><summary>Last lines of the failing step</summary>" in out


def test_empty_log_does_not_crash():
    out = explain("")
    assert "Why it failed" in out
