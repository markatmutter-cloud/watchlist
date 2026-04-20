import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";

const LISTINGS_URL = "https://raw.githubusercontent.com/markatmutter-cloud/Dial/main/public/listings.json";
const GLOBAL_MAX = 560000;
const PAGE_SIZE = 48;
const STORAGE_KEY = "dial_watchlist_v1";
const CURRENCY_SYMBOLS = { USD: "$", GBP: "£", EUR: "€", JPY: "¥", CNY: "¥" };

function fmt(price, currency) {
  return (CURRENCY_SYMBOLS[currency] || "$") + price.toLocaleString();
}
function fmtUSD(p) { return "$" + p.toLocaleString(); }

function isNew(dateStr, days) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return d >= cutoff;
}

function logToPrice(pos) {
  if (pos >= 100) return GLOBAL_MAX;
  const minLog = Math.log(1000), maxLog = Math.log(GLOBAL_MAX);
  return Math.round(Math.exp(minLog + (pos / 100) * (maxLog - minLog)));
}

function loadWatchlist() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveWatchlist(wl) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(wl)); } catch {}
}

function HeartIcon({ filled }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}

function Card({ item, wished, onWish, c, cols }) {
  const compact = cols >= 5;
  const displayPrice = fmt(item.price, item.currency);
  const newBadge = isNew(item.date, 7) && !item.sold;
  return (
    <div style={{ background: item.sold ? c.surface : c.card, display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      <a href={item.url} target="_blank" rel="noopener noreferrer"
        style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ position: "relative", paddingTop: "100%", overflow: "hidden", flexShrink: 0 }}>
          <img src={item.img} alt={item.ref}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy" />
          {item.sold && (
            <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 9, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.05em" }}>SOLD</div>
          )}
          {newBadge && (
            <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,122,255,0.9)", color: "#fff", fontSize: 9, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.05em", fontWeight: 600 }}>NEW</div>
          )}
          {item.currency && item.currency !== "USD" && (
            <div style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 9, padding: "2px 5px", borderRadius: 6 }}>{item.currency}</div>
          )}
        </div>
        <div style={{ padding: compact ? "6px 8px 10px" : "8px 10px 12px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: compact ? 9 : 10, color: c.text3, marginBottom: 2 }}>{item.source}</div>
            <div style={{ fontSize: compact ? 11 : 13, fontWeight: 500, lineHeight: 1.3, marginBottom: 3 }}>{item.ref}</div>
          </div>
          <div>
            <div style={{ fontSize: compact ? 12 : 15, fontWeight: 700, color: item.sold ? c.text2 : c.text }}>{displayPrice}</div>
            {item.currency && item.currency !== "USD" && item.priceUSD && (
              <div style={{ fontSize: 9, color: c.text3 }}>~{fmtUSD(item.priceUSD)}</div>
            )}
          </div>
        </div>
      </a>
      <button onClick={e => { e.preventDefault(); e.stopPropagation(); onWish(item); }}
        style={{
          position: "absolute", top: 0, right: 0,
          width: 52, height: 52, background: "transparent",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
          padding: "8px 8px 0 0",
        }}>
        <div style={{
          background: wished ? "rgba(220,38,38,0.88)" : "rgba(0,0,0,0.3)",
          borderRadius: "50%", width: 28, height: 28,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", backdropFilter: "blur(4px)", pointerEvents: "none",
        }}>
          <HeartIcon filled={wished} />
        </div>
      </button>
    </div>
  );
}

export default function Dial() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState("listings");
  const [sources, setSources] = useState([]);
  const [brands, setBrands] = useState([]);
  const [sort, setSort] = useState("date");
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPos, setMaxPos] = useState(100);
  const [statusFilter, setStatusFilter] = useState("for_sale");
  const [newDays, setNewDays] = useState(0);
  const [page, setPage] = useState(1);
  const [watchlist, setWatchlist] = useState(loadWatchlist);
  const [wishSort, setWishSort] = useState("saved");
  const [wishBrand, setWishBrand] = useState("All");
  const [brandsExpanded, setBrandsExpanded] = useState(false);
  const [cols, setCols] = useState(3);
  const loaderRef = useRef(null);

  useEffect(() => {
    fetch(LISTINGS_URL)
      .then(r => { if (!r.ok) throw new Error("fetch failed"); return r.json(); })
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => { setLoadError(true); setLoading(false); });
  }, []);

  const BRANDS_VISIBLE = 8;
  const priceMin = minPrice !== "" ? (parseInt(minPrice.replace(/[^0-9]/g,"")) || 0) : 0;
  const priceMax = maxPos >= 100 ? GLOBAL_MAX : logToPrice(maxPos);
  const maxLabel = maxPos >= 100 ? "No limit" : fmtUSD(logToPrice(maxPos));

  const SOURCES = useMemo(() => [...new Set(items.map(i => i.source))].sort(), [items]);
  const BRANDS_ORDERED = useMemo(() => {
    const forSale = items.filter(i => !i.sold);
    const counts = {};
    forSale.forEach(i => { counts[i.brand] = (counts[i.brand] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([b]) => b);
  }, [items]);

  const c = dark ? {
    bg: "#000", surface: "#1c1c1e", card: "#2c2c2e",
    border: "rgba(255,255,255,0.1)", text: "#f5f5f7",
    text2: "#98989d", text3: "#48484a", input: "#2c2c2e", accent: "#0a84ff",
  } : {
    bg: "#fff", surface: "#f5f5f7", card: "#fff",
    border: "rgba(0,0,0,0.08)", text: "#1d1d1f",
    text2: "#6e6e73", text3: "#aeaeb2", input: "#fff", accent: "#007aff",
  };

  useEffect(() => { setPage(1); }, [sources, brands, search, sort, priceMin, maxPos, statusFilter, newDays]);

  const handleWish = useCallback((item) => {
    setWatchlist(prev => {
      const next = { ...prev };
      if (next[item.id]) { delete next[item.id]; }
      else { next[item.id] = { ...item, savedAt: new Date().toISOString(), savedPrice: item.price, savedCurrency: item.currency || "USD", savedPriceUSD: item.priceUSD }; }
      saveWatchlist(next);
      return next;
    });
  }, []);

  const toggleSource = s => setSources(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleBrand = b => setBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);

  const hasFilters = sources.length > 0 || brands.length > 0 || search || minPrice || maxPos < 100 || statusFilter !== "for_sale" || newDays > 0;
  const resetFilters = () => { setSources([]); setBrands([]); setSearch(""); setMinPrice(""); setMaxPos(100); setStatusFilter("for_sale"); setNewDays(0); };

  const newCounts = useMemo(() => {
    const forSale = items.filter(i => !i.sold);
    return {
      1: forSale.filter(i => isNew(i.date, 1)).length,
      3: forSale.filter(i => isNew(i.date, 3)).length,
      7: forSale.filter(i => isNew(i.date, 7)).length,
      30: forSale.filter(i => isNew(i.date, 30)).length,
    };
  }, [items]);

  const allFiltered = useMemo(() => {
    let its = [...items];
    its = its.filter(i => statusFilter === "sold" ? i.sold : !i.sold);
    if (newDays > 0) its = its.filter(i => isNew(i.date, newDays));
    if (sources.length > 0) its = its.filter(i => sources.includes(i.source));
    if (brands.length > 0) its = its.filter(i => brands.includes(i.brand));
    if (search.trim()) {
      const q = search.toLowerCase();
      its = its.filter(i => i.ref.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q));
    }
    const pMin = priceMin, pMax = priceMax;
    its = its.filter(i => (i.priceUSD || i.price) >= pMin && (i.priceUSD || i.price) <= pMax);
    if (sort === "price-asc") its.sort((a, b) => (a.priceUSD||a.price) - (b.priceUSD||b.price));
    else if (sort === "price-desc") its.sort((a, b) => (b.priceUSD||b.price) - (a.priceUSD||a.price));
    else its.sort((a, b) => b.date.localeCompare(a.date));
    return its;
  }, [items, sources, brands, search, sort, priceMin, priceMax, statusFilter, newDays]);

  const visible = useMemo(() => allFiltered.slice(0, page * PAGE_SIZE), [allFiltered, page]);
  const hasMore = visible.length < allFiltered.length;

  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) setPage(p => p + 1);
    }, { threshold: 0.1 });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore]);

  const watchItems = useMemo(() => {
    let its = Object.values(watchlist);
    if (wishBrand !== "All") its = its.filter(i => i.brand === wishBrand);
    if (wishSort === "price-asc") its.sort((a, b) => (a.savedPriceUSD||a.savedPrice) - (b.savedPriceUSD||b.savedPrice));
    else if (wishSort === "price-desc") its.sort((a, b) => (b.savedPriceUSD||b.savedPrice) - (a.savedPriceUSD||a.savedPrice));
    else its.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    return its;
  }, [watchlist, wishSort, wishBrand]);

  const watchBrands = useMemo(() =>
    ["All", ...Array.from(new Set(Object.values(watchlist).map(i => i.brand))).sort()],
    [watchlist]);

  const watchCount = Object.keys(watchlist).length;
  const forSaleCount = items.filter(i => !i.sold).length;
  const soldCount = items.filter(i => i.sold).length;
  const visibleBrands = brandsExpanded ? BRANDS_ORDERED : BRANDS_ORDERED.slice(0, BRANDS_VISIBLE);

  const btn = active => ({
    padding: "6px 14px", borderRadius: 20, fontSize: 13,
    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
    background: active ? c.text : c.surface,
    color: active ? c.bg : c.text2,
    border: `0.5px solid ${active ? c.text : c.border}`,
  });
  const sml = active => ({
    fontSize: 12, padding: "4px 12px", borderRadius: 20,
    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
    background: active ? c.text : "none",
    color: active ? c.bg : c.text3,
    border: `0.5px solid ${active ? c.text : c.border}`,
  });
  const sel = {
    padding: "7px 12px", borderRadius: 20, border: `0.5px solid ${c.border}`,
    background: c.input, color: c.text, fontSize: 13,
    cursor: "pointer", fontFamily: "inherit", outline: "none",
  };
  const inp = {
    padding: "7px 12px", borderRadius: 20, border: `0.5px solid ${c.border}`,
    background: c.input, color: c.text, fontSize: 13,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  const gridCols = `repeat(${cols}, 1fr)`;

  const NEW_OPTIONS = [
    { label: "Today", days: 1 },
    { label: "3 days", days: 3 },
    { label: "This week", days: 7 },
    { label: "This month", days: 30 },
  ];

  if (loading) return (
    <div style={{ background: c.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system,sans-serif", color: c.text2, fontSize: 14 }}>
      Loading listings...
    </div>
  );

  if (loadError) return (
    <div style={{ background: c.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system,sans-serif", color: c.text2, fontSize: 14 }}>
      Could not load listings. Check your connection and try refreshing.
    </div>
  );

  return (
    <div style={{ background: c.bg, minHeight: "100vh", color: c.text, fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',sans-serif", WebkitFontSmoothing: "antialiased" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 12px 48px" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0 14px", borderBottom: `0.5px solid ${c.border}` }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.5px" }}>Dial</span>
            <span style={{ fontSize: 11, color: c.text3, marginLeft: 8 }}>{forSaleCount} for sale · {soldCount} sold · {SOURCES.length} sources</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", border: `0.5px solid ${c.border}`, borderRadius: 20, overflow: "hidden" }}>
              {[3, 4, 5].map(n => (
                <button key={n} onClick={() => setCols(n)} style={{
                  padding: "4px 10px", fontSize: 12, cursor: "pointer",
                  fontFamily: "inherit", border: "none",
                  background: cols === n ? c.text : "none",
                  color: cols === n ? c.bg : c.text3,
                }}>
                  {n}
                </button>
              ))}
            </div>
            <button onClick={() => setDark(!dark)} style={{ background: c.surface, border: `0.5px solid ${c.border}`, borderRadius: 20, padding: "4px 12px", fontSize: 11, color: c.text2, cursor: "pointer" }}>
              {dark ? "Light" : "Dark"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", borderBottom: `0.5px solid ${c.border}`, marginBottom: 16 }}>
          {[["listings", "Listings"], ["watchlist", watchCount > 0 ? `Watchlist · ${watchCount}` : "Watchlist"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              background: "none", border: "none", padding: "10px 0", marginRight: 20,
              fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              color: tab === key ? c.text : c.text2,
              borderBottom: `2px solid ${tab === key ? c.text : "transparent"}`,
              marginBottom: -0.5,
            }}>{label}</button>
          ))}
        </div>

        {tab === "listings" && (<>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {SOURCES.map(s => (
              <button key={s} onClick={() => toggleSource(s)} style={btn(sources.includes(s))}>{s}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
            {[["for_sale", "For sale"], ["sold", "Sold"]].map(([val, label]) => (
              <button key={val} onClick={() => setStatusFilter(val)} style={sml(statusFilter === val)}>{label}</button>
            ))}
            <span style={{ fontSize: 11, color: c.text3, marginLeft: 2 }}>New:</span>
            {NEW_OPTIONS.map(({ label, days }) => {
              const count = newCounts[days];
              if (count === 0) return null;
              const active = newDays === days;
              return (
                <button key={days} onClick={() => setNewDays(active ? 0 : days)} style={{
                  ...sml(active),
                  color: active ? c.bg : c.accent,
                  border: `0.5px solid ${c.accent}`,
                  background: active ? c.accent : "none",
                }}>
                  {label} · {count}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search reference or brand..."
              style={{ ...inp, flex: 1, minWidth: 140 }} />
            <select value={sort} onChange={e => setSort(e.target.value)} style={sel}>
              <option value="date">Newest first</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input value={minPrice} onChange={e => setMinPrice(e.target.value)}
                placeholder="Min $" style={{ ...inp, width: 100, flex: "none" }} />
              <span style={{ fontSize: 12, color: c.text3 }}>to</span>
              <input type="range" min={0} max={100} step={1} value={maxPos}
                onChange={e => setMaxPos(Number(e.target.value))}
                style={{ flex: 1, accentColor: c.text }} />
              <span style={{ fontSize: 12, color: c.text3, minWidth: 60, textAlign: "right" }}>{maxLabel}</span>
              {(minPrice || maxPos < 100) && (
                <button onClick={() => { setMinPrice(""); setMaxPos(100); }}
                  style={{ fontSize: 11, color: c.accent, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {visibleBrands.map(b => (
                <button key={b} onClick={() => toggleBrand(b)} style={sml(brands.includes(b))}>{b}</button>
              ))}
              {BRANDS_ORDERED.length > BRANDS_VISIBLE && (
                <button onClick={() => setBrandsExpanded(!brandsExpanded)} style={{
                  fontSize: 12, padding: "4px 12px", borderRadius: 20,
                  cursor: "pointer", fontFamily: "inherit",
                  background: "none", color: c.accent, border: `0.5px solid ${c.accent}`,
                }}>
                  {brandsExpanded ? "Less ↑" : `+${BRANDS_ORDERED.length - BRANDS_VISIBLE} more ↓`}
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: c.text3 }}>
              {allFiltered.length} watches · showing {visible.length}
            </div>
            {hasFilters && (
              <button onClick={resetFilters} style={{ fontSize: 11, color: c.accent, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                Reset all
              </button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 1, background: c.border, borderRadius: 12, overflow: "hidden" }}>
            {visible.map(item => <Card key={item.id} item={item} wished={!!watchlist[item.id]} onWish={handleWish} c={c} cols={cols} />)}
            {allFiltered.length === 0 && (
              <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: c.text3, fontSize: 14 }}>No watches match your filters</div>
            )}
          </div>
          {hasMore && <div ref={loaderRef} style={{ padding: 24, textAlign: "center", color: c.text3, fontSize: 12 }}>Loading more...</div>}
          {!hasMore && allFiltered.length > 0 && <div style={{ padding: 24, textAlign: "center", color: c.text3, fontSize: 12 }}>All {allFiltered.length} shown</div>}
        </>)}

        {tab === "watchlist" && (
          watchCount === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>♡</div>
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Your watchlist is empty</div>
              <div style={{ fontSize: 13, color: c.text2 }}>Tap the heart on any listing to save it here</div>
            </div>
          ) : (<>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <select value={wishSort} onChange={e => setWishSort(e.target.value)} style={sel}>
                <option value="saved">Most recently saved</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
            </div>
            {watchBrands.length > 2 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {watchBrands.map(b => <button key={b} onClick={() => setWishBrand(b)} style={sml(wishBrand === b)}>{b}</button>)}
              </div>
            )}
            <div style={{ fontSize: 11, color: c.text3, marginBottom: 10 }}>{watchItems.length} saved</div>
            <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 1, background: c.border, borderRadius: 12, overflow: "hidden" }}>
              {watchItems.map(item => (
                <Card key={item.id}
                  item={{ ...item, price: item.savedPrice, currency: item.savedCurrency || "USD", priceUSD: item.savedPriceUSD || item.savedPrice }}
                  wished={true} onWish={handleWish} c={c} cols={cols} />
              ))}
            </div>
            <div style={{ padding: "16px 0 0", fontSize: 11, color: c.text3, textAlign: "center" }}>
              Prices saved at time of watchlist addition
            </div>
          </>)
        )}

      </div>
    </div>
  );
}
