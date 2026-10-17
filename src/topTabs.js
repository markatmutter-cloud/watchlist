// Top-level tab model — ONE source of truth (2026-10-16: Watches · Articles ·
// Reference Guides; there is NO Saved top tab — see below). Consumed by DesktopShell,
// MobileShell and the HomeTab masthead via the `topTabs` entry App.js builds
// from this. The arrays used to be duplicated inline in all three render
// sites — exactly how labels drift (the consistency bug class).
//
// Internal keys are unchanged (CLAUDE.md "Internal-vs-UI naming"): the old
// Collecting container (`tab="references"`) now hosts TWO top pills —
// Articles (sub "editorial") and Reference Guides (sub "references") — so a
// pill's active state keys off (tab, referencesSubTab), not tab alone. The
// tools family (size / links / challenges, launched from the account menu)
// highlights neither pill. URL keys (?tab=learn&sub=…) are untouched; old
// deep links resolve exactly as before.
export const TOP_TABS = [
  { key: "listings",  label: "Watches",  icon: "listings" },
  { key: "articles",  label: "Articles", icon: "articles", tab: "references", sub: "editorial" },
  // No Saved tab (Mark, 2026-10-16: "I've not been using that as a tab"). What
  // lived there moved to where it is used: saved watches = the heart in the bar
  // and Watches ▸ ♡ Saved; saved articles / guides = the ♡ pill in their filter
  // row; saved searches = suggestions under the focused search bar; Lists = the
  // account ("M") menu. The container is still `tab="watchlist"` internally and
  // `?tab=saved` links still resolve to it — only the top-level entry is gone.
  // "Reference Guides" on desktop, "Guides" on mobile (Mark's call — bare
  // "Reference" reads as ref-numbers; the full label doesn't fit mobile).
  { key: "guides", label: "Reference Guides", mobileLabel: "Guides", icon: "references", tab: "references", sub: "references" },
];

export function isTopTabActive(entry, tab, referencesSubTab) {
  const dest = entry.tab || entry.key;
  if (dest !== tab) return false;
  return entry.sub ? referencesSubTab === entry.sub : true;
}
