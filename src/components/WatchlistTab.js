import React, { useState, useMemo, useEffect } from "react";
import { Card } from "./Card";
import { ageBucketFromDate, fmtUSD } from "../utils";
import { useEBaySearches, EBAY_SEARCHES_EDIT_URL } from "../hooks/useEBaySearches";
import { importLocalData } from "../supabase";




export function WatchlistTab(props) {
  const {
    // Auth
    user, signInWithGoogle, isAuthConfigured,
    // Watchlist data
    watchlist, watchItems, watchCount,
    toggleWatchlist,
    // Searches
    savedSearchStats, searchEditor, setSearchEditor,
    startAddSearch, startEditSearch, cancelSearchEdit, commitSearch, removeSearch,
    runSearch,
    // Card
    handleWish,
    // UI shared
    compact, gridStyle, inp, isMobile,
    // Sort state from the global filter bar
    sort,
    // (Auction calendar prop removed 2026-05-04 — calendar moved to
    // the Listings tab's Auctions filter > Calendar view; App.js
    // still passes `auctions` in the bag but WatchlistTab no
    // longer reads it.)
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
    // Hidden listings — surfaced as a synthetic collection in the
    // Collections list (replacing the old user-dropdown "Manage
    // hidden" modal). toggleHide unhides on the drill-in's "..."
    // menu via the Card's existing isHidden semantics.
    hiddenItems, toggleHide,
    // Full listings.json content + the user's hidden map. Used by
    // ChallengeFlow's add-to-shortlist search drawer (filter the
    // global feed for picks).
    allListings, hidden,
  } = props;

  // eBay source-search config (read-only display in the Searches
  // sub-tab). Surfaces what the scraper is currently pulling from
  // eBay; edits go through the GitHub editor link in the section
  // header. Loading state is non-blocking — the saved-searches list
  // below still renders normally.
  const { searches: ebaySearches, loading: ebayLoading, error: ebayError } = useEBaySearches();

  // Collections sub-tab drill-in selection. null = list view; <uuid>
  // = drilled into that specific collection. Initial value reads
  // from `?col=<id>` so a refresh on a drilled-in collection lands
  // back on it. Reset when the user navigates away from the
  // Collections sub-tab so a stale id doesn't surface a deleted
  // collection on return.
  const [selectedCollectionId, setSelectedCollectionId] = useState(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("col") || null;
  });
  useEffect(() => {
    if (watchTopTab !== "collections") setSelectedCollectionId(null);
  }, [watchTopTab]);
  // URL sync for the drill-in id. App.js handles `tab` + `sub`; we
  // only own `col`. Skipped when share-receive params are present
  // (the share flow controls URL until it acts). App.js also clears
  // `col` when tab leaves "watchlist", so we don't need to mirror
  // that case here.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("shared") === "1") return;
    if (selectedCollectionId && watchTopTab === "collections") {
      params.set("col", selectedCollectionId);
    } else {
      params.delete("col");
    }
    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    if (newUrl !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState({}, "", newUrl);
    }
  }, [selectedCollectionId, watchTopTab]);

  // (Challenges sub-tab moved to References tab 2026-05-04 —
  // ChallengesView component owns its own selection state + render.)

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
  // Watchlist sub-tab restructure (2026-05-04): App.js's watchItems
  // memo now scopes by sub-tab (saved listings / saved auctions /
  // saved sold) up-front, so this component just consumes that single
  // pre-filtered list. No more statusMode dispatch here.
  const watchView = watchItems;

  // Date-bucket dividers for date-sorted views. Bucket-key source
  // depends on which sub-tab is active:
  //   listings → savedAt buckets ("Today saved" / weekday saved / ...)
  //   sold     → soldAt / auction_end buckets ("Today sold" / ... )
  //   auctions → no dividers (sort is by ending order, not by date posted)
  const isDateSort = sort === "date" || sort === "date-asc";
  const bucketRank = (label) => {
    if (label && label.startsWith("Today")) return 0;
    if (label && label.startsWith("Yesterday")) return 1;
    if (label && label.startsWith("Last week")) return 8;
    if (label && label.startsWith("Older")) return 9;
    return 4;
  };
  const dividerSuffix = watchTopTab === "sold" ? " sold" : " saved";
  const dividerDate = (item) => watchTopTab === "sold"
    ? (item.soldAt || item.auction_end || "")
    : (item.savedAt || "");

  const watchGroups = useMemo(() => {
    if (isDateSort && watchTopTab !== "auctions") {
      const map = new Map();
      for (const item of watchView) {
        const base = ageBucketFromDate((dividerDate(item) || "").slice(0, 10));
        const key = base ? `${base}${dividerSuffix}` : "";
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
      }
      const ascending = sort === "date-asc";
      return [...map.entries()].sort((a, b) => {
        const ra = bucketRank(a[0]);
        const rb = bucketRank(b[0]);
        return ascending ? rb - ra : ra - rb;
      });
    }
    return [["", watchView]];
  }, [watchView, isDateSort, sort, watchTopTab]);


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
    "Sign in to use lists",
    "Group watches by reference, theme, or research thread — \"Rolex 5513s\", \"Vintage divers\", \"Reference comps\". Lists sync across every device you use."
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
    // Synthetic "Hidden" collection — surfaced in the list when the
    // user has any hidden listings. Drill-in renders the items grid
    // with isHidden so the "..." menu's Hide entry reads as "Unhide"
    // (Card already handles that label flip). Sentinel id avoids
    // collision with real collection UUIDs.
    const HIDDEN_COLLECTION_ID = "__hidden__";
    const hiddenCol = (hiddenItems && hiddenItems.length > 0) ? {
      id: HIDDEN_COLLECTION_ID, name: "Hidden", isHidden: true,
    } : null;
    const visibleCols  = [
      ...(sharedInbox ? [sharedInbox] : []),
      ...userCols,
      ...(hiddenCol ? [hiddenCol] : []),
    ];
    const selected = selectedCollectionId === HIDDEN_COLLECTION_ID
      ? hiddenCol
      : (selectedCollectionId ? cols.find(c => c.id === selectedCollectionId) : null);

    if (selected) {
      const isHiddenColl = selected.id === HIDDEN_COLLECTION_ID;
      const items = isHiddenColl ? hiddenItems : (itemsByColl[selected.id] || []);
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
            }}>← All lists</button>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
              {selected.name}
            </span>
            <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto" }}>
              {items.length}
            </span>
            {/* Rename + Delete hidden for the shared-inbox + Hidden
                collections — both are managed surfaces, not user-named.
                The user can empty Hidden by unhiding individual items
                via the "..." menu, just as they empty the shared inbox
                by removing items individually. */}
            {!selected.isSharedInbox && !isHiddenColl && (
              <>
                <button onClick={() => setEditingCollection({ id: selected.id, name: selected.name })}
                  title="Rename list"
                  style={{
                    border: "0.5px solid var(--border)", background: "transparent",
                    color: "var(--text2)", padding: "4px 10px", borderRadius: 6,
                    cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                  }}>Rename</button>
                <button onClick={async () => {
                    if (!window.confirm(`Delete "${selected.name}"? Items inside aren't deleted from your watchlist; they're just unbundled from this list.`)) return;
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
              <div style={{ fontSize: 32, marginBottom: 12 }}>{isHiddenColl ? "👁" : "📂"}</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: "var(--text1)" }}>
                {isHiddenColl ? "Nothing hidden" : "Empty list"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 320, margin: "0 auto" }}>
                {isHiddenColl
                  ? "Listings you hide from the Available feed land here. Use the \"…\" menu on any card to unhide it."
                  : "Add watches via the \"…\" menu on any listing card → \"Add to list…\"."}
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
                  // Card flips the Hide menu label based on isHidden:
                  // - Hidden drill-in: isHidden=true → label "Unhide",
                  //   onHide toggles the row off the hidden_listings table.
                  // - Regular collection: hideLabel forces "Remove from
                  //   collection" semantics.
                  onHide={isHiddenColl
                    ? toggleHide
                    : () => collectionsApi.removeItemFromCollection(selected.id, item.id)}
                  hideLabel={isHiddenColl ? undefined : "Remove from list"}
                  isHidden={isHiddenColl}
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

    // List view. Top of the list-view always shows a one-line
    // "how this works" hint so users know lists exist and how to
    // populate them — feedback from Mark on 2026-05-04 that the
    // sub-tab felt bland and undocumented.
    const helpBanner = (
      <div style={{
        margin: "0 0 14px",
        padding: "12px 14px",
        borderRadius: 10,
        border: "0.5px solid var(--border)",
        background: "var(--surface)",
        fontSize: 12, lineHeight: 1.5, color: "var(--text2)",
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", marginBottom: 4 }}>
          Lists group watches your way
        </div>
        Reference threads, dealer comps, "Rolex 5513s", "Vintage divers" —
        whatever cut helps you think. Tap <strong style={{ color: "var(--text1)" }}>+ New list</strong> above to start one,
        then add watches via the <strong style={{ color: "var(--text1)" }}>…</strong> menu on any card →{" "}
        <em>Add to list…</em>.
      </div>
    );
    return (
      <div style={{ paddingTop: 4 }}>
        {helpBanner}
        {visibleCols.length === 0 ? (
          <div style={{ padding: "32px 20px 48px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: "var(--text1)" }}>
              No lists yet
            </div>
            <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 340, margin: "0 auto" }}>
              You haven't created any lists. Tap <strong style={{ color: "var(--text1)" }}>+ New list</strong> above to start one.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleCols.map(c => {
              const isInbox = c.isSharedInbox;
              const isHiddenRow = c.id === HIDDEN_COLLECTION_ID;
              const count = isHiddenRow
                ? hiddenItems.length
                : (itemsByColl[c.id] || []).length;
              // Default-list (user-created) cards get a folder glyph
              // on the left — same accent blue as the inbox + hidden
              // glyphs. Treats every row visually consistently.
              const defaultIcon = !isInbox && !isHiddenRow;
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
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Icon disc — same surface treatment regardless of
                        list kind so the row reads visually consistent.
                        Glyph swaps based on list kind. */}
                    <div style={{
                      flexShrink: 0,
                      width: 36, height: 36, borderRadius: "50%",
                      background: "rgba(24,95,165,0.08)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isInbox ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                        </svg>
                      ) : isHiddenRow ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.06 10.06 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                          <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : defaultIcon && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text2)" }}>
                        {isInbox
                          ? `${count} listing${count === 1 ? "" : "s"} shared with you`
                          : isHiddenRow
                            ? `${count} listing${count === 1 ? "" : "s"} hidden from feed`
                            : `${count} watch${count === 1 ? "" : "es"}`}
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

          {(watchTopTab === "listings" || watchTopTab === "auctions" || watchTopTab === "sold") && (<>
          {/* (Subtitle "Watchlist" + inline Track button removed
              2026-04-30 — Track moved into the sub-tab strip; the
              tab pill itself carries the section identity.) */}
          {watchCount === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>♡</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>No watches saved yet</div>
              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 320, margin: "0 auto 16px" }}>
                Browse the Listings tab and tap the heart on any item — it'll appear here with the price you saved at, even after the dealer takes the URL down.
              </div>
              <button onClick={() => { setTab("listings"); setPage(1); }} style={{
                padding: "8px 16px", borderRadius: 8, border: "0.5px solid var(--border)",
                background: "var(--card-bg)", color: "var(--text1)", cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 500,
              }}>Browse Listings</button>
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
                  const emptyCopy =
                    watchTopTab === "auctions" ? "No saved auction lots match your filters." :
                    watchTopTab === "sold"     ? "Nothing in your saved set has sold yet that matches your filters." :
                                                 "No saved listings match your filters.";
                  return (
                    <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
                        {emptyCopy}
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
          {/* Auction calendar sub-tab retired 2026-05-04 — calendar
              moved into the Listings tab's Auctions filter as a
              Lots/Calendar toggle. App.js still passes `auctions` in
              for any future Watchlist-side use; ignored here. */}
        </>
      )}

      {/* (Track new item modal lifted to App.js — see
          trackNewItemModalJSX in App.js.) */}
    </div>
  );
}
