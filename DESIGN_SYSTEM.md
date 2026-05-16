# Watchlist design system

Reach-for-this-first when doing UI work. Keep this short — it's a
reference, not a tutorial. Last refreshed 2026-05-15 after the
auction-screener + Watchbox-extraction sweep.

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
| `--brand` | `#185FA5` | Action blue: primary CTA, link color, hearted-pill, mobile-nav active dot |
| `--danger` | `#c0392b` | Destructive: Delete button text, hard-cap banner border |
| `--accent-positive` | `#1b8f3a` | Sold-green / price-drop ↓ indicator |
| `--accent-warn` | `#c9a227` | Gold for status hints (over-budget, "earning its keep" admin chip) |
| `--brand-tint-08/10/12` | `rgba(24,95,165,0.08/.10/.12)` | Brand-tinted surfaces — icon-disc fills, hover, chip backgrounds |
| `--accent-warn-tint-10` | `rgba(201,162,39,0.10)` | Gold-tinted surface (ListRow draft tint) |
| `--danger-tint-10` | `rgba(192,57,43,0.10)` | UserLimitBanner hard-cap background |
| `--danger-text` | `#7d1f17` | UserLimitBanner hard-cap text (darker than `--danger` for contrast on the tinted bg) |
| `--heart` | `#d92626` | Screener heart glyph + Hearted tally + ❤️ reaction emoji. **Intentionally NOT `--brand`** — heart reads as "action," not primary brand UI |
| `--shadow-modal` | `0 2px 6px rgba(0,0,0,0.10), 0 16px 40px rgba(0,0,0,0.12)` | Modal / floating-surface shadow (ShareReceiver, ChallengeReceiver, ChallengeFlow) |
| `--text-on-dark-1/2/3` | `rgba(255,255,255,0.78/.62/.40)` | Text hierarchy on inverted dark surfaces (HomeTab hero band). Mirrors `--text1/2/3` on light |
| `--surface-on-dark` | `rgba(255,255,255,0.10)` | Subtle surface on inverted dark bg |

**Adding a new color:** add to BOTH the dark and light blocks in
App.js. Never inline a hex literal — even one-off shades drift over
time (UserLimitBanner shipped with `#1f5a9f` instead of `#185FA5`
because there was no token to anchor to).

**fontSize scale (post-2026-05-15 snap, PR #305):** prefer **10,
11, 12, 13, 14, 16, 18, 22** for body / labels / buttons; **28, 32**
for hero + heading singletons. Outliers were snapped to nearest
scale value (9 → 10, 15 → 14, 17 → 18, 20 → 18, 24 → 22, 26 → 22).
If you find yourself needing 15px for a tighter fit, ask whether 14
or 16 actually works first.

**borderRadius scale (post-2026-05-15 snap, PR #305):** **0, 4, 6,
8, 10, 12, 20, 999**. Outliers snapped (1/2 → 0, 3 → 4, 14 → 12,
18 → 20). 8 is the dominant card / button radius; 10 is the
secondary; 12 for larger surface cards; 999 for fully-rounded pills.

**padding scale (post-2026-05-15 snap):** **0, 4, 6, 8, 10, 12,
14, 16, 20, 24, 32**. Plus three semantic constants kept off the
scale because they encode physical-layout intent: **48** (large
section breathing on desktop), **60** (bottom-clear for the mobile
tab bar), **110** (bottom-clear when the screening overlay is
active). Outliers snapped (5 → 4, 7 → 8, 9 → 10, 11 → 12, 13 → 12,
18 → 20, 22 → 20, 28 → 32). Close-pair clusters at the same
vertical (e.g. `8px 12px` vs `8px 14px` vs `8px 16px`) were left
in place — those are deliberate density variants, not drift; the
snap pass only consolidated odd values + the > 16 outliers. New
padding should pick a stop on the scale; reach for 14 / 20 / 24
before introducing a new outlier.

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
| `Card.js` | Feed card. The dominant UI unit |
| `Chip.js` | Filter chips (brands / sources / refs row) |
| `ListRow.js` | Collection list row (in Lists drill-in) |
| `SubTabIntro.js` | Intro callout banner with optional action button (different visual primitive from `actionButton`; intentional — callout-banner action vs header toolbar action) |
| `EmptyState.js` | Standard empty-state surface (icon + heading + blurb + optional CTA). Three sizes: `compact` / `default` / `tall` |
| `Section.js` | Sub-section grouping inside a tab content area. Pass `show={false}` for single-section views to drop the divider header |
| `UserLimitBanner.js` | Top-of-app limit banner (global, mounted by both shells) |
| `LotMigrationBanner.js` | One-shot tracked-lot migration prompt |
| `Links.js` / `icons.js` | Internal/external link helpers, SVG icons |
| `ConfirmModal.js` | Styled confirm dialog. Imperative API — `await confirm({ title, message, confirmLabel, cancelLabel, tone: "danger" \| "default" })` returns `Promise<boolean>`. One `<ConfirmHost/>` mounts at App level. Replaces every `window.confirm` site since PR #317 |

## Reach-for-this rules

- **New button somewhere?** `actionButton` for header/toolbar; `pillBase` for filter row; `signInButton` for sign-in CTAs; `innerToggleButton` for nested sub-toggles. Don't hand-roll padding / borderRadius / colors.
- **New modal?** `modalBackdrop` + `modalShell` + `modalTitleRow` + `modalTitle` + `modalCloseButton`. Inside the modal, use `inputBase` for form inputs.
- **New empty / signed-out / "nothing here yet" surface?** `<EmptyState />` from `./EmptyState`. Pick the size: `compact` for in-tab emptiness, `default` for general, `tall` for top-level signed-out gates.
- **New color?** Add a CSS var to App.js's `c` block in BOTH light and dark modes. Never inline hex.
- **Sub-section grouping inside a tab?** `<Section />` from `./Section`. Page-level tab headers (back-arrow + title + actions row) are intentionally a denser inline shape; don't try to consolidate them into Section.
- **Need a confirm dialog?** `import { confirm } from "./ConfirmModal"`, then `await confirm({ title, message, confirmLabel, tone: "danger" })`. Never `window.confirm` — it breaks dark mode and reads as jarring against the rest of the UI.

## Intentional drift (don't "fix")

- **Mobile bottom-nav active-dot vs desktop active-pill** — different visual signals for the active main tab; both work in their context.
- **Mobile `× Clear` round 40×40 vs desktop "× Clear" inline** — horizontal-real-estate trade-off.
- **Card overlay `rgba(...)` literals** — sit on images, no dark-mode adapt needed.
- **`SubTabIntro` action button** is its own primitive (different size + role than `actionButton`). SubTabIntro itself was retired from every Watchlists sub-tab during the 2026-05-14 IA sweep — the component still exists but is no longer mounted. Group eyebrow banners + EmptyState `action` carry the affordances now.
- **`SizeCompare.js` has its own local `inp`** — local-scoped, intentionally denser than the shared `inputBase` for the calibration tools.
- **AboutModal close-button absolute position** — hero band has 2-line title + tagline + favicon, the standard `modalTitleRow` would crush the title against the ×. Documented in-line at the override.
- **Desktop avatar pill vs mobile avatar circle** — desktop shows initial + "Watchbox" label inside a hairline pill; mobile shows the bare 40px circle. Top-bar real estate constraint, intentional.
- **Group eyebrow banner = Listings date-divider banner shape.** SAVED / MY LISTS / SHARED WITH ME / AUCTION CATALOGS / SAVED SEARCHES / "Sent to you" / "Yours" all use the same `--surface` band + baseline-aligned 14px label + count-pushed-right pattern as the Today / Yesterday date dividers on the Listings tab. Reuse the shape; don't introduce a new eyebrow primitive.

## Adding to the system

Promote when a pattern repeats 3+ times across files with minor
variation. Don't promote one-off patterns. Tokens belong in
`styles.js`; components belong in `src/components/`. After adding,
update this doc and the relevant section of CLAUDE.md if the rule
changes (e.g. new "always reach for X" entry).

## Open promotion candidates (audit 2026-05-15)

Flagged during the maintenance session's visual-coherence audit;
landing as separate PRs when worth touching.

- **Eyebrow heading.** The `fontSize: 10/11, fontWeight: 600,
  letterSpacing: "0.04em-0.12em", textTransform: "uppercase"`
  pattern is re-rolled at ~10 sites (group banners, sub-section
  labels, section eyebrows). Past the 3+ threshold. Promote to a
  `<Eyebrow>` component or `eyebrowText` style export.
- **Button consolidation.** Roughly 184 hand-rolled `<button>`
  elements skip `actionButton` / `pillBase` / `iconButton`. The
  grep over-counts (some legitimately need custom styles — card
  overlays, the SectionStrip pills), but the magnitude is real.
  CollectionEditModal got snapped in PR #318 from the desktop
  audit. Wider sweep still pending. Audit modals / tab-headers
  / drill-in headers and route through the existing primitives.
- **Padding scale** — Snapped in PR #321 (23 → 11 distinct pairs).
  Remaining outliers if any can be caught next audit pass.
- **`DrillInHeader` component.** My Watches / Wishlist / Lists /
  Saved-search / Auction list drill-ins all have slightly
  different header shapes (back link · title · optional metadata
  · right actions). Flagged in the 2026-05-15 desktop audit.
- **Brand-voice sweep.** `BRAND.md` (committed in PR #316) is the
  single-page voice reference but no surface has been swept
  through it. Empty states (only Plan view / Archive / Wishlist
  got swept in #306), tooltips, ConfirmModal copy, toasts,
  onboarding card, error messages all still default-y. One
  focused PR could re-tone every textual surface.

## Missing surfaces

Empty states absent on these surfaces — needs a component shape
change, not just copy (separate work):

- **Listings filter-no-match** — chips zero out the feed, blank
  area renders.
- **AuctionCalendar empty** — no upcoming + no past sales.
- **HomeTab zero recently-added** — strips render nothing.
- **Loading states** — only the initial fetch shows "Pulling the
  latest listings…". Saved-search results, list drill-ins,
  screener mount, etc. flicker through empty UI for a beat
  instead of "loading."
