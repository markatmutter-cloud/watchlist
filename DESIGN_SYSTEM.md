# Watchlist design system

Reach-for-this-first when doing UI work. Keep this short — it's a
reference, not a tutorial. Last refreshed 2026-05-08 after the gap-fix
sweep.

The system has three layers:

1. **Color tokens** — CSS custom properties defined in `src/App.js`
2. **Style tokens** — JS objects / factories in `src/styles.js`
3. **Reusable components** — under `src/components/`

## 1. Color tokens

Defined once in `src/App.js` (the `c = dark ? {...} : {...}` block,
~line 892), spread into the root element's style. All descendants read
them via `var(--name)`.

| Token | Value (light/dark same unless noted) | Use |
|---|---|---|
| `--bg` | `#fff` / `#000` | Page background |
| `--surface` | `#f5f5f7` / `#1c1c1e` | Lifted surface — search bar, modal cards, settings rows |
| `--card-bg` | `#fff` / `#2c2c2e` | Card-specific (Card.js, modal shell) |
| `--border` | `rgba(0,0,0,0.09)` / `rgba(255,255,255,0.1)` | Divider lines (semi-transparent so they read on either bg) |
| `--text1` | `#1d1d1f` / `#f5f5f7` | Primary text |
| `--text2` | `#6e6e73` / `#98989d` | Secondary text (most body copy, button labels) |
| `--text3` | `#aeaeb2` / `#48484a` | Tertiary text (timestamps, helper labels) |
| `--brand` | `#185FA5` | Action blue: heart fill, primary CTA, link color, hearted-pill, mobile-nav active dot |
| `--danger` | `#c0392b` | Destructive: Delete button text, hard-cap banner border |
| `--accent-positive` | `#1b8f3a` | Sold-green / price-drop ↓ indicator |

**Adding a new color:** add to BOTH the dark and light blocks in
App.js. Never inline a hex literal — even one-off shades drift over
time (UserLimitBanner shipped with `#1f5a9f` instead of `#185FA5`
because there was no token to anchor to).

### Redesign tokens (additive, 2026-05-10)

The watchlist-redesign handoff brought a second token family. It
**coexists** with the legacy `--text/--border/--brand` names above —
both are defined in `src/App.js` and the migration is per-consumer,
not a flag-day. New surfaces (activity-grouped landing, reaction
system, shared-list drill-in, calendar rows) reach for these names;
existing surfaces keep working on legacy until a consumer is
deliberately migrated.

| New token | Light | Use | Closest legacy |
|---|---|---|---|
| `--ink-1` | `#0F0F0F` | Primary text, prices, ref names | `--text1` |
| `--ink-2` | `#5C5C5C` | Secondary text, labels | `--text2` |
| `--ink-3` | `#9A9A9A` | Tertiary, counts, captions | `--text3` |
| `--ink-4` | `#C8C8C8` | Faintest — chevrons, placeholders | _new_ |
| `--surface-1` | `#FAFAFA` | Subtle elevated cards, banners | `--surface` (close) |
| `--surface-2` | `#F4F4F4` | Filter pills, search input bg | `--surface` |
| `--photo-bg` | `#F2F0EC` | Photo placeholder before image loads | _new_ |
| `--rule` | `#E8E8E8` | Primary divider | `--border` |
| `--rule-soft` | `#F0F0F0` | Secondary divider, card borders | _new_ |
| `--accent` | `#185FA5` | Heart-saved, primary CTAs, links | `--brand` (same hex) |
| `--accent-soft` | `#EFF3FA` | Accent backgrounds, soft chips | `--brand-tint-08` (close) |
| `--positive` | `#2D7A3D` | Price drops, "Live" status | `--accent-positive` (close) |
| `--warning` | `#B43C28` | "Ending soon", auction urgency | _new_ |
| `--danger` | `#C0392B` | Delete, destructive actions | `--danger` (same) |

Dark mode values are a first pass — ink inverted, surfaces
near-black, accent unchanged. A dark-mode audit is a separate later
pass (the redesign brief defers it explicitly).

## 2. Style tokens — `src/styles.js`

Each export is either a plain object (use directly:
`style={modalBackdrop}`) or a factory function (use with state:
`style={pillBase(active)}`). Tokens are presentation-only — no app
state, no behavior. Compose with overrides via spread:
`style={{ ...iconButton(), background: ... }}`.

| Token | Use |
|---|---|
| `pillBase(active, { compact, surface })` | Sort / filter pills (Date ↓, Price). Mobile uses default size; desktop uses `{ compact: true, surface: true }` |
| `innerToggleButton(active)` | Nested sub-toggles inside a tab (Listings/Auctions/Sold under Saved; Owned/Sold/All/Shortlist under My watches) |
| `tabPill(active)` | Sub-tab strip, underline pattern |
| `actionButton({ variant: "primary"\|"subtle"\|"danger" })` | Header / toolbar action buttons (Share / Manage / Delete / + From feed / Cancel / Save). ~32px tall |
| `signInButton` | Large primary CTA — sign-in buttons on signed-out gates and share-receive landings. One size class above actionButton |
| `iconButton({ size, active })` | Round icon buttons (Filter, View, Clear in mobile top bar) |
| `inputBase` | Form input style (text / number / select). Spread into `style={{ ...inputBase, ... }}` so callers can override fontSize / flex / marginBottom |
| `modalBackdrop` / `modalShell` / `modalCloseButton` / `modalTitleRow` / `modalTitle` | Modal primitives. AboutModal is the only documented exception (uses absolute-positioned close button — see comment in AboutModal.js line ~122) |

## 3. Reusable React components — `src/components/`

| Component | Use |
|---|---|
| `Card.js` | Feed card. The dominant UI unit. New `reactionSlot` prop (2026-05-10) feeds a pre-rendered reaction pill below the card body on shared-list surfaces. |
| `Chip.js` | Filter chips (brands / sources / refs row) |
| `ListRow.js` | Collection list row (in Lists drill-in) |
| `HomeTab.js` | Aggregator landing accessed via the Watchlist wordmark (2026-05-10). Renders three sections — "New listings" / "Auctions closing soon" / "Recently sold" — each with a `View all →` that routes to the Listings sub-tabs. Pure presentation; App.js owns the slicing. Gated by the `?new-ui=1` feature flag. |
| `Popover.js` | Portaled popover primitive (2026-05-10). `usePopoverState()` + `<Popover state={pop}>`. Three callers: Card ⋯ menu, drill-in overflow menu, desktop reaction picker. Click-outside / Escape / position-anchored to trigger rect. |
| `SectionHeader.js` | Section divider used across the redesign (2026-05-10): glyph + Newsreader serif title + sans count + optional `View all →` right link. `muted` variant for "No reaction yet". |
| `Segmented.js` | Filled pill-track segmented control (2026-05-10). Distinct visual register from `tabPill` (underline) and `innerToggleButton` (single border). For Manage modal toggle + Listings sub-tabs. |
| `SubTabIntro.js` | Intro callout banner with optional action button (different visual primitive from `actionButton`; intentional — callout-banner action vs header toolbar action) |
| `EmptyState.js` | Standard empty-state surface (icon + heading + blurb + optional CTA). Three sizes: `compact` / `default` / `tall` |
| `Section.js` | Sub-section grouping inside a tab content area. Pass `show={false}` for single-section views to drop the divider header. Distinct from the new `SectionHeader` primitive — Section wraps content and renders a header; SectionHeader is the header alone, for surfaces that grid their own content below it. |
| `UserLimitBanner.js` | Top-of-app limit banner (global, mounted by both shells) |
| `LotMigrationBanner.js` | One-shot tracked-lot migration prompt |
| `Links.js` / `icons.js` | Internal/external link helpers, SVG icons (including the 2026-05-10 reaction glyphs: `LoveIcon`, `YesIcon`, `HmmIcon`, `NoIcon`, `ReactIcon`, and the `REACTION_GLYPH` map keyed by enum value) |

## Reach-for-this rules

- **New button somewhere?** `actionButton` for header/toolbar; `pillBase` for filter row; `signInButton` for sign-in CTAs; `innerToggleButton` for nested sub-toggles. Don't hand-roll padding / borderRadius / colors.
- **New modal?** `modalBackdrop` + `modalShell` + `modalTitleRow` + `modalTitle` + `modalCloseButton`. Inside the modal, use `inputBase` for form inputs.
- **New empty / signed-out / "nothing here yet" surface?** `<EmptyState />` from `./EmptyState`. Pick the size: `compact` for in-tab emptiness, `default` for general, `tall` for top-level signed-out gates.
- **New color?** Add a CSS var to App.js's `c` block in BOTH light and dark modes. Never inline hex.
- **Sub-section grouping inside a tab?** `<Section />` from `./Section`. Page-level tab headers (back-arrow + title + actions row) are intentionally a denser inline shape; don't try to consolidate them into Section.

## Intentional drift (don't "fix")

- **Mobile bottom-nav active-dot vs desktop active-pill** — different visual signals for the active main tab; both work in their context.
- **Mobile `× Clear` round 40×40 vs desktop "× Clear" inline** — horizontal-real-estate trade-off.
- **Card overlay `rgba(...)` literals** — sit on images, no dark-mode adapt needed.
- **`SubTabIntro` action button** is its own primitive (different size + role than `actionButton`).
- **`SizeCompare.js` has its own local `inp`** — local-scoped, intentionally denser than the shared `inputBase` for the calibration tools.
- **AboutModal close-button absolute position** — hero band has 2-line title + tagline + favicon, the standard `modalTitleRow` would crush the title against the ×. Documented in-line at the override.

## Adding to the system

Promote when a pattern repeats 3+ times across files with minor
variation. Don't promote one-off patterns. Tokens belong in
`styles.js`; components belong in `src/components/`. After adding,
update this doc and the relevant section of CLAUDE.md if the rule
changes (e.g. new "always reach for X" entry).
