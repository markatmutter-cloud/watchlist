// Shared style tokens. Extracted 2026-04-30 after the design pass left
// near-identical pill / icon-button / modal styles copy-pasted across
// App.js + each modal file. Mark spotted "sub-pixel mismatch" between
// the mobile sort row pills (boxShadow border) and the sub-tab pills
// (real border) — exactly the class of bug shared tokens prevent.
//
// Token style: each export is either
//   - a plain object (use directly: style={modalBackdrop})
//   - a function returning an object (use with state: style={pillBase(active)})
//
// Keep these tokens narrow and presentation-only. No app state, no
// behavior. Components compose them with their own per-instance overrides
// using the spread operator: style={{ ...iconButton(), background: ... }}.

// ── PILLS ─────────────────────────────────────────────────────────────

// Sort/filter pills in the sticky/filter rows. Inactive = transparent
// with inset border, active = inverted dark. Used by both mobile sort
// row (default size — bigger for touch) and desktop filter row
// (`compact: true` — denser horizontal layout).
export const pillBase = (active, { compact = false } = {}) => ({
  fontSize: 13,
  padding: compact ? "6px 12px" : "9px 14px",
  borderRadius: 20, cursor: "pointer",
  fontFamily: "inherit", whiteSpace: "nowrap", border: "none", outline: "none",
  background: active ? "var(--text1)" : "transparent",
  color:      active ? "var(--bg)"    : "var(--text2)",
  boxShadow:  active ? "none" : "inset 0 0 0 0.5px var(--border)",
});

// Sub-tab strip (Listings / Searches / Calendar). Underline pattern,
// intentionally NOT pill-shaped — sub-tabs sit beneath the main tabs in
// the visual hierarchy and need to look secondary. Active = bold +
// 2px underline, inactive = lighter colour, no chrome. Vertical padding
// stays generous (10px) so tap targets remain ~40px tall on mobile.
//
// `marginBottom: -1` pulls the underline down to overlap the strip's
// 0.5px borderBottom, so the active indicator pierces the divider
// cleanly instead of floating above it.
export const tabPill = (active) => ({
  padding: "10px 4px",
  border: "none", outline: "none",
  background: "transparent",
  cursor: "pointer", fontFamily: "inherit", fontSize: 13,
  fontWeight: active ? 600 : 500,
  color: active ? "var(--text1)" : "var(--text3)",
  borderBottom: active ? "2px solid var(--text1)" : "2px solid transparent",
  borderRadius: 0,
  marginBottom: -1,
});

// ── ICON BUTTONS ──────────────────────────────────────────────────────

// Round 40×40 icon buttons in the mobile top bar (Filter, View, Clear).
// `active` flips to the inverted dark fill — used for the Filter button
// when filters are set, and the View button when its menu is open.
export const iconButton = ({ size = 40, active = false } = {}) => ({
  flexShrink: 0,
  width: size, height: size,
  borderRadius: "50%",
  border: "0.5px solid var(--border)",
  background: active ? "var(--text1)" : "var(--surface)",
  color:      active ? "var(--bg)"    : "var(--text2)",
  cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
});

// ── MODALS ────────────────────────────────────────────────────────────

// Full-viewport dimmed backdrop. All 4 modals (Hidden / About / Track /
// FavSearch) used 0.5 opacity after Mark unified them on 2026-04-30.
export const modalBackdrop = {
  position: "fixed", inset: 0, zIndex: 200,
  background: "rgba(0,0,0,0.5)",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 20,
};

// Centered modal card. Override `maxWidth` per-modal (Hidden = 720,
// About = 440, Track = 520, FavSearch = 380). `padding` differs slightly
// between modals (Track uses 20/22, others 22) — override as needed.
export const modalShell = {
  background: "var(--bg)", borderRadius: 14,
  border: "0.5px solid var(--border)",
  padding: 22, width: "100%",
  boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
};

// 36×36 close button (×) in the modal title row. Negative right margin
// pulls it back into alignment with the right edge of the modal padding,
// so the visual gap matches the title's left edge despite the button
// being sized for tap accessibility.
export const modalCloseButton = {
  background: "none", border: "none", cursor: "pointer",
  color: "var(--text2)", fontSize: 22, lineHeight: 1, padding: 0,
  width: 36, height: 36,
  display: "flex", alignItems: "center", justifyContent: "center",
  marginRight: -8,
};

// Common modal title row. Title text on the left, × button on the right.
// Marginbottom 14 is the conventional spacing before modal body content.
export const modalTitleRow = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  marginBottom: 14,
};

// Modal title text — 16/600/text1.
export const modalTitle = {
  fontSize: 16, fontWeight: 600, color: "var(--text1)",
};
