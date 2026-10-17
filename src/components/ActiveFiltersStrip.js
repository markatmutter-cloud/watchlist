import React from "react";
import { DismissChip } from "../ui";

// Single horizontal strip of × chips representing every active
// filter, plus a trailing "Clear all" pill (Mark feedback
// 2026-05-19 item 4: "list the filters selected with little 'x'
// next to the filter chip and an easier to find clear all
// including finding a way to get this done for search bar as
// well. cohesive design for all tabs/places where there is a
// filter capability").
//
// Each chip removes its own filter when ×'d. Clear-all clears
// every filter (including search). Returns null when no filter
// is active so the strip doesn't reserve vertical space.
//
// Mounted from `listingsGridJSX` (just above the card grid) and
// `watchlistTabJSX_inner` so it appears on every sub-tab inside
// Listings + Saved. Editorial owns its own filter state and gets
// the strip too, threaded through `editorialFilterStripProps`.

// Each chip is the shared DismissChip (a selected filter you can take off). The strip carries no
// "Clear all" of its own: the filter bar's "× Clear all" pill is the one (2026-10-17), so there
// are not two of them on a page.
function FilterChip({ label, onRemove }) {
  return <DismissChip label={label} onRemove={onRemove}>{label}</DismissChip>;
}

export function ActiveFiltersStrip({
  // Multi-selects
  filterSources = [], toggleSource,
  filterBrands  = [], toggleBrand,
  filterModels  = [], toggleModel,
  filterRefs    = [], toggleFilterRef,
  // Search
  search = "", setSearch,
  // Recency
  newDays = 0, setNewDays,
  // Price
  minPriceText = "", setMinPriceText,
  maxPriceText = "", setMaxPriceText,
}) {
  // The ♥ Saved-only toggle is deliberately NOT echoed here (P-24,
  // 2026-06-03): its pill in the filter bar already shows the lit state, so
  // a "Saved only ×" chip restated it and burned a whole row. The strip only
  // carries selections you can't see in the bar (named chips you can ×
  // individually). filterHearted/setFilterHearted props were dropped the
  // same pass; resetFilters still clears hearted with everything else.
  const hasAny = (
    filterSources.length > 0
    || filterBrands.length > 0
    || filterModels.length > 0
    || filterRefs.length > 0
    || !!search
    || newDays > 0
    || !!minPriceText
    || !!maxPriceText
  );
  if (!hasAny) return null;

  // Recency-bucket label dictionary mirrors NEW_OPTS in App.js
  // (Today / 3 days / This week). Anything else falls back to "Last
  // N days" so the chip is still removable.
  const recencyLabel = newDays === 1 ? "Today"
    : newDays === 3 ? "Last 3 days"
    : newDays === 7 ? "This week"
    : newDays > 0 ? `Last ${newDays} days`
    : null;

  // Price chip — single chip "$min – $max" so we don't crowd the
  // strip with two when both are set.
  let priceLabel = null;
  if (minPriceText || maxPriceText) {
    const lo = minPriceText ? `$${minPriceText}` : "any";
    const hi = maxPriceText ? `$${maxPriceText}` : "any";
    priceLabel = `${lo} – ${hi}`;
  }
  const removePriceRange = () => {
    if (setMinPriceText) setMinPriceText("");
    if (setMaxPriceText) setMaxPriceText("");
  };

  return (
    <div className="ui-dismiss-row">
      {filterSources.map(s => (
        <FilterChip key={`src-${s}`} label={s} onRemove={() => toggleSource && toggleSource(s)} />
      ))}
      {filterBrands.map(b => (
        <FilterChip key={`brand-${b}`} label={b} onRemove={() => toggleBrand && toggleBrand(b)} />
      ))}
      {filterModels.map(m => (
        <FilterChip key={`model-${m}`} label={m} onRemove={() => toggleModel && toggleModel(m)} />
      ))}
      {filterRefs.map(r => (
        <FilterChip key={`ref-${r}`} label={`Ref ${r}`} onRemove={() => toggleFilterRef && toggleFilterRef(r)} />
      ))}
      {!!search && (
        <FilterChip
          label={`"${search}"`}
          onRemove={() => setSearch && setSearch("")}
        />
      )}
      {recencyLabel && (
        <FilterChip
          label={recencyLabel}
          onRemove={() => setNewDays && setNewDays(0)}
        />
      )}
      {priceLabel && (
        <FilterChip label={priceLabel} onRemove={removePriceRange} />
      )}
    </div>
  );
}
