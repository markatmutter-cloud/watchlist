# Watchlist design system

Reach-for-this-first when doing UI work. Keep this short — it's a
reference, not a tutorial. Last refreshed 2026-05-15 after the
auction-screener + Watchbox-extraction sweep.

The system has three layers:

1. **Color tokens** — CSS custom properties defined in `src/App.js`
2. **Style tokens** — JS objects / factories in `src/styles.js`
3. **Reusable components** — under `src/components/`

## 1. Color tokens

Defined once in `src/App.js` (the `c = dark ? {...} : {...}` block),
spread into the root element's style. All descendants read them via
`var(--name)`.

| Token | Value (light/dark same unless noted) | Use |
|---|---|---|
| `--bg` | `#fff` / `#000` | Page background |
| `--surface` | `#f5f5f7` / `#1c1c1e` | Lifted surface — search bar, modal cards, settings rows |
| `--card-bg` | `#fff` / `#2c2c2e` | Card-specific (Card.js, modal shell) |
| `--border` | `rgba(0,0,0,0.09)` / `rgba(255,255,255,0.1)` | Divider lines (semi-transparent so they read on either bg) |
| `--text1` | `#1d1d1f` / `#f5f5f7` | Primary text |
| `--text2` | `#6e6e73` / `#98989d` | Secondary text (most body copy, button labels) |
| `--text3` | `#aeaeb2` / `#48484a` | Tertiary text (timestamps, helper labels) |
| `--brand` | `#185FA5` | Action blue — now **link color + text accents only**. Chrome (primary CTAs, filter pills, clear/dismiss, hearted-pill) moved to **olive** in the 2026-05-28 design-library pass; `signInButton` / `producedPill` / `actionButton(primary)` are olive |
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
| `--brand-olive` | `#3b4a36` / `#2a3527` (dark) | Brand chrome zone on non-Home tabs (the favicon hourglass colour) |
| `--brand-olive-text` | `#3b4a36` (both modes) | Olive text on page bg (Home wordmark). Same in dark by design — lower contrast is intentional. **Don't use `--brand-olive` for text in dark mode** (`#2a3527` is unreadable on `#000`) |
| `--brand-olive-ink` | `#3b4a36` / `#a8b3a0` (dark) | **Readable** olive ink for small chrome — filter-pill text/borders, clear/dismiss controls. Theme-aware (lightens to sage in dark), unlike `--brand-olive-text`. Pairs with `--brand-olive-tint-12` as the `SELECTED_FILL` fill |
| `--brand-olive-tint-12` | `rgba(59,74,54,0.12)` / `rgba(168,179,160,0.18)` (dark) | Olive-tinted surfaces — icon-disc fills + active-pill fill (`SELECTED_FILL`) |

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

## Typography — the serif/sans system

**One axis, two voices (Mark, 2026-05-27; systematized 2026-05-28).**
**Serif = "sit and read." Sans = "scan and act."** The typeface *is* the
signal for which mode the user is in. Serif appears ONLY on surfaces meant
to be *read* — article + reference titles and prose, reference teasers.
Sans carries everything functional — nav, tabs, section/list names, counts,
filters, inputs, buttons. Serif reads as premium **because it's
restricted**; the moment it leaks onto chrome it stops meaning anything.

**The landing page is the one exception (2026-09-07).** `MagazineChrome`
loads three Google faces — Bodoni Moda (display), Archivo (body), IBM Plex
Mono (data) — on mount and only on mount, so the rest of the app's font
payload is unchanged. Mark approved it for the magazine treatment
specifically; it is not a licence to import faces elsewhere. Everything else
in that page's stylesheet is namespaced `mag-` and takes colour from the
app's own `:root` tokens, so dark mode needs no second palette.

**The exception is the landing page, not the chrome (2026-09-08).** When a
second surface put the same chrome on the Watches tab, Mark's call on seeing it
live was the app's own type, not the magazine's: `MagazineWatches` overrides the
three faces back to `FONT_SANS` (scoped `.mag.magw`, two classes so it wins
whatever order the stylesheets inject) and keeps only the colour and layout. Its
wordmark takes the app's uppercase, letterspaced treatment in olive. So a
surface wearing `MagazineChrome` inherits its *colour*, and has to opt in to the
faces — the serif/sans axis above still governs everywhere but Home.

**The faces (tokens in `styles.js` — never inline a font string).**
`FONT_SANS` is the interface (also the `public/index.html` body default,
which 75% of UI inherits via `fontFamily: "inherit"`). `FONT_SERIF` /
`FONT_SERIF_DISPLAY` are the editorial face = **Hoefler Text** (Mark's
call: Apple-native, ligatures, magazine contrast; Iowan Old Style / Georgia
are fallbacks). One exception: `PORTAL_SANS` in `CardShell.js` must
hard-set a face because the card ⋯ menu portals to `document.body` (else iOS
falls back to Times serif).

**The editorial type ramp (`styles.js` factories — spread + override).**
Use on reading surfaces only. Each bundles the full recipe (face + leading +
tracking) so a surface opts into the whole register, not just the font:
- `editorialDisplay({ isMobile })` — 44/72px, w600, lh 0.98. Hero headlines.
- `editorialHeading({ isMobile })` — 25/30px, w600, lh 1.08. Section titles.
- `editorialTitle({ isMobile })` — 22/20px, w400, lh 1.22. Card/teaser titles
  (serif renders heavy — titles sit at 400; display/headings at 600).
- `editorialProse({ isMobile })` — 16/17px, lh 1.6. Body reading copy.

**The editorial *feel* is more than serif.** What makes articles/references
read as produced (audit 2026-05-28): serif **+** generous spacing (36/64px,
not 12px dense) **+** tight title leading (1.08–1.22) / comfortable prose
(1.6) **+** hairline 0.5px dividers **+** negative tracking on display
(−0.01em) **+** measured max-width (1080px) **+** uppercase tracked eyebrows.
To extend the editorial feel to a NON-reading surface, reach for the
*layout* ingredients (spacing/eyebrow/measure) — **not** the serif.

**Where serif must NOT go (settled).** The Watchlists *landing* (management
surface — reverted to bold sans); the search-results header (an editable
input + Exit = scan-and-act); empty states ("nothing here yet" is
functional); filter/nav/button chrome; list and section *names*. Adding a
new reading surface? Reach for the ramp. Anything else stays sans.

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

**Selected = olive (one state language, 2026-05-28).** Every toggle/filter
chip that can be "on" reads the same way via the shared `SELECTED_FILL`
constant: **olive tint fill (`--brand-olive-tint-12`) + olive ink
(`--brand-olive-ink`) + 0.5px olive hairline**. `pillBase`,
`innerToggleButton`, and `iconButton` all spread it on active, so the
selected look can't drift per surface. (Replaced the old split: pillBase
bold-black-border ghost, innerToggle/icon solid-black fill, stray blue
tints.) Blue `--brand` is retired from filter/toggle chrome — olive is the
single chrome accent (links/text-accents may still use `--brand`).

| Token | Use |
|---|---|
| `SELECTED_FILL` | The shared "selected/active" treatment (olive tint + ink + hairline). Spread into any toggle's active branch; don't hand-roll a selected look |
| `pillBase(active, { compact, surface })` | Sort / filter pills (Date ↓, Price). Active = `SELECTED_FILL`. Mobile uses default size; desktop uses `{ compact: true, surface: true }` |
| `innerToggleButton(active)` | Nested sub-toggles inside a tab (Listings/Auctions/Sold under Saved; Owned/Sold/All under My watches; Saved type filter). Active = `SELECTED_FILL` |
| `clearAllPill` | Unified "× Clear all" / reset control — olive-ink **outline** pill (a reset action, not a selected state). Use everywhere filters are cleared |
| `dismissChip` / `dismissChipX` | Removable active-filter chip ("× Brand") — olive tint fill + a trailing `dismissChipX` button that removes the filter |
| `tabPill(active)` | Underline tab button (olive) — **TOP tabs only** since the 2026-06-06 sub-tab restyle. Sub-tab rows use the segmented control below |
| `segTrack(onOlive)` / `segItem(active, { onOlive })` | **Sub-tab segmented control** (audit:2026-06-06 U-01) — one enclosed rounded track, active segment solid-filled (white-on-olive / olive-on-neutral). Deliberately louder than the filter pills' tint: navigation out-shouts filters, and inactive segments stay legible (never "disabled grey"). Reach for `SubTabBar` for a whole row — don't spread these raw |
| `actionButton({ variant: "primary"\|"subtle"\|"danger" })` | Header / toolbar action buttons (Share / Manage / Delete / + From feed / Cancel / Save). ~32px tall. Primary = olive fill |
| `signInButton` | Large primary CTA — sign-in buttons on signed-out gates and share-receive landings. One size class above actionButton |
| `iconButton({ size, active })` | Round icon buttons (Filter, View, Clear in mobile top bar). Active = `SELECTED_FILL` |
| `inputBase` | Form input style (text / number / select). Spread into `style={{ ...inputBase, ... }}` so callers can override fontSize / flex / marginBottom |
| `cardGridStyle({ isMobile })` | **Shared content-card grid (2026-06-02)** — `auto-fill minmax(280px,1fr)` desktop / 1-col mobile, gap 24/16. Article cards · reference-guide cards · list cards ALL use it so the three families are one size. Don't hand-roll a content-card grid. |
| `editorialTitle({ isMobile })` | Serif card/section title (magazine voice). Used by article + reference-guide cards |
| `modalBackdrop` / `modalShell` / `modalCloseButton` / `modalTitleRow` / `modalTitle` | Modal primitives. AboutModal is the only documented exception (uses absolute-positioned close button — see comment in AboutModal.js line ~122) |

## 3. Reusable React components — `src/components/`

| Component | Use |
|---|---|
| `CardShell.js` | **Shared card frame** — square/editorial image + placeholder, L1/L2/L3 text slots, action stack (heart / ⋯ / quickAction), the single portal menu. Every card renders through it. |
| `CardStrip.js` | **Shared horizontal card row** — scroll container + per-tile wrapper (38%/170 mobile · 210 desktop). Caller passes a `renderCard` fn. Scroll affordance = right-edge fade (hides at the end) + the peeking next tile; **no custom scrollbar/thumb** (the JS thumb was removed 2026-05-28 — it drove setState every scroll frame + eased, so it trailed the scroll). Snap is `proximity`. Used by Home, Search-all, ReferencePage, Collections strips. |
| `SubTabBar.js` | **Shared sub-tab row** — the one segmented-control strip (`segTrack`/`segItem`, scrollable; restyled from underline audit:2026-06-06). Used by the Watches + Saved sub-tabs. Works for real tab-switchers and jump-to-section nav alike (only `onSelect` differs); surface chrome (olive-on-mobile bg, sticky, edge bleed) passed via `containerStyle`. |
| `Card.js` | Feed card (priced listings / auctions / sold). Renders **into** `CardShell`; keeps all the price/FX/auction/sold logic |
| `Chip.js` | Filter chips (brands / sources / refs row) |
| `ListRow.js` | Collection list row (in Lists drill-in) |
| `SubTabIntro.js` | Intro callout banner with optional action button (different visual primitive from `actionButton`; intentional — callout-banner action vs header toolbar action) |
| `EmptyState.js` | Standard empty-state surface (icon + heading + blurb + optional CTA). Three sizes: `compact` / `default` / `tall` |
| `Section.js` | Sub-section grouping inside a tab content area. Pass `show={false}` for single-section views to drop the divider header |
| `UserLimitBanner.js` | Top-of-app limit banner (global, mounted by both shells) |
| `LotMigrationBanner.js` | One-shot tracked-lot migration prompt |
| `Links.js` / `icons.js` | Internal/external link helpers, SVG icons |
| `ConfirmModal.js` | Styled confirm dialog. Imperative API — `await confirm({ title, message, confirmLabel, cancelLabel, tone: "danger" \| "default" })` returns `Promise<boolean>`. One `<ConfirmHost/>` mounts at App level. Replaces every `window.confirm` site since PR #317 |

## Page chrome — the standard library (2026-06-03)

The one set of components + numbers for every named surface's chrome. The
chrome-guard jest suite fails the build on drift.

- **`CHROME` (styles.js)** — the metrics sheet: left inset (20/16), mobile body
  top (12, flat on every tab), control height (30), pill font/pad (13 / 6×12),
  PageHeader padding, header→bar gap (0/4), bar→content gap (18/14). Chrome
  code imports the constant; a raw px for these properties is a smell.
- **`PageHeader`** — every page title. One-inset rule: no horizontal
  self-padding (the container provides the inset, so title + hairline + pills
  share one left edge). One-row header: actions · `trailing` (composed
  controls, e.g. ⋯ menu) · `count` sit inline-right of the title; `meta`
  ("Shared by X") is the only line-adder.
- **`StandardFilterBar`** — the one bar: pills left · search in a CENTERED
  fixed slot (grid `1fr minmax(200,340) 1fr`) · right zone · count in a
  reserved right slot (minWidth 86 — late counts can't jog). Below 1250px
  viewport it self-stacks: search on its own full-width line, pills + right
  zone wrapping beneath (the single-line grid overlaps below that). Mobile =
  pill row only; search lives in the shell row (one input per surface).
- **`StandardSearchInput`** — the one search field: SearchIcon · radius 20 ·
  height `CHROME.CONTROL_H` · `--surface` fill (a transparent box vanished
  next to the filled pills) · built-in clear ×; `trailing` slot for extras
  (Save-search heart).
- **`topTabs.js`** — the only home of top-tab labels (Watches · Saved ·
  Articles · Reference Guides / "Guides" mobile); both shells + the Home
  masthead consume the same built model.
- **Counts**: bar surfaces → the bar's right slot; bar-less headers →
  PageHeader `count`; never under a title.
- **Failed images** — terminal state is ALWAYS the favicon placeholder
  (`/favicon-192.png`, CardShell.CardImage pattern); wsrv-served images retry
  the raw origin once first (RefImg / ShareReceiver ladder). ShareReceiver's
  "Open on {source} to see it" is the one richer exception.
- **Labels**: never "Hearted" — "♡ Saved". Tabs title-case; page titles
  sentence-case.

## Reach-for-this rules

- **New button somewhere?** `actionButton` for header/toolbar; `pillBase` for filter row; `signInButton` for sign-in CTAs; `innerToggleButton` for nested sub-toggles. Don't hand-roll padding / borderRadius / colors.
- **Selected / "on" state?** Spread `SELECTED_FILL` (olive tint + ink + hairline) — never invent a per-surface selected look. It's already baked into `pillBase` / `innerToggleButton` / `iconButton` active.
- **Clearing filters?** ONE pattern (2026-05-28): a single `clearAllPill` (lives in the active-filters chips strip, right-aligned — NOT on the filter bar) clears everything; the per-value `dismissChipX` on each chip removes one value. **Don't add per-dimension "Clear" buttons** (the Source/Brand/Model pickers had them; removed as duplication).
- **New modal?** `modalBackdrop` + `modalShell` + `modalTitleRow` + `modalTitle` + `modalCloseButton`. Inside the modal, use `inputBase` for form inputs.
- **New empty / signed-out / "nothing here yet" surface?** `<EmptyState />` from `./EmptyState`. Pick the size: `compact` for in-tab emptiness, `default` for general, `tall` for top-level signed-out gates.
- **New color?** Add a CSS var to App.js's `c` block in BOTH light and dark modes. Never inline hex.
- **Sub-section grouping inside a tab?** `<Section />` from `./Section`. Page-level tab headers (back-arrow + title + actions row) are intentionally a denser inline shape; don't try to consolidate them into Section.
- **Need a confirm dialog?** `import { confirm } from "./ConfirmModal"`, then `await confirm({ title, message, confirmLabel, tone: "danger" })`. Never `window.confirm` — it breaks dark mode and reads as jarring against the rest of the UI.
- **A sub-tab row (segmented control)?** `<SubTabBar tabs activeKey onSelect>` — don't hand-roll the row or spread raw `segTrack`/`segItem`. Same component for real tab-switchers and jump-to-section nav; pass per-surface chrome (olive bg, sticky) via `containerStyle`. Underline `tabPill` is the TOP-tab look only — the two nav levels must stay visually distinct (audit:2026-06-06 U-01). (The Reference page's pill chip-bar is a deliberately different look, not this.)
- **New card, anywhere?** Render through `CardShell` (image + L1/L2/L3 slots + actions) — don't hand-roll a card frame or a second portal menu. Priced items go via `Card.js` (it keeps the price logic and fills the slots); articles fill the slots directly. **A horizontal row of cards?** `<CardStrip renderCard={…}>`. The editorial magazine `ArticleCard` is the one deliberate exception (its own floating/serif layout) — pending the design-uplift pass.
- **A grid of content cards (articles / reference guides / lists)?** `style={cardGridStyle({ isMobile })}` — one shared track so all three families are the same size. Don't hand-roll `gridTemplateColumns`.
- **A filterable surface with a title?** Use the **collapsing-header pattern** (Mark 2026-06-02): a normal-flow `PageHeader` title that scrolls away, above a `position:sticky; top:0` wrapper holding the search/filter that pins. Bleed the sticky wrapper to the pane edges with negative side margins equal to the scroll-pane padding (−20 desktop / −16 mobile). Live on Saved · catalog · Reference guides · Articles. **Low-facet filters** (few brands) = visible chips + one search box (simple); **high-facet** (Watches/Saved/Auctions, hundreds of values) = the dense expand-pill bar. Simple is the default; dense is the exception.

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
