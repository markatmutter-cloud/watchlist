import React from "react";
import { SearchIcon, TabIcon } from "./icons";
import { Chip } from "./Chip";
import { ReferencesTab } from "./ReferencesTab";
import { HiddenModal } from "./HiddenModal";
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
    // State
    aboutModalOpen, activeFilterPop,
    brandsExpanded,
    currentIsSaved, dark, desktopAutoCols, desktopCols,
    filterAuctionsOnly, filterBrands, filterSources,
    hasFilters, hiddenItems, hiddenModalOpen,
    maxPriceText, minPriceText,
    search, sort,
    tab, user, viewMenuOpen, visibleBrands,
    watchTopTab, watchlist,
    // Setters / handlers
    handleWish, openFavPrompt, resetFilters,
    setAboutModalOpen, setActiveFilterPop, setBrandsExpanded,
    setDarkOverride, setDesktopCols,
    setFilterAuctionsOnly, setFilterBrands, setFilterSources,
    setHiddenModalOpen, setMaxPriceText, setMinPriceText,
    setPage, setSearch, setShowUserMenu, setSort,
    setTab, setViewMenuOpen,
    toggleBrand, toggleHide, toggleSource,
    // Pre-built JSX
    addSearchModalJSX,
    authJSX, baseStyle, favSearchModalJSX,
    listingsGridJSX, statusSegmentJSX,
    trackNewItemModalJSX, watchSubTabsJSX, watchlistTabJSX,
  } = props;

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
      {/* Tri-state Status segment — Live / Sold / All. */}
      {statusSegmentJSX}

      {/* Sort — two toggle pills (Date + Price). */}
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

      {hasFilters && (
        <button onClick={resetFilters} style={{
          marginLeft: "auto",
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
            {SOURCES.map(s => (
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
        {!(tab === "watchlist" && (watchTopTab === "searches" || watchTopTab === "calendar")) && sidebarToggleJSX}
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
        {/* Desktop View popover: theme + column count. */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button onClick={() => { setViewMenuOpen(o => !o); setShowUserMenu(false); }} aria-label="View options"
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: "0.5px solid var(--border)",
              background: viewMenuOpen ? "var(--text1)" : "var(--surface)",
              color: viewMenuOpen ? "var(--bg)" : "var(--text2)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
          {viewMenuOpen && (
            <div style={{ position: "absolute", right: 0, top: 38, zIndex: 50,
                         background: "var(--bg)", border: "0.5px solid var(--border)",
                         borderRadius: 10, padding: 12, minWidth: 220,
                         boxShadow: "0 6px 20px rgba(0,0,0,0.18)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Theme</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {[["light", "Light"], ["dark", "Dark"]].map(([key, lbl]) => {
                  const active = (key === "dark") === dark;
                  return (
                    <button key={key} onClick={() => setDarkOverride(key === "dark")} style={{
                      flex: 1, padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--border)",
                      background: active ? "var(--text1)" : "transparent",
                      color: active ? "var(--bg)" : "var(--text2)",
                      cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                    }}>{lbl}</button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Columns</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {["auto", 3, 4, 5, 6, 7].map(n => (
                  <button key={n} onClick={() => setDesktopCols(n)} style={{
                    flex: "1 1 auto", minWidth: 36, padding: "6px 10px", borderRadius: 6,
                    border: "0.5px solid var(--border)",
                    background: desktopCols === n ? "var(--text1)" : "transparent",
                    color: desktopCols === n ? "var(--bg)" : "var(--text2)",
                    cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                  }}>{n === "auto" ? "Auto" : n}</button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 6 }}>
                Auto = {desktopAutoCols} columns at this width.
              </div>
              <div style={{ height: "0.5px", background: "var(--border)", margin: "12px -12px 8px" }} />
              <button onClick={() => { setViewMenuOpen(false); setAboutModalOpen(true); }} style={{
                width: "100%", textAlign: "left",
                padding: "6px 8px", border: "none", background: "transparent",
                color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, borderRadius: 6,
              }}>About & Contact</button>
            </div>
          )}
        </div>
        {authJSX}
      </div>
      {/* Watchlist sub-tab strip sits between main tabs and the
          filter row — surfaces the contextual Track / Add-search action
          above the filter pills. */}
      {watchSubTabsJSX}
      {(tab === "listings" || (tab === "watchlist" && watchTopTab !== "searches" && watchTopTab !== "calendar"))
        ? filterRowJSX
        : (tab === "watchlist"
            ? (
              // Spacer row that matches the real filter pill row's height
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "0.5px solid var(--border)", flexShrink: 0 }}>
                <span style={{ fontSize: 13, padding: "6px 12px", borderRadius: 20, visibility: "hidden" }}>placeholder</span>
              </div>
            )
            : null)}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Top padding is 0 on Watchlist so the sub-tab strip sits flush
            against the filter pill row. Listings keeps the breathing room. */}
        <div data-desktop-main style={{ flex: 1, overflowY: "auto", padding: `${tab === "watchlist" ? 0 : 14}px 16px 32px` }}>
          {tab === "listings" ? listingsGridJSX
            : tab === "references" ? <ReferencesTab />
            : watchlistTabJSX}
        </div>
      </div>
      {trackNewItemModalJSX}
      {addSearchModalJSX}
      <HiddenModal
          open={hiddenModalOpen}
          onClose={() => setHiddenModalOpen(false)}
          items={hiddenItems}
          watchlist={watchlist}
          onWish={handleWish}
          onHide={toggleHide}
        />
        <AboutModal
          open={aboutModalOpen}
          onClose={() => setAboutModalOpen(false)}
        />
        {favSearchModalJSX}
    </div>
  );
}
