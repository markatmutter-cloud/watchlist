// MagazineWatches — the Watches tab wearing the magazine's chrome.
//
// Built as a PARALLEL surface at `?view=watches` (Mark, 2026-09-08: "create
// a new page using the new design style but keeping structure and features …
// as a separate page while testing"), and PROMOTED to the default Watches tab
// 2026-10-16. The shells' own Watches chrome is still reachable at
// `?view=classic` for a trial window, then goes.
//
// The rule this file is built to (SESSION_HANDOFF 2026-09-07): RESTYLE, DO
// NOT REBUILD. The grid, the cards, the hearts, the ⋯ menus, the date
// dividers, infinite scroll and the calendar modal all arrive as
// `gridJSX` — the same `listingsTabContentJSX` the shells render. Only the
// chrome above the grid is new, and every control in it is wired to the SAME
// App.js state and handlers the shells use (sub-tabs, search, sort, price,
// saved-only, source / brand / model, reset). The failure mode here is not
// ugly styling, it is quietly dropping one of those behaviours.
//
// Feature parity checklist with the shells' Watches chrome:
//   sub-tabs (For sale / Auctions / Sold / ♡ Saved) · in-tab search + the
//   save-search heart · Source / Brand / Model chip panels with their
//   cross-axis filtering and +N more expanders · Auction Calendar (auctions
//   sub-tab) · ♡ Saved-only · min/max price · date + price sort · clear all ·
//   the result count · the home affordance back to the landing page.

import React from "react";
import MagazineChrome, { MAG_CSS } from "./MagazineChrome";
import { AboutModal } from "./AboutModal";
import { SignInPromptModal } from "./SignInPromptModal";

function Pill({ active, onClick, children, title, ariaPressed }) {
  return (
    <button type="button" onClick={onClick} title={title}
            aria-pressed={ariaPressed}
            className={`magw-pill${active ? " on" : ""}`}>
      {children}
    </button>
  );
}

function ChipRow({ children }) {
  return <div className="magw-chips">{children}</div>;
}

function MagChip({ label, active, onClick, quiet }) {
  return (
    <button type="button" onClick={onClick}
            className={`magw-chip${active ? " on" : ""}${quiet ? " quiet" : ""}`}>
      {label}
    </button>
  );
}

export default function MagazineWatches(props) {
  const {
    isMobile, baseStyle, tabs, authJSX, user, onHome, goToSaved,
    // sub-tabs
    listingsSubTab, setListingsSubTab, setPage, setDrawerOpen,
    // search
    search, setSearch, searchPlaceholder, openFavPrompt, currentIsSaved,
    // sort + price
    sort, setSort, minPriceText, setMinPriceText, maxPriceText, setMaxPriceText,
    // filters
    filterHearted, setFilterHearted, hasFilters, resetFilters, displayedCount,
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

  // Same sub-tab-aware source split the shells use: the Auctions slice has no
  // dealers in it and the For-sale slice has no houses, so offering the other
  // family's chips there would only ever empty the grid.
  const showDealerSources = listingsSubTab !== "auctions";
  const showAuctionSources = listingsSubTab !== "live";
  const expandedSource = activeFilterPop === "source";
  const expandedBrand = activeFilterPop === "brand";
  const expandedModel = activeFilterPop === "model";

  const visDealers = (visibleSources || []).filter((s) => (DEALER_SOURCES || []).includes(s));
  const visAuctions = (visibleSources || []).filter((s) => (AUCTION_SOURCES || []).includes(s));
  const hasAnySource = visDealers.length > 0 || visAuctions.length > 0;

  const isDateSort = sort === "date" || sort === "date-asc";
  const isPriceSort = sort === "price-asc" || sort === "price-desc";

  // The masthead search on this page IS the tab filter — it types straight
  // into App.js's `search`, so what you see in the field is what the grid is
  // filtered by. (Home's masthead search routes instead; that's why the
  // chrome takes the field as a slot rather than owning one.)
  const searchJSX = (
    <div className="magw-searchwrap">
      <form className="magw-search" role="search" onSubmit={(e) => { e.preventDefault(); }}>
        <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="5" /><path d="M11 11l4 4" />
        </svg>
        <input
          type="search"
          value={search || ""}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
            if (e.key === "Escape") { setSearch(""); e.target.blur(); }
          }}
          placeholder={searchPlaceholder || "Brand, model, reference"}
          aria-label="Search watches"
        />
        {search ? (
          <button type="button" className="magw-search-x" aria-label="Clear search"
                  onClick={() => setSearch("")}>&times;</button>
        ) : null}
        {/* Save-this-search heart — the shells' `trailing` slot, kept so a
            saved search is still one tap from the field it was typed in. */}
        {search && user && openFavPrompt ? (
          <button type="button" className="magw-savesearch" onClick={openFavPrompt}
                  disabled={!!currentIsSaved}
                  aria-label={currentIsSaved ? "Already saved" : "Save search as favorite"}
                  title={currentIsSaved ? "Saved to favorites" : "Save as favorite search"}>
            <svg width="13" height="13" viewBox="0 0 24 24"
                 fill={currentIsSaved ? "currentColor" : "none"}
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span>{currentIsSaved ? "Saved" : "Save"}</span>
          </button>
        ) : null}
      </form>
    </div>
  );

  const subTabs = [
    ["live", "For sale"],
    ["auctions", "Auctions"],
    ["sold", "Sold"],
    ["saved", "♡ Saved"],
  ];

  return (
    <div className="mag magw" style={baseStyle}>
      <style>{MAG_CSS}</style>
      <style>{MAGW_CSS}</style>

      {/* The chrome sits OUTSIDE the 1600px column so its olive band runs
          edge to edge at any width; --magw-gutter lines its content up with
          the column underneath. It stays a direct child of .magw (a tall
          parent), which is what lets the bar stick. */}
      <MagazineChrome
        isMobile={isMobile}
        tabs={tabs}
        authJSX={authJSX}
        showSaved={!!user}
        onSavedClick={goToSaved}
        onHome={onHome}
        searchJSX={searchJSX}
      />

      <div className="magw-page">
        {/* The deck: what slice you're in, how many are in it, and the
            controls that change either. Sticky under the chrome so the
            filters stay reachable at any scroll depth, as they are in the
            shells' pinned chrome. */}
        <div className="magw-deck">
          <div className="magw-deckrow">
            <div className="magw-subtabs" role="tablist" aria-label="Listings views">
              {subTabs.map(([key, label]) => (
                <button key={key} type="button" role="tab"
                        aria-selected={listingsSubTab === key}
                        className={listingsSubTab === key ? "on" : ""}
                        onClick={() => {
                          setListingsSubTab(key);
                          if (setDrawerOpen) setDrawerOpen(false);
                          setPage(1);
                        }}>
                  {label}
                </button>
              ))}
            </div>
            <p className="magw-count">
              {(displayedCount || 0).toLocaleString()} {displayedCount === 1 ? "watch" : "watches"}
            </p>
          </div>

          <div className="magw-controls">
            {listingsSubTab === "auctions" && onOpenCalendar ? (
              <Pill onClick={onOpenCalendar} title="Browse the auction calendar">
                Auction calendar
              </Pill>
            ) : null}
            <Pill active={filterSources.length > 0 || expandedSource}
                  onClick={() => setActiveFilterPop((p) => (p === "source" ? null : "source"))}>
              Source{filterSources.length > 0 ? ` · ${filterSources.length}` : ""}
            </Pill>
            <Pill active={filterBrands.length > 0 || expandedBrand}
                  onClick={() => setActiveFilterPop((p) => (p === "brand" ? null : "brand"))}>
              Brand{filterBrands.length > 0 ? ` · ${filterBrands.length}` : ""}
            </Pill>
            {(MODELS?.length || 0) > 0 ? (
              <Pill active={(filterModels?.length || 0) > 0 || expandedModel}
                    onClick={() => setActiveFilterPop((p) => (p === "model" ? null : "model"))}>
                Model{(filterModels?.length || 0) > 0 ? ` · ${filterModels.length}` : ""}
              </Pill>
            ) : null}
            {/* Saved-only is a filter, not a sort, so it sits with the nouns
                (P-1). Hidden on the Saved slice, where it could only be a
                no-op, and signed-out, where there's nothing saved to filter. */}
            {user && listingsSubTab !== "saved" && listingsSubTab !== "calendar" ? (
              <Pill active={!!filterHearted} ariaPressed={!!filterHearted}
                    title={filterHearted ? "Show all" : "Show only saved"}
                    onClick={() => setFilterHearted && setFilterHearted(!filterHearted)}>
                ♡ Saved
              </Pill>
            ) : null}

            <span className="magw-sp" />

            <div className="magw-price">
              <span>$</span>
              <input value={minPriceText} onChange={(e) => setMinPriceText(e.target.value)}
                     placeholder="Min" inputMode="numeric" aria-label="Minimum price USD" />
              <span>–</span>
              <input value={maxPriceText} onChange={(e) => setMaxPriceText(e.target.value)}
                     placeholder="Max" inputMode="numeric" aria-label="Maximum price USD" />
              {(minPriceText || maxPriceText) ? (
                <button type="button" aria-label="Clear price filter"
                        onClick={() => { setMinPriceText(""); setMaxPriceText(""); }}>&times;</button>
              ) : null}
            </div>

            {/* Sort pills keep the shells' toggle cycle exactly: tap Date to
                sort newest-first, tap again for oldest-first; same for price. */}
            <Pill active={isDateSort}
                  onClick={() => setSort(sort === "date" ? "date-asc" : "date")}>
              {sort === "date" ? "Date ↓" : sort === "date-asc" ? "Date ↑" : "Date"}
            </Pill>
            <Pill active={isPriceSort}
                  onClick={() => setSort(sort === "price-desc" ? "price-asc" : "price-desc")}>
              {sort === "price-desc" ? "Price ↓" : sort === "price-asc" ? "Price ↑" : "Price"}
            </Pill>
            {hasFilters ? (
              <button type="button" className="magw-clear" onClick={resetFilters}>Clear all</button>
            ) : null}
          </div>

          {expandedSource ? (
            <ChipRow>
              {!hasAnySource ? (
                <span className="magw-empty">
                  {(filterBrands?.length || 0) > 0 || (filterModels?.length || 0) > 0
                    ? "No sources match the active brand / model filter."
                    : "No sources yet."}
                </span>
              ) : (
                <>
                  {showDealerSources && visDealers.map((s) => (
                    <MagChip key={s} label={s} active={filterSources.includes(s)} onClick={() => toggleSource(s)} />
                  ))}
                  {showAuctionSources && visAuctions.map((s) => (
                    <MagChip key={s} label={s} active={filterSources.includes(s)} onClick={() => toggleSource(s)} />
                  ))}
                  {effectiveSourcesCount > (SOURCES_SHOW || 0) ? (
                    <MagChip quiet
                             label={sourcesExpanded ? "Less ↑" : `+${effectiveSourcesCount - (SOURCES_SHOW || 0)} more`}
                             onClick={() => setSourcesExpanded(!sourcesExpanded)} />
                  ) : null}
                </>
              )}
            </ChipRow>
          ) : null}

          {expandedBrand ? (
            <ChipRow>
              {(visibleBrands || []).map((b) => (
                <MagChip key={b} label={b} active={filterBrands.includes(b)} onClick={() => toggleBrand(b)} />
              ))}
              {effectiveBrandsCount > (BRANDS_SHOW || 0) ? (
                <MagChip quiet
                         label={brandsExpanded ? "Less ↑" : `+${effectiveBrandsCount - (BRANDS_SHOW || 0)} more`}
                         onClick={() => setBrandsExpanded(!brandsExpanded)} />
              ) : null}
            </ChipRow>
          ) : null}

          {expandedModel ? (
            <ChipRow>
              {(visibleModels || []).map((m) => (
                <MagChip key={m} label={m} active={(filterModels || []).includes(m)}
                         onClick={() => toggleModel && toggleModel(m)} />
              ))}
              {effectiveModelsCount > (MODELS_SHOW || 0) ? (
                <MagChip quiet
                         label={modelsExpanded ? "Less ↑" : `+${effectiveModelsCount - (MODELS_SHOW || 0)} more`}
                         onClick={() => setModelsExpanded && setModelsExpanded(!modelsExpanded)} />
              ) : null}
            </ChipRow>
          ) : null}
        </div>

        {/* The real grid, untouched: App.js's listingsTabContentJSX. */}
        <div className="magw-grid">{gridJSX}</div>
      </div>

      {overlaysJSX}
      <AboutModal open={!!aboutModalOpen} onClose={() => setAboutModalOpen(false)}
                  primaryCurrency={primaryCurrency} />
      <SignInPromptModal open={!!signInPromptOpen}
                         onClose={() => setSignInPromptOpen && setSignInPromptOpen(false)}
                         onSignIn={() => signInWithGoogle && signInWithGoogle()} />
    </div>
  );
}

// Namespaced `magw-`, and it takes every colour from the app's :root tokens,
// so dark mode needs no second palette (same contract as MAG_CSS).
export const MAGW_CSS = `
/* ---------------------------------------------------------------------
   Typography: the app's own, not the magazine's (Mark, 2026-09-08 — "not
   massively keen on the fonts … like the original interface but with
   different colors and change the word mark").

   So this page keeps the magazine's COLOUR and layout — olive ink on paper,
   the underlined slice, the pill controls — and drops its three faces for the
   system stack every other tab already uses. Scoped to .mag.magw (two
   classes, so it beats MAG_CSS's .mag regardless of injection order): the
   landing page is untouched and keeps Bodoni.

   The wordmark changes with them: the app's original treatment — uppercase,
   letterspaced, bold — set in olive rather than white on the olive bar. It
   is the one place the two surfaces still differ in shape, so it stays
   distinct without being a second typeface.
   --------------------------------------------------------------------- */
.mag.magw { --mag-display: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
            --mag-body: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
            --mag-data: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif; }
.mag.magw .mag-wordmark { font-family: var(--mag-body); text-transform: uppercase;
                          font-weight: 700; letter-spacing: .14em; line-height: 1.1;
                          font-size: clamp(19px, 2.6vw, 27px); }
/* The crescent is sized off the Bodoni cap-height; with a smaller wordmark it
   over-balanced the row. */
.mag.magw .mag-crescent svg { width: clamp(20px, 2.2vw, 26px); height: clamp(20px, 2.2vw, 26px); }
.mag.magw .mag-mhead .mag-crescent svg { width: 21px; height: 21px; }

.magw { min-height: 100vh; background: var(--bg);
        --magw-gutter: max(clamp(14px, 2.4vw, 28px), calc((100% - 1600px) / 2 + clamp(14px, 2.4vw, 28px))); }
.magw-page { max-width: 1600px; margin: 0 auto; padding: 0 clamp(14px, 2.4vw, 28px) 40px; }

/* The olive band (Mark, 2026-10-16). Masthead and bar are one colour with no
   seam; the sticky bar keeps it when the masthead has scrolled away. Colours
   come from the --band-* tokens in MAG_CSS. */
.magw .mag-flag, .magw .mag-bar { background: var(--band-bg); border-bottom: none;
                                  padding-left: var(--magw-gutter); padding-right: var(--magw-gutter); }
.magw .mag-flag { padding-top: 18px; padding-bottom: 10px; }
.magw .mag-mhead { background: var(--band-bg); border-bottom: none;
                   padding-left: var(--magw-gutter); padding-right: var(--magw-gutter);
                   padding-top: calc(env(safe-area-inset-top, 0px) + 6px); }
.magw .mag-wordmark, .magw .mag-crescent { color: var(--band-ink); }
.magw .mag-bar-tabs button { color: var(--band-ink2); }
.magw .mag-bar-tabs button:hover, .magw .mag-bar-tabs button.on { color: var(--band-ink); border-bottom-color: var(--band-ink); }
.magw .mag-icon { color: var(--band-ink); border-color: var(--band-line); }
.magw .mag-icon:hover { color: var(--band-ink); border-color: var(--band-ink); }

/* Deck — sub-tabs, count, controls.
   Desktop: sticky UNDER the chrome's own sticky bar (.mag-bar, ~58px tall:
   12px padding either side of a 34px control row), so the filters stay
   reachable at depth the way the shells' pinned chrome does. The offset is a
   measured constant because the two sticky elements are siblings; when this
   page is promoted, chrome + deck should become one sticky stack and the
   number goes away.
   Mobile: static. The mobile masthead COMPACTS on scroll (three rows to two),
   so there is no fixed offset to stick beneath — a pinned deck would tear
   away from it mid-scroll. */
.magw-deck { background: var(--bg); border-bottom: .5px solid var(--border); padding: 10px 0 8px; }
@media (min-width: 701px) {
  .magw-deck { position: sticky; top: 58px; z-index: 25; }
}
.magw-deckrow { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.magw-subtabs { display: flex; gap: 4px 20px; flex-wrap: wrap; min-width: 0; }
/* Sans at 25px reads as a headline, which is what the serif was for. Sized
   down to tab scale now the face is the app's own. */
.magw-subtabs button { font-family: var(--mag-display); font-size: clamp(15.5px, 1.6vw, 19px);
                       font-weight: 500; line-height: 1.2; letter-spacing: .01em;
                       background: none; border: none;
                       cursor: pointer; padding: 3px 0; color: var(--text3);
                       border-bottom: 1.5px solid transparent; }
.magw-subtabs button:hover { color: var(--text1); }
.magw-subtabs button.on { color: var(--brand-olive-ink); font-weight: 600;
                          border-bottom-color: var(--brand-olive-text); }
.magw-count { font-family: var(--mag-data); font-size: 11px; letter-spacing: .14em;
              text-transform: uppercase; color: var(--text3); margin: 0; white-space: nowrap;
              font-variant-numeric: tabular-nums; }

.magw-controls { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; padding-top: 9px; }
.magw-sp { flex: 1 1 auto; }
.magw-pill { font-family: var(--mag-data); font-size: 11px; letter-spacing: .1em;
             text-transform: uppercase; background: var(--card-bg); color: var(--text2);
             border: .5px solid var(--border); border-radius: 999px; padding: 7px 13px;
             cursor: pointer; white-space: nowrap; }
.magw-pill:hover { border-color: var(--brand-olive-text); color: var(--brand-olive-text); }
.magw-pill.on { background: var(--brand-olive-text); border-color: var(--brand-olive-text); color: var(--bg); }
.magw-clear { font-family: var(--mag-data); font-size: 11px; letter-spacing: .1em;
              text-transform: uppercase; background: none; border: none; cursor: pointer;
              color: var(--text3); text-decoration: underline; text-underline-offset: 3px; padding: 7px 4px; }
.magw-clear:hover { color: var(--brand-olive-text); }

.magw-price { display: flex; align-items: center; gap: 5px; background: var(--card-bg);
              border: .5px solid var(--border); border-radius: 999px; padding: 0 8px 0 12px; height: 32px; }
.magw-price span { font-family: var(--mag-data); font-size: 11px; color: var(--text3); }
.magw-price input { border: none; background: transparent; outline: none; color: var(--text1);
                    font-family: var(--mag-data); font-size: 12px; width: 52px; padding: 4px 0;
                    font-variant-numeric: tabular-nums; }
.magw-price button { border: none; background: none; color: var(--text3); cursor: pointer;
                     font-size: 15px; line-height: 1; padding: 0 2px; }

.magw-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 0 2px; line-height: 1.5; }
.magw-chip { font-family: var(--mag-body); font-size: 12.5px; background: var(--card-bg);
             color: var(--text2); border: .5px solid var(--border); border-radius: 999px;
             padding: 5px 11px; cursor: pointer; }
.magw-chip:hover { border-color: var(--brand-olive-text); color: var(--brand-olive-text); }
.magw-chip.on { background: var(--brand-olive-text); border-color: var(--brand-olive-text); color: var(--bg); }
.magw-chip.quiet { background: none; color: var(--text3); border-style: dashed; }
.magw-empty { font-family: var(--mag-body); font-size: 12px; color: var(--text3); }

/* The tab's own search, in the chrome's search slot. */
.magw-searchwrap { position: relative; flex: 1 1 420px; max-width: 560px; }
.magw-search { display: flex; align-items: center; gap: 9px; border: 1px solid var(--border);
               border-radius: 999px; padding: 8px 10px 8px 18px; background: var(--card-bg); }
.magw-search svg { width: 15px; height: 15px; flex: 0 0 auto; color: var(--text3); }
.magw-search input { border: none; background: transparent; outline: none; width: 100%;
                     font-family: var(--mag-body); font-size: 14.5px; color: var(--text1); padding: 4px 0; }
.magw-search input::placeholder { color: var(--text3); }
.magw-search-x { border: none; background: none; color: var(--text3); cursor: pointer;
                 font-size: 17px; line-height: 1; padding: 0 4px; }
.magw-savesearch { display: flex; align-items: center; gap: 5px; flex: 0 0 auto; border: none;
                   background: none; cursor: pointer; color: var(--brand-olive-text);
                   font-family: var(--mag-data); font-size: 10.5px; letter-spacing: .12em;
                   text-transform: uppercase; padding: 2px 6px; }
.magw-savesearch:disabled { cursor: default; opacity: .75; }

.magw-grid { padding-top: 14px; }

@media (max-width: 700px) {
  .magw { --magw-gutter: 12px; }
  .magw-page { padding: 0 12px 32px; }
  .magw-deck { padding-top: 8px; }
  .magw-controls { gap: 6px; }
  .magw-sp { display: none; }
  /* Stack, don't share the line: at 390px the four sub-tabs wrap, and a
     baseline-aligned count then lands in the middle of them. */
  .magw-deckrow { flex-direction: column; align-items: flex-start; gap: 2px; }
  .magw-subtabs { gap: 2px 16px; }
  .magw-price { height: 30px; }
  .magw-price input { width: 46px; }
}
`;
