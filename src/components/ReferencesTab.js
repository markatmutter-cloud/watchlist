import React, { useState, useEffect } from "react";
import { SizeCompare } from "./SizeCompare";
import { Links } from "./Links";
import { SubTabIntro } from "./SubTabIntro";

// References tab — broader collector resources surface. First tool
// is the watch size comparison; encyclopedia + curated link
// aggregator + further calculators land here over time. See
// ROADMAP.md "References" for the parking lot of future ideas.
//
// 2026-05-04: Watch Challenges moved here from a Watchlist sub-tab.
// 2026-05-06 (PR #86): Watch Challenges moved OUT of here into the
// new top-level Collections tab — Mark's framing has settled on
// "everything is a list," and challenges are one kind of list. Cool
// Stuff goes back to being just tools + curated links.
//
// 2026-05-05: landing visual aligned with Watchlist > Saved searches
// + Lists. Same SubTabIntro banner shape; same row shell as the Lists
// row (icon disc on the left, label + sub-label, chevron on the right).

// Resource row glyphs.
function RulerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.3 8.7L15.3 2.7a1 1 0 0 0-1.4 0L2.7 13.9a1 1 0 0 0 0 1.4l6 6a1 1 0 0 0 1.4 0L21.3 10.1a1 1 0 0 0 0-1.4z"/>
      <path d="M7.5 12.5l1.5 1.5"/>
      <path d="M10.5 9.5l1.5 1.5"/>
      <path d="M13.5 6.5l1.5 1.5"/>
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
}

const RESOURCES = [
  {
    key: "size-compare",
    title: "Watch size comparison",
    desc: "Compare any two watches by case dimensions. Print to scale on US Letter to lay on your wrist.",
    Icon: RulerIcon,
  },
  {
    key: "links",
    title: "Links",
    desc: "Outbound links — every dealer in the feed, plus per-reference research clusters and curated lists for art, straps, editorial.",
    Icon: LinkIcon,
  },
];

export function ReferencesTab(props) {
  const [view, setView] = useState("list");

  // Tab re-tap → return to landing. App.js bumps `tabResetTick`
  // whenever the user clicks the active main tab pill (Mark feedback
  // 2026-05-07: tapping Learn while inside SizeCompare should return
  // to the Learn landing). Skip the initial mount so we don't reset
  // a deep-link drill-in.
  useEffect(() => {
    if (props.tabResetTick && props.tabResetTick > 0) setView("list");
    // eslint-disable-next-line
  }, [props.tabResetTick]);

  if (view === "size-compare") {
    return (
      <div style={{ paddingTop: 4 }}>
        <SizeCompare onBack={() => setView("list")} />
      </div>
    );
  }

  if (view === "links") {
    return (
      <div style={{ paddingTop: 4 }}>
        <Links allListings={props.allListings || []} onBack={() => setView("list")} />
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 4 }}>
      <SubTabIntro
        title="Learn"
        blurb={<>
          Tools and curated link sets for vintage-watch collectors. Today:
          a wrist-fit size comparison printout (calibrated 1:1 ruler), and
          a Links page that bundles every dealer in the feed plus
          per-reference research clusters. More tools — auction-cost
          calculator, reference encyclopedia — on the roadmap.
        </>}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {RESOURCES.map(r => (
          <button
            key={r.key}
            onClick={() => setView(r.key)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px", borderRadius: 12,
              border: "0.5px solid var(--border)",
              background: "var(--card-bg)",
              color: "var(--text1)", cursor: "pointer",
              fontFamily: "inherit", textAlign: "left",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div style={{
                flexShrink: 0,
                width: 36, height: 36, borderRadius: "50%",
                background: "var(--brand-tint-08)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <r.Icon />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>{r.title}</div>
                <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.4 }}>
                  {r.desc}
                </div>
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)"
                 strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
