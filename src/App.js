import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAuth, useWatchlist, useHidden, useSearches, useTrackedLots, importLocalData, isAuthConfigured } from "./supabase";
import {
  GLOBAL_MAX, CURRENCY_SYM,
  fmt, fmtUSD, daysAgo, freshDate, imgSrc, logToPrice, extractRef,
  ageBucketFromDate, canonicalizeBrand, detectBrandFromTitle, shortHash,
} from "./utils";
import { useWidth, useSystemDark } from "./hooks";
import { FilterIcon, SearchIcon, TabIcon } from "./components/icons";
import { Card } from "./components/Card";
import { Chip, SidebarChip } from "./components/Chip";
// AuctionsTab retired 2026-04-30 — Tracked lots merged into Watchlist
// Listings; calendar moved to Watchlist > Auction Calendar sub-tab via
// the new AuctionCalendar component. AuctionsTab.js still exists in
// the tree for reference but is not imported or rendered anywhere.
import { ReferencesTab } from "./components/ReferencesTab";
import { AboutModal } from "./components/AboutModal";
import { HiddenModal } from "./components/HiddenModal";
import { WatchlistTab } from "./components/WatchlistTab";

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
  const [darkOverride, setDarkOverride] = useState(null);
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
  // Desktop filter consolidation: the sidebar's role is taken over by a
  // row of pill-style filter dropdowns below the top header. Only one
  // popover open at a time. `null` = nothing open.
  const [activeFilterPop, setActiveFilterPop] = useState(null);
  const filterPopRef = useRef(null);
  // Close the active popover when user clicks anywhere outside it.
  useEffect(() => {
    if (!activeFilterPop) return;
    const handler = (e) => {
      if (filterPopRef.current && !filterPopRef.current.contains(e.target)) {
        setActiveFilterPop(null);
      }
    };
    // Defer to next tick so the click that opened the popover doesn't
    // immediately close it.
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [activeFilterPop]);
  const isDragging = useRef(false);
  const dragStart = useRef(0);
  const widthStart = useRef(0);
  // Per-device column override. Mobile picks 1-3, desktop picks 3-7 or
  // "auto". Persisted in localStorage so the choice sticks across visits.
  const [mobileCols, setMobileCols] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem("dial_mobile_cols") || "3", 10);
      return [1, 2, 3].includes(v) ? v : 3;
    } catch { return 3; }
  });
  const [desktopCols, setDesktopCols] = useState(() => {
    try {
      const v = localStorage.getItem("dial_desktop_cols");
      if (v === "auto" || v === null) return "auto";
      const n = parseInt(v, 10);
      return [3, 4, 5, 6, 7].includes(n) ? n : "auto";
    } catch { return "auto"; }
  });
  useEffect(() => {
    try { localStorage.setItem("dial_mobile_cols", String(mobileCols)); } catch {}
  }, [mobileCols]);
  useEffect(() => {
    try { localStorage.setItem("dial_desktop_cols", String(desktopCols)); } catch {}
  }, [desktopCols]);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
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
  const [filterSources, setFilterSources] = useState([]);
  const [filterBrands, setFilterBrands] = useState([]);
  // Auctions-only toggle. Filters to items where _isAuctionFormat is
  // true (auction-house lots + eBay AUCTION). Orthogonal to the
  // Live/Sold/All status segment per Mark's spec.
  const [filterAuctionsOnly, setFilterAuctionsOnly] = useState(false);
  const [sort, setSort] = useState("date");
  const [search, setSearch] = useState("");
  const [minPriceText, setMinPriceText] = useState("");
  const [maxPriceText, setMaxPriceText] = useState("");
  const [newDays, setNewDays] = useState(0);
  const [page, setPage] = useState(1);
  const [filterRefs, setFilterRefs] = useState([]);
  // Tri-state status filter shared globally: "live" (default), "sold",
  // or "all" (both combined). Applies to:
  //   - Available feed: filter to live, sold, or no filter (all).
  //   - Watchlist > Listings: same semantics on saved items.
  //   - Watchlist > Lots: live = upcoming, sold = past, all = combined.
  // One source of truth for "what status am I looking at" so the user
  // doesn't have to set it per tab.
  const [statusMode, setStatusMode] = useState("live");
  // Global Group-by control. Replaces age-bucket dividers in the
  // Available/Archive feed AND drives the Watchlist > Listings sub-tab.
  // Persisted under `dial_group_v1`; falls back to the legacy
  // `watchlist_group_v1` key for users who set it before this lift.
  const [groupBy, setGroupBy] = useState(() => {
    try {
      const v = localStorage.getItem("dial_group_v1")
        || localStorage.getItem("watchlist_group_v1");
      // 2026-04-30 (PM): briefly promoted "date" to its own explicit
      // chip; reverted same day per Mark — date dividers now fire
      // implicitly when sort is newest/oldest and no other group is
      // selected. Migrate any user who got bumped to "date" back
      // to "none" so the chip set stays in sync with the UI.
      if (!v || v === "date") return "none";
      return v;
    } catch { return "none"; }
  });
  useEffect(() => {
    try { localStorage.setItem("dial_group_v1", groupBy); } catch {}
  }, [groupBy]);
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
  // button inside the search input. State is just the label being
  // typed; the query comes from the live search field.
  const [favPromptOpen, setFavPromptOpen] = useState(false);
  const [favPromptLabel, setFavPromptLabel] = useState("");
  const [favPromptError, setFavPromptError] = useState("");
  const openFavPrompt = useCallback(() => {
    setFavPromptLabel(search.trim());
    setFavPromptError("");
    setFavPromptOpen(true);
  }, [search]);
  const submitFavSearch = useCallback(async () => {
    const { error } = await quickAddSearch(favPromptLabel, search);
    if (error) { setFavPromptError(error); return; }
    setFavPromptOpen(false);
    setFavPromptLabel("");
  }, [favPromptLabel, search, quickAddSearch]);
  // Whether the current search is already a saved favourite.
  const currentIsSaved = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return false;
    return userSearches.some(s => (s.query || "").toLowerCase() === q);
  }, [search, userSearches]);
  const { urls: trackedLotUrls, add: addTrackedLot, remove: removeTrackedLot, addedAt: trackedLotAddedAt } = useTrackedLots(user);
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
  const [brandsExpanded, setBrandsExpanded] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [refsExpanded, setRefsExpanded] = useState(false);
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

  // Desktop and mobile both use the same text-input model for price filtering
  // now (sliders kept breaking mid-drag because SidebarFilterPanel remounts
  // on every parent render — a refactor-to-top-level is the real fix and
  // lives on the open-issues list).
  const minPrice = minPriceText ? (parseInt(minPriceText.replace(/[^0-9]/g, "")) || 0) : 0;
  const maxPrice = maxPriceText ? (parseInt(maxPriceText.replace(/[^0-9]/g, "")) || GLOBAL_MAX) : GLOBAL_MAX;

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

  const toggleSource = s => setFilterSources(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const toggleBrand = b => setFilterBrands(p => p.includes(b) ? p.filter(x => x !== b) : [...p, b]);

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
      const q = search.toLowerCase();
      its = its.filter(i => i.ref.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q));
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
      const q = search.toLowerCase();
      its = its.filter(i => (i.ref || "").toLowerCase().includes(q) || (i.brand || "").toLowerCase().includes(q));
    }
    // Drive the watchlist sort off the same `sort` state the sidebar uses,
    // so "Newest first" / "Price low to high" / "Price high to low" applies
    // here too. "Newest first" maps to most-recently-saved (savedAt desc).
    if (sort === "price-asc") its.sort((a, b) => (a.savedPriceUSD || a.savedPrice) - (b.savedPriceUSD || b.savedPrice));
    else if (sort === "price-desc") its.sort((a, b) => (b.savedPriceUSD || b.savedPrice) - (a.savedPriceUSD || a.savedPrice));
    else if (sort === "date-asc") its.sort((a, b) => (a.savedAt || "").localeCompare(b.savedAt || ""));
    else its.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
    return its;
  }, [watchlist, liveStateById, sort, filterSources, filterBrands, filterRefs, search,
      filterAuctionsOnly, trackedLotUrls, trackedLotsState, trackedLotAddedAt]);

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
  const hasFilters = filterSources.length > 0 || filterBrands.length > 0 || filterRefs.length > 0 || search || newDays > 0 || minPriceText || maxPriceText;

  const savedSearchStats = useMemo(() => {
    const forSale = items.filter(i => !i.sold);
    return userSearches.map(({ id, label, query }) => {
      const q = (query || "").toLowerCase();
      const matches = q
        ? forSale.filter(i => i.ref.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q))
        : [];
      const newCount = matches.filter(i => daysAgo(freshDate(i)) <= 7 && !i.backfilled).length;
      return { id, label, query, count: matches.length, newCount };
    });
  }, [items, userSearches]);


  const resetFilters = () => { setFilterSources([]); setFilterBrands([]); setFilterRefs([]); setSearch(""); setNewDays(0); setMinPriceText(""); setMaxPriceText(""); };

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
  const ageBucketLabel = (i) => {
    const d = daysAgo(effectiveAgeDate(i));
    if (d <= 1) return "Today";
    if (d <= 3) return "Last 3 days";
    if (d <= 7) return "This week";
    return "Older";
  };
  // Derive the group key for a single item under the current `groupBy`.
  // brand/source/ref bucket by their respective fields; "none" returns
  // null (flat, no explicit dividers). Date dividers under "none" are
  // produced implicitly in `visibleWithDividers` when the sort is by
  // date — see the fall-through branch there.
  const groupKeyOf = (it) => {
    if (groupBy === "brand")  return displayBrand(it);
    if (groupBy === "source") return it.source || "Other";
    if (groupBy === "ref")    return extractRef(it.ref) || "Other";
    return null;
  };

  // Bucket-order for date so Today shows first, then Last 3 days,
  // then This week, then Older. Used wherever we sort grouped output
  // for the date dimension.
  const dateBucketOrder = { "Today": 0, "Last 3 days": 1, "This week": 2, "Older": 3 };

  const visibleWithDividers = (() => {
    if (visible.length === 0) {
      return [];
    }
    // Group acts first; sort applies within groups (the items list
    // arrives pre-sorted from `allFiltered`, so each bucket inherits
    // the user's chosen sort order). "none" = flat, no dividers.
    if (groupBy !== "none") {
      const groups = new Map();
      for (const it of visible) {
        const key = groupKeyOf(it) || "Other";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(it);
      }
      const entries = [...groups.entries()];
      if (groupBy === "ref") {
        // References: most-populous first so the dense buckets read first.
        entries.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
      } else {
        entries.sort((a, b) => a[0].localeCompare(b[0]));
      }
      const out = [];
      for (const [key, items] of entries) {
        const total = allFiltered.filter(x => groupKeyOf(x) === key).length;
        out.push({ kind: "divider", label: key, total });
        for (const it of items) out.push({ kind: "card", item: it });
      }
      return out;
    }
    // groupBy === "none". When the user has sorted by date (newest or
    // oldest first) and isn't viewing the sold archive, surface
    // implicit age-bucket dividers (Today / Last 3 days / This week /
    // Older). Other sorts (price) get a flat grid since date headings
    // wouldn't align with the row order.
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
              padding: idx === 0 ? "4px 4px 12px" : "28px 4px 12px",
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
            <Card key={entry.item.id} item={entry.item} wished={!!watchlist[entry.item.id]} onWish={handleWish} compact={compact} onHide={toggleHide} isHidden={!!hidden[entry.item.id]} />
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
  const favSearchModalJSX = favPromptOpen ? (
    <div onClick={() => setFavPromptOpen(false)} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg)", borderRadius: 14,
        border: "0.5px solid var(--border)",
        padding: 22, maxWidth: 380, width: "100%",
        boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text1)" }}>Save search</div>
          <button onClick={() => setFavPromptOpen(false)} aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text2)", fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10 }}>
          Saving "<b>{search}</b>" — find it again from Watchlist → Searches.
        </div>
        <input
          autoFocus
          value={favPromptLabel}
          onChange={e => { setFavPromptLabel(e.target.value); setFavPromptError(""); }}
          onKeyDown={e => { if (e.key === "Enter") submitFavSearch(); }}
          placeholder="Name (e.g. Speedmaster pro)"
          style={{ ...inp, fontSize: 14, marginBottom: 8 }}
        />
        {favPromptError && (
          <div style={{ fontSize: 12, color: "#c0392b", marginBottom: 8 }}>{favPromptError}</div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => setFavPromptOpen(false)} style={{
            border: "0.5px solid var(--border)", background: "transparent", color: "var(--text2)",
            padding: "8px 14px", borderRadius: 8, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13,
          }}>Cancel</button>
          <button onClick={submitFavSearch} disabled={!favPromptLabel.trim()} style={{
            border: "none", background: "#185FA5", color: "#fff",
            padding: "8px 14px", borderRadius: 8, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            opacity: favPromptLabel.trim() ? 1 : 0.5,
          }}>Save</button>
        </div>
      </div>
    </div>
  ) : null;

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
  // Declared up here (not next to filterRowJSX) so both mobile and
  // desktop returns are below the declaration — JS const isn't hoisted,
  // so a reference before declaration would crash mobile (which renders
  // first). That's exactly the regression that hit 2026-04-27.
  const statusSegmentJSX = (
    <div style={{ display: "flex", border: "0.5px solid var(--border)", borderRadius: 18, overflow: "hidden" }}>
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
      groupBy={groupBy}
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
    />
  );

  // ── MOBILE ────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={baseStyle}>
        {/* "Watchlist" title sits OUTSIDE the sticky wrapper — it scrolls
            off screen as you pan down, leaving just the sticky search +
            sort rows pinned to the top. No JS needed; this is pure CSS
            flow + sticky positioning. */}
        <div style={{ padding: "10px 14px 4px" }}>
          {/* Tap the title to jump back to Available (home). */}
          <button onClick={() => { setTab("listings"); setPage(1); }}
            style={{ background: "none", border: "none", cursor: "pointer",
                    padding: 0, fontFamily: "inherit",
                    fontSize: 22, fontWeight: 600, letterSpacing: "-0.5px",
                    color: "var(--text1)" }}>
            Watchlist
          </button>
        </div>
        {/* Sticky stack: search row (with filter + dark-mode buttons) and
            sort/clear pills row. Stays pinned to the viewport top so
            filters are one tap away at any scroll depth. */}
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px 6px", borderBottom: "0.5px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", borderRadius: 10, padding: "7px 12px", flex: 1, minWidth: 0 }}>
            <SearchIcon />
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
              placeholder="Search reference or brand..." style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, color: "var(--text1)", outline: "none", fontFamily: "inherit", minWidth: 0 }} />
            {search && user && (
              <button onClick={openFavPrompt} aria-label={currentIsSaved ? "Already saved" : "Save search as favorite"}
                title={currentIsSaved ? "Saved to favorites" : "Save as favorite search"}
                disabled={currentIsSaved}
                style={{ flexShrink: 0, background: "none", border: "none",
                        cursor: currentIsSaved ? "default" : "pointer",
                        color: currentIsSaved ? "#185FA5" : "var(--text3)",
                        padding: 2, fontFamily: "inherit",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill={currentIsSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            )}
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search"
                style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer",
                        color: "var(--text3)", padding: 2, fontFamily: "inherit",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          {!(tab === "watchlist" && (watchTopTab === "searches" || watchTopTab === "calendar")) && (
            <button onClick={() => { setDrawerOpen(true); setSourcePickerOpen(false); }} aria-label="Filters" style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: "0.5px solid var(--border)", background: hasFilters ? "var(--text1)" : "var(--surface)", color: hasFilters ? "var(--bg)" : "var(--text2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FilterIcon />
            </button>
          )}
          {/* "View" button consolidates theme + column count so the top bar
              doesn't have to grow as we add per-device display settings. */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={() => { setViewMenuOpen(o => !o); setShowUserMenu(false); }} aria-label="View options"
              style={{ width: 36, height: 36, borderRadius: "50%", border: "0.5px solid var(--border)", background: viewMenuOpen ? "var(--text1)" : "var(--surface)", color: viewMenuOpen ? "var(--bg)" : "var(--text2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {/* Eye icon — feels right for "view settings" (theme + column
                  count). Mark's call: cog read like "settings", eye reads
                  like "how the page looks". */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            {viewMenuOpen && (
              <div style={{ position: "absolute", right: 0, top: 42, zIndex: 50,
                           background: "var(--bg)", border: "0.5px solid var(--border)",
                           borderRadius: 10, padding: 12, minWidth: 180,
                           boxShadow: "0 6px 20px rgba(0,0,0,0.18)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Theme</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {[["light", "Light"], ["dark", "Dark"]].map(([key, lbl]) => {
                    const active = (key === "dark") === dark;
                    return (
                      <button key={key} onClick={() => setDarkOverride(key === "dark")} style={{
                        flex: 1, padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--border)",
                        background: active ? "var(--text1)" : "transparent",
                        color: active ? "var(--bg)" : "var(--text2)",
                        cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                      }}>{lbl}</button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Columns</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3].map(n => (
                    <button key={n} onClick={() => setMobileCols(n)} style={{
                      flex: 1, padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--border)",
                      background: mobileCols === n ? "var(--text1)" : "transparent",
                      color: mobileCols === n ? "var(--bg)" : "var(--text2)",
                      cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                    }}>{n}</button>
                  ))}
                </div>
                <div style={{ height: "0.5px", background: "var(--border)", margin: "12px -12px 8px" }} />
                <button onClick={() => { setViewMenuOpen(false); setAboutModalOpen(true); }} style={{
                  width: "100%", textAlign: "left",
                  padding: "6px 8px", border: "none", background: "transparent",
                  color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, borderRadius: 6,
                }}>About & Contact</button>
              </div>
            )}
          </div>
          {authJSX}
        </div>
        {/* Sort/source/sold/clear pill row — only relevant for tabs that
            have a list to filter. On Searches sub-tab we still render an
            empty placeholder of the same height so the content below
            doesn't jump up when switching sub-tabs. */}
        {tab === "watchlist" && (watchTopTab === "searches" || watchTopTab === "calendar") && (
          // Spacer row — matches the active filter row's padding +
          // pill-shaped child so the height is identical to the real row.
          // Avoids a layout shift when switching to Searches sub-tab.
          <div style={{ display: "flex", gap: 6, padding: "6px 14px 8px", borderBottom: "0.5px solid var(--border)", alignItems: "center" }}>
            <span style={{ fontSize: 13, padding: "7px 14px", borderRadius: 20, border: "0.5px solid transparent", visibility: "hidden" }}>placeholder</span>
          </div>
        )}
        {!(tab === "watchlist" && (watchTopTab === "searches" || watchTopTab === "calendar")) && (
        <div style={{ display: "flex", gap: 6, padding: "6px 14px 8px", borderBottom: "0.5px solid var(--border)", position: "relative", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text3)", marginRight: 2 }}>{allFiltered.length}</span>
          {/* Date sort pill */}
          {(() => {
            const isDateSort = sort === "date" || sort === "date-asc";
            const label = sort === "date" ? "Date ↓" : sort === "date-asc" ? "Date ↑" : "Date";
            const active = sort === "date" || sort === "date-asc";
            return (
              <button onClick={() => {
                if (sort === "date") setSort("date-asc");
                else if (sort === "date-asc") setSort("date");
                else setSort("date");
              }} style={{
                fontSize: 13, padding: "7px 14px", borderRadius: 20, cursor: "pointer",
                fontFamily: "inherit", whiteSpace: "nowrap", border: "none", outline: "none",
                background: active ? "var(--text1)" : "transparent",
                color: active ? "var(--bg)" : "var(--text2)",
                boxShadow: active ? "none" : "inset 0 0 0 0.5px var(--border)",
              }}>{label}</button>
            );
          })()}
          {/* Price sort pill */}
          {(() => {
            const label = sort === "price-asc" ? "Price ↑" : sort === "price-desc" ? "Price ↓" : "Price";
            const active = sort === "price-asc" || sort === "price-desc";
            return (
              <button onClick={() => {
                // Tapping Price should stay in price mode — toggles between
                // asc and desc. Previous version fell back to date on the
                // third tap, which felt like the button was broken.
                if (sort === "price-asc") setSort("price-desc");
                else if (sort === "price-desc") setSort("price-asc");
                else setSort("price-asc");
              }} style={{
                fontSize: 13, padding: "7px 14px", borderRadius: 20, cursor: "pointer",
                fontFamily: "inherit", whiteSpace: "nowrap", border: "none", outline: "none",
                background: active ? "var(--text1)" : "transparent",
                color: active ? "var(--bg)" : "var(--text2)",
                boxShadow: active ? "none" : "inset 0 0 0 0.5px var(--border)",
              }}>{label}</button>
            );
          })()}
          {/* Source pill removed from inline mobile row 2026-04-30 —
              source filtering lives in the filter tray on mobile so
              the sticky bar doesn't compete with date / price / status
              for finger room. */}
          {/* Status segment lives inside the mobile filter drawer
              (see drawerOpen block) — too wide for the sticky sort row
              once it became three buttons. Desktop still renders it
              inline in the filter row. */}
          {/* Compact "clear filters" — just a small × icon to keep the
              row from wrapping when filters are set. The text version
              ("× Clear") got cropped at narrow widths. */}
          {hasFilters && (
            <button onClick={resetFilters} aria-label="Clear all filters" title="Clear all filters"
              style={{
                marginLeft: "auto", flexShrink: 0,
                width: 32, height: 32, borderRadius: "50%",
                border: "none", outline: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 16, lineHeight: 1, padding: 0,
                background: "transparent", color: "#185FA5",
                boxShadow: "inset 0 0 0 0.5px #185FA5",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>×</button>
          )}
        </div>
        )}
        {/* Source picker dropdown removed 2026-04-30 — source
            filtering moved to the mobile filter tray drawer. */}
        </div>
        {/* Top padding 0 on Watchlist so the sub-tab strip sits flush
            against the sticky filter pills above (otherwise a ~12px gap
            at scroll-top shows cards peeking through). */}
        <div style={{ padding: `${tab === "watchlist" ? 0 : 12}px 14px 100px` }}>
          {tab === "listings" ? listingsGridJSX
            : tab === "references" ? <ReferencesTab />
            : watchlistTabJSX}
        </div>
        {/* Bottom tab bar. The container reserves the iOS home-indicator
            safe area PLUS a fixed extra padding, so the buttons aren't
            hugging the home bar when the app is launched standalone from
            the home screen. */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "var(--bg)", borderTop: "0.5px solid var(--border)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4px)" }}>
          {/* References is desktop-only — bottom tab bar stays at 3
              tabs to keep mobile labels readable. References tools
              are still reachable on mobile by deep link if anyone
              shares one, but the nav surface stays compact. */}
          {[["listings", "Listings"], ["watchlist", "Watchlist"]].map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); if (key === "listings") setSearch(""); }} style={{ flex: 1, padding: "8px 0 6px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: tab === key ? "var(--text1)" : "var(--text3)", fontWeight: tab === key ? 500 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {tab === key
                ? <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#185FA5" }} />
                : <TabIcon kind={key} />}
              <span>{label}</span>
            </button>
          ))}
        </div>


        {/* Mobile drawer */}
        {drawerOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
            <div onClick={() => setDrawerOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "var(--bg)", borderRadius: "16px 16px 0 0", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>

              {/* Drawer handle */}
              <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)" }} />
              </div>

              {/* Scrollable filter content */}
              <div style={{ flex: 1, overflowY: "auto", padding: "0 0 8px" }}>

                <div style={{ padding: "10px 16px 10px" }}>
                  <div style={sectionHeadingStyle}>Status</div>
                  {statusSegmentJSX}
                </div>
                <div style={{ height: "0.5px", background: "var(--border)", margin: "0 16px 0" }} />

                <div style={{ padding: "10px 16px 10px" }}>
                  <div style={sectionHeadingStyle}>Source</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {visibleSources.map(s => <Chip key={s} label={s} active={filterSources.includes(s)} onClick={() => toggleSource(s)} />)}
                    {SOURCES.length > SOURCES_SHOW && <Chip label={sourcesExpanded ? "Less ↑" : `+${SOURCES.length - SOURCES_SHOW} more`} active={false} onClick={() => setSourcesExpanded(!sourcesExpanded)} blue />}
                  </div>
                </div>
                <div style={{ height: "0.5px", background: "var(--border)", margin: "0 16px 0" }} />

                <div style={{ padding: "10px 16px 10px" }}>
                  <div style={sectionHeadingStyle}>Brand</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {visibleBrands.map(b => <Chip key={b} label={b} active={filterBrands.includes(b)} onClick={() => toggleBrand(b)} />)}
                    {BRANDS.length > BRANDS_SHOW && <Chip label={brandsExpanded ? "Less ↑" : `+${BRANDS.length - BRANDS_SHOW} more`} active={false} onClick={() => setBrandsExpanded(!brandsExpanded)} blue />}
                  </div>
                </div>
                <div style={{ height: "0.5px", background: "var(--border)", margin: "0 16px 0" }} />

                <div style={{ padding: "10px 16px 10px" }}>
                  <div style={sectionHeadingStyle}>Price range</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={minPriceText} onChange={e => setMinPriceText(e.target.value)} placeholder="Min $" style={{ ...inp, flex: 1 }} />
                    <span style={{ fontSize: 12, color: "var(--text3)", flexShrink: 0 }}>to</span>
                    <input value={maxPriceText} onChange={e => setMaxPriceText(e.target.value)} placeholder="Max $" style={{ ...inp, flex: 1 }} />
                  </div>
                </div>
              </div>

              {/* Fixed bottom actions. Sort + Group moved to desktop-
                  only on 2026-04-30 — mobile uses the inline sort
                  pill in the sticky search row, and grouping is a
                  desktop-rail decision. */}
              <div style={{ borderTop: "0.5px solid var(--border)", padding: "12px 16px", background: "var(--bg)" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {hasFilters && (
                    <button onClick={resetFilters} style={{ padding: "12px 16px", borderRadius: 12, border: "0.5px solid var(--border)", background: "transparent", color: "var(--text2)", fontSize: 14, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      Reset
                    </button>
                  )}
                  <button onClick={() => setDrawerOpen(false)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: "var(--text1)", color: "var(--bg)", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                    Show {allFiltered.length} watches
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
        <HiddenModal
          open={hiddenModalOpen}
          onClose={() => setHiddenModalOpen(false)}
          items={hiddenItems}
          watchlist={watchlist}
          onWish={handleWish}
          onHide={toggleHide}
        />
        <AboutModal
          open={aboutModalOpen}
          onClose={() => setAboutModalOpen(false)}
        />
        {favSearchModalJSX}
      </div>
    );
  }

  // ── DESKTOP ───────────────────────────────────────────────────────────────
  // The desktop sidebar is gone. Filters live in a pill row below the top
  // header (see filterRowJSX). The sidebar collapse toggle still exists
  // but is hidden in the markup until/unless we restore the sidebar
  // pattern; left in place to avoid churning state references.
  const sidebarToggleJSX = null;

  // Pill-style filter row. Each pill opens a popover anchored below it.
  // One popover open at a time, click-outside to close. Style matches
  // the mobile sticky sort row so the experience is consistent.
  const pillBase = (active) => ({
    fontSize: 13, padding: "6px 12px", borderRadius: 18, cursor: "pointer",
    fontFamily: "inherit", whiteSpace: "nowrap", border: "none", outline: "none",
    background: active ? "var(--text1)" : "transparent",
    color: active ? "var(--bg)" : "var(--text2)",
    boxShadow: active ? "none" : "inset 0 0 0 0.5px var(--border)",
  });

  // Generic popover shell. Pass `wide` for the multi-select pickers
  // (Source / Brand / Reference) where the option list wants to flow
  // into columns rather than stacking vertically.
  const popShell = (children, { wide = false } = {}) => (
    <div ref={filterPopRef} style={{
      position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60,
      background: "var(--bg)", border: "0.5px solid var(--border)",
      borderRadius: 10, padding: 12,
      minWidth: wide ? 360 : 220,
      maxWidth: wide ? 640 : 360,
      width: wide ? "min(640px, calc(100vw - 32px))" : "auto",
      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
    }}>
      {children}
    </div>
  );

  // Two-column grid for option lists in the wide popovers. minmax 160px
  // means columns expand to fill, but never narrower than ~160px so the
  // labels don't get squeezed.
  const popGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 2,
    maxHeight: 360,
    overflowY: "auto",
  };
  // Multi-select row inside the wide popovers — same look as the Sort
  // dropdown rows: greyed background when selected, right-aligned tick
  // instead of a leading checkbox. Click toggles selection without
  // closing the popover (since these are multi-select).
  const multiSelectRowStyle = (active) => ({
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 8, padding: "8px 10px", borderRadius: 6, border: "none",
    background: active ? "var(--surface)" : "transparent",
    color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
    fontSize: 13, textAlign: "left", width: "100%",
  });
  const tickStyle = { color: "var(--text2)", fontSize: 12, flexShrink: 0 };
  const popClearStyle = {
    marginTop: 10, padding: "6px 10px", borderRadius: 6,
    border: "0.5px solid var(--border)",
    background: "transparent", color: "var(--text2)", cursor: "pointer",
    fontFamily: "inherit", fontSize: 12, width: "100%",
  };

  const filterRowJSX = (() => {
    return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
                  borderBottom: "0.5px solid var(--border)", flexShrink: 0,
                  flexWrap: "wrap", position: "relative" }}>
      {/* Tri-state Status segment — Live / Sold / All. Always first in
          the row. Counts reflect what's available in each state. */}
      {statusSegmentJSX}

      {/* Sort */}
      <div style={{ position: "relative" }}>
        {(() => {
          const label = sort === "price-asc" ? "Price ↑"
                      : sort === "price-desc" ? "Price ↓"
                      : sort === "date-asc" ? "Oldest first"
                      : "Newest first";
          return (
            <button onClick={() => setActiveFilterPop(p => p === "sort" ? null : "sort")} style={pillBase(false)}>
              Sort: {label} ▾
            </button>
          );
        })()}
        {activeFilterPop === "sort" && popShell(
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[["date", "Newest first"], ["date-asc", "Oldest first"],
              ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"]
            ].map(([val, lbl]) => (
              <button key={val} onClick={() => { setSort(val); setActiveFilterPop(null); }} style={{
                textAlign: "left", padding: "8px 10px", borderRadius: 6, border: "none",
                background: sort === val ? "var(--surface)" : "transparent",
                color: "var(--text1)", cursor: "pointer", fontFamily: "inherit", fontSize: 13,
              }}>{lbl}{sort === val ? "  ✓" : ""}</button>
            ))}
          </div>
        )}
      </div>

      {/* Group */}
      <div style={{ position: "relative" }}>
        {(() => {
          const label = groupBy === "brand" ? "Brand"
                      : groupBy === "source" ? "Source"
                      : "None";
          return (
            <button onClick={() => setActiveFilterPop(p => p === "group" ? null : "group")} style={pillBase(groupBy !== "none")}>
              Group: {label} ▾
            </button>
          );
        })()}
        {activeFilterPop === "group" && popShell(
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[["none", "No grouping"], ["brand", "Brand"],
              ["source", "Source"]
            ].map(([val, lbl]) => (
              <button key={val} onClick={() => { setGroupBy(val); setActiveFilterPop(null); }} style={{
                textAlign: "left", padding: "8px 10px", borderRadius: 6, border: "none",
                background: groupBy === val ? "var(--surface)" : "transparent",
                color: "var(--text1)", cursor: "pointer", fontFamily: "inherit", fontSize: 13,
              }}>{lbl}{groupBy === val ? "  ✓" : ""}</button>
            ))}
          </div>
        )}
      </div>

      {/* Price — inline mini/max inputs (was a popover; replaced
          2026-04-30 per Mark's ask). Always visible in the filter
          row so a price filter is one tap from any state, not two
          (open popover → type). USD-only labels because the feed is
          USD-normalized; native-currency filtering would need a
          separate axis. */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "var(--surface)",
        border: "0.5px solid var(--border)",
        borderRadius: 20, padding: "0 6px 0 12px", height: 30,
      }}>
        <span style={{ fontSize: 11, color: "var(--text3)" }}>$</span>
        <input value={minPriceText}
          onChange={e => setMinPriceText(e.target.value)}
          placeholder="Min" inputMode="numeric"
          aria-label="Minimum price USD"
          style={{
            border: "none", background: "transparent",
            color: "var(--text1)", outline: "none",
            fontFamily: "inherit", fontSize: 13,
            width: 56, padding: "4px 0",
          }} />
        <span style={{ fontSize: 11, color: "var(--text3)" }}>–</span>
        <input value={maxPriceText}
          onChange={e => setMaxPriceText(e.target.value)}
          placeholder="Max" inputMode="numeric"
          aria-label="Maximum price USD"
          style={{
            border: "none", background: "transparent",
            color: "var(--text1)", outline: "none",
            fontFamily: "inherit", fontSize: 13,
            width: 60, padding: "4px 0",
          }} />
        {(minPriceText || maxPriceText) && (
          <button onClick={() => { setMinPriceText(""); setMaxPriceText(""); }}
            aria-label="Clear price filter"
            style={{
              border: "none", background: "transparent",
              color: "var(--text3)", cursor: "pointer",
              fontFamily: "inherit", fontSize: 14,
              padding: "0 4px", lineHeight: 1,
            }}>×</button>
        )}
      </div>


      {/* Source — dealer sources from the listings catalogue. The
          house-filter variant for tracked lots was retired when lot
          tracking moved into the Auctions tab; if needed later it'd
          live there as an internal control. */}
      <div style={{ position: "relative" }}>
        <button onClick={() => setActiveFilterPop(p => p === "source" ? null : "source")} style={pillBase(filterSources.length > 0)}>
          Source{filterSources.length > 0 ? ` · ${filterSources.length}` : ""} ▾
        </button>
        {activeFilterPop === "source" && popShell(
          <div>
            {SOURCES.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text3)", padding: "8px 4px" }}>
                No sources yet.
              </div>
            ) : (
              <div style={popGridStyle}>
                {SOURCES.map(s => (
                  <button key={s} onClick={() => toggleSource(s)} style={multiSelectRowStyle(filterSources.includes(s))}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s}</span>
                    {filterSources.includes(s) && <span style={tickStyle}>✓</span>}
                  </button>
                ))}
              </div>
            )}
            {filterSources.length > 0 && (
              <button onClick={() => setFilterSources([])} style={popClearStyle}>
                Clear sources
              </button>
            )}
          </div>,
          { wide: true }
        )}
      </div>

      {/* Brand */}
      <div style={{ position: "relative" }}>
        <button onClick={() => setActiveFilterPop(p => p === "brand" ? null : "brand")} style={pillBase(filterBrands.length > 0)}>
          Brand{filterBrands.length > 0 ? ` · ${filterBrands.length}` : ""} ▾
        </button>
        {activeFilterPop === "brand" && popShell(
          <div>
            <div style={popGridStyle}>
              {BRANDS.map(b => (
                <button key={b} onClick={() => toggleBrand(b)} style={multiSelectRowStyle(filterBrands.includes(b))}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b}</span>
                  {filterBrands.includes(b) && <span style={tickStyle}>✓</span>}
                </button>
              ))}
            </div>
            {filterBrands.length > 0 && (
              <button onClick={() => setFilterBrands([])} style={popClearStyle}>Clear brands</button>
            )}
          </div>,
          { wide: true }
        )}
      </div>

      {/* Auctions-only toggle pill — orthogonal to the Live/Sold/All
          status segment. When on, filters down to auction-format
          tracked lots (auction houses + eBay AUCTION); leaves dealer
          listings + BIN tracked items hidden. Most useful on the
          Watchlist tab where both kinds coexist. Lives at the end of
          the filter row so the layout doesn't shift on toggle. */}
      <div style={{ position: "relative" }}>
        <button onClick={() => setFilterAuctionsOnly(v => !v)} style={pillBase(filterAuctionsOnly)}>
          {filterAuctionsOnly ? "✓ Auctions" : "Auctions"}
        </button>
      </div>

      {/* Reference filter dropped from the top filter row — auto-extracted
          ref numbers were noisy, especially for sources whose titles use
          model names instead of ref digits (Hairspring, etc.). The
          sidebar still surfaces ref chips when they aggregate cleanly,
          and the search box covers any specific lookup. */}

      {/* The "New" pill was retired — recency is now visualised as
          age-bucket dividers in the grid (Today / 3 days / This week /
          Older) when sorting by date. */}

      {hasFilters && (
        <button onClick={resetFilters} style={{
          marginLeft: "auto",
          fontSize: 13, padding: "6px 12px", borderRadius: 18, cursor: "pointer",
          fontFamily: "inherit", whiteSpace: "nowrap",
          border: "none", outline: "none",
          background: "transparent", color: "#185FA5",
          boxShadow: "inset 0 0 0 0.5px #185FA5",
        }}>× Clear all</button>
      )}
    </div>
    );
  })();

  return (
    <div style={{ ...baseStyle, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Full-width top bar: hamburger | Watchlist title | tabs |
          centered search | count | dark | auth. Sits above both the
          sidebar and the content area so the title is always visible
          even when the sidebar is collapsed. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "0.5px solid var(--border)", flexShrink: 0 }}>
        {!(tab === "watchlist" && (watchTopTab === "searches" || watchTopTab === "calendar")) && sidebarToggleJSX}
        {/* Watchlist title doubles as a "home" link — click to jump to
            Available. */}
        <button onClick={() => { setTab("listings"); setPage(1); }}
          style={{ background: "none", border: "none", cursor: "pointer",
                  padding: 0, fontFamily: "inherit",
                  fontSize: 18, fontWeight: 500, letterSpacing: "-0.5px",
                  color: "var(--text1)", flexShrink: 0 }}>
          Watchlist
        </button>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, marginLeft: 4 }}>
          {[["listings", "Listings"], ["watchlist", "Watchlist"], ["references", "Reference"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: "6px 14px", borderRadius: 20, border: "0.5px solid var(--border)", cursor: "pointer",
              fontFamily: "inherit", fontSize: 13,
              background: tab === key ? "var(--text1)" : "var(--surface)",
              color: tab === key ? "var(--bg)" : "var(--text2)",
              fontWeight: tab === key ? 600 : 500,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <TabIcon kind={key} />
              {label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", borderRadius: 8, padding: "7px 12px", width: "100%", maxWidth: 640 }}>
            <SearchIcon />
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
              placeholder="Search reference or brand..." style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, color: "var(--text1)", outline: "none", fontFamily: "inherit", minWidth: 0 }} />
            {search && user && (
              <button onClick={openFavPrompt} aria-label={currentIsSaved ? "Already saved" : "Save search as favorite"}
                title={currentIsSaved ? "Saved to favorites" : "Save as favorite search"}
                disabled={currentIsSaved}
                style={{ flexShrink: 0, background: "none", border: "none",
                        cursor: currentIsSaved ? "default" : "pointer",
                        color: currentIsSaved ? "#185FA5" : "var(--text3)",
                        padding: 2, fontFamily: "inherit",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill={currentIsSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            )}
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search"
                style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer",
                        color: "var(--text3)", padding: 2, fontFamily: "inherit",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
        </div>
        {/* Total-count was here — removed; the Live/Sold pill in the
            filter row already shows the count for the active state. */}
        {/* Desktop View popover: theme + column count, mirroring mobile.
            Replaces the standalone dark-mode icon button so per-device
            display settings live in one place. */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button onClick={() => { setViewMenuOpen(o => !o); setShowUserMenu(false); }} aria-label="View options"
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: "0.5px solid var(--border)",
              background: viewMenuOpen ? "var(--text1)" : "var(--surface)",
              color: viewMenuOpen ? "var(--bg)" : "var(--text2)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
          {viewMenuOpen && (
            <div style={{ position: "absolute", right: 0, top: 38, zIndex: 50,
                         background: "var(--bg)", border: "0.5px solid var(--border)",
                         borderRadius: 10, padding: 12, minWidth: 220,
                         boxShadow: "0 6px 20px rgba(0,0,0,0.18)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Theme</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {[["light", "Light"], ["dark", "Dark"]].map(([key, lbl]) => {
                  const active = (key === "dark") === dark;
                  return (
                    <button key={key} onClick={() => setDarkOverride(key === "dark")} style={{
                      flex: 1, padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--border)",
                      background: active ? "var(--text1)" : "transparent",
                      color: active ? "var(--bg)" : "var(--text2)",
                      cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                    }}>{lbl}</button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Columns</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {["auto", 3, 4, 5, 6, 7].map(n => (
                  <button key={n} onClick={() => setDesktopCols(n)} style={{
                    flex: "1 1 auto", minWidth: 36, padding: "6px 10px", borderRadius: 6,
                    border: "0.5px solid var(--border)",
                    background: desktopCols === n ? "var(--text1)" : "transparent",
                    color: desktopCols === n ? "var(--bg)" : "var(--text2)",
                    cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                  }}>{n === "auto" ? "Auto" : n}</button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 6 }}>
                Auto = {desktopAutoCols} columns at this width.
              </div>
              <div style={{ height: "0.5px", background: "var(--border)", margin: "12px -12px 8px" }} />
              <button onClick={() => { setViewMenuOpen(false); setAboutModalOpen(true); }} style={{
                width: "100%", textAlign: "left",
                padding: "6px 8px", border: "none", background: "transparent",
                color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, borderRadius: 6,
              }}>About & Contact</button>
            </div>
          )}
        </div>
        {authJSX}
      </div>
      {/* Filter pill row — sits below the top bar, above the content area.
          Only relevant on tabs that filter (Available + Watchlist). */}
      {/* Filter row only on tabs/sub-tabs that filter:
          • Available — always
          • Watchlist > Listings — yes
          • Watchlist > Auction lots — yes (sort still applies, Live/Sold split too)
          • Watchlist > Searches — render an empty placeholder of the
            same height so the content area doesn't jump up when
            switching sub-tabs. */}
      {(tab === "listings" || (tab === "watchlist" && watchTopTab !== "searches" && watchTopTab !== "calendar"))
        ? filterRowJSX
        : (tab === "watchlist"
            ? (
              // Spacer row that matches the real filter pill row's padding
              // + pill-sized child so the watchlist sub-tabs don't jump
              // when switching to Searches.
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "0.5px solid var(--border)", flexShrink: 0 }}>
                <span style={{ fontSize: 13, padding: "6px 12px", borderRadius: 18, visibility: "hidden" }}>placeholder</span>
              </div>
            )
            : null)}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* The desktop sidebar previously held all the filters. Replaced
            in the April '26 filter-consolidation pass by the top
            filterRowJSX above. Sidebar markup intentionally retired here;
            the source code (sidebarFilterPanelJSX, sidebarToggleJSX,
            resize handlers) is still defined further up so we can revert
            quickly if the new pattern doesn't pan out. */}
        {/* Top padding is 0 on the Watchlist tab so the sub-tab strip
            (Listings / Searches) sits flush against the filter pill row.
            Without this there's a ~14px gap at scroll-top where cards
            peek through. Listings + Auctions keep the breathing room. */}
        <div data-desktop-main style={{ flex: 1, overflowY: "auto", padding: `${tab === "watchlist" ? 0 : 14}px 16px 32px` }}>
          {tab === "listings" ? listingsGridJSX
            : tab === "references" ? <ReferencesTab />
            : watchlistTabJSX}
        </div>
      </div>
      <HiddenModal
          open={hiddenModalOpen}
          onClose={() => setHiddenModalOpen(false)}
          items={hiddenItems}
          watchlist={watchlist}
          onWish={handleWish}
          onHide={toggleHide}
        />
        <AboutModal
          open={aboutModalOpen}
          onClose={() => setAboutModalOpen(false)}
        />
        {favSearchModalJSX}
    </div>
  );
}
