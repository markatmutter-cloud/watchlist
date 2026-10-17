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

// ── TYPEFACES ─────────────────────────────────────────────────────────
// The ONLY place a font-family string should live (2026-05-28 type-system
// pass). Two voices, one axis: sans = "scan and act" (the interface, also
// the body default in public/index.html); serif = "sit and read" (the
// editorial register — article/reference titles + prose). Serif face is
// Hoefler Text (Mark's call): Apple-native, ligatures, magazine contrast;
// Iowan Old Style / Georgia are fallbacks. Never inline a font string —
// import from here so the editorial face can't drift per surface. See
// DESIGN_SYSTEM.md "Serif vs sans". (Portal menus that must hard-set a
// face for the iOS Times-serif fallback are the one exception — see
// PORTAL_SANS in CardShell.js.)
export const FONT_SANS = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif";
export const FONT_SERIF = "'Hoefler Text', 'Iowan Old Style', Georgia, 'Times New Roman', serif";          // body + titles
export const FONT_SERIF_DISPLAY = "'Hoefler Text', 'Iowan Old Style', Georgia, 'Times New Roman', serif";  // hero/display (same face; separate name documents the role)

// ── EDITORIAL TYPE RAMP ───────────────────────────────────────────────
// The "sit and read" register, as reusable recipes (2026-05-28). Each
// returns a style object — spread it and override per-site (color, margin,
// clamp) like the other tokens: style={{ ...editorialTitle({ isMobile }),
// color: "var(--text1)" }}. These bundle the FULL editorial recipe — serif
// face + tight leading + negative tracking — so a surface opts into the
// whole language, not just the font. Reach for these on READING surfaces
// only (article/reference titles + prose, reference teasers). NEVER on
// scan-and-act chrome — nav, filters, buttons, inputs, list/section names,
// empty states. Serif reads as premium because it's restricted; leaking it
// onto the interface is the bug. See DESIGN_SYSTEM.md "Serif vs sans".
//
// Weight note: serif renders heavier than sans at the same weight — titles
// sit at 400 (past 500 feels chunky); display/headings at 600.
export const editorialDisplay = ({ isMobile } = {}) => ({
  fontFamily: FONT_SERIF_DISPLAY, fontWeight: 600,
  fontSize: isMobile ? 44 : 72, lineHeight: 0.98, letterSpacing: "-0.01em",
});
export const editorialHeading = ({ isMobile } = {}) => ({
  fontFamily: FONT_SERIF, fontWeight: 600,
  fontSize: isMobile ? 25 : 30, lineHeight: 1.08, letterSpacing: "-0.01em",
});
export const editorialTitle = ({ isMobile } = {}) => ({
  fontFamily: FONT_SERIF, fontWeight: 400,
  fontSize: isMobile ? 22 : 20, lineHeight: 1.22,
});
export const editorialProse = ({ isMobile } = {}) => ({
  fontFamily: FONT_SERIF, fontSize: isMobile ? 16 : 17, lineHeight: 1.6,
});

// Shared content-card grid (Mark 2026-06-02 — "standard library for cards").
// Articles · reference guides · list cards all render at ONE size through this
// single track: auto-fill 280px columns (denser-by-width on desktop, single
// column on mobile), modest gap. Use it instead of a per-surface grid so the
// three card families stay the same size.
export const cardGridStyle = ({ isMobile } = {}) => ({
  display: "grid",
  gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
  gap: isMobile ? 16 : 24,
});

// ── CHROME METRICS — the one spacing/size sheet (Mark 2026-06-03) ─────
// Every governed chrome number lives HERE, once. The day's lesson: shared
// COMPONENTS weren't enough — surfaces still chose their own paddings and
// tokens still defined their own font/pad, so heights and gaps drifted one
// edit at a time. Rule: chrome code never writes a raw px for these
// properties — it imports the constant. Change a number here and every
// screen moves together. (chrome-guard.test.js asserts consumption.)
export const CHROME = {
  // The one left edge (P-5/P-6): scroll-pane / body horizontal inset.
  INSET_X_DESKTOP: 20,
  INSET_X_MOBILE: 16,
  // Mobile scroll-body top inset — flat on every tab (title-height ledger).
  BODY_TOP_MOBILE: 12,
  // Bar controls: pills + search field share one height.
  CONTROL_H: 30,
  PILL_FONT: 13,
  PILL_PAD: "6px 12px",
  // PageHeader vertical padding — the ONLY contributor above a title.
  HEADER_PAD: { desktop: "14px 0 16px", mobile: "10px 0 13px" },
  // Header→bar gap (sticky-wrapper paddingTop).
  GAP_HEADER_BAR_DESKTOP: 0,
  GAP_HEADER_BAR_MOBILE: 4,
  // Bar→first-content gap.
  GAP_BAR_CONTENT_DESKTOP: 18,
  GAP_BAR_CONTENT_MOBILE: 14,
  // The magazine look's label voice (Mark, 2026-10-16) — small tracked caps,
  // the front page's and the Watches page's treatment of pills and counts.
  // Pads are set so a pill is no SHORTER than it was at 13px sentence case
  // (28px desktop / 34px touch): the smaller type must not shrink a target.
  MAG_LABEL_FONT: 11,
  MAG_LABEL_TRACKING: "0.1em",
  MAG_PILL_PAD: "8px 13px",
  MAG_PILL_PAD_TOUCH: "11px 14px",
  MAG_COUNT_MIN_W: 112,
  // The search field, sized toward the Watches page's (B-101, Mark 2026-10-16:
  // "really small compared to watches tab"). Still a filter-bar control, so it
  // stays well under the chrome search's ~46px.
  MAG_SEARCH_H: 38,
  MAG_SEARCH_FONT: 14,
  MAG_SEARCH_PAD: "4px 16px",
  MAG_SEARCH_SLOT: "minmax(240px, 520px)",
};

// ── THE MAGAZINE LOOK (2026-10-16) ───────────────────────────────────
// The look the site is moving to (src/lookFlag.js: `?look=new`, the default;
// `?look=old` is the way back). Chrome tokens here are plain functions called
// during render, with no React context to read, so the look is a module flag
// that App sets once at the top of its render, before any child renders. It
// changes TYPE only — the shapes, the olive tint on a selected pill, the
// segmented sub-tab and every size that governs a tap target stay as they
// were. Tests default to the old look; App flips it.
export const LOOK = { magazine: false };
export const setMagazineLook = (on) => { LOOK.magazine = !!on; };

// Small tracked caps for labels (pills, counts). Spread; never inline.
export const magLabel = () => ({
  fontSize: CHROME.MAG_LABEL_FONT,
  letterSpacing: CHROME.MAG_LABEL_TRACKING,
  textTransform: "uppercase",
});

// ── PILLS ─────────────────────────────────────────────────────────────

// Sort/filter pills in the sticky/filter rows. Inactive = transparent
// (or surface-tinted) with inset border, active = inverted dark. Used by
// both mobile sort row (default size — bigger for touch) and desktop
// filter row (`compact: true` — denser horizontal layout). Pass
// `surface: true` for the desktop variant where inactive pills sit on a
// `--surface` background instead of transparent.
// ── The one "selected/active" treatment ──────────────────────────────
// 2026-05-28 design-library pass (Mark): every toggle/filter chip that can
// be "on" reads the SAME way — an olive TINT fill + readable olive INK +
// a 0.5px olive hairline. Single source of truth: pillBase /
// innerToggleButton / iconButton (and Chip) all spread this, so
// "selected = olive" can't drift per surface. Replaces the old split
// (pillBase bold-black-border ghost; innerToggle/icon solid-black fill;
// stray blue tints). --brand-olive-ink is theme-aware (lightens to sage in
// dark) so the ink stays readable on #000, where --brand-olive is too dark.
export const SELECTED_FILL = {
  background: "var(--brand-olive-tint-12)",
  color: "var(--brand-olive-ink)",
  boxShadow: "inset 0 0 0 0.5px var(--brand-olive-ink)",
};

// Default (unselected) chrome: transparent (or surface-tinted) + hairline.
const UNSELECTED = (surface) => ({
  background: surface ? "var(--surface)" : "transparent",
  color: "var(--text2)",
  boxShadow: "inset 0 0 0 0.5px var(--border)",
});

export const pillBase = (active, { compact = false, surface = false } = {}) => ({
  fontSize: CHROME.PILL_FONT,
  padding: compact ? CHROME.PILL_PAD : "9px 14px",
  borderRadius: 20, cursor: "pointer",
  fontFamily: "inherit", whiteSpace: "nowrap", border: "none", outline: "none",
  fontWeight: active ? 600 : 500,
  ...(active ? SELECTED_FILL : UNSELECTED(surface)),
  // The magazine look: the Watches page's pill voice. Type + padding only.
  ...(LOOK.magazine
    ? { ...magLabel(), padding: compact ? CHROME.MAG_PILL_PAD : CHROME.MAG_PILL_PAD_TOUCH }
    : {}),
});

// Inner-toggle pill. Smaller, denser variant used for nested sub-toggles
// inside a tab (Listings/Auctions/Sold inside Saved; Owned/Sold/All/
// Shortlist inside My watches). Visually distinct from `pillBase` — uses
// a real border (not boxShadow) and adds bold-on-active to signal the
// secondary hierarchy. Promoted 2026-05-08 from inline duplicates in
// App.js + CollectionsTab.js.
export const innerToggleButton = (active) => ({
  padding: "4px 12px", borderRadius: 999,
  border: "none", outline: "none",
  cursor: "pointer", fontFamily: "inherit", fontSize: 12,
  fontWeight: active ? 600 : 500,
  flexShrink: 0,
  // 2026-05-28: active now uses the shared olive SELECTED_FILL (was a
  // solid black fill). Same "selected = olive" language as every pill.
  ...(active ? SELECTED_FILL : UNSELECTED(false)),
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
export const tabPill = (active, opts = {}) => {
  // PR_β-A 2026-05-22: `onOlive` flips active/inactive colors for the
  // colored-chrome zone (white-on-olive instead of dark-on-white).
  // Used by mobile sub-tab strips when the chrome above is olive.
  //
  // PR 2026-05-22 chrome harmonization (Mark spec): on neutral chrome
  // (Home + sub-tab strips that sit below olive), active state picks
  // up `var(--brand-olive-text)` instead of `var(--text1)`. Ties the
  // active tab visually to the wordmark color on landing without
  // introducing a separate token. On olive chrome, white stays white.
  const onOlive = opts.onOlive === true;
  return {
    padding: "10px 4px",
    border: "none", outline: "none",
    background: "transparent",
    cursor: "pointer", fontFamily: "inherit", fontSize: 13,
    fontWeight: active ? 600 : 500,
    letterSpacing: "0.01em",
    color: onOlive
      ? (active ? "#ffffff" : "rgba(255,255,255,0.65)")
      : (active ? "var(--brand-olive-text)" : "var(--text3)"),
    borderBottom: onOlive
      ? (active ? "2px solid #ffffff" : "2px solid transparent")
      : (active ? "2px solid var(--brand-olive-text)" : "2px solid transparent"),
    borderRadius: 0,
    marginBottom: -1,
  };
};

// ── SUB-TAB SEGMENTED CONTROL (audit:2026-06-06 U-01) ─────────────────
// The sub-tab row's restyle. The underline `tabPill` treatment failed the
// first-time-user test: inactive sub-tabs rendered as faint grey text —
// which novices read as DISABLED — while the filter pills below were
// filled chips that looked like the buttons. A real user, told to "click
// the subtab", tapped the pills. Twice. (docs/audits/2026-06-06-usability/)
//
// Fix: sub-tabs become a single ENCLOSED segmented control — one rounded
// track holding all the options, active segment solid-filled. The
// enclosure is the message ("one chooser, pick a view"), and the solid
// active fill is deliberately LOUDER than the filter pills' tint —
// navigation must out-shout filters. `tabPill` (underline) remains the
// TOP-tab treatment, so the two nav levels now look different by
// construction.
//
// Two color contexts, like tabPill's onOlive:
//   on olive (mobile colored chrome): translucent white track; active =
//     solid white segment with olive ink; inactive = white text at 0.9
//     (legible — NOT the 0.65 "disabled grey" the audit flagged).
//   on neutral (desktop): hairline track; active = solid olive fill +
//     white text (one notch louder than SELECTED_FILL's tint, which the
//     filter pills keep).
export const segTrack = (onOlive) => ({
  display: "inline-flex", alignItems: "center",
  padding: 3, borderRadius: 999, gap: 2,
  background: onOlive ? "rgba(255,255,255,0.14)" : "var(--surface)",
  boxShadow: onOlive ? "none" : "inset 0 0 0 0.5px var(--border)",
});

export const segItem = (active, { onOlive = false } = {}) => ({
  fontSize: CHROME.PILL_FONT,
  padding: "7px 14px", borderRadius: 999,
  border: "none", outline: "none",
  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  fontWeight: active ? 600 : 500,
  letterSpacing: "0.01em",
  transition: "background 0.15s ease, color 0.15s ease",
  ...(onOlive
    // active label uses --brand-olive (dark in BOTH themes) — NOT
    // --brand-olive-ink, which flips to light sage in dark mode and
    // would wash out on the solid-white active chip.
    ? (active
        ? { background: "#ffffff", color: "var(--brand-olive)" }
        : { background: "transparent", color: "rgba(255,255,255,0.9)" })
    : (active
        ? { background: "var(--brand-olive)", color: "#ffffff" }
        : { background: "transparent", color: "var(--text2)" })),
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
    // PR 2026-05-22: primary CTAs swept from brand-blue to brand-
    // olive to match the olive thread shipped across icons, avatar,
    // dropdown, view-settings, etc. Mark spec: "+ From feed in
    // Watchbox could be green" — applied site-wide for consistency.
    background: "var(--brand-olive)", color: "#fff",
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
    padding: "8px 14px",
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
  // 2026-05-28: olive accent (was brand-blue) — one chrome accent.
  if (tone === "solid") return {
    ...base,
    border: "1px solid var(--brand-olive)",
    background: "var(--brand-olive)",
    color: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
  };
  if (tone === "neutral") return {
    ...base,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text1)",
  };
  // brand (default) — olive outline
  return {
    ...base,
    border: "1px solid var(--brand-olive-ink)",
    background: "transparent",
    color: "var(--brand-olive-ink)",
  };
};

// Sign-in / large primary CTA. One size class above actionButton —
// padding and radius scale up because these are typically the dominant
// CTA on a focused signed-out surface (CollectionsTab gate, WatchlistTab
// gate, ListReceiver / ChallengeReceiver landings). Brand-fill + white
// text. Promoted 2026-05-08 from inline copies (10px 18px / radius 10
// pattern repeated across ~5 files).
export const signInButton = {
  padding: "10px 20px", borderRadius: 10,
  // 2026-05-28: olive (was brand-blue) — one chrome accent across the app.
  border: "none", background: "var(--brand-olive)", color: "#fff",
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
  border: "none", outline: "none",
  cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  // 2026-05-28: active now uses the shared olive SELECTED_FILL (was a
  // solid black fill); inactive keeps the surface chip look.
  ...(active ? SELECTED_FILL : { background: "var(--surface)", color: "var(--text2)", boxShadow: "inset 0 0 0 0.5px var(--border)" }),
});

// ── CHIPS / CLEAR ─────────────────────────────────────────────────────
// 2026-05-28 design-library pass. Two shared shapes that previously lived
// as divergent inline copies (blue inset / grey border / blue tint).

// Unified "Clear all" / reset control — olive-ink OUTLINE pill (no fill;
// it's a reset action, not a selected state). Replaces the inline clear-
// alls in the shells + EditorialView + ActiveFiltersStrip.
// 2026-06-03: metrics aligned to the pill standard (CHROME.PILL_FONT /
// PILL_PAD) — its old 12px/5px ran a different height than every
// neighboring pill in the bar, which read as clipped (Mark's report).
export const clearAllPill = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: CHROME.PILL_PAD, borderRadius: 999,
  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  fontSize: CHROME.PILL_FONT, fontWeight: 600, letterSpacing: "0.02em",
  border: "none", outline: "none",
  background: "transparent", color: "var(--brand-olive-ink)",
  boxShadow: "inset 0 0 0 0.5px var(--brand-olive-ink)",
};

// Removable active-filter chip ("× Brand"). Olive TINT fill (the same
// SELECTED_FILL identity) + a trailing × that removes the filter. The chip
// surface is non-interactive; only the × is a button (use dismissChipX).
export const dismissChip = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "4px 8px 4px 10px", borderRadius: 999,
  ...SELECTED_FILL,
  fontSize: 12, fontWeight: 500, letterSpacing: "0.01em",
  whiteSpace: "nowrap", cursor: "default",
};
export const dismissChipX = {
  background: "transparent", border: "none", padding: 0, marginLeft: 2,
  color: "var(--brand-olive-ink)", cursor: "pointer", fontSize: 14, lineHeight: 1,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 16, height: 16, borderRadius: "50%",
};

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
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  // Safe-area aware: on notched iPhones the 20px gutter alone can sit a
  // modal's top edge under the status bar / Dynamic Island (B-/P-9).
  padding: "max(20px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom))",
};

// Centered modal card. Override `maxWidth` per-modal (Hidden = 720,
// About = 440, Track = 520, FavSearch = 380). `padding` differs slightly
// between modals (Track uses 20/22, others 22) — override as needed.
// PR 2026-05-22 refresh (Mark feedback "modal could be better"):
// pronounced radius + stronger drop shadow + slightly thicker border
// for definition. The backdrop now blurs the page beneath, giving the
// modal a clearer "this is the focus" elevation cue.
// maxHeight 100% (= the backdrop's padded content box) + overflow auto
// guard EVERY modal against running past the viewport — a tall modal
// (Settings on mobile, P-9) used to overflow both ends, leaving the
// title row + close button unreachable. A modal wanting its own sticky
// header (SettingsModal) overrides padding/overflow and scrolls a body
// div instead.
export const modalShell = {
  background: "var(--bg)", borderRadius: 16,
  border: "0.5px solid var(--border)",
  padding: 24, width: "100%",
  maxHeight: "100%", overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  boxShadow: "0 24px 64px rgba(0,0,0,0.32), 0 4px 12px rgba(0,0,0,0.08)",
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
