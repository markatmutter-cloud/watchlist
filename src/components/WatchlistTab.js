import React, { useState, useMemo, useEffect } from "react";
import { Card } from "./Card";
import { AuctionCalendar } from "./AuctionCalendar";
import { extractRef, ageBucketFromDate } from "../utils";
import { importLocalData } from "../supabase";




export function WatchlistTab(props) {
  const {
    // Auth
    user, signInWithGoogle, isAuthConfigured,
    // Watchlist data
    watchlist, watchItems, watchLive, watchSold, watchCount,
    toggleWatchlist,
    // For computing the unfiltered raw counts in the Listings empty state
    liveStateById,
    // Searches
    savedSearchStats, searchEditor, setSearchEditor,
    startAddSearch, startEditSearch, cancelSearchEdit, commitSearch, removeSearch,
    runSearch,
    // Card
    handleWish,
    // UI shared
    compact, gridStyle, inp, isMobile, statusMode,
    // Group + sort state from the global filter bar
    groupBy, sort,
    // Auction calendar (3rd sub-tab) and tracked-URL flow
    auctions, addTrackedLot, removeTrackedLot,
    // Sub-tab routing — controlled by parent because the surrounding
    // chrome (sidebar, filter bar) gates on it too.
    watchTopTab, setWatchTopTab,
    // Import flow
    legacyLocal, importState, setImportState, legacyKeys,
    // Navigation
    setTab, setPage,
  } = props;

  // ── TRACK NEW ITEM MODAL ───────────────────────────────────────────────
  // Replaces the previous inline-expand "Track lot" form on the
  // Auctions tab. Lifted to a modal here per Mark's 2026-04-30 ask:
  // dedicated overlay, full-width input, room for source-list
  // instructions. Same single-URL-paste flow underneath.
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackUrl, setTrackUrl]   = useState("");
  const [trackBusy, setTrackBusy] = useState(false);
  const [trackError, setTrackError] = useState("");
  const submitTrack = async () => {
    if (!trackUrl.trim() || !addTrackedLot) return;
    setTrackBusy(true);
    setTrackError("");
    const { error } = await addTrackedLot(trackUrl);
    setTrackBusy(false);
    if (error) setTrackError(error);
    else { setTrackUrl(""); setTrackOpen(false); }
  };

  // (Multi-select bulk-remove was removed 2026-04-30 — heart-on-card
  // is the sufficient untrack affordance per Mark.)

  // Shared styling for the Listings + Searches sub-tab headers so the
  // Watchlist subtabs read consistently. Both have a "title left,
  // primary action right" layout with the same button visual rhythm.
  // Tweaks to one belong here so both update in lock-step.
  const primaryActionRowStyle = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 14, gap: 8, flexWrap: "wrap",
  };
  const subtabHeaderTextStyle = {
    fontSize: 12, color: "var(--text2)",
    letterSpacing: "0.04em", textTransform: "uppercase",
    fontWeight: 600,
  };
  const primaryActionButtonStyle = {
    fontSize: 13, fontWeight: 500,
    padding: "7px 14px", borderRadius: 8,
    border: "0.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text1)",
    cursor: "pointer", fontFamily: "inherit",
  };


  // Group-by is global now (driven by the filter bar's Group pill);
  // alias the prop to the local name so the rest of this file's
  // grouping logic keeps reading naturally.
  const watchGroupBy = props.groupBy || "none";

  // ── DERIVED ────────────────────────────────────────────────────────────
  const watchView = useMemo(() => {
    if (statusMode === "all")  return watchItems;
    if (statusMode === "sold") return watchSold;
    return watchLive;
  }, [statusMode, watchItems, watchLive, watchSold]);

  // Group acts first; sort applies within (watchView arrives already
  // sorted by the global sort state). When `groupBy === "none"` AND
  // sort is by date (newest/oldest), we additionally surface implicit
  // age-bucket dividers (Today / Last 3 days / This week / Older)
  // using savedAt — Mark wants the date-axis grouping to be a
  // *side-effect* of the date sort rather than its own chip.
  const dateBucketOrder = { "Today": 0, "Last 3 days": 1, "This week": 2, "Older": 3 };
  const isDateSort = sort === "date" || sort === "date-asc";
  const watchGroups = useMemo(() => {
    if (watchGroupBy === "none") {
      if (isDateSort && statusMode !== "sold") {
        // Implicit date dividers when sorted by date.
        const map = new Map();
        for (const item of watchView) {
          const key = ageBucketFromDate((item.savedAt || "").slice(0, 10));
          if (!map.has(key)) map.set(key, []);
          map.get(key).push(item);
        }
        const entries = [...map.entries()].sort(
          (a, b) => (dateBucketOrder[a[0]] ?? 9) - (dateBucketOrder[b[0]] ?? 9)
        );
        return entries;
      }
      return [["", watchView]];
    }
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
  }, [watchView, watchGroupBy, isDateSort, statusMode]);


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
      <div style={primaryActionRowStyle}>
        <div style={subtabHeaderTextStyle}>Saved searches</div>
        {!searchEditor && (
          <button onClick={startAddSearch} style={primaryActionButtonStyle}>+ Add search</button>
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
          {/* Sub-tabs: Listings + Searches + Auction Calendar.
              Pill-style with rounded background — visibly separate
              tabs per Mark's 2026-04-30 ask. The previous underline
              treatment looked too similar to a heading row; pills
              read as actual tabs at a glance. Sticky so the bar
              stays reachable as the user scrolls. */}
          <div style={{
            display: "flex", gap: 6, marginBottom: 14,
            position: "sticky",
            top: isMobile ? 92 : 0,
            background: "var(--bg)",
            zIndex: 15,
            paddingBottom: 8, paddingTop: 2,
          }}>
            {[
              ["listings", `Listings${watchCount > 0 ? ` · ${watchCount}` : ""}`],
              ["searches", `Searches${savedSearchStats.length > 0 ? ` · ${savedSearchStats.length}` : ""}`],
              ["calendar", `Auction Calendar${(auctions || []).length > 0 ? ` · ${auctions.length}` : ""}`],
            ].map(([key, label]) => {
              const active = watchTopTab === key;
              // Canonical pill style — same shape as the desktop main
              // tab strip (border-radius 20, surface fallback bg,
              // active = inverted dark). Sub-tabs and main tabs reading
              // identically lets users learn the pill = "tab" pattern
              // once and apply it everywhere.
              return (
                <button key={key} onClick={() => setWatchTopTab(key)} style={{
                  padding: "6px 14px", borderRadius: 20,
                  border: "0.5px solid var(--border)",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13,
                  background: active ? "var(--text1)" : "var(--surface)",
                  color:      active ? "var(--bg)"    : "var(--text2)",
                  fontWeight: active ? 600 : 500,
                }}>{label}</button>
              );
            })}
          </div>

          {watchTopTab === "listings" && (<>
          <div style={primaryActionRowStyle}>
            <div style={subtabHeaderTextStyle}>Watchlist</div>
            {/* Track New Item — opens modal that accepts auction-house
                lot URLs, eBay item URLs, etc. Styling matches the
                "+ Add search" button on the Searches sub-tab so primary
                actions read consistently across sub-tabs. */}
            <button onClick={() => { setTrackOpen(true); setTrackError(""); }}
              style={primaryActionButtonStyle}>
              + Track new item
            </button>
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
                const renderItem = (item) => (
                  <Card
                    key={item.id}
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
                    {watchGroups.map(([groupKey, groupItems], idx) => (
                      <div key={groupKey || "_flat"} style={{ marginBottom: groupKey ? 18 : 0 }}>
                        {groupKey && (
                          // Group section header — same shape as the
                          // Listings tab's divider (fontSize 14 title +
                          // fontSize 12 count, borderBottom, baseline-
                          // aligned). Keeps the visual rhythm consistent
                          // across all grouped surfaces.
                          <div style={{
                            display: "flex", alignItems: "baseline", gap: 12,
                            padding: idx === 0 ? "4px 4px 12px" : "24px 4px 12px",
                            borderBottom: "0.5px solid var(--border)",
                            marginBottom: 4,
                          }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
                              {groupKey}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto" }}>
                              {groupItems.length.toLocaleString()}
                            </span>
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

          {watchTopTab === "searches" && searchesTabJSX}
          {watchTopTab === "calendar" && (
            <div style={{ paddingTop: 4 }}>
              <AuctionCalendar auctions={auctions || []} />
            </div>
          )}
        </>
      )}

      {/* Track new item modal — single-URL paste flow with source-list
          instructions. Mounts on demand so the input is focused +
          centered without competing with the cards behind it. Backdrop
          click closes; escape would too if we wired keydown but the
          existing site modals don't bother. */}
      {trackOpen && (
        <div onClick={() => setTrackOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "var(--card-bg)",
            border: "0.5px solid var(--border)",
            borderRadius: 14,
            padding: "20px 22px",
            width: "100%", maxWidth: 520,
            color: "var(--text1)", fontFamily: "inherit",
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              Track new item
            </div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 14, lineHeight: 1.5 }}>
              Paste an auction lot URL or marketplace listing URL. The
              tracked item appears in your Watchlist and refreshes on
              the next scrape (current bid, hammer price, end time).
            </div>
            <input
              autoFocus
              value={trackUrl}
              onChange={e => { setTrackUrl(e.target.value); setTrackError(""); }}
              onKeyDown={e => { if (e.key === "Enter") submitTrack(); }}
              placeholder="https://..."
              style={{ ...inp, width: "100%", fontSize: 13, marginBottom: 8 }}
            />
            {trackError && (
              <div style={{ fontSize: 11, color: "#c0392b", marginBottom: 8 }}>{trackError}</div>
            )}
            <div style={{ fontSize: 10, color: "var(--text3)", lineHeight: 1.55, marginBottom: 14 }}>
              Supported sources:
              {" "}Antiquorum (live + catalog),
              {" "}Christie's,
              {" "}Sotheby's,
              {" "}Monaco Legend,
              {" "}Phillips,
              {" "}eBay (auction or Buy-It-Now).
              {" "}Bonhams + Chrono24 are blocked by their bot walls right now and need Mac mini infra (deferred).
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setTrackOpen(false)} style={{
                border: "0.5px solid var(--border)", background: "transparent",
                color: "var(--text2)", padding: "8px 16px", borderRadius: 8,
                cursor: "pointer", fontFamily: "inherit", fontSize: 13,
              }}>Cancel</button>
              <button onClick={submitTrack} disabled={trackBusy || !trackUrl.trim()} style={{
                border: "none", background: "#185FA5", color: "#fff",
                padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 500,
                opacity: (trackBusy || !trackUrl.trim()) ? 0.5 : 1,
              }}>{trackBusy ? "Tracking…" : "Track"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
