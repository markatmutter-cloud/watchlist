import React, { useState, useMemo, useEffect } from "react";
import { Card } from "./Card";
import { extractRef, imgSrc } from "../utils";
import { importLocalData } from "../supabase";

// Pure helpers — defined at module scope so their identity is stable
// across renders (no remount-on-render issues).

// Friendly relative-time label like "3 days left" / "6 hours left" /
// "ended 2 days ago". Computed fresh on render — no need to scrape.
function fmtCountdown(endIso) {
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
}

function fmtLotPrice(val, currency) {
  if (val === null || val === undefined || val === "") return null;
  const n = typeof val === "number" ? val : parseFloat(val);
  if (Number.isNaN(n)) return null;
  return `${currency || ""} ${Math.round(n).toLocaleString()}`.trim();
}

function lotIsPast(lot) {
  if (lot.sold_price !== null && lot.sold_price !== undefined && lot.sold_price !== "") return true;
  if (!lot.auction_end) return false;
  return new Date(lot.auction_end).getTime() < Date.now();
}

export function WatchlistTab(props) {
  const {
    // Auth
    user, signInWithGoogle, isAuthConfigured,
    // Watchlist data
    watchlist, watchItems, watchLive, watchSold, watchCount,
    toggleWatchlist,
    // Tracked lots
    trackedLots, addTrackedLot, removeTrackedLot, liveStateById,
    // Searches
    savedSearchStats, searchEditor, setSearchEditor,
    startAddSearch, startEditSearch, cancelSearchEdit, commitSearch, removeSearch,
    runSearch,
    // Card
    handleWish,
    // UI shared
    compact, gridStyle, inp, isMobile, statusMode,
    // Sub-tab routing — controlled by parent because the surrounding
    // chrome (sidebar, filter bar) gates on it too.
    watchTopTab, setWatchTopTab,
    // Import flow
    legacyLocal, importState, setImportState, legacyKeys,
    // Navigation
    setTab, setPage,
  } = props;

  const [watchSelectMode, setWatchSelectMode] = useState(false);
  const [watchSelectedIds, setWatchSelectedIds] = useState(() => new Set());
  const toggleWatchSelected = (id) => setWatchSelectedIds(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const exitWatchSelect = () => { setWatchSelectMode(false); setWatchSelectedIds(new Set()); };
  const removeSelectedFromWatchlist = async () => {
    const ids = Array.from(watchSelectedIds);
    for (const id of ids) {
      const item = watchlist[id];
      if (item) await toggleWatchlist(item);
    }
    exitWatchSelect();
  };

  // Lot input state.
  const [addLotOpen, setAddLotOpen] = useState(false);
  const [lotInputUrl, setLotInputUrl] = useState("");
  const [lotInputBusy, setLotInputBusy] = useState(false);
  const [lotInputError, setLotInputError] = useState("");
  const submitTrackedLot = async () => {
    if (!lotInputUrl.trim()) return;
    setLotInputBusy(true);
    setLotInputError("");
    const { error } = await addTrackedLot(lotInputUrl);
    setLotInputBusy(false);
    if (error) setLotInputError(error);
    else setLotInputUrl("");
  };

  // Group-by selector for the Listings sub-tab — local because grouping
  // semantics only make sense inside a watchlist view. Status filter is
  // global (statusMode prop) so users don't have to set it per tab.
  const [watchGroupBy, setWatchGroupBy] = useState(() => {
    try { return localStorage.getItem("watchlist_group_v1") || "none"; }
    catch { return "none"; }
  });
  useEffect(() => {
    try { localStorage.setItem("watchlist_group_v1", watchGroupBy); } catch {}
  }, [watchGroupBy]);

  // ── DERIVED ────────────────────────────────────────────────────────────
  const watchView = useMemo(() => {
    if (statusMode === "all")  return watchItems;
    if (statusMode === "sold") return watchSold;
    return watchLive;
  }, [statusMode, watchItems, watchLive, watchSold]);

  const watchGroups = useMemo(() => {
    if (watchGroupBy === "none") return [["", watchView]];
    const map = new Map();
    for (const item of watchView) {
      let key;
      if (watchGroupBy === "brand")       key = item.brand || "Other";
      else if (watchGroupBy === "source") key = item.source || "Other";
      else /* ref */                      key = extractRef(item.ref) || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    const entries = [...map.entries()];
    if (watchGroupBy === "ref") {
      entries.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    } else {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    }
    return entries;
  }, [watchView, watchGroupBy]);

  const trackedLotsUpcoming = useMemo(
    () => trackedLots.filter(l => !lotIsPast(l)), [trackedLots]
  );
  const trackedLotsPast = useMemo(
    () => trackedLots.filter(l => lotIsPast(l)), [trackedLots]
  );

  const legacyCounts = {
    watchlist: Object.keys(legacyLocal.watchlist).length,
    hidden:    Object.keys(legacyLocal.hidden).length,
  };

  // ── HELPERS (return JSX; safe to define inline since they're not
  // component types) ────────────────────────────────────────────────────
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
    // Pre-hammer, the starting price IS the current price until someone
    // bids. Collapsing "BID" and "START" into one "CURRENT" label so the
    // card reads consistently whether bidding has opened or not.
    const primaryLabel = isPending ? "Pending"
      : sold ? "HAMMER"
      : "CURRENT";
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
              <img src={imgSrc(lot.image)} alt={lot.title || ""}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                loading="lazy" />
            )}
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
            <div style={{ fontSize: 9, color: "var(--text3)", minHeight: 12 }}>
              {primaryUsd ? `~$${Math.round(primaryUsd).toLocaleString()}` : (estimateLine || " ")}
            </div>
          </div>
        </a>
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

  // Import flow — runs once when the user opts in. Reloads the page on
  // success so all the data hooks re-fetch from Supabase with the fresh
  // rows in place.
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
      localStorage.removeItem(legacyKeys.watchlist);
      localStorage.removeItem(legacyKeys.hidden);
    } catch {}
    setImportState("done");
    window.location.reload();
  };

  const importBannerJSX = (user && importState === "available" &&
                          (legacyCounts.watchlist + legacyCounts.hidden > 0)) ? (
    <div style={{
      border: "0.5px solid var(--border)", borderRadius: 12,
      background: "var(--card-bg)", padding: "12px 16px", marginBottom: 16,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ fontSize: 13, color: "var(--text1)", lineHeight: 1.5 }}>
        <b>Import from this browser?</b> We found {legacyCounts.watchlist} watchlist
        {legacyCounts.watchlist === 1 ? " item" : " items"}
        {legacyCounts.hidden > 0 && ` and ${legacyCounts.hidden} hidden`}
        {" "}saved here before sign-in. Move them into your account
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
          // doesn't keep nagging on every visit.
          try {
            localStorage.removeItem(legacyKeys.watchlist);
            localStorage.removeItem(legacyKeys.hidden);
          } catch {}
          setImportState("done");
        }} style={{
          padding: "7px 14px", borderRadius: 8, border: "0.5px solid var(--border)",
          background: "transparent", color: "var(--text2)", cursor: "pointer",
          fontFamily: "inherit", fontSize: 13,
        }}>No thanks</button>
      </div>
    </div>
  ) : null;

  // Searches sub-tab content — lives here because Searches was promoted
  // into the Watchlist tab. Signed-out users see the same prompt the
  // Watchlist sub-tab uses; signed-in see the editable list.
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

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div>
      {importBannerJSX}
      {!user ? signInPromptJSX(
        "Sign in to see your watchlist",
        "Heart any listing to save it here. Saved items sync across every device you use."
      ) : (
        <>
          {/* Top-level toggle between dealer listings and auction lots.
              Sticky so the sub-tabs stay reachable as the user scrolls.
              No paddingTop — the bar pins flush against the chrome
              above it. Border + paddingBottom keep the bar visually
              integrated rather than a floating strip. */}
          <div style={{
            display: "flex", marginBottom: 14,
            position: "sticky",
            top: isMobile ? 92 : 0,
            background: "var(--bg)",
            zIndex: 15,
            paddingBottom: 4,
            borderBottom: "0.5px solid var(--border)",
          }}>
            {[
              ["listings", `Listings${watchCount > 0 ? ` · ${watchCount}` : ""}`],
              ["lots",     `Auction lots${trackedLots.length > 0 ? ` · ${trackedLots.length}` : ""}`],
              ["searches", `Searches${savedSearchStats.length > 0 ? ` · ${savedSearchStats.length}` : ""}`],
            ].map(([key, label]) => (
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text2)" }}>Watchlist</div>
            {watchCount > 0 && !watchSelectMode && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {/* Status (Live/Sold/All) is now driven by the global
                    pill in the filter bar — same control, same state,
                    consistent across Available + Watchlist + Lots. */}
                <select value={watchGroupBy} onChange={e => setWatchGroupBy(e.target.value)}
                  aria-label="Group by"
                  style={{
                    fontSize: 11, padding: "4px 8px", borderRadius: 8,
                    border: "0.5px solid var(--border)", background: "var(--card-bg)",
                    color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                  }}>
                  <option value="none">No grouping</option>
                  <option value="brand">Group: Brand</option>
                  <option value="source">Group: Source</option>
                  <option value="ref">Group: Reference</option>
                </select>
                <button onClick={() => setWatchSelectMode(true)} style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 6,
                  border: "0.5px solid var(--border)", background: "transparent",
                  color: "var(--text2)", cursor: "pointer", fontFamily: "inherit",
                }}>Select</button>
              </div>
            )}
            {watchSelectMode && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>
                  {watchSelectedIds.size} selected
                </span>
                <button onClick={exitWatchSelect} style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 6,
                  border: "0.5px solid var(--border)", background: "transparent",
                  color: "var(--text2)", cursor: "pointer", fontFamily: "inherit",
                }}>Cancel</button>
                <button onClick={removeSelectedFromWatchlist}
                  disabled={watchSelectedIds.size === 0}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 6,
                    border: "none", background: watchSelectedIds.size ? "#c43" : "var(--surface)",
                    color: watchSelectedIds.size ? "#fff" : "var(--text3)",
                    cursor: watchSelectedIds.size ? "pointer" : "default",
                    fontFamily: "inherit",
                  }}>Remove</button>
              </div>
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
              {(() => {
                const renderItem = (item) => {
                  const selected = watchSelectedIds.has(item.id);
                  const cardJSX = (
                    <Card
                      item={{
                        ...item,
                        price: item.savedPrice,
                        currency: item.savedCurrency || "USD",
                        priceUSD: item.savedPriceUSD || item.savedPrice,
                        // SOLD badge follows current state, not the
                        // snapshot's at-save-time `sold` field.
                        sold: item._isSold,
                      }}
                      wished={true}
                      onWish={handleWish}
                      compact={compact}
                    />
                  );
                  if (!watchSelectMode) return <div key={item.id}>{cardJSX}</div>;
                  return (
                    <div key={item.id} style={{ position: "relative", opacity: selected ? 0.55 : 1 }}>
                      {cardJSX}
                      <div onClick={() => toggleWatchSelected(item.id)}
                        role="button" aria-pressed={selected}
                        style={{
                          position: "absolute", inset: 0, cursor: "pointer",
                          background: selected ? "rgba(24,95,165,0.18)" : "transparent",
                          outline: selected ? "2px solid #185FA5" : "none",
                          outlineOffset: -2,
                        }}>
                        <div style={{
                          position: "absolute", top: 8, right: 8,
                          width: 24, height: 24, borderRadius: "50%",
                          background: selected ? "#185FA5" : "rgba(255,255,255,0.92)",
                          color: selected ? "#fff" : "var(--text2)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, fontWeight: 700, lineHeight: 1,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                        }}>
                          {selected ? "✓" : ""}
                        </div>
                      </div>
                    </div>
                  );
                };

                if (watchView.length === 0) {
                  const rawSold = Object.values(watchlist).filter(it => {
                    const live = liveStateById.get(it.id);
                    return !live || !!live.sold;
                  }).length;
                  const rawLive = Object.keys(watchlist).length - rawSold;
                  const rawForStatus =
                    statusMode === "all"  ? Object.keys(watchlist).length :
                    statusMode === "sold" ? rawSold : rawLive;
                  return (
                    <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
                        {rawForStatus === 0
                          ? (statusMode === "sold"
                              ? "No watchlisted items have sold yet."
                              : statusMode === "live"
                                ? "All your saved items have sold or been pulled. Try Sold or All in the filter bar above."
                                : "No saved watches yet.")
                          : "No saved watches match your filters"}
                      </div>
                    </div>
                  );
                }

                return (
                  <>
                    {watchGroups.map(([groupKey, groupItems]) => (
                      <div key={groupKey || "_flat"} style={{ marginBottom: groupKey ? 18 : 0 }}>
                        {groupKey && (
                          <div style={{
                            fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
                            textTransform: "uppercase", color: "var(--text2)",
                            padding: "10px 0 6px",
                            borderTop: "0.5px solid var(--border)", marginTop: 4,
                          }}>
                            {groupKey} <span style={{ color: "var(--text3)", fontWeight: 400 }}>· {groupItems.length}</span>
                          </div>
                        )}
                        <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
                          {groupItems.map(renderItem)}
                        </div>
                      </div>
                    ))}
                    <div style={{ padding: "14px 0 0", fontSize: 11, color: "var(--text3)", textAlign: "center" }}>
                      Prices shown are from the moment you saved each listing.
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
            // ended), All = both combined (upcoming first, then past).
            // Driven by the same global statusMode pill as Available +
            // Watchlist Listings.
            const lotsView =
              statusMode === "sold" ? trackedLotsPast :
              statusMode === "all"  ? [...trackedLotsUpcoming, ...trackedLotsPast] :
                                      trackedLotsUpcoming;
            const lotsLabel =
              statusMode === "sold" ? `${trackedLotsPast.length} past` :
              statusMode === "all"  ? `${trackedLotsUpcoming.length} upcoming · ${trackedLotsPast.length} past` :
                                      `${trackedLotsUpcoming.length} upcoming`;
            return (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>
                    {trackedLots.length === 0 ? "" : lotsLabel}
                  </div>
                  <button onClick={() => { setAddLotOpen(o => !o); setLotInputError(""); }} style={{
                    border: "0.5px solid var(--border)", background: addLotOpen ? "var(--text1)" : "var(--card-bg)",
                    color: addLotOpen ? "var(--bg)" : "var(--text1)",
                    padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 12,
                  }}>{addLotOpen ? "Cancel" : "+ Track lot"}</button>
                </div>

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
                        placeholder="Paste an Antiquorum or Christie's lot URL…"
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
                      Antiquorum (<span style={{ fontFamily: "monospace" }}>live.antiquorum.swiss/lots/view/…</span>)
                      or Christie's (<span style={{ fontFamily: "monospace" }}>christies.com/…/lot/lot-NNN</span>).
                    </div>
                  </div>
                )}

                {trackedLots.length === 0 ? (
                  <div style={{ padding: "48px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>⌛</div>
                    <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>No tracked lots yet</div>
                    <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 340, margin: "0 auto 16px" }}>
                      Tap <b>+ Track lot</b> above and paste an Antiquorum or Christie's lot URL. Each tracked lot gets a daily price update, a countdown to the hammer, and the sold price recorded after.
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
                        {statusMode === "sold" ? "No past lots yet."
                          : statusMode === "all" ? "No tracked lots yet."
                          : "No upcoming lots."}
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
}
