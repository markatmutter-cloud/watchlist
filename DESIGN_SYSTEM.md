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

**Display faces are the header's, nothing below it (2026-10-17).** Every tab's header wears the front page's
Bodoni wordmark and mono tab labels (`MagazineShellBar`); the working UI under it (cards, filters, search, pills) is
the app's own sans, set once in `src/ui/ui.css`. No page re-declares the faces — the per-page `.mag.magw` override
that used to do this was deleted with the Watches migration.

**Saved = an icon-only heart (2026-10-16).** On Articles and Reference Guides "show only what I saved"
is `SavedPill` — a bare ♡ in the filter row (olive selected state, fills with currentColor,
never `--heart` red), not a word and not a sub-tab. Watches keeps its `♡ Saved` sub-tab as the one saved
control because it spans For sale / Auctions / Sold; don't add a second saved pill beside it. (This reversed the
2026-07-30 "sub-tab, never a pill" rule, which existed because a labelled pill went unfound — so the
icon carries an `aria-label`/`title`, and the empty state invites.)

**The label voice (2026-10-16).** Pills and counts are small tracked caps (`--ui-label-size` / `--ui-label-track` in
`src/ui/ui.css`). TYPE and padding only; the pill height is the device's one control height.

**The browser tint follows the page's top edge (2026-10-16).** `theme-color` (Safari's
toolbar + bookmarks bar, the iOS PWA status strip, Android's address bar) and the
`<html>` background are set by `<ChromeTint />` from one rule, `chromeIsLight()` in
`src/chromeTint.js`: paper everywhere, except over the
green catalog title bar. A surface that changes its top colour has to answer that rule — an
olive toolbar over a light page is the bug it exists to prevent.

**The faces (tokens in `styles.js` — never inline a font string).**
`FONT_SANS` is the interface (also the `public/index.html` body default,
which 75% of UI inherits via `fontFamily: "inherit"`). `FONT_SERIF` /
`FONT_SERIF_DISPLAY` are the editorial face = **Hoefler Text** (Mark's
call: Apple-native, ligatures, magazine contrast; Iowan Old Style / Georgia
are fallbacks). One exception: the portalled ⋯ menu (`.ui-menu` in
`ui.css`) hard-sets `--ui-sans` because it mounts on `document.body` (else iOS
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

## 2. Style tokens

**Page chrome is `src/ui`** (section "Page chrome" below): pills, search, sub-tabs, chips, buttons, headers and the
filter bar are classes in `src/ui/ui.css`, one definition each. **Selected = solid olive** everywhere (a pill, a chip,
the sub-tab's active segment, a dismissable filter); a quiet "present but not chosen" is a dashed pill. The old
`SELECTED_FILL` / `pillBase` / `innerToggleButton` / `segTrack` / `actionButton`-for-pages family is gone.

`src/styles.js` keeps what is not chrome:

| Token | Use |
|---|---|
| `FONT_SANS` / `FONT_SERIF` / `FONT_SERIF_DISPLAY` | The font stacks (the one place a family string lives) |
| `editorialDisplay` / `editorialHeading` / `editorialTitle` / `editorialProse` | The editorial type ramp (articles, reference guides) |
| `cardGridStyle({ isMobile })` | **Shared content-card grid** — `auto-fill minmax(280px,1fr)` desktop / 1-col mobile. Article cards · reference-guide cards · list cards all use it so the three families are the same size |

## 3. Reusable React components — `src/components/`

| Component | Use |
|---|---|
| `CardShell.js` | **Shared card frame** — square/editorial image + placeholder, L1/L2/L3 text slots, action stack (heart / ⋯ / quickAction via the shared Overlay pieces). Every card renders through it. |
| `CardStrip.js` | **Shared horizontal card row** — scroll container + per-tile wrapper (38%/170 mobile · 210 desktop). Caller passes a `renderCard` fn. Scroll affordance = right-edge fade (hides at the end) + the peeking next tile; **no custom scrollbar/thumb** (the JS thumb was removed 2026-05-28 — it drove setState every scroll frame + eased, so it trailed the scroll). Snap is `proximity`. Used by Home, Search-all, ReferencePage, Collections strips. |
| `src/ui` `SubTabs` | **The sub-tab row** — the one segmented control (solid olive chip). The old `SubTabBar.js` is deleted. |
| `Card.js` | Feed card (priced listings / auctions / sold). Renders **into** `CardShell`; keeps all the price/FX/auction/sold logic |
| `src/ui` `Chip` | Filter chips (sources / brands / models): solid olive when on. The old `Chip.js` is deleted. |
| `ListRow.js` | Collection list row (in Lists drill-in) |
| `SubTabIntro.js` | Intro callout banner with optional action button (different visual primitive from `actionButton`; intentional — callout-banner action vs header toolbar action) |
| `EmptyState.js` | Standard empty-state surface (icon + heading + blurb + optional CTA). Three sizes: `compact` / `default` / `tall` |
| `Section.js` | Sub-section grouping inside a tab content area. Pass `show={false}` for single-section views to drop the divider header |
| `UserLimitBanner.js` | Top-of-app limit banner (global, mounted by both shells) |
| `LotMigrationBanner.js` | One-shot tracked-lot migration prompt |
| `Links.js` / `icons.js` | Internal/external link helpers, SVG icons |
| `ConfirmModal.js` | Styled confirm dialog. Imperative API — `await confirm({ title, message, confirmLabel, cancelLabel, tone: "danger" \| "default" })` returns `Promise<boolean>`. One `<ConfirmHost/>` mounts at App level. Replaces every `window.confirm` site since PR #317 |

## Page chrome — `src/ui` (2026-10-17)

The one frame for every page, defined in `src/ui/ui.css` and shown live at `?view=styleguide`.
`ui-guard` and `chrome-guard` fail the build on drift. (The 2026-06-03 standard library
`StandardFilterBar` / `StandardSearchInput` / `SubTabBar` and the `DesktopShell` / `MobileShell`
they lived in are deleted.)

- **`PageShell`** — the header (desktop bar; phone brand row + sticky tab row), the overlays and modals.
  `header` swaps in a page's own pinned header (the catalog's olive title bar); `bare` is for Home.
- **`PageFrame`** — sub-tabs · filter bar · content, in that order, at one inset (20 / 16). No page title.
- **`FilterBar`** — pills left · search centred · count right; `stacked` gives a crowded bar's search its own row.
  A sticky bar publishes `--sticky-top`, so date dividers pin just under it.
- **Inside a page:** `SectionHead` (the heading for a thing on the page, such as a list's name, with its
  actions as pills; not a page title), `DismissChip` (a selected filter you can take off), `JumpNav` (a sticky row
  of pills that scrolls to a section), `Pill primary` (the one main action) and `Button` (sign-in, sheet actions).
  The old `PageHeader`, `pillBase`, `innerToggleButton`, `CHROME`, `actionButton`, `inputBase`, `modalShell` and the
  other chrome helpers in `styles.js` are deleted; `chrome-guard` fails the build if they return. `styles.js` keeps only
  the font stacks, the editorial type ramp and `cardGridStyle`.
- **Dialogs:** `Modal` (title + close, `sheet` for a pinned head over a scrolling body, `full` on a phone, `bare` for a
  self-laid-out one) with `ModalNote` / `ModalError` / `ModalFoot`, `Input` / `Textarea` / `FieldLabel`, `PickRow` for a
  list picker, and `SubTabs choice block` for a setting. The main action is `Button primary` (solid olive), a destructive
  confirm is `Button danger`.
- **On an image:** the heart and ⋯ on any card, article, guide tile, auction cover, list tile or the screener are
  `OverlayHeart` / `OverlayMenu` (+ `MenuItem`), a one-off round `OverlayButton` for anything else (a remove ×). 34px,
  26px with `small`; dark glass; saved is olive, never red. The caller positions the stack; the menu portals to body, so
  nothing inside a card renders its own. `above` lifts a menu over a full-screen layer.
- **`topTabs.js`** — the only home of top-tab labels (Watches · Articles ·
  Reference Guides / "Guides" mobile); the one header + the Home masthead
  consume the same built model.
- **Counts**: bar surfaces → the bar's right slot; bar-less headers →
  the section head's count; never under a title.
- **Failed images** — terminal state is ALWAYS the favicon placeholder
  (`/favicon-192.png`, CardShell.CardImage pattern); wsrv-served images retry
  the raw origin once first (RefImg / ShareReceiver ladder). ShareReceiver's
  "Open on {source} to see it" is the one richer exception.
- **Labels**: never "Hearted" — "♡ Saved". Tabs title-case; page titles
  sentence-case.

## Lumé — the dot and the chat (2026-10-17)

One definition, `.ui-lume-*` in `src/ui/ui.css`, shown live on `?view=styleguide` §6. **The mark stays abstract** (a lume pip,
never a face: UX principles 12). The dot is `--brand-olive` with a hairline ring and one soft shadow, the pip breathes slowly and stops
for `prefers-reduced-motion`, and the "Ask me" label is a paper pill in the mono label voice until the first open. The panel is the paper
surface with one hairline; the header is the Bodoni name over a mono caption that discloses "AI, still learning" (principles 2 and 13).
**Colour rule inside the chat:** solid olive is what *you* did (your bubble, Send, the mic while listening); outlined olive is what *Lumé
offers* (action chips, filling olive on hover); suggestions are the shared `Chip`. Lumé's replies are not in a bubble. Layering: the launcher
and panel sit at 1400; the phone filter sheet (1450) covers the dot so it can't sit on "Show N watches"; confirm / review modals (2000+) cover both.

## Reach-for-this rules

- **New button, pill or toggle somewhere?** `Pill` / `Button` from `src/ui` (`Pill primary` for the one main action, `Pill toggle` for on/off, `Button inline` for a sign-in). Don't hand-roll padding / radius / colour.
- **Selected / "on" state?** The shared solid olive (`Pill on`, `Chip on`, the sub-tab's active segment). Never invent a per-surface selected look.
- **Clearing filters?** ONE pattern: the filter bar's `× Clear all` pill clears everything; each active filter is a `DismissChip` that removes one value. Don't add per-dimension clear buttons.
- **A heading inside a page** (a list's name, with actions)? `SectionHead`. A long page's jump links? `JumpNav`. Neither is a page title.
- **New modal?** `Modal` from `src/ui` (+ `ModalNote` / `ModalFoot` / `Input` / `Button`). Never a hand-rolled backdrop and card.
- **New empty / signed-out / "nothing here yet" surface?** `<EmptyState />` from `./EmptyState`. Pick the size: `compact` for in-tab emptiness, `default` for general, `tall` for top-level signed-out gates.
- **New color?** Add a CSS var to App.js's `c` block in BOTH light and dark modes. Never inline hex.
- **Sub-section grouping inside a tab?** `<Section />` from `./Section`. Page-level tab headers (back-arrow + title + actions row) are intentionally a denser inline shape; don't try to consolidate them into Section.
- **Need a confirm dialog?** `import { confirm } from "./ConfirmModal"`, then `await confirm({ title, message, confirmLabel, tone: "danger" })`. Never `window.confirm` — it breaks dark mode and reads as jarring against the rest of the UI.
- **A sub-tab row (segmented control)?** `<SubTabs tabs activeKey onSelect>` from `src/ui` — don't hand-roll the row. Same component for real tab-switchers and jump-to-section nav; pass per-surface chrome (olive bg, sticky) via `containerStyle`. Underline `tabPill` is the TOP-tab look only — the two nav levels must stay visually distinct (audit:2026-06-06 U-01). (The Reference page's pill chip-bar is a deliberately different look, not this.)
- **New card, anywhere?** Render through `CardShell` (image + L1/L2/L3 slots + actions) — don't hand-roll a card frame or a second portal menu. Priced items go via `Card.js` (it keeps the price logic and fills the slots); articles fill the slots directly. **A horizontal row of cards?** `<CardStrip renderCard={…}>`. The editorial magazine `ArticleCard` is the one deliberate exception (its own floating/serif layout) — pending the design-uplift pass.
- **A grid of content cards (articles / reference guides / lists)?** `style={cardGridStyle({ isMobile })}` — one shared track so all three families are the same size. Don't hand-roll `gridTemplateColumns`.

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
  elements skip the shared `Button` / `Pill`. The
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
