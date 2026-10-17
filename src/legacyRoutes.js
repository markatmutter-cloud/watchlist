// URL routes that outlived the surface they pointed at.
//
// The Saved top tab was retired 2026-10-17 (Mark: lists move to the account menu, saved
// searches become suggestions under the search bar, "get rid of the saved top level tab").
// Its container is still the internal tab "watchlist", but it now holds only Lists and
// Searches. Anything else that used to land inside it (a bare ?tab=saved, the hearted
// landing, the listings/auctions/sold hearted sub-tabs) means "my saved watches", which
// now live on Watches > ♡. Decided at the URL, in the state initialisers and the popstate
// handler, so the browser's back button never bounces off a redirect.

export const LISTS_SUBS = ["lists", "searches", "shared"];

// `t` is the raw ?tab= value, `sub` the raw ?sub=.
export function savedUrlGoesToWatches(t, sub) {
  const inSavedContainer = t === "saved" || t === "watchlist" || t === "collections";
  return inSavedContainer && !LISTS_SUBS.includes(sub);
}
