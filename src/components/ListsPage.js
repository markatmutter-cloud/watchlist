// ListsPage — the Lists container (internal tab "watchlist"), built from src/ui.
//
// What is left of the retired Saved top tab (Mark, 2026-10-17): Lists, and Searches. Saved
// watches live on Watches > ♡ and saved searches also show as suggestions under the
// search bar. Reached from the account menu.
//
// The page owns no styles and no content: `contentJSX` is App.js's CollectionsTab, exactly
// as the shells rendered it. The one thing it adds is the filter bar INSIDE a drilled-in
// list, so a long list can be date-sorted and narrowed by source / brand / price like
// Watches (the same ListingsFilters pieces, so the two cannot drift).

import React from "react";
import { PageShell, SubTabs, PageFrame } from "../ui";
import { ListingsSearch, ListingsFilterBar, ListingsFilterSheet } from "./ListingsFilters";

const SUB_TABS = [
  { key: "lists", label: "Lists" },
  { key: "searches", label: "Searches" },
];

export default function ListsPage(props) {
  const {
    isMobile, baseStyle, tabs, authJSX, user, onHome, goToSaved,
    watchTopTab, onSelectSub, colDrillInId, displayedCount, contentJSX, overlaysJSX,
    aboutModalOpen, setAboutModalOpen, signInPromptOpen, setSignInPromptOpen,
    signInWithGoogle, primaryCurrency,
  } = props;
  const drilledIn = watchTopTab === "lists" && !!colDrillInId;
  // A list can hold dealer listings and auction lots side by side, so both source families
  // are offered (the same rule as Watches > ♡).
  const f = { ...props, listingsSubTab: "saved" };
  return (
    <PageShell
      isMobile={isMobile} baseStyle={baseStyle} tabs={tabs} authJSX={authJSX} user={user}
      onHome={onHome} goToSaved={goToSaved}
      searchJSX={drilledIn ? <ListingsSearch {...f} /> : undefined}
      overlaysJSX={overlaysJSX}
      aboutModalOpen={aboutModalOpen} setAboutModalOpen={setAboutModalOpen}
      signInPromptOpen={signInPromptOpen} setSignInPromptOpen={setSignInPromptOpen}
      signInWithGoogle={signInWithGoogle} primaryCurrency={primaryCurrency}>
      <PageFrame
        subTabs={<SubTabs ariaLabel="Lists views" activeKey={watchTopTab} tabs={SUB_TABS} onSelect={onSelectSub} />}
        // "N items" inside a list: a bare number read as a stray "1" (Mark, 2026-06-03). The count
        // is the filter bar's, like every page.
        filterBar={drilledIn
          ? <ListingsFilterBar {...f} count={`${(displayedCount || 0).toLocaleString()} ${displayedCount === 1 ? "item" : "items"}`} />
          : null}>
        {contentJSX}
      </PageFrame>
      {drilledIn ? <ListingsFilterSheet {...f} /> : null}
    </PageShell>
  );
}
