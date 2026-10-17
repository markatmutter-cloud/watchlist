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
// The search, filter bar and phone sheet are ListingsFilters.js (shared with a drilled-in list).
//
// Feature checklist: sub-tabs (For sale / Auctions / Sold / ♡ Saved) · in-tab search + the
// save-search heart + saved searches under the focused field · Source / Brand / Model chip
// panels with cross-axis filtering and +N more · Auction Calendar (auctions) · min/max price
// · date + price sort · clear all · the result count · the home affordance · on a phone one
// Filter pill that opens the filter sheet.

import React from "react";
import { PageShell, SubTabs, PageFrame, Count } from "../ui";
import { ListingsSearch, ListingsFilterBar, ListingsFilterSheet } from "./ListingsFilters";

export default function MagazineWatches(props) {
  const {
    isMobile, baseStyle, tabs, authJSX, user, onHome, goToSaved,
    // sub-tabs
    listingsSubTab, setListingsSubTab, setPage, setDrawerOpen,
    // "system" | "display" — the header's faces (src/lookFlag.js)
    chromeFaces,
    displayedCount,
    // content + overlays
    gridJSX, overlaysJSX,
    aboutModalOpen, setAboutModalOpen,
    signInPromptOpen, setSignInPromptOpen, signInWithGoogle, primaryCurrency,
  } = props;

  // Heart only (Mark, 2026-10-17, D5 B); the accessible name keeps the word.
  const subTabs = [
    { key: "live", label: "For sale" },
    { key: "auctions", label: "Auctions" },
    { key: "sold", label: "Sold" },
    { key: "saved", label: "♡", ariaLabel: "Saved" },
  ];

  return (
    <PageShell
      isMobile={isMobile} baseStyle={baseStyle} tabs={tabs} authJSX={authJSX} user={user}
      onHome={onHome} goToSaved={goToSaved} chromeFaces={chromeFaces}
      // The header's search on this page IS the tab filter (ListingsSearch).
      searchJSX={<ListingsSearch {...props} />}
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
        filterBar={<ListingsFilterBar {...props} />}>
        {/* The real grid, untouched: App.js's listingsTabContentJSX. */}
        {gridJSX}
      </PageFrame>

      {/* The phone's filter sheet. */}
      <ListingsFilterSheet {...props} />
    </PageShell>
  );
}
