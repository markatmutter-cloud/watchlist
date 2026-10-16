// The browser's own tint — the address bar, the bookmarks bar and the iOS
// status strip — follows the PAGE's top surface, not a fixed brand colour.
//
// Until 2026-10-16 every tab but Home sat under the shells' olive bar, so the
// tint was olive everywhere but Home and the two matched. Then the Watches
// page and the `?look=new` bar went light while the tint stayed olive: an
// olive toolbar over a white page (Mark: "now looks weird … don't want the
// olive"). The rule is now one function, so a surface cannot be restyled
// without answering "what colour is my top edge?"
//
// `<meta name="theme-color">` drives Safari's toolbar, Android Chrome's
// address bar and the iOS PWA status strip. The <html> background is what an
// iOS over-scroll bounce reveals, so it follows the same answer.

import { useEffect } from "react";

const OLIVE_LIGHT = "#3b4a36";
const OLIVE_DARK = "#2a3527";
const PAPER_LIGHT = "#ffffff";
const PAPER_DARK = "#1c1c1e"; // the dark theme's --surface, as Home has always used

// True when the surface at the top of the viewport is light (paper), false
// when it is the shells' olive bar (or the green auction-catalog bar).
export function chromeIsLight({ tab, anyTakeover, magWatchesOn, lookNew, catalogFullPage }) {
  // The catalog takeover's green title bar replaces every other top edge.
  if (catalogFullPage) return false;
  // `?look=new` swaps the shells' bar for the magazine bar, receive surfaces
  // and cross-tab search included, so those are light too.
  if (lookNew) return true;
  // Otherwise the shells show their olive bar on the receive / search-all
  // surfaces even though `tab` still says "home".
  if (anyTakeover) return false;
  if (tab === "home") return true;
  return tab === "listings" && !!magWatchesOn;
}

export function ChromeTint({ light, dark }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const lightColor = light ? PAPER_LIGHT : OLIVE_LIGHT;
    const darkColor = light ? PAPER_DARK : OLIVE_DARK;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      const media = (m.getAttribute("media") || "").toLowerCase();
      if (!media) m.setAttribute("content", lightColor); // default tag
      else if (media.includes("light")) m.setAttribute("content", lightColor);
      else if (media.includes("dark")) m.setAttribute("content", darkColor);
    });
    document.documentElement.style.background = light
      ? (dark ? PAPER_DARK : PAPER_LIGHT)
      : (dark ? OLIVE_DARK : OLIVE_LIGHT);
  }, [light, dark]);
  return null;
}
