import React from "react";
import { SearchIcon, FilterIcon, TabIcon } from "./icons";
import { Chip } from "./Chip";
import { ReferencesTab } from "./ReferencesTab";
import { HiddenModal } from "./HiddenModal";
import { AboutModal } from "./AboutModal";
import { iconButton, pillBase } from "../styles";

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
    // State
    aboutModalOpen, allFiltered, brandsExpanded,
    currentIsSaved, dark, drawerOpen,
    filterAuctionsOnly, filterBrands, filterSources,
    hasFilters, hiddenItems, hiddenModalOpen,
    maxPriceText, minPriceText, mobileCols,
    search, sort, sourcesExpanded,
    tab, user, viewMenuOpen, visibleBrands, visibleSources,
    watchTopTab, watchlist,
    // Setters / handlers
    handleWish, openFavPrompt, resetFilters,
    setAboutModalOpen, setBrandsExpanded, setDarkOverride,
    setDrawerOpen, setFilterAuctionsOnly, setHiddenModalOpen,
    setMaxPriceText, setMinPriceText, setMobileCols,
    setPage, setSearch, setShowUserMenu, setSort,
    setSourcePickerOpen, setSourcesExpanded,
    setTab, setViewMenuOpen,
    toggleBrand, toggleHide, toggleSource,
    // Style tokens / pre-built JSX
    addSearchModalJSX,
    authJSX, baseStyle,
    collectionEditModalJSX, collectionPickerModalJSX,
    favSearchModalJSX, inp,
    listingsGridJSX, primaryCurrency, sectionHeadingStyle,
    settingsModalJSX, statusSegmentJSX,
    trackNewItemModalJSX, watchSubTabsJSX, watchlistTabJSX,
  } = props;

  return (
      <div style={baseStyle}>
        {/* "Watchlist" title sits OUTSIDE the sticky wrapper — it scrolls
            off screen as you pan down, leaving just the sticky search +
            sort rows pinned to the top. No JS needed; this is pure CSS
            flow + sticky positioning. */}
        <div style={{ padding: "10px 14px 4px" }}>
          {/* Tap the title to jump back to Available (home). */}
          <button onClick={() => { setTab("listings"); setPage(1); }}
            style={{ background: "none", border: "none", cursor: "pointer",
                    padding: 0, fontFamily: "inherit",
                    fontSize: 22, fontWeight: 600, letterSpacing: "-0.5px",
                    color: "var(--text1)" }}>
            Watchlist
          </button>
        </div>
        {/* Sticky stack: search row (with filter + dark-mode buttons) and
            sort/clear pills row. Stays pinned to the viewport top so
            filters are one tap away at any scroll depth. */}
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px 6px", borderBottom: "0.5px solid var(--border)" }}>
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
                        color: currentIsSaved ? "#185FA5" : "var(--text3)",
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
          {!(tab === "watchlist" && (watchTopTab === "searches" || watchTopTab === "calendar" || watchTopTab === "collections")) && (
            <button onClick={() => { setDrawerOpen(true); setSourcePickerOpen(false); }} aria-label="Filters" style={iconButton({ active: hasFilters })}>
              <FilterIcon />
            </button>
          )}
          {/* "View" button consolidates theme + column count so the top bar
              doesn't have to grow as we add per-device display settings. */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={() => { setViewMenuOpen(o => !o); setShowUserMenu(false); }} aria-label="View options"
              style={iconButton({ active: viewMenuOpen })}>
              {/* Eye icon — feels right for "view settings" (theme + column
                  count). Mark's call: cog read like "settings", eye reads
                  like "how the page looks". */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            {viewMenuOpen && (
              <div style={{ position: "absolute", right: 0, top: 46, zIndex: 50,
                           background: "var(--bg)", border: "0.5px solid var(--border)",
                           borderRadius: 10, padding: 12, minWidth: 180,
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
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3].map(n => (
                    <button key={n} onClick={() => setMobileCols(n)} style={{
                      flex: 1, padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--border)",
                      background: mobileCols === n ? "var(--text1)" : "transparent",
                      color: mobileCols === n ? "var(--bg)" : "var(--text2)",
                      cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                    }}>{n}</button>
                  ))}
                </div>
                <div style={{ height: "0.5px", background: "var(--border)", margin: "12px -12px 8px" }} />
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, padding: "0 8px" }}>Other</div>
                {user && (
                  <button onClick={() => { setViewMenuOpen(false); setHiddenModalOpen(true); }} style={{
                    width: "100%", textAlign: "left",
                    padding: "8px 8px", border: "none", background: "transparent",
                    color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 13, borderRadius: 6,
                  }}>Hidden listings{hiddenItems.length > 0 ? ` · ${hiddenItems.length}` : ""}</button>
                )}
                <button onClick={() => { setViewMenuOpen(false); setAboutModalOpen(true); }} style={{
                  width: "100%", textAlign: "left",
                  padding: "8px 8px", border: "none", background: "transparent",
                  color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, borderRadius: 6,
                }}>About & Contact</button>
              </div>
            )}
          </div>
          {authJSX}
        </div>
        {/* Sort/source/sold/clear pill row — only relevant for tabs that
            have a list to filter. On Searches sub-tab we still render an
            empty placeholder of the same height so the content below
            doesn't jump up when switching sub-tabs. */}
        {tab === "watchlist" && (watchTopTab === "searches" || watchTopTab === "calendar" || watchTopTab === "collections") && (
          // Spacer row — matches the active filter row's padding +
          // pill-shaped child so the height is identical to the real row.
          // Avoids a layout shift when switching to Searches sub-tab.
          <div style={{ display: "flex", gap: 6, padding: "6px 14px 8px", borderBottom: "0.5px solid var(--border)", alignItems: "center" }}>
            <span style={{ fontSize: 13, padding: "9px 14px", borderRadius: 20, border: "0.5px solid transparent", visibility: "hidden" }}>placeholder</span>
          </div>
        )}
        {!(tab === "watchlist" && (watchTopTab === "searches" || watchTopTab === "calendar" || watchTopTab === "collections")) && (
        <div style={{ display: "flex", gap: 6, padding: "6px 14px 8px", borderBottom: "0.5px solid var(--border)", position: "relative", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text3)", marginRight: 2 }}>{allFiltered.length}</span>
          {/* Date sort pill */}
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
                // Tapping Price should stay in price mode — toggles between
                // asc and desc. Previous version fell back to date on the
                // third tap, which felt like the button was broken.
                if (sort === "price-asc") setSort("price-desc");
                else if (sort === "price-desc") setSort("price-asc");
                else setSort("price-asc");
              }} style={pillBase(active)}>{label}</button>
            );
          })()}
          {/* Compact "clear filters" — just a small × icon to keep the
              row from wrapping when filters are set. The text version
              ("× Clear") got cropped at narrow widths. */}
          {hasFilters && (
            <button onClick={resetFilters} aria-label="Clear all filters" title="Clear all filters"
              style={{
                marginLeft: "auto", flexShrink: 0,
                width: 40, height: 40, borderRadius: "50%",
                border: "none", outline: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 18, lineHeight: 1, padding: 0,
                background: "transparent", color: "#185FA5",
                boxShadow: "inset 0 0 0 0.5px #185FA5",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>×</button>
          )}
        </div>
        )}
        {/* Mobile sub-tab strip — lifted into the sticky stack on
            2026-04-30 so it survives scroll. */}
        {watchSubTabsJSX}
        </div>
        <div style={{ padding: `${tab === "watchlist" ? 0 : 12}px 14px 100px` }}>
          {tab === "listings" ? listingsGridJSX
            : tab === "references" ? <ReferencesTab />
            : watchlistTabJSX}
        </div>
        {trackNewItemModalJSX}
        {addSearchModalJSX}
        {collectionEditModalJSX}
        {collectionPickerModalJSX}
        {settingsModalJSX}
        {/* Bottom tab bar. The container reserves the iOS home-indicator
            safe area PLUS a fixed extra padding, so the buttons aren't
            hugging the home bar when the app is launched standalone from
            the home screen. */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "var(--bg)", borderTop: "0.5px solid var(--border)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}>
          {/* References is desktop-only — bottom tab bar stays at 2
              tabs to keep mobile labels readable. */}
          {[["listings", "Listings"], ["watchlist", "Watchlist"]].map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); if (key === "listings") setSearch(""); }} style={{ flex: 1, padding: "8px 0 6px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: tab === key ? "var(--text1)" : "var(--text3)", fontWeight: tab === key ? 500 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {tab === key
                ? <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#185FA5" }} />
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

                <div style={{ padding: "10px 16px 10px" }}>
                  <div style={sectionHeadingStyle}>Status</div>
                  {statusSegmentJSX}
                </div>
                <div style={{ height: "0.5px", background: "var(--border)", margin: "0 16px 0" }} />

                {/* Auctions-only toggle. Orthogonal to the Live/Sold/All
                    status segment above — when on, narrows to auction-
                    format items (auction-house lots + eBay AUCTION).
                    Watchlist-only because Listings doesn't have any
                    auction-format items (those are tracked URLs that
                    live in Watchlist). Mirrors the desktop pill that
                    only renders on `tab === "watchlist"`. */}
                {tab === "watchlist" && (
                  <>
                    <div style={{ padding: "10px 16px 10px" }}>
                      <div style={sectionHeadingStyle}>Auctions only</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Chip
                          label={filterAuctionsOnly ? "✓ Auctions only" : "Auctions only"}
                          active={filterAuctionsOnly}
                          onClick={() => setFilterAuctionsOnly(v => !v)}
                        />
                      </div>
                    </div>
                    <div style={{ height: "0.5px", background: "var(--border)", margin: "0 16px 0" }} />
                  </>
                )}

                <div style={{ padding: "10px 16px 10px" }}>
                  <div style={sectionHeadingStyle}>Source</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {visibleSources.map(s => <Chip key={s} label={s} active={filterSources.includes(s)} onClick={() => toggleSource(s)} />)}
                    {SOURCES.length > SOURCES_SHOW && <Chip label={sourcesExpanded ? "Less ↑" : `+${SOURCES.length - SOURCES_SHOW} more`} active={false} onClick={() => setSourcesExpanded(!sourcesExpanded)} blue />}
                  </div>
                </div>
                <div style={{ height: "0.5px", background: "var(--border)", margin: "0 16px 0" }} />

                <div style={{ padding: "10px 16px 10px" }}>
                  <div style={sectionHeadingStyle}>Brand</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {visibleBrands.map(b => <Chip key={b} label={b} active={filterBrands.includes(b)} onClick={() => toggleBrand(b)} />)}
                    {BRANDS.length > BRANDS_SHOW && <Chip label={brandsExpanded ? "Less ↑" : `+${BRANDS.length - BRANDS_SHOW} more`} active={false} onClick={() => setBrandsExpanded(!brandsExpanded)} blue />}
                  </div>
                </div>
                <div style={{ height: "0.5px", background: "var(--border)", margin: "0 16px 0" }} />

                <div style={{ padding: "10px 16px 10px" }}>
                  <div style={sectionHeadingStyle}>Price range</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={minPriceText} onChange={e => setMinPriceText(e.target.value)} placeholder="Min $" style={{ ...inp, flex: 1 }} />
                    <span style={{ fontSize: 12, color: "var(--text3)", flexShrink: 0 }}>to</span>
                    <input value={maxPriceText} onChange={e => setMaxPriceText(e.target.value)} placeholder="Max $" style={{ ...inp, flex: 1 }} />
                  </div>
                </div>
              </div>

              {/* Fixed bottom actions. */}
              <div style={{ borderTop: "0.5px solid var(--border)", padding: "12px 16px", background: "var(--bg)" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {hasFilters && (
                    <button onClick={resetFilters} style={{ padding: "12px 16px", borderRadius: 12, border: "0.5px solid var(--border)", background: "transparent", color: "var(--text2)", fontSize: 14, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      Reset
                    </button>
                  )}
                  <button onClick={() => setDrawerOpen(false)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: "var(--text1)", color: "var(--bg)", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                    Show {allFiltered.length} watches
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
        <HiddenModal
          open={hiddenModalOpen}
          onClose={() => setHiddenModalOpen(false)}
          items={hiddenItems}
          watchlist={watchlist}
          onWish={handleWish}
          onHide={toggleHide}
          primaryCurrency={primaryCurrency}
        />
        <AboutModal
          open={aboutModalOpen}
          onClose={() => setAboutModalOpen(false)}
        />
        {favSearchModalJSX}
      </div>
  );
}
