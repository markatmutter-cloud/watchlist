import React, { useState } from "react";
import { SizeCompare } from "./SizeCompare";
import { Links } from "./Links";
import { EditorialView } from "./EditorialView";
import { ChallengesView } from "./ChallengesView";
import { ReferenceBrowse } from "./ReferenceBrowse";
import { SubTabs } from "../ui";

// Tools — bundles the utility surfaces (size comparison · links · challenges)
// under one Collecting sub-tab (Mark 2026-06-01), with an inner toggle to pick
// between them. Own useState (component-level, #310-safe).
function ToolsView({ initialTool = "size", challengeProps }) {
  const [tool, setTool] = useState(["size", "links", "challenges"].includes(initialTool) ? initialTool : "size");
  const OPTS = [
    { key: "size", label: "Size comparison" },
    { key: "links", label: "Links" },
    { key: "challenges", label: "Challenges" },
  ];
  return (
    <div>
      {/* The tools are views of one page, so they take the shared segmented sub-tabs. */}
      <div className="ui-tabs-row">
        <SubTabs ariaLabel="Tools" tabs={OPTS} activeKey={tool} onSelect={setTool} />
      </div>
      {tool === "links" ? (
        <Links allListings={challengeProps.allListings || []} onBack={null} />
      ) : tool === "challenges" ? (
        <ChallengesView {...challengeProps} />
      ) : (
        <SizeCompare onBack={null} />
      )}
    </div>
  );
}

// Internal `tab="references"` container. 2026-06-03 IA restructure: the
// "Collecting" umbrella label is gone — Articles (sub "editorial") and
// Reference Guides (sub "references") are separate TOP-LEVEL tabs over this
// same container, and the tools family launches from the account menu.
// This stays the thin dispatch over `subTab`:
//
//   editorial — Hairspring Finds + Bring a Loupe + more editorial
//               sources, card grid with filter/sort/search. Default.
//   size      — Watch size comparison (Calibrated 1:1 ruler).
//   links     — Outbound link clusters per dealer + reference.
//
// Sub-tab state is owned by App.js (`referencesSubTab` /
// `setReferencesSubTab`) so URL + localStorage persistence live in
// the same place as Listings / Watchlists sub-tab state. This
// component is now a thin dispatch.
//
// History:
// 2026-05-04: Watch Challenges moved here from a Watchlist sub-tab.
// 2026-05-06 (PR #86): Watch Challenges moved OUT of here into the
// new top-level Collections tab.
// 2026-05-18: Editorial sub-tab added (the editorial corpus surface);
// resource-list landing replaced by a real sub-tab strip.

export function ReferencesTab({
  user,
  isAuthConfigured,
  signInWithGoogle,
  allListings,
  // Bumped when the user re-taps the active Reference Guides top pill;
  // forwarded to ReferenceBrowse to exit a drilled-in guide (P-15).
  resetTick,
  subTab,
  setSubTab,
  cols,
  compact,
  gridStyle,
  isMobile,
  // Heart-articles plumbing (PR_P, 2026-05-20).
  watchlist,
  handleWish,
  // Add-to-list + Share on articles (PR_R, 2026-05-20).
  openCollectionPicker,
  handleShare,
  // Global search lifted up (2026-05-21): the in-Editorial search
  // input was retired so the top-bar search slot fills the header
  // symmetry gap on Collecting. EditorialView now reads `search`
  // from props (shared with the global listings search).
  search,
  setSearch,
  // Admin article curation pass-through (Mark 2026-06-06) — see
  // EditorialView's prop docs.
  isAdmin,
  adminHidden,
  onAdminRemoveArticle,
  // Challenges plumbing (PR 2026-05-22, moved from Watchlists →
  // Collecting). Same props ChallengesView consumed when it lived
  // in CollectionsTab.
  collectionsApi,
  hidden,
  primaryCurrency,
  pendingChallengeDrillId,
  clearPendingChallengeDrill,
  // Reference pages (2026-05-24): deep-link to Listings pre-filtered by
  // reference + click telemetry for the market/connection sliders.
  onViewAll,
  onClickListing,
}) {
  // The old tabResetTick → setSubTab("editorial") effect retired 2026-06-03:
  // Articles and Reference Guides are separate TOP pills now, each pinning
  // its own sub — a forced editorial reset would yank Reference Guides back
  // to Articles on re-tap. Drill-in reset on re-tap is the follow-up
  // (P-15/P-22) and lives with the drilled component, not here.

  const current = subTab || "editorial";

  // ── Body dispatch (sub driven by the top-tab pills / account menu) ──
  let body;
  if (current === "tools" || current === "size" || current === "links" || current === "challenges") {
    // Tools section (Mark 2026-06-01): size comparison · links · challenges
    // under one sub-tab. Legacy ?sub=size/links/challenges deep-links open
    // Tools with that tool pre-selected.
    body = (
      <ToolsView
        initialTool={current}
        challengeProps={{
          user, isAuthConfigured, signInWithGoogle, collectionsApi,
          allListings, watchlist, hidden, primaryCurrency, handleShare,
          pendingChallengeDrillId, clearPendingChallengeDrill,
        }}
      />
    );
  } else if (current === "references") {
    // Reference browse surface (2026-05-27) — the navigable Brand › Model line
    // › Reference tree with breadcrumbs, landing on the brand picker. Live nodes
    // open the full ReferencePage; coming_soon stubs open a teaser. Self-contained
    // nav (own URL params), so no hooks added here. See docs/REFERENCE_STRUCTURE_PLAN.md.
    body = (
      <ReferenceBrowse
        items={allListings || []}
        resetTick={resetTick}
        isMobile={isMobile}
        watchlist={watchlist}
        handleWish={handleWish}
        openCollectionPicker={openCollectionPicker}
        handleShare={handleShare}
        hidden={hidden}
        primaryCurrency={primaryCurrency}
        compact={compact}
        user={user}
        onClickListing={onClickListing}
        onViewAll={onViewAll}
      />
    );
  } else {
    // editorial (default)
    body = (
      <EditorialView
        cols={cols}
        compact={compact}
        gridStyle={gridStyle}
        isMobile={isMobile}
        watchlist={watchlist}
        handleWish={handleWish}
        openCollectionPicker={openCollectionPicker}
        handleShare={handleShare}
        search={search}
        setSearch={setSearch}
        isAdmin={isAdmin}
        adminHidden={adminHidden}
        onAdminRemoveArticle={onAdminRemoveArticle}
      />
    );
  }

  return (
    <div>
      {body}
    </div>
  );
}
