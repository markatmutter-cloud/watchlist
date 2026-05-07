import React, { useState, useMemo, useEffect } from "react";
import { Card } from "./Card";
import { ageBucketFromDate, fmtUSD } from "../utils";
import { importLocalData } from "../supabase";
import { SubTabIntro } from "./SubTabIntro";




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
    // Sub-tab routing — controlled by parent because the surrounding
    // chrome (sidebar, filter bar) gates on it too.
    watchTopTab, setWatchTopTab,
    // Import flow
    legacyLocal, importState, setImportState, legacyKeys,
    // Navigation
    setTab, setPage,
    // openCollectionPicker opens the add-to-collection modal for a
    // listing — still wired to every Card's "..." menu in the
    // remaining sub-tabs (Saved listings / Saved auctions / Saved
    // sold), so users can add a saved item to a list from here.
    // The list-management surface itself moved to the new
    // Collections tab (PR #86).
    openCollectionPicker,
    // User's primary display currency. Forwarded to Card renders.
    primaryCurrency,
    // Outbound share handler — wired to every Card render below.
    handleShare,
    // Telemetry hooks (Epic 8 — Site analytics). Both optional so
    // signed-out / non-Supabase environments degrade silently.
    observeCard, onClickListing,
  } = props;

  // (eBay source-search read-only block removed 2026-05-06 — see
  // comment in searchesTabJSX. Hook + import dropped along with it
  // since nothing else in this file consumed them.)

  // (Lists sub-tab moved to top-level Collections tab 2026-05-06
  // PR #86 — CollectionsTab.js owns its own drill-in state + the
  // `?col=` URL sync. Watchlist no longer reads or writes that param.)

  // (Challenges sub-tab moved to References tab 2026-05-04, then to
  // Collections tab 2026-05-06 PR #86 — ChallengesView is rendered
  // by CollectionsTab.)

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

  // (subTabIntroJSX helper lifted to ./SubTabIntro on 2026-05-05 so
  // Cool Stuff can share the exact same shell. Imported as <SubTabIntro/>
  // at the top; call sites below use JSX directly rather than the
  // previous {fn(...)} pattern.)


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
      <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 360, margin: "0 auto 18px" }}>
        {blurb}
      </div>
      {isAuthConfigured && (
        // Brand-blue primary style — consistent across every signed-
        // out sign-in CTA in the app (top bar, ShareReceiver,
        // ChallengeReceiver, per-feature prompts). The actual OAuth
        // fires from inside SignInPromptModal which this opens.
        <button onClick={signInWithGoogle} style={{
          padding: "10px 18px", borderRadius: 10, border: "none",
          background: "#185FA5", color: "#fff", cursor: "pointer",
          fontFamily: "inherit", fontSize: 14, fontWeight: 500,
        }}>Sign in</button>
      )}
    </div>
  );

  // Per-sub-tab signed-out copy. Until 2026-05-04 every sub-tab fell
  // through to a single generic "Sign in to see your watchlist" prompt
  // because an outer !user guard short-circuited before the sub-tab
  // dispatch — meaning Searches and Lists carried specific copy that
  // never rendered. The outer guard now picks from this map so each
  // sub-tab pitches the feature it actually unlocks.
  const SIGNED_OUT_BY_SUBTAB = {
    listings: {
      heading: "Sign in to save listings",
      blurb: "Heart any dealer listing to save it here. Your saved set syncs across every device you use, and each entry keeps the price you saved at — even after the dealer takes the listing down.",
    },
    auctions: {
      heading: "Sign in to follow auctions",
      blurb: "Heart any auction-house lot from the Listings feed, or paste an eBay URL with + Track eBay item, to follow it through to hammer. Bids, estimates, and end times stay current as the sale unfolds.",
    },
    sold: {
      heading: "Sign in to track what sold",
      blurb: "When something in your saved set sells — at a dealer or under the hammer — it lands here with the sold price preserved. A running reference for what comparable watches actually cleared at.",
    },
    searches: {
      heading: "Sign in to use saved searches",
      blurb: "Save the queries you keep coming back to — a reference, a brand cut, a phrase you scan for. Each one runs across every dealer in the feed and tells you when something new matches.",
    },
    collections: {
      heading: "Sign in to use lists",
      blurb: "Group watches by reference, theme, or research thread — \"Rolex 5513s\", \"Vintage divers\", \"Reference comps\". Lists sync across every device you use, and you can share any list with one tap.",
    },
  };
  const signedOutCopy = SIGNED_OUT_BY_SUBTAB[watchTopTab] || SIGNED_OUT_BY_SUBTAB.listings;

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
  // into the Watchlist tab. Signed-out fallback handled by the outer
  // !user branch in render() via SIGNED_OUT_BY_SUBTAB.
  const searchesTabJSX = (
    <div style={{ paddingTop: 4 }}>
      {/* Intro banner — mirrors the Lists sub-tab pattern (2026-05-04)
          so the two "add a thing" sub-tabs read consistently. The
          + button used to live in the Watchlist sub-tab strip, but
          that pushed the strip into a horizontal scroller on mobile;
          now it sits inline with the section blurb. */}
      <SubTabIntro
        title="Saved searches run on tap"
        blurb={<>Save the queries you keep coming back to — a reference, a brand cut, a phrase you scan for. Each one runs across every dealer in the feed and tells you when something new matches.</>}
        actionLabel="+ Add search"
        onAction={startAddSearch}
      />

      {/* eBay source-searches block (data/ebay_searches.json + GitHub
          edit link) was removed from this view 2026-05-06 per Mark
          ("remove the source ebay section from this page. I want to
          manage these searches directly in the code"). The data
          still feeds the scraper from data/ebay_searches.json — only
          the UI surface is gone. The hook is left out for now; if
          the surface is restored, re-add useEBaySearches +
          EBAY_SEARCHES_EDIT_URL imports and the JSX block from git
          history. */}

      {/* Saved searches — user-defined filters over the existing feed. */}
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

  // (COLLECTIONS SUB-TAB block removed 2026-05-06 PR #86 —
  //  the Lists sub-tab moved to a top-level Collections tab.
  //  CollectionsTab.js renders what used to live here.)



  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div>
      {importBannerJSX}
      {!user ? signInPromptJSX(signedOutCopy.heading, signedOutCopy.blurb) : (
        <>
          {/* Sub-tab strip + Track / Add-search trigger lifted to
              App.js (watchSubTabsJSX) so they sit between the main
              tab strip and the filter row, above the page content.
              WatchlistTab now only renders the active sub-tab's
              content — the parent App.js controls watchTopTab state
              + the strip render. */}

          {(watchTopTab === "listings" || watchTopTab === "auctions" || watchTopTab === "sold") && (<>
          {/* (Saved auctions intro banner removed 2026-05-05 per Mark.
              Was a SubTabIntro pitching the +Track eBay item flow
              alongside auction-house hearts from the Listings feed;
              cluttered the sub-tab when 95% of saved auction items
              now flow through hearts on the unified feed.) */}
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
                    onView={observeCard}
                    onClickListing={onClickListing}
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

          {/* (Lists sub-tab removed 2026-05-06 PR #86 — moved to the
              new top-level Collections tab.) */}
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
