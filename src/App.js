import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";

const LISTINGS_URL = "https://raw.githubusercontent.com/markatmutter-cloud/Dial/main/public/listings.json";
const PAGE_SIZE = 48;
const STORAGE_KEY = "dial_watchlist_v2";
const GLOBAL_MAX = 600000;
const CURRENCY_SYM = { USD: "$", GBP: "£", EUR: "€" };
const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 380;
const SIDEBAR_DEFAULT = 210;

function fmt(price, currency) {
  return (CURRENCY_SYM[currency] || "$") + price.toLocaleString();
}
function fmtUSD(p) { return "$" + Math.round(p).toLocaleString(); }
function daysAgo(dateStr) {
  if (!dateStr) return 9999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}
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
  const isNew = daysAgo(item.date) <= 7 && !item.sold;
  const displayPrice = fmt(item.price, item.currency || "USD");
  const showUSD = item.currency && item.currency !== "USD" && item.priceUSD;
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
          <div style={{ fontSize: compact ? 11 : 13, fontWeight: 500, color: item.sold ? "var(--text2)" : "var(--text1)" }}>{displayPrice}</div>
          {showUSD && <div style={{ fontSize: 9, color: "var(--text3)" }}>~{fmtUSD(item.priceUSD)}</div>}
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

  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const isDragging = useRef(false);
  const dragStart = useRef(0);
  const widthStart = useRef(0);
  const cols = isMobile ? 3 : Math.max(2, Math.round((screenWidth - sidebarWidth) / 180));
  const compact = cols >= 4;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState("listings");
  const [filterSources, setFilterSources] = useState([]);
  const [filterBrands, setFilterBrands] = useState([]);
  const [sort, setSort] = useState("date");
  const [search, setSearch] = useState("");
  const [maxPos, setMaxPos] = useState(100);
  const [minPriceText, setMinPriceText] = useState("");
  const [maxPriceText, setMaxPriceText] = useState("");
  const [statusFilter, setStatusFilter] = useState("for_sale");
  const [newDays, setNewDays] = useState(0);
  const [page, setPage] = useState(1);
  const [watchlist, setWatchlist] = useState(loadWL);
  const [wishSort, setWishSort] = useState("saved");
  const [brandsExpanded, setBrandsExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const loaderRef = useRef(null);
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

  const priceMax = maxPos >= 100 ? GLOBAL_MAX : logToPrice(maxPos);
  const maxLabel = maxPos >= 100 ? "No limit" : fmtUSD(logToPrice(maxPos));
  const mobileMinPrice = minPriceText ? (parseInt(minPriceText.replace(/[^0-9]/g, "")) || 0) : 0;
  const mobileMaxPrice = maxPriceText ? (parseInt(maxPriceText.replace(/[^0-9]/g, "")) || GLOBAL_MAX) : GLOBAL_MAX;

  useEffect(() => { setPage(1); }, [filterSources, filterBrands, search, sort, maxPos, statusFilter, newDays, minPriceText, maxPriceText]);

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
      1: fs.filter(i => daysAgo(i.date) <= 1).length,
      3: fs.filter(i => daysAgo(i.date) <= 3).length,
      7: fs.filter(i => daysAgo(i.date) <= 7).length,
    };
  }, [items]);

  const allFiltered = useMemo(() => {
    let its = [...items];
    its = its.filter(i => statusFilter === "sold" ? i.sold : !i.sold);
    if (newDays > 0) its = its.filter(i => daysAgo(i.date) <= newDays);
    if (filterSources.length > 0) its = its.filter(i => filterSources.includes(i.source));
    if (filterBrands.length > 0) its = its.filter(i => filterBrands.includes(i.brand));
    if (search.trim()) {
      const q = search.toLowerCase();
      its = its.filter(i => i.ref.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q));
    }
    if (isMobile) {
      if (mobileMinPrice > 0) its = its.filter(i => (i.priceUSD || i.price) >= mobileMinPrice);
      if (mobileMaxPrice < GLOBAL_MAX) its = its.filter(i => (i.priceUSD || i.price) <= mobileMaxPrice);
    } else {
      its = its.filter(i => (i.priceUSD || i.price) <= priceMax);
    }
    if (sort === "price-asc") its.sort((a, b) => (a.priceUSD || a.price) - (b.priceUSD || b.price));
    else if (sort === "price-desc") its.sort((a, b) => (b.priceUSD || b.price) - (a.priceUSD || a.price));
    else its.sort((a, b) => (a.date < b.date ? 1 : -1));
    return its;
  }, [items, filterSources, filterBrands, search, sort, priceMax, statusFilter, newDays, isMobile, mobileMinPrice, mobileMaxPrice]);

  const visible = useMemo(() => allFiltered.slice(0, page * PAGE_SIZE), [allFiltered, page]);
  const hasMore = visible.length < allFiltered.length;

  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(e => { if (e[0].isIntersecting && hasMore) setPage(p => p + 1); }, { threshold: 0.1 });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore]);

  const watchItems = useMemo(() => {
    let its = Object.values(watchlist);
    if (wishSort === "price-asc") its.sort((a, b) => (a.savedPriceUSD || a.savedPrice) - (b.savedPriceUSD || b.savedPrice));
    else if (wishSort === "price-desc") its.sort((a, b) => (b.savedPriceUSD || b.savedPrice) - (a.savedPriceUSD || a.savedPrice));
    else its.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    return its;
  }, [watchlist, wishSort]);

  const watchCount = Object.keys(watchlist).length;
  const forSaleCount = items.filter(i => !i.sold).length;
  const hasFilters = filterSources.length > 0 || filterBrands.length > 0 || search || maxPos < 100 || statusFilter !== "for_sale" || newDays > 0 || minPriceText || maxPriceText;
  const resetFilters = () => { setFilterSources([]); setFilterBrands([]); setSearch(""); setMaxPos(100); setStatusFilter("for_sale"); setNewDays(0); setMinPriceText(""); setMaxPriceText(""); };

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
  const SidebarFilterPanel = () => (
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
        <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 6 }}>View</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {[["for_sale", "For sale", forSaleCount], ["sold", "Sold", items.filter(i => i.sold).length]].map(([val, label, count]) => (
            <button key={val} onClick={() => setStatusFilter(val)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, background: statusFilter === val ? "var(--surface)" : "transparent", color: statusFilter === val ? "var(--text1)" : "var(--text2)", fontWeight: statusFilter === val ? 500 : 400 }}>
              <span>{label}</span><span style={{ fontSize: 11, color: "var(--text3)" }}>{count}</span>
            </button>
          ))}
          <button onClick={() => setTab("watchlist")} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, background: tab === "watchlist" ? "var(--surface)" : "transparent", color: tab === "watchlist" ? "var(--text1)" : "var(--text2)", fontWeight: tab === "watchlist" ? 500 : 400 }}>
            <span>Watchlist</span>
            {watchCount > 0 && <span style={{ fontSize: 11, color: "var(--text3)" }}>{watchCount}</span>}
          </button>
        </div>
      </div>
      <div style={{ height: "0.5px", background: "var(--border)", margin: "0 12px" }} />
      <div style={{ padding: "12px 16px 8px" }}>
        <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 8 }}>New listings</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {NEW_OPTS.map(({ label, days }) => {
            const count = newCounts[days];
            if (!count) return null;
            return <SidebarChip key={days} label={`${label} · ${count}`} active={newDays === days} onClick={() => setNewDays(newDays === days ? 0 : days)} />;
          })}
        </div>
      </div>
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
      <div style={{ padding: "12px 16px 12px" }}>
        <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 8 }}>Max price</div>
        <input type="range" min={0} max={100} step={1} value={maxPos} onChange={e => setMaxPos(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--text1)", marginBottom: 4 }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text3)" }}>
          <span>$500</span><span>{maxLabel}</span>
        </div>
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
          <div>
            <span style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.5px" }}>Dial</span>
            <span style={{ fontSize: 10, color: "var(--text3)", marginLeft: 7 }}>{forSaleCount} for sale</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setDrawerOpen(true)} style={{ width: 32, height: 32, borderRadius: "50%", border: "0.5px solid var(--border)", background: hasFilters ? "var(--text1)" : "var(--surface)", color: hasFilters ? "var(--bg)" : "var(--text2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FilterIcon />
            </button>
            <button onClick={() => setDarkOverride(dark ? false : true)} style={{ width: 32, height: 32, borderRadius: "50%", border: "0.5px solid var(--border)", background: "var(--surface)", color: "var(--text2)", cursor: "pointer", fontSize: 13 }}>
              {dark ? "☀" : "◑"}
            </button>
          </div>
        </div>
        <div style={{ padding: "8px 14px", borderBottom: "0.5px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", borderRadius: 10, padding: "8px 12px" }}>
            <SearchIcon />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reference or brand..." style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, color: "var(--text1)", outline: "none", fontFamily: "inherit" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, padding: "8px 14px", overflowX: "auto", borderBottom: "0.5px solid var(--border)", scrollbarWidth: "none" }}>
          <Chip label="For sale" active={statusFilter === "for_sale"} onClick={() => setStatusFilter("for_sale")} />
          <Chip label="Sold" active={statusFilter === "sold"} onClick={() => setStatusFilter("sold")} />
          {NEW_OPTS.map(({ label, days }) => {
            const count = newCounts[days];
            if (!count) return null;
            return <Chip key={days} label={label} count={count} active={newDays === days} onClick={() => setNewDays(newDays === days ? 0 : days)} blue={newDays !== days} />;
          })}
        </div>
        <div style={{ padding: "12px 14px 80px" }}>
          {tab === "listings" ? <ListingsGrid /> : <WatchlistGrid />}
        </div>
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "var(--bg)", borderTop: "0.5px solid var(--border)", paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
          {[["listings", "Feed"], ["watchlist", `Watchlist${watchCount > 0 ? ` · ${watchCount}` : ""}`]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "10px 0 12px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: tab === key ? "var(--text1)" : "var(--text3)", fontWeight: tab === key ? 500 : 400 }}>
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

                <div style={{ padding: "8px 16px 10px" }}>
                  <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 8 }}>New listings</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {NEW_OPTS.map(({ label, days }) => {
                      const count = newCounts[days];
                      if (!count) return null;
                      return <Chip key={days} label={`${label} · ${count}`} active={newDays === days} onClick={() => setNewDays(newDays === days ? 0 : days)} />;
                    })}
                  </div>
                </div>
                <div style={{ height: "0.5px", background: "var(--border)", margin: "0 16px 0" }} />

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
        <div style={{ padding: "16px 16px 10px", borderBottom: "0.5px solid var(--border)", flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.5px", marginBottom: 2 }}>Dial</div>
          <div style={{ fontSize: 10, color: "var(--text3)" }}>{forSaleCount} for sale · {SOURCES.length} sources</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <SidebarFilterPanel />
        </div>
        <div style={{ padding: "10px 16px 14px", borderTop: "0.5px solid var(--border)", flexShrink: 0 }}>
          <button onClick={() => setDarkOverride(dark ? false : true)} style={{ fontSize: 11, background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontFamily: "inherit" }}>
            {dark ? "Light mode" : "Dark mode"}
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
            <span style={{ fontSize: 12, color: "var(--text3)" }}>{allFiltered.length} watches</span>
            {[["listings", "Feed"], ["watchlist", `Watchlist${watchCount > 0 ? ` · ${watchCount}` : ""}`]].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{ padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, background: tab === key ? "var(--text1)" : "var(--surface)", color: tab === key ? "var(--bg)" : "var(--text2)", fontWeight: tab === key ? 500 : 400 }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 32px" }}>
          {tab === "listings" ? <ListingsGrid /> : <WatchlistGrid />}
        </div>
      </div>
    </div>
  );
}
