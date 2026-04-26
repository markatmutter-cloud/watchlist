import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAuth, useWatchlist, useHidden, useSearches, useTrackedLots, importLocalData, isAuthConfigured } from "./supabase";

const LISTINGS_URL = "https://raw.githubusercontent.com/markatmutter-cloud/Dial/main/public/listings.json";
const AUCTIONS_URL = "https://raw.githubusercontent.com/markatmutter-cloud/Dial/main/public/auctions.json";
const TRACKED_LOTS_URL = "https://raw.githubusercontent.com/markatmutter-cloud/Dial/main/public/tracked_lots.json";
const PAGE_SIZE = 48;
// Legacy localStorage keys — kept only for the one-shot import on first
// sign-in (see importLocalData + the banner in the Watchlist tab). Active
// reads/writes now go through Supabase via the hooks in ./supabase.js.
const LEGACY_WATCHLIST_KEY = "dial_watchlist_v2";
const LEGACY_HIDDEN_KEY    = "dial_hidden_v1";
const GLOBAL_MAX = 600000;
const CURRENCY_SYM = { USD: "$", GBP: "£", EUR: "€", CHF: "CHF " };
const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 520;
const SIDEBAR_DEFAULT_FRACTION = 0.25;   // start at 25% of window width
function initialSidebarWidth() {
  if (typeof window === "undefined") return 280;
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(window.innerWidth * SIDEBAR_DEFAULT_FRACTION)));
}

// Reference chips are aggregated from the current feed (same pattern as
// Brand chips) — see REFS useMemo in the Dial component.


function fmt(price, currency) {
  return (CURRENCY_SYM[currency] || "$") + price.toLocaleString();
}
function fmtUSD(p) { return "$" + Math.round(p).toLocaleString(); }
function daysAgo(dateStr) {
  if (!dateStr) return 9999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}
// Prefer firstSeen (from state.json) over the scrape-stamped date. Falls back
// for listings that predate the state-tracking change.
function freshDate(item) { return item.firstSeen || item.date; }
function logToPrice(pos) {
  if (pos >= 100) return GLOBAL_MAX;
  const minL = Math.log(500), maxL = Math.log(GLOBAL_MAX);
  return Math.round(Math.exp(minL + (pos / 100) * (maxL - minL)));
}
function useWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}
function useSystemDark() {
  const [sysDark, setSysDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = e => setSysDark(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return sysDark;
}

function HeartIcon({ filled, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}
function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="6" x2="20" y2="6"/>
      <line x1="8" y1="12" x2="20" y2="12"/>
      <line x1="12" y1="18" x2="20" y2="18"/>
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

function Card({ item, wished, onWish, compact, onHide, isHidden }) {
  // `backfilled` is set by merge.py when a single source contributes 10+
  // listings whose firstSeen == today — that pattern is almost always a
  // scraper change retroactively picking up listings that were already on
  // the dealer's site, not real new inventory. Suppress the NEW badge for
  // those so the signal stays useful.
  const isNew = daysAgo(freshDate(item)) <= 1 && !item.sold && !item.backfilled;
  // priceOnRequest items have price=0 — show "Price on request" instead
  // of "$0". Set by the WV scraper for INQUIRE / ON HOLD-no-price pages.
  const displayPrice = item.priceOnRequest ? "Price on request" : fmt(item.price, item.currency || "USD");
  const showUSD = item.currency && item.currency !== "USD" && item.priceUSD && !item.priceOnRequest;
  const priceDropped = !item.priceOnRequest && (item.priceChange || 0) < 0;
  return (
    <div style={{ background: "var(--card-bg)", display: "flex", flexDirection: "column", position: "relative", minWidth: 0, overflow: "hidden" }}>
      <a href={item.url} target="_blank" rel="noopener noreferrer"
        style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column" }}>
        <div style={{ position: "relative", paddingTop: "100%", overflow: "hidden" }}>
          <img src={item.img} alt={item.ref}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy" />
          {item.sold && <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.06em" }}>SOLD</div>}
          {!item.sold && isHidden && <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(120,120,120,0.85)", color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.06em" }}>HIDDEN</div>}
          {isNew && !isHidden && <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(24,95,165,0.92)", color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.06em", fontWeight: 600 }}>NEW</div>}
          {item.currency && item.currency !== "USD" && <div style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 8, padding: "2px 5px", borderRadius: 5 }}>{item.currency}</div>}
        </div>
        <div style={{ padding: compact ? "5px 7px 8px" : "7px 9px 10px" }}>
          <div style={{ fontSize: compact ? 8 : 9, color: "var(--text3)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.source}</div>
          {/* Always reserve 2 lines' worth of height so cards in a grid row
              line up regardless of whether the title wraps. Empty title gets
              a space so the line-height still renders. */}
          <div style={{ fontSize: compact ? 10 : 12, fontWeight: 500, lineHeight: 1.3, marginBottom: 4, color: "var(--text1)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: compact ? 26 : 32 }}>{item.ref || "\u00a0"}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <div style={{ fontSize: compact ? 11 : 13, fontWeight: 500, color: item.sold ? "var(--text2)" : "var(--text1)" }}>{displayPrice}</div>
            {priceDropped && (
              <span title={`Was ${fmt(item.price - item.priceChange, item.currency || "USD")}`} style={{ fontSize: 9, color: "#1b8f3a", fontWeight: 600 }}>
                ↓ {fmt(Math.abs(item.priceChange), item.currency || "USD")}
              </span>
            )}
          </div>
          {/* Always render this line (even invisibly) so GBP cards stay the same height as USD cards — avoids the mixed-size grid on mobile. */}
          <div style={{ fontSize: 9, color: "var(--text3)", minHeight: 12 }}>{showUSD ? `~${fmtUSD(item.priceUSD)}` : "\u00a0"}</div>
        </div>
      </a>
      <div style={{ position: "absolute", top: 6, right: 6, display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); onWish(item); }}
          aria-label="Save"
          style={{ width: 26, height: 26, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: wished ? "rgba(220,38,38,0.88)" : "rgba(0,0,0,0.28)",
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <HeartIcon filled={wished} size={12} />
        </button>
        {onHide && (
          <button onClick={e => { e.preventDefault(); e.stopPropagation(); onHide(item); }}
            aria-label={isHidden ? "Unhide" : "Hide"}
            title={isHidden ? "Unhide" : "Hide from feed"}
            style={{ width: 26, height: 26, borderRadius: "50%", border: "none", cursor: "pointer",
                    background: isHidden ? "rgba(24,95,165,0.88)" : "rgba(0,0,0,0.28)",
                    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: "inherit" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              {isHidden
                ? <><path d="M4 12h16"/><path d="M12 4v16"/></> /* + sign = restore */
                : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> /* X = hide */
              }
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function Chip({ label, active, onClick, blue, count }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 12, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
      fontFamily: "inherit", whiteSpace: "nowrap", border: "none", outline: "none",
      background: active ? "var(--text1)" : "transparent",
      color: active ? "var(--bg)" : blue ? "#185FA5" : "var(--text2)",
      boxShadow: active ? "none" : `inset 0 0 0 0.5px ${blue ? "#185FA5" : "var(--border)"}`,
    }}>
      {label}{count !== undefined ? ` · ${count}` : ""}
    </button>
  );
}

function SidebarChip({ label, active, onClick, blue }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 11, padding: "3px 10px", borderRadius: 20, cursor: "pointer",
      fontFamily: "inherit", whiteSpace: "nowrap", border: "none", outline: "none",
      background: active ? "var(--text1)" : "transparent",
      color: active ? "var(--bg)" : blue ? "#185FA5" : "var(--text2)",
      boxShadow: active ? "none" : `inset 0 0 0 0.5px ${blue ? "#185FA5" : "var(--border)"}`,
      marginBottom: 4, marginRight: 4,
    }}>
      {label}
    </button>
  );
}

export default function Dial() {
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
  const isDragging = useRef(false);
  const dragStart = useRef(0);
  const widthStart = useRef(0);
  // Mobile users can pick 1/2/3 columns from the View popover (top bar).
  // Persisted in localStorage so the choice sticks per-device. Desktop is
  // auto-fluid based on sidebar width — no manual override there.
  const [mobileCols, setMobileCols] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem("dial_mobile_cols") || "3", 10);
      return [1, 2, 3].includes(v) ? v : 3;
    } catch { return 3; }
  });
  useEffect(() => {
    try { localStorage.setItem("dial_mobile_cols", String(mobileCols)); } catch {}
  }, [mobileCols]);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const cols = isMobile ? mobileCols : Math.max(2, Math.round((screenWidth - sidebarWidth) / 180));
  const compact = cols >= 4;

  const [items, setItems] = useState([]);
  const [auctions, setAuctions] = useState([]);
  // Scraped state for tracked auction lots, keyed by URL. The user's own
  // tracked URLs come from Supabase (useTrackedLots); we join those URLs
  // against this object to render lot cards.
  const [trackedLotsState, setTrackedLotsState] = useState({});
  // Sub-tab inside Watchlist > Auction lots: upcoming vs past.
  const [auctionLotSubTab, setAuctionLotSubTab] = useState("upcoming");
  // Top-level toggle on the Watchlist tab between dealer listings and
  // auction lots. Persisted in localStorage so users land back where
  // they left off — auction lots are time-sensitive, so a returning
  // user mid-auction shouldn't have to flip again.
  const [watchTopTab, setWatchTopTab] = useState(() => {
    try {
      const v = localStorage.getItem("dial_watch_top_tab");
      return v === "lots" ? "lots" : "listings";
    } catch { return "listings"; }
  });
  useEffect(() => {
    try { localStorage.setItem("dial_watch_top_tab", watchTopTab); } catch {}
  }, [watchTopTab]);
  // Paste-URL input state for adding a new tracked lot.
  const [lotInputUrl, setLotInputUrl] = useState("");
  const [lotInputError, setLotInputError] = useState("");
  const [lotInputBusy, setLotInputBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState("listings");
  const [filterSources, setFilterSources] = useState([]);
  const [filterBrands, setFilterBrands] = useState([]);
  const [sort, setSort] = useState("date");
  const [search, setSearch] = useState("");
  const [minPriceText, setMinPriceText] = useState("");
  const [maxPriceText, setMaxPriceText] = useState("");
  const [newDays, setNewDays] = useState(0);
  const [page, setPage] = useState(1);
  const [filterRefs, setFilterRefs] = useState([]);
  // Watchlist tab has a [Live | Sold] sub-toggle. "Sold" includes items
  // that have disappeared from the scrape AND items still in the scrape
  // marked sold (Wind Vintage on-hold). Default to Live on each session.
  const [watchSubTab, setWatchSubTab] = useState("live");
  // Available tab toggle: when on, sold/inactive items appear inline with
  // the live ones (with SOLD badges). Useful for reference-history lookups
  // — pick a ref, flip on, see every example we've ever scraped at the
  // last asking price. Replaces the standalone Archive tab.
  const [showSoldHistory, setShowSoldHistory] = useState(false);
  // Hidden listings manager (was the Archive tab's hidden-section, now
  // a modal opened from the user dropdown).
  const [hiddenModalOpen, setHiddenModalOpen] = useState(false);
  // Watchlist + hidden now live server-side (Supabase) per authenticated
  // user. When signed out, these hooks return empty objects and their
  // toggles no-op — we wrap the toggles below to kick off sign-in instead.
  const { items: watchlist, toggle: toggleWatchlist } = useWatchlist(user);
  const { items: hidden,   toggle: toggleHidden    } = useHidden(user);
  // Saved searches are per-user (stored in Supabase). Signed-out visitors
  // get an empty list, and the whole subsection is hidden in watchlistTabJSX.
  const {
    items: userSearches,
    editor: searchEditor,
    setEditor: setSearchEditor,
    startAdd: startAddSearch,
    startEdit: startEditSearch,
    cancel: cancelSearchEdit,
    commit: commitSearch,
    remove: removeSearch,
  } = useSearches(user);
  const { urls: trackedLotUrls, add: addTrackedLot, remove: removeTrackedLot } = useTrackedLots(user);
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
  const [refsExpanded, setRefsExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const observerRef = useRef(null);
  const BRANDS_SHOW = 8;

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
    fetch(LISTINGS_URL)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setItems(d); setLoading(false); })
      .catch(() => { setLoadError(true); setLoading(false); });
    // Auctions load in parallel. Failing silently is fine — the Auctions tab
    // just won't have data, which we handle with an empty-state message.
    fetch(AUCTIONS_URL)
      .then(r => r.ok ? r.json() : [])
      .then(d => setAuctions(Array.isArray(d) ? d : []))
      .catch(() => {});
    // Tracked lots is keyed by URL. Failing silently is fine — empty
    // object means no tracked-lot cards render, which is correct when the
    // file doesn't exist yet (first deployment, or Supabase env vars not
    // set in the Action).
    fetch(TRACKED_LOTS_URL)
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
  const BRANDS = useMemo(() => {
    const counts = {};
    items.filter(i => !i.sold).forEach(i => { counts[i.brand] = (counts[i.brand] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([b]) => b);
  }, [items]);
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
      !i.sold && (filterBrands.length === 0 || filterBrands.includes(i.brand))
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
  const requireSignIn = useCallback(() => {
    if (isAuthConfigured) signInWithGoogle();
  }, [signInWithGoogle]);

  const toggleHide = useCallback((item) => {
    if (!user) { requireSignIn(); return; }
    toggleHidden(item);
  }, [user, toggleHidden, requireSignIn]);

  const toggleFilterRef = (ref) =>
    setFilterRefs(p => p.includes(ref) ? p.filter(x => x !== ref) : [...p, ref]);

  const handleWish = useCallback((item) => {
    if (!user) { requireSignIn(); return; }
    toggleWatchlist(item);
  }, [user, toggleWatchlist, requireSignIn]);

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
    // When `showSoldHistory` is on, sold/inactive items stay in the feed
    // (rendered with the SOLD badge by Card). Otherwise we hide them.
    if (!showSoldHistory) its = its.filter(i => !i.sold);
    its = its.filter(i => !hidden[i.id]);   // drop user-hidden items from Available feed
    if (filterRefs.length > 0) {
      its = its.filter(i => {
        const ref = (i.ref || "").toLowerCase();
        return filterRefs.some(r => ref.includes(r.toLowerCase()));
      });
    }
    if (newDays > 0) its = its.filter(i => daysAgo(freshDate(i)) <= newDays && !i.backfilled);
    if (filterSources.length > 0) its = its.filter(i => filterSources.includes(i.source));
    if (filterBrands.length > 0) its = its.filter(i => filterBrands.includes(i.brand));
    if (search.trim()) {
      const q = search.toLowerCase();
      its = its.filter(i => i.ref.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q));
    }
    if (minPrice > 0) its = its.filter(i => (i.priceUSD || i.price) >= minPrice);
    if (maxPrice < GLOBAL_MAX) its = its.filter(i => (i.priceUSD || i.price) <= maxPrice);
    if (sort === "price-asc") its.sort((a, b) => (a.priceUSD || a.price) - (b.priceUSD || b.price));
    else if (sort === "price-desc") its.sort((a, b) => (b.priceUSD || b.price) - (a.priceUSD || a.price));
    else if (sort === "date-asc") its.sort((a, b) => freshDate(a) < freshDate(b) ? -1 : 1);
    else its.sort((a, b) => freshDate(a) < freshDate(b) ? 1 : -1);
    return its;
  }, [items, filterSources, filterBrands, filterRefs, hidden, search, sort, minPrice, maxPrice, newDays, showSoldHistory]);

  const visible = useMemo(() => allFiltered.slice(0, page * PAGE_SIZE), [allFiltered, page]);
  const hasMore = visible.length < allFiltered.length;

  // Callback ref: because ListingsGrid is defined inside this component, it
  // unmounts/remounts on every render. A plain useRef + useEffect would stop
  // firing after the first page bump. Reattaching the IntersectionObserver
  // inside the ref callback guarantees it's always watching the live DOM node.
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
    // Apply the same source/brand/ref/search filters as Available and Archive,
    // so the sidebar drawer narrows down the watchlist too. Saved entries
    // carry the listing_snapshot fields (source, brand, ref), so the same
    // predicates work here.
    if (filterSources.length > 0) its = its.filter(i => filterSources.includes(i.source));
    if (filterBrands.length > 0)  its = its.filter(i => filterBrands.includes(i.brand));
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
  }, [watchlist, liveStateById, sort, filterSources, filterBrands, filterRefs, search]);

  const watchLive = useMemo(() => watchItems.filter(i => !i._isSold), [watchItems]);
  const watchSold = useMemo(() => watchItems.filter(i =>  i._isSold), [watchItems]);

  // Tracked auction lots: join user's saved URLs against the global
  // scraped state. URLs without scraped data yet show as a placeholder
  // ("Fetching details on next scrape").
  const trackedLots = useMemo(() => {
    return trackedLotUrls.map(url => {
      const data = trackedLotsState[url];
      return data ? { ...data, url } : { url, _pending: true };
    });
  }, [trackedLotUrls, trackedLotsState]);

  // Split into upcoming vs past based on auction_end. Pending entries
  // (no scraped data yet) sort with upcoming so the user sees them.
  const nowMs = Date.now();
  const lotIsPast = (lot) => {
    if (lot._pending) return false;
    if (!lot.auction_end) return false;
    return new Date(lot.auction_end).getTime() < nowMs;
  };
  const trackedLotsUpcoming = useMemo(
    () => trackedLots.filter(l => !lotIsPast(l)).sort((a, b) =>
      (a.auction_end || "9").localeCompare(b.auction_end || "9")),
    [trackedLots]
  );
  const trackedLotsPast = useMemo(
    () => trackedLots.filter(lotIsPast).sort((a, b) =>
      (b.auction_end || "").localeCompare(a.auction_end || "")),
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

  // Group auctions by "YYYY-MM" for the month-banded view. Auctions without
  // a parseable start date go into a "Date TBD" bucket at the end.
  // IMPORTANT: this useMemo must stay above the early-return guards
  // (loading/loadError) so React sees the same hook count every render.
  const auctionGroups = useMemo(() => {
    const buckets = new Map();
    for (const a of auctions) {
      const key = a.dateStart ? a.dateStart.slice(0, 7) : "tbd";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(a);
    }
    const keys = [...buckets.keys()].sort((a, b) => {
      if (a === "tbd") return 1;
      if (b === "tbd") return -1;
      return a < b ? -1 : 1;
    });
    return keys.map(key => {
      const items = buckets.get(key).slice().sort((a, b) =>
        (a.dateStart || "").localeCompare(b.dateStart || "") ||
        a.house.localeCompare(b.house)
      );
      let label = "Date TBD";
      if (key !== "tbd") {
        const [y, m] = key.split("-").map(Number);
        label = new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
      }
      return { key, label, items };
    });
  }, [auctions]);

  const resetFilters = () => { setFilterSources([]); setFilterBrands([]); setFilterRefs([]); setSearch(""); setNewDays(0); setMinPriceText(""); setMaxPriceText(""); };

  const visibleBrands = brandsExpanded ? BRANDS : BRANDS.slice(0, BRANDS_SHOW);
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
      <button onClick={() => setShowUserMenu(o => !o)} aria-label="Account menu"
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
  // render. Function components defined inside Dial() get a new reference per
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
      {REFS.length > 0 && (
        <div style={{ padding: "12px 16px 8px" }}>
          <div style={sectionHeadingStyle}>Reference</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {visibleRefs.map(r => <SidebarChip key={r} label={r} active={filterRefs.includes(r)} onClick={() => toggleFilterRef(r)} />)}
            {REFS.length > REFS_SHOW && <SidebarChip label={refsExpanded ? "Less ↑" : `+${REFS.length - REFS_SHOW} more`} active={false} onClick={() => setRefsExpanded(!refsExpanded)} blue />}
          </div>
        </div>
      )}
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
  // Saved searches aren't their own tab — they render as a subsection at the
  // top of the Watchlist tab (see watchlistTabJSX below). This just handles
  // the "tap a search chip → jump to Available with the query applied".
  const runSearch = (s) => { setSearch(s.query); setSort("date"); setTab("listings"); setPage(1); };

  // Inline editor row for add/edit. Rendered as a JSX helper (not a sub-
  // component) so React doesn't remount the inputs on every parent re-render
  // and lose focus mid-keystroke.
  const renderSearchEditor = () => (
    <div style={{
      padding: "12px 14px", borderRadius: 12,
      border: "0.5px solid var(--border)", background: "var(--card-bg)",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <input
        autoFocus
        value={searchEditor.label}
        onChange={e => setSearchEditor(ed => ({ ...ed, label: e.target.value }))}
        placeholder="Name (e.g. Speedmaster)"
        style={{ ...inp, fontSize: 14 }}
      />
      <input
        value={searchEditor.query}
        onChange={e => setSearchEditor(ed => ({ ...ed, query: e.target.value }))}
        placeholder="Search terms (e.g. 145.022)"
        style={{ ...inp, fontSize: 14 }}
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={cancelSearchEdit} style={{
          border: "0.5px solid var(--border)", background: "transparent", color: "var(--text2)",
          padding: "6px 12px", borderRadius: 6, cursor: "pointer",
          fontFamily: "inherit", fontSize: 13,
        }}>Cancel</button>
        <button onClick={commitSearch} style={{
          border: "none", background: "#185FA5", color: "#fff",
          padding: "6px 12px", borderRadius: 6, cursor: "pointer",
          fontFamily: "inherit", fontSize: 13,
        }}>Save</button>
      </div>
    </div>
  );

  // ── GRIDS ─────────────────────────────────────────────────────────────────
  const ListingsGrid = () => (
    <>
      <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
        {visible.map(item => <Card key={item.id} item={item} wished={!!watchlist[item.id]} onWish={handleWish} compact={compact} onHide={toggleHide} isHidden={!!hidden[item.id]} />)}
        {allFiltered.length === 0 && <div style={{ gridColumn: "1/-1", padding: 48, textAlign: "center", color: "var(--text3)", fontSize: 14 }}>No watches match your filters</div>}
      </div>
      {hasMore && <div ref={loaderRef} style={{ padding: 24, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>Loading more...</div>}
      {!hasMore && allFiltered.length > 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>All {allFiltered.length} shown</div>}
    </>
  );

  // Hidden listings manager modal. Accessed from the user dropdown.
  // Lets the user un-hide items they previously dismissed.
  const hiddenModalJSX = hiddenModalOpen ? (
    <div onClick={() => setHiddenModalOpen(false)} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg)", borderRadius: 14,
        border: "0.5px solid var(--border)",
        padding: 18, maxWidth: 720, width: "100%", maxHeight: "80vh",
        overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text1)" }}>
            Hidden listings · {hiddenItems.length}
          </div>
          <button onClick={() => setHiddenModalOpen(false)} aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text2)", fontSize: 22, lineHeight: 1, padding: 4 }}>
            ×
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 14 }}>
          Items you've hidden from the Available feed. Tap × on any to restore it.
        </div>
        {hiddenItems.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
            Nothing hidden.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {hiddenItems.map(item => (
              <Card
                key={item.id}
                item={item}
                wished={!!watchlist[item.id]}
                onWish={handleWish}
                compact={true}
                onHide={toggleHide}
                isHidden={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null;

  const auctionsTabJSX = (
    auctions.length === 0 ? (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🔨</div>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No auctions on the calendar yet</div>
        <div style={{ fontSize: 12, color: "var(--text2)", maxWidth: 340, margin: "0 auto", lineHeight: 1.5 }}>
          Currently pulling from Antiquorum and Monaco Legend. Phillips, Christie's, Sotheby's, Bonhams, Loupe This and Watches of Knightsbridge are on the roadmap.
        </div>
      </div>
    ) : (
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 14 }}>
          {auctions.filter(a => a.status === "live").length > 0
            ? `${auctions.filter(a => a.status === "live").length} live now · ${auctions.filter(a => a.status === "upcoming").length} upcoming`
            : `${auctions.length} upcoming`}
        </div>

        {auctionGroups.map(group => (
          <div key={group.key} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
                color: "var(--text2)", background: "var(--surface)",
                borderRadius: 4, padding: "3px 8px",
              }}>{group.label}</span>
              <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {group.items.map(a => {
                const isLive = a.status === "live";
                // "New catalog" chip: catalog URL first appeared within the
                // last 7 days. Signals "this is newly actionable".
                const catalogAgeDays = a.catalogLiveAt
                  ? Math.floor((Date.now() - new Date(a.catalogLiveAt).getTime()) / 86400000)
                  : null;
                const catalogJustOpened = catalogAgeDays !== null && catalogAgeDays <= 7;
                return (
                  <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
                     style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                             padding: "14px 16px", borderRadius: 12,
                             border: "0.5px solid var(--border)", background: "var(--card-bg)",
                             textDecoration: "none", color: "inherit", fontFamily: "inherit" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                        {isLive && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#fff", background: "#c43", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.05em" }}>LIVE</span>
                        )}
                        {a.hasCatalog && (
                          <span style={{ fontSize: 10, fontWeight: 500, color: catalogJustOpened ? "#fff" : "#185FA5", background: catalogJustOpened ? "#185FA5" : "transparent", border: catalogJustOpened ? "none" : "0.5px solid #185FA5", borderRadius: 4, padding: "1px 6px" }}>
                            {catalogJustOpened ? "NEW CATALOG" : "Catalog"}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{a.house}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text2)" }}>
                        {a.dateLabel || a.dateStart || "Date TBD"}{a.location ? ` · ${a.location}` : ""}
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginLeft: 10 }}><path d="M9 18l6-6-6-6"/></svg>
                  </a>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 24, padding: "14px 16px", borderRadius: 12, border: "0.5px dashed var(--border)" }}>
          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--text1)" }}>Coming in future updates:</strong> Phillips, Christie's, Sotheby's, Bonhams, Watches of Knightsbridge auctions, Loupe This. Lot-level catalogue browsing and watched-lot price tracking are also on the list.
          </div>
        </div>
      </div>
    )
  );

  // Watchlist tab now stacks two subsections:
  //   1. Saved searches (tap to run a search in Available)
  //   2. Hearted listings with their saved price
  // Inline JSX const (not a function component) to avoid remount-on-render
  // bugs the way the other tabs do.
  // Import banner for legacy localStorage data. Fires importLocalData(),
  // which upserts into Supabase; on success we clear the browser keys so
  // the banner goes away and we don't nag on future visits.
  const runImport = async () => {
    if (!user) return;
    setImportState("working");
    const res = await importLocalData(user, legacyLocal);
    if (res.error) {
      setImportState("available");
      alert("Import failed: " + res.error);
      return;
    }
    try {
      localStorage.removeItem(LEGACY_WATCHLIST_KEY);
      localStorage.removeItem(LEGACY_HIDDEN_KEY);
    } catch {}
    setImportState("done");
    // Reload the page so the hooks re-fetch from Supabase with the imported
    // rows in place. Simpler than plumbing an explicit "refresh" into the
    // hooks for this one-shot operation.
    window.location.reload();
  };
  const legacyCounts = {
    watchlist: Object.keys(legacyLocal.watchlist).length,
    hidden:    Object.keys(legacyLocal.hidden).length,
  };
  const importBannerJSX = (user && importState === "available" &&
                          (legacyCounts.watchlist + legacyCounts.hidden > 0)) ? (
    <div style={{
      border: "0.5px solid #185FA5", borderRadius: 12,
      background: "var(--surface)", padding: 14, marginBottom: 20,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", marginBottom: 4 }}>
        Import from this browser
      </div>
      <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, marginBottom: 10 }}>
        We found {legacyCounts.watchlist} saved {legacyCounts.watchlist === 1 ? "watch" : "watches"}
        {legacyCounts.hidden ? ` and ${legacyCounts.hidden} hidden listing${legacyCounts.hidden === 1 ? "" : "s"}` : ""} in
        this browser's local storage (from before accounts existed). Move them to your account
        so you can see them on every device.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={runImport} style={{
          padding: "7px 14px", borderRadius: 8, border: "none",
          background: "#185FA5", color: "#fff", cursor: "pointer",
          fontFamily: "inherit", fontSize: 13, fontWeight: 500,
        }}>Import now</button>
        <button onClick={() => {
          // "No thanks" clears the legacy localStorage keys so the banner
          // doesn't keep nagging on every visit. The user has explicitly
          // chosen not to import this browser's pre-account data.
          try {
            localStorage.removeItem(LEGACY_WATCHLIST_KEY);
            localStorage.removeItem(LEGACY_HIDDEN_KEY);
          } catch {}
          setImportState("done");
        }} style={{
          padding: "7px 14px", borderRadius: 8,
          border: "0.5px solid var(--border)",
          background: "transparent", color: "var(--text2)", cursor: "pointer",
          fontFamily: "inherit", fontSize: 13, fontWeight: 500,
        }}>No thanks</button>
      </div>
    </div>
  ) : null;

  // Reusable signed-out prompt — shown on Searches and Watchlist tabs
  // when the user isn't signed in. Both tabs need an account for any of
  // their content (saved searches, watchlist) to make sense.
  const signInPromptJSX = (heading, blurb) => (
    <div style={{ padding: "60px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>♡</div>
      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>{heading}</div>
      <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 340, margin: "0 auto 18px" }}>
        {blurb}
      </div>
      {isAuthConfigured && (
        <button onClick={signInWithGoogle} style={{
          padding: "8px 16px", borderRadius: 8, border: "0.5px solid var(--border)",
          background: "var(--card-bg)", color: "var(--text1)", cursor: "pointer",
          fontFamily: "inherit", fontSize: 13, fontWeight: 500,
        }}>Sign in with Google</button>
      )}
    </div>
  );

  const searchesTabJSX = !user ? signInPromptJSX(
    "Sign in to use saved searches",
    "Save searches and run them with one tap. Your list syncs across every device you use."
  ) : (
    <div style={{ paddingTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>Tap to run · pencil to edit</div>
        {!searchEditor && (
          <button onClick={startAddSearch} style={{
            border: "0.5px solid var(--border)", background: "var(--card-bg)", color: "var(--text1)",
            padding: "5px 12px", borderRadius: 8, cursor: "pointer",
            fontFamily: "inherit", fontSize: 12,
          }}>+ Add search</button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {searchEditor && searchEditor.id === "new" && renderSearchEditor()}

        {savedSearchStats.map((s) => (
          searchEditor && searchEditor.id === s.id ? (
            <div key={s.id}>{renderSearchEditor()}</div>
          ) : (
            <div key={s.id} style={{
              display: "flex", alignItems: "stretch",
              borderRadius: 12, overflow: "hidden",
              border: "0.5px solid var(--border)", background: "var(--card-bg)",
            }}>
              <button onClick={() => runSearch(s)} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px", border: "none", background: "transparent",
                cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: "inherit",
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text1)", marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)" }}>{s.count} for sale{s.query && s.query !== s.label ? ` · "${s.query}"` : ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {s.newCount > 0 && (
                    <div style={{ fontSize: 11, fontWeight: 500, color: "#fff", background: "#185FA5", borderRadius: 10, padding: "2px 8px" }}>{s.newCount} new</div>
                  )}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </div>
              </button>
              <div style={{ display: "flex", alignItems: "center", borderLeft: "0.5px solid var(--border)" }}>
                <button onClick={() => startEditSearch(s)} title="Edit" style={{
                  border: "none", background: "transparent", color: "var(--text2)",
                  padding: "0 12px", height: "100%", cursor: "pointer", fontFamily: "inherit", fontSize: 14,
                }}>✎</button>
                <button onClick={() => { if (window.confirm(`Delete "${s.label}"?`)) removeSearch(s.id); }} title="Delete" style={{
                  border: "none", borderLeft: "0.5px solid var(--border)",
                  background: "transparent", color: "var(--text2)",
                  padding: "0 12px", height: "100%", cursor: "pointer", fontFamily: "inherit", fontSize: 14,
                }}>✕</button>
              </div>
            </div>
          )
        ))}

        {savedSearchStats.length === 0 && !searchEditor && (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
            No saved searches yet. Tap <b>+ Add search</b> to create one.
          </div>
        )}
      </div>
    </div>
  );

  // Friendly relative-time label like "3 days left" / "6 hours left" /
  // "ended 2 days ago". Computed fresh on render — no need to scrape.
  const fmtCountdown = (endIso) => {
    if (!endIso) return "";
    const ms = new Date(endIso).getTime() - Date.now();
    const past = ms < 0;
    const abs = Math.abs(ms);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor((abs % 86400000) / 3600000);
    const mins = Math.floor((abs % 3600000) / 60000);
    let label;
    if (days >= 1) label = `${days} day${days === 1 ? "" : "s"}`;
    else if (hours >= 1) label = `${hours} hour${hours === 1 ? "" : "s"}`;
    else label = `${mins} min${mins === 1 ? "" : "s"}`;
    return past ? `ended ${label} ago` : `${label} left`;
  };

  const fmtLotPrice = (val, currency) => {
    if (val === null || val === undefined || val === "") return null;
    const n = typeof val === "number" ? val : parseFloat(val);
    if (Number.isNaN(n)) return null;
    return `${currency || ""} ${Math.round(n).toLocaleString()}`.trim();
  };

  // Inline editor row for the paste-URL flow. Rendered inside the Auction
  // lots subsection. Submitting an invalid URL surfaces the validation
  // error inline rather than via alert().
  const submitTrackedLot = async () => {
    if (!lotInputUrl.trim()) return;
    setLotInputBusy(true);
    setLotInputError("");
    const { error } = await addTrackedLot(lotInputUrl);
    setLotInputBusy(false);
    if (error) {
      setLotInputError(error);
    } else {
      setLotInputUrl("");
    }
  };

  // One auction-lot card. Pending state shows just the URL until the
  // scraper fills in details on the next cron run.
  const renderLotCard = (lot) => {
    if (lot._pending) {
      return (
        <div key={lot.url} style={{
          border: "0.5px solid var(--border)", borderRadius: 12,
          background: "var(--card-bg)", padding: 14,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ width: 60, height: 60, borderRadius: 8, background: "var(--surface)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>Pending</div>
            <div style={{ fontSize: 11, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {lot.url}
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
              Details fetch on next scrape (within ~12 hours).
            </div>
          </div>
          <button onClick={() => removeTrackedLot(lot.url)} aria-label="Remove" title="Stop tracking"
            style={{ flexShrink: 0, background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 18, padding: 6 }}>×</button>
        </div>
      );
    }

    const isPast = lotIsPast(lot);
    const sold = lot.sold_price !== null && lot.sold_price !== undefined && lot.sold_price !== "";
    const currentBid = lot.current_bid;
    const estimateLow = fmtLotPrice(lot.estimate_low, lot.currency);
    const estimateHigh = fmtLotPrice(lot.estimate_high, lot.currency);
    const estimate = (estimateLow && estimateHigh) ? `Est. ${estimateLow} – ${estimateHigh}` : null;
    const liveBid = sold
      ? `Hammer ${fmtLotPrice(lot.sold_price, lot.currency)}`
      : (currentBid !== null && currentBid !== undefined && currentBid !== ""
          ? `Bid ${fmtLotPrice(currentBid, lot.currency)}`
          : (lot.starting_price !== null && lot.starting_price !== undefined
              ? `Start ${fmtLotPrice(lot.starting_price, lot.currency)}`
              : null));
    // USD equivalent for non-USD lots — keeps the native amount as the
    // primary number and shows the conversion underneath, same pattern
    // as GBP listings on the Available tab.
    const showUsd = lot.currency && lot.currency.toUpperCase() !== "USD";
    const usdEquiv = showUsd && (
      sold ? lot.sold_price_usd
        : (currentBid !== null && currentBid !== undefined && currentBid !== ""
           ? lot.current_bid_usd
           : (lot.estimate_low_usd && lot.estimate_high_usd
              ? `${Math.round(lot.estimate_low_usd).toLocaleString()} – ${Math.round(lot.estimate_high_usd).toLocaleString()}`
              : lot.starting_price_usd))
    );
    const usdLabel = showUsd && usdEquiv
      ? (typeof usdEquiv === "number" ? `~$${Math.round(usdEquiv).toLocaleString()}` : `~$${usdEquiv}`)
      : null;

    return (
      <div key={lot.url} style={{
        border: "0.5px solid var(--border)", borderRadius: 12,
        background: "var(--card-bg)", overflow: "hidden",
        display: "flex", alignItems: "stretch",
      }}>
        <a href={lot.url} target="_blank" rel="noopener noreferrer"
          style={{ width: 88, flexShrink: 0, background: "var(--surface)", display: "block" }}>
          {lot.image && (
            <img src={lot.image} alt={lot.title || ""}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          )}
        </a>
        <a href={lot.url} target="_blank" rel="noopener noreferrer"
          style={{ flex: 1, minWidth: 0, padding: "10px 12px",
                  display: "flex", flexDirection: "column", justifyContent: "center",
                  textDecoration: "none", color: "inherit" }}>
          <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
            {lot.house}{lot.lot_number ? ` · Lot ${lot.lot_number}` : ""}
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", lineHeight: 1.3, marginBottom: 4,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {lot.title || "—"}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            {liveBid && (
              <span style={{ fontSize: 12, fontWeight: 500, color: sold ? "#1b8f3a" : "var(--text1)" }}>{liveBid}</span>
            )}
            {estimate && (
              <span style={{ fontSize: 11, color: "var(--text3)" }}>{estimate}</span>
            )}
          </div>
          {usdLabel && (
            <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{usdLabel}</div>
          )}
          {lot.auction_end && (
            <div style={{ fontSize: 11, color: isPast ? "var(--text3)" : "#185FA5", marginTop: 4 }}>
              {fmtCountdown(lot.auction_end)}
            </div>
          )}
        </a>
        <button onClick={() => removeTrackedLot(lot.url)} aria-label="Remove" title="Stop tracking"
          style={{ flexShrink: 0, background: "none", border: "none", borderLeft: "0.5px solid var(--border)",
                  color: "var(--text3)", cursor: "pointer", fontSize: 16, padding: "0 12px" }}>×</button>
      </div>
    );
  };

  const watchlistTabJSX = (
    <div>
      {importBannerJSX}
      {!user ? signInPromptJSX(
        "Sign in to see your watchlist",
        "Heart any listing to save it here. Saved items sync across every device you use."
      ) : (
        <>
          {/* Top-level toggle between dealer listings and auction lots.
              Auction lots are time-sensitive (countdowns), so making
              them one tap away rather than a long scroll matters. */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            {[
              ["listings", `Listings${watchCount > 0 ? ` · ${watchCount}` : ""}`],
              ["lots",     `Auction lots${trackedLots.length > 0 ? ` · ${trackedLots.length}` : ""}`],
            ].map(([key, label]) => (
              <button key={key} onClick={() => setWatchTopTab(key)} style={{
                flex: 1, padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 13,
                background: watchTopTab === key ? "var(--text1)" : "var(--surface)",
                color: watchTopTab === key ? "var(--bg)" : "var(--text2)",
                fontWeight: watchTopTab === key ? 500 : 400,
              }}>{label}</button>
            ))}
          </div>

          {watchTopTab === "listings" && (<>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text2)" }}>Watchlist</div>
            {watchCount > 0 && (
              <span style={{ fontSize: 11, color: "var(--text3)" }}>
                {watchLive.length} live · {watchSold.length} sold
              </span>
            )}
          </div>
          {watchCount === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>♡</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>No watches saved yet</div>
              <div style={{ fontSize: 12, color: "var(--text2)" }}>Tap the heart on any listing to save it here</div>
            </div>
          ) : (
            <>
              {/* Live / Sold sub-tab. Sold = items the dealer has pulled or
                  marked sold; live = still listed and for sale. The saved
                  snapshot is the durable record for both — you keep the
                  image, title, and price you saved at even after a dealer
                  takes the URL down. */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {[["live", `Live · ${watchLive.length}`], ["sold", `Sold · ${watchSold.length}`]].map(([key, label]) => (
                  <button key={key} onClick={() => setWatchSubTab(key)} style={{
                    padding: "5px 12px", borderRadius: 16, border: "none", cursor: "pointer",
                    fontFamily: "inherit", fontSize: 12,
                    background: watchSubTab === key ? "var(--text1)" : "var(--surface)",
                    color: watchSubTab === key ? "var(--bg)" : "var(--text2)",
                    fontWeight: watchSubTab === key ? 500 : 400,
                  }}>{label}</button>
                ))}
              </div>
              {(() => {
                const view = watchSubTab === "sold" ? watchSold : watchLive;
                const totalForView = watchSubTab === "sold"
                  ? Object.values(watchlist).filter(it => {
                      const live = liveStateById.get(it.id);
                      return !live || !!live.sold;
                    }).length
                  : Object.values(watchlist).filter(it => {
                      const live = liveStateById.get(it.id);
                      return live && !live.sold;
                    }).length;
                return (
                  <>
                    {view.length !== totalForView && (
                      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10 }}>
                        {view.length} of {totalForView} matching filters
                      </div>
                    )}
                    <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
                      {view.map(item => (
                        <Card
                          key={item.id}
                          item={{
                            ...item,
                            price: item.savedPrice,
                            currency: item.savedCurrency || "USD",
                            priceUSD: item.savedPriceUSD || item.savedPrice,
                            // Force the SOLD badge on items in the Sold sub-tab.
                            // The saved snapshot's own `sold` flag reflects state
                            // at save time; we want the current state to win.
                            sold: watchSubTab === "sold",
                          }}
                          wished={true}
                          onWish={handleWish}
                          compact={compact}
                        />
                      ))}
                      {view.length === 0 && (
                        <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
                          {totalForView === 0
                            ? (watchSubTab === "sold"
                                ? "No watchlisted items have sold yet."
                                : "All your saved items have sold or been pulled. Check the Sold tab.")
                            : "No saved watches match your filters"}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "14px 0 0", fontSize: 11, color: "var(--text3)", textAlign: "center" }}>
                      {watchSubTab === "sold"
                        ? "Prices and links shown are from the moment you saved each listing."
                        : "Prices saved at time of adding to watchlist."}
                    </div>
                  </>
                );
              })()}
            </>
          )}
          </>)}

          {watchTopTab === "lots" && (
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text2)" }}>
                Auction lots
              </div>
              {trackedLots.length > 0 && (
                <span style={{ fontSize: 11, color: "var(--text3)" }}>
                  {trackedLotsUpcoming.length} upcoming · {trackedLotsPast.length} past
                </span>
              )}
            </div>
            {/* Paste-URL box. Antiquorum-only for now; the validation
                message inside addTrackedLot will catch other URLs. */}
            <div style={{
              border: "0.5px solid var(--border)", borderRadius: 12,
              background: "var(--card-bg)", padding: 10, marginBottom: 14,
            }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={lotInputUrl}
                  onChange={e => { setLotInputUrl(e.target.value); setLotInputError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") submitTrackedLot(); }}
                  placeholder="Paste an Antiquorum lot URL…"
                  style={{ ...inp, flex: 1, fontSize: 13 }}
                />
                <button onClick={submitTrackedLot} disabled={lotInputBusy || !lotInputUrl.trim()} style={{
                  border: "none", background: "#185FA5", color: "#fff",
                  padding: "8px 14px", borderRadius: 6, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 500,
                  opacity: (lotInputBusy || !lotInputUrl.trim()) ? 0.5 : 1,
                }}>{lotInputBusy ? "Adding…" : "+ Track"}</button>
              </div>
              {lotInputError && (
                <div style={{ fontSize: 11, color: "#c0392b", marginTop: 6 }}>{lotInputError}</div>
              )}
            </div>
            {trackedLots.length === 0 ? (
              <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
                No tracked lots yet. Paste a lot URL above to start.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  {[["upcoming", `Upcoming · ${trackedLotsUpcoming.length}`],
                    ["past", `Past · ${trackedLotsPast.length}`]].map(([key, label]) => (
                    <button key={key} onClick={() => setAuctionLotSubTab(key)} style={{
                      padding: "5px 12px", borderRadius: 16, border: "none", cursor: "pointer",
                      fontFamily: "inherit", fontSize: 12,
                      background: auctionLotSubTab === key ? "var(--text1)" : "var(--surface)",
                      color: auctionLotSubTab === key ? "var(--bg)" : "var(--text2)",
                      fontWeight: auctionLotSubTab === key ? 500 : 400,
                    }}>{label}</button>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(auctionLotSubTab === "past" ? trackedLotsPast : trackedLotsUpcoming).map(renderLotCard)}
                  {(auctionLotSubTab === "past" ? trackedLotsPast : trackedLotsUpcoming).length === 0 && (
                    <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
                      {auctionLotSubTab === "past" ? "No past lots yet." : "No upcoming lots."}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          )}
        </>
      )}
    </div>
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
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reference or brand..." style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, color: "var(--text1)", outline: "none", fontFamily: "inherit", minWidth: 0 }} />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search"
                style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer",
                        color: "var(--text3)", padding: 2, fontFamily: "inherit",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          {tab !== "searches" && (
            <button onClick={() => { setDrawerOpen(true); setSourcePickerOpen(false); }} aria-label="Filters" style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: "0.5px solid var(--border)", background: hasFilters ? "var(--text1)" : "var(--surface)", color: hasFilters ? "var(--bg)" : "var(--text2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FilterIcon />
            </button>
          )}
          {/* "View" button consolidates theme + column count so the top bar
              doesn't have to grow as we add per-device display settings. */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={() => setViewMenuOpen(o => !o)} aria-label="View options"
              style={{ width: 36, height: 36, borderRadius: "50%", border: "0.5px solid var(--border)", background: viewMenuOpen ? "var(--text1)" : "var(--surface)", color: viewMenuOpen ? "var(--bg)" : "var(--text2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
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
              </div>
            )}
          </div>
          {authJSX}
        </div>
        {/* Sort/source/sold/clear pill row — only relevant for tabs that
            have a list to filter. Searches tab doesn't use any of these. */}
        {tab !== "searches" && (
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
          {/* Source pill */}
          {(() => {
            const active = filterSources.length > 0;
            const label = active ? `Source · ${filterSources.length}` : "Source";
            return (
              <button onClick={() => setSourcePickerOpen(!sourcePickerOpen)} style={{
                fontSize: 13, padding: "7px 14px", borderRadius: 20, cursor: "pointer",
                fontFamily: "inherit", whiteSpace: "nowrap", border: "none", outline: "none",
                background: active ? "var(--text1)" : "transparent",
                color: active ? "var(--bg)" : "var(--text2)",
                boxShadow: active ? "none" : "inset 0 0 0 0.5px var(--border)",
              }}>{label} {sourcePickerOpen ? "↑" : "↓"}</button>
            );
          })()}
          {/* Show-sold-history pill — only on Available tab. Off by default. */}
          {tab === "listings" && (
            <button onClick={() => setShowSoldHistory(s => !s)} style={{
              fontSize: 13, padding: "7px 14px", borderRadius: 20, cursor: "pointer",
              fontFamily: "inherit", whiteSpace: "nowrap", border: "none", outline: "none",
              background: showSoldHistory ? "var(--text1)" : "transparent",
              color: showSoldHistory ? "var(--bg)" : "var(--text2)",
              boxShadow: showSoldHistory ? "none" : "inset 0 0 0 0.5px var(--border)",
            }}>{showSoldHistory ? "Sold ✓" : "Sold"}</button>
          )}
          {/* Persistent reset button — sits next to the sort pills so users
              don't have to open the filter drawer to clear everything. Only
              rendered when there's actually something to clear. */}
          {hasFilters && (
            <button onClick={resetFilters} style={{
              marginLeft: "auto",
              fontSize: 13, padding: "7px 12px", borderRadius: 20, cursor: "pointer",
              fontFamily: "inherit", whiteSpace: "nowrap",
              border: "none", outline: "none",
              background: "transparent", color: "#185FA5",
              boxShadow: "inset 0 0 0 0.5px #185FA5",
            }}>× Clear</button>
          )}
        </div>
        )}
        {/* Source picker dropdown */}
        {tab !== "searches" && sourcePickerOpen && (
          <div style={{ borderBottom: "0.5px solid var(--border)", padding: "8px 14px 10px", background: "var(--surface)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SOURCES.map(s => (
                <button key={s} onClick={() => toggleSource(s)} style={{
                  fontSize: 13, padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                  fontFamily: "inherit", border: "none", outline: "none",
                  background: filterSources.includes(s) ? "var(--text1)" : "var(--bg)",
                  color: filterSources.includes(s) ? "var(--bg)" : "var(--text2)",
                  boxShadow: filterSources.includes(s) ? "none" : "inset 0 0 0 0.5px var(--border)",
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        </div>
        <div style={{ padding: "12px 14px 100px" }}>
          {tab === "listings" ? <ListingsGrid /> : tab === "auctions" ? auctionsTabJSX : tab === "searches" ? searchesTabJSX : watchlistTabJSX}
        </div>
        {/* Bottom tab bar. The container reserves the iOS home-indicator
            safe area PLUS a fixed extra padding, so the buttons aren't
            hugging the home bar when the app is launched standalone from
            the home screen. */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "var(--bg)", borderTop: "0.5px solid var(--border)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}>
          {[["listings", "Available"], ["auctions", "Auctions"], ["searches", "Searches"], ["watchlist", "Watchlist"]].map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); if (key === "listings") setSearch(""); }} style={{ flex: 1, padding: "12px 0 14px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 14, color: tab === key ? "var(--text1)" : "var(--text3)", fontWeight: tab === key ? 500 : 400 }}>
              {tab === key && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#185FA5", margin: "0 auto 4px" }} />}
              {label}
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
                  <div style={sectionHeadingStyle}>Source</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {SOURCES.map(s => <Chip key={s} label={s} active={filterSources.includes(s)} onClick={() => toggleSource(s)} />)}
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

              {/* Fixed bottom actions */}
              <div style={{ borderTop: "0.5px solid var(--border)", padding: "12px 16px", background: "var(--bg)" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...sectionHeadingStyle, marginBottom: 6 }}>Sort</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[["date", "Newest"], ["price-asc", "Price ↑"], ["price-desc", "Price ↓"]].map(([val, label]) => (
                        <Chip key={val} label={label} active={sort === val} onClick={() => setSort(val)} />
                      ))}
                    </div>
                  </div>
                </div>
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
        {hiddenModalJSX}
      </div>
    );
  }

  // ── DESKTOP ───────────────────────────────────────────────────────────────
  // Sidebar can be collapsed via the top-left toggle. When collapsed, the
  // entire sidebar div is omitted — the grid expands to fill the window.
  const sidebarToggleJSX = (
    <button onClick={() => setSidebarCollapsed(c => !c)} aria-label={sidebarCollapsed ? "Show filters" : "Hide filters"}
      title={sidebarCollapsed ? "Show filters" : "Hide filters"}
      style={{
        flexShrink: 0, width: 32, height: 32, borderRadius: 8,
        border: "0.5px solid var(--border)", background: "var(--surface)",
        color: "var(--text2)", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
  );

  return (
    <div style={{ ...baseStyle, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Full-width top bar: hamburger | Watchlist title | tabs |
          centered search | count | dark | auth. Sits above both the
          sidebar and the content area so the title is always visible
          even when the sidebar is collapsed. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "0.5px solid var(--border)", flexShrink: 0 }}>
        {tab !== "searches" && sidebarToggleJSX}
        {/* Watchlist title doubles as a "home" link — click to jump to
            Available. */}
        <button onClick={() => { setTab("listings"); setPage(1); }}
          style={{ background: "none", border: "none", cursor: "pointer",
                  padding: 0, fontFamily: "inherit",
                  fontSize: 18, fontWeight: 500, letterSpacing: "-0.5px",
                  color: "var(--text1)", flexShrink: 0 }}>
          Watchlist
        </button>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, marginLeft: 4 }}>
          {[["listings", "Available"], ["auctions", "Auctions"], ["searches", "Searches"], ["watchlist", "Watchlist"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, background: tab === key ? "var(--text1)" : "var(--surface)", color: tab === key ? "var(--bg)" : "var(--text2)", fontWeight: tab === key ? 500 : 400 }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", borderRadius: 8, padding: "7px 12px", width: "100%", maxWidth: 420 }}>
            <SearchIcon />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reference or brand..." style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, color: "var(--text1)", outline: "none", fontFamily: "inherit", minWidth: 0 }} />
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
        {tab === "listings" && (
          <button onClick={() => setShowSoldHistory(s => !s)}
            title={showSoldHistory ? "Hide sold history" : "Include sold listings inline"}
            style={{
              flexShrink: 0, padding: "5px 10px", borderRadius: 16,
              border: "0.5px solid var(--border)", cursor: "pointer", fontFamily: "inherit", fontSize: 12,
              background: showSoldHistory ? "var(--text1)" : "var(--surface)",
              color: showSoldHistory ? "var(--bg)" : "var(--text2)",
            }}>
            {showSoldHistory ? "Hide sold" : "Show sold"}
          </button>
        )}
        <span style={{ fontSize: 12, color: "var(--text3)", flexShrink: 0 }}>{allFiltered.length}</span>
        <button onClick={() => setDarkOverride(dark ? false : true)} aria-label="Toggle dark mode"
          title={dark ? "Switch to light" : "Switch to dark"}
          style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: 8,
            border: "0.5px solid var(--border)", background: "var(--surface)",
            color: "var(--text2)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
        </button>
        {authJSX}
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar hides automatically on the Searches tab — none of the
            sort/source/brand/ref/price filters apply to a saved-searches
            list. Auctions and Watchlist still get the sidebar (filters
            apply to Watchlist; we'll revisit Auctions in the filter
            consolidation pass). */}
        {!sidebarCollapsed && tab !== "searches" && (
          <div style={{ width: sidebarWidth, flexShrink: 0, borderRight: "0.5px solid var(--border)", overflowY: "auto", display: "flex", flexDirection: "column", position: "relative" }}>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {sidebarFilterPanelJSX}
            </div>
            <div onMouseDown={onDragStart} style={{ position: "absolute", top: 0, right: -3, width: 6, height: "100%", cursor: "col-resize", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 2, height: 32, borderRadius: 1, background: "var(--border)", opacity: 0.8 }} />
            </div>
          </div>
        )}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 32px" }}>
          {tab === "listings" ? <ListingsGrid /> : tab === "auctions" ? auctionsTabJSX : tab === "searches" ? searchesTabJSX : watchlistTabJSX}
        </div>
      </div>
      {hiddenModalJSX}
    </div>
  );
}
