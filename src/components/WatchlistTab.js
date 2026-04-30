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
          {/* Sub-tabs: Listings + Searches + Auction Calendar. The
              Auctions main tab was retired 2026-04-30; tracked lots
              now flow into Listings (alongside hearted dealer items)
              and the calendar lives here as a 3rd sub-tab. */}
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
              ["searches", `Searches${savedSearchStats.length > 0 ? ` · ${savedSearchStats.length}` : ""}`],
              ["calendar", `Auction Calendar${(auctions || []).length > 0 ? ` · ${auctions.length}` : ""}`],
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
            {!watchSelectMode && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {/* Track New Item — opens modal that accepts auction-
                    house lot URLs, eBay item URLs, etc. Replaces the
                    prior inline form on the (now-retired) Auctions tab. */}
                <button onClick={() => { setTrackOpen(true); setTrackError(""); }} style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 6,
                  border: "0.5px solid var(--border)",
                  background: "var(--card-bg)",
                  color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                }}>+ Track new item</button>
                {watchCount > 0 && (
                  <button onClick={() => setWatchSelectMode(true)} style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 6,
                    border: "0.5px solid var(--border)", background: "transparent",
                    color: "var(--text2)", cursor: "pointer", fontFamily: "inherit",
                  }}>Select</button>
                )}
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
