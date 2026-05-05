import React from "react";
import { SearchIcon, TabIcon } from "./icons";
import { Chip } from "./Chip";
import { ReferencesTab } from "./ReferencesTab";
import { AboutModal } from "./AboutModal";
import { pillBase } from "../styles";

// Desktop shell — receives everything the desktop branch needs from
// App.js as a single props bag. Stage 2 of recommendation #1 (extracted
// 2026-04-30 alongside MobileShell).
//
// filterRowJSX is built inline here rather than passed in: it's
// substantial JSX that's only ever rendered by the desktop shell, so
// it lives where it's used. dtPill is a local alias for the compact
// pill variant — used only by this shell's filter row pills.
export function DesktopShell(props) {
  const {
    // Catalog
    BRANDS, BRANDS_SHOW, SOURCES,
    DEALER_SOURCES, AUCTION_SOURCES,
    // State
    aboutModalOpen, activeFilterPop,
    brandsExpanded,
    currentIsSaved,
    filterAuctionsOnly, filterBrands, filterSources,
    listingsSubTab,
    allFiltered,
    hasFilters, hiddenItems,
    maxPriceText, minPriceText,
    search, sort,
    tab, user, visibleBrands,
    watchTopTab, watchlist,
    // Setters / handlers
    handleWish, openFavPrompt, resetFilters,
    setAboutModalOpen, setActiveFilterPop, setBrandsExpanded,
    setFilterAuctionsOnly, setFilterBrands, setFilterSources,
    setMaxPriceText, setMinPriceText,
    setPage, setSearch, setSort,
    setTab,
    toggleBrand, toggleHide, toggleSource,
    // Pre-built JSX
    addSearchModalJSX,
    authJSX, baseStyle,
    collectionEditModalJSX, collectionPickerModalJSX,
    favSearchModalJSX,
    adminTabJSX, listingsGridJSX, listingsTabContentJSX, primaryCurrency, settingsModalJSX, shareReceiverJSX, statusSegmentJSX,
    listingsSubTabsJSX,
    trackNewItemModalJSX, watchSubTabsJSX, endingSoonJSX, watchlistTabJSX,
    lotMigrationBannerJSX,
  } = props;

  // Listings sub-tab gates filter exposure: Live listings hides
  // auction-house chips (no live dealer items in those sources);
  // Live auctions hides dealer chips for the same reason. Sold +
  // Calendar show both. Watchlist tab and other main tabs always
  // see both groups.
  const showDealerSources  = !(tab === "listings" && listingsSubTab === "auctions");
  const showAuctionSources = !(tab === "listings" && listingsSubTab === "live");
  // Whether the filter row should render at all on this sub-tab.
  // Calendar sub-tab has no filterable list — hide the row.
  const showListingsFilterRow = !(tab === "listings" && listingsSubTab === "calendar");

  // Desktop sidebar retired in the April '26 filter-consolidation pass.
  // Toggle still hard-coded to null so we can revert quickly if needed.
  const sidebarToggleJSX = null;

  // Pill helper for the desktop filter row — denser padding than mobile
  // because horizontal real estate is the constraint, not tap targets.
  const dtPill = (active) => pillBase(active, { compact: true });

  const filterRowJSX = (() => {
    // Source + Brand expansion panel — chip cluster shown directly
    // below the filter row when either pill is active. Inline-expand
    // pattern (vs the prior floating popover) so all filter controls
    // share the same "tap a pill" interaction.
    const expansionPanelStyle = {
      padding: "8px 16px 12px",
      borderBottom: "0.5px solid var(--border)",
      background: "var(--surface)",
      display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
    };
    const expandedSource = activeFilterPop === "source";
    const expandedBrand  = activeFilterPop === "brand";
    return (
    <>
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
                  borderBottom: expandedSource || expandedBrand ? "none" : "0.5px solid var(--border)",
                  flexShrink: 0, flexWrap: "wrap", position: "relative" }}>
      {/* Status segment (Live / Sold / All) is Watchlist-only now —
          on Listings the sub-tabs cover that role. */}
      {tab === "watchlist" && statusSegmentJSX}

      {/* Sort — Date + Price toggle pills. Date pill semantics depend
          on the active Listings sub-tab (newest firstSeen on Live;
          ending order on Live auctions; sold-date on All sold) — the
          dispatch lives in App.js's allFiltered memo. */}
      <div style={{ display: "flex", gap: 6 }}>
        {(() => {
          const isDate = sort === "date" || sort === "date-asc";
          const label = sort === "date" ? "Date ↓"
                      : sort === "date-asc" ? "Date ↑"
                      : "Date";
          return (
            <button onClick={() => {
              if (sort === "date") setSort("date-asc");
              else if (sort === "date-asc") setSort("date");
              else setSort("date");
            }} style={{
              padding: "6px 12px", borderRadius: 20,
              border: "0.5px solid var(--border)",
              cursor: "pointer", fontFamily: "inherit", fontSize: 13,
              background: isDate ? "var(--text1)" : "var(--surface)",
              color:      isDate ? "var(--bg)"    : "var(--text2)",
              fontWeight: isDate ? 600 : 500,
              whiteSpace: "nowrap",
            }}>{label}</button>
          );
        })()}
        {(() => {
          const isPrice = sort === "price-asc" || sort === "price-desc";
          const label = sort === "price-desc" ? "Price ↓"
                      : sort === "price-asc" ? "Price ↑"
                      : "Price";
          return (
            <button onClick={() => {
              if (sort === "price-desc") setSort("price-asc");
              else if (sort === "price-asc") setSort("price-desc");
              else setSort("price-desc");
            }} style={{
              padding: "6px 12px", borderRadius: 20,
              border: "0.5px solid var(--border)",
              cursor: "pointer", fontFamily: "inherit", fontSize: 13,
              background: isPrice ? "var(--text1)" : "var(--surface)",
              color:      isPrice ? "var(--bg)"    : "var(--text2)",
              fontWeight: isPrice ? 600 : 500,
              whiteSpace: "nowrap",
            }}>{label}</button>
          );
        })()}
      </div>

      {/* Price — inline min/max inputs. USD-only labels because the
          feed is USD-normalized. */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "var(--surface)",
        border: "0.5px solid var(--border)",
        borderRadius: 20, padding: "0 6px 0 12px", height: 30,
      }}>
        <span style={{ fontSize: 11, color: "var(--text3)" }}>$</span>
        <input value={minPriceText}
          onChange={e => setMinPriceText(e.target.value)}
          placeholder="Min" inputMode="numeric"
          aria-label="Minimum price USD"
          style={{
            border: "none", background: "transparent",
            color: "var(--text1)", outline: "none",
            fontFamily: "inherit", fontSize: 13,
            width: 56, padding: "4px 0",
          }} />
        <span style={{ fontSize: 11, color: "var(--text3)" }}>–</span>
        <input value={maxPriceText}
          onChange={e => setMaxPriceText(e.target.value)}
          placeholder="Max" inputMode="numeric"
          aria-label="Maximum price USD"
          style={{
            border: "none", background: "transparent",
            color: "var(--text1)", outline: "none",
            fontFamily: "inherit", fontSize: 13,
            width: 60, padding: "4px 0",
          }} />
        {(minPriceText || maxPriceText) && (
          <button onClick={() => { setMinPriceText(""); setMaxPriceText(""); }}
            aria-label="Clear price filter"
            style={{
              border: "none", background: "transparent",
              color: "var(--text3)", cursor: "pointer",
              fontFamily: "inherit", fontSize: 14,
              padding: "0 4px", lineHeight: 1,
            }}>×</button>
        )}
      </div>

      {/* Source + Brand pills are inline-expand toggles — tap → chip
          cluster appears in a panel below the filter row. */}
      <button onClick={() => setActiveFilterPop(p => p === "source" ? null : "source")}
        style={dtPill(filterSources.length > 0 || activeFilterPop === "source")}>
        Source{filterSources.length > 0 ? ` · ${filterSources.length}` : ""}
      </button>
      <button onClick={() => setActiveFilterPop(p => p === "brand" ? null : "brand")}
        style={dtPill(filterBrands.length > 0 || activeFilterPop === "brand")}>
        Brand{filterBrands.length > 0 ? ` · ${filterBrands.length}` : ""}
      </button>

      {/* Auctions-only toggle — only relevant on Watchlist tab. */}
      {tab === "watchlist" && (
        <div style={{ position: "relative" }}>
          <button onClick={() => setFilterAuctionsOnly(v => !v)} style={dtPill(filterAuctionsOnly)}>
            {filterAuctionsOnly ? "✓ Auctions" : "Auctions"}
          </button>
        </div>
      )}

      {/* Filtered count — pushed right via marginLeft auto. Mirrors
          the count Mobile already shows at the head of its sort row;
          surfaced at the top so the user doesn't have to scroll to
          the bottom of an infinite-scroll list to see how many
          matched. Only renders on tabs that have a filterable list
          (skip on Watchlist sub-tabs that don't render allFiltered). */}
      <span style={{
        marginLeft: "auto", flexShrink: 0,
        fontSize: 12, color: "var(--text3)", fontFamily: "inherit",
        whiteSpace: "nowrap", padding: "0 6px",
      }}>
        {(allFiltered?.length || 0).toLocaleString()} {(allFiltered?.length === 1) ? "watch" : "watches"}
      </span>

      {hasFilters && (
        <button onClick={resetFilters} style={{
          fontSize: 13, padding: "6px 12px", borderRadius: 20, cursor: "pointer",
          fontFamily: "inherit", whiteSpace: "nowrap",
          border: "none", outline: "none",
          background: "transparent", color: "#185FA5",
          boxShadow: "inset 0 0 0 0.5px #185FA5",
        }}>× Clear all</button>
      )}
    </div>
    {expandedSource && (
      <div style={expansionPanelStyle}>
        {SOURCES.length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--text3)" }}>No sources yet.</span>
        ) : (
          <>
            {/* Group dealers and auction houses under sub-headers so
                the list scans cleanly even at 30+ dealers. Headers are
                inline pills (full-row width via flex basis) sandwiched
                between the chip clusters. Live-listings sub-tab hides
                the auction-house group; Live-auctions sub-tab hides
                dealers — neither group is reachable from there anyway. */}
            {showDealerSources && (DEALER_SOURCES?.length || 0) > 0 && (
              <span style={{
                flexBasis: "100%", fontSize: 10, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.08em",
                color: "var(--text3)", marginBottom: 2,
              }}>Dealers</span>
            )}
            {showDealerSources && (DEALER_SOURCES || []).map(s => (
              <Chip key={s} label={s} active={filterSources.includes(s)} onClick={() => toggleSource(s)} />
            ))}
            {showAuctionSources && (AUCTION_SOURCES?.length || 0) > 0 && (
              <span style={{
                flexBasis: "100%", fontSize: 10, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.08em",
                color: "var(--text3)", marginTop: showDealerSources ? 8 : 0, marginBottom: 2,
              }}>Auction houses</span>
            )}
            {showAuctionSources && (AUCTION_SOURCES || []).map(s => (
              <Chip key={s} label={s} active={filterSources.includes(s)} onClick={() => toggleSource(s)} />
            ))}
            {filterSources.length > 0 && (
              <button onClick={() => setFilterSources([])} style={{
                marginLeft: "auto", fontSize: 12, padding: "5px 10px", borderRadius: 6,
                border: "0.5px solid var(--border)", background: "transparent",
                color: "var(--text2)", cursor: "pointer", fontFamily: "inherit",
              }}>Clear</button>
            )}
          </>
        )}
      </div>
    )}
    {expandedBrand && (
      <div style={expansionPanelStyle}>
        {visibleBrands.map(b => (
          <Chip key={b} label={b} active={filterBrands.includes(b)} onClick={() => toggleBrand(b)} />
        ))}
        {BRANDS.length > BRANDS_SHOW && (
          <Chip label={brandsExpanded ? "Less ↑" : `+${BRANDS.length - BRANDS_SHOW} more`}
            active={false} onClick={() => setBrandsExpanded(!brandsExpanded)} blue />
        )}
        {filterBrands.length > 0 && (
          <button onClick={() => setFilterBrands([])} style={{
            marginLeft: "auto", fontSize: 12, padding: "5px 10px", borderRadius: 6,
            border: "0.5px solid var(--border)", background: "transparent",
            color: "var(--text2)", cursor: "pointer", fontFamily: "inherit",
          }}>Clear</button>
        )}
      </div>
    )}
    </>
    );
  })();

  return (
    <div style={{ ...baseStyle, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Full-width top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "0.5px solid var(--border)", flexShrink: 0 }}>
        {!(tab === "watchlist" && (watchTopTab === "searches" || watchTopTab === "collections" || watchTopTab === "challenges")) && sidebarToggleJSX}
        <button onClick={() => { setTab("listings"); setPage(1); }}
          style={{ background: "none", border: "none", cursor: "pointer",
                  padding: 0, fontFamily: "inherit",
                  fontSize: 18, fontWeight: 500, letterSpacing: "-0.5px",
                  color: "var(--text1)", flexShrink: 0 }}>
          Watchlist
        </button>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, marginLeft: 4 }}>
          {[["listings", "Listings"], ["watchlist", "Watchlist"], ["references", "Reference"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: "6px 14px", borderRadius: 20, border: "0.5px solid var(--border)", cursor: "pointer",
              fontFamily: "inherit", fontSize: 13,
              background: tab === key ? "var(--text1)" : "var(--surface)",
              color: tab === key ? "var(--bg)" : "var(--text2)",
              fontWeight: tab === key ? 600 : 500,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <TabIcon kind={key} />
              {label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", borderRadius: 8, padding: "7px 12px", width: "100%", maxWidth: 640 }}>
            <SearchIcon />
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
              placeholder="Search reference or brand..." style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, color: "var(--text1)", outline: "none", fontFamily: "inherit", minWidth: 0 }} />
            {search && user && (
              <button onClick={openFavPrompt} aria-label={currentIsSaved ? "Already saved" : "Save search as favorite"}
                title={currentIsSaved ? "Saved to favorites" : "Save as favorite search"}
                disabled={currentIsSaved}
                style={{ flexShrink: 0, background: "none", border: "none",
                        cursor: currentIsSaved ? "default" : "pointer",
                        color: currentIsSaved ? "#185FA5" : "var(--text3)",
                        padding: 2, fontFamily: "inherit",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill={currentIsSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        </div>
        {authJSX}
      </div>
      {/* Sub-tab strips — Listings on tab=listings, Watchlist on
          tab=watchlist. Sit between main tabs and the filter row. */}
      {listingsSubTabsJSX}
      {watchSubTabsJSX}
      {(
        (tab === "listings" && showListingsFilterRow) ||
        (tab === "watchlist" && watchTopTab !== "searches" && watchTopTab !== "collections" && watchTopTab !== "challenges")
      )
        ? filterRowJSX
        : (
          // Spacer row that matches the real filter pill row's height,
          // so switching to a filter-less sub-tab (Calendar / Searches
          // / Collections / Challenges) doesn't pop content up.
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "0.5px solid var(--border)", flexShrink: 0 }}>
            <span style={{ fontSize: 13, padding: "6px 12px", borderRadius: 20, visibility: "hidden" }}>placeholder</span>
          </div>
        )}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Top padding is 0 on Watchlist so the sub-tab strip sits flush
            against the filter pill row. Listings keeps the breathing room. */}
        <div data-desktop-main style={{ flex: 1, overflowY: "auto", padding: `${tab === "watchlist" ? 0 : 14}px 16px 32px` }}>
          {/* Share-receive surface — self-contained component. */}
          {shareReceiverJSX}
          {/* Phase B2 lot-migration banner. */}
          {lotMigrationBannerJSX}
          {/* Ending-soon pinned section. Mounted at the top of the
              scroll area so it's the first thing the user sees when
              they hit Watchlist; sub-tab strip stays sticky above
              via the chrome rendered outside this scroll container.
              Returns null when no qualifying tracked lots. */}
          {tab === "watchlist" && endingSoonJSX}
          {tab === "listings" ? listingsTabContentJSX
            : tab === "references" ? <ReferencesTab />
            : tab === "admin" ? adminTabJSX
            : watchlistTabJSX}
        </div>
      </div>
      {trackNewItemModalJSX}
      {addSearchModalJSX}
      {collectionEditModalJSX}
      {collectionPickerModalJSX}
      {settingsModalJSX}
      <AboutModal
          open={aboutModalOpen}
          onClose={() => setAboutModalOpen(false)}
        />
        {favSearchModalJSX}
    </div>
  );
}
