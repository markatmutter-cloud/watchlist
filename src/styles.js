// Shared type tokens: the font stacks and the editorial type ramp. Everything else that used
// to live here (pills, headers, chips, buttons, inputs, the modal shell) is src/ui, defined
// once in src/ui/ui.css; chrome-guard fails the build if the old helpers return.
//
// Token style: each export is a plain object or a function returning one. Keep them narrow
// and presentation-only: no app state, no behavior.

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
