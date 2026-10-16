"""Parser tests for the Antiquorum calendar scraper.

The fixture is the calendar text as of 2026-09-18, when the first timed
"Only Online Auction" (Hong Kong, month-only date) was silently dropped and
made the next sale's location read "Auction New York". Network is never
touched: catalog and sale-end lookups are injected.
"""
import antiquorum_auctions_scraper as aq

PAGE = (
    "Auction Calendar 2026 Hong Kong September 2026 Only Online Auction "
    "New York October 18th, 2026 Important Modern & Vintage Timepieces "
    "Geneva November 7th -8th, 2026 Important Modern & Vintage Timepieces "
    "Hong Kong November 28th, 2026 Important Modern & Vintage Timepieces "
    "Antiquorum Genève SA"
)

LIVE = [{
    "detail_url": "https://live.antiquorum.swiss/auctions/1-DBHZ27/only-online-auction-hong-kong",
    "title": "Only Online Auction - Hong Kong",
    "time_start": "2026-09-14T11:00:00Z",
}]


def _rows(calendar, live):
    return aq.build_rows(calendar, live,
                         catalog_for=lambda loc, label: None,
                         sale_end_for=lambda url: "2026-09-28")


def test_parses_online_sale_and_clean_locations():
    assert aq.parse_calendar_text(PAGE) == [
        ("Hong Kong", "September 2026", "Only Online Auction"),
        ("New York", "October 18th, 2026", "Important Modern & Vintage Timepieces"),
        ("Geneva", "November 7th -8th, 2026", "Important Modern & Vintage Timepieces"),
        ("Hong Kong", "November 28th, 2026", "Important Modern & Vintage Timepieces"),
    ]


def test_month_only_sale_takes_dates_from_live_host():
    rows = _rows(aq.parse_calendar_text(PAGE), LIVE)
    online = rows[0]
    assert online["title"] == "Only Online Auction"
    assert (online["date_start"], online["date_end"]) == ("2026-09-14", "2026-09-28")
    assert online["date_label"] == "September 14th - 28th, 2026"
    assert online["url"] == LIVE[0]["detail_url"]
    assert online["has_catalog"] == "True"
    assert len(rows) == 4  # live entry claimed once, not re-added


def test_month_only_sale_without_live_entry_is_skipped():
    rows = _rows(aq.parse_calendar_text(PAGE), [])
    assert [r["location"] for r in rows] == ["New York", "Geneva", "Hong Kong"]


def test_live_only_sale_is_added_when_calendar_lags():
    rows = _rows([], LIVE)
    assert len(rows) == 1
    assert (rows[0]["title"], rows[0]["location"]) == ("Only Online Auction", "Hong Kong")


def test_split_live_title_old_shape():
    assert aq.split_live_title(
        "Important Modern & Vintage Timepieces - Antiquorum Monaco"
    ) == ("Important Modern & Vintage Timepieces", "Monaco")
