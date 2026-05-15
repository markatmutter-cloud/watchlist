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
// (or surface-tinted) with inset border, active = inverted dark. Used by
// both mobile sort row (default size — bigger for touch) and desktop
// filter row (`compact: true` — denser horizontal layout). Pass
// `surface: true` for the desktop variant where inactive pills sit on a
// `--surface` background instead of transparent.
export const pillBase = (active, { compact = false, surface = false } = {}) => ({
  fontSize: 13,
  padding: compact ? "6px 12px" : "9px 14px",
  borderRadius: 20, cursor: "pointer",
  fontFamily: "inherit", whiteSpace: "nowrap", border: "none", outline: "none",
  background: active ? "var(--text1)" : (surface ? "var(--surface)" : "transparent"),
  color:      active ? "var(--bg)"    : "var(--text2)",
  boxShadow:  active ? "none" : "inset 0 0 0 0.5px var(--border)",
});

// Inner-toggle pill. Smaller, denser variant used for nested sub-toggles
// inside a tab (Listings/Auctions/Sold inside Saved; Owned/Sold/All/
// Shortlist inside My watches). Visually distinct from `pillBase` — uses
// a real border (not boxShadow) and adds bold-on-active to signal the
// secondary hierarchy. Promoted 2026-05-08 from inline duplicates in
// App.js + CollectionsTab.js.
export const innerToggleButton = (active) => ({
  padding: "5px 12px", borderRadius: 999,
  border: "0.5px solid var(--border)",
  background: active ? "var(--text1)" : "transparent",
  color:      active ? "var(--bg)"    : "var(--text2)",
  cursor: "pointer", fontFamily: "inherit", fontSize: 12,
  fontWeight: active ? 600 : 500,
  flexShrink: 0,
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

// Compact action buttons used in tab headers, list-drill-in toolbars,
// and inline editors (Share / Manage / Rename / Delete / + From feed /
// + Add a watch / inline-editor Cancel-Save). Three variants:
//   - primary: brand-fill, white text, semi-bold (the dominant CTA)
//   - subtle:  bordered-transparent with text2 (default)
//   - danger:  bordered-transparent with --danger color
// Geometry sized so the button lands at ~32px tall — close to the iOS
// PWA tap-target bar without disrupting visual rhythm in dense headers.
// Promoted 2026-05-08 from inline duplicates spread across CollectionsTab
// + WatchlistTab.
export const actionButton = ({ variant = "subtle" } = {}) => {
  const base = {
    padding: "8px 12px", borderRadius: 6,
    fontFamily: "inherit", fontSize: 12,
    cursor: "pointer", whiteSpace: "nowrap",
  };
  if (variant === "primary") return {
    ...base,
    border: "none",
    background: "var(--brand)", color: "#fff",
    fontWeight: 500,
  };
  if (variant === "danger") return {
    ...base,
    border: "0.5px solid var(--border)",
    background: "transparent", color: "var(--danger)",
  };
  return {
    ...base,
    border: "0.5px solid var(--border)",
    background: "transparent", color: "var(--text2)",
  };
};

// "Produced" pill buttons — Mark spec 2026-05-14. The editorial-CTA
// shape used on the screening surface (View listing) and the bucket
// density toggle (Expand → / Compact ↑). Outlined rounded corners,
// uppercase tracked, 11–12px, weight 600. Tone:
//   brand:   brand-blue border + label (default)
//   neutral: hairline border + text1 label
//   solid:   brand fill + white label (dominant CTA)
// Use these when you want a button that reads as a polished CTA
// rather than a generic chrome action — primary screening verbs,
// bucket density switches, "View listing" type prompts.
export const producedPill = ({ tone = "brand" } = {}) => {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "7px 14px",
    borderRadius: 6,
    fontFamily: "inherit",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
  if (tone === "solid") return {
    ...base,
    border: "1px solid var(--brand)",
    background: "var(--brand)",
    color: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
  };
  if (tone === "neutral") return {
    ...base,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text1)",
  };
  // brand (default)
  return {
    ...base,
    border: "1px solid var(--brand)",
    background: "transparent",
    color: "var(--brand)",
  };
};

// Sign-in / large primary CTA. One size class above actionButton —
// padding and radius scale up because these are typically the dominant
// CTA on a focused signed-out surface (CollectionsTab gate, WatchlistTab
// gate, ListReceiver / ChallengeReceiver landings). Brand-fill + white
// text. Promoted 2026-05-08 from inline copies (10px 18px / radius 10
// pattern repeated across ~5 files).
export const signInButton = {
  padding: "10px 18px", borderRadius: 10,
  border: "none", background: "var(--brand)", color: "#fff",
  cursor: "pointer", fontFamily: "inherit",
  fontSize: 14, fontWeight: 500,
};

// ── FORM INPUTS ───────────────────────────────────────────────────────

// Standard text/number/select input style. Lifted-surface bg, no border,
// soft rounding. Override fontSize / marginBottom / flex per call site.
// Used across modal forms (search editor, manual entry, mark-as-sold,
// track-new-item) and inline price filters. Promoted 2026-05-08 from
// the App.js `inp` const that was prop-drilled through every tab + modal.
export const inputBase = {
  border: "none", borderRadius: 8,
  padding: "8px 10px", fontSize: 14,
  background: "var(--surface)", color: "var(--text1)",
  fontFamily: "inherit", outline: "none",
  width: "100%", boxSizing: "border-box",
};

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
// z-index bumped from 200 → 2500 on 2026-05-13 so modals invoked from
// inside the screening overlay (zIndex 2000) — WatchDetailSheet from
// tap-to-expand, CollectionPicker from the ⋯ menu — render on top of
// the screening surface instead of behind it. UserLimitBanner (9000)
// still floats above all modals.
export const modalBackdrop = {
  position: "fixed", inset: 0, zIndex: 2500,
  background: "rgba(0,0,0,0.5)",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 20,
};

// Centered modal card. Override `maxWidth` per-modal (Hidden = 720,
// About = 440, Track = 520, FavSearch = 380). `padding` differs slightly
// between modals (Track uses 20/22, others 22) — override as needed.
export const modalShell = {
  background: "var(--bg)", borderRadius: 12,
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
