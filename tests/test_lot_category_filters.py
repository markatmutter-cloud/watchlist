"""Per-lot category filters in auction_lots_scraper.

Mixed "Jewellery & Watches" sales reach us whole as of 2026-10-05, so the
non-watch lots have to be dropped one at a time. These pin the two carve-outs
that the 6,074-lot corpus we already hold forced:

  - "ring" is a dial/bezel feature at least as often as it is jewellery
    ("gilt chapter ring dial", "ring-lock system"),
  - "pendant" is usually a pendant WATCH in these catalogues, often titled
    without the word "watch" at all,

and the overriding rule that any watch word in the title keeps the lot.
"""
import auction_lots_scraper as a


# --- jewellery lots that must be dropped ----------------------------------

def test_drops_plain_jewellery():
    for title in (
        "Diamond Necklace",
        "Hemmerle Sapphire Ring",
        "Hemmerle Pair of Moonstone and Wood Earrings",
        "Van Cleef & Arpels Emerald and Diamond Necklace",
        "A rare yellow gold and diamond-set Rolex necklace, Circa 1980",
        "AUDEMARS PIGUET, ROYAL OAK PLAGE RING",
    ):
        assert a.is_jewellery_lot_title(title) is True, title
        assert a.is_excluded_title(title) is True, title


# --- watch lots that must survive -----------------------------------------

def test_keeps_watches_whose_titles_carry_jewellery_words():
    for title in (
        "BLANCPAIN, SWITZERLAND, CITRINE RING WATCH, 18K YELLOW GOLD",
        "J. LAFORGE, ART NOUVEAU PENDANT WATCH & BROOCH, GOLD AND ENAMEL",
        "Patek Philippe A lady's gold and diamond-set bracelet watch",
    ):
        assert a.is_jewellery_lot_title(title) is False, title
        assert a.is_excluded_title(title) is False, title


def test_ring_as_a_dial_or_bezel_feature_is_not_jewellery():
    for title in (
        "ROLEX, REF. 1675, GMT-MASTER, GILT CHAPTER RING DIAL, STAINLESS STEEL",
        "Rolex Sea-Dweller Deepsea with Ring Lock System",
        "A steel diver's wristwatch with inner bezel ring",
    ):
        assert a.is_jewellery_lot_title(title) is False, title


def test_pendant_alone_is_not_treated_as_jewellery():
    # Pendant watches are routinely titled without "watch"; dropping them
    # would lose real lots, so "pendant" is deliberately not a jewel word.
    assert a.is_jewellery_lot_title(
        "ATTRIBUTED TO ANTOINE MOILLIET & CIE, THE SHIELD PENDANT, GOLD AND ENAMEL"
    ) is False


def test_existing_pocket_and_clock_filters_still_apply():
    assert a.is_excluded_title("An 18k gold openface pocket watch") is True
    assert a.is_excluded_title("A mahogany bracket clock") is True
    assert a.is_excluded_title("Daytona with date aperture at 6 o'clock") is False


def test_mixed_sale_is_carried_but_a_jewels_sale_is_not():
    assert a.is_excluded_catalog(
        "Fine Jewelry & Watches",
        "https://www.sothebys.com/en/buy/auction/2026/fine-jewelry-watches") is False
    assert a.is_excluded_catalog("Magnificent Jewels", "") is True
    assert a.is_excluded_catalog(
        "Fine Watches",
        "https://www.sothebys.com/en/buy/auction/2026/fine-jewelry-l26050") is True
