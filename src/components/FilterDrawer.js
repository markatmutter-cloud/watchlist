import React, { useEffect } from "react";
import { Chip, Button } from "../ui";

// FilterDrawer — the phone's filter sheet (Source / Brand / Model / Price range, Reset,
// "Show N watches"). Built from src/ui (Mark, 2026-10-17: one definition per piece): the
// chips are the shared Chip, the footer the shared Button, the sheet's look is `.ui-sheet*`
// in ui.css. State stays in App.js (`drawerOpen`, the filters, the price text); this owns
// nothing but the Escape key.
export function FilterDrawer({
  drawerOpen, setDrawerOpen,
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
  // Escape closes the sheet (B-63, audit:2026-06-06 U-08): a dead Escape on an open
  // sheet is the "I'm stuck" moment the audit flagged. Self-gates on drawerOpen.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, setDrawerOpen]);

  if (!drawerOpen) return null;

  const close = () => setDrawerOpen(false);
  const dealers = (visibleSources || []).filter((s) => (DEALER_SOURCES || []).includes(s));
  const houses = (visibleSources || []).filter((s) => (AUCTION_SOURCES || []).includes(s));
  const srcChip = (s) => (
    <Chip key={s} on={filterSources.includes(s)} onClick={() => toggleSource(s)}>{s}</Chip>
  );

  return (
    <div className="ui-sheet" role="dialog" aria-modal="true" aria-label="Filter">
      <div className="ui-sheet-scrim" onClick={close} />
      <div className="ui-sheet-panel">
        <div className="ui-sheet-grab"><i /></div>
        {/* An explicit exit (Mark 2026-05-20: "sometimes you can't see a way out of the
            filter other than Show watches"). Filter state is live, so closing and
            applying are the same thing. */}
        <div className="ui-sheet-head">
          <div className="ui-sheet-title">Filter</div>
          <button type="button" className="ui-sheet-x" aria-label="Close filter" onClick={close}>×</button>
        </div>

        <div className="ui-sheet-body">
          <section className="ui-sheet-sec">
            <h3 className="ui-sheet-h">Source</h3>
            {sourcesExpanded ? (
              <>
                {showDealerSources && dealers.length > 0 && (
                  <>
                    <div className="ui-sheet-sub">Dealers</div>
                    <div className="ui-sheet-chips">{dealers.map(srcChip)}</div>
                  </>
                )}
                {showAuctionSources && houses.length > 0 && (
                  <>
                    <div className="ui-sheet-sub">Auction houses</div>
                    <div className="ui-sheet-chips">{houses.map(srcChip)}</div>
                  </>
                )}
                <div className="ui-sheet-chips" style={{ marginTop: 8 }}>
                  <Chip quiet onClick={() => setSourcesExpanded(false)}>Less ↑</Chip>
                </div>
              </>
            ) : (
              <div className="ui-sheet-chips">
                {(visibleSources || [])
                  .filter((s) => (showDealerSources && (DEALER_SOURCES || []).includes(s))
                              || (showAuctionSources && (AUCTION_SOURCES || []).includes(s)))
                  .map(srcChip)}
                {effectiveSourcesCount > SOURCES_SHOW && (
                  <Chip quiet onClick={() => setSourcesExpanded(true)}>+{effectiveSourcesCount - SOURCES_SHOW} more</Chip>
                )}
              </div>
            )}
          </section>

          <section className="ui-sheet-sec">
            <h3 className="ui-sheet-h">Brand</h3>
            <div className="ui-sheet-chips">
              {(visibleBrands || []).map((b) => (
                <Chip key={b} on={filterBrands.includes(b)} onClick={() => toggleBrand(b)}>{b}</Chip>
              ))}
              {effectiveBrandsCount > BRANDS_SHOW && (
                <Chip quiet onClick={() => setBrandsExpanded(!brandsExpanded)}>
                  {brandsExpanded ? "Less ↑" : `+${effectiveBrandsCount - BRANDS_SHOW} more`}
                </Chip>
              )}
            </div>
          </section>

          {(MODELS?.length || 0) > 0 && (
            <section className="ui-sheet-sec">
              <h3 className="ui-sheet-h">Model</h3>
              <div className="ui-sheet-chips">
                {(visibleModels || []).map((m) => (
                  <Chip key={m} on={(filterModels || []).includes(m)} onClick={() => toggleModel && toggleModel(m)}>{m}</Chip>
                ))}
                {effectiveModelsCount > (MODELS_SHOW || 0) && (
                  <Chip quiet onClick={() => setModelsExpanded && setModelsExpanded(!modelsExpanded)}>
                    {modelsExpanded ? "Less ↑" : `+${effectiveModelsCount - MODELS_SHOW} more`}
                  </Chip>
                )}
              </div>
            </section>
          )}

          <section className="ui-sheet-sec">
            <h3 className="ui-sheet-h">Price range</h3>
            <div className="ui-sheet-row">
              <input className="ui-input" value={minPriceText} onChange={(e) => setMinPriceText(e.target.value)} placeholder="Min $" />
              <span>to</span>
              <input className="ui-input" value={maxPriceText} onChange={(e) => setMaxPriceText(e.target.value)} placeholder="Max $" />
            </div>
          </section>
        </div>

        <div className="ui-sheet-foot">
          {hasFilters && <Button onClick={resetFilters}>Reset</Button>}
          <Button primary onClick={close}>Show {displayedCount} watches</Button>
        </div>
      </div>
    </div>
  );
}
