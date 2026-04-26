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

// Small leading icons for the tab buttons. Sized 12 so they sit just
// inside the pill text without stealing real estate.
function TabIcon({ kind }) {
  const props = { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none",
                  stroke: "currentColor", strokeWidth: 2,
                  strokeLinecap: "round", strokeLinejoin: "round" };
  if (kind === "listings") return (
    <svg {...props}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
  );
  if (kind === "auctions") return (
    <svg {...props}><path d="M14 12.5L7 19.5"/><path d="m20 4-8 8"/>
      <path d="m17 1-7 7 5 5 7-7-5-5z"/><path d="M3 21h12"/></svg>
  );
  if (kind === "searches") return (
    <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
  );
  if (kind === "watchlist") return (
    <svg {...props}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
  );
  return null;
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
          {/* On-image currency badge removed — currency lives in the
              price text below now (e.g. "£4,500 · ~$5,715"). Keeping
              all the price info in one place reads cleaner. */}
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
  // Inline visibility for the "+ Add lot" input. Default closed so the
  // grid leads with the cards, not the input. Toggled by the "+ Track lot"
  // button in the Auction lots header.
  const [addLotOpen, setAddLotOpen] = useState(false);
  // Sub-tab on the Watchlist tab. Three values: "listings" (dealer
  // items you've hearted), "lots" (tracked auction lots), "searches"
  // (saved searches editor). Persisted in localStorage so a returning
  // user lands back where they left off.
  const [watchTopTab, setWatchTopTab] = useState(() => {
    try {
      const v = localStorage.getItem("dial_watch_top_tab");
      return ["lots", "searches"].includes(v) ? v : "listings";
    } catch { return "listings"; }
  });
  useEffect(() => {
    try { localStorage.setItem("dial_watch_top_tab", watchTopTab); } catch {}
    // Reset scroll on sub-tab change. Without this the page can appear
    // to "jump" when switching from the long Listings grid to the
    // shorter Searches list — the scroll position is preserved but the
    // shorter section sits below where the user was looking.
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
    const desktopMain = document.querySelector("[data-desktop-main]");
    if (desktopMain) desktopMain.scrollTop = 0;
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
  // Single Live ↔ Sold filter shared by Available and Watchlist tabs.
  // false = Live (default), true = Sold. The pill in the filter row
  // toggles it, and both tabs honour it: on Available it switches the
  // grid between live listings and sold/inactive history; on Watchlist
  // it switches the watchlist between items still for sale and ones the
  // dealer has pulled. Same mental model in both places.
  const [showSoldHistory, setShowSoldHistory] = useState(false);
  // Hidden listings manager (was the Archive tab's hidden-section, now
  // a modal opened from the user dropdown).
  const [hiddenModalOpen, setHiddenModalOpen] = useState(false);
  // About + Contact modal. Opened from the View popover so it's
  // available to signed-out visitors too. Contact = Instagram link;
  // no email or form (keeps email out of the bundle and avoids spam).
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
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
    // The "Status" filter is a mutually-exclusive Live vs Sold toggle.
    // Default is Live (current scraped inventory). Sold mode swaps the
    // grid to historical/inactive listings — the analytics view, useful
    // when paired with a brand+ref filter to see price history.
    if (showSoldHistory) its = its.filter(i => i.sold);
    else its = its.filter(i => !i.sold);
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
  // Apply the search filter to lots — title, house, and lot number all
  // match. Wired so the same search box that filters dealer listings on
  // the Watchlist tab also narrows the auction lots.
  const trackedLotsFiltered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return trackedLots;
    return trackedLots.filter(l => {
      if (l._pending) return l.url.toLowerCase().includes(q);
      const haystack = `${l.title || ""} ${l.house || ""} ${l.description || ""} ${l.lot_number || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [trackedLots, search]);
  const trackedLotsUpcoming = useMemo(
    () => sortLots(trackedLotsFiltered.filter(l => !lotIsPast(l)), false),
    [trackedLotsFiltered, sort]
  );
  const trackedLotsPast = useMemo(
    () => sortLots(trackedLotsFiltered.filter(lotIsPast), true),
    [trackedLotsFiltered, sort]
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
  // Walk `visible` and inject divider rows where the age bucket changes.
  // Only kicks in when sorted by date (newest or oldest first) and not
  // viewing sold history — date sort is what makes time-bucketing
  // meaningful. Other sorts (price) get a flat grid as before.
  const ageBucketLabel = (i) => {
    const d = daysAgo(freshDate(i));
    if (d <= 1) return "Today";
    if (d <= 3) return "Last 3 days";
    if (d <= 7) return "This week";
    return "Older";
  };
  const visibleWithDividers = (() => {
    if (showSoldHistory || !(sort === "date" || sort === "date-asc") || visible.length === 0) {
      return visible.map(it => ({ kind: "card", item: it }));
    }
    const out = [];
    let last = null;
    for (const it of visible) {
      const bucket = ageBucketLabel(it);
      if (bucket !== last) {
        // Count how many of allFiltered (not just visible) fall in this
        // bucket so the label shows the true total per age band, not just
        // what's currently rendered.
        const total = allFiltered.filter(x => ageBucketLabel(x) === bucket).length;
        out.push({ kind: "divider", label: bucket, total });
        last = bucket;
      }
      out.push({ kind: "card", item: it });
    }
    return out;
  })();

  const ListingsGrid = () => (
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
          {showSoldHistory ? "No sold listings match your filters" : "No watches match your filters"}
        </div>}
      </div>
      {hasMore && <div ref={loaderRef} style={{ padding: 24, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>Loading more...</div>}
      {!hasMore && allFiltered.length > 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>All {allFiltered.length} shown</div>}
    </>
  );

  // Hidden listings manager modal. Accessed from the user dropdown.
  // Lets the user un-hide items they previously dismissed.
  const aboutModalJSX = aboutModalOpen ? (
    <div onClick={() => setAboutModalOpen(false)} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg)", borderRadius: 14,
        border: "0.5px solid var(--border)",
        padding: 22, maxWidth: 440, width: "100%", maxHeight: "85vh",
        overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text1)" }}>About Watchlist</div>
          <button onClick={() => setAboutModalOpen(false)} aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text2)", fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginBottom: 18 }}>
          A personal aggregator for vintage watch listings from a handful of dealers I follow,
          plus tracked auction lots from a couple of houses. Passion project — no revenue, no
          affiliate links, no tracking. Listings link straight back to the dealers.
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          Get in touch
        </div>
        <a href="https://instagram.com/lagunabeachwatch" target="_blank" rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 14px", borderRadius: 8,
            border: "0.5px solid var(--border)", background: "var(--card-bg)",
            color: "var(--text1)", textDecoration: "none",
            fontFamily: "inherit", fontSize: 14, fontWeight: 500,
          }}>
          {/* Instagram glyph */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
          </svg>
          @lagunabeachwatch
        </a>
      </div>
    </div>
  ) : null;

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

  // Pretty month-band heading: turn "2026-05" into "May 2026". Falls
  // through gracefully on the synthetic "tbd" key.
  const fmtMonthBand = (key) => {
    if (key === "tbd") return "Date TBD";
    const [y, m] = key.split("-");
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const idx = parseInt(m, 10) - 1;
    if (idx < 0 || idx > 11) return key;
    return `${months[idx]} ${y}`;
  };

  // Compact date block on the left side of each auction card. Renders the
  // start day large with the month abbreviation under it (calendar
  // affordance). For "Date TBD" entries shows a small placeholder.
  const renderAuctionDateBlock = (a) => {
    if (!a.dateStart) {
      return (
        <div style={{
          width: 56, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em",
          borderRight: "0.5px solid var(--border)",
        }}>TBD</div>
      );
    }
    const d = new Date(a.dateStart);
    const day = d.getUTCDate();
    const monthAbbrev = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()];
    return (
      <div style={{
        width: 56, flexShrink: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "6px 0", borderRight: "0.5px solid var(--border)",
      }}>
        <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1, color: "var(--text1)" }}>{day}</div>
        <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4, fontWeight: 600 }}>
          {monthAbbrev}
        </div>
      </div>
    );
  };

  const auctionsTabJSX = (
    auctions.length === 0 ? (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🔨</div>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No auctions on the calendar yet</div>
        <div style={{ fontSize: 12, color: "var(--text2)", maxWidth: 340, margin: "0 auto", lineHeight: 1.5 }}>
          Currently pulling from Antiquorum, Monaco Legend, Phillips, and Bonhams. Christie's, Sotheby's, Loupe This and Watches of Knightsbridge are on the roadmap.
        </div>
      </div>
    ) : (
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 18 }}>
          {auctions.filter(a => a.status === "live").length > 0
            ? `${auctions.filter(a => a.status === "live").length} live now · ${auctions.filter(a => a.status === "upcoming").length} upcoming`
            : `${auctions.length} upcoming`}
        </div>

        {auctionGroups.map(group => (
          <div key={group.key} style={{ marginBottom: 28 }}>
            {/* Month band — sentence case, tier-1 weight to read like a
                section heading rather than a chip. */}
            <div style={{
              display: "flex", alignItems: "baseline", gap: 12,
              padding: "0 4px 10px", marginBottom: 10,
              borderBottom: "0.5px solid var(--border)",
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
                {fmtMonthBand(group.key)}
              </span>
              <span style={{ fontSize: 11, color: "var(--text3)", marginLeft: "auto" }}>
                {group.items.length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {group.items.map(a => {
                const isLive = a.status === "live";
                const catalogAgeDays = a.catalogLiveAt
                  ? Math.floor((Date.now() - new Date(a.catalogLiveAt).getTime()) / 86400000)
                  : null;
                const catalogJustOpened = catalogAgeDays !== null && catalogAgeDays <= 7;
                return (
                  <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
                     style={{ display: "flex", alignItems: "stretch",
                             borderRadius: 12, overflow: "hidden",
                             border: "0.5px solid var(--border)", background: "var(--card-bg)",
                             textDecoration: "none", color: "inherit", fontFamily: "inherit",
                             transition: "border-color 120ms ease",
                           }}>
                    {renderAuctionDateBlock(a)}
                    <div style={{ flex: 1, minWidth: 0, padding: "12px 14px",
                                display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                          {a.house}
                        </span>
                        {isLive && (
                          <span style={{ fontSize: 9, fontWeight: 600, color: "#fff", background: "#c43", borderRadius: 3, padding: "1px 6px", letterSpacing: "0.06em" }}>LIVE</span>
                        )}
                        {catalogJustOpened && (
                          <span style={{ fontSize: 9, fontWeight: 600, color: "#fff", background: "#185FA5", borderRadius: 3, padding: "1px 6px", letterSpacing: "0.06em" }}>NEW CATALOG</span>
                        )}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)",
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text2)",
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.dateLabel || a.dateStart || "Date TBD"}
                        {a.location ? ` · ${a.location}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", padding: "0 14px", color: "var(--text3)", flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 24, padding: "14px 16px", borderRadius: 12, border: "0.5px dashed var(--border)" }}>
          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--text1)" }}>Coming in future updates:</strong> Christie's, Sotheby's, Watches of Knightsbridge auctions, Loupe This. Lot-level catalogue browsing and watched-lot price tracking are also on the list.
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
  // Auction lot card — same portrait shape as the regular `Card`
  // component so the Watchlist Listings and Auction lots grids feel
  // consistent. Image on top with countdown badge overlay; below the
  // image: house+lot, title, primary price, sub-line USD/estimate.
  const renderLotCard = (lot) => {
    const isPending = !!lot._pending;
    const isPast = !isPending && lotIsPast(lot);
    const sold = !isPending && lot.sold_price !== null && lot.sold_price !== undefined && lot.sold_price !== "";
    const currentBid = lot.current_bid;
    const showUsd = lot.currency && lot.currency.toUpperCase() !== "USD";

    const primaryNative = isPending ? "—"
      : sold ? fmtLotPrice(lot.sold_price, lot.currency)
      : (currentBid !== null && currentBid !== undefined && currentBid !== ""
          ? fmtLotPrice(currentBid, lot.currency)
          : (lot.starting_price !== null && lot.starting_price !== undefined
              ? fmtLotPrice(lot.starting_price, lot.currency)
              : "—"));
    const primaryLabel = isPending ? "Pending"
      : sold ? "HAMMER"
      : (currentBid !== null && currentBid !== undefined && currentBid !== "" ? "BID" : "START");
    const primaryUsd = !isPending && showUsd && (
      sold ? lot.sold_price_usd
        : (currentBid !== null && currentBid !== undefined && currentBid !== ""
           ? lot.current_bid_usd
           : lot.starting_price_usd)
    );
    const estimateLow = fmtLotPrice(lot.estimate_low, lot.currency);
    const estimateHigh = fmtLotPrice(lot.estimate_high, lot.currency);
    const estimateLine = (estimateLow && estimateHigh) ? `Est. ${estimateLow}–${estimateHigh}` : null;

    const countdownLabel = lot.auction_end ? fmtCountdown(lot.auction_end) : null;
    const countdownColor = isPast ? "rgba(0,0,0,0.55)" : "rgba(24,95,165,0.92)";

    return (
      <div key={lot.url} style={{
        background: "var(--card-bg)", display: "flex", flexDirection: "column",
        position: "relative", minWidth: 0, overflow: "hidden",
      }}>
        <a href={lot.url} target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column" }}>
          <div style={{ position: "relative", paddingTop: "100%", overflow: "hidden", background: "var(--surface)" }}>
            {lot.image && (
              <img src={lot.image} alt={lot.title || ""}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                loading="lazy" />
            )}
            {/* Status pill in top-left: SOLD, ENDED, or countdown. */}
            {sold ? (
              <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.06em" }}>SOLD</div>
            ) : countdownLabel ? (
              <div style={{ position: "absolute", top: 6, left: 6, background: countdownColor, color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.04em", fontWeight: 600 }}>
                {isPast ? "ENDED" : countdownLabel.toUpperCase()}
              </div>
            ) : isPending ? (
              <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.06em" }}>PENDING</div>
            ) : null}
          </div>
          <div style={{ padding: compact ? "5px 7px 8px" : "7px 9px 10px" }}>
            <div style={{ fontSize: compact ? 8 : 9, color: "var(--text3)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {lot.house || "—"}{lot.lot_number ? ` · Lot ${lot.lot_number}` : ""}
            </div>
            <div style={{ fontSize: compact ? 10 : 12, fontWeight: 500, lineHeight: 1.3, marginBottom: 4, color: "var(--text1)",
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: compact ? 26 : 32 }}>
              {lot.title || (isPending ? "Fetching…" : "—")}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 8, color: "var(--text3)", letterSpacing: "0.05em", fontWeight: 600 }}>{primaryLabel}</span>
              <span style={{ fontSize: compact ? 11 : 13, fontWeight: 500, color: sold ? "#1b8f3a" : "var(--text1)" }}>{primaryNative}</span>
            </div>
            {/* Sub-line: USD equivalent of the primary price (when non-USD)
                OR the estimate range when there's no bid yet. Always one
                line tall so the cards line up in the grid. */}
            <div style={{ fontSize: 9, color: "var(--text3)", minHeight: 12 }}>
              {primaryUsd ? `~$${Math.round(primaryUsd).toLocaleString()}` : (estimateLine || " ")}
            </div>
          </div>
        </a>
        {/* × stop-tracking, top-right where the heart sits on regular cards. */}
        <button onClick={() => removeTrackedLot(lot.url)} aria-label="Stop tracking" title="Stop tracking"
          style={{
            position: "absolute", top: 6, right: 6,
            width: 22, height: 22, borderRadius: "50%",
            background: "rgba(255,255,255,0.92)", border: "none", cursor: "pointer",
            color: "#444", fontSize: 14, lineHeight: 1, padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
          }}>×</button>
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
          <div style={{
            display: "flex", marginBottom: 18,
            borderBottom: "0.5px solid var(--border)",
            // Stay visible while scrolling. On desktop the closest
            // scrolling ancestor is the right-pane (data-desktop-main),
            // so top: 0 anchors to that. On mobile the body scrolls —
            // the page sticky stack above is ~92px tall, so sit below
            // that.
            position: "sticky",
            top: isMobile ? 92 : 0,
            background: "var(--bg)",
            zIndex: 15,
            paddingTop: isMobile ? 8 : 4,
          }}>
            {[
              ["listings", `Listings${watchCount > 0 ? ` · ${watchCount}` : ""}`],
              ["lots",     `Auction lots${trackedLots.length > 0 ? ` · ${trackedLots.length}` : ""}`],
              ["searches", `Searches${userSearches.length > 0 ? ` · ${userSearches.length}` : ""}`],
            ].map(([key, label]) => (
              // Subordinate to the top tabs above: underline-style instead
              // of a filled pill so the visual hierarchy reads
              // tab → sub-tab clearly.
              <button key={key} onClick={() => setWatchTopTab(key)} style={{
                padding: "6px 0", marginRight: 18, border: "none", cursor: "pointer",
                background: "transparent", fontFamily: "inherit", fontSize: 14,
                color: watchTopTab === key ? "var(--text1)" : "var(--text3)",
                fontWeight: watchTopTab === key ? 600 : 400,
                borderBottom: watchTopTab === key ? "2px solid var(--text1)" : "2px solid transparent",
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
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>♡</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>No watches saved yet</div>
              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 320, margin: "0 auto 16px" }}>
                Browse the Available tab and tap the heart on any listing — it'll appear here with the price you saved at, even after the dealer takes the URL down.
              </div>
              <button onClick={() => { setTab("listings"); setPage(1); }} style={{
                padding: "8px 16px", borderRadius: 8, border: "0.5px solid var(--border)",
                background: "var(--card-bg)", color: "var(--text1)", cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 500,
              }}>Browse Available</button>
            </div>
          ) : (
            <>
              {/* Live/Sold split is driven by the Live↔Sold pill in the
                  top filter row (shared with Available). No inner
                  segmented control here anymore. */}
              {(() => {
                const view = showSoldHistory ? watchSold : watchLive;
                const totalForView = showSoldHistory
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
                            // Force the SOLD badge on items in the Sold view.
                            // The saved snapshot's own `sold` flag reflects state
                            // at save time; we want the current state to win.
                            sold: showSoldHistory,
                          }}
                          wished={true}
                          onWish={handleWish}
                          compact={compact}
                        />
                      ))}
                      {view.length === 0 && (
                        <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
                          {totalForView === 0
                            ? (showSoldHistory
                                ? "No watchlisted items have sold yet."
                                : "All your saved items have sold or been pulled. Tap the Live pill above to switch to Sold.")
                            : "No saved watches match your filters"}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "14px 0 0", fontSize: 11, color: "var(--text3)", textAlign: "center" }}>
                      {showSoldHistory
                        ? "Prices and links shown are from the moment you saved each listing."
                        : "Prices saved at time of adding to watchlist."}
                    </div>
                  </>
                );
              })()}
            </>
          )}
          </>)}

          {watchTopTab === "lots" && (() => {
            // Live/Sold for auction lots maps to: Live = still upcoming
            // (auction not yet ended), Sold = past (hammer happened or
            // ended). Same filter pill as Listings, same mental model.
            const lotsView = showSoldHistory ? trackedLotsPast : trackedLotsUpcoming;
            const lotsTotal = showSoldHistory ? trackedLotsPast.length : trackedLotsUpcoming.length;
            return (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>
                    {trackedLots.length === 0
                      ? ""
                      : (showSoldHistory ? `${lotsTotal} past` : `${lotsTotal} upcoming`)}
                  </div>
                  <button onClick={() => { setAddLotOpen(o => !o); setLotInputError(""); }} style={{
                    border: "0.5px solid var(--border)", background: addLotOpen ? "var(--text1)" : "var(--card-bg)",
                    color: addLotOpen ? "var(--bg)" : "var(--text1)",
                    padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 12,
                  }}>{addLotOpen ? "Cancel" : "+ Track lot"}</button>
                </div>

                {/* Inline paste-URL editor — only visible when "+ Track lot"
                    is open. Otherwise the cards lead. */}
                {addLotOpen && (
                  <div style={{
                    border: "0.5px solid var(--border)", borderRadius: 12,
                    background: "var(--card-bg)", padding: 10, marginBottom: 14,
                  }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        autoFocus
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
                      }}>{lotInputBusy ? "Adding…" : "Track"}</button>
                    </div>
                    {lotInputError && (
                      <div style={{ fontSize: 11, color: "#c0392b", marginTop: 6 }}>{lotInputError}</div>
                    )}
                    <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 6 }}>
                      Antiquorum only for now. Lot URL looks like
                      <span style={{ fontFamily: "monospace" }}> live.antiquorum.swiss/lots/view/…</span>
                    </div>
                  </div>
                )}

                {trackedLots.length === 0 ? (
                  <div style={{ padding: "48px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>⌛</div>
                    <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>No tracked lots yet</div>
                    <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 340, margin: "0 auto 16px" }}>
                      Tap <b>+ Track lot</b> above and paste an Antiquorum lot URL. Each tracked lot gets a daily price update, a countdown to the hammer, and the sold price recorded after.
                    </div>
                    <button onClick={() => { setAddLotOpen(true); setLotInputError(""); }} style={{
                      padding: "8px 16px", borderRadius: 8, border: "0.5px solid var(--border)",
                      background: "var(--card-bg)", color: "var(--text1)", cursor: "pointer",
                      fontFamily: "inherit", fontSize: 13, fontWeight: 500,
                    }}>+ Track first lot</button>
                  </div>
                ) : (
                  <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
                    {lotsView.map(renderLotCard)}
                    {lotsView.length === 0 && (
                      <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
                        {showSoldHistory ? "No past lots yet." : "No upcoming lots."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Searches sub-tab — promoted from a top-level tab into the
              Watchlist tab so all per-user content lives in one place. */}
          {watchTopTab === "searches" && searchesTabJSX}
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
          {!(tab === "watchlist" && watchTopTab === "searches") && (
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
        {tab === "watchlist" && watchTopTab === "searches" && (
          <div style={{ height: 41, borderBottom: "0.5px solid var(--border)" }} />
        )}
        {!(tab === "watchlist" && watchTopTab === "searches") && (
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
        {!(tab === "watchlist" && watchTopTab === "searches") && sourcePickerOpen && (
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
          {tab === "listings" ? <ListingsGrid /> : tab === "auctions" ? auctionsTabJSX : watchlistTabJSX}
        </div>
        {/* Bottom tab bar. The container reserves the iOS home-indicator
            safe area PLUS a fixed extra padding, so the buttons aren't
            hugging the home bar when the app is launched standalone from
            the home screen. */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "var(--bg)", borderTop: "0.5px solid var(--border)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}>
          {[["listings", "Available"], ["auctions", "Auctions"], ["watchlist", "Watchlist"]].map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); if (key === "listings") setSearch(""); }} style={{ flex: 1, padding: "12px 0 14px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: tab === key ? "var(--text1)" : "var(--text3)", fontWeight: tab === key ? 500 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
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
        {aboutModalJSX}
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
    // Live/Sold counts reflect the current set of items minus user-hidden
    // ones, but BEFORE the live/sold filter itself is applied. So flipping
    // Live↔Sold doesn't make either count drop to 0.
    const liveTotalForPill = tab === "watchlist"
      ? Object.values(watchlist).filter(it => {
          const live = liveStateById.get(it.id);
          return live && !live.sold;
        }).length
      : items.filter(i => !i.sold && !hidden[i.id]).length;
    const soldTotalForPill = tab === "watchlist"
      ? Object.values(watchlist).filter(it => {
          const live = liveStateById.get(it.id);
          return !live || !!live.sold;
        }).length
      : items.filter(i =>  i.sold && !hidden[i.id]).length;
    return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
                  borderBottom: "0.5px solid var(--border)", flexShrink: 0,
                  flexWrap: "wrap", position: "relative" }}>
      {/* Live ↔ Sold — single pill, click to flip. Always first in the
          row. Counts reflect what's available in each state. */}
      <button onClick={() => setShowSoldHistory(s => !s)} style={pillBase(showSoldHistory)}
        title={showSoldHistory ? "Switch to live listings" : "Switch to sold history"}>
        {showSoldHistory ? `Sold · ${soldTotalForPill}` : `Live · ${liveTotalForPill}`}
      </button>

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

      {/* Price */}
      <div style={{ position: "relative" }}>
        <button onClick={() => setActiveFilterPop(p => p === "price" ? null : "price")} style={pillBase(!!minPriceText || !!maxPriceText)}>
          Price{(minPriceText || maxPriceText) ? ` · ${minPriceText || "0"}–${maxPriceText || "∞"}` : ""} ▾
        </button>
        {activeFilterPop === "price" && popShell(
          <div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Price (USD)</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input value={minPriceText} onChange={e => setMinPriceText(e.target.value)} placeholder="Min" inputMode="numeric"
                style={{ ...inp, fontSize: 13, padding: "6px 8px", flex: 1 }} />
              <span style={{ fontSize: 11, color: "var(--text3)" }}>–</span>
              <input value={maxPriceText} onChange={e => setMaxPriceText(e.target.value)} placeholder="Max" inputMode="numeric"
                style={{ ...inp, fontSize: 13, padding: "6px 8px", flex: 1 }} />
            </div>
            {(minPriceText || maxPriceText) && (
              <button onClick={() => { setMinPriceText(""); setMaxPriceText(""); }} style={{
                marginTop: 8, padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--border)",
                background: "transparent", color: "var(--text2)", cursor: "pointer",
                fontFamily: "inherit", fontSize: 12, width: "100%",
              }}>Clear price</button>
            )}
          </div>
        )}
      </div>

      {/* Source */}
      <div style={{ position: "relative" }}>
        <button onClick={() => setActiveFilterPop(p => p === "source" ? null : "source")} style={pillBase(filterSources.length > 0)}>
          Source{filterSources.length > 0 ? ` · ${filterSources.length}` : ""} ▾
        </button>
        {activeFilterPop === "source" && popShell(
          <div>
            <div style={popGridStyle}>
              {SOURCES.map(s => (
                <button key={s} onClick={() => toggleSource(s)} style={multiSelectRowStyle(filterSources.includes(s))}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s}</span>
                  {filterSources.includes(s) && <span style={tickStyle}>✓</span>}
                </button>
              ))}
            </div>
            {filterSources.length > 0 && (
              <button onClick={() => setFilterSources([])} style={popClearStyle}>Clear sources</button>
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

      {/* Reference (multi-select; refs are scoped by selected brands) */}
      {REFS.length > 0 && (
        <div style={{ position: "relative" }}>
          <button onClick={() => setActiveFilterPop(p => p === "ref" ? null : "ref")} style={pillBase(filterRefs.length > 0)}>
            Reference{filterRefs.length > 0 ? ` · ${filterRefs.length}` : ""} ▾
          </button>
          {activeFilterPop === "ref" && popShell(
            <div>
              <div style={popGridStyle}>
                {REFS.map(r => (
                  <button key={r} onClick={() => toggleFilterRef(r)} style={multiSelectRowStyle(filterRefs.includes(r))}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r}</span>
                    {filterRefs.includes(r) && <span style={tickStyle}>✓</span>}
                  </button>
                ))}
              </div>
              {filterRefs.length > 0 && (
                <button onClick={() => setFilterRefs([])} style={popClearStyle}>Clear refs</button>
              )}
            </div>,
            { wide: true }
          )}
        </div>
      )}

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
        {!(tab === "watchlist" && watchTopTab === "searches") && sidebarToggleJSX}
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
          {[["listings", "Available"], ["auctions", "Auctions"], ["watchlist", "Watchlist"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 13,
              background: tab === key ? "var(--text1)" : "var(--surface)",
              color: tab === key ? "var(--bg)" : "var(--text2)",
              fontWeight: tab === key ? 500 : 400,
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
      {(tab === "listings" || (tab === "watchlist" && watchTopTab !== "searches"))
        ? filterRowJSX
        : (tab === "watchlist"
            ? <div style={{ height: 49, borderBottom: "0.5px solid var(--border)", flexShrink: 0 }} />
            : null)}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* The desktop sidebar previously held all the filters. Replaced
            in the April '26 filter-consolidation pass by the top
            filterRowJSX above. Sidebar markup intentionally retired here;
            the source code (sidebarFilterPanelJSX, sidebarToggleJSX,
            resize handlers) is still defined further up so we can revert
            quickly if the new pattern doesn't pan out. */}
        <div data-desktop-main style={{ flex: 1, overflowY: "auto", padding: "14px 16px 32px" }}>
          {tab === "listings" ? <ListingsGrid /> : tab === "auctions" ? auctionsTabJSX : watchlistTabJSX}
        </div>
      </div>
      {hiddenModalJSX}
        {aboutModalJSX}
    </div>
  );
}
