import React from "react";

// Shared row card used across the navigation-style list surfaces
// (Watchlist > Lists, Cool Stuff > Watch Challenges, …). One
// definition so a future visual update applies everywhere — Mark
// 2026-05-06: "can we make them a default style that we could
// update in all the card/list locations if wanting to improve on
// them over time."
//
// The reference shape is the Lists row in WatchlistTab — disc on
// the left + two-line text + trailing chevron, no inline action
// buttons. Surfaces that previously had inline actions (challenges
// row had Share + Delete) move those affordances into the drill-in
// to keep the row visually clean.
//
// Props:
//   icon       — pre-rendered SVG element (parent picks the glyph
//                + stroke color so the disc reads as a kind-marker).
//   accent     — hex color used to derive the disc tint. Defaults
//                to the brand blue. Pass "#c9a227" for gold (draft
//                challenges).
//   title      — primary line. ReactNode (so the caller can append
//                an inline pill like "Draft").
//   subtitle   — secondary line. ReactNode. Optional.
//   onClick    — row click handler. ListRow owns the keyboard /
//                focus path; no separate onKeyDown needed.
//   ariaLabel  — optional aria-label override (defaults to the
//                title — usually fine).
//   actions    — optional array of { ariaLabel, title, icon, onClick }
//                rendered as icon-only buttons just before the
//                trailing chevron. Mark 2026-05-06: restore Share +
//                Delete on the challenges list rows. When actions
//                are present, the outer element becomes a
//                <div role="button"> so the nested action buttons
//                are valid HTML (a <button> can't contain other
//                buttons). Click handlers stop propagation so they
//                don't drill in.
export function ListRow({ icon, accent = "var(--brand)", title, subtitle, onClick, ariaLabel, actions }) {
  const tint = ACCENT_TINTS[accent] || ACCENT_TINTS["var(--brand)"];
  const rowStyle = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 16px", borderRadius: 12,
    border: "0.5px solid var(--border)",
    background: "var(--card-bg)",
    color: "var(--text1)", cursor: "pointer",
    fontFamily: "inherit", textAlign: "left",
    width: "100%", gap: 8,
  };
  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
        <div style={{
          flexShrink: 0,
          width: 36, height: 36, borderRadius: "50%",
          background: tint,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 15, fontWeight: 500, marginBottom: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{
              fontSize: 12, color: "var(--text2)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {(actions || []).map((a, i) => (
          <button key={i}
            onClick={(e) => { e.stopPropagation(); a.onClick(e); }}
            aria-label={a.ariaLabel}
            title={a.title || a.ariaLabel}
            style={iconActionBtnStyle}
          >{a.icon}</button>
        ))}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: actions && actions.length > 0 ? 4 : 0 }}><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </>
  );
  // No actions → keep the simple <button> shape (Lists rows). Has
  // actions → switch to div+role so nested buttons are legal.
  if (!actions || actions.length === 0) {
    return (
      <button onClick={onClick} aria-label={ariaLabel} style={rowStyle}>
        {inner}
      </button>
    );
  }
  return (
    <div onClick={onClick} aria-label={ariaLabel}
      role="button" tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (typeof onClick === "function") onClick(e);
        }
      }}
      style={rowStyle}>
      {inner}
    </div>
  );
}

const iconActionBtnStyle = {
  width: 28, height: 28,
  display: "flex", alignItems: "center", justifyContent: "center",
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  cursor: "pointer",
  borderRadius: 6,
  padding: 0,
  fontFamily: "inherit",
};

// Disc-tint lookup keyed by stroke accent. Two tones for now (brand
// blue + draft gold); add new entries as new surfaces adopt the row.
const ACCENT_TINTS = {
  "var(--brand)": "rgba(24,95,165,0.08)",
  "#c9a227": "rgba(201,162,39,0.10)",
};
