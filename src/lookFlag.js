// The site-look switches (Mark, 2026-10-16: "do this in a live site alongside
// the current one to check before switching over").
//
//   ?look=new   the magazine chrome on every tab (the DEFAULT since 2026-10-16)
//   ?look=old   back to the shells' own olive bar — the way back
//   ?chrome=display / ?chrome=system   Bodoni wordmark + mono tab labels in
//                                      the chrome, or the app's own type
//
// Sticky in localStorage because Mark lives in the iOS PWA, where a home-screen
// launch drops the query string: set it once in the URL and the app keeps it
// until it is switched back. Read at render, never through a hook — App.js has
// early returns and a new hook past them is React #310 (CLAUDE.md).
//
// The storage keys are new. Never reuse an existing `dial_*` key here: the
// ones CLAUDE.md lists are user data and must not be bumped.

function readSticky(param, key, allowed, fallback) {
  try {
    if (typeof window === "undefined") return fallback;
    const fromUrl = new URLSearchParams(window.location.search).get(param);
    if (fromUrl && allowed.includes(fromUrl)) {
      try { window.localStorage.setItem(key, fromUrl); } catch { /* private mode */ }
      return fromUrl;
    }
    let stored = null;
    try { stored = window.localStorage.getItem(key); } catch { /* private mode */ }
    return stored && allowed.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

// "new" | "old". New since 2026-10-16 (Mark, after trying `?look=new` live);
// `?look=old` is sticky, so the way back survives a home-screen relaunch too.
export function readLook() {
  return readSticky("look", "dial_look", ["new", "old"], "new");
}

// "system" | "display". Default system: that is the type the Watches page
// wears today, and it is the one Mark has approved.
export function readChromeFaces() {
  return readSticky("chrome", "dial_chrome_faces", ["system", "display"], "system");
}

// Whether the Watches tab wears the magazine page (the default since
// 2026-10-16). `?view=classic` is the way back to the shells' own chrome.
// Read per call, like the flags above — no hook, no stored state.
export function isMagWatchesOn() {
  try {
    return typeof window === "undefined"
      || new URLSearchParams(window.location.search).get("view") !== "classic";
  } catch { return true; }
}
