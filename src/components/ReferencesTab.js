import React, { useState } from "react";
import { SizeCompare } from "./SizeCompare";
import { ChallengesView } from "./ChallengesView";
import { Links } from "./Links";
import { SubTabIntro } from "./SubTabIntro";

// References tab — broader collector resources surface. First tool
// is the watch size comparison; encyclopedia + curated link
// aggregator + further calculators land here over time. See
// ROADMAP.md "References" for the parking lot of future ideas.
//
// 2026-05-04: Watch Challenges moved here from a Watchlist sub-tab
// per Mark's restructure — challenges are a reflective collector
// resource (constrained-set thought experiments), not a saved-items
// surface. The list / drill-in flow lives in ChallengesView.
//
// 2026-05-05: landing visual aligned with Watchlist > Saved searches
// + Lists. Same SubTabIntro banner shape; same row shell as the Lists
// row (icon disc on the left, label + sub-label, chevron on the right).
//
// No client-side URL routing in this app, so navigation between the
// landing list and an individual tool happens via local state on this
// component. Add a new resource by adding a row below and branching
// the render on the matching `view` value.

// Resource row glyphs — match the Lists / Searches visual shell on
// the Watchlist tab so Cool Stuff reads as a sibling surface. Each
// glyph is a 18×18 SVG centred in the 36×36 disc.
function RulerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#185FA5"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.3 8.7L15.3 2.7a1 1 0 0 0-1.4 0L2.7 13.9a1 1 0 0 0 0 1.4l6 6a1 1 0 0 0 1.4 0L21.3 10.1a1 1 0 0 0 0-1.4z"/>
      <path d="M7.5 12.5l1.5 1.5"/>
      <path d="M10.5 9.5l1.5 1.5"/>
      <path d="M13.5 6.5l1.5 1.5"/>
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#185FA5"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#185FA5"
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
    key: "challenges",
    title: "Watch challenges",
    desc: "Pick N watches under a budget. A thought experiment, a way to surface taste, or a question to send a friend.",
    Icon: TargetIcon,
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

  if (view === "size-compare") {
    return (
      <div style={{ paddingTop: 4 }}>
        <SizeCompare onBack={() => setView("list")} />
      </div>
    );
  }

  if (view === "challenges") {
    return (
      <div style={{ paddingTop: 4 }}>
        <ChallengesView
          user={props.user}
          isAuthConfigured={props.isAuthConfigured}
          signInWithGoogle={props.signInWithGoogle}
          collectionsApi={props.collectionsApi}
          allListings={props.allListings}
          watchlist={props.watchlist}
          hidden={props.hidden}
          primaryCurrency={props.primaryCurrency}
          handleShare={props.handleShare}
          onBack={() => setView("list")}
        />
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
        title="Cool Stuff"
        blurb={<>Tools, calculators, and curated link sets for vintage-watch collectors. New tools land here as they come together — calculators for lug-to-lug fit and strap sizing, and a reference encyclopedia, are on the roadmap.</>}
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
                background: "rgba(24,95,165,0.08)",
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
