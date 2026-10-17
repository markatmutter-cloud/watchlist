// MagazineWatches — the Watches tab, built from the shared page frame (src/ui).
//
// History: built 2026-09-08 as a PARALLEL page at `?view=watches` (Mark: "create a new page
// using the new design style but keeping structure and features"), promoted to the default
// 2026-10-16. Rebuilt 2026-10-17 on src/ui (Mark: "every page is different ... without
// chasing leaks"): the page no longer owns a single style rule. The header, the pills, the
// search field, the sub-tabs, the chips, the count and the phone filter sheet are the same
// pieces Articles and Reference Guides use, so this page cannot drift from them.
//
// The rule it is built to (SESSION_HANDOFF 2026-10-07): RESTYLE, DO NOT REBUILD. The grid,
// the cards, the hearts, the ⋯ menus, the date dividers, infinite scroll and the calendar
// modal all arrive as `gridJSX` — the same `listingsTabContentJSX` the shells rendered.
// Every control here is wired to the SAME App.js state and handlers; the failure mode is
// not ugly styling, it is quietly dropping one of those behaviours.
//
// Feature checklist: sub-tabs (For sale / Auctions / Sold / ♡ Saved) · in-tab search + the
// save-search heart + saved searches under the focused field · Source / Brand / Model chip
// panels with cross-axis filtering and +N more · Auction Calendar (auctions) · min/max price
// · date + price sort · clear all · the result count · the home affordance · on a phone one
// Filter pill that opens the filter sheet.

import React, { useEffect, useRef, useState } from "react";
import { PageShell, Pill, Chip, ChipPanel, SearchField, SubTabs, PageFrame, FilterBar, Count,
         PriceRange, SuggestionRows } from "../ui";
import { FilterDrawer } from "./FilterDrawer";
import { FilterIcon, HeartIcon } from "./icons";

export default function MagazineWatches(props) {
  const {
    isMobile, baseStyle, tabs, authJSX, user, onHome, goToSaved,
    // sub-tabs
    listingsSubTab, setListingsSubTab, setPage, drawerOpen, setDrawerOpen,
    // saved searches, offered under the focused empty search field
    savedSearches, onRunSavedSearch, onRemoveSavedSearch,
    // "system" | "display" — the header's faces (src/lookFlag.js)
    chromeFaces,
    // search
    search, setSearch, searchPlaceholder, openFavPrompt, currentIsSaved,
    // sort + price
    sort, setSort, minPriceText, setMinPriceText, maxPriceText, setMaxPriceText,
    // filters
    hasFilters, resetFilters, displayedCount,
    activeFilterPop, setActiveFilterPop,
    filterSources, filterBrands, filterModels,
    toggleSource, toggleBrand, toggleModel,
    visibleSources, visibleBrands, visibleModels,
    DEALER_SOURCES, AUCTION_SOURCES, MODELS,
    SOURCES_SHOW, BRANDS_SHOW, MODELS_SHOW,
    effectiveSourcesCount, effectiveBrandsCount, effectiveModelsCount,
    sourcesExpanded, setSourcesExpanded,
    brandsExpanded, setBrandsExpanded,
    modelsExpanded, setModelsExpanded,
    onOpenCalendar,
    // content + overlays
    gridJSX, overlaysJSX,
    aboutModalOpen, setAboutModalOpen,
    signInPromptOpen, setSignInPromptOpen, signInWithGoogle, primaryCurrency,
  } = props;

  // Saved searches as suggestions when the field is focused and empty (Mark, 2026-10-16).
  // Signed out there are none, so nothing opens.
  const [suggestOpen, setSuggestOpen] = useState(false);
  const searchWrap = useRef(null);
  useEffect(() => {
    if (!suggestOpen) return undefined;
    const away = (e) => { if (searchWrap.current && !searchWrap.current.contains(e.target)) setSuggestOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [suggestOpen]);
  const haveSaved = !!user && (savedSearches || []).length > 0;

  // The Auctions slice has no dealers in it and the For-sale slice has no houses, so
  // offering the other family's chips there would only ever empty the grid.
  const showDealerSources = listingsSubTab !== "auctions";
  const showAuctionSources = listingsSubTab !== "live";
  const visDealers = (visibleSources || []).filter((s) => (DEALER_SOURCES || []).includes(s));
  const visAuctions = (visibleSources || []).filter((s) => (AUCTION_SOURCES || []).includes(s));
  const hasAnySource = visDealers.length > 0 || visAuctions.length > 0;

  // On a phone Source / Brand / Model / Price fold into the filter sheet, so the row carries
  // ONE Filter pill; the number says how much is already applied.
  const activeFilterCount = (filterSources?.length || 0) + (filterBrands?.length || 0)
    + (filterModels?.length || 0) + ((minPriceText || maxPriceText) ? 1 : 0);

  const isDateSort = sort === "date" || sort === "date-asc";
  const isPriceSort = sort === "price-asc" || sort === "price-desc";

  // The header's search on this page IS the tab filter: it types straight into App.js's
  // `search`, so what you see in the field is what the grid is filtered by.
  const searchJSX = (
    <div ref={searchWrap}>
      <SearchField
        size={isMobile ? "full" : "bar"}
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

  // Heart only (Mark, 2026-10-17, D5 B); the accessible name keeps the word.
  const subTabs = [
    { key: "live", label: "For sale" },
    { key: "auctions", label: "Auctions" },
    { key: "sold", label: "Sold" },
    { key: "saved", label: "♡", ariaLabel: "Saved" },
  ];

  // Source / Brand / Model options: a panel that opens inside the sticky filter zone.
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
  const togglePop = (name) => setActiveFilterPop((p) => (p === name ? null : name));

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
    <PageShell
      isMobile={isMobile} baseStyle={baseStyle} tabs={tabs} authJSX={authJSX} user={user}
      onHome={onHome} goToSaved={goToSaved} chromeFaces={chromeFaces} searchJSX={searchJSX}
      overlaysJSX={overlaysJSX}
      aboutModalOpen={aboutModalOpen} setAboutModalOpen={setAboutModalOpen}
      signInPromptOpen={signInPromptOpen} setSignInPromptOpen={setSignInPromptOpen}
      signInWithGoogle={signInWithGoogle} primaryCurrency={primaryCurrency}>
      <PageFrame
        subTabs={
          <SubTabs ariaLabel="Listings views" activeKey={listingsSubTab} tabs={subTabs}
                   onSelect={(key) => {
                     setListingsSubTab(key);
                     if (setDrawerOpen) setDrawerOpen(false);
                     setPage(1);
                   }} />
        }
        subTabsEnd={
          <Count>{(displayedCount || 0).toLocaleString()} {displayedCount === 1 ? "watch" : "watches"}</Count>
        }
        filterBar={
          <FilterBar sticky pills={pills} end={end}
            panel={!isMobile
              ? (activeFilterPop === "source" ? sourcePanel
                : activeFilterPop === "brand" ? brandPanel
                : activeFilterPop === "model" ? modelPanel : null)
              : null} />
        }>
        {/* The real grid, untouched: App.js's listingsTabContentJSX. */}
        {gridJSX}
      </PageFrame>

      {/* The phone's filter sheet (shared with the legacy shell until it is deleted). */}
      {isMobile ? (
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
          hasFilters={hasFilters} resetFilters={resetFilters} displayedCount={displayedCount}
        />
      ) : null}
    </PageShell>
  );
}
