import React, { useEffect } from "react";
import { SizeCompare } from "./SizeCompare";
import { Links } from "./Links";
import { EditorialView } from "./EditorialView";
import { tabPill } from "../styles";

// Collecting tab (internal `tab="references"`, UI label "Collecting").
// Restructured 2026-05-18 (Mark spec) from a resource-button list
// landing into a Listings-pattern sub-tab strip:
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
  tabResetTick,
  subTab,
  setSubTab,
  cols,
  compact,
  gridStyle,
  isMobile,
}) {
  // Tab re-tap → return to default sub-tab. App.js bumps
  // `tabResetTick` whenever the user clicks the active main tab
  // pill. Mark feedback 2026-05-07: tapping the Collecting pill
  // while inside a tool should return to the landing — now expressed
  // as "return to the default sub-tab".
  useEffect(() => {
    if (tabResetTick && tabResetTick > 0 && typeof setSubTab === "function") {
      setSubTab("editorial");
    }
  }, [tabResetTick, setSubTab]);

  const current = subTab || "editorial";

  // ── Sub-tab strip — mirrors watchSubTabsJSX shape from App.js ──
  const SUB_TABS = [
    ["editorial", "Editorial"],
    ["size",      "Size comparison"],
    ["links",     "Links"],
  ];

  const subStrip = (
    <div style={{
      display: "flex",
      gap: isMobile ? 14 : 20,
      alignItems: "center",
      padding: isMobile ? "0 14px" : "0 20px",
      background: "var(--bg)",
      borderBottom: "0.5px solid var(--border)",
      flexShrink: 0,
      overflowX: "auto",
      overflowY: "hidden",
      WebkitOverflowScrolling: "touch",
      scrollbarWidth: "none",
      msOverflowStyle: "none",
    }}>
      {SUB_TABS.map(([key, label]) => {
        const active = current === key;
        return (
          <button key={key}
            onClick={() => typeof setSubTab === "function" && setSubTab(key)}
            style={{ ...tabPill(active), flexShrink: 0 }}>{label}</button>
        );
      })}
    </div>
  );

  // ── Sub-tab body dispatch ──────────────────────────────────────
  let body;
  if (current === "size") {
    body = (
      <div style={{ paddingTop: 4 }}>
        <SizeCompare onBack={null} />
      </div>
    );
  } else if (current === "links") {
    body = (
      <div style={{ paddingTop: 4 }}>
        <Links allListings={allListings || []} onBack={null} />
      </div>
    );
  } else {
    // editorial (default)
    body = (
      <EditorialView
        cols={cols}
        compact={compact}
        gridStyle={gridStyle}
        isMobile={isMobile}
      />
    );
  }

  return (
    <div>
      {subStrip}
      {body}
    </div>
  );
}
