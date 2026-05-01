import React, { useState, useMemo, useEffect } from "react";
import { Card } from "./Card";
import { AuctionCalendar } from "./AuctionCalendar";
import { ageBucketFromDate } from "../utils";
import { useEBaySearches, EBAY_SEARCHES_EDIT_URL } from "../hooks/useEBaySearches";
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
    // Sort state from the global filter bar
    sort,
    // Auction calendar (3rd sub-tab) and tracked-URL flow
    auctions,
    // Sub-tab routing — controlled by parent because the surrounding
    // chrome (sidebar, filter bar) gates on it too.
    watchTopTab, setWatchTopTab,
    // Import flow
    legacyLocal, importState, setImportState, legacyKeys,
    // Navigation
    setTab, setPage,
    // Collections (Session 2). collectionsApi is the full
    // useCollections return value; setEditingCollection opens the
    // create/rename modal (rendered in the parent shell);
    // openCollectionPicker opens the add-to-collection modal for a
    // listing.
    collectionsApi, setEditingCollection, openCollectionPicker,
    // User's primary display currency (USD/GBP/EUR), forwarded
    // to every Card render so the new currency rule applies in the
    // Watchlist > Favorites and Collection drill-in surfaces too.
    primaryCurrency,
    // Outbound share handler — wired to every Card render below
    // so the "..." menu's Share item works in Watchlist > Favorites
    // and inside Collection drill-ins too.
    handleShare,
  } = props;

  // eBay source-search config (read-only display in the Searches
  // sub-tab). Surfaces what the scraper is currently pulling from
  // eBay; edits go through the GitHub editor link in the section
  // header. Loading state is non-blocking — the saved-searches list
  // below still renders normally.
  const { searches: ebaySearches, loading: ebayLoading, error: ebayError } = useEBaySearches();

  // Collections sub-tab drill-in selection. null = list view; <uuid>
  // = drilled into that specific collection. Reset when the user
  // navigates away from the Collections sub-tab so a stale id doesn't
  // surface a deleted collection on return.
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  useEffect(() => {
    if (watchTopTab !== "collections") setSelectedCollectionId(null);
  }, [watchTopTab]);

  // (Track New Item modal lifted to App.js on 2026-04-30 — its
  // trigger button now lives in the watchSubTabsJSX strip above
  // the filter row, so the modal state moved up too.)

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


  // (Group-by feature removed 2026-04-30. Only implicit date
  // dividers remain when sort is by date — see watchGroups below.)

  // ── DERIVED ────────────────────────────────────────────────────────────
  const watchView = useMemo(() => {
    if (statusMode === "all")  return watchItems;
    if (statusMode === "sold") return watchSold;
    return watchLive;
  }, [statusMode, watchItems, watchLive, watchSold]);

  // Group acts first; sort applies within (watchView arrives already
  // sorted by the global sort state). When `groupBy === "none"` AND
  // sort is by date (newest/oldest), we additionally surface implicit
  // weekday-named dividers (Today / Yesterday / Wednesday / ...
  // / Last week / Older) using savedAt. Date-axis grouping is a
  // *side-effect* of the date sort rather than its own chip.
  const isDateSort = sort === "date" || sort === "date-asc";

  // Bucket rank — smaller = more recent. Date↓ sorts buckets ascending
  // by rank (Today first); Date↑ sorts descending (Older first).
  //
  // Earlier versions (pre-2026-05-01) used a max-savedAt-per-group
  // comparator. That fell over when tracked-lot rows had empty
  // `savedAt` — every group's "max" collapsed to 0 (epoch) and the
  // sort became unstable, putting Older above Today even on Date↓.
  // An explicit rank table is deterministic regardless of timestamp
  // gaps. Weekday names come from ageBucketFromDate, which only emits
  // them for d ∈ [2..6], so we just need a single weekday tier (the
  // labels are mutually exclusive on any given day) — they all rank
  // between "Yesterday" and "Last week".
  const bucketRank = (label) => {
    if (label === "Today")     return 0;
    if (label === "Yesterday") return 1;
    if (label === "Last week") return 8;
    if (label === "Older")     return 9;
    // Anything else is a weekday (Mon..Sun) emitted only for 2-6 days
    // ago. Rank them all together at 4; ageBucketFromDate guarantees
    // there's at most ONE such weekday bucket on any given day, so a
    // single rank is enough.
    return 4;
  };

  // Group-by feature removed 2026-04-30 — only implicit weekday-
  // named dividers remain when sort is by date and status isn't
  // sold-archive. Other sorts get a single flat bucket.
  const watchGroups = useMemo(() => {
    if (isDateSort && statusMode !== "sold") {
      const map = new Map();
      for (const item of watchView) {
        const key = ageBucketFromDate((item.savedAt || "").slice(0, 10));
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
      }
      const ascending = sort === "date-asc";
      return [...map.entries()].sort((a, b) => {
        const ra = bucketRank(a[0]);
        const rb = bucketRank(b[0]);
        // Date↓ (descending = newest first) wants smaller rank first
        // → ra - rb. Date↑ flips that.
        return ascending ? rb - ra : ra - rb;
      });
    }
    return [["", watchView]];
  }, [watchView, isDateSort, sort, statusMode]);


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
      {/* eBay source-searches — read-only view of data/ebay_searches.json.
          These configure what the scraper pulls into the feed (vs the
          saved searches below, which filter what's already in the feed).
          Edits go through GitHub. */}
      {(ebaySearches.length > 0 || ebayLoading || ebayError) && (
        <div style={{ marginBottom: 24 }}>
          {/* Section divider — matches the Listings + Calendar treatment
              (fontSize 14, fontWeight 600, borderBottom 0.5px). The
              earlier small-uppercase header read as a different
              visual system from the bold "Today" / "April 2026"
              dividers in the sibling sub-tabs. Right side carries the
              count + the Edit-on-GitHub link, replacing the old
              two-line "N searches feeding..." subtitle. */}
          <div style={{
            display: "flex", alignItems: "baseline", gap: 12,
            padding: "14px 14px 12px",
            borderBottom: "0.5px solid var(--border)",
            marginBottom: 4,
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
              Source · eBay
            </span>
            <span style={{ fontSize: 12, color: "var(--text3)" }}>
              {ebayLoading ? "loading…"
                : ebayError ? "couldn't load"
                : `feeding the Available feed`}
            </span>
            <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
              {!ebayLoading && !ebayError && ebaySearches.length}
              <a href={EBAY_SEARCHES_EDIT_URL} target="_blank" rel="noopener noreferrer"
                 style={{
                   fontSize: 12, color: "#185FA5", textDecoration: "none",
                   fontFamily: "inherit", whiteSpace: "nowrap",
                 }}>
                Edit on GitHub ↗
              </a>
            </span>
          </div>

          {/* eBay rows mirror the saved-search row visual below (same
              border-radius, padding, type scale) so the two lists
              read as siblings. eBay rows are read-only — primary
              click opens the search on eBay's site (whole row is the
              link target). Saved-search rows have the same outer
              shell but split into a left button (run search) + right
              edit/delete column. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ebaySearches.map(s => {
              const RowInner = (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text1)", marginBottom: 2,
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text2)",
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.query
                        ? `${s.count} on eBay${s.query !== s.label ? ` · "${s.query}"` : ""}`
                        : `${s.count} on eBay · seller: ${s.seller}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {/* External-link arrow as the affordance — the
                        whole row is clickable, this is just the
                        wayfinder. */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </div>
                </>
              );
              const sharedShell = {
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px",
                borderRadius: 12,
                border: "0.5px solid var(--border)",
                background: "var(--card-bg)",
                color: "inherit", textDecoration: "none",
                fontFamily: "inherit",
              };
              return s.ebayUrl ? (
                <a key={s.label} href={s.ebayUrl} target="_blank" rel="noopener noreferrer"
                   style={sharedShell}>
                  {RowInner}
                </a>
              ) : (
                <div key={s.label} style={sharedShell}>{RowInner}</div>
              );
            })}
          </div>
        </div>
      )}

      {/* Saved searches — user-defined filters over the existing feed.
          Different from eBay source-searches above (which add to the
          feed). Same UI affordance is fine since both are
          "named queries you run with one tap." */}
      {savedSearchStats.length > 0 && (
        // Same divider treatment as the Source · eBay header above
        // and the Listings / Calendar sub-tab dividers — fontSize 14,
        // fontWeight 600, borderBottom. Trailing count on the right
        // mirrors the "Today (14)" pattern.
        <div style={{
          display: "flex", alignItems: "baseline", gap: 12,
          padding: "14px 14px 12px",
          borderBottom: "0.5px solid var(--border)",
          marginBottom: 4,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
            Saved searches
          </span>
          <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto" }}>
            {savedSearchStats.length}
          </span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* New-search creation moved to AddSearchModal 2026-04-30
            (parity with Track New Item). Inline editor still
            handles edits to existing searches below. */}

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
          // Same shell as the Watchlist + Calendar empty states —
          // icon + heading + blurb. Was a single line of muted text;
          // now matches the rest so empty surfaces feel native.
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: "var(--text1)" }}>
              No saved searches yet
            </div>
            <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 320, margin: "0 auto" }}>
              Save a search and run it with one tap. Useful for tracking specific references across every dealer in the feed.
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── COLLECTIONS SUB-TAB ────────────────────────────────────────────────
  // Two views, controlled by local `selectedCollectionId` state:
  //   null         → list of collections (each row = name + count)
  //   <uuid>       → drill-in view of that collection's items as Cards
  //
  // The default Watchlist (backed by watchlist_items) is NOT a row in
  // collectionsApi.collections — that's Approach A's intentional
  // asymmetry. Default lives in the existing Watchlist > Listings
  // sub-tab; this Collections sub-tab is for additional collections
  // only.
  const collectionsTabJSX = !user ? signInPromptJSX(
    "Sign in to use collections",
    "Group watches by reference, theme, or research thread — \"Rolex 5513s\", \"Vintage divers\", \"Reference comps\". Collections sync across every device you use."
  ) : (() => {
    const cols = (collectionsApi?.collections || []);
    const itemsByColl = collectionsApi?.itemsByCollection || {};
    // Surface the shared-inbox alongside user-created collections
    // 2026-05-01 — was hidden in v2 of the spec, but with Session 3
    // shipped that left received items invisible. Now pinned to the
    // TOP of the list with an inbox icon so it reads as a different
    // surface from "I made this collection." Still excluded from
    // CollectionPickerModal (manual adds shouldn't go to the inbox).
    const sharedInbox  = cols.find(c => c.isSharedInbox) || null;
    const userCols     = cols.filter(c => !c.isSharedInbox);
    const visibleCols  = sharedInbox ? [sharedInbox, ...userCols] : userCols;
    const selected = selectedCollectionId
      ? cols.find(c => c.id === selectedCollectionId)
      : null;

    if (selected) {
      const items = itemsByColl[selected.id] || [];
      return (
        <div style={{ paddingTop: 4 }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 12,
            padding: "14px 14px 12px",
            borderBottom: "0.5px solid var(--border)",
            marginBottom: 12,
          }}>
            <button onClick={() => setSelectedCollectionId(null)} style={{
              border: "none", background: "transparent", cursor: "pointer",
              color: "#185FA5", fontFamily: "inherit", fontSize: 13, padding: 0,
            }}>← All collections</button>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
              {selected.name}
            </span>
            <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto" }}>
              {items.length}
            </span>
            {/* Rename + Delete hidden for the shared-inbox collection
                — spec says it's perma in v1; the user can clear items
                via Remove-from-collection on each card but the
                collection itself stays. */}
            {!selected.isSharedInbox && (
              <>
                <button onClick={() => setEditingCollection({ id: selected.id, name: selected.name })}
                  title="Rename collection"
                  style={{
                    border: "0.5px solid var(--border)", background: "transparent",
                    color: "var(--text2)", padding: "4px 10px", borderRadius: 6,
                    cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                  }}>Rename</button>
                <button onClick={async () => {
                    if (!window.confirm(`Delete "${selected.name}"? Items inside aren't deleted from your watchlist; they're just unbundled from this collection.`)) return;
                    await collectionsApi.deleteCollection(selected.id);
                    setSelectedCollectionId(null);
                  }}
                  style={{
                    border: "0.5px solid var(--border)", background: "transparent",
                    color: "#c0392b", padding: "4px 10px", borderRadius: 6,
                    cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                  }}>Delete</button>
              </>
            )}
          </div>
          {items.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: "var(--text1)" }}>
                Empty collection
              </div>
              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 320, margin: "0 auto" }}>
                Add watches via the "…" menu on any listing card → "Add to collection…".
              </div>
            </div>
          ) : (
            <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
              {items.map(item => (
                <Card
                  key={item.id}
                  item={item}
                  wished={!!watchlist[item.id]}
                  onWish={handleWish}
                  compact={compact}
                  // Inside a collection, the Hide menu item swaps to
                  // "Remove from collection" — single Card surface,
                  // different action wiring per context.
                  onHide={() => collectionsApi.removeItemFromCollection(selected.id, item.id)}
                  hideLabel="Remove from collection"
                  isHidden={false}
                  onAddToCollection={openCollectionPicker}
                  primaryCurrency={primaryCurrency}
                  onShare={handleShare}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    // List view.
    return (
      <div style={{ paddingTop: 4 }}>
        {visibleCols.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: "var(--text1)" }}>
              No collections yet
            </div>
            <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 340, margin: "0 auto" }}>
              Group watches by reference, theme, or research thread — "Rolex 5513s", "Vintage divers", "Reference comps - 5512". Use "+ New collection" above to create one, then add listings via the "…" menu on any card.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleCols.map(c => {
              const count = (itemsByColl[c.id] || []).length;
              const isInbox = c.isSharedInbox;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCollectionId(c.id)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 16px", borderRadius: 12,
                    border: "0.5px solid var(--border)",
                    borderLeft: "3px solid #185FA5",
                    background: "var(--card-bg)",
                    color: "var(--text1)", cursor: "pointer",
                    fontFamily: "inherit", textAlign: "left",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {isInbox && (
                      // Inbox icon — small tray glyph in the same blue
                      // as the borderLeft accent.
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                      </svg>
                    )}
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text2)" }}>
                        {isInbox
                          ? `${count} listing${count === 1 ? "" : "s"} shared with you`
                          : `${count} item${count === 1 ? "" : "s"}`}
                      </div>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  })();

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div>
      {importBannerJSX}
      {!user ? signInPromptJSX(
        "Sign in to see your watchlist",
        "Heart any listing to save it here. Saved items sync across every device you use."
      ) : (
        <>
          {/* Sub-tab strip + Track / Add-search trigger lifted to
              App.js (watchSubTabsJSX) so they sit between the main
              tab strip and the filter row, above the page content.
              WatchlistTab now only renders the active sub-tab's
              content — the parent App.js controls watchTopTab state
              + the strip render. */}

          {watchTopTab === "listings" && (<>
          {/* (Subtitle "Watchlist" + inline Track button removed
              2026-04-30 — Track moved into the sub-tab strip; the
              tab pill itself carries the section identity.) */}
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
                    onAddToCollection={openCollectionPicker}
                    primaryCurrency={primaryCurrency}
                    onShare={handleShare}
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

                // Flatten all groups + dividers into a single CSS grid
                // (matches the Listings tab structure: dividers live
                // INSIDE the grid via `gridColumn: 1/-1`, sharing the
                // exact same edge treatment as the cards below). Earlier
                // version used a sibling div per group with its own
                // grid — visually similar but the alignment + rounding
                // diverged from Listings.
                const flat = [];
                watchGroups.forEach(([groupKey, groupItems], gi) => {
                  if (groupKey) flat.push({
                    kind: "divider", label: groupKey,
                    total: groupItems.length, idx: gi,
                  });
                  for (const it of groupItems) flat.push({ kind: "card", item: it });
                });
                return (
                  <>
                    <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
                      {flat.map((entry, idx) => (
                        entry.kind === "divider" ? (
                          <div key={`div-${idx}-${entry.label}`} style={{
                            gridColumn: "1/-1",
                            padding: entry.idx === 0 ? "14px 14px 12px" : "28px 14px 12px",
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
                          <div key={entry.item.id}>{renderItem(entry.item)}</div>
                        )
                      ))}
                    </div>
                    <div style={{ padding: "14px 0 0", fontSize: 11, color: "var(--text3)", textAlign: "center" }}>
                      Prices shown are from the moment you saved each listing.
                    </div>
                  </>
                );
              })()}
            </>
          )}
          </>)}

          {watchTopTab === "collections" && collectionsTabJSX}
          {watchTopTab === "searches" && searchesTabJSX}
          {watchTopTab === "calendar" && (
            <div style={{ paddingTop: 4 }}>
              <AuctionCalendar auctions={auctions || []} />
            </div>
          )}
        </>
      )}

      {/* (Track new item modal lifted to App.js — see
          trackNewItemModalJSX in App.js.) */}
    </div>
  );
}
