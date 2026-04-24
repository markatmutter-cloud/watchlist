import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";

const LISTINGS_URL = "https://raw.githubusercontent.com/markatmutter-cloud/Dial/main/public/listings.json";
const AUCTIONS_URL = "https://raw.githubusercontent.com/markatmutter-cloud/Dial/main/public/auctions.json";
const PAGE_SIZE = 48;
const STORAGE_KEY = "dial_watchlist_v2";
const GLOBAL_MAX = 600000;
const CURRENCY_SYM = { USD: "$", GBP: "£", EUR: "€", CHF: "CHF " };
const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 520;
const SIDEBAR_DEFAULT_FRACTION = 0.25;   // start at 25% of window width
function initialSidebarWidth() {
  if (typeof window === "undefined") return 280;
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(window.innerWidth * SIDEBAR_DEFAULT_FRACTION)));
}
// Saved searches are currently a fixed list, read-only from the app's
// perspective. Per-user persistence (editing, adding, removing) is deferred
// until Supabase + Google auth lands — without accounts, edits get stuck in
// one device's localStorage and get confusing fast. To change this list,
// edit SAVED_SEARCHES and push a new build.
const SAVED_SEARCHES = [
  { id: "seed-speedmaster",  label: "Speedmaster",        query: "Speedmaster" },
  { id: "seed-railmaster",   label: "Railmaster",         query: "Railmaster" },
  { id: "seed-jackies",      label: "Jackie's DateJust",  query: "DateJust"    },
];

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
function loadWL() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveWL(wl) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(wl)); } catch {}
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

function Card({ item, wished, onWish, compact }) {
  const isNew = daysAgo(freshDate(item)) <= 1 && !item.sold;
  const displayPrice = fmt(item.price, item.currency || "USD");
  const showUSD = item.currency && item.currency !== "USD" && item.priceUSD;
  const priceDropped = (item.priceChange || 0) < 0;
  return (
    <div style={{ background: "var(--card-bg)", display: "flex", flexDirection: "column", position: "relative" }}>
      <a href={item.url} target="_blank" rel="noopener noreferrer"
        style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column" }}>
        <div style={{ position: "relative", paddingTop: "100%", overflow: "hidden" }}>
          <img src={item.img} alt={item.ref}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy" />
          {item.sold && <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.06em" }}>SOLD</div>}
          {isNew && <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(24,95,165,0.92)", color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.06em", fontWeight: 600 }}>NEW</div>}
          {item.currency && item.currency !== "USD" && <div style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 8, padding: "2px 5px", borderRadius: 5 }}>{item.currency}</div>}
        </div>
        <div style={{ padding: compact ? "5px 7px 8px" : "7px 9px 10px" }}>
          <div style={{ fontSize: compact ? 8 : 9, color: "var(--text3)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.source}</div>
          <div style={{ fontSize: compact ? 10 : 12, fontWeight: 500, lineHeight: 1.3, marginBottom: 4, color: "var(--text1)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.ref}</div>
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
      <button onClick={e => { e.preventDefault(); e.stopPropagation(); onWish(item); }}
        style={{ position: "absolute", top: 0, right: 0, width: 44, height: 44, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: "7px 7px 0 0" }}>
        <div style={{ background: wished ? "rgba(220,38,38,0.88)" : "rgba(0,0,0,0.28)", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
          <HeartIcon filled={wished} size={12} />
        </div>
      </button>
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
  const dark = darkOverride !== null ? darkOverride : sysDark;

  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
  const isDragging = useRef(false);
  const dragStart = useRef(0);
  const widthStart = useRef(0);
  const cols = isMobile ? 3 : Math.max(2, Math.round((screenWidth - sidebarWidth) / 180));
  const compact = cols >= 4;

  const [items, setItems] = useState([]);
  const [auctions, setAuctions] = useState([]);
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
  const [watchlist, setWatchlist] = useState(loadWL);
  const [wishSort, setWishSort] = useState("saved");
  const [brandsExpanded, setBrandsExpanded] = useState(false);
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

  // Desktop and mobile both use the same text-input model for price filtering
  // now (sliders kept breaking mid-drag because SidebarFilterPanel remounts
  // on every parent render — a refactor-to-top-level is the real fix and
  // lives on the open-issues list).
  const minPrice = minPriceText ? (parseInt(minPriceText.replace(/[^0-9]/g, "")) || 0) : 0;
  const maxPrice = maxPriceText ? (parseInt(maxPriceText.replace(/[^0-9]/g, "")) || GLOBAL_MAX) : GLOBAL_MAX;

  useEffect(() => { setPage(1); }, [filterSources, filterBrands, search, sort, newDays, minPriceText, maxPriceText]);

  const handleWish = useCallback((item) => {
    setWatchlist(prev => {
      const next = { ...prev };
      if (next[item.id]) { delete next[item.id]; }
      else { next[item.id] = { ...item, savedAt: new Date().toISOString(), savedPrice: item.price, savedCurrency: item.currency || "USD", savedPriceUSD: item.priceUSD }; }
      saveWL(next);
      return next;
    });
  }, []);

  const toggleSource = s => setFilterSources(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const toggleBrand = b => setFilterBrands(p => p.includes(b) ? p.filter(x => x !== b) : [...p, b]);

  const newCounts = useMemo(() => {
    const fs = items.filter(i => !i.sold);
    return {
      1: fs.filter(i => daysAgo(freshDate(i)) <= 1).length,
      3: fs.filter(i => daysAgo(freshDate(i)) <= 3).length,
      7: fs.filter(i => daysAgo(freshDate(i)) <= 7).length,
    };
  }, [items]);

  const allFiltered = useMemo(() => {
    let its = [...items];
    its = its.filter(i => !i.sold);
    if (newDays > 0) its = its.filter(i => daysAgo(freshDate(i)) <= newDays);
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
    else if (sort === "date-asc") its.sort((a, b) => (freshDate(a) < freshDate(b) ? -1 : 1));
    else its.sort((a, b) => (freshDate(a) < freshDate(b) ? 1 : -1));
    return its;
  }, [items, filterSources, filterBrands, search, sort, minPrice, maxPrice, newDays]);

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

  const watchItems = useMemo(() => {
    let its = Object.values(watchlist);
    if (wishSort === "price-asc") its.sort((a, b) => (a.savedPriceUSD || a.savedPrice) - (b.savedPriceUSD || b.savedPrice));
    else if (wishSort === "price-desc") its.sort((a, b) => (b.savedPriceUSD || b.savedPrice) - (a.savedPriceUSD || a.savedPrice));
    else its.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    return its;
  }, [watchlist, wishSort]);

  // Archive = every sold listing. Two flavors live here:
  //   • Items that disappeared from a source's scrape (truly delisted) —
  //     soldAt is set by merge.py's state-tracking.
  //   • Items the scraper flagged reserved/on-hold (Wind Vintage) — soldAt
  //     is set when merge.py first notices sold=true in the CSV.
  // User treats reserved as sold for price-history purposes. Sorted by
  // soldAt descending; honors search/source/brand filters.
  const archiveItems = useMemo(() => {
    let its = items.filter(i => i.sold);
    if (filterSources.length > 0) its = its.filter(i => filterSources.includes(i.source));
    if (filterBrands.length > 0) its = its.filter(i => filterBrands.includes(i.brand));
    if (search.trim()) {
      const q = search.toLowerCase();
      its = its.filter(i => i.ref.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q));
    }
    its.sort((a, b) => ((a.soldAt || "") < (b.soldAt || "") ? 1 : -1));
    return its;
  }, [items, filterSources, filterBrands, search]);

  const watchCount = Object.keys(watchlist).length;
  const hasFilters = filterSources.length > 0 || filterBrands.length > 0 || search || newDays > 0 || minPriceText || maxPriceText;

  const savedSearchStats = useMemo(() => {
    const forSale = items.filter(i => !i.sold);
    return SAVED_SEARCHES.map(({ id, label, query }) => {
      const q = (query || "").toLowerCase();
      const matches = q
        ? forSale.filter(i => i.ref.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q))
        : [];
      const newCount = matches.filter(i => daysAgo(freshDate(i)) <= 7).length;
      return { id, label, query, count: matches.length, newCount };
    });
  }, [items]);

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

  const resetFilters = () => { setFilterSources([]); setFilterBrands([]); setSearch(""); setNewDays(0); setMinPriceText(""); setMaxPriceText(""); };

  const visibleBrands = brandsExpanded ? BRANDS : BRANDS.slice(0, BRANDS_SHOW);
  const NEW_OPTS = [{ label: "Today", days: 1 }, { label: "3 days", days: 3 }, { label: "This week", days: 7 }];

  const baseStyle = {
    fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',sans-serif",
    WebkitFontSmoothing: "antialiased", minHeight: "100vh",
    background: "var(--bg)", color: "var(--text1)",
    ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v]))
  };
  const gridStyle = { display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 1, background: "var(--border)" };
  const inp = { border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 14, background: "var(--surface)", color: "var(--text1)", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };

  if (loading) return <div style={{ ...baseStyle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text2)" }}>Loading listings...</div>;
  if (loadError) return <div style={{ ...baseStyle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text2)" }}>Could not load listings. Try refreshing.</div>;

  // ── SIDEBAR FILTER PANEL (desktop only) ──────────────────────────────────
  // NOTE: defined as a JSX const rather than a function component so the DOM
  // nodes (especially the price text inputs) aren't rebuilt on every parent
  // render. Function components defined inside Dial() get a new reference per
  // render and React treats them as a new component type — which was killing
  // input focus mid-keystroke.
  const sidebarFilterPanelJSX = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 16px 8px" }}>
        <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 6 }}>Sort</div>
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
        <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 8 }}>Source</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {SOURCES.map(s => <SidebarChip key={s} label={s} active={filterSources.includes(s)} onClick={() => toggleSource(s)} />)}
        </div>
      </div>
      <div style={{ height: "0.5px", background: "var(--border)", margin: "0 12px" }} />
      <div style={{ padding: "12px 16px 8px" }}>
        <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 8 }}>Brand</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {visibleBrands.map(b => <SidebarChip key={b} label={b} active={filterBrands.includes(b)} onClick={() => toggleBrand(b)} />)}
          {BRANDS.length > BRANDS_SHOW && <SidebarChip label={brandsExpanded ? "Less ↑" : `+${BRANDS.length - BRANDS_SHOW} more`} active={false} onClick={() => setBrandsExpanded(!brandsExpanded)} blue />}
        </div>
      </div>
      <div style={{ height: "0.5px", background: "var(--border)", margin: "0 12px" }} />
      <div style={{ padding: "12px 16px 14px" }}>
        <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 8 }}>Price (USD)</div>
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

  // ── SEARCHES TAB ──────────────────────────────────────────────────────────
  const runSearch = (s) => { setSearch(s.query); setSort("date"); setTab("listings"); setPage(1); };

  // Read-only view of saved searches. Add/Edit/Delete is intentionally hidden
  // until we have per-user persistence (Supabase + Google login) — without
  // accounts, edits from any visitor would affect only their own browser's
  // localStorage, which is confusing. Edits to the seeded list are done by
  // changing DEFAULT_SEARCHES in this file and pushing a new build.
  const savedTabJSX = (
    <div style={{ paddingTop: 4 }}>
      <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 14 }}>
        Tap a search to run it in the feed
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {savedSearchStats.map((s) => (
          <button key={s.id} onClick={() => runSearch(s)} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px", borderRadius: 12,
            border: "0.5px solid var(--border)", background: "var(--card-bg)",
            cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text1)", marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: "var(--text2)" }}>{s.count} for sale{s.query && s.query !== s.label ? ` · "${s.query}"` : ""}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              {s.newCount > 0 && (
                <div style={{ fontSize: 11, fontWeight: 500, color: "#fff", background: "#185FA5", borderRadius: 10, padding: "2px 8px" }}>
                  {s.newCount} new
                </div>
              )}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // ── GRIDS ─────────────────────────────────────────────────────────────────
  const ListingsGrid = () => (
    <>
      <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
        {visible.map(item => <Card key={item.id} item={item} wished={!!watchlist[item.id]} onWish={handleWish} compact={compact} />)}
        {allFiltered.length === 0 && <div style={{ gridColumn: "1/-1", padding: 48, textAlign: "center", color: "var(--text3)", fontSize: 14 }}>No watches match your filters</div>}
      </div>
      {hasMore && <div ref={loaderRef} style={{ padding: 24, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>Loading more...</div>}
      {!hasMore && allFiltered.length > 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>All {allFiltered.length} shown</div>}
    </>
  );

  const archiveGridJSX = (
    archiveItems.length === 0 ? (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>⌛</div>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No archived listings yet</div>
        <div style={{ fontSize: 12, color: "var(--text2)", maxWidth: 320, margin: "0 auto", lineHeight: 1.5 }}>
          Listings that disappear from a dealer's site land here with the last price we saw them at. As more items cycle through, you can search for a reference and see how asking prices have moved over time.
        </div>
      </div>
    ) : (
      <>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", fontSize: 12, color: "var(--text3)" }}>
          <span>{archiveItems.length} archived</span>
          <span style={{ color: "var(--text3)" }}>· sorted by date delisted</span>
        </div>
        <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
          {archiveItems.map(item => (
            <Card key={item.id} item={item} wished={!!watchlist[item.id]} onWish={handleWish} compact={compact} />
          ))}
        </div>
        <div style={{ padding: "14px 0 0", fontSize: 11, color: "var(--text3)", textAlign: "center", lineHeight: 1.5 }}>
          Price shown is the last asking price before the listing disappeared. Dealers don't publish sale prices, so this is the best proxy for the market.
        </div>
      </>
    )
  );

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

  const WatchlistGrid = () => (
    watchCount === 0 ? (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>♡</div>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Your watchlist is empty</div>
        <div style={{ fontSize: 13, color: "var(--text2)" }}>Tap the heart on any listing to save it here</div>
      </div>
    ) : (
      <>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>{watchCount} saved</span>
          <div style={{ display: "flex", gap: 6 }}>
            {[["saved", "Recent"], ["price-asc", "Price ↑"], ["price-desc", "Price ↓"]].map(([val, label]) => (
              <Chip key={val} label={label} active={wishSort === val} onClick={() => setWishSort(val)} />
            ))}
          </div>
        </div>
        <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
          {watchItems.map(item => (
            <Card key={item.id} item={{ ...item, price: item.savedPrice, currency: item.savedCurrency || "USD", priceUSD: item.savedPriceUSD || item.savedPrice }} wished={true} onWish={handleWish} compact={compact} />
          ))}
        </div>
        <div style={{ padding: "14px 0 0", fontSize: 11, color: "var(--text3)", textAlign: "center" }}>Prices saved at time of adding to watchlist</div>
      </>
    )
  );

  // ── MOBILE ────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={baseStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 8px", borderBottom: "0.5px solid var(--border)" }}>
          <span style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.5px" }}>Watchlist</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>{allFiltered.length}</span>
            <button onClick={() => { setDrawerOpen(true); setSourcePickerOpen(false); }} style={{ width: 32, height: 32, borderRadius: "50%", border: "0.5px solid var(--border)", background: hasFilters ? "var(--text1)" : "var(--surface)", color: hasFilters ? "var(--bg)" : "var(--text2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FilterIcon />
            </button>
            <button onClick={() => setDarkOverride(dark ? false : true)} style={{ width: 32, height: 32, borderRadius: "50%", border: "0.5px solid var(--border)", background: "var(--surface)", color: "var(--text2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            </button>
          </div>
        </div>
        <div style={{ padding: "8px 14px", borderBottom: "0.5px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", borderRadius: 10, padding: "8px 12px" }}>
            <SearchIcon />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reference or brand..." style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, color: "var(--text1)", outline: "none", fontFamily: "inherit" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, padding: "8px 14px", borderBottom: "0.5px solid var(--border)", position: "relative" }}>
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
                if (sort === "price-asc") setSort("price-desc");
                else if (sort === "price-desc") setSort("date");
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
        </div>
        {/* Source picker dropdown */}
        {sourcePickerOpen && (
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
        <div style={{ padding: "12px 14px 80px" }}>
          {tab === "listings" ? <ListingsGrid /> : tab === "saved" ? savedTabJSX : tab === "auctions" ? auctionsTabJSX : tab === "archive" ? archiveGridJSX : <WatchlistGrid />}
        </div>
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "var(--bg)", borderTop: "0.5px solid var(--border)", paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
          {[["listings", "Feed"], ["saved", "Searches"], ["auctions", `Auctions${auctions.filter(a => a.status === "live").length > 0 ? ` · ${auctions.filter(a => a.status === "live").length}` : ""}`], ["archive", "Archive"], ["watchlist", `Watchlist${watchCount > 0 ? ` · ${watchCount}` : ""}`]].map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); if (key === "listings") setSearch(""); }} style={{ flex: 1, padding: "10px 0 12px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 14, color: tab === key ? "var(--text1)" : "var(--text3)", fontWeight: tab === key ? 500 : 400 }}>
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
                  <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 8 }}>Source</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {SOURCES.map(s => <Chip key={s} label={s} active={filterSources.includes(s)} onClick={() => toggleSource(s)} />)}
                  </div>
                </div>
                <div style={{ height: "0.5px", background: "var(--border)", margin: "0 16px 0" }} />

                <div style={{ padding: "10px 16px 10px" }}>
                  <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 8 }}>Brand</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {visibleBrands.map(b => <Chip key={b} label={b} active={filterBrands.includes(b)} onClick={() => toggleBrand(b)} />)}
                    {BRANDS.length > BRANDS_SHOW && <Chip label={brandsExpanded ? "Less ↑" : `+${BRANDS.length - BRANDS_SHOW} more`} active={false} onClick={() => setBrandsExpanded(!brandsExpanded)} blue />}
                  </div>
                </div>
                <div style={{ height: "0.5px", background: "var(--border)", margin: "0 16px 0" }} />

                <div style={{ padding: "10px 16px 10px" }}>
                  <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 8 }}>Price range</div>
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
                    <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 6 }}>Sort</div>
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
      </div>
    );
  }

  // ── DESKTOP ───────────────────────────────────────────────────────────────
  return (
    <div style={{ ...baseStyle, display: "flex", height: "100vh", overflow: "hidden" }}>
      <div style={{ width: sidebarWidth, flexShrink: 0, borderRight: "0.5px solid var(--border)", overflowY: "auto", display: "flex", flexDirection: "column", position: "relative" }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: "0.5px solid var(--border)", flexShrink: 0 }}>
          <span style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.5px" }}>Watchlist</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {sidebarFilterPanelJSX}
        </div>
        <div style={{ padding: "10px 16px 14px", borderTop: "0.5px solid var(--border)", flexShrink: 0 }}>
          <button onClick={() => setDarkOverride(dark ? false : true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 11 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            {dark ? "Light" : "Dark"}
          </button>
        </div>
        <div onMouseDown={onDragStart} style={{ position: "absolute", top: 0, right: -3, width: 6, height: "100%", cursor: "col-resize", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 2, height: 32, borderRadius: 1, background: "var(--border)", opacity: 0.8 }} />
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "0.5px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, background: "var(--surface)", borderRadius: 8, padding: "7px 12px" }}>
            <SearchIcon />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reference or brand..." style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, color: "var(--text1)", outline: "none", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {[["listings", "Feed"], ["saved", "Searches"], ["auctions", `Auctions${auctions.filter(a => a.status === "live").length > 0 ? ` · ${auctions.filter(a => a.status === "live").length}` : ""}`], ["archive", "Archive"], ["watchlist", `Watchlist${watchCount > 0 ? ` · ${watchCount}` : ""}`]].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{ padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, background: tab === key ? "var(--text1)" : "var(--surface)", color: tab === key ? "var(--bg)" : "var(--text2)", fontWeight: tab === key ? 500 : 400 }}>
                {label}
              </button>
            ))}
            <span style={{ fontSize: 12, color: "var(--text3)", paddingLeft: 4 }}>{allFiltered.length}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 32px" }}>
          {tab === "listings" ? <ListingsGrid /> : tab === "saved" ? savedTabJSX : tab === "auctions" ? auctionsTabJSX : tab === "archive" ? archiveGridJSX : <WatchlistGrid />}
        </div>
      </div>
    </div>
  );
}
