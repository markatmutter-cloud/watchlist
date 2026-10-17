// Shared style tokens: the editorial type ramp and the modal / form helpers that have not
// moved onto src/ui yet. PAGE chrome (pills, search, sub-tabs, chips, headers, the filter
// bar) is src/ui, defined once in src/ui/ui.css; the old pill / header helpers that used to
// live here are deleted (chrome-guard fails the build if they return).
//
// Token style: each export is a plain object (style={modalBackdrop}) or a function returning
// one. Keep them narrow and presentation-only: no app state, no behavior.

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
