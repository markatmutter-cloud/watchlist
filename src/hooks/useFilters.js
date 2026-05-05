import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { GLOBAL_MAX } from "../utils";

// All filter-row state for the listings + watchlist feeds. Owns:
//   - search query, source/brand/ref multi-select arrays
//   - sort order, status mode (live/sold/all), auctions-only toggle
//   - min/max price as raw text + parsed-to-int derivations
//   - newDays bucket selector
//   - chip-cluster expansion toggles (more/less)
//   - the filter-row's "which popover is open" state + ref
//
// Returns ~25 named fields. Coupled enough that splitting it further
// would just add prop-drilling without any clarity win — the test for
// "is this state filter-shaped?" is "would resetFilters touch it?".
//
// Derived helpers (toggleSource, toggleBrand, resetFilters, hasFilters,
// minPrice/maxPrice ints) are computed inside the hook so consumers
// don't reinvent them. The actual filtered lists live outside — they
// need access to items/auctions/watchlist which are App-level.
//
// Extracted from App.js 2026-04-30 (#6 hooks phase 3).
export function useFilters() {
  // Multi-select filter arrays.
  const [filterSources, setFilterSources] = useState([]);
  const [filterBrands,  setFilterBrands]  = useState([]);
  const [filterRefs,    setFilterRefs]    = useState([]);
  // Auctions-only is a single toggle, not a multi-select. Used only by
  // the Watchlist tab now; the Listings tab uses sub-tabs.
  const [filterAuctionsOnly, setFilterAuctionsOnly] = useState(false);

  // Sort axis + direction (date / date-asc / price-asc / price-desc).
  const [sort, setSort] = useState("date");

  // Free-text search across title + brand + ref.
  const [search, setSearch] = useState("");

  // Price filter: stored as raw text so users can type "1500" without
  // the input rejecting partial input. Parsed to int via the derived
  // minPrice/maxPrice values below.
  const [minPriceText, setMinPriceText] = useState("");
  const [maxPriceText, setMaxPriceText] = useState("");

  // Recency bucket — 0 = no filter, otherwise N days from today.
  const [newDays, setNewDays] = useState(0);

  // Tri-state status: 'live' / 'sold' / 'all'.
  const [statusMode, setStatusMode] = useState("live");

  // Chip-cluster "+N more" expansion toggles.
  const [brandsExpanded,  setBrandsExpanded]  = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [refsExpanded,    setRefsExpanded]    = useState(false);

  // Desktop filter row popover state. Single key; only one popover
  // open at a time. ref is attached inside whichever popover is open
  // so the click-outside effect can close it on outside clicks.
  const [activeFilterPop, setActiveFilterPop] = useState(null);
  const filterPopRef = useRef(null);

  useEffect(() => {
    if (!activeFilterPop) return;
    const onDown = (e) => {
      if (filterPopRef.current && !filterPopRef.current.contains(e.target)) {
        setActiveFilterPop(null);
      }
    };
    // Defer the listener attachment by one tick so the click that
    // OPENED the popover doesn't immediately close it (it would
    // otherwise fire mousedown on this listener since the document
    // mousedown bubbles up from the trigger button).
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
    };
  }, [activeFilterPop]);

  // Multi-select toggle helpers.
  const toggleSource = useCallback(
    (s) => setFilterSources(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]),
    []
  );
  const toggleBrand = useCallback(
    (b) => setFilterBrands(p => p.includes(b) ? p.filter(x => x !== b) : [...p, b]),
    []
  );

  // Parsed-to-int price bounds. minPrice defaults to 0 when empty;
  // maxPrice defaults to GLOBAL_MAX so the filter is a no-op until
  // the user types something. Strip non-digits so "$1,500" parses.
  const minPrice = useMemo(() => {
    if (!minPriceText) return 0;
    return parseInt(minPriceText.replace(/[^0-9]/g, "")) || 0;
  }, [minPriceText]);
  const maxPrice = useMemo(() => {
    if (!maxPriceText) return GLOBAL_MAX;
    return parseInt(maxPriceText.replace(/[^0-9]/g, "")) || GLOBAL_MAX;
  }, [maxPriceText]);

  // True iff anything user-facing is active. Drives the "Reset" button
  // visibility + the active-state styling on the filter icon.
  const hasFilters = (
    filterSources.length > 0 ||
    filterBrands.length > 0 ||
    filterRefs.length > 0 ||
    !!search ||
    newDays > 0 ||
    !!minPriceText ||
    !!maxPriceText
  );

  // One-shot "clear all filters" — does NOT touch sort, status, or
  // expansion toggles (those are display preferences, not filters).
  const resetFilters = useCallback(() => {
    setFilterSources([]);
    setFilterBrands([]);
    setFilterRefs([]);
    setSearch("");
    setNewDays(0);
    setMinPriceText("");
    setMaxPriceText("");
  }, []);

  return {
    // Multi-selects
    filterSources, setFilterSources,
    filterBrands,  setFilterBrands,
    filterRefs,    setFilterRefs,
    filterAuctionsOnly, setFilterAuctionsOnly,
    toggleSource, toggleBrand,
    // Sort + search
    sort, setSort,
    search, setSearch,
    // Price
    minPriceText, setMinPriceText,
    maxPriceText, setMaxPriceText,
    minPrice, maxPrice,
    // Recency + status
    newDays, setNewDays,
    statusMode, setStatusMode,
    // Expansion toggles
    brandsExpanded,  setBrandsExpanded,
    sourcesExpanded, setSourcesExpanded,
    refsExpanded,    setRefsExpanded,
    // Popover
    activeFilterPop, setActiveFilterPop,
    filterPopRef,
    // Derived
    hasFilters, resetFilters,
  };
}
