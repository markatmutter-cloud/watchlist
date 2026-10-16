// MagazineShellBar — the magazine's look, in the shells' compact top bar.
//
// The Watches page and Home wear MagazineChrome: a masthead over a bar. That
// works on a page that scrolls, because the masthead scrolls away and only the
// bar stays. The shells are different — a fixed column with an inner scroll
// pane — so anything in their top region is pinned for good, and a two-tier
// masthead there would cost ~55px of every screen forever. Mark's constraint
// for this restyle was "don't lose the compactness", so this is the pinned
// state of the same chrome: ONE row, wordmark + tabs + the account cluster, the
// same height as the olive bar it replaces.
//
// It is a SKIN, like MagazineChrome: the tabs arrive as the shared `topTabs`
// model, the account control as App's own `authJSX`, the heart goes where the
// shells' heart went. Nothing here owns state or invents a control. Search is
// deliberately NOT in this bar: Articles, Guides and Watches each keep their
// own search where it already is, and a second, differently-scoped field in
// the chrome would be exactly the duplicate-control bug MagazineChrome's
// header describes.
//
// Gated by `?look=new` (src/lookFlag.js); the shells render their olive bar
// otherwise, so the live site is unchanged until the flag is on.
//
// MAGB_CSS is a template literal — a backtick inside a comment in it ends the
// string and the rest parses as JavaScript (it bit MAGW_CSS twice). The test
// asserts its shape.

import React from "react";
import { MAG_CSS, Crescent, SavedButton, useFonts } from "./MagazineChrome";

const SANS = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif";

// Loads Bodoni + Plex Mono only when the display faces are asked for. A hook
// cannot be conditional, so it lives in a component that is.
function DisplayFonts() {
  useFonts();
  return null;
}

function Wrap({ faces, className, children }) {
  const display = faces === "display";
  return (
    <div className={`mag magb${display ? " magb--display" : ""} ${className || ""}`}>
      <style>{MAG_CSS}</style>
      <style>{MAGB_CSS}</style>
      {display ? <DisplayFonts /> : null}
      {children}
    </div>
  );
}

function Home({ onHome, children }) {
  return (
    <button type="button" className="mag-home magb-home" onClick={onHome}
            aria-label="Home" title="Home">
      <Crescent />
      <span className="mag-wordmark">Watchlist</span>
      {children}
    </button>
  );
}

function Tabs({ tabs, short }) {
  return (
    <nav className="mag-bar-tabs" aria-label="Sections">
      {(tabs || []).map((t) => (
        <button key={t.key} type="button" onClick={t.onSelect}
                className={t.active ? "on" : ""}
                aria-current={t.active ? "page" : undefined}>
          {short ? (t.mobileLabel || t.label) : t.label}
        </button>
      ))}
    </nav>
  );
}

function Util({ authJSX, showSaved, onSavedClick }) {
  return (
    <div className="magb-util">
      {showSaved && onSavedClick ? <SavedButton onClick={onSavedClick} /> : null}
      {authJSX}
    </div>
  );
}

// Desktop: the one pinned row.
export function MagazineShellBar({ tabs, authJSX, showSaved, onSavedClick, onHome, faces }) {
  return (
    <Wrap faces={faces} className="magb-bar">
      <Home onHome={onHome} />
      <Tabs tabs={tabs} />
      <span className="magb-sp" />
      <Util authJSX={authJSX} showSaved={showSaved} onSavedClick={onSavedClick} />
    </Wrap>
  );
}

// Mobile, row 1: wordmark + account. Non-sticky in MobileShell, so it scrolls
// away exactly as the olive brand row did; the safe-area padding is the same.
export function MagazineBrandRow({ authJSX, showSaved, onSavedClick, onHome, faces }) {
  return (
    <Wrap faces={faces} className="magb-brand">
      <Home onHome={onHome} />
      <span className="magb-sp" />
      <Util authJSX={authJSX} showSaved={showSaved} onSavedClick={onSavedClick} />
    </Wrap>
  );
}

// Mobile, row 2: the tabs, first child of MobileShell's sticky stack.
export function MagazineTabRow({ tabs, faces }) {
  return (
    <Wrap faces={faces} className="magb-tabs">
      <Tabs tabs={tabs} short />
    </Wrap>
  );
}

// Type for the chrome only. The three faces are the app's own system stack by
// default (what the Watches page wears, and what Mark approved there);
// `magb--display` restores Bodoni for the wordmark and Plex Mono for the tab
// labels — the front page's chrome — without touching the working UI.
export const MAGB_CSS = `
.mag.magb { --mag-display: ${SANS}; --mag-body: ${SANS}; --mag-data: ${SANS}; }
.mag.magb .mag-wordmark { font-family: var(--mag-body); text-transform: uppercase;
                          font-weight: 700; letter-spacing: .14em; line-height: 1.1;
                          font-size: 19px; display: inline-block; margin: 0; }
.mag.magb .mag-crescent svg { width: 22px; height: 22px; }
.mag.magb--display { --mag-display: "Bodoni Moda", Didot, "Times New Roman", serif;
                     --mag-data: "IBM Plex Mono", ui-monospace, Menlo, monospace; }
.mag.magb--display .mag-wordmark { font-family: var(--mag-display); text-transform: none;
                                   font-weight: 500; letter-spacing: .015em; line-height: .95;
                                   font-size: 30px; }
.mag.magb--display .mag-crescent svg { width: 26px; height: 26px; }

.magb-home { flex: 0 0 auto; }
.magb-sp { flex: 1 1 auto; }
.magb-util { display: flex; align-items: center; gap: 12px; flex: 0 0 auto; }

/* Desktop: padding matches the shell's 20px content inset, so the wordmark
   and the tabs hang from the same edge as everything under them. */
.magb-bar { display: flex; align-items: center; gap: 30px; padding: 9px 20px;
            background: var(--bg); border-bottom: .5px solid var(--border); flex-shrink: 0; }
.magb-bar .mag-bar-tabs { flex-wrap: nowrap; }

/* Mobile */
.magb-brand { display: flex; align-items: center; gap: 8px;
              padding: 8px 16px; padding-top: calc(env(safe-area-inset-top, 0px) + 8px);
              background: var(--bg); border-bottom: .5px solid var(--border); }
.magb-brand .mag-icon { width: 40px; height: 40px; }
.magb-brand .mag-icon svg { width: 18px; height: 18px; }
.magb-brand .mag-wordmark { font-size: 17px; }
.magb-brand.magb--display .mag-wordmark { font-size: 28px; }
.magb-tabs { padding: 0 16px; background: var(--bg); border-bottom: .5px solid var(--border); }
.magb-tabs .mag-bar-tabs { flex-wrap: nowrap; overflow-x: auto; gap: 0 20px;
                           scrollbar-width: none; -ms-overflow-style: none;
                           -webkit-overflow-scrolling: touch; }
.magb-tabs .mag-bar-tabs::-webkit-scrollbar { display: none; }
.magb-tabs .mag-bar-tabs button { font-size: 11.5px; letter-spacing: .11em; padding: 11px 0 9px;
                                  border-bottom-width: 2px; white-space: nowrap; }
`;
