import React from "react";
import { SearchIcon, FilterIcon, TabIcon } from "./icons";
import { Chip } from "./Chip";
import { AboutModal } from "./AboutModal";
import { SignInPromptModal } from "./SignInPromptModal";
import { ViewSettingsControls } from "./ViewSettingsControls";
import { iconButton, pillBase, inputBase } from "../styles";

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
    DEALER_SOURCES, AUCTION_SOURCES,
    // State
    aboutModalOpen, allFiltered, displayedCount, brandsExpanded,
    currentIsSaved, drawerOpen,
    filterBrands, filterSources,
    listingsSubTab,
    hasFilters, hiddenItems,
    maxPriceText, minPriceText,
    filterHearted,
    search, signInPromptOpen, signInWithGoogle, sort, sourcesExpanded,
    tab, user, visibleBrands, visibleSources,
    watchTopTab, watchlist,
    // Setters / handlers
    handleWish, openFavPrompt, resetFilters,
    setAboutModalOpen, setBrandsExpanded,
    setDrawerOpen,
    setFilterHearted,
    setMaxPriceText, setMinPriceText,
    setPage, setSearch, setSignInPromptOpen, setSort,
    setSourcePickerOpen, setSourcesExpanded,
    setTab,
    toggleBrand, toggleHide, toggleSource,
    // Style tokens / pre-built JSX
    addSearchModalJSX,
    authJSX, baseStyle,
    collectionEditModalJSX, collectionPickerModalJSX,
    favSearchModalJSX,
    adminTabJSX, homeTabJSX, newUi, listingsGridJSX, listingsTabContentJSX, primaryCurrency, sectionHeadingStyle,
    // View-settings (2026-05-09): rendered inline in the filter
    // drawer so currency / theme / columns are one tap from the
    // current view rather than buried behind Settings.
    setPrimaryCurrency,
    dark, setDarkOverride,
    mobileCols, setMobileCols,
    desktopCols, setDesktopCols, desktopAutoCols,
    settingsModalJSX, shareReceiverJSX,
    challengeReceiverJSX,
    listReceiverJSX,
    listingsSubTabsJSX,
    trackNewItemModalJSX, watchSubTabsJSX, watchHeartedToggleJSX, collectionsSubTabsJSX, watchlistTabJSX,
    referencesTabJSX, collectionsTabJSX,
    lotMigrationBannerJSX,
    userLimitBannerJSX,
    shareActive,
    challengeShareActive,
    listShareActive,
    colDrillInId,
  } = props;
  // Any of the three receive-flows swallows the regular browse chrome.
  const anyShareActive = shareActive || challengeShareActive || listShareActive;
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
  const noFilterableList =
    (tab === "listings" && listingsSubTab === "calendar") ||
    (tab === "watchlist" && watchTopTab === "searches") ||
    (tab === "watchlist" && (watchTopTab === "my-collection" || watchTopTab === "wishlist" || watchTopTab === "challenges")) ||
    (tab === "watchlist" && watchTopTab === "lists" && !inListsDrillIn) ||
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
        <div style={{ padding: "2px 16px 0" }}>
          {/* Tap the title to jump back to Available (home). */}
          <button onClick={() => { setTab(newUi ? "home" : "listings"); setPage(1); }}
            style={{ background: "none", border: "none", cursor: "pointer",
                    padding: 0, fontFamily: "inherit",
                    fontSize: 15, fontWeight: 600, letterSpacing: "-0.3px",
                    color: "var(--text1)" }}>
            Watchlist
          </button>
        </div>
        {/* Sticky stack: search row (with filter + dark-mode buttons) and
            sort/clear pills row. Stays pinned to the viewport top so
            filters are one tap away at any scroll depth. */}
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px 4px", borderBottom: "0.5px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", borderRadius: 10, padding: "7px 12px", flex: 1, minWidth: 0 }}>
            <SearchIcon />
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
              placeholder="Search reference or brand..." style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, color: "var(--text1)", outline: "none", fontFamily: "inherit", minWidth: 0 }} />
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          {!noFilterableList && (
            <button onClick={() => { setDrawerOpen(true); setSourcePickerOpen(false); }} aria-label="Filters" style={iconButton({ active: hasFilters })}>
              <FilterIcon />
            </button>
          )}
          {authJSX}
        </div>
        {/* Sort row — only when the current sub-tab has a filterable
            list. Otherwise render a spacer of the same height so
            sub-tab switching doesn't pop content up. Hidden during
            share-receive landing so the recipient sees the focused
            card without browse chrome above it. */}
        {!anyShareActive && noFilterableList && (
          <div style={{ display: "flex", gap: 6, padding: "4px 16px 6px", borderBottom: "0.5px solid var(--border)", alignItems: "center" }}>
            <span style={{ fontSize: 13, padding: "9px 14px", borderRadius: 20, border: "0.5px solid transparent", visibility: "hidden" }}>placeholder</span>
          </div>
        )}
        {!anyShareActive && !noFilterableList && (
        <div style={{ display: "flex", gap: 6, padding: "4px 16px 6px", borderBottom: "0.5px solid var(--border)", position: "relative", alignItems: "center", overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {/* Fixed-width count slot (2026-05-09) so the pills don't
              jitter horizontally when the count drops from 4-digit
              (3309) to 3-digit (136) on filter toggles. Right-align
              within the slot so the digit comma stays consistent. */}
          <span style={{
            fontSize: 12, color: "var(--text3)", marginRight: 2, flexShrink: 0,
            minWidth: 38, textAlign: "right",
          }}>{displayedCount}</span>
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
          {/* Lot # pill retired 2026-05-07 (Mark feedback) — catalog
              ordering is now baked into the default Date sort via
              endingSoonComparator's lot_number tiebreaker. */}
          {/* ♥ Saved-only filter pill — Listings + Home, signed-in
              only. Moved out of the filter drawer 2026-05-07 (Mark
              feedback: should sit next to Date and Price for
              parity with desktop). Hidden on Calendar (no items).
              On Home the click routes to Listings via the
              interact-routes effect in App.js. */}
          {(tab === "listings" || tab === "home") && user && listingsSubTab !== "calendar" && (
            <button onClick={() => setFilterHearted && setFilterHearted(!filterHearted)}
              aria-pressed={!!filterHearted}
              title={filterHearted ? "Show all" : "Show only saved"}
              style={{
                ...pillBase(!!filterHearted),
                background: filterHearted ? "var(--brand)" : "transparent",
                color:      filterHearted ? "#fff" : "var(--text2)",
                boxShadow:  filterHearted ? "none" : "inset 0 0 0 0.5px var(--border)",
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
          {/* Compact "clear filters" — just a small × icon to keep the
              row from wrapping when filters are set. The text version
              ("× Clear") got cropped at narrow widths. Sized to match
              pill height (2026-05-09) so the row doesn't grow taller
              when filters become active. */}
          {hasFilters && (
            <button onClick={resetFilters} aria-label="Clear all filters" title="Clear all filters"
              style={{
                marginLeft: "auto", flexShrink: 0,
                width: 30, height: 30, borderRadius: "50%",
                border: "none", outline: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 16, lineHeight: 1, padding: 0,
                background: "transparent", color: "var(--brand)",
                boxShadow: "inset 0 0 0 0.5px var(--brand)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>×</button>
          )}
        </div>
        )}
        {/* Sub-tab strips — Listings strip on tab=listings, the
            unified Saved strip on tab=watchlist (which now combines
            the Watchlist + old Collections sub-tabs after Bundle 2A.2
            collapsed Collections into Saved). Lifted into the sticky
            stack so they survive scroll. Hidden during share-receive
            landing for the same reason as the sort row above. */}
        {!anyShareActive && listingsSubTabsJSX}
        {!anyShareActive && watchSubTabsJSX}
        {/* watchHeartedToggleJSX is embedded inside the sort/filter
            row above (2026-05-08 — Mark feedback) so the
            Listings/Auctions/Sold pills sit on the same line as
            Date/Price/Hearted rather than a separate row. */}
        {/* collectionsSubTabsJSX retired in Bundle 2A.2 (renders null);
            the prop is kept on the destructure for backward compat
            with the mock fixture. */}
        </div>
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
          <div style={{ padding: `${tab === "watchlist" ? 0 : 12}px 16px 100px` }}>
            {/* (Ending-soon pinned section retired 2026-05-04 —
                Watchlist > Saved auctions sub-tab IS the ending-soon
                view now.) */}
            {/* Bundle 2A.2 (2026-05-07): Collections is no longer a
                top-level tab — its content renders inside the Saved
                tab (`tab === "watchlist"`) via the `watchlistTabJSX`
                prop, which App.js dispatches between Watchlist and
                Collections content based on the active sub-tab. */}
            {tab === "home" ? homeTabJSX
              : tab === "listings" ? listingsTabContentJSX
              : tab === "references" ? referencesTabJSX
              : tab === "admin" ? adminTabJSX
              : watchlistTabJSX}
          </div>
        )}
        {trackNewItemModalJSX}
        {addSearchModalJSX}
        {collectionEditModalJSX}
        {collectionPickerModalJSX}
        {settingsModalJSX}
        {/* Bottom tab bar. The container reserves the iOS home-indicator
            safe area PLUS a fixed extra padding, so the buttons aren't
            hugging the home bar when the app is launched standalone from
            the home screen. */}
        {/* Bottom nav background uses --surface (slightly lifted from
            --bg) so light-mode contrast against the page content is
            visible. Pre-2026-05-07 this used --bg, which made the
            bar disappear into the page in light mode (Mark feedback).
            Border on top is doubled (1px) for the same reason. Dark
            mode is unchanged in feel since --surface is dark there. */}
        {/* Bottom nav: paddingBottom uses env(safe-area-inset-bottom)
            for the iPhone home indicator. Bumped to +12 (was +4) on
            2026-05-09 — in iOS PWA standalone mode the previous 4px
            was tight enough that taps on the active tab pill caught
            the system swipe-up gesture, sometimes invoking Siri
            instead of the pill. +12 keeps the nav clear of the
            indicator without burning real estate in Safari (where
            env() resolves to 0). */}
        {/* Bottom nav, iter 3 — Mark report: 0.55-alpha olive read
            as grey because #3b4a36 is a desaturated army-olive by
            design; on a white page bg the transparency mutes it
            further. Now SOLID #3b4a36 at full alpha and 2px so the
            favicon green is unmistakable. Wider 0.30-alpha drop
            shadow underneath for depth. */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          display: "flex",
          background: "var(--surface)",
          borderTop: "2px solid #3b4a36",
          boxShadow: "0 -8px 20px rgba(59, 74, 54, 0.30)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        }}>
          {/* Admin is desktop-only — mobile bottom bar shows
              Listings / Saved / Learn (3 pills, fits cleanly on
              375px viewports). Bundle 2A.2 (2026-05-07) collapsed
              the standalone Collections tab into Saved; Learn
              replaces what used to be the Collections pill on
              mobile (Mark's call: Learn deserves bottom-nav
              prominence over the now-folded Collections). */}
          {[["listings", "Listings"], ["watchlist", "Watchlists"], ["references", "Learn"]].map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); if (key === "listings") setSearch(""); }} style={{ flex: 1, padding: "8px 0 6px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: tab === key ? "var(--text1)" : "var(--text3)", fontWeight: tab === key ? 500 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {tab === key
                ? <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--brand)" }} />
                : <TabIcon kind={key} />}
              <span>{label}</span>
            </button>
          ))}
        </div>


        {/* Mobile drawer */}
        {drawerOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
            <div onClick={() => setDrawerOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "var(--bg)", borderRadius: "16px 16px 0 0", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>

              {/* Drawer handle */}
              <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)" }} />
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
                      {showDealerSources && (DEALER_SOURCES?.length || 0) > 0 && (
                        <>
                          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", margin: "2px 0 6px" }}>Dealers</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(DEALER_SOURCES || []).map(s => <Chip key={s} label={s} active={filterSources.includes(s)} onClick={() => toggleSource(s)} />)}
                          </div>
                        </>
                      )}
                      {showAuctionSources && (AUCTION_SOURCES?.length || 0) > 0 && (
                        <>
                          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", margin: showDealerSources ? "10px 0 6px" : "2px 0 6px" }}>Auction houses</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(AUCTION_SOURCES || []).map(s => <Chip key={s} label={s} active={filterSources.includes(s)} onClick={() => toggleSource(s)} />)}
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
                      {SOURCES.length > SOURCES_SHOW && <Chip label={`+${SOURCES.length - SOURCES_SHOW} more`} active={false} onClick={() => setSourcesExpanded(true)} blue />}
                    </div>
                  )}
                </div>
                <div style={{ height: "0.5px", background: "var(--border)", margin: "0 16px 0" }} />

                <div style={{ padding: "8px 16px 6px" }}>
                  <div style={sectionHeadingStyle}>Brand</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {visibleBrands.map(b => <Chip key={b} label={b} active={filterBrands.includes(b)} onClick={() => toggleBrand(b)} />)}
                    {BRANDS.length > BRANDS_SHOW && <Chip label={brandsExpanded ? "Less ↑" : `+${BRANDS.length - BRANDS_SHOW} more`} active={false} onClick={() => setBrandsExpanded(!brandsExpanded)} blue />}
                  </div>
                </div>
                <div style={{ height: "0.5px", background: "var(--border)", margin: "0 16px 0" }} />

                <div style={{ padding: "8px 16px 6px" }}>
                  <div style={sectionHeadingStyle}>Price range</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={minPriceText} onChange={e => setMinPriceText(e.target.value)} placeholder="Min $" style={{ ...inputBase, flex: 1 }} />
                    <span style={{ fontSize: 12, color: "var(--text3)", flexShrink: 0 }}>to</span>
                    <input value={maxPriceText} onChange={e => setMaxPriceText(e.target.value)} placeholder="Max $" style={{ ...inputBase, flex: 1 }} />
                  </div>
                </div>

                {/* View settings inline in the filter drawer (2026-05-09).
                    User feedback: currency / theme / columns were too
                    buried behind the Settings modal. They live here so a
                    quick comparison-shop currency swap is one tap from
                    the current filter state. */}
                <div style={{ height: "0.5px", background: "var(--border)", margin: "0 16px 0" }} />
                <div style={{ padding: "8px 16px 8px" }}>
                  <div style={sectionHeadingStyle}>View settings</div>
                  <ViewSettingsControls
                    primaryCurrency={primaryCurrency}
                    setPrimaryCurrency={setPrimaryCurrency}
                    isMobile={true}
                    dark={dark}
                    setDarkOverride={setDarkOverride}
                    mobileCols={mobileCols}
                    setMobileCols={setMobileCols}
                    desktopCols={desktopCols}
                    setDesktopCols={setDesktopCols}
                    desktopAutoCols={desktopAutoCols}
                    compact={true}
                  />
                </div>
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
                  <button onClick={() => setDrawerOpen(false)} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: "var(--text1)", color: "var(--bg)", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
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
