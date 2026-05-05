"""State-transition tests for merge.update_state.

Covers the core lifecycle a listing goes through across consecutive
scrape runs: first sight, persistence with and without price moves,
disappearance, reappearance, and multi-cycle churn.

These tests document current behavior. If a test hits a case that
seems to surface a bug, the test is written against the *current*
behavior (with a comment flagging it) — bug fixes are out of scope
for this PR per Mark's instruction.
"""
from conftest import make_item

import merge


# Helper to find the enriched record (or state entry) for a known URL.
def _id_for(url, source="Test Dealer", title="Rolex Submariner Reference 5513"):
    return merge.stable_id(url, fallback_key=f"{source}|{title}")


def _enriched_by_id(enriched, sid):
    matches = [e for e in enriched if e["id"] == sid]
    assert len(matches) == 1, f"expected one enriched record for {sid}, got {len(matches)}"
    return matches[0]


# ── Single-listing transitions ──────────────────────────────────────────────


def test_new_listing_sets_first_seen_today_and_marks_active(at_date):
    at_date("2026-04-01")
    item = make_item(price=5000)
    state = {}

    enriched = merge.update_state([item], state)

    sid = item["id"]
    assert sid in state, "state should hold the newly-seen listing"
    entry = state[sid]
    assert entry["firstSeen"] == "2026-04-01"
    assert entry["lastSeen"] == "2026-04-01"
    assert entry["active"] is True
    assert entry["priceHistory"] == [
        {"date": "2026-04-01", "price": 5000, "currency": "USD"}
    ]

    out = _enriched_by_id(enriched, sid)
    assert out["firstSeen"] == "2026-04-01"
    assert out["lastSeen"] == "2026-04-01"
    assert out["priceChange"] == 0
    assert out["priceDropTotal"] == 0
    assert out["pricePeak"] == 5000


def test_listing_persists_with_same_price_does_not_append_history(at_date):
    at_date("2026-04-01")
    item = make_item(price=5000)
    state = {}
    merge.update_state([item], state)

    at_date("2026-04-02")
    merge.update_state([item], state)

    entry = state[item["id"]]
    assert entry["lastSeen"] == "2026-04-02", "lastSeen must update on each sight"
    assert entry["firstSeen"] == "2026-04-01", "firstSeen must NOT change"
    # priceHistory holds one entry — the original — because price is unchanged.
    assert len(entry["priceHistory"]) == 1
    assert entry["priceHistory"][0]["price"] == 5000


def test_listing_persists_with_price_drop_appends_history_and_records_drop(at_date):
    at_date("2026-04-01")
    state = {}
    merge.update_state([make_item(price=5000)], state)

    at_date("2026-04-02")
    enriched = merge.update_state([make_item(price=4500)], state)

    item_id = make_item()["id"]
    entry = state[item_id]
    assert len(entry["priceHistory"]) == 2, "price drop must append to history"
    assert entry["priceHistory"][-1]["price"] == 4500
    assert entry["priceHistory"][-1]["date"] == "2026-04-02"

    # priceDropAt should record the day the cut happened.
    assert entry.get("priceDropAt") == "2026-04-02"

    out = _enriched_by_id(enriched, item_id)
    # Last-step change is negative; priceDropTotal is positive (peak - now).
    assert out["priceChange"] == -500
    assert out["priceDropTotal"] == 500
    assert out["pricePeak"] == 5000


def test_listing_persists_with_price_increase_appends_history(at_date):
    at_date("2026-04-01")
    state = {}
    merge.update_state([make_item(price=5000)], state)

    at_date("2026-04-02")
    enriched = merge.update_state([make_item(price=5500)], state)

    sid = make_item()["id"]
    entry = state[sid]
    assert len(entry["priceHistory"]) == 2
    assert entry["priceHistory"][-1]["price"] == 5500

    out = _enriched_by_id(enriched, sid)
    # Increase: priceChange is positive, priceDropTotal stays at 0 because
    # current is at peak.
    assert out["priceChange"] == 500
    assert out["priceDropTotal"] == 0
    assert out["pricePeak"] == 5500
    # No price drop yet — priceDropAt should remain unset.
    assert "priceDropAt" not in entry or entry["priceDropAt"] is None


# ── Disappearance + reappearance ────────────────────────────────────────────


def test_listing_disappears_marks_inactive_and_caches_display_fields(at_date):
    at_date("2026-04-01")
    state = {}
    item = make_item(
        title="1968 Rolex Submariner 5513",
        brand="Rolex",
        img="https://example.com/sub.jpg",
        currency="USD",
    )
    merge.update_state([item], state)

    # Day 2: scrape returns an empty list — the listing has dropped out.
    at_date("2026-04-02")
    enriched = merge.update_state([], state)

    sid = item["id"]
    entry = state[sid]
    assert entry["active"] is False, "active must flip to False on disappearance"
    assert entry["soldAt"] == "2026-04-02"
    # Cached display fields were captured on the prior day; they must
    # still be present so the Archive can render the card.
    assert entry["lastTitle"] == "1968 Rolex Submariner 5513"
    assert entry["lastBrand"] == "Rolex"
    assert entry["lastImg"] == "https://example.com/sub.jpg"
    assert entry["lastCurrency"] == "USD"
    assert entry["lastSource"] == "Test Dealer"

    # The disappeared listing should be emitted in the enriched output as
    # a sold/archive row so the Archive tab can render it without a
    # round-trip to the source site.
    out = _enriched_by_id(enriched, sid)
    assert out["sold"] is True
    assert out["soldAt"] == "2026-04-02"
    assert out["ref"] == "1968 Rolex Submariner 5513"
    assert out["img"] == "https://example.com/sub.jpg"


def test_listing_reappearing_after_disappearing_keeps_original_first_seen(at_date):
    at_date("2026-04-01")
    state = {}
    item = make_item(price=5000)
    merge.update_state([item], state)
    sid = item["id"]
    original_first_seen = state[sid]["firstSeen"]

    # Day 2: gone.
    at_date("2026-04-02")
    merge.update_state([], state)
    assert state[sid]["active"] is False

    # Day 3: back.
    at_date("2026-04-03")
    enriched = merge.update_state([item], state)

    entry = state[sid]
    assert entry["active"] is True, "active must flip back on reappearance"
    assert entry["firstSeen"] == original_first_seen, (
        "firstSeen must NOT reset when a listing reappears — the watchlist's "
        "stable-id contract relies on this"
    )
    assert entry["lastSeen"] == "2026-04-03"
    # soldAt should clear once the listing is back and not flagged sold.
    assert "soldAt" not in entry or entry["soldAt"] is None

    out = _enriched_by_id(enriched, sid)
    assert out["firstSeen"] == original_first_seen
    assert out["sold"] is False


# ── Currency mismatch on same URL (documents current behavior) ──────────────


def test_currency_change_on_same_url_treated_as_price_event_when_numeric_differs(at_date):
    """Documenting current behavior:

    The state key is `sha1(normalized_url)[:12]` — currency does not factor
    in. So if a dealer changes the currency for the same URL (e.g. Falco
    flipping a listing from GBP to USD), the entry is treated as the same
    listing, and the *numeric* price values are compared.

    If the numeric price differs across the currency change (4500 GBP →
    5715 USD), the change is appended to priceHistory as a normal price
    event with the new currency tag. There is no detection of "this is
    a currency switch, not a real price change."

    If the numeric price happens to match (e.g. someone re-keyed 5000
    GBP as 5000 USD by accident), nothing is appended — the change is
    invisible.

    These behaviors are documented here so a future fix that *does*
    detect currency changes will surface in this test as a needs-update.
    """
    url = "https://example.com/products/falco-test"
    at_date("2026-04-01")
    state = {}
    merge.update_state([make_item(url=url, price=4500, currency="GBP")], state)

    at_date("2026-04-02")
    enriched = merge.update_state([make_item(url=url, price=5715, currency="USD")], state)

    sid = make_item(url=url)["id"]
    entry = state[sid]
    # Same id used across the currency change.
    assert sid in state
    # priceHistory got a new entry because the numeric value differs.
    assert len(entry["priceHistory"]) == 2
    assert entry["priceHistory"][0] == {"date": "2026-04-01", "price": 4500, "currency": "GBP"}
    assert entry["priceHistory"][1] == {"date": "2026-04-02", "price": 5715, "currency": "USD"}
    assert entry["lastCurrency"] == "USD"
    # The enriched output reports this as a price increase numerically.
    out = _enriched_by_id(enriched, sid)
    assert out["priceChange"] == 1215   # 5715 - 4500


def test_currency_change_with_matching_numeric_price_is_invisible(at_date):
    """Companion to the test above. Documents the silent-failure case
    where a currency switch coincides with the same numeric value."""
    url = "https://example.com/products/falco-silent-currency"
    at_date("2026-04-01")
    state = {}
    merge.update_state([make_item(url=url, price=5000, currency="GBP")], state)

    at_date("2026-04-02")
    merge.update_state([make_item(url=url, price=5000, currency="USD")], state)

    sid = make_item(url=url)["id"]
    entry = state[sid]
    # priceHistory is unchanged because the numeric price didn't move
    # — even though the currency *did*.
    assert len(entry["priceHistory"]) == 1, (
        "current behavior: same numeric price + currency switch leaves "
        "priceHistory untouched. If this changes (and it probably should), "
        "update this test to match."
    )
    # However lastCurrency DOES reflect the new currency, which means
    # downstream consumers see USD on the listing card while priceHistory
    # still shows GBP. This is a known inconsistency.
    assert entry["lastCurrency"] == "USD"
    assert entry["priceHistory"][0]["currency"] == "GBP"


# ── Multi-cycle: present, gone, present, gone, present ─────────────────────


def test_multi_day_cycle_preserves_first_seen_and_history_across_reactivations(at_date):
    """Five consecutive runs covering two disappear/reappear cycles.

    Verifies that:
      - firstSeen never changes from day 1
      - priceHistory only grows when price actually moves, not when
        active toggles
      - active flag tracks the current run's presence
      - soldAt is set on disappearance and cleared on return
    """
    state = {}
    sid = make_item()["id"]

    # Day 1: present at 5000.
    at_date("2026-04-01")
    merge.update_state([make_item(price=5000)], state)
    assert state[sid]["firstSeen"] == "2026-04-01"
    assert state[sid]["active"] is True
    assert len(state[sid]["priceHistory"]) == 1

    # Day 2: gone.
    at_date("2026-04-02")
    merge.update_state([], state)
    assert state[sid]["active"] is False
    assert state[sid]["soldAt"] == "2026-04-02"

    # Day 3: back at the same price (no priceHistory append).
    at_date("2026-04-03")
    merge.update_state([make_item(price=5000)], state)
    assert state[sid]["active"] is True
    assert state[sid]["firstSeen"] == "2026-04-01"
    assert len(state[sid]["priceHistory"]) == 1
    assert "soldAt" not in state[sid] or state[sid]["soldAt"] is None

    # Day 4: gone again.
    at_date("2026-04-04")
    merge.update_state([], state)
    assert state[sid]["active"] is False
    assert state[sid]["soldAt"] == "2026-04-04"

    # Day 5: back at a *different* price — history should grow.
    at_date("2026-04-05")
    enriched = merge.update_state([make_item(price=4750)], state)
    assert state[sid]["active"] is True
    assert state[sid]["firstSeen"] == "2026-04-01", "firstSeen survives multi-cycle"
    assert len(state[sid]["priceHistory"]) == 2
    assert state[sid]["priceHistory"][-1] == {
        "date": "2026-04-05", "price": 4750, "currency": "USD"
    }
    out = _enriched_by_id(enriched, sid)
    assert out["priceDropTotal"] == 250
    assert out["pricePeak"] == 5000


# ── Sanity: a clean two-listing run doesn't cross-pollute ────────────────


def test_two_distinct_listings_do_not_share_state(at_date):
    at_date("2026-04-01")
    state = {}
    a = make_item(url="https://example.com/products/a", title="Watch A")
    b = make_item(url="https://example.com/products/b", title="Watch B")
    merge.update_state([a, b], state)

    assert a["id"] != b["id"], "different URLs must produce different ids"
    assert state[a["id"]]["lastTitle"] == "Watch A"
    assert state[b["id"]]["lastTitle"] == "Watch B"

    at_date("2026-04-02")
    # B disappears; A persists at a new price.
    merge.update_state([make_item(url="https://example.com/products/a",
                                   title="Watch A", price=4500)], state)

    assert state[a["id"]]["active"] is True
    assert state[a["id"]]["priceHistory"][-1]["price"] == 4500
    assert state[b["id"]]["active"] is False
    assert state[b["id"]]["soldAt"] == "2026-04-02"


# ── lastMeaningfulPrice (last non-zero historic ask) ────────────────────────
#
# 2026-05-05: merge.py emits a `lastMeaningfulPrice` field on every
# enriched record so the frontend Card render no longer has to walk
# priceHistory inline. The field carries the last non-zero entry from
# priceHistory (or the current price when history is empty / clean).
# These tests cover the live + archive emission paths plus the empty-
# history edge case.


def test_last_meaningful_price_equals_current_when_history_is_clean(at_date):
    at_date("2026-04-01")
    state = {}
    enriched = merge.update_state([make_item(price=5000)], state)
    out = _enriched_by_id(enriched, _id_for("https://example.com/products/test-watch"))
    assert out["lastMeaningfulPrice"] == 5000


def test_last_meaningful_price_skips_zero_at_history_tail_for_live_item(at_date):
    """Live item that just went POR — current price is 0, but the last
    non-zero entry in history is 4500. Frontend wants to show 'asking
    4500' rather than '0' or 'Price on request' without a number."""
    at_date("2026-04-01")
    state = {}
    merge.update_state([make_item(price=5000)], state)

    at_date("2026-04-02")
    merge.update_state([make_item(price=4500)], state)

    # Day 3: dealer flipped the listing to 'Price on request' — the
    # scrape captures price=0 + priceOnRequest=True.
    at_date("2026-04-03")
    enriched = merge.update_state(
        [make_item(price=0, price_on_request=True)], state,
    )
    out = _enriched_by_id(enriched, _id_for("https://example.com/products/test-watch"))
    assert out["price"] == 0, "current ask is 0 (POR)"
    assert out["lastMeaningfulPrice"] == 4500, (
        "should surface the last non-zero ask, not the trailing 0"
    )


def test_last_meaningful_price_on_archive_emission(at_date):
    """When a listing disappears with a final history entry of 0 (went
    POR before going dark), the archive emission should still carry a
    meaningful price for the Sold-card display. ~40% of sold dealer
    items hit this path in production per the merge.py comment."""
    at_date("2026-04-01")
    state = {}
    merge.update_state([make_item(price=5000)], state)

    at_date("2026-04-02")
    merge.update_state([make_item(price=4500)], state)

    # Day 3: dealer marks POR.
    at_date("2026-04-03")
    merge.update_state([make_item(price=0, price_on_request=True)], state)

    # Day 4: listing disappears entirely.
    at_date("2026-04-04")
    enriched = merge.update_state([], state)

    sid = _id_for("https://example.com/products/test-watch")
    out = _enriched_by_id(enriched, sid)
    assert out["sold"] is True
    assert out["soldAt"] == "2026-04-04"
    # `price` reflects the trailing history entry (0 here) — preserved
    # for analytics. The display field is lastMeaningfulPrice.
    assert out["price"] == 0
    assert out["lastMeaningfulPrice"] == 4500


def test_last_meaningful_price_zero_when_history_is_all_zeros(at_date):
    """Edge case: a listing that's been POR every time we've seen it.
    No non-zero ask was ever recorded. Field falls back to the current
    price (also 0) — frontend then renders '—' or 'Price on request'
    via its existing logic."""
    at_date("2026-04-01")
    state = {}
    enriched = merge.update_state(
        [make_item(price=0, price_on_request=True)], state,
    )
    out = _enriched_by_id(enriched, _id_for("https://example.com/products/test-watch"))
    assert out["lastMeaningfulPrice"] == 0
