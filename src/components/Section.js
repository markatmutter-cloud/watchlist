import React from "react";

// Sub-section grouping inside a tab content area. NOT a tab-level
// header — page-level headers (the back-arrow + title + actions row
// at the top of a list drill-in or the toggle row at the top of My
// watches) use a denser inline shape with their own paddings. Section
// is for nested groupings inside a single page (e.g. Owned / Sold
// rows when the My-watches "All" toggle is on).
//
// `show=false` collapses to just the children (no label / divider).
// Useful when the same render path covers both single-section and
// multi-section views: pass show={isMultiSection}.
//
// Promoted 2026-05-08 from CollectionsTab's private helper. Same
// padding / margin geometry; previously inlined.
export function Section({ label, show, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {show && (
        <div style={{
          display: "flex", alignItems: "baseline", gap: 12,
          padding: "10px 14px",
          borderBottom: "0.5px solid var(--border)",
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>{label}</span>
        </div>
      )}
      {children}
    </div>
  );
}
