"""State-transition tests for merge.update_state.

Covers the core lifecycle a listing goes through across consecutive
scrape runs: first sight, persistence with and without price moves,
disappearance, reappearance, and multi-cycle churn.

Disappearance is debounced (B-15): a listing must be absent from
DISAPPEARANCE_MISS_THRESHOLD consecutive runs before it flips to sold,
so a single transient/empty scrape can't wipe a source. The
currency-mismatch tests still document known, un-fixed behavior.
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

    sid = item["id"]

    # Day 2: scrape returns empty (transient/failed). The debounce holds the
    # listing LIVE — it must NOT flip to sold on the first miss (B-15).
    at_date("2026-04-02")
    enriched = merge.update_state([], state)
    entry = state[sid]
    assert entry["active"] is True, "first miss is held live, not sold (B-15 debounce)"
    assert entry.get("missCount") == 1
    assert "soldAt" not in entry or entry["soldAt"] is None
    held = _enriched_by_id(enriched, sid)
    assert held["sold"] is False, "held listing is re-emitted live from cache"
    assert held["ref"] == "1968 Rolex Submariner 5513"

    # Day 3: still gone — the second consecutive miss crosses the threshold
    # and the listing flips to sold/inactive.
    at_date("2026-04-03")
    enriched = merge.update_state([], state)
    entry = state[sid]
    assert entry["active"] is False, "active flips to False after the threshold"
    assert entry["soldAt"] == "2026-04-03"
    # Cached display fields were captured on day 1; they must still be present
    # so the Archive can render the card.
    assert entry["lastTitle"] == "1968 Rolex Submariner 5513"
    assert entry["lastBrand"] == "Rolex"
    assert entry["lastImg"] == "https://example.com/sub.jpg"
    assert entry["lastCurrency"] == "USD"
    assert entry["lastSource"] == "Test Dealer"

    out = _enriched_by_id(enriched, sid)
    assert out["sold"] is True
    assert out["soldAt"] == "2026-04-03"
    assert out["ref"] == "1968 Rolex Submariner 5513"
    assert out["img"] == "https://example.com/sub.jpg"


def test_listing_reappearing_after_disappearing_keeps_original_first_seen(at_date):
    at_date("2026-04-01")
    state = {}
    item = make_item(price=5000)
    merge.update_state([item], state)
    sid = item["id"]
    original_first_seen = state[sid]["firstSeen"]

    # Day 2-3: gone for two consecutive runs → flips inactive after day 3
    # (B-15 debounce: the first miss is held live).
    at_date("2026-04-02")
    merge.update_state([], state)
    assert state[sid]["active"] is True, "first miss is held live (B-15)"
    at_date("2026-04-03")
    merge.update_state([], state)
    assert state[sid]["active"] is False

    # Day 4: back.
    at_date("2026-04-04")
    enriched = merge.update_state([item], state)

    entry = state[sid]
    assert entry["active"] is True, "active must flip back on reappearance"
    assert entry["firstSeen"] == original_first_seen, (
        "firstSeen must NOT reset when a listing reappears — the watchlist's "
        "stable-id contract relies on this"
    )
    assert entry["lastSeen"] == "2026-04-04"
    # soldAt should clear once the listing is back and not flagged sold.
    assert "soldAt" not in entry or entry["soldAt"] is None
    # missCount is cleared on sight.
    assert "missCount" not in entry or entry["missCount"] == 0

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

    # Days 2-3: gone for two consecutive runs → inactive after day 3 (the
    # first miss is held live by the B-15 debounce).
    at_date("2026-04-02")
    merge.update_state([], state)
    assert state[sid]["active"] is True, "first miss held"
    at_date("2026-04-03")
    merge.update_state([], state)
    assert state[sid]["active"] is False
    assert state[sid]["soldAt"] == "2026-04-03"

    # Day 4: back at the same price (no priceHistory append).
    at_date("2026-04-04")
    merge.update_state([make_item(price=5000)], state)
    assert state[sid]["active"] is True
    assert state[sid]["firstSeen"] == "2026-04-01"
    assert len(state[sid]["priceHistory"]) == 1
    assert "soldAt" not in state[sid] or state[sid]["soldAt"] is None

    # Days 5-6: gone again for two runs.
    at_date("2026-04-05")
    merge.update_state([], state)
    at_date("2026-04-06")
    merge.update_state([], state)
    assert state[sid]["active"] is False
    assert state[sid]["soldAt"] == "2026-04-06"

    # Day 7: back at a *different* price — history should grow.
    at_date("2026-04-07")
    enriched = merge.update_state([make_item(price=4750)], state)
    assert state[sid]["active"] is True
    assert state[sid]["firstSeen"] == "2026-04-01", "firstSeen survives multi-cycle"
    assert len(state[sid]["priceHistory"]) == 2
    assert state[sid]["priceHistory"][-1] == {
        "date": "2026-04-07", "price": 4750, "currency": "USD"
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
    # B disappears; A persists at a new price. First miss → B held live (B-15).
    merge.update_state([make_item(url="https://example.com/products/a",
                                   title="Watch A", price=4500)], state)
    assert state[a["id"]]["active"] is True
    assert state[b["id"]]["active"] is True, "B held on first miss (B-15)"

    at_date("2026-04-03")
    # B still gone on the second consecutive run → now flips to sold.
    merge.update_state([make_item(url="https://example.com/products/a",
                                   title="Watch A", price=4500)], state)
    assert state[a["id"]]["active"] is True
    assert state[a["id"]]["priceHistory"][-1]["price"] == 4500
    assert state[b["id"]]["active"] is False
    assert state[b["id"]]["soldAt"] == "2026-04-03"


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

    # Days 4-5: listing disappears entirely — two consecutive misses cross the
    # B-15 debounce threshold before it's archived.
    at_date("2026-04-04")
    merge.update_state([], state)
    at_date("2026-04-05")
    enriched = merge.update_state([], state)

    sid = _id_for("https://example.com/products/test-watch")
    out = _enriched_by_id(enriched, sid)
    assert out["sold"] is True
    assert out["soldAt"] == "2026-04-05"
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


# ── Live/sold split ───────────────────────────────────────────────────────────


def test_split_live_sold_partitions_by_sold_flag():
    """The frontend fetches listings_live.json eager + listings_sold.json
    lazy. split_live_sold must partition cleanly so the two halves
    concatenated reproduce listings.json exactly (no item dropped or
    duplicated, order within each half preserved)."""
    enriched = [
        {"id": "a", "sold": False},
        {"id": "b", "sold": True},
        {"id": "c", "sold": False},
        {"id": "d", "sold": True},
        {"id": "e"},  # missing flag → treated as live (falsy)
    ]
    live, sold = merge.split_live_sold(enriched)
    assert [i["id"] for i in live] == ["a", "c", "e"]
    assert [i["id"] for i in sold] == ["b", "d"]
    # Disjoint + complete: union of ids equals the input set.
    assert {i["id"] for i in live} | {i["id"] for i in sold} == {
        i["id"] for i in enriched
    }
    assert len(live) + len(sold) == len(enriched)


# ── B-15 disappearance debounce ─────────────────────────────────────────────
# A listing must be ABSENT from DISAPPEARANCE_MISS_THRESHOLD consecutive runs
# before it flips to sold, so a single transient/empty scrape can't silently
# mark a whole source SOLD. See docs/audits/2026-05-24-vibe-code (finding C1).


def test_single_empty_scrape_does_not_mark_sold(at_date):
    """B-15 regression. A single empty/failed scrape must NOT mark a source's
    listings sold. One transient 503 / empty-but-200 catalog used to flip an
    entire source to SOLD permanently (the lone Critical audit finding)."""
    at_date("2026-04-01")
    state = {}
    items = [
        make_item(url="https://example.com/products/x1", title="Watch X1"),
        make_item(url="https://example.com/products/x2", title="Watch X2"),
    ]
    merge.update_state(items, state)

    # Day 2: scrape comes back empty (failed/transient).
    at_date("2026-04-02")
    enriched = merge.update_state([], state)

    for it in items:
        entry = state[it["id"]]
        assert entry["active"] is True, "empty scrape must not flip active → sold"
        assert entry.get("missCount") == 1
    # Nothing is marked sold, and the held listings are re-emitted live.
    assert all(not e.get("sold") for e in enriched), "no sold rows on a single empty run"
    live_ids = {e["id"] for e in enriched}
    assert {it["id"] for it in items} <= live_ids, "held listings stay in the live feed"


def test_two_consecutive_empty_scrapes_marks_sold(at_date):
    """After DISAPPEARANCE_MISS_THRESHOLD consecutive misses, a genuinely
    gone listing does flip to sold — the debounce delays, it doesn't disable."""
    at_date("2026-04-01")
    state = {}
    item = make_item()
    merge.update_state([item], state)

    at_date("2026-04-02")
    merge.update_state([], state)              # miss 1 → held live
    assert state[item["id"]]["active"] is True

    at_date("2026-04-03")
    enriched = merge.update_state([], state)   # miss 2 → sold
    assert state[item["id"]]["active"] is False
    assert state[item["id"]]["soldAt"] == "2026-04-03"
    out = _enriched_by_id(enriched, item["id"])
    assert out["sold"] is True


def test_intermittent_scrape_never_marks_sold(at_date):
    """A source that flaps (empty every other run) must never flip its
    listings to sold — a seen run resets the debounce counter. This is the
    Watch Club-style oscillation the guard is built for."""
    at_date("2026-04-01")
    state = {}
    item = make_item()
    merge.update_state([item], state)

    for day, present in [
        ("2026-04-02", False),  # miss 1 → held
        ("2026-04-03", True),   # seen → reset
        ("2026-04-04", False),  # miss 1 → held
        ("2026-04-05", True),   # seen → reset
        ("2026-04-06", False),  # miss 1 → held
    ]:
        at_date(day)
        merge.update_state([item] if present else [], state)
        assert state[item["id"]]["active"] is True, f"{day}: must stay live through a flap"
    assert "soldAt" not in state[item["id"]] or state[item["id"]]["soldAt"] is None


# ── Catalog-level exclusion (non-watch sales dropped from the calendar) ──────

def test_is_excluded_catalog_blocks_nonwatch_sales():
    """Blocklisted non-watch catalogs are excluded; real watch sales pass.
    The short Sotheby's title must also catch the long '…Including Jewels…'
    variant of the same sale (substring, case-insensitive)."""
    assert merge.is_excluded_catalog("Noble & Private Collections") is True
    assert merge.is_excluded_catalog(
        "Noble & Private Collections Including Jewels from the Collection "
        "of Stanley J. Seeger & Christopher Cone") is True
    assert merge.is_excluded_catalog("Espionage: Fact & Fiction") is True
    # Case-insensitivity.
    assert merge.is_excluded_catalog("espionage: FACT & fiction") is True
    # Sotheby's non-watch sales Mark flagged 2026-06-13 (B-71): a Fabergé /
    # gold-boxes sale and the Tempelsman objets collection, both cross-listed
    # in the watches category with a handful of watch lots.
    assert merge.is_excluded_catalog(
        "Artistic Luxury: Fabergé, Gold Boxes, Silver & Ceramics") is True
    assert merge.is_excluded_catalog(
        "A Marvelous Journey: The Collection of Maurice Tempelsman") is True
    # Real watch sales are untouched.
    assert merge.is_excluded_catalog("Important Watches") is False
    assert merge.is_excluded_catalog("The Geneva Watch Auction: XX") is False
    # Empty / missing title is not excluded.
    assert merge.is_excluded_catalog("") is False
    assert merge.is_excluded_catalog(None) is False


# ── Brand-detection / reference cross-pollination (B-26) ─────────────────────

def test_richard_mille_detects_and_resists_enicar_002_cross_match():
    """B-26: a Wind Vintage "Richard Mille RM 002-V2" listing used to land
    in Other (brand undetected), so the reference matcher matched the bare
    "002" token against Enicar Sherpa Graph ref 002 and planted brand=Enicar
    + that model_line on a Richard Mille. With Richard Mille on the BRANDS
    list, detect_brand trips the cross-pollination guard and the bogus hit
    is rejected."""
    title = ("Richard Mille RM 002-V2 Tourbillon in 18K Rose Gold "
             "w/ Certificate of Authenticity & Box")
    # The brand is now detectable from the title.
    assert merge.detect_brand(title) == "Richard Mille"
    # And enrichment must not overwrite it with Enicar's Sherpa Graph.
    item = {
        "brand": merge.detect_brand(title), "ref": title,
        "reference_no": "", "reference_id": "",
        "model": "", "model_line": "", "sub_model": "",
    }
    merge.enrich_with_reference_match(item)
    assert item["brand"] == "Richard Mille"
    assert not item.get("model_line"), (
        f"Enicar model_line leaked onto a Richard Mille: {item.get('model_line')!r}"
    )


# ── Auction calendar status (B-78) ───────────────────────────────────────────

def test_emit_auction_status_demotes_stale_upcoming_to_past():
    """B-78: Bonhams recycles weekly-sale ids, so a long-closed "Weekly
    Watches" keeps statusHint='upcoming' frozen in the registry. Once its end
    date is in the past, the calendar must emit 'past', not 'upcoming'."""
    assert merge.emit_auction_status("2026-04-28", "2026-05-05", "upcoming",
                                     today="2026-06-18") == "past"


def test_emit_auction_status_demotes_stale_live_to_past():
    assert merge.emit_auction_status("2026-05-01", "2026-05-06", "live",
                                     today="2026-06-18") == "past"


def test_emit_auction_status_keeps_genuine_upcoming():
    """A future sale with an 'upcoming' hint stays upcoming."""
    assert merge.emit_auction_status("2026-06-26", "2026-07-08", "upcoming",
                                     today="2026-06-18") == "upcoming"


def test_emit_auction_status_keeps_live_during_window():
    """Sale open today (start ≤ today ≤ end) with a 'live' hint stays live."""
    assert merge.emit_auction_status("2026-06-15", "2026-06-30", "live",
                                     today="2026-06-18") == "live"


def test_emit_auction_status_derives_from_dates_without_hint():
    assert merge.emit_auction_status("2026-07-01", "2026-07-08", "",
                                     today="2026-06-18") == "upcoming"
    assert merge.emit_auction_status("2026-05-01", "2026-05-05", "",
                                     today="2026-06-18") == "past"


# ── Rescheduled auctions (superseded registry entries) ─────────────────────


def _sale(start, first, last, location="New York", catalog=None, title="Important Modern & Vintage Timepieces"):
    return {"house": "Antiquorum", "title": title, "location": location,
            "dateStart": start, "firstSeen": first, "lastSeen": last,
            "catalogLiveAt": catalog}


def test_rescheduled_sale_is_superseded_by_its_new_date():
    state = {
        "jul": _sale("2026-07-18", "2026-04-24", "2026-06-09"),
        "sep": _sale("2026-09-15", "2026-06-10", "2026-08-16"),
        "oct": _sale("2026-10-18", "2026-08-17", "2026-09-18"),
    }
    assert merge.superseded_auction_ids(state) == {"jul", "sep"}


def test_sale_that_ran_is_kept_after_dropping_off_calendar():
    # Last seen after its own start date: it happened, the Archive keeps it.
    state = {
        "may": _sale("2026-05-31", "2026-04-24", "2026-07-01", location="Hong Kong"),
        "nov": _sale("2026-11-28", "2026-09-14", "2026-09-18", location="Hong Kong"),
    }
    assert merge.superseded_auction_ids(state) == set()


def test_sale_with_a_catalog_is_never_hidden():
    state = {
        "old": _sale("2026-11-29", "2026-04-24", "2026-09-13", location="Hong Kong", catalog="2026-09-01"),
        "new": _sale("2026-11-28", "2026-09-14", "2026-09-18", location="Hong Kong"),
    }
    assert merge.superseded_auction_ids(state) == set()


def test_different_city_or_title_does_not_supersede():
    state = {
        "ny":  _sale("2026-09-15", "2026-06-10", "2026-08-16"),
        "gva": _sale("2026-10-18", "2026-08-17", "2026-09-18", location="Geneva"),
        "online": _sale("2026-10-20", "2026-08-17", "2026-09-18", title="Only Online Auction"),
    }
    assert merge.superseded_auction_ids(state) == set()
