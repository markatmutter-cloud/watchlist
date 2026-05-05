import React, { useState } from "react";
import { SizeCompare } from "./SizeCompare";
import { ChallengesView } from "./ChallengesView";
import { Links } from "./Links";

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
// No client-side URL routing in this app, so navigation between the
// landing list and an individual tool happens via local state on this
// component. Add a new resource by adding a card row below and
// branching the render on the matching `view` value.

const RESOURCES = [
  {
    key: "size-compare",
    title: "Watch size comparison",
    desc: "Compare any two watches by case dimensions. Print to scale on US Letter to lay on your wrist.",
  },
  {
    key: "challenges",
    title: "Watch challenges",
    desc: "Pick N watches under a budget. A thought experiment, a way to surface taste, or a question to send a friend.",
  },
  {
    key: "links",
    title: "Links",
    desc: "Outbound links — every dealer in the feed, plus per-reference research clusters (Rolex GMT 1675, Tudor Sub 7021, Heuer, …).",
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
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "4px 4px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: "var(--text1)" }}>
        Cool Stuff
      </h1>
      <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 20px" }}>
        Tools, calculators, and reference material for vintage-watch collectors.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {RESOURCES.map(r => (
          <button key={r.key} onClick={() => setView(r.key)} style={{
            display: "flex", alignItems: "stretch",
            borderRadius: 12, overflow: "hidden",
            border: "0.5px solid var(--border)",
            background: "var(--card-bg)",
            textAlign: "left", color: "inherit", fontFamily: "inherit",
            cursor: "pointer", padding: "16px 18px",
            transition: "border-color 120ms ease",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text1)", marginBottom: 4 }}>
                {r.title}
              </div>
              <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.4 }}>
                {r.desc}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", color: "var(--text3)", flexShrink: 0, paddingLeft: 12 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </button>
        ))}
      </div>

      <div style={{
        marginTop: 24, padding: "20px 18px",
        border: "0.5px dashed var(--border)", borderRadius: 12,
        color: "var(--text3)", fontSize: 13, lineHeight: 1.5, textAlign: "center",
      }}>
        More tools and reference material coming. Calculators for lug-to-lug fit, strap sizing, and a vintage reference encyclopedia are all on the roadmap.
      </div>
    </div>
  );
}
