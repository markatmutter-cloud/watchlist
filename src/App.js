import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAuth, useWatchlist, useHidden, useSearches, useTrackedLots, useCollections, importLocalData, isAuthConfigured } from "./supabase";
import {
  GLOBAL_MAX, CURRENCY_SYM,
  fmt, fmtUSD, daysAgo, freshDate, imgSrc, logToPrice, extractRef,
  ageBucketFromDate, canonicalizeBrand, detectBrandFromTitle, shortHash,
  matchesSearch,
} from "./utils";
import { useWidth, useSystemDark } from "./hooks";
import { useTrackModal } from "./hooks/useTrackModal";
import { useFavSearchModal } from "./hooks/useFavSearchModal";
import { useViewSettings } from "./hooks/useViewSettings";
import { useFilters } from "./hooks/useFilters";
import { FilterIcon, SearchIcon, TabIcon } from "./components/icons";
import { Card } from "./components/Card";
import { Chip, SidebarChip } from "./components/Chip";
// AuctionsTab retired 2026-04-30 — Tracked lots merged into Watchlist
// Listings; calendar moved to Watchlist > Auction Calendar sub-tab via
// the new AuctionCalendar component (AuctionsTab.js deleted 2026-04-30).
import { ReferencesTab } from "./components/ReferencesTab";
import { AboutModal } from "./components/AboutModal";
import { HiddenModal } from "./components/HiddenModal";
import { TrackNewItemModal } from "./components/TrackNewItemModal";
import { FavSearchModal } from "./components/FavSearchModal";
import { AddSearchModal } from "./components/AddSearchModal";
import { CollectionEditModal } from "./components/CollectionEditModal";
import { CollectionPickerModal } from "./components/CollectionPickerModal";
import { WatchlistTab } from "./components/WatchlistTab";
import { MobileShell } from "./components/MobileShell";
import { DesktopShell } from "./components/DesktopShell";
import { tabPill } from "./styles";

const LISTINGS_URL = "https://raw.githubusercontent.com/markatmutter-cloud/watchlist/main/public/listings.json";
const AUCTIONS_URL = "https://raw.githubusercontent.com/markatmutter-cloud/watchlist/main/public/auctions.json";
const TRACKED_LOTS_URL = "https://raw.githubusercontent.com/markatmutter-cloud/watchlist/main/public/tracked_lots.json";
const PAGE_SIZE = 48;
// Legacy localStorage keys — kept only for the one-shot import on first
// sign-in (see importLocalData + the banner in the Watchlist tab). Active
// reads/writes now go through Supabase via the hooks in ./supabase.js.
const LEGACY_WATCHLIST_KEY = "dial_watchlist_v2";
const LEGACY_HIDDEN_KEY    = "dial_hidden_v1";
const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 520;
const SIDEBAR_DEFAULT_FRACTION = 0.25;   // start at 25% of window width
function initialSidebarWidth() {
  if (typeof window === "undefined") return 280;
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(window.innerWidth * SIDEBAR_DEFAULT_FRACTION)));
}


export default function Watchlist() {
  const screenWidth = useWidth();
  const sysDark = useSystemDark();
  const isMobile = screenWidth < 640;
  // Per-device display chrome (theme override, column counts, view-menu
  // open flag). Lives in useViewSettings so localStorage persistence +
  // option validation stay co-located with the state itself.
  const {
    darkOverride, setDarkOverride,
    mobileCols, setMobileCols,
    desktopCols, setDesktopCols,
    viewMenuOpen, setViewMenuOpen,
  } = useViewSettings();
  // Auth. `user` is null when signed out; non-null with `.email` etc. when
  // signed in via Google. `ready` gates UI from flickering "Sign in" for a
  // returning user while we check the session. `showUserMenu` toggles the
  // small dropdown over the user badge.
  const { user, ready: authReady, signInWithGoogle, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const dark = darkOverride !== null ? darkOverride : sysDark;

  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
  // Desktop-only: hide the filter drawer with a top-left toggle so the grid
  // gets the full window width. Mobile already opens filters in a separate
  // drawer, so this is irrelevant there.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // All filter-row state lives in useFilters — search/sources/brands/
  // refs/auctions-only/sort/price/status/expansion-toggles/popover.
  // Destructured into the existing names so the rest of App.js doesn't
  // need to know the state moved.
  const {
    filterSources, setFilterSources,
    filterBrands,  setFilterBrands,
    filterRefs,    setFilterRefs,
    filterAuctionsOnly, setFilterAuctionsOnly,
    toggleSource, toggleBrand,
    sort, setSort,
    search, setSearch,
    minPriceText, setMinPriceText,
    maxPriceText, setMaxPriceText,
    minPrice, maxPrice,
    newDays, setNewDays,
    statusMode, setStatusMode,
    brandsExpanded,  setBrandsExpanded,
    sourcesExpanded, setSourcesExpanded,
    refsExpanded,    setRefsExpanded,
    activeFilterPop, setActiveFilterPop,
    filterPopRef,
    hasFilters, resetFilters,
  } = useFilters();
  const isDragging = useRef(false);
  const dragStart = useRef(0);
  const widthStart = useRef(0);
  // (Per-device column override + viewMenuOpen now live in
  // useViewSettings, see the destructure at the top of this component.)
  // Desktop column count: user override wins; otherwise the fluid default
  // based on viewport width with a sensible minimum.
  const desktopAutoCols = Math.max(3, Math.round(screenWidth / 240));
  const cols = isMobile
    ? mobileCols
    : (desktopCols === "auto" ? desktopAutoCols : desktopCols);
  const compact = cols >= 4;

  const [items, setItems] = useState([]);
  const [auctions, setAuctions] = useState([]);
  // Scraped state for tracked auction lots, keyed by URL. The user's own
  // tracked URLs come from Supabase (useTrackedLots); we join those URLs
  // against this object to render lot cards.
  const [trackedLotsState, setTrackedLotsState] = useState({});
  // Sub-tab inside Watchlist > Auction lots: upcoming vs past.
  // Sub-tab on the Watchlist tab. Three values: "listings" (dealer
  // items you've hearted) or "searches" (saved searches editor). The
  // "lots" sub-tab moved to the Auctions tab — keep its localStorage
  // value valid by mapping any old "lots" preference back to "listings".
  // Lives here (not inside WatchlistTab) because the surrounding chrome
  // — sidebar, filter bar, mobile drawer — gates on it too. Persisted
  // across visits.
  const [watchTopTab, setWatchTopTab] = useState(() => {
    try {
      const v = localStorage.getItem("dial_watch_top_tab");
      return v === "searches" ? "searches" : "listings";
    } catch { return "listings"; }
  });
  useEffect(() => {
    try { localStorage.setItem("dial_watch_top_tab", watchTopTab); } catch {}
    // Reset scroll on sub-tab change so switching from a long Listings
    // grid to the shorter Searches list doesn't leave the user mid-page.
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
    const desktopMain = document.querySelector("[data-desktop-main]");
    if (desktopMain) desktopMain.scrollTop = 0;
  }, [watchTopTab]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState("listings");
  const [page, setPage] = useState(1);
  // (filterSources, filterBrands, filterRefs, filterAuctionsOnly, sort,
  // search, minPriceText, maxPriceText, newDays, statusMode all moved
  // to useFilters at the top of this component.)
  // Global Group-by control. Replaces age-bucket dividers in the
  // Available/Archive feed AND drives the Watchlist > Listings sub-tab.
  // Persisted under `dial_group_v1`; falls back to the legacy
  // `watchlist_group_v1` key for users who set it before this lift.
  // (Group-by feature removed entirely 2026-04-30 per Mark — too
  // many overlapping axes against sort + status + filter pills.
  // Date dividers when sorted by date stay as an implicit
  // side-effect of the date sort. Brand / Source / Ref grouping
  // could come back later if there's a use case but isn't in
  // current scope. localStorage key dial_group_v1 is left untouched
  // for any users who might roll back.)

  // Hidden listings manager (was the Archive tab's hidden-section, now
  // a modal opened from the user dropdown).
  const [hiddenModalOpen, setHiddenModalOpen] = useState(false);
  // available to signed-out visitors too. Contact = Instagram link;
  // no email or form (keeps email out of the bundle and avoids spam).
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  // Watchlist + hidden now live server-side (Supabase) per authenticated
  // user. When signed out, these hooks return empty objects and their
  // toggles no-op — we wrap the toggles below to kick off sign-in instead.
  const { items: watchlist, toggle: toggleWatchlist } = useWatchlist(user);
  const { items: hidden,   toggle: toggleHidden    } = useHidden(user);
  // Saved searches are per-user (stored in Supabase). Signed-out visitors
  // get an empty list, and the whole Searches subsection is hidden inside
  // the Watchlist tab.
  const {
    items: userSearches,
    editor: searchEditor,
    setEditor: setSearchEditor,
    startAdd: startAddSearch,
    startEdit: startEditSearch,
    cancel: cancelSearchEdit,
    commit: commitSearch,
    remove: removeSearch,
    quickAdd: quickAddSearch,
  } = useSearches(user);
  // "Save current search as a favorite" prompt — opened by the heart
  // button inside the search input. The state machine lives in
  // useFavSearchModal; aliases below keep the rest of App.js's
  // references stable.
  const {
    open: favPromptOpen,    setOpen:    setFavPromptOpen,
    label: favPromptLabel,  setLabel:   setFavPromptLabel,
    error: favPromptError,  setError:   setFavPromptError,
    openPrompt:             openFavPrompt,
    submit:                 submitFavSearch,
  } = useFavSearchModal({ search, quickAddSearch });
  // Whether the current search is already a saved favourite.
  const currentIsSaved = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return false;
    return userSearches.some(s => (s.query || "").toLowerCase() === q);
  }, [search, userSearches]);
  const { urls: trackedLotUrls, add: addTrackedLot, remove: removeTrackedLot, addedAt: trackedLotAddedAt } = useTrackedLots(user);

  // Collections — user-created beyond the default Watchlist (which is
  // still backed by useWatchlist above). Approach A: this hook only
  // manages additional collections + the auto Shared-with-me inbox.
  // The full API is passed through to WatchlistTab for the Collections
  // sub-tab UI; the picker modal (lifted to App.js below) reuses it
  // when adding a listing from any Card anywhere.
  const collectionsApi = useCollections(user);

  // Picker modal state — lifted here so any Card across the app (in
  // Listings, Watchlist > Listings, or a Collection drill-in) can open
  // the same picker. Holds the item being added; null = closed.
  const [pickerTarget, setPickerTarget] = useState(null);
  const openCollectionPicker = useCallback((item) => setPickerTarget(item), []);

  // Edit modal state — used for both Create new collection (id='new')
  // and Rename existing (id=<uuid>). Lifted here because the sub-tab
  // strip's "+ New collection" trigger lives in App.js while WatchlistTab
  // also fires Rename from a row's actions.
  const [editingCollection, setEditingCollection] = useState(null);
  const startCreateCollection = useCallback(() => {
    setEditingCollection({ id: "new", name: "" });
  }, []);

  // Track-new-item modal — state machine lives in useTrackModal;
  // aliases below preserve the previous trackOpen/trackUrl/etc.
  // naming so the JSX consts and the sub-tab trigger button below
  // don't need to change.
  const {
    open: trackOpen,   setOpen:  setTrackOpen,
    url: trackUrl,     setUrl:   setTrackUrl,
    busy: trackBusy,
    error: trackError, setError: setTrackError,
    submit:                      submitTrack,
  } = useTrackModal({ addTrackedLot });
  // If there's leftover localStorage data from the pre-Supabase era, we
  // offer to import it after sign-in. Read once at mount so we can tell
  // the user *how many* items we'd import ("N saved, M hidden").
  const [legacyLocal] = useState(() => {
    try {
      return {
        watchlist: JSON.parse(localStorage.getItem(LEGACY_WATCHLIST_KEY) || "{}"),
        hidden:    JSON.parse(localStorage.getItem(LEGACY_HIDDEN_KEY) || "{}"),
      };
    } catch { return { watchlist: {}, hidden: {} }; }
  });
  const [importState, setImportState] = useState(() => {
    const any = Object.keys(legacyLocal.watchlist).length + Object.keys(legacyLocal.hidden).length;
    return any ? "available" : "none";  // available → done (after success) → none
  });
  // (brandsExpanded / sourcesExpanded / refsExpanded moved to useFilters.)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const observerRef = useRef(null);
  const BRANDS_SHOW = 8;
  const SOURCES_SHOW = 8;

  const onDragStart = useCallback((e) => {
    isDragging.current = true;
    dragStart.current = e.clientX;
    widthStart.current = sidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [sidebarWidth]);

  useEffect(() => {
    const onMove = e => {
      if (!isDragging.current) return;
      setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, widthStart.current + e.clientX - dragStart.current)));
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  useEffect(() => {
    // `cache: 'no-cache'` forces the browser/PWA to revalidate with the
    // origin on every load (sends If-None-Match, gets 304 if unchanged
    // — fast). Without it, iOS PWA + GitHub raw's 5-minute Cache-Control
    // could serve stale data for hours after a fresh scrape commit.
    const fetchOpts = { cache: "no-cache" };
    fetch(LISTINGS_URL, fetchOpts)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setItems(d); setLoading(false); })
      .catch(() => { setLoadError(true); setLoading(false); });
    // Auctions load in parallel. Failing silently is fine — the Auctions tab
    // just won't have data, which we handle with an empty-state message.
    fetch(AUCTIONS_URL, fetchOpts)
      .then(r => r.ok ? r.json() : [])
      .then(d => setAuctions(Array.isArray(d) ? d : []))
      .catch(() => {});
    // Tracked lots is keyed by URL. Failing silently is fine — empty
    // object means no tracked-lot cards render, which is correct when the
    // file doesn't exist yet (first deployment, or Supabase env vars not
    // set in the Action).
    fetch(TRACKED_LOTS_URL, fetchOpts)
      .then(r => r.ok ? r.json() : {})
      .then(d => setTrackedLotsState(d && typeof d === "object" ? d : {}))
      .catch(() => {});
  }, []);

  const c = dark ? {
    "--bg": "#000", "--surface": "#1c1c1e", "--card-bg": "#2c2c2e",
    "--border": "rgba(255,255,255,0.1)", "--text1": "#f5f5f7",
    "--text2": "#98989d", "--text3": "#48484a",
  } : {
    "--bg": "#fff", "--surface": "#f5f5f7", "--card-bg": "#fff",
    "--border": "rgba(0,0,0,0.09)", "--text1": "#1d1d1f",
    "--text2": "#6e6e73", "--text3": "#aeaeb2",
  };

  const SOURCES = useMemo(() => [...new Set(items.map(i => i.source))].sort(), [items]);

  // Singleton-brand collapse threshold. Brands with FEWER live listings
  // than this get pooled into "Other" rather than getting their own
  // filter chip. Stops one-off oddballs from cluttering the brand rail
  // while still letting niche brands surface as soon as a second
  // listing of the same brand appears. Mark set this to 2 on
  // 2026-04-29 — adjustable later if the chip rail feels sparse.
  const BRAND_CHIP_MIN = 2;
  const brandCounts = useMemo(() => {
    const c = {};
    items.filter(i => !i.sold).forEach(i => {
      const k = i.brand || "Other";
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [items]);
  // Bucket label for one item under singleton-collapse rules.
  // "Other" + any brand below the chip threshold all funnel into one
  // "Other" bucket for filter + group-by purposes.
  const displayBrand = useCallback((it) => {
    const b = it.brand || "Other";
    return (brandCounts[b] || 0) >= BRAND_CHIP_MIN ? b : "Other";
  }, [brandCounts]);
  const BRANDS = useMemo(() => {
    const visible = Object.entries(brandCounts)
      .filter(([b, n]) => n >= BRAND_CHIP_MIN && b !== "Other")
      .sort((a, b) => b[1] - a[1])
      .map(([b]) => b);
    // If any singleton or genuinely-Other items exist, expose an
    // "Other" chip so they remain reachable from the brand filter UI.
    const otherTotal = Object.entries(brandCounts)
      .filter(([b, n]) => n < BRAND_CHIP_MIN || b === "Other")
      .reduce((s, [, n]) => s + n, 0);
    if (otherTotal > 0) visible.push("Other");
    return visible;
  }, [brandCounts]);
  // Reference chips aggregate digit sequences (3-6 digits, optional .NNN)
  // found in listing titles. Years (1900-2099) are filtered out so a 4-digit
  // year doesn't pose as a ref. Refs are **scoped to the current brand
  // filter** — selecting Rolex hides "300" (Omega Seamaster/Speedy) and
  // selecting Omega hides "1675" (Rolex GMT). Without any brand selected,
  // chips draw from the whole catalog. Only refs with 2+ matches show.
  const REFS = useMemo(() => {
    const counts = {};
    const refRegex = /\b\d{3,6}(?:\.\d{1,3})?\b/g;
    const pool = items.filter(i =>
      !i.sold && (filterBrands.length === 0 || filterBrands.includes(displayBrand(i)))
    );
    pool.forEach(i => {
      const matches = (i.ref || "").match(refRegex) || [];
      for (const m of matches) {
        if (!m.includes(".")) {
          const n = parseInt(m, 10);
          if (n >= 1900 && n <= 2099 && m.length === 4) continue;  // year, skip
        }
        counts[m] = (counts[m] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([r]) => r);
  }, [items, filterBrands]);

  // (minPrice / maxPrice — int-parsed bounds — now derived inside
  // useFilters from the raw text inputs.)
  useEffect(() => { setPage(1); }, [filterSources, filterBrands, filterRefs, search, sort, newDays, minPriceText, maxPriceText]);

  // Sign-in gate for save actions. Tapping the heart or X while signed
  // out triggers the Google OAuth redirect instead of silently doing
  // nothing. If auth isn't configured at all (dev environment missing
  // env vars), we just no-op — no way to sign in anyway.
  // Pending-intent stash: when a signed-out user clicks heart or X, we
  // capture the listing id in sessionStorage before redirecting to
  // Google. After OAuth completes and the page reloads, the effect
  // below replays the action so the click isn't lost. sessionStorage
  // (vs localStorage) auto-clears with the tab and naturally scopes
  // per-window — different tabs don't replay each other's intents.
  const requireSignIn = useCallback((intent) => {
    if (!isAuthConfigured) return;
    if (intent) {
      try { sessionStorage.setItem("pending_intent", JSON.stringify(intent)); } catch {}
    }
    signInWithGoogle();
  }, [signInWithGoogle]);

  const toggleHide = useCallback((item) => {
    if (!user) { requireSignIn({ kind: "hide", id: item.id }); return; }
    toggleHidden(item);
  }, [user, toggleHidden, requireSignIn]);

  const toggleFilterRef = (ref) =>
    setFilterRefs(p => p.includes(ref) ? p.filter(x => x !== ref) : [...p, ref]);

  const handleWish = useCallback((item) => {
    if (!user) { requireSignIn({ kind: "wish", id: item.id }); return; }
    toggleWatchlist(item);
  }, [user, toggleWatchlist, requireSignIn]);

  // Replay a pending heart/hide once the user is back from OAuth and
  // the items list has loaded (so we can resolve the saved id to the
  // current item snapshot). Idempotent: only acts when the item isn't
  // already in the target collection, so re-runs from React strict-mode
  // or repeated renders don't toggle off what we just toggled on.
  useEffect(() => {
    if (!user || items.length === 0) return;
    let raw;
    try { raw = sessionStorage.getItem("pending_intent"); } catch { return; }
    if (!raw) return;
    try { sessionStorage.removeItem("pending_intent"); } catch {}
    let intent;
    try { intent = JSON.parse(raw); } catch { return; }
    if (!intent || !intent.id) return;
    const target = items.find(i => i.id === intent.id);
    if (!target) return;
    if (intent.kind === "wish" && !watchlist[target.id]) toggleWatchlist(target);
    if (intent.kind === "hide" && !hidden[target.id])    toggleHidden(target);
  }, [user, items, watchlist, hidden, toggleWatchlist, toggleHidden]);

  // (toggleSource / toggleBrand moved to useFilters.)

  const newCounts = useMemo(() => {
    // Exclude backfilled items so the Today/3-day/Week counts reflect
    // real new inventory, not a scraper-change retro pickup.
    const fs = items.filter(i => !i.sold && !i.backfilled);
    return {
      1: fs.filter(i => daysAgo(freshDate(i)) <= 1).length,
      3: fs.filter(i => daysAgo(freshDate(i)) <= 3).length,
      7: fs.filter(i => daysAgo(freshDate(i)) <= 7).length,
    };
  }, [items]);

  const allFiltered = useMemo(() => {
    let its = [...items];
    // Tri-state Status filter. "live" = current scraped inventory,
    // "sold" = historical/inactive (analytics view), "all" = both — the
    // useful comparison when paired with a brand+ref filter to see price
    // history alongside what's still on the market.
    if (statusMode === "live") its = its.filter(i => !i.sold);
    else if (statusMode === "sold") its = its.filter(i => i.sold);
    // "all" — no status filter
    its = its.filter(i => !hidden[i.id]);   // drop user-hidden items from Available feed
    if (filterRefs.length > 0) {
      its = its.filter(i => {
        const ref = (i.ref || "").toLowerCase();
        return filterRefs.some(r => ref.includes(r.toLowerCase()));
      });
    }
    if (newDays > 0) its = its.filter(i => daysAgo(freshDate(i)) <= newDays && !i.backfilled);
    if (filterSources.length > 0) its = its.filter(i => filterSources.includes(i.source));
    if (filterBrands.length > 0) its = its.filter(i => filterBrands.includes(displayBrand(i)));
    if (filterAuctionsOnly) its = its.filter(i => i._isAuctionFormat);
    if (search.trim()) {
      its = its.filter(i => matchesSearch(i, search));
    }
    if (minPrice > 0) its = its.filter(i => (i.priceUSD || i.price) >= minPrice);
    if (maxPrice < GLOBAL_MAX) its = its.filter(i => (i.priceUSD || i.price) <= maxPrice);
    if (sort === "price-asc") its.sort((a, b) => (a.priceUSD || a.price) - (b.priceUSD || b.price));
    else if (sort === "price-desc") its.sort((a, b) => (b.priceUSD || b.price) - (a.priceUSD || a.price));
    else {
      // Date sorts use the LATER of firstSeen and priceDropAt as the
      // effective "freshness" date, so a re-cut item bubbles back to
      // the top even if firstSeen is old. priceDropAt only applies
      // when there's a non-zero cumulative drop — otherwise we'd
      // promote items whose price went up then back down to the same
      // amount (priceDropAt set, but no drop visible).
      const effectiveDate = (i) => {
        const f = freshDate(i) || "";
        const d = (i.priceDropTotal && i.priceDropTotal > 0) ? (i.priceDropAt || "") : "";
        return d > f ? d : f;
      };
      const ascending = sort === "date-asc";
      its.sort((a, b) => {
        const ea = effectiveDate(a), eb = effectiveDate(b);
        if (ea === eb) return 0;
        return ascending ? (ea < eb ? -1 : 1) : (ea < eb ? 1 : -1);
      });
    }
    return its;
  }, [items, filterSources, filterBrands, filterRefs, hidden, search, sort, minPrice, maxPrice, newDays, statusMode, filterAuctionsOnly]);

  const visible = useMemo(() => allFiltered.slice(0, page * PAGE_SIZE), [allFiltered, page]);
  const hasMore = visible.length < allFiltered.length;

  // Callback ref so the IntersectionObserver always tracks the current
  // loader DOM node, even if React swaps it out between page bumps.
  const loaderRef = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setPage(p => p + 1);
    }, { threshold: 0.1 });
    obs.observe(node);
    observerRef.current = obs;
  }, []);

  // Lookup map of current scrape state by listing id, used to determine
  // whether each watchlisted item is still live or has gone sold/inactive.
  const liveStateById = useMemo(() => {
    const m = new Map();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  const watchItems = useMemo(() => {
    // Hearted dealer items from `watchlist_items`.
    let its = Object.values(watchlist);
    // Tag each entry with its current liveness so we can split into
    // Live/Sold sub-views below. An item is "sold" if the live scrape
    // says it's sold/on-hold OR if it's no longer in the scrape at all
    // (dealer pulled the listing → assume sold). The saved snapshot is
    // still the durable record either way.
    its = its.map(it => {
      const live = liveStateById.get(it.id);
      const isSold = !live || !!live.sold;
      return { ...it, _isSold: isSold };
    });
    // Project tracked lots (auction-house lots, eBay items, future
    // marketplace URLs) into the same shape so the Watchlist surface
    // is the single "things I care about" list. Tracked-lot URLs are
    // ALWAYS treated as user-saved (the URL paste itself counts as a
    // heart per Mark's spec on 2026-04-30). Item IDs use sha1(url) so
    // the union dedupes if the same URL ever ends up in both tables.
    for (const url of trackedLotUrls) {
      const data = trackedLotsState[url];
      if (!data) {
        // Pending: scraper hasn't populated tracked_lots.json yet.
        // Render a placeholder card.
        its.push({
          id: shortHash(url),
          brand: "Other",
          ref: "Fetching…",
          price: 0,
          currency: "USD",
          priceUSD: 0,
          savedPrice: 0,
          savedCurrency: "USD",
          savedPriceUSD: 0,
          source: "—",
          url,
          img: "",
          sold: false,
          _isSold: false,
          _isTrackedLot: true,
          _isAuctionFormat: false,
          savedAt: trackedLotAddedAt[url] || "",
        });
        continue;
      }
      const isEnded = data.status === "ended";
      const price = (isEnded ? data.sold_price : data.current_bid)
        || data.starting_price || data.estimate_low || 0;
      const priceUsd = (isEnded ? data.sold_price_usd : data.current_bid_usd)
        || data.starting_price_usd || data.estimate_low_usd || price;
      // eBay AUCTION + every traditional auction house = auction
      // format. eBay BIN + Chrono24 + Watchcollecting etc. = fixed
      // price. The chip + filter use this distinction; status text
      // ("CURRENT" vs "BUY NOW" vs "HAMMER" vs "SOLD") is set by the
      // Card render off `data.buying_option`.
      const isFixedPrice = data.buying_option === "BUY_IT_NOW"
                        || data.buying_option === "FIXED_PRICE";
      const isAuctionFormat = !isFixedPrice;
      its.push({
        id: shortHash(url),
        brand: canonicalizeBrand(detectBrandFromTitle(data.title || "")),
        ref: data.title || "—",
        price: price || 0,
        currency: data.currency || "USD",
        priceUSD: priceUsd || price || 0,
        // savedPrice family populated so the WatchlistTab Card-render
        // overrides (which read savedPrice/savedCurrency/savedPriceUSD
        // for hearted dealer items) work for tracked-lot projections
        // too without a separate code path.
        savedPrice: price || 0,
        savedCurrency: data.currency || "USD",
        savedPriceUSD: priceUsd || price || 0,
        source: data.house || "—",
        url,
        // Prefer Blob-cached image when present (survives the dealer
        // / auction-house deleting their original); fall back to the
        // scraper's native image URL otherwise. Empty cached_img_url
        // === "" means "processed by the cache module but no source
        // image was available" — fall through to whatever data.image
        // has (probably also empty).
        img: data.cached_img_url || data.image || "",
        sold: isEnded,
        _isSold: isEnded,
        _isTrackedLot: true,
        _isAuctionFormat: isAuctionFormat,
        // Pass through auction-specific fields the Card needs to
        // render bid label / countdown / estimate range / etc.
        buying_option: data.buying_option,
        current_bid: data.current_bid,
        current_bid_usd: data.current_bid_usd,
        sold_price: data.sold_price,
        sold_price_usd: data.sold_price_usd,
        estimate_low: data.estimate_low,
        estimate_high: data.estimate_high,
        estimate_low_usd: data.estimate_low_usd,
        estimate_high_usd: data.estimate_high_usd,
        starting_price: data.starting_price,
        auction_end: data.auction_end,
        auction_title: data.auction_title,
        lot_number: data.lot_number,
        savedAt: trackedLotAddedAt[url] || "",
        soldAt: isEnded ? (data.auction_end || data.scraped_at || "") : null,
      });
    }
    // Apply the same source/brand/ref/search filters as Available and Archive,
    // so the sidebar drawer narrows down the watchlist too. Saved entries
    // carry the listing_snapshot fields (source, brand, ref), so the same
    // predicates work here.
    if (filterSources.length > 0) its = its.filter(i => filterSources.includes(i.source));
    if (filterBrands.length > 0)  its = its.filter(i => filterBrands.includes(displayBrand(i)));
    if (filterAuctionsOnly)       its = its.filter(i => i._isAuctionFormat);
    if (filterRefs.length > 0) {
      its = its.filter(i => {
        const ref = (i.ref || "").toLowerCase();
        return filterRefs.some(r => ref.includes(r.toLowerCase()));
      });
    }
    if (search.trim()) {
      its = its.filter(i => matchesSearch(i, search));
    }
    // Price filter — was missing on Watchlist (Mark surfaced
    // 2026-04-30: divider counts didn't react to the price boxes).
    // Watchlist items carry savedPriceUSD / savedPrice; project
    // tracked-lots populate the same fields. Use whichever is set
    // for comparison, falling back to plain price if neither.
    if (minPrice > 0)  its = its.filter(i => (i.savedPriceUSD || i.savedPrice || i.priceUSD || i.price) >= minPrice);
    if (maxPrice < GLOBAL_MAX) its = its.filter(i => (i.savedPriceUSD || i.savedPrice || i.priceUSD || i.price) <= maxPrice);
    // Drive the watchlist sort off the same `sort` state the sidebar uses,
    // so "Newest first" / "Price low to high" / "Price high to low" applies
    // here too. "Newest first" maps to most-recently-saved (savedAt desc).
    if (sort === "price-asc") its.sort((a, b) => (a.savedPriceUSD || a.savedPrice) - (b.savedPriceUSD || b.savedPrice));
    else if (sort === "price-desc") its.sort((a, b) => (b.savedPriceUSD || b.savedPrice) - (a.savedPriceUSD || a.savedPrice));
    else if (sort === "date-asc") its.sort((a, b) => (a.savedAt || "").localeCompare(b.savedAt || ""));
    else its.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
    return its;
  }, [watchlist, liveStateById, sort, filterSources, filterBrands, filterRefs, search,
      filterAuctionsOnly, minPrice, maxPrice,
      trackedLotUrls, trackedLotsState, trackedLotAddedAt]);

  const watchLive = useMemo(() => watchItems.filter(i => !i._isSold), [watchItems]);
  const watchSold = useMemo(() => watchItems.filter(i =>  i._isSold), [watchItems]);

  // Status-filtered slice: "live" / "sold" / "all". Drives the Watchlist
  // > Listings sub-tab. Sort + filters from the existing controls flow
  // through watchItems already.
  // sort from watchItems is preserved.
  // (no scraped data yet) sort with upcoming so the user sees them.
  const nowMs = Date.now();
  // Sort tracked lots by the same `sort` state Available + Watchlist use.
  // For lots, "price" maps to the most-relevant figure: hammer if sold,
  // current bid if there is one, else the estimate-low. Date sort uses
  // auction_end (soonest first by default for upcoming, latest first
  // for past so the most recent hammer leads).
  const lotSortValue = (l) => {
    if (l._pending) return null;
    if (l.sold_price_usd != null) return l.sold_price_usd;
    if (l.current_bid_usd != null) return l.current_bid_usd;
    if (l.estimate_low_usd != null) return l.estimate_low_usd;
    return null;
  };
  const sortLots = (arr, isPast) => arr.slice().sort((a, b) => {
    if (sort === "price-asc" || sort === "price-desc") {
      const av = lotSortValue(a), bv = lotSortValue(b);
      // Push pending/no-price lots to the end regardless of asc/desc.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sort === "price-asc" ? av - bv : bv - av;
    }
    if (sort === "date-asc") {
      // Oldest end-time first, regardless of section.
      return (a.auction_end || "").localeCompare(b.auction_end || "");
    }
    // "date" (newest first): for upcoming, that means soonest-ending
    // first (most time-sensitive); for past, latest-ended first.
    if (isPast) return (b.auction_end || "").localeCompare(a.auction_end || "");
    return (a.auction_end || "9").localeCompare(b.auction_end || "9");
  });
  // Tracked auction lots: join the user's saved URLs against the global
  // scraped state. URLs without scraped data yet show as a placeholder
  // ("Fetching details on next scrape").
  const trackedLots = useMemo(() => {
    return trackedLotUrls.map(url => {
      const data = trackedLotsState[url];
      return data ? { ...data, url } : { url, _pending: true };
    });
  }, [trackedLotUrls, trackedLotsState]);

  // Apply the search filter to lots — title, house, and lot number all
  // match. Wired so the same search box that filters dealer listings on
  // the Watchlist tab also narrows the auction lots.
  const trackedLotsFiltered = useMemo(() => {
    let arr = trackedLots;
    // Source filter — for auction lots the "source" is the auction house.
    // The same Source pill in the filter row drives both: dealer sources
    // for listings, auction houses for lots.
    if (filterSources.length > 0) {
      arr = arr.filter(l => filterSources.includes(l.house));
    }
    const q = (search || "").trim().toLowerCase();
    if (q) {
      arr = arr.filter(l => {
        if (l._pending) return l.url.toLowerCase().includes(q);
        const haystack = `${l.title || ""} ${l.house || ""} ${l.description || ""} ${l.lot_number || ""}`.toLowerCase();
        return haystack.includes(q);
      });
    }
    return arr;
  }, [trackedLots, search, filterSources]);

  // Distinct auction houses across the user's tracked lots — used to
  // populate the Source pill's options when on Watchlist > Auction lots.
  const lotHouses = useMemo(
    () => [...new Set(trackedLots.map(l => l.house).filter(Boolean))].sort(),
    [trackedLots]
  );

  // User-hidden items (still live, just told to disappear from Available).
  // Surfaced via a "Manage hidden" modal opened from the user dropdown.
  const hiddenItems = useMemo(() => {
    return items
      .filter(i => !i.sold && hidden[i.id])
      .map(i => ({ ...i, hiddenAt: hidden[i.id] || "" }))
      .sort((a, b) => (a.hiddenAt < b.hiddenAt ? 1 : -1));
  }, [items, hidden]);

  const watchCount = Object.keys(watchlist).length;
  // (hasFilters now derived inside useFilters.)

  const savedSearchStats = useMemo(() => {
    const forSale = items.filter(i => !i.sold);
    return userSearches.map(({ id, label, query }) => {
      const q = (query || "").trim();
      const matches = q ? forSale.filter(i => matchesSearch(i, q)) : [];
      const newCount = matches.filter(i => daysAgo(freshDate(i)) <= 7 && !i.backfilled).length;
      return { id, label, query, count: matches.length, newCount };
    });
  }, [items, userSearches]);


  // (resetFilters now provided by useFilters.)

  const visibleBrands = brandsExpanded ? BRANDS : BRANDS.slice(0, BRANDS_SHOW);
  const visibleSources = sourcesExpanded ? SOURCES : SOURCES.slice(0, SOURCES_SHOW);
  const REFS_SHOW = 12;
  const visibleRefs = refsExpanded ? REFS : REFS.slice(0, REFS_SHOW);
  const NEW_OPTS = [{ label: "Today", days: 1 }, { label: "3 days", days: 3 }, { label: "This week", days: 7 }];

  const baseStyle = {
    fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',sans-serif",
    WebkitFontSmoothing: "antialiased", minHeight: "100vh",
    background: "var(--bg)", color: "var(--text1)",
    ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v]))
  };
  const gridStyle = { display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 1, background: "var(--border)" };

  // ── AUTH UI ─────────────────────────────────────────────────────────────
  // One block of JSX used by both the desktop sidebar footer and the mobile
  // header so the experience is identical across layouts.
  //   - Not configured (env vars missing): render nothing — app still works.
  //   - Not ready yet: subtle placeholder so "Sign in" doesn't flash.
  //   - Signed out: "Sign in with Google" pill.
  //   - Signed in: user's first-letter avatar + dropdown with Sign out.
  const userInitial = user?.user_metadata?.name?.[0]
    || user?.user_metadata?.full_name?.[0]
    || user?.email?.[0]
    || "?";
  const userName = user?.user_metadata?.name
    || user?.user_metadata?.full_name
    || user?.email
    || "";

  const authJSX = !isAuthConfigured ? null : !authReady ? (
    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--surface)" }} />
  ) : !user ? (
    <button onClick={() => signInWithGoogle()} style={{
      fontSize: 12, padding: "5px 12px", borderRadius: 20,
      border: "0.5px solid var(--border)", background: "var(--surface)",
      color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
      whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
    }}>
      <svg width="12" height="12" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.6 2.1 30.1 0 24 0 14.8 0 6.8 5.3 3 13l7.8 6C12.7 13.5 17.8 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.2-3.1-.5-4.5H24v9h12.7c-.6 3-2.3 5.5-4.9 7.2l7.6 5.9c4.4-4.1 7.1-10.1 7.1-17.6z"/>
        <path fill="#FBBC05" d="M10.8 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.8-6C1.1 16.3 0 20 0 24s1.1 7.7 3 11.2l7.8-6.5z"/>
        <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15.1-5.5l-7.6-5.9c-2.1 1.4-4.8 2.2-7.5 2.2-6.2 0-11.3-4-13.2-9.5l-7.8 6C6.8 42.7 14.8 48 24 48z"/>
      </svg>
      Sign in
    </button>
  ) : (
    <div style={{ position: "relative" }}>
      <button onClick={() => { setShowUserMenu(o => !o); setViewMenuOpen(false); }} aria-label="Account menu"
        style={{
          width: 30, height: 30, borderRadius: "50%",
          border: "0.5px solid var(--border)", background: "var(--surface)",
          color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
          fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
        {userInitial.toUpperCase()}
      </button>
      {showUserMenu && (
        <div style={{
          position: "absolute", right: 0, top: 36, zIndex: 50,
          // Always open downward — both desktop and mobile buttons live in
          // the top header now, so opening up would push the menu off the
          // top of the viewport.
          background: "var(--bg)", border: "0.5px solid var(--border)",
          borderRadius: 10, padding: 8, minWidth: 200,
          boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
        }}>
          <div style={{ fontSize: 11, color: "var(--text3)", padding: "4px 8px" }}>Signed in as</div>
          <div style={{ fontSize: 13, color: "var(--text1)", padding: "0 8px 8px",
                       overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userName}
          </div>
          <div style={{ height: "0.5px", background: "var(--border)", margin: "4px -8px 4px" }} />
          <button onClick={() => { setShowUserMenu(false); setHiddenModalOpen(true); }}
            style={{ display: "block", width: "100%", textAlign: "left",
                    padding: "6px 8px", border: "none", background: "transparent",
                    color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 13, borderRadius: 6 }}>
            Manage hidden{hiddenItems.length > 0 ? ` · ${hiddenItems.length}` : ""}
          </button>
          <button onClick={() => { setShowUserMenu(false); signOut(); }}
            style={{ display: "block", width: "100%", textAlign: "left",
                    padding: "6px 8px", border: "none", background: "transparent",
                    color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 13, borderRadius: 6 }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
  const inp = { border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 14, background: "var(--surface)", color: "var(--text1)", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };

  if (loading) return <div style={{ ...baseStyle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text2)" }}>Loading listings...</div>;
  if (loadError) return <div style={{ ...baseStyle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text2)" }}>Could not load listings. Try refreshing.</div>;

  // ── SIDEBAR FILTER PANEL (desktop only) ──────────────────────────────────
  // NOTE: defined as a JSX const rather than a function component so the DOM
  // nodes (especially the price text inputs) aren't rebuilt on every parent
  // render. Function components defined inside Watchlist() get a new reference per
  // render and React treats them as a new component type — which was killing
  // input focus mid-keystroke.
  // Sidebar section heading style — lifted out so all headings match and
  // one edit changes them everywhere. Slightly darker + bolder than before.
  const sectionHeadingStyle = {
    fontSize: 10, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.08em", color: "var(--text1)", marginBottom: 8,
  };

  const sidebarFilterPanelJSX = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 16px 8px" }}>
        <div style={sectionHeadingStyle}>Sort</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {[["date", "Newest first"], ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"]].map(([val, label]) => (
            <button key={val} onClick={() => setSort(val)} style={{ padding: "5px 8px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, textAlign: "left", background: sort === val ? "var(--surface)" : "transparent", color: sort === val ? "var(--text1)" : "var(--text2)", fontWeight: sort === val ? 500 : 400 }}>{label}</button>
          ))}
        </div>
      </div>
      {hasFilters && (
        <div style={{ padding: "0 16px 8px" }}>
          <button onClick={resetFilters} style={{ fontSize: 12, color: "#185FA5", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>Reset all filters</button>
        </div>
      )}
      <div style={{ height: "0.5px", background: "var(--border)", margin: "0 12px" }} />
      <div style={{ padding: "12px 16px 8px" }}>
        <div style={sectionHeadingStyle}>Source</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {SOURCES.map(s => <SidebarChip key={s} label={s} active={filterSources.includes(s)} onClick={() => toggleSource(s)} />)}
        </div>
      </div>
      <div style={{ height: "0.5px", background: "var(--border)", margin: "0 12px" }} />
      <div style={{ padding: "12px 16px 8px" }}>
        <div style={sectionHeadingStyle}>Brand</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {visibleBrands.map(b => <SidebarChip key={b} label={b} active={filterBrands.includes(b)} onClick={() => toggleBrand(b)} />)}
          {BRANDS.length > BRANDS_SHOW && <SidebarChip label={brandsExpanded ? "Less ↑" : `+${BRANDS.length - BRANDS_SHOW} more`} active={false} onClick={() => setBrandsExpanded(!brandsExpanded)} blue />}
        </div>
      </div>
      <div style={{ height: "0.5px", background: "var(--border)", margin: "0 12px" }} />
      <div style={{ padding: "12px 16px 14px" }}>
        <div style={sectionHeadingStyle}>Price (USD)</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input value={minPriceText} onChange={e => setMinPriceText(e.target.value)} placeholder="Min"
            inputMode="numeric"
            style={{ ...inp, fontSize: 12, padding: "6px 8px", flex: 1 }} />
          <span style={{ fontSize: 11, color: "var(--text3)" }}>–</span>
          <input value={maxPriceText} onChange={e => setMaxPriceText(e.target.value)} placeholder="Max"
            inputMode="numeric"
            style={{ ...inp, fontSize: 12, padding: "6px 8px", flex: 1 }} />
        </div>
      </div>
    </div>
  );

  // ── SEARCH RUNNER ─────────────────────────────────────────────────────────
  // Saved searches aren't their own tab — they render as a subsection
  // inside WatchlistTab. This just handles the "tap a search chip → jump
  // to Available with the query applied" handoff.
  const runSearch = (s) => { setSearch(s.query); setSort("date"); setTab("listings"); setPage(1); };

  // Inline editor row for add/edit. Rendered as a JSX helper (not a sub-
  // component) so React doesn't remount the inputs on every parent re-render
  // and lose focus mid-keystroke.

  // ── GRIDS ─────────────────────────────────────────────────────────────────
  // Walk `visible` and inject divider rows where the age bucket changes.
  // Only kicks in when sorted by date (newest or oldest first) and not
  // viewing sold history — date sort is what makes time-bucketing
  // meaningful. Other sorts (price) get a flat grid as before.
  // "Effective" age = whichever is more recent, the original firstSeen
  // or the most recent price-drop date (when there's a non-zero drop).
  // Same logic the sort uses, so a freshly-cut card lands in the same
  // bucket it sorts into rather than appearing as the "first card under
  // an Older header".
  const effectiveAgeDate = (i) => {
    const f = freshDate(i) || "";
    const d = (i.priceDropTotal && i.priceDropTotal > 0) ? (i.priceDropAt || "") : "";
    return d > f ? d : f;
  };
  // Same weekday-aware bucketing as the Watchlist surface — uses
  // ageBucketFromDate from utils.js so both tabs read identically
  // (Today / Yesterday / weekday-name / Last week / Older).
  const ageBucketLabel = (i) => ageBucketFromDate(effectiveAgeDate(i));
  // (Group-by helpers removed with the feature. Date dividers under
  // a date-sort are produced inline in `visibleWithDividers` below.)

  // Date-bucket ordering. Labels are now weekday-based (Today /
  // Yesterday / Wednesday / Tuesday / ... / Last week / Older), so
  // the static rank table from the old fixed-bucket model doesn't
  // work. Instead, sort grouped entries by the most-recent date
  // present in each group's items — that orders chronologically
  // regardless of label set.
  const groupRecency = (items) => {
    let max = 0;
    for (const it of items) {
      const t = new Date(effectiveAgeDate(it) || 0).getTime();
      if (t > max) max = t;
    }
    return max;
  };

  const visibleWithDividers = (() => {
    if (visible.length === 0) {
      return [];
    }
    // Group-by feature was removed 2026-04-30 — only implicit
    // date-bucket dividers remain (Today / Yesterday / weekday /
    // Last week / Older), and only when the user has sorted by
    // date and isn't viewing the sold archive. Other sorts get
    // a flat grid since date headings wouldn't align with the row
    // order.
    if (statusMode === "sold" || !(sort === "date" || sort === "date-asc")) {
      return visible.map(it => ({ kind: "card", item: it }));
    }
    const out = [];
    let last = null;
    for (const it of visible) {
      const bucket = ageBucketLabel(it);
      if (bucket !== last) {
        const total = allFiltered.filter(x => ageBucketLabel(x) === bucket).length;
        out.push({ kind: "divider", label: bucket, total });
        last = bucket;
      }
      out.push({ kind: "card", item: it });
    }
    return out;
  })();

  // Built once per render as a JSX expression (NOT a nested component).
  // A nested function-component gets a new identity on every App render,
  // which forces React to unmount + remount the entire grid — including
  // every <img> — making all tiles flash white on heart toggles, page
  // bumps, and any other state change. As a JSX expression, the same
  // grid instance is reused and only changed cards re-render.
  const listingsGridJSX = (
    <>
      <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
        {visibleWithDividers.map((entry, idx) => (
          entry.kind === "divider" ? (
            <div key={`div-${idx}-${entry.label}`} style={{
              gridColumn: "1/-1",
              padding: idx === 0 ? "14px 14px 12px" : "28px 14px 12px",
              display: "flex", alignItems: "baseline", gap: 12,
              borderBottom: "0.5px solid var(--border)",
              marginBottom: 4,
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
                {entry.label}
              </span>
              <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto" }}>
                {entry.total.toLocaleString()}
              </span>
            </div>
          ) : (
            <Card key={entry.item.id} item={entry.item} wished={!!watchlist[entry.item.id]} onWish={handleWish} compact={compact} onHide={toggleHide} isHidden={!!hidden[entry.item.id]} onAddToCollection={user ? openCollectionPicker : undefined} />
          )
        ))}
        {allFiltered.length === 0 && <div style={{ gridColumn: "1/-1", padding: 48, textAlign: "center", color: "var(--text3)", fontSize: 14 }}>
          {statusMode === "sold" ? "No sold listings match your filters" : "No watches match your filters"}
        </div>}
      </div>
      {hasMore && <div ref={loaderRef} style={{ padding: 24, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>Loading more...</div>}
      {!hasMore && allFiltered.length > 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>All {allFiltered.length} shown</div>}
    </>
  );


  // Save-current-search modal. Opened by the heart in the search input.
  // Single-field form (label) — query comes from the live search field.
  // Component lives in ./components/FavSearchModal.js as of 2026-04-30.
  const favSearchModalJSX = (
    <FavSearchModal
      open={favPromptOpen}
      setOpen={setFavPromptOpen}
      search={search}
      label={favPromptLabel}
      setLabel={setFavPromptLabel}
      error={favPromptError}
      setError={setFavPromptError}
      submit={submitFavSearch}
      inp={inp}
    />
  );

  // Live/Sold/All counts for the global tri-state pill. Computed
  // BEFORE the status filter is applied so flipping segments doesn't
  // make either count drop to 0. Counts are tab-aware: Available
  // counts use the global feed; Watchlist counts use saved items only.
  const isWatchlistTab = tab === "watchlist";
  const liveCountForPill = isWatchlistTab
    ? Object.values(watchlist).filter(it => {
        const live = liveStateById.get(it.id);
        return live && !live.sold;
      }).length
    : items.filter(i => !i.sold && !hidden[i.id]).length;
  const soldCountForPill = isWatchlistTab
    ? Object.values(watchlist).filter(it => {
        const live = liveStateById.get(it.id);
        return !live || !!live.sold;
      }).length
    : items.filter(i =>  i.sold && !hidden[i.id]).length;
  const allCountForPill = liveCountForPill + soldCountForPill;

  // Tri-state Status segment, used in BOTH the desktop filter row AND
  // the mobile sticky sort row so the same control drives every view.
  // Passed through to both shells via the shellProps bag.
  const statusSegmentJSX = (
    <div style={{ display: "flex", border: "0.5px solid var(--border)", borderRadius: 20, overflow: "hidden" }}>
      {[
        ["live", `Live · ${liveCountForPill}`],
        ["sold", `Sold · ${soldCountForPill}`],
        ["all",  `All · ${allCountForPill}`],
      ].map(([k, label], idx) => (
        <button key={k} onClick={() => setStatusMode(k)} style={{
          border: "none",
          borderLeft: idx === 0 ? "none" : "0.5px solid var(--border)",
          padding: "6px 10px", fontSize: 12, cursor: "pointer",
          background: statusMode === k ? "var(--text1)" : "transparent",
          color: statusMode === k ? "var(--bg)" : "var(--text2)",
          fontFamily: "inherit", whiteSpace: "nowrap",
        }}>{label}</button>
      ))}
    </div>
  );

  // (Retired 2026-04-30) AuctionsTab JSX was built here. Tracked lots
  // now flow into Watchlist > Listings; calendar lives at Watchlist >
  // Auction Calendar via AuctionCalendar.js.

  // Watchlist tab JSX. Built once so both mobile + desktop returns can
  // reference the same instance without re-spelling the long prop list.
  const watchlistTabJSX = (
    <WatchlistTab
      user={user}
      signInWithGoogle={signInWithGoogle}
      isAuthConfigured={isAuthConfigured}
      watchlist={watchlist}
      watchItems={watchItems}
      watchLive={watchLive}
      watchSold={watchSold}
      watchCount={watchCount}
      toggleWatchlist={toggleWatchlist}
      liveStateById={liveStateById}
      savedSearchStats={savedSearchStats}
      searchEditor={searchEditor}
      setSearchEditor={setSearchEditor}
      startAddSearch={startAddSearch}
      startEditSearch={startEditSearch}
      cancelSearchEdit={cancelSearchEdit}
      commitSearch={commitSearch}
      removeSearch={removeSearch}
      runSearch={runSearch}
      handleWish={handleWish}
      compact={compact}
      gridStyle={gridStyle}
      inp={inp}
      isMobile={isMobile}
      statusMode={statusMode}
      sort={sort}
      auctions={auctions}
      addTrackedLot={addTrackedLot}
      removeTrackedLot={removeTrackedLot}
      watchTopTab={watchTopTab}
      setWatchTopTab={setWatchTopTab}
      legacyLocal={legacyLocal}
      importState={importState}
      setImportState={setImportState}
      legacyKeys={{ watchlist: LEGACY_WATCHLIST_KEY, hidden: LEGACY_HIDDEN_KEY }}
      setTab={setTab}
      setPage={setPage}
      collectionsApi={collectionsApi}
      setEditingCollection={setEditingCollection}
      openCollectionPicker={openCollectionPicker}
    />
  );

  // ── MOBILE ────────────────────────────────────────────────────────────────
  // Watchlist sub-tab strip — lifted out of WatchlistTab.js on
  // 2026-04-30 so it sits between the main tab strip and the filter
  // row rather than below the filter row. Sits in the layout flow
  // only when tab === "watchlist". Inline contextual buttons:
  // "+ Track new item" on Listings, "+ Add search" on Searches,
  // none on Auction Calendar.
  const watchSubTabsJSX = tab !== "watchlist" ? null : (
    // Sub-tab strip uses underline-style buttons (see tabPill in
    // styles.js) so it sits visually below the main pill tabs in the
    // hierarchy. gap: 20 between sub-tabs, since they're text-only
    // they need horizontal breathing room.
    <div style={{
      display: "flex", gap: 20, alignItems: "center",
      padding: "0 16px",
      background: "var(--bg)",
      borderBottom: "0.5px solid var(--border)",
      flexShrink: 0,
    }}>
      {[
        // Mobile drops the trailing count chips and shortens
        // "Auction Calendar" → "Calendar" so all three pills + the
        // trailing "+ Track new item" / "+ Add search" action button
        // fit on one row at 375px viewport. Listings keeps its count
        // (signals "how many things am I tracking?" — a real piece of
        // info). Searches + Calendar dropped their counts 2026-05-01:
        // the count there was just "rows below" rather than
        // "outstanding work" so it added noise without informing.
        ["listings", isMobile ? "Listings" : `Listings${watchCount > 0 ? ` · ${watchCount}` : ""}`],
        ["collections", "Collections"],
        ["searches", "Searches"],
        ["calendar", isMobile ? "Calendar" : "Auction Calendar"],
      ].map(([key, label]) => {
        const active = watchTopTab === key;
        return (
          <button key={key} onClick={() => { setWatchTopTab(key); setDrawerOpen(false); }} style={tabPill(active)}>{label}</button>
        );
      })}
      {watchTopTab === "listings" && user && (
        <button onClick={() => { setTrackOpen(true); setTrackError(""); }} style={{
          marginLeft: "auto",
          fontSize: 13, fontWeight: 500,
          padding: "9px 14px", borderRadius: 8,
          border: "0.5px solid var(--border)",
          background: "var(--surface)", color: "var(--text1)",
          cursor: "pointer", fontFamily: "inherit",
        }}>+ Track new item</button>
      )}
      {watchTopTab === "searches" && user && !searchEditor && (
        <button onClick={startAddSearch} style={{
          marginLeft: "auto",
          fontSize: 13, fontWeight: 500,
          padding: "9px 14px", borderRadius: 8,
          border: "0.5px solid var(--border)",
          background: "var(--surface)", color: "var(--text1)",
          cursor: "pointer", fontFamily: "inherit",
        }}>+ Add search</button>
      )}
      {watchTopTab === "collections" && user && (
        <button onClick={startCreateCollection} style={{
          marginLeft: "auto",
          fontSize: 13, fontWeight: 500,
          padding: "9px 14px", borderRadius: 8,
          border: "0.5px solid var(--border)",
          background: "var(--surface)", color: "var(--text1)",
          cursor: "pointer", fontFamily: "inherit",
        }}>+ New collection</button>
      )}
    </div>
  );

  // Track new item modal — single-URL paste flow with source-list
  // instructions. Trigger lives in the watchSubTabsJSX strip above the
  // filter row. Component lives in ./components/TrackNewItemModal.js
  // as of 2026-04-30.
  const trackNewItemModalJSX = (
    <TrackNewItemModal
      open={trackOpen}
      setOpen={setTrackOpen}
      trackUrl={trackUrl}
      setTrackUrl={setTrackUrl}
      trackError={trackError}
      setTrackError={setTrackError}
      submitTrack={submitTrack}
      trackBusy={trackBusy}
      inp={inp}
    />
  );

  // Add-search modal — fires when searchEditor.id === "new" (i.e. user
  // tapped "+ Add search" in the sub-tab strip). Edits to existing
  // searches stay in the inline editor inside WatchlistTab; only the
  // "new" case routes through the modal so + Add and + Track behave
  // identically across the strip.
  const addSearchModalOpen = !!searchEditor && searchEditor.id === "new";
  const addSearchModalJSX = (
    <AddSearchModal
      open={addSearchModalOpen}
      onClose={cancelSearchEdit}
      searchEditor={searchEditor || { id: "", label: "", query: "" }}
      setSearchEditor={setSearchEditor}
      commitSearch={commitSearch}
      inp={inp}
    />
  );

  // Collections — create/rename modal + add-to-collection picker.
  // Both render globally so any Card across the app can trigger the
  // picker, and the sub-tab strip + WatchlistTab share the edit modal.
  const collectionEditModalJSX = (
    <CollectionEditModal
      editing={editingCollection}
      setEditing={setEditingCollection}
      createCollection={collectionsApi.createCollection}
      renameCollection={collectionsApi.renameCollection}
      inp={inp}
    />
  );
  const collectionPickerModalJSX = (
    <CollectionPickerModal
      target={pickerTarget}
      setTarget={setPickerTarget}
      collections={collectionsApi.collections}
      itemsByCollection={collectionsApi.itemsByCollection}
      addItemToCollection={collectionsApi.addItemToCollection}
      createCollection={collectionsApi.createCollection}
      inp={inp}
    />
  );

  // Both shells consume the same props bag. App.js owns state and the
  // top-level JSX consts (authJSX, listingsGridJSX, watchSubTabsJSX,
  // statusSegmentJSX, watchlistTabJSX, plus the modal JSX consts) — the
  // shells just render. Extracted into MobileShell/DesktopShell as
  // Stage 2 of recommendation #1 on 2026-04-30.
  const shellProps = {
    // Catalog / config
    BRANDS, BRANDS_SHOW, SOURCES, SOURCES_SHOW,
    // State
    aboutModalOpen, activeFilterPop, allFiltered,
    brandsExpanded, currentIsSaved, dark,
    desktopAutoCols, desktopCols, drawerOpen,
    filterAuctionsOnly, filterBrands, filterSources,
    hasFilters, hiddenItems, hiddenModalOpen,
    maxPriceText, minPriceText, mobileCols,
    search, sort, sourcesExpanded, tab, user,
    viewMenuOpen, visibleBrands, visibleSources,
    watchTopTab, watchlist,
    // Setters / handlers
    handleWish, openFavPrompt, resetFilters,
    setAboutModalOpen, setActiveFilterPop, setBrandsExpanded,
    setDarkOverride, setDesktopCols, setDrawerOpen,
    setFilterAuctionsOnly, setFilterBrands, setFilterSources,
    setHiddenModalOpen, setMaxPriceText, setMinPriceText,
    setMobileCols, setPage, setSearch, setShowUserMenu,
    setSort, setSourcePickerOpen, setSourcesExpanded,
    setTab, setViewMenuOpen,
    toggleBrand, toggleHide, toggleSource,
    // Style tokens / pre-built JSX
    addSearchModalJSX,
    authJSX, baseStyle,
    collectionEditModalJSX, collectionPickerModalJSX,
    favSearchModalJSX, inp,
    listingsGridJSX, sectionHeadingStyle, statusSegmentJSX,
    trackNewItemModalJSX, watchSubTabsJSX, watchlistTabJSX,
  };

  return isMobile
    ? <MobileShell {...shellProps} />
    : <DesktopShell {...shellProps} />;
}
