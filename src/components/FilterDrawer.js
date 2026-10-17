import React, { useEffect } from "react";
import { Chip } from "./Chip";
import { inputBase } from "../styles";

// FilterDrawer — the mobile filter sheet (Source / Brand / Model / Price range,
// Reset, "Show N watches"), extracted from MobileShell 2026-10-16 so the
// magazine Watches page (MagazineWatches) can open the SAME sheet instead of a
// second copy of it. It was the one shell behaviour the parallel page lacked
// (SESSION_HANDOFF 2026-10-04). Markup and behaviour are moved verbatim; only
// the props bag is new.
//
// State stays in App.js (`drawerOpen`, the filters, the price text): this is a
// presentation component and owns nothing but the Escape key.
export function FilterDrawer({
  drawerOpen, setDrawerOpen, sectionHeadingStyle,
  // which source families this slice of Watches can show
  showDealerSources, showAuctionSources,
  // source
  DEALER_SOURCES, AUCTION_SOURCES, visibleSources, filterSources, toggleSource,
  effectiveSourcesCount, SOURCES_SHOW, sourcesExpanded, setSourcesExpanded,
  // brand
  visibleBrands, filterBrands, toggleBrand,
  effectiveBrandsCount, BRANDS_SHOW, brandsExpanded, setBrandsExpanded,
  // model
  MODELS, visibleModels, filterModels, toggleModel,
  effectiveModelsCount, MODELS_SHOW, modelsExpanded, setModelsExpanded,
  // price + footer
  minPriceText, setMinPriceText, maxPriceText, setMaxPriceText,
  hasFilters, resetFilters, displayedCount,
}) {
  // Escape closes the filter drawer (B-63, audit:2026-06-06 U-08) —
  // same listener pattern as ConfirmModal / the CardShell ⋯ menu. Less
  // common on touch, but iPads-with-keyboards and the desktop-narrow
  // layout hit this sheet too, and a dead Escape on an open sheet is
  // the "I'm stuck" moment the audit flagged. Self-gates on drawerOpen.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, setDrawerOpen]);

  if (!drawerOpen) return null;
  return (
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
  );
}
