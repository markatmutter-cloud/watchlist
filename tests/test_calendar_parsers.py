"""Parser tests for the two calendar scrapers that silently rotted.

Monaco Legend and Phillips both went six weeks emitting zero sales after
their sites were rebuilt, and neither had a single test. These pin the
pure parsing functions against the real markup shapes, so the next
redesign fails here instead of in production.

Network is never touched — the fixtures below are trimmed from the live
pages as of 2026-08-17.
"""
import marteauandco_auctions_scraper as ma
import monacolegend_auctions_scraper as ml
import phillips_auctions_scraper as ph


# --- Phillips date labels --------------------------------------------------
# Phillips renders dates as display text in two distinct shapes. The
# day-range shape is the one that bit: "7 – 8 November 2026" has no month
# attached to the leading day, so a naive day+month scan sees only
# "8 November" and collapses a two-day sale to one day.

def test_day_range_sharing_one_month():
    assert ph.parse_date_label("7 – 8 November 2026") == ("2026-11-07", "2026-11-08")


def test_day_range_with_ascii_hyphen():
    assert ph.parse_date_label("5 - 6 December 2026") == ("2026-12-05", "2026-12-06")


def test_online_session_with_times_and_timezone():
    assert ph.parse_date_label(
        "4 September 12pm - 11 September 2pm CEST 2026"
    ) == ("2026-09-04", "2026-09-11")


def test_online_session_crossing_months():
    assert ph.parse_date_label(
        "1 October 12pm - 9 October 12pm ET 2026"
    ) == ("2026-10-01", "2026-10-09")


def test_single_day():
    assert ph.parse_date_label("25 July 2026") == ("2026-07-25", "2026-07-25")


def test_unparseable_labels_return_empty():
    for bad in ("", "Coming soon", "November", "32 November 2026"):
        assert ph.parse_date_label(bad) == ("", ""), bad


# --- Phillips card fields --------------------------------------------------
# The optional CTA between title and location is why location is read as
# the field BEFORE the date rather than by fixed position.

CARD_WITH_CTA = (
    '<a href="/auction/HK080426/overview"></a>'
    "<span>Live Auction</span><h3>The Hong Kong Watch Auction: XXIII</h3>"
    "<span>Accepting Consignments</span><span>Hong Kong</span>"
    "<span>21 &#8211; 22 November 2026</span>"
)
CARD_WITHOUT_CTA = (
    '<a href="/auction/CH080426/overview"></a>'
    "<span>Live Auction</span><h3>The Geneva Watch Auction: XXIV</h3>"
    "<span>Geneva</span><span>7 &#8211; 8 November 2026</span>"
)


def test_card_fields_unescape_entities():
    fields = ph._card_fields(CARD_WITH_CTA)
    assert "21 – 22 November 2026" in fields


def test_card_fields_preserve_document_order():
    fields = ph._card_fields(CARD_WITHOUT_CTA)
    assert fields.index("Geneva") < fields.index("7 – 8 November 2026")
    assert fields[1] == "The Geneva Watch Auction: XXIV"


# --- Monaco Legend date cell ----------------------------------------------
# Monaco Legend's date cell is entity-and-whitespace soup: &#8211; en-dash,
# &#8288; word-joiner, \xa0 non-breaking space. All three appear in one
# real cell: "25 &#8211;&#8288;\xa026\xa0April 2026 | Monaco".

def _clean(raw):
    """Mirror the normalisation scrape() applies before parsing."""
    t = raw.replace("&#8211;", "-").replace("&#8212;", "-")
    t = t.replace("&#8288;", " ").replace("&nbsp;", " ")
    t = t.replace("–", "-").replace("—", "-")
    t = t.replace("\xa0", " ").replace("&amp;", "&")
    import re
    return re.sub(r"\s+", " ", t).strip()


def test_monaco_single_day_with_nbsp():
    label = _clean("25\xa0July 2026").split("|")[0].strip()
    assert ml.parse_date_range(label) == ("2026-07-25", "2026-07-25")


def test_monaco_day_range_with_entity_soup():
    label = _clean("25 &#8211;&#8288;\xa026\xa0April 2026").strip()
    assert ml.parse_date_range(label) == ("2026-04-25", "2026-04-26")


def test_monaco_splits_date_from_location():
    text = _clean("4\xa0June 2026 | Lugano")
    date_label, location = [p.strip() for p in text.split("|", 1)]
    assert location == "Lugano"
    assert ml.parse_date_range(date_label) == ("2026-06-04", "2026-06-04")


def test_monaco_unparseable_returns_none():
    assert ml.parse_date_range("Our next auction is being curated") == (None, None)


# --- regression guards -----------------------------------------------------

def test_phillips_targets_the_department_page_not_the_calendar():
    """/calendar/upcoming looks right but renders its list client-side and
    server-returns zero sale links. Anyone 'fixing' the URL to it would
    silently reintroduce the six-week outage."""
    assert ph.URL.endswith("/watches")


def test_monaco_no_longer_depends_on_the_homepage_bidding_section():
    """The 'Bidding Open' homepage anchor is what broke; the /auction
    index is the real calendar."""
    import inspect
    src = inspect.getsource(ml.scrape)
    assert "Bidding Open" not in src
    assert "/auction" in src


# --- Monaco Legend: structured data preferred over rendered markup --------
# JSON-LD is emitted for search engines and survives visual redesigns —
# the exact class of change that killed this scraper for six weeks. The
# card parser stays as a fallback, so BOTH paths need pinning.

import json

LD_PAGE = """
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[{"@type":"EventSeries",
"subEvent":[
 {"@type":"SaleEvent","name":"Exclusive Timepieces &amp; Jewels",
  "url":"https://www.monacolegendauctions.com/auction/exclusive-timepieces-41",
  "startDate":"2026-06-04T10:30:00+02:00","endDate":"2026-06-04T16:00:00+02:00",
  "location":[{"@type":"VirtualLocation","url":"x"},
              {"@type":"Place","address":{"addressLocality":"Lugano"}}]},
 {"@type":"SaleEvent","name":"No Place Sale",
  "url":"https://www.monacolegendauctions.com/auction/no-place-99",
  "startDate":"2026-04-25T14:30:00+02:00","endDate":"2026-04-26T16:00:00+02:00",
  "location":[{"@type":"VirtualLocation","url":"x"}]}
]}]}
</script>
<article data-auction-id="99"><h2 class='auction-name'>
<a href='/auction/no-place-99'>No Place Sale</a></h2>
<p class='auction-date'>25 &#8211;&#8288;&#160;26&#160;April 2026 | Monaco</p></article>
"""


def test_sale_events_extracted_from_eventseries():
    subs = ml._sale_events(LD_PAGE)
    assert len(subs) == 2
    assert subs[0]["name"] == "Exclusive Timepieces &amp; Jewels"


def test_event_city_reads_the_place_not_the_virtual_location():
    subs = ml._sale_events(LD_PAGE)
    assert ml._event_city(subs[0]) == "Lugano"


def test_event_city_empty_when_no_place_so_caller_can_fall_back():
    """One real sale omits Place entirely; the card text supplies it."""
    subs = ml._sale_events(LD_PAGE)
    assert ml._event_city(subs[1]) == ""


def test_malformed_ld_block_does_not_crash():
    assert ml._sale_events(
        '<script type="application/ld+json">{not json</script>') == []


def test_no_ld_block_returns_nothing_so_fallback_engages():
    assert ml._sale_events("<html><body>no structured data</body></html>") == []


def test_non_eventseries_ld_is_ignored():
    page = ('<script type="application/ld+json">'
            '{"@context":"https://schema.org","@type":"LocalBusiness",'
            '"name":"Antiquorum"}</script>')
    assert ml._sale_events(page) == []


# --- Marteau & Co calendar cards -------------------------------------------
# Marteau runs on Bootstrap and the card markup churns. In 2026-10 three
# things moved at once (card class gained `position-relative`, the title
# moved inside a `stretched-link` anchor, the CTA went from `btn btn-link`
# to `btn btn-outline-secondary`) and the calendar emitted nothing for five
# weeks. Both shapes are pinned here.

_MARTEAU_CARD_2026_10 = (
    '<section class="hover-list">\n'
    '<div class="auction-card position-relative">\n'
    '  <div class="auction-card-image">\n'
    '    <img src="https://t4p7b9.tandemauctions.com/sales/oct-2026/6af44eac.webp">\n'
    '  </div>\n'
    '  <div class="auction-card-detail">\n'
    '    <div class="auction-card-body">\n'
    '      <h2 class="card-title"><a class="stretched-link text-reset text-decoration-none"'
    ' href="/Oct-2026">The Encore</a></h2>\n'
    '        <h3 class="card-subtitle"><span>8 -</span> <span>15 October 2026</span></h3>\n'
    '    </div>\n'
    '    <div class="position-relative z-1">\n'
    '        <a class="btn btn-outline-secondary" href="/Oct-2026">View Auction</a>\n'
    '    </div>\n'
    '  </div>\n'
    '</div></section>'
)

_MARTEAU_CARD_LEGACY = (
    '<div class="auction-card">\n'
    '  <h2 class="card-title">Marteau : The Heat Wave</h2>\n'
    '  <h3 class="card-subtitle"><span>10 -</span> <span>17 June 2026</span></h3>\n'
    '  <a class="btn btn-link" href="/Jun-2026">View Auction</a>\n'
    '  <img src="https://t4p7b9.tandemauctions.com/sales/jun-2026/abc.webp">\n'
    '</div></section>'
)


def _marteau_cards(html):
    return [ma.parse_card(m.group("body")) for m in ma.CARD_RE.finditer(html)]


def test_marteau_current_card_shape():
    cards = _marteau_cards(_MARTEAU_CARD_2026_10)
    assert len(cards) == 1, "the inner auction-card-* wrappers must not split the card"
    c = cards[0]
    assert c["title"] == "The Encore"
    assert c["slug"] == "Oct-2026"
    assert (c["date_start"], c["date_end"]) == ("2026-10-08", "2026-10-15")
    assert c["image"].endswith("6af44eac.webp")


def test_marteau_legacy_card_shape_still_parses():
    c = _marteau_cards(_MARTEAU_CARD_LEGACY)[0]
    assert c["title"] == "Marteau : The Heat Wave"
    assert c["slug"] == "Jun-2026"
    assert (c["date_start"], c["date_end"]) == ("2026-06-10", "2026-06-17")
