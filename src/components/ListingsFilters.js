// ListingsFilters — the search, the filter bar and the phone filter sheet for any page that
// shows a filterable grid of watches. Pulled out of MagazineWatches (2026-10-17) when the
// Lists page needed the same controls for a drilled-in list: one definition, so Watches and
// a list cannot drift (Mark: "divergence is the bug, not the styling").
//
// Every control is wired to App.js state through props; this file owns only the saved-search
// dropdown's open/closed flag. All three take the same props bag (the filter fields App
// already threads), so a page spreads its props into whichever of them it renders.

import React, { useEffect, useRef, useState } from "react";
import { Pill, Chip, ChipPanel, SearchField, FilterBar, PriceRange, SuggestionRows } from "../ui";
import { FilterDrawer } from "./FilterDrawer";
import { FilterIcon, HeartIcon } from "./icons";

// The Auctions slice has no dealers in it and the For-sale slice has no houses, so offering
// the other family's chips there would only ever empty the grid. Any other surface (Saved,
// a drilled-in list) can hold both.
const sourceFamilies = (listingsSubTab) => ({
  showDealerSources: listingsSubTab !== "auctions",
  showAuctionSources: listingsSubTab !== "live",
});

// ---- the search ---------------------------------------------------------------------
// Types straight into App.js's `search`, so what you see in the field is what the grid is
// filtered by. Saved searches show as suggestions when the field is focused and empty
// (Mark, 2026-10-16); signed out there are none, so nothing opens.
//   size   "bar" (in the header) | "row" (in a filter bar) | "full" (a phone's own row);
//          default: the header's, per device
export function ListingsSearch({
  isMobile, user, search, setSearch, searchPlaceholder, openFavPrompt, currentIsSaved,
  savedSearches, onRunSavedSearch, onRemoveSavedSearch, size,
}) {
  const [suggestOpen, setSuggestOpen] = useState(false);
  const wrap = useRef(null);
  useEffect(() => {
    if (!suggestOpen) return undefined;
    const away = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setSuggestOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [suggestOpen]);
  const haveSaved = !!user && (savedSearches || []).length > 0;

  return (
    <div ref={wrap}>
      <SearchField
        size={size || (isMobile ? "full" : "bar")}
        value={search || ""}
        onChange={(e) => { setSearch(e.target.value); setSuggestOpen(false); }}
        onClear={() => setSearch("")}
        onFocus={() => { if (haveSaved && !search) setSuggestOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
          if (e.key === "Escape") { setSuggestOpen(false); setSearch(""); e.target.blur(); }
        }}
        placeholder={searchPlaceholder || "Brand, model, reference"}
        ariaLabel="Search watches"
        trailing={search && user && openFavPrompt ? (
          // Save-this-search: the heart in the bar, so a saved search is one tap from the
          // field it was typed in.
          <button type="button" className="ui-search-act" onClick={openFavPrompt}
                  disabled={!!currentIsSaved}
                  aria-label={currentIsSaved ? "Already saved" : "Save search as favorite"}
                  title={currentIsSaved ? "Saved to favorites" : "Save as favorite search"}>
            <HeartIcon size={14} filled={!!currentIsSaved} />
          </button>
        ) : null}>
        {suggestOpen && haveSaved && !search ? (
          <div className="ui-search-drop">
            <SuggestionRows
              heading="Saved searches"
              rows={savedSearches.map((s) => ({
                id: s.id, label: s.label, saved: s,
                meta: `${s.count} for sale${s.newCount ? ` · ${s.newCount} new` : ""}`,
              }))}
              onRun={(r) => { setSuggestOpen(false); if (onRunSavedSearch) onRunSavedSearch(r.saved); }}
              onRemove={onRemoveSavedSearch ? (r) => onRemoveSavedSearch(r.saved) : undefined} />
          </div>
        ) : null}
      </SearchField>
    </div>
  );
}

// ---- the filter bar -----------------------------------------------------------------
//   count   the text at the bar's right edge, or omitted when the page shows it elsewhere
//   stacked     give the bar's search its own row (see FilterBar)
//   searchSlot  the bar's own search element (a page with no header search, like the catalog);
//               not `search`, which in the shared props bag is the typed query
//   Source / Brand / Model pills open a chip panel INSIDE the sticky zone; on a phone one
//   Filter pill replaces them and opens the sheet.
export function ListingsFilterBar({
  isMobile, listingsSubTab, setDrawerOpen, count, searchSlot, stacked,
  minPriceText, setMinPriceText, maxPriceText, setMaxPriceText,
  sort, setSort, hasFilters, resetFilters,
  activeFilterPop, setActiveFilterPop,
  filterSources, filterBrands, filterModels,
  toggleSource, toggleBrand, toggleModel,
  visibleSources, visibleBrands, visibleModels,
  DEALER_SOURCES, AUCTION_SOURCES, MODELS,
  SOURCES_SHOW, BRANDS_SHOW, MODELS_SHOW,
  effectiveSourcesCount, effectiveBrandsCount, effectiveModelsCount,
  sourcesExpanded, setSourcesExpanded, brandsExpanded, setBrandsExpanded,
  modelsExpanded, setModelsExpanded, onOpenCalendar,
}) {
  const { showDealerSources, showAuctionSources } = sourceFamilies(listingsSubTab);
  const visDealers = (visibleSources || []).filter((s) => (DEALER_SOURCES || []).includes(s));
  const visAuctions = (visibleSources || []).filter((s) => (AUCTION_SOURCES || []).includes(s));
  const hasAnySource = visDealers.length > 0 || visAuctions.length > 0;

  // On a phone Source / Brand / Model / Price fold into the filter sheet, so the row carries
  // ONE Filter pill; the number says how much is already applied.
  const activeFilterCount = (filterSources?.length || 0) + (filterBrands?.length || 0)
    + (filterModels?.length || 0) + ((minPriceText || maxPriceText) ? 1 : 0);

  const isDateSort = sort === "date" || sort === "date-asc";
  const isPriceSort = sort === "price-asc" || sort === "price-desc";
  const togglePop = (name) => setActiveFilterPop((p) => (p === name ? null : name));

  const sourcePanel = (
    <ChipPanel>
      {!hasAnySource ? (
        <span style={{ fontSize: 12, color: "var(--text3)" }}>
          {(filterBrands?.length || 0) > 0 || (filterModels?.length || 0) > 0
            ? "No sources match the active brand / model filter."
            : "No sources yet."}
        </span>
      ) : (
        <>
          {showDealerSources && visDealers.map((s) => (
            <Chip key={s} on={filterSources.includes(s)} onClick={() => toggleSource(s)}>{s}</Chip>
          ))}
          {showAuctionSources && visAuctions.map((s) => (
            <Chip key={s} on={filterSources.includes(s)} onClick={() => toggleSource(s)}>{s}</Chip>
          ))}
          {effectiveSourcesCount > (SOURCES_SHOW || 0) && (
            <Chip quiet onClick={() => setSourcesExpanded(!sourcesExpanded)}>
              {sourcesExpanded ? "Less ↑" : `+${effectiveSourcesCount - (SOURCES_SHOW || 0)} more`}
            </Chip>
          )}
        </>
      )}
    </ChipPanel>
  );
  const brandPanel = (
    <ChipPanel>
      {(visibleBrands || []).map((b) => (
        <Chip key={b} on={filterBrands.includes(b)} onClick={() => toggleBrand(b)}>{b}</Chip>
      ))}
      {effectiveBrandsCount > (BRANDS_SHOW || 0) && (
        <Chip quiet onClick={() => setBrandsExpanded(!brandsExpanded)}>
          {brandsExpanded ? "Less ↑" : `+${effectiveBrandsCount - (BRANDS_SHOW || 0)} more`}
        </Chip>
      )}
    </ChipPanel>
  );
  const modelPanel = (
    <ChipPanel>
      {(visibleModels || []).map((m) => (
        <Chip key={m} on={(filterModels || []).includes(m)} onClick={() => toggleModel && toggleModel(m)}>{m}</Chip>
      ))}
      {effectiveModelsCount > (MODELS_SHOW || 0) && (
        <Chip quiet onClick={() => setModelsExpanded && setModelsExpanded(!modelsExpanded)}>
          {modelsExpanded ? "Less ↑" : `+${effectiveModelsCount - (MODELS_SHOW || 0)} more`}
        </Chip>
      )}
    </ChipPanel>
  );

  const pills = (
    <>
      {listingsSubTab === "auctions" && onOpenCalendar ? (
        <Pill onClick={onOpenCalendar} title="Browse the auction calendar">Auction calendar</Pill>
      ) : null}
      {isMobile ? (
        <Pill icon={<FilterIcon />} aria-label="Filters" on={activeFilterCount > 0}
              n={activeFilterCount || null} onClick={() => setDrawerOpen(true)}>Filter</Pill>
      ) : (
        <>
          <Pill on={filterSources.length > 0 || activeFilterPop === "source"} n={filterSources.length || null}
                onClick={() => togglePop("source")}>Source</Pill>
          <Pill on={filterBrands.length > 0 || activeFilterPop === "brand"} n={filterBrands.length || null}
                onClick={() => togglePop("brand")}>Brand</Pill>
          {(MODELS?.length || 0) > 0 ? (
            <Pill on={(filterModels?.length || 0) > 0 || activeFilterPop === "model"}
                  n={(filterModels?.length || 0) || null} onClick={() => togglePop("model")}>Model</Pill>
          ) : null}
        </>
      )}
      {hasFilters ? <Pill quiet onClick={resetFilters}>× Clear all</Pill> : null}
    </>
  );

  // Sort keeps the shells' toggle cycle exactly: tap Date for newest-first, again for
  // oldest-first; same for price.
  const end = (
    <>
      {!isMobile ? (
        <PriceRange min={minPriceText} max={maxPriceText} onMin={setMinPriceText} onMax={setMaxPriceText}
                    onClear={() => { setMinPriceText(""); setMaxPriceText(""); }} />
      ) : null}
      <Pill on={isDateSort} onClick={() => setSort(sort === "date" ? "date-asc" : "date")}>
        {sort === "date" ? "Date ↓" : sort === "date-asc" ? "Date ↑" : "Date"}
      </Pill>
      <Pill on={isPriceSort} onClick={() => setSort(sort === "price-desc" ? "price-asc" : "price-desc")}>
        {sort === "price-desc" ? "Price ↓" : sort === "price-asc" ? "Price ↑" : "Price"}
      </Pill>
    </>
  );

  return (
    <FilterBar sticky stacked={stacked} pills={pills} end={end} count={count} search={searchSlot}
      panel={!isMobile
        ? (activeFilterPop === "source" ? sourcePanel
          : activeFilterPop === "brand" ? brandPanel
          : activeFilterPop === "model" ? modelPanel : null)
        : null} />
  );
}

// ---- the phone's filter sheet -----------------------------------------------------------
export function ListingsFilterSheet(props) {
  const {
    isMobile, listingsSubTab, drawerOpen, setDrawerOpen,
    DEALER_SOURCES, AUCTION_SOURCES, visibleSources, filterSources, toggleSource,
    effectiveSourcesCount, SOURCES_SHOW, sourcesExpanded, setSourcesExpanded,
    visibleBrands, filterBrands, toggleBrand, effectiveBrandsCount, BRANDS_SHOW,
    brandsExpanded, setBrandsExpanded,
    MODELS, visibleModels, filterModels, toggleModel, effectiveModelsCount, MODELS_SHOW,
    modelsExpanded, setModelsExpanded,
    minPriceText, setMinPriceText, maxPriceText, setMaxPriceText,
    hasFilters, resetFilters, displayedCount,
  } = props;
  if (!isMobile) return null;
  const { showDealerSources, showAuctionSources } = sourceFamilies(listingsSubTab);
  return (
    <FilterDrawer
      drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}
      showDealerSources={showDealerSources} showAuctionSources={showAuctionSources}
      DEALER_SOURCES={DEALER_SOURCES} AUCTION_SOURCES={AUCTION_SOURCES}
      visibleSources={visibleSources} filterSources={filterSources} toggleSource={toggleSource}
      effectiveSourcesCount={effectiveSourcesCount} SOURCES_SHOW={SOURCES_SHOW}
      sourcesExpanded={sourcesExpanded} setSourcesExpanded={setSourcesExpanded}
      visibleBrands={visibleBrands} filterBrands={filterBrands} toggleBrand={toggleBrand}
      effectiveBrandsCount={effectiveBrandsCount} BRANDS_SHOW={BRANDS_SHOW}
      brandsExpanded={brandsExpanded} setBrandsExpanded={setBrandsExpanded}
      MODELS={MODELS} visibleModels={visibleModels} filterModels={filterModels} toggleModel={toggleModel}
      effectiveModelsCount={effectiveModelsCount} MODELS_SHOW={MODELS_SHOW}
      modelsExpanded={modelsExpanded} setModelsExpanded={setModelsExpanded}
      minPriceText={minPriceText} setMinPriceText={setMinPriceText}
      maxPriceText={maxPriceText} setMaxPriceText={setMaxPriceText}
      hasFilters={hasFilters} resetFilters={resetFilters} displayedCount={displayedCount} />
  );
}
