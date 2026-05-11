import React from "react";

// Section divider used across every redesign surface (Listings landing
// "New today" / "Closing soon" / "Price drops", Auctions calendar "Live
// now" / "Upcoming", Shared list drill-in "Loved" / "Yes" / "No reaction
// yet" / "Hmmm" / "No"). Glyph + Newsreader serif title + sans count,
// optional right link.
//
// Consumes the redesign token family (--ink-1/2/3) directly — this is
// a new-system primitive and won't carry legacy --text fallbacks.
//
// Props:
//   glyph        — optional React node (icon component) shown left of the title
//   title        — string
//   count        — optional string or number (renders to right of title in ink-3)
//   rightLink    — optional { label, onClick } for "View all →" affordance
//   tight        — bool, narrower top padding (use after another section, no rule between)
//   muted        — bool, render in --ink-2 title / --ink-3 glyph (for "No reaction yet")

export function SectionHeader({ glyph, title, count, rightLink, tight = false, muted = false }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      padding: tight ? "14px 20px 6px" : "22px 20px 6px",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        {glyph && (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            color: muted ? "var(--ink-3)" : "var(--ink-1)",
          }}>
            {glyph}
          </span>
        )}
        <span style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: 19,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          color: muted ? "var(--ink-2)" : "var(--ink-1)",
        }}>{title}</span>
        {count != null && (
          <span style={{ fontSize: 10.5, color: "var(--ink-3)", fontWeight: 500 }}>{count}</span>
        )}
      </div>
      {rightLink && (
        <button onClick={rightLink.onClick}
          style={{
            fontSize: 10.5,
            color: "var(--ink-2)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontWeight: 500,
            fontFamily: "inherit",
            padding: 0,
          }}>{rightLink.label}</button>
      )}
    </div>
  );
}
