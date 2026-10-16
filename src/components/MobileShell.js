import React, { useEffect } from "react";
import { SearchIcon, FilterIcon, HomeIcon } from "./icons";
import { Chip } from "./Chip";
import { AboutModal } from "./AboutModal";
import { SavedHeartLink } from "./SavedHeartLink";
import { MagazineBrandRow, MagazineTabRow } from "./MagazineShellBar";
import { SignInPromptModal } from "./SignInPromptModal";
import { pillBase, inputBase } from "../styles";

// Mobile shell — receives everything the mobile branch needs from
// App.js as a single props bag. Extracted 2026-04-30 (Stage 2 of
// recommendation #1) so App.js owns state/handlers and shells own
// presentation. App.js builds the props bag once and passes the same
// shape to whichever shell renders.
//
// JSX consts (authJSX, listingsGridJSX, watchSubTabsJSX, etc.) are
// constructed in App.js and passed through pre-built — they reference
// state and component-tree pieces that live above the shell boundary.
export function MobileShell(props) {
  const {
    // Catalog / aliases
    BRANDS, BRANDS_SHOW, SOURCES, SOURCES_SHOW,
    effectiveBrandsCount = 0, effectiveSourcesCount = 0, effectiveModelsCount = 0,
    DEALER_SOURCES, AUCTION_SOURCES,
    // State
    aboutModalOpen, allFiltered, displayedCount, brandsExpanded,
    currentIsSaved, drawerOpen,
    filterBrands, filterSources, filterModels,
    listingsSubTab,
    referencesSubTab,
    hasFilters, hiddenItems,
    maxPriceText, minPriceText,
    filterHearted,
    search, signInPromptOpen, signInWithGoogle, sort, sourcesExpanded, modelsExpanded,
    tab, user, visibleBrands, visibleSources, visibleModels,
    MODELS, MODELS_SHOW,
    watchTopTab, watchlist,
    // Setters / handlers
    handleWish, openFavPrompt, resetFilters,
    goToSaved,
    onOpenCalendar,
    setAboutModalOpen, setBrandsExpanded, setModelsExpanded,
    setDrawerOpen,
    setFilterHearted, setFilterModels,
    setMaxPriceText, setMinPriceText,
    setListingsSubTab,
    setPage, setSearch, setSignInPromptOpen, setSort,
    setSourcePickerOpen, setSourcesExpanded,
    setTab,
    toggleBrand, toggleHide, toggleSource, toggleModel,
    // Style tokens / pre-built JSX
    addSearchModalJSX,
    authJSX, baseStyle,
    collectionEditModalJSX, collectionPickerModalJSX,
    favSearchModalJSX,
    adminTabJSX, homeTabJSX, listingsGridJSX, listingsTabContentJSX, primaryCurrency, sectionHeadingStyle,
    // View settings (currency/theme/columns) moved to Display settings in the
    // avatar menu (SettingsModal); removed from the filter tray — Mark 2026-05-27.
    settingsModalJSX, shareReceiverJSX,
    challengeReceiverJSX,
    listReceiverJSX,
    catalogReceiverJSX,
    listingsSubTabsJSX,
    topTabs,
    // `?look=new` (src/lookFlag.js): the magazine's look in the top rows.
    lookNew, chromeFaces,
    trackNewItemModalJSX, watchSubTabsJSX, watchHeartedToggleJSX, collectionsSubTabsJSX, watchlistTabJSX,
    saleContextHeaderJSX,
    catalogFullPage,
    catalogBarJSX,
    catalogActionRowJSX,
    savedHeaderJSX,
    watchboxTabJSX,
    referencesTabJSX, collectionsTabJSX,
    lotMigrationBannerJSX,
    userLimitBannerJSX,
    identityBandJSX,
    searchAllResultsJSX,
    searchAllActive,
    shareActive,
    challengeShareActive,
    listShareActive,
    catalogShareActive,
    colDrillInId,
  } = props;
  // Escape closes the filter drawer (B-63, audit:2026-06-06 U-08) —
  // same listener pattern as ConfirmModal / the CardShell ⋯ menu. Less
  // common on touch, but iPads-with-keyboards and the desktop-narrow
  // layout hit this shell too, and a dead Escape on an open sheet is
  // the "I'm stuck" moment the audit flagged. Self-gates on drawerOpen.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, setDrawerOpen]);

  // Any of the receive-flows swallows the regular browse chrome.
  const anyShareActive = shareActive || challengeShareActive || listShareActive || catalogShareActive;
  // True when drilled into a list (Watchlists > Lists > [list]).
  // Filter row shows here so users can date-sort, narrow by source/
  // brand etc. inside a long list — same UX as the Listings tab.
  const inListsDrillIn = tab === "watchlist" && watchTopTab === "lists" && !!colDrillInId;

  // Listings sub-tab gates filter exposure (mirror of DesktopShell).
  const showDealerSources  = !(tab === "listings" && listingsSubTab === "auctions");
  const showAuctionSources = !(tab === "listings" && listingsSubTab === "live");
  // Filter button + sort row hidden on Calendar sub-tab, on
  // Watchlist sub-tabs that don't show a filterable list, and
  // anywhere in the Collections / References / Admin tabs.
  // Lists drill-in is the exception: when colDrillInId is set we
  // re-enable the filter chrome so the user can narrow inside the
  // list (mirrors Listings tab behavior).
  // Empty Saved suppression (audit:2026-06-06 U-11): with zero hearted
  // items (signed-out, or signed-in before the first ♡) the hearted view
  // showed sort pills + a "0" count above the empty state — controls for
  // a list with nothing in it, and the "0" reads as a scorecard on a
  // screen whose job is to invite. No filter can change an empty
  // underlying list, so the row carries no function — let the empty
  // state own the screen. (Mirrored in DesktopShell.)
  const savedHeartedEmpty =
    ((tab === "watchlist" && watchTopTab === "hearted") ||
     // The Saved slice of Watches (2026-07-30 IA move) — same suppression.
     (tab === "listings" && listingsSubTab === "saved")) &&
    Object.keys(watchlist || {}).length === 0;

  const noFilterableList =
    tab === "home" ||
    (tab === "listings" && listingsSubTab === "calendar") ||
    // Lists tab: only the Hearted surface (and a drilled-in list) is a
    // filterable grid. Lists-landing / Searches / Shared have no filter row.
    (tab === "watchlist" && watchTopTab !== "hearted" && !inListsDrillIn) ||
    savedHeartedEmpty ||
    tab === "references" ||
    tab === "admin";

  return (
      <div style={baseStyle}>
        {/* "Watchlist" title sits OUTSIDE the sticky wrapper — it scrolls
            off screen as you pan down, leaving just the sticky search +
            sort rows pinned to the top. No JS needed; this is pure CSS
            flow + sticky positioning. Padding tightened 2026-05-07
            (Mark feedback: top of mobile browser had too much padding
            around the title block). */}
        {/* Title block tightened again 2026-05-09 — Mark report:
            in iOS Safari the URL bar + our chrome ate ~200px before
            content, leaving only one row of cards visible above the
            fold. Reduced font + padding here saves ~14px without
            losing the home-tap affordance. */}
        {/* Top wordmark row. On Home, the editorial hero in the body
            is the canonical brand mark — render only the About link
            (right-aligned) and skip the redundant top wordmark. On
            every other tab, render wordmark + About so the home-tap
            affordance stays where users expect it. */}
        {/* Title block tightened again 2026-05-12 — Mark feedback: most
            users hit the site via mobile browser (not the PWA bookmark)
            so the URL bar + our chrome eat the top of the viewport
            twice. Trimmed vertical padding 6/4 → 2/2 and dropped the
            28px min-height; the wordmark's own line-height takes the
            row height, no minimum needed. */}
        {/* Row 1 — brand row (wordmark + auth/menu). Suppressed on
            Home (Mark feedback 2026-05-21: "could tabs and login
            circle be aligned - wasting space"). On Home the row was
            [empty span] [M] and the tabs row was [tabs] [empty] —
            both wasted opposite halves. Tabs + M merge into Row 2
            below when on Home; brand row stays on every other tab
            as the wordmark home-tap affordance. */}
        {/* Brand row — ALWAYS renders so the auth pill (M circle)
            sits at top-right of the viewport regardless of tab. On
            Home the wordmark + olive bg are suppressed (page stays
            neutral, editorial hero owns the brand mark); on every
            other tab the row carries the wordmark left + auth right
            on olive. Same screen position for the M either way. */}
        {/* Olive chrome must OR-in the receive flags, not gate on tab!=="home" alone: onOlive = tab!=="home" || anyShareActive || searchAllActive. Share/search-all surfaces leave tab unchanged. */}
        {/* Brand/masthead row is suppressed in the auction-catalog full-page
            takeover (Mark 2026-06-13) — the pinned green bar (catalogBarJSX,
            rendered as the first child of the sticky stack below) owns the top
            of the viewport there. */}
        {/* Home is the magazine, and MagazineChrome carries the wordmark,
            the saved heart and the account control in its own pinned
            masthead. Rendering this row there put a SECOND hamburger /
            account control above the masthead (Mark, 2026-09-08). Desktop
            already suppressed its equivalent overlay bar (`minimalTopBar`
            returns null); mobile had been missed. Share / search-all
            surfaces keep tab="home" but are NOT the magazine, so they keep
            the row. */}
        {!catalogFullPage && !(tab === "home" && !anyShareActive && !searchAllActive) && lookNew && (
          <MagazineBrandRow
            authJSX={authJSX}
            showSaved={!!(user && goToSaved)}
            onSavedClick={goToSaved}
            onHome={() => { setTab("home"); setPage(1); }}
            faces={chromeFaces}
          />
        )}
        {!catalogFullPage && !(tab === "home" && !anyShareActive && !searchAllActive) && !lookNew && (
        <div style={{
          padding: "8px 16px 8px",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          display: "flex", alignItems: "center",
          justifyContent: tab === "home" && !anyShareActive && !searchAllActive
            ? "flex-end"
            : "space-between",
          gap: 12,
          background: (tab === "home" && !anyShareActive && !searchAllActive)
            ? "transparent"
            : "var(--brand-olive)",
          borderBottom: (tab === "home" && !anyShareActive && !searchAllActive)
            ? "none"
            : "1px solid rgba(255,255,255,0.12)",
        }}>
          {(tab !== "home" || anyShareActive || searchAllActive) && (
            <button onClick={() => { setTab("home"); setPage(1); }}
              aria-label="Home" title="Home"
              style={{ background: "none", border: "none", cursor: "pointer",
                      padding: 0, paddingLeft: "0.14em", fontFamily: "inherit",
                      fontSize: 18, fontWeight: 700, letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "#ffffff",
                      // Home icon (Mark 2026-05-28) — same affordance as desktop.
                      display: "inline-flex", alignItems: "center", gap: 7 }}>
              <HomeIcon size={16} />
              <span>Watchlist</span>
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Heart shortcut to Saved ▸ ♡ Saved — desktop parity (P-7,
                2026-06-03). White outline on the olive bar, like desktop. */}
            {user && goToSaved && (
              <SavedHeartLink onGo={goToSaved}
                onOlive={tab !== "home" || anyShareActive || searchAllActive} />
            )}
            {authJSX}
          </div>
        </div>
        )}
        {/* Sticky stack: main tabs + sub-tabs + search + sort/filter.
            Stays pinned to the viewport top so the whole nav + filter
            chrome is reachable at any scroll depth.

            B-03 (2026-05-24, Mark): the main-tab pills used to be a
            NON-sticky "Row 2" above this block, so they scrolled away —
            you couldn't switch tabs without scrolling back up. They now
            live as the FIRST child of this sticky stack (same move a
            prior PR made for the sub-tabs), so main tabs stay visible on
            every tab. The wordmark brand row above stays non-sticky so
            the pinned chrome stays compact.

            Suppressed on Home (HomeTab renders its own sticky olive band,
            B-07/B-10). Also hidden in cross-tab Search-all
            (SearchResultsView has its own header + Exit) — note: this
            means the main tabs are not shown during Search-all, where the
            old non-sticky Row 2 used to show them. */}
        {tab !== "home" && !searchAllActive && (
        <div data-sticky-chrome style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--bg)" }}>
        {/* Main tab pills (Listings / Watchlists / Collecting) — B-03:
            first child of the sticky stack. Always olive inside the
            chrome (tab !== "home"), matching the core-tab chrome. */}
        {/* Auction-catalog takeover (Mark 2026-06-13): the green title bar +
            action row replace the main-tab pills as the pinned first child of
            the sticky stack, so the bar stays put while the lots scroll. */}
        {catalogFullPage ? (
          <>{catalogBarJSX}{catalogActionRowJSX}</>
        ) : lookNew ? (
          <MagazineTabRow tabs={topTabs} faces={chromeFaces} />
        ) : (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "0 16px",
          background: "var(--brand-olive)",
          borderBottom: "none",
        }}>
          <div style={{
            display: "flex", gap: 0,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            flex: 1, minWidth: 0,
          }}>
            {/* Top tabs render from the shared `topTabs` model (App.js builds
                it from src/topTabs.js) — labels/active/onSelect arrive
                pre-computed so this strip can't drift from desktop/Home.
                Mobile uses the short label ("Guides"). */}
            {(topTabs || []).map((t) => {
              const { key, active } = t;
              const label = t.mobileLabel;
              // Always on olive here (the sticky chrome only renders when
              // tab !== "home"), so active = white, inactive = faded white.
              const onOlive = true;
              return (
                <button key={key}
                  onClick={t.onSelect}
                  style={{
                    padding: "8px 14px 8px 0",
                    marginRight: 18,
                    background: "transparent",
                    border: "none",
                    borderBottom: active
                      ? `2px solid ${onOlive ? "#ffffff" : "var(--brand-olive-text)"}`
                      : "2px solid transparent",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    color: active
                      ? (onOlive ? "#ffffff" : "var(--brand-olive-text)")
                      : (onOlive ? "rgba(255,255,255,0.65)" : "var(--text3)"),
                    whiteSpace: "nowrap",
                    letterSpacing: "0.01em",
                  }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        )}
        {/* Sub-tabs strip — anchored at the TOP of the sticky stack
            2026-05-21 (PR_Y3, Mark feedback). Sub-tabs sit above the
            search row so they read as a continuation of main-nav
            chrome (main tabs → sub-tabs → search/filter). Also fixes
            the Collecting inconsistency — referencesSubTabsJSX is
            now lifted to App.js (was inside ReferencesTab) so all
            three tabs hit the same shell-level slot. */}
        {!anyShareActive && !catalogFullPage && listingsSubTabsJSX}
        {!anyShareActive && !catalogFullPage && watchSubTabsJSX}
        {/* referencesSubTabsJSX retired 2026-06-03 — Articles + Reference
            Guides are top-level tabs now; the tools family launches from
            the account menu. */}
        {/* Identity band — moved into the sticky chrome stack 2026-05-21
            (PR_Y4, Mark spec: "search and filter pills below the black
            block"). Sits between sub-tabs and the search row so the
            section header is the first thing below the navigation and
            the search/filters apply to that named section. */}
        {!anyShareActive && !catalogFullPage && identityBandJSX}
        {/* Search row — hidden on:
            - The entire Watchlists tab (Mark spec 2026-05-21).
            - Listings > Auction calendar (Mark spec 2026-05-22).
            - Collecting > Size comparison + Links (Mark spec
              2026-05-22: "no need to have search on size
              comparison or links"). Editorial keeps search (its
              filter strip has its own inline input on desktop;
              mobile uses the shell search row here). */}
        {/* Catalog header moved OUT of the sticky chrome into the scroll body
            (Mark 2026-06-02) so it scrolls away while the tabs + filter pills
            stay pinned — see the saleContextHeaderJSX render in the body
            below. */}
        {tab !== "watchlist"
          && !(tab === "listings" && listingsSubTab === "calendar")
          && !(tab === "references" && referencesSubTab !== "editorial")
          && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px 4px", borderBottom: "0.5px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "0.5px solid var(--border)", borderRadius: 10, padding: "8px 12px", flex: 1, minWidth: 0 }}>
            <SearchIcon />
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key !== "Enter") return;
                e.target.blur();
                // On Home, the typed query has nowhere to land visually
                // (Home is editorial strips, not a filtered grid), so
                // Enter takes the user to Listings with the query
                // applied. Mirrors what HomeSearchBar's submit does on
                // desktop. Mark report 2026-05-17: "Search on home
                // landing page on mobile doesn't filter results. Can
                // type but can't press enter and no options for
                // surface to search."
                if (tab === "home" && search.trim() && setListingsSubTab) {
                  setTab("listings");
                  setListingsSubTab("live");
                  setPage(1);
                }
              }}
              placeholder={tab === "references" ? "Search articles by title, author, body…" : "Search brand, model, or reference…"} style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, color: "var(--text1)", outline: "none", fontFamily: "inherit", minWidth: 0 }} />
            {search && user && (
              <button onClick={openFavPrompt} aria-label={currentIsSaved ? "Already saved" : "Save search as favorite"}
                title={currentIsSaved ? "Saved to favorites" : "Save as favorite search"}
                disabled={currentIsSaved}
                style={{ flexShrink: 0, background: "none", border: "none",
                        cursor: currentIsSaved ? "default" : "pointer",
                        color: currentIsSaved ? "var(--brand)" : "var(--text3)",
                        padding: 2, fontFamily: "inherit",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill={currentIsSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            )}
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search"
                style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer",
                        color: "var(--text3)", padding: 2, fontFamily: "inherit",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          {!noFilterableList && (
            // Icon + the word "Filter", not icon-only (audit:2026-06-06
            // U-04): the filter sheet behind this button tested great, but
            // a first-time user never opened it — she scans for words, not
            // icons. Pill chrome matches the bar's pill language; active
            // state still signals filters-applied.
            <button onClick={() => { setDrawerOpen(true); setSourcePickerOpen(false); }} aria-label="Filters"
              style={{ ...pillBase(hasFilters, { compact: true }),
                       display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              <FilterIcon />
              Filter
            </button>
          )}
        </div>
        )}
        {/* Home + search-with-content: render an inline tappable CTA
            that submits the query to Listings. Without it, typing into
            the mobile sticky search bar on Home produces no visible
            reaction (Home is editorial strips, not a filtered grid),
            and the input feels broken. Mirror of HomeSearchBar's
            submit on desktop. Mark report 2026-05-17. */}
        {tab === "home" && search.trim() && setListingsSubTab && (
          <button
            onClick={() => { setTab("listings"); setListingsSubTab("live"); setPage(1); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 8, width: "100%", padding: "10px 16px",
              borderBottom: "0.5px solid var(--border)",
              background: "var(--surface)", border: "none",
              cursor: "pointer", fontFamily: "inherit", fontSize: 13,
              color: "var(--text1)", textAlign: "left",
            }}
            aria-label={`Search listings for ${search.trim()}`}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <SearchIcon />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Search listings for{" "}
                <strong style={{ color: "var(--text1)" }}>“{search.trim()}”</strong>
              </span>
            </span>
            <span style={{ color: "var(--brand)", flexShrink: 0, fontWeight: 500 }}>→</span>
          </button>
        )}
        {/* Editorial filter slot (B-01, 2026-05-24): EditorialView portals
            its FilterRow + expansion panels into here on mobile, so the
            editorial filters live INSIDE this shell sticky stack — like every
            other tab's chrome — instead of a 2nd sticky layer in the body that
            collided with / squashed the search row. Empty until
            Collecting → Editorial mounts and fills it. Cross-surface
            consistency (see CLAUDE.md). */}
        {tab === "references" && <div id="editorial-filter-slot" />}
        {/* Sort/filter row — only when the current sub-tab has a
            filterable list. Hidden during share-receive landing so
            the recipient sees the focused card without browse chrome
            above it. (Previously rendered a ~40px hidden spacer here
            on filter-less sub-tabs to avoid content-jumping on
            sub-tab switch — Mark report 2026-05-12: the spacer read
            as "weird empty space" between the search row and the
            sub-tab strip on Watchlists > Lists. Dropped: the search
            row above + sub-tab strip below each carry their own
            border, so removing the spacer doesn't break the divider
            chain. Small one-time jump on switch is the tradeoff.) */}
        {/* Sub-tab strips — Listings strip on tab=listings, the
            unified Saved strip on tab=watchlist (combines the
            Watchlist + old Collections sub-tabs after Bundle 2A.2
            collapsed Collections into Saved). Anchored at the TOP of
            the sticky stack (above search) 2026-05-21 (PR_Y3, Mark
            feedback) — sub-tabs read as nav-chrome paired with the
            main tabs above, search becomes scoped to the active
            sub-tab below. */}
        {!anyShareActive && !noFilterableList && (
        <div style={{ display: "flex", gap: 6, padding: "4px 16px 6px", borderBottom: "0.5px solid var(--border)", position: "relative", alignItems: "center", overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {/* Count chip — RESTORED 2026-05-22 (Mark spec, after
              retiring the identity band that briefly carried this
              role per PR_Y1). Back at the leading edge of the sort
              row. Fixed-width so the pills don't jitter horizontally
              when the count drops from 4-digit to 3-digit on filter
              toggles. */}
          <span style={{
            fontSize: 12, color: "var(--text3)", marginRight: 2, flexShrink: 0,
            minWidth: 38, textAlign: "right",
          }}>{
            // Inside a list drill-in the bare number read as a stray "1"
            // (P-21, Mark 2026-06-03) — label it there; the dense Listings
            // row keeps the compact bare count.
            inListsDrillIn
              ? `${displayedCount} ${displayedCount === 1 ? "item" : "items"}`
              : displayedCount
          }</span>
          {/* Saved hearted-sub-tab toggle (Listings/Auctions/Sold)
              prepended into the filter row on Saved + a hearted
              sub-tab. Thin divider after the cluster so it visually
              separates from the Date / Price / Hearted controls.
              (2026-05-08 — Mark feedback: was a separate row.) */}
          {watchHeartedToggleJSX && (
            <>
              {watchHeartedToggleJSX}
              <div aria-hidden style={{ width: 1, height: 18, background: "var(--border)", margin: "0 4px", flexShrink: 0 }} />
            </>
          )}
          {/* Date sort pill — semantics depend on the active Listings
              sub-tab (newest firstSeen on Live; ending order on Live
              auctions; sold-date on All sold). Dispatch lives in
              App.js's allFiltered memo. */}
          {(() => {
            // On Home the activity grouping is the order — not a date
            // sort. Suppress active state on Home so the pill doesn't
            // imply state Home isn't in.
            const label = sort === "date" ? "Date ↓" : sort === "date-asc" ? "Date ↑" : "Date";
            const active = sort === "date" || sort === "date-asc";
            return (
              <button onClick={() => {
                if (sort === "date") setSort("date-asc");
                else if (sort === "date-asc") setSort("date");
                else setSort("date");
              }} style={pillBase(active)}>{label}</button>
            );
          })()}
          {/* Price sort pill */}
          {(() => {
            const label = sort === "price-asc" ? "Price ↑" : sort === "price-desc" ? "Price ↓" : "Price";
            const active = sort === "price-asc" || sort === "price-desc";
            return (
              <button onClick={() => {
                if (sort === "price-asc") setSort("price-desc");
                else if (sort === "price-desc") setSort("price-asc");
                else setSort("price-asc");
              }} style={pillBase(active)}>{label}</button>
            );
          })()}
          {/* (Brand/Source group pills retired 2026-06-02 — redundant with the
              Source/Brand filters; Saved is a flat newest-first grid.) */}
          {/* Lot # pill retired 2026-05-07 (Mark feedback) — catalog
              ordering is now baked into the default Date sort via
              endingSoonComparator's lot_number tiebreaker. */}
          {/* ♥ Saved-only filter pill — Listings + Home, signed-in
              only. Moved out of the filter drawer 2026-05-07 (Mark
              feedback: should sit next to Date and Price for
              parity with desktop). Hidden on Calendar (no items).
              On Home the click routes to Listings via the
              interact-routes effect in App.js. Hidden on Saved too — every
              item there is saved, so the toggle is a no-op. */}
          {tab === "listings" && user && listingsSubTab !== "calendar" && listingsSubTab !== "saved" && (
            <button onClick={() => setFilterHearted && setFilterHearted(!filterHearted)}
              aria-pressed={!!filterHearted}
              title={filterHearted ? "Show all" : "Show only saved"}
              style={{
                // Active state now comes straight from pillBase (olive
                // tinted-fill) — no blue override. Heart svg stays red below.
                ...pillBase(!!filterHearted),
                display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
              }}>
              {/* Heart always renders red (--danger) to match the
                  hearted-card overlay so this chip reads as "the
                  heart filter" at a glance. (2026-05-09 — Mark
                  feedback parity with the desktop chip.) */}
              <svg width="11" height="11" viewBox="0 0 24 24"
                fill={filterHearted ? "var(--danger)" : "none"}
                stroke="var(--danger)"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              Saved
            </button>
          )}
          {/* Auction calendar launcher (Phase 4) — on the filter row.
              Styled as a filter pill (was prominent brand-olive; 2026-05-28
              Mark wanted it consistent with the filter-line pills). Opens the
              calendar modal (the sale-picker); the active sale shows in the
              grid's sale-context header, with its own Clear there. Auction
              surfaces only. */}
          {/* Auction Calendar pill: Auctions sub-tab only. Removed from Sold
              (Mark 2026-06-14) — the calendar is upcoming sales, irrelevant to
              Sold, and dropping it lets the filter pills sit on one line. */}
          {tab === "listings" && listingsSubTab === "auctions" && onOpenCalendar && (
            <button onClick={onOpenCalendar} title="Browse the auction calendar"
              style={{
                ...pillBase(false),
                display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                whiteSpace: "nowrap",
              }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Calendar
            </button>
          )}
          {/* Filter-row "clear" removed 2026-05-28 — the single "Clear all"
              now lives in the active-filters strip next to the chips (Mark),
              not on the filter bar. */}
        </div>
        )}
        {/* watchHeartedToggleJSX is embedded inside the sort/filter
            row above (2026-05-08 — Mark feedback) so the
            Listings/Auctions/Sold pills sit on the same line as
            Date/Price/Hearted rather than a separate row. */}
        {/* collectionsSubTabsJSX retired in Bundle 2A.2 (renders null);
            the prop is kept on the destructure for backward compat
            with the mock fixture. */}
        </div>
        )}
        {/* Share-receive surface — self-contained component, hooks
            isolated. Renders null when no share intent in URL. */}
        {shareReceiverJSX}
        {/* Watch Challenges receive surface (v1.5). Same isolation
            pattern as ShareReceiver. */}
        {challengeReceiverJSX}
        {/* List-share receive surface (v1, 2026-05-07). Same
            isolation pattern. Renders null when no `?list=…&shared=1`
            in URL. */}
        {listReceiverJSX}
        {/* Auction-catalog share-receive surface (2026-06-02). */}
        {catalogReceiverJSX}
        {/* Phase B2 lot-migration banner. Same isolation pattern as
            ShareReceiver — renders null until the one-shot migration
            actually moves at least one tracked URL into Favorites. */}
        {lotMigrationBannerJSX}
        {/* User-limit banner (Epic 3). Self-contained, renders null
            below the soft-warn threshold. Fixed-position so visible
            on every tab. */}
        {userLimitBannerJSX}
        {/* When EITHER receive surface is up (single-listing or
            challenge), skip the regular tab content so the recipient
            sees a clean first-impression page. */}
        {!anyShareActive && (
          // Flat 12px top on every tab (2026-06-03 ledger audit). The old
          // `watchlist ? 0 : 12` branch meant the BODY padding, not the
          // header, decided title height per tab — Saved/Lists/Searches
          // titles sat 12px higher than Articles/Guides. One rule: the body
          // gives every tab the same 12, PageHeader owns the rest.
          <div style={{ padding: "12px 16px 32px" }}>
            {/* Collapsing header (Mark 2026-06-02): the catalog title — or the
                "Saved" title on the hearted surface — scrolls here while the
                filter pills stay pinned in the sticky chrome above. One-inset
                rule (P-5/P-6, 2026-06-03): no more edge bleed — the header sits
                at the body's 16px inset (PageHeader carries no side padding
                now), so the title + hairline share the same left edge as every
                other surface. */}
            {(() => {
              if (searchAllActive) return null;
              const h = saleContextHeaderJSX
                || (tab === "watchlist" && watchTopTab === "hearted" ? savedHeaderJSX : null);
              return h || null;
            })()}
            {/* identityBandJSX moved into the sticky chrome stack
                2026-05-21 (PR_Y4) — sits between sub-tabs and the
                search row up there. Scroll content starts clean. */}
            {/* (Ending-soon pinned section retired 2026-05-04 —
                Watchlist > Saved auctions sub-tab IS the ending-soon
                view now.) */}
            {/* Bundle 2A.2 (2026-05-07): Collections is no longer a
                top-level tab — its content renders inside the Saved
                tab (`tab === "watchlist"`) via the `watchlistTabJSX`
                prop, which App.js dispatches between Watchlist and
                Collections content based on the active sub-tab. */}
            {searchAllActive ? searchAllResultsJSX
              : tab === "home" ? homeTabJSX
              : tab === "listings" ? listingsTabContentJSX
              : tab === "references" ? referencesTabJSX
              : tab === "admin" ? adminTabJSX
              : tab === "watchbox" ? watchboxTabJSX
              : watchlistTabJSX}
          </div>
        )}
        {trackNewItemModalJSX}
        {addSearchModalJSX}
        {collectionEditModalJSX}
        {collectionPickerModalJSX}
        {settingsModalJSX}
        {/* Fixed bottom nav retired 2026-05-21 (PR_Y2): main tabs lifted
            into the top stack as Row 2. PWA mode no longer fights the
            iOS home indicator; Safari mode no longer leaves a phantom
            gap when the URL bar moves to the bottom. */}


        {/* Mobile drawer */}
        {drawerOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
            <div onClick={() => setDrawerOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "var(--bg)", borderRadius: "16px 16px 0 0", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>

              {/* Drawer handle */}
              <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
                <div style={{ width: 36, height: 4, borderRadius: 0, background: "var(--border)" }} />
              </div>

              {/* Fixed header — title + X close (Mark feedback 2026-05-20:
                  "sometimes you can't see a way out of the filter other
                  than Show watches"). The grab handle above is a swipe
                  affordance but doesn't read as a tap target; this header
                  makes the exit explicit and stays visible regardless of
                  how deep the user has scrolled into the chip list. The
                  Show CTA at the bottom commits the filter; X here
                  closes without committing further changes (filter state
                  is live anyway — every chip tap updates the result
                  count, so "close" and "apply" are functionally the same
                  on this sheet). */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "4px 16px 10px",
                borderBottom: "0.5px solid var(--border)",
                flexShrink: 0,
              }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text1)" }}>
                  Filter
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close filter"
                  style={{
                    width: 32, height: 32,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "var(--surface)",
                    border: "0.5px solid var(--border)",
                    borderRadius: "50%",
                    cursor: "pointer",
                    color: "var(--text2)",
                    fontFamily: "inherit", fontSize: 18, lineHeight: 1,
                    padding: 0,
                  }}>
                  ×
                </button>
              </div>

              {/* Scrollable filter content */}
              <div style={{ flex: 1, overflowY: "auto", padding: "0 0 8px" }}>

                {/* Status + Auctions-only sections retired 2026-05-04
                    — both Listings AND Watchlist now use sub-tabs that
                    cover Live / Sold and Dealers / Auctions scope. */}

                {/* ♥ Saved-only toggle moved to the inline sort row
                    above (next to Date / Price) on 2026-05-07 — Mark
                    feedback parity with desktop placement. */}

                <div style={{ padding: "8px 16px 6px" }}>
                  <div style={sectionHeadingStyle}>Source</div>
                  {/* Sources grouped by Dealers / Auction houses with
                      sub-headers (2026-05-04). When expanded, every
                      source in each group is shown; when collapsed,
                      only the top SOURCES_SHOW from the visible
                      (already-flat) list are surfaced — keeps the
                      drawer compact at small viewports. */}
                  {sourcesExpanded ? (
                    <>
                      {/* Expanded view: iterate the cross-axis-filtered
                          effective lists, NOT the raw catalogs — otherwise
                          tapping "+N more" reveals every source regardless
                          of what's available under the active brand /
                          sub-tab filter (Mark feedback 2026-05-20).
                          DEALER_SOURCES and AUCTION_SOURCES gate the
                          group headers; visibleSources represents the
                          full effective set when expanded. */}
                      {showDealerSources && (visibleSources || []).some(s => (DEALER_SOURCES || []).includes(s)) && (
                        <>
                          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", margin: "2px 0 6px" }}>Dealers</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(visibleSources || []).filter(s => (DEALER_SOURCES || []).includes(s)).map(s => <Chip key={s} label={s} active={filterSources.includes(s)} onClick={() => toggleSource(s)} />)}
                          </div>
                        </>
                      )}
                      {showAuctionSources && (visibleSources || []).some(s => (AUCTION_SOURCES || []).includes(s)) && (
                        <>
                          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", margin: showDealerSources ? "10px 0 6px" : "2px 0 6px" }}>Auction houses</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(visibleSources || []).filter(s => (AUCTION_SOURCES || []).includes(s)).map(s => <Chip key={s} label={s} active={filterSources.includes(s)} onClick={() => toggleSource(s)} />)}
                          </div>
                        </>
                      )}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        <Chip label="Less ↑" active={false} onClick={() => setSourcesExpanded(false)} blue />
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {/* Collapsed view: filter the flat visibleSources
                          list to only the relevant group. visibleSources
                          is a slice of SOURCES (dealers + houses unioned)
                          so we filter inline rather than threading a
                          per-sub-tab visibleSources from App.js. */}
                      {visibleSources
                        .filter(s => (showDealerSources && (DEALER_SOURCES || []).includes(s))
                                  || (showAuctionSources && (AUCTION_SOURCES || []).includes(s)))
                        .map(s => <Chip key={s} label={s} active={filterSources.includes(s)} onClick={() => toggleSource(s)} />)}
                      {effectiveSourcesCount > SOURCES_SHOW && <Chip label={`+${effectiveSourcesCount - SOURCES_SHOW} more`} active={false} onClick={() => setSourcesExpanded(true)} blue />}
                    </div>
                  )}
                </div>
                <div style={{ height: "0.5px", background: "var(--border)", margin: "0 16px 0" }} />

                <div style={{ padding: "8px 16px 6px" }}>
                  <div style={sectionHeadingStyle}>Brand</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {visibleBrands.map(b => <Chip key={b} label={b} active={filterBrands.includes(b)} onClick={() => toggleBrand(b)} />)}
                    {effectiveBrandsCount > BRANDS_SHOW && <Chip label={brandsExpanded ? "Less ↑" : `+${effectiveBrandsCount - BRANDS_SHOW} more`} active={false} onClick={() => setBrandsExpanded(!brandsExpanded)} blue />}
                  </div>
                </div>
                {(MODELS?.length || 0) > 0 && (
                  <>
                    <div style={{ height: "0.5px", background: "var(--border)", margin: "0 16px 0" }} />
                    <div style={{ padding: "8px 16px 6px" }}>
                      <div style={sectionHeadingStyle}>Model</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(visibleModels || []).map(m => (
                          <Chip key={m} label={m} active={(filterModels || []).includes(m)} onClick={() => toggleModel && toggleModel(m)} />
                        ))}
                        {effectiveModelsCount > (MODELS_SHOW || 0) && (
                          <Chip label={modelsExpanded ? "Less ↑" : `+${effectiveModelsCount - MODELS_SHOW} more`}
                                active={false} onClick={() => setModelsExpanded && setModelsExpanded(!modelsExpanded)} blue />
                        )}
                      </div>
                    </div>
                  </>
                )}
                <div style={{ height: "0.5px", background: "var(--border)", margin: "0 16px 0" }} />

                <div style={{ padding: "8px 16px 6px" }}>
                  <div style={sectionHeadingStyle}>Price range</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={minPriceText} onChange={e => setMinPriceText(e.target.value)} placeholder="Min $" style={{ ...inputBase, flex: 1 }} />
                    <span style={{ fontSize: 12, color: "var(--text3)", flexShrink: 0 }}>to</span>
                    <input value={maxPriceText} onChange={e => setMaxPriceText(e.target.value)} placeholder="Max $" style={{ ...inputBase, flex: 1 }} />
                  </div>
                </div>

                {/* View settings removed from the filter tray (Mark 2026-05-27)
                    — currency / theme / columns now live only in the avatar
                    menu's Display settings (SettingsModal). */}
              </div>

              {/* Fixed bottom actions. Show-CTA bumped slightly
                  (14px padding, fontSize 15) so the primary button
                  reads as the headline action below the now-shorter
                  filter sections. (2026-05-09 Mark feedback: "a
                  little bit more space for the show watches button".) */}
              <div style={{ borderTop: "0.5px solid var(--border)", padding: "14px 16px 16px", background: "var(--bg)" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {hasFilters && (
                    <button onClick={resetFilters} style={{ padding: "14px 16px", borderRadius: 12, border: "0.5px solid var(--border)", background: "transparent", color: "var(--text2)", fontSize: 14, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      Reset
                    </button>
                  )}
                  <button onClick={() => setDrawerOpen(false)} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: "var(--text1)", color: "var(--bg)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Show {displayedCount} watches
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
        <AboutModal
          open={aboutModalOpen}
          onClose={() => setAboutModalOpen(false)}
          primaryCurrency={primaryCurrency}
        />
        <SignInPromptModal
          open={!!signInPromptOpen}
          onClose={() => setSignInPromptOpen && setSignInPromptOpen(false)}
          onSignIn={() => signInWithGoogle && signInWithGoogle()}
        />
        {favSearchModalJSX}
      </div>
  );
}
