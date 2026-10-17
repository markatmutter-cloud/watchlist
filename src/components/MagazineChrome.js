// MagazineChrome — the masthead, the tabs, the search and the account row,
// in the magazine's visual language.
//
// Extracted from MagazineHome (2026-09-07) so a second surface can wear the
// same chrome without a second copy of it. Every duplicate-control bug this
// page has had came from the chrome being welded to one page: search rendered
// twice, tabs rendered twice, a bespoke account control beside the app's own.
// One component, two consumers, no drift.
//
// It renders NOTHING it doesn't own: the account control arrives as `authJSX`
// (App builds the real one), the tabs as the shared topTabs model. This is a
// skin over the app's own controls, not a reimplementation of them.

import React, { useEffect, useRef, useState } from "react";
import { SearchField, SuggestionRows } from "../ui/SearchField";

// The three magazine faces, loaded on mount and only on mount, so the rest of
// the app's font payload is unchanged.
const FONTS = "https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500&family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";

function useFonts() {
  useEffect(() => {
    if (document.getElementById("mag-fonts")) return;
    const link = document.createElement("link");
    link.id = "mag-fonts";
    link.rel = "stylesheet";
    link.href = FONTS;
    document.head.appendChild(link);
  }, []);
}

// The saved-watches heart in the chrome's utility cluster. Shared with the
// compact shell bar for the same reason as Crescent.
function SavedButton({ onClick }) {
  return (
    <button type="button" className="mag-icon" aria-label="Saved watches" onClick={onClick}>
      <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M10 17S3 12.6 3 7.9A3.9 3.9 0 0 1 10 5.6a3.9 3.9 0 0 1 7 2.3C17 12.6 10 17 10 17z" />
      </svg>
    </button>
  );
}

// The wordmark's crescent. One drawing, shared by this chrome and the compact
// shell bar, so the two cannot drift.
function Crescent() {
  return (
    <span className="mag-crescent" aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="15.2" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".55" />
        <path d="M20 4.8a15.2 15.2 0 0 0 0 30.4 11 15.2 0 0 1 0-30.4z" fill="currentColor" />
      </svg>
    </span>
  );
}

// Home's search: the shared SearchField (the same box, size and place as every other page's
// search; Mark, 2026-10-17) with a Search button seated in it. It routes rather than filters:
// typing previews what each destination holds, Enter or a row goes there. Under the focused,
// empty field it offers the user's saved searches (Mark, 2026-10-16) and recent searches.
//   size   "bar" (the desktop masthead's bar) | "full" (the phone header's search row)
function MagSearch({ size = "bar", onSubmit, onLiveQuery, counts, recent, addRecent, saved, onRunSaved, onRemoveSaved }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    const away = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const change = (v) => {
    setQ(v);
    setOpen(v.trim().length > 0);
    if (onLiveQuery) onLiveQuery(v.trim().length >= 2 ? v.trim() : "");
  };
  const fire = (target) => {
    const term = q.trim();
    if (!term) return;
    if (addRecent) addRecent(term);
    if (onSubmit) onSubmit(term, target);
    setQ(""); setOpen(false);
    if (onLiveQuery) onLiveQuery("");
  };

  const targets = [
    { id: "all", label: "Everything", n: counts && counts.all },
    { id: "live", label: "For sale", n: counts && counts.live },
    { id: "auctions", label: "At auction", n: counts && counts.auctions },
    { id: "sold", label: "Sold", n: counts && counts.sold },
  ].map((t) => ({ id: t.id, label: t.label, meta: t.n == null ? "" : t.n.toLocaleString() }));
  const savedRows = (saved || []).map((x) => ({
    id: x.id, label: x.label, saved: x,
    meta: `${x.count} for sale${x.newCount ? ` · ${x.newCount} new` : ""}`,
  }));
  const recentRows = (recent || []).slice(0, 5).map((r) => ({ id: r, label: r }));
  const typing = q.trim().length > 0;

  return (
    <div className="mag-searchwrap" ref={wrap}>
      <SearchField
        size={size}
        value={q}
        onChange={(e) => change(e.target.value)}
        onClear={() => { setQ(""); setOpen(false); if (onLiveQuery) onLiveQuery(""); }}
        onFocus={() => setOpen(q.trim().length > 0 || recentRows.length > 0 || savedRows.length > 0)}
        onSubmit={() => fire("all")}
        placeholder="Brand, model, reference"
        ariaLabel="Search watches"
        trailing={<button type="submit" className="ui-search-go">Search</button>}>
        {open ? (
          <div className="ui-search-drop">
            {typing ? (
              <SuggestionRows rows={targets} onRun={(r) => fire(r.id)} />
            ) : (
              <>
                <SuggestionRows heading="Saved searches" rows={savedRows}
                  onRun={(r) => { setOpen(false); if (onRunSaved) onRunSaved(r.saved); }}
                  onRemove={onRemoveSaved ? (r) => onRemoveSaved(r.saved) : undefined} />
                <SuggestionRows heading="Recent" rows={recentRows}
                  onRun={(r) => { setQ(r.label); change(r.label); }} />
              </>
            )}
          </div>
        ) : null}
      </SearchField>
    </div>
  );
}

export { MagSearch, Crescent, SavedButton, useFonts };

// The desktop masthead: the big wordmark over a sticky bar of tabs · search · saved heart · account.
// A phone has no masthead of its own: Home wears the same header as every other page (PageShell),
// and its search is seated in that header's search row (Mark, 2026-10-17: "all still different").
export default function MagazineChrome({
  tabs, authJSX, onSavedClick, showSaved,
  onSearchSubmit, onSearchLiveQuery, searchCounts, recentSearches, addRecentSearch,
  savedSearches, onRunSavedSearch, onRemoveSavedSearch,
  // Optional slots a second surface fills. `searchJSX` replaces the routing MagSearch with the
  // consumer's own field; `onHome` turns the wordmark into the way back to the landing page
  // (Mark, 2026-09-08). Home passes neither, so it is unchanged.
  searchJSX, onHome,
}) {
  useFonts();
  const search = searchJSX || (
    <MagSearch size="bar" onSubmit={onSearchSubmit} onLiveQuery={onSearchLiveQuery}
               counts={searchCounts} recent={recentSearches} addRecent={addRecentSearch}
               saved={savedSearches} onRunSaved={onRunSavedSearch} onRemoveSaved={onRemoveSavedSearch} />
  );
  const crescent = <Crescent />;
  const savedBtn = showSaved && onSavedClick ? <SavedButton onClick={onSavedClick} /> : null;
  const tabList = () => (
    <div className="mag-bar-tabs">
      {(tabs || []).map((t) => (
        <button key={t.key} type="button" onClick={t.onSelect} className={t.active ? "on" : ""}>
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <header className="mag-flag">
        {onHome ? (
          <button type="button" className="mag-mark mag-home" onClick={onHome}
                  aria-label="Home" title="Home">
            {crescent}
            <h1 className="mag-wordmark">Watchlist</h1>
          </button>
        ) : (
          <div className="mag-mark">
            {crescent}
            <h1 className="mag-wordmark">Watchlist</h1>
          </div>
        )}
      </header>
      <div className="mag-bar">
        {tabList()}
        {search}
        <div className="mag-bar-util">
          {savedBtn}
          {authJSX}
        </div>
      </div>
    </>
  );
}

export const MAG_CSS = `
.mag { --mag-display: "Bodoni Moda", Didot, "Times New Roman", serif;
       --mag-body: "Archivo", -apple-system, "Helvetica Neue", Arial, sans-serif;
       --mag-data: "IBM Plex Mono", ui-monospace, Menlo, monospace;
       font-family: var(--mag-body); color: var(--text1); }
.mag img { display: block; width: 100%; height: 100%; object-fit: cover; }
.mag a { color: inherit; }

/* Three zones: wordmark left, moon centred over the search below it, nothing
   on the right (the account controls moved into the persistent bar, so this
   row no longer has to leave a lane for them). */
.mag-flag { display: flex; align-items: center; justify-content: space-between;
            gap: 24px; padding: 22px 0 14px; }
.mag-mark { display: flex; align-items: center; gap: clamp(10px,1.3vw,18px); min-width: 0; }
.mag-crescent { display: inline-flex; flex: 0 0 auto; color: var(--brand-olive-ink); }
/* The wordmark as the way home, on surfaces that pass an onHome handler.
   Identical to the static mark — it just becomes tappable. */
.mag-home { display: flex; align-items: center; gap: clamp(10px,1.3vw,18px); min-width: 0;
            background: none; border: none; padding: 0; cursor: pointer; text-align: left; }
.mag-home:hover .mag-wordmark, .mag-home:hover .mag-crescent { opacity: .78; }
.mag-crescent svg { width: clamp(26px,3.4vw,44px); height: clamp(26px,3.4vw,44px); }
/* Olive wordmark (Mark, 2026-09-07). --brand-olive-ink is theme-aware: deep
   olive on paper, a lifted sage on the dark ground, so it holds contrast in
   both without needing a second colour. */
.mag-wordmark { font-family: var(--mag-display); font-weight: 500; margin: 0;
                font-size: clamp(28px,6vw,64px); line-height: .88; letter-spacing: .015em;
                color: var(--brand-olive-ink); }
/* One tile width for both grids, so a story and a watch are the same object
   on the page (Mark, 2026-09-07). Change it here and both grids move. */
.mag { --mag-tile: 268px; }

.mag-searchwrap { position: relative; flex: 0 0 auto; }

/* persistent bar */
.mag-bar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center;
           justify-content: space-between; gap: 22px;
           padding: 12px 0; margin-bottom: 4px; background: var(--bg);
           border-bottom: .5px solid var(--border); }
.mag-bar-tabs { display: flex; flex-wrap: wrap; gap: 4px 22px; flex: 0 0 auto; }
.mag-bar-tabs button { font-family: var(--mag-data); font-size: 12.5px; letter-spacing: .13em;
                       text-transform: uppercase; color: var(--text2); background: none; border: none;
                       cursor: pointer; padding: 2px 0; border-bottom: 1.5px solid transparent; }
.mag-bar-tabs button:hover, .mag-bar-tabs button.on { color: var(--brand-olive-text); border-bottom-color: var(--brand-olive-text); }
/* Absolutely centred on the page rather than flex-centred between the tabs
   and the account controls: the moon sits on the page's centre line, and the
   two only share a vertical axis if the search does too. Flex-centring put
   them 128px apart. Below 1180px the lanes get tight, so it falls back to
   flowing in the row. */
.mag-bar .mag-searchwrap { position: absolute; left: 50%; transform: translateX(-50%);
                           width: min(560px, 46vw); }
@media (max-width: 1180px) {
  .mag-bar .mag-searchwrap { position: static; transform: none;
                             flex: 1 1 auto; width: auto; max-width: 560px; margin: 0 auto; }
}
/* Width of the app's fixed overlay (About + heart + account) plus breathing
   room, so the sticky bar never slides under it on scroll. */
.mag-bar-util { display: flex; align-items: center; gap: 12px; flex: 0 0 auto; }
.mag-bar-link { font-family: var(--mag-data); font-size: 10.5px; letter-spacing: .14em;
                text-transform: uppercase; color: var(--text2); background: none; border: none;
                cursor: pointer; padding: 4px 0; }
.mag-bar-link:hover { color: var(--brand-olive-text); }
.mag-signin { font-family: var(--mag-data); font-size: 10.5px; letter-spacing: .14em;
              text-transform: uppercase; color: var(--text1); background: none; cursor: pointer;
              border: .5px solid var(--border); border-radius: 999px; padding: 8px 16px; }
.mag-signin:hover { border-color: var(--brand-olive-text); color: var(--brand-olive-text); }
/* Same disc as the account control beside it, on both breakpoints: App builds
   that one at 36px on desktop and 40px on mobile, and a heart 6px smaller sat
   noticeably low and light next to it (Mark, 2026-09-08). The saved COUNT
   badge that used to ride the top-right corner is gone with it — the number
   belongs on the destination, not on the way in. */
.mag-icon { width: 36px; height: 36px; border-radius: 999px; border: .5px solid var(--border);
            background: transparent; cursor: pointer; display: flex; align-items: center;
            justify-content: center; color: var(--text1); position: relative; padding: 0; }
.mag-icon:hover { border-color: var(--brand-olive-text); color: var(--brand-olive-text); }
.mag-icon svg { width: 17px; height: 17px; }
.mag-avatar { width: 34px; height: 34px; border-radius: 999px; background: var(--brand-olive-text);
              color: var(--bg); font-family: var(--mag-display); font-size: 15px; font-weight: 500;
              display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }

/* dealer shortcuts */
/* Same band treatment and the same width as the featured-watch band below,
   so the two read as one device rather than two (Mark, 2026-09-07). Inset to
   the content column, not bled to the viewport. */
.mag-dealers-band { background: var(--surface, rgba(0,0,0,.035));
                    padding: 16px clamp(22px,3vw,40px);
                    margin-bottom: clamp(24px,3vw,36px); }
/* Label ABOVE the rail, not beside it (Mark, 2026-09-08). Inline, the label
   plus its 14px gap took ~160px off a row that is already scrolling, so on a
   phone you saw one pill and the edge of a second — and the rail read as a
   dead end rather than something to swipe. Stacked, the pills get the whole
   content width. */
.mag-dealers-inner { display: flex; flex-direction: column; align-items: stretch;
                     gap: 9px; min-width: 0; }
.mag-dealers-inner > .mag-dealers { min-width: 0; }
.mag-sec--dealers { margin-top: clamp(30px,3.6vw,48px); }
.mag-dealers-label { font-family: var(--mag-data); font-size: 10.5px; letter-spacing: .16em;
                     text-transform: uppercase; color: var(--text3); margin: 0; }
/* One row that scrolls sideways rather than a block four deep (Mark,
   2026-09-07). Native scrollbar hidden; the cut-off chip is the affordance. */
.mag-dealers { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px;
               scrollbar-width: none; -ms-overflow-style: none; }
.mag-dealers::-webkit-scrollbar { display: none; }
.mag-dealer-chip { flex: 0 0 auto; }
.mag-dealer-chip { display: inline-flex; align-items: center; gap: 9px; cursor: pointer;
                   border: .5px solid var(--border); border-radius: 999px; background: var(--bg);
                   padding: 7px 15px 7px 9px; font-family: var(--mag-body); font-size: 13.5px;
                   color: var(--text1); }
.mag-dealer-chip:hover { border-color: var(--brand-olive-text); color: var(--brand-olive-text); }
.mag-dealer-chip img { width: 20px; height: 20px; border-radius: 4px; object-fit: contain;
                       background: var(--bg); flex: 0 0 auto; }

/* admin hide */
.mag-hide { position: absolute; top: 10px; right: 10px; z-index: 4; width: 26px; height: 26px;
            border-radius: 999px; border: none; cursor: pointer; background: rgba(8,10,6,.55);
            color: #fff; font-size: 15px; line-height: 1; padding: 0; }
.mag-hide:hover { background: rgba(8,10,6,.8); }
.mag-hide--tile { width: 24px; height: 24px; font-size: 14px; }


.mag-sec { margin-top: clamp(40px,5.4vw,76px); }
.mag-sec--first { margin-top: clamp(30px,4vw,54px); }
.mag-sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 20px;
                border-bottom: 1.5px solid var(--text1); padding-bottom: 11px; margin-bottom: clamp(18px,2.2vw,28px); }
.mag-sec-title { font-family: var(--mag-display); font-weight: 500; margin: 0;
                 font-size: clamp(22px,3.1vw,40px); line-height: 1; color: var(--text1); }
.mag-viewall { font-family: var(--mag-data); font-size: 11px; letter-spacing: .15em; text-transform: uppercase;
               color: var(--text1); background: none; border: none; border-bottom: 1.5px solid var(--text1);
               padding: 6px 0 5px; cursor: pointer; white-space: nowrap; text-decoration: none; }
.mag-viewall:hover { color: var(--brand-olive-text); border-bottom-color: var(--brand-olive-text); }
.mag-sec-foot { display: flex; justify-content: center; padding-top: clamp(24px,2.8vw,34px); }

/* Fit the window, don't exceed it. At 1400px a 16:9 cover is 787px tall, so
   on a laptop the hero ran past the fold and the headline sat below it
   (Mark, 2026-09-07). The ratio still drives the shape; the cap stops it
   growing past what you can see, and object-fit crops rather than squashes. */
.mag-cover { position: relative; width: 100%; aspect-ratio: 16/9;
             max-height: min(62vh, 620px); overflow: hidden; background: var(--card-bg); }
.mag-cover::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, rgba(8,10,6,0) 45%, rgba(8,10,6,.30) 78%, rgba(8,10,6,.55) 100%); }
.mag-cover-pic { position: absolute; inset: 0; display: block; }
.mag-cover-lines { position: absolute; inset: auto 0 0 0; z-index: 2; padding: clamp(34px,5vw,64px) clamp(20px,3.4vw,46px) clamp(20px,3.4vw,46px);
  display: grid; gap: 10px;
  background: linear-gradient(180deg, rgba(8,10,6,0) 0%, rgba(8,10,6,.62) 34%, rgba(8,10,6,.88) 100%); }
.mag-kicker { font-family: var(--mag-data); font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
              color: #EFE9D4; margin: 0; }
.mag-kicker--card { color: var(--brand-olive-text); font-size: 10.5px; letter-spacing: .16em; margin: 6px 0 0; }
.mag-cover-head { font-family: var(--mag-display); font-weight: 400; margin: 0; color: #FBFAF3;
                  font-size: clamp(24px,4.1vw,54px); line-height: 1.02; max-width: 21ch;
                  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.mag-cover-head a { text-decoration: none; }
.mag-cover-stand { margin: 0; max-width: 52ch; color: #DAD7C6; font-size: clamp(14px,1.35vw,16.5px); line-height: 1.5;
                   display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.mag-stamp { font-family: var(--mag-data); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase;
             color: var(--text3); margin: 0; }
.mag-cover-lines .mag-stamp { color: #B6B3A2; }
.mag-dots { position: absolute; z-index: 3; right: clamp(14px,2.6vw,38px); bottom: clamp(12px,2.4vw,34px);
            display: flex; gap: 2px; }
/* The bar is 3px tall but the button is 26px, with the bar drawn by a child.
   A 3px target was almost unclickable (Mark, 2026-09-07). */
.mag-dot { width: 42px; height: 26px; padding: 0; border: none; cursor: pointer;
           background: none; display: flex; align-items: center; justify-content: center; }
.mag-dot::before { content: ""; display: block; width: 32px; height: 3px;
                   background: rgba(251,250,243,.45); box-shadow: 0 0 6px rgba(8,10,6,.55);
                   transition: background .2s ease, height .2s ease; }
.mag-dot:hover::before { background: rgba(251,250,243,.8); }
.mag-dot[aria-current="true"]::before { background: #FBFAF3; height: 4px; }

.mag-cards { display: grid; gap: clamp(22px,2.6vw,34px) clamp(18px,2vw,26px);
             grid-template-columns: repeat(auto-fill, minmax(var(--mag-tile),1fr)); align-items: start;
             margin-top: clamp(28px,3.2vw,42px); }
/* When the app resolves a column count (Settings > Columns, Auto included),
   it wins over the fluid tile so the two grids agree with the rest of the
   site rather than inventing their own width. */
.mag[style*="--mag-cols"] .mag-cards,
.mag[style*="--mag-cols"] .mag-cat { grid-template-columns: repeat(var(--mag-cols), minmax(0,1fr)); }
.mag-card { display: grid; gap: 8px; align-content: start; }
.mag-card-img { display: block; position: relative; aspect-ratio: 13/9; overflow: hidden; background: var(--card-bg); }
.mag-card-head { font-family: var(--mag-display); font-weight: 500; margin: 0;
                 font-size: clamp(17px,2vw,23px); line-height: 1.12; }
.mag-card-head a { text-decoration: none; }
.mag-card-head a:hover { color: var(--brand-olive-text); }
.mag-card-stand { margin: 0; font-size: 14.5px; line-height: 1.5; color: var(--text2);
                  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

.mag-pick-band { background: var(--surface, rgba(0,0,0,.035)); padding: clamp(22px,3vw,40px);
                 margin-bottom: clamp(26px,3vw,38px); }
.mag-pick-band .mag-pick { padding-bottom: 0; margin-bottom: 0; border-bottom: none; }
.mag-pick { display: grid; grid-template-columns: minmax(0,1.05fr) minmax(0,1fr); gap: clamp(20px,3vw,40px);
            align-items: center; padding-bottom: clamp(26px,3vw,38px); margin-bottom: clamp(26px,3vw,38px);
            border-bottom: .5px solid var(--border); }
.mag-pick-img { display: block; position: relative; aspect-ratio: 4/3; overflow: hidden; background: var(--card-bg); }
.mag-pick-body { display: grid; gap: 8px; align-content: center; }
.mag-pick-brand { font-family: var(--mag-display); font-weight: 400; margin: 2px 0 0;
                  font-size: clamp(26px,3.2vw,40px); line-height: 1.04; }
.mag-pick-brand a { text-decoration: none; }
.mag-pick-ref { margin: 0; font-size: 15px; line-height: 1.4; color: var(--text2); max-width: 44ch; }
.mag-pick-price { margin: 6px 0 0; font-family: var(--mag-data); font-weight: 500;
                  font-size: clamp(17px,1.8vw,20px); color: var(--brand-olive-text); font-variant-numeric: tabular-nums; }

.mag-cat { display: grid; gap: clamp(22px,2.4vw,32px) clamp(18px,2vw,26px);
           grid-template-columns: repeat(auto-fill, minmax(var(--mag-tile),1fr)); align-items: start; }
.mag-lot { display: grid; align-content: start; }
.mag-lot-img { display: block; position: relative; aspect-ratio: 1; overflow: hidden; background: var(--card-bg); }
.mag-lot-body { padding: 11px 0 0; display: grid; gap: 5px; }
.mag-dealer { font-family: var(--mag-data); font-size: 10px; letter-spacing: .17em; text-transform: uppercase;
              color: var(--brand-olive-text); margin: 0; padding-bottom: 6px; border-bottom: .5px solid var(--border); }
.mag-dealer--bare { border-bottom: none; padding-bottom: 0; }
.mag-lot-title { font-family: var(--mag-display); font-weight: 500; font-size: 18px; line-height: 1.12; margin: 4px 0 0; }
.mag-lot-title a { text-decoration: none; }
.mag-lot-ref { margin: 0; font-size: 13px; line-height: 1.35; color: var(--text2); }
.mag-lot-meta { margin: 1px 0 0; font-family: var(--mag-data); font-size: 10.5px; letter-spacing: .04em; color: var(--text3); }
.mag-lot-price { margin: 6px 0 0; font-family: var(--mag-data); font-size: 14px; font-weight: 500;
                 color: var(--brand-olive-text); font-variant-numeric: tabular-nums; }

/* Chronological table, not tiles (Mark, 2026-09-07: "I liked the chronological
   table that was there before rather than tiles, just it all looked too
   small"). Rows keep the reading order a calendar needs; the artwork keeps
   the size the tiles gave it. */
.mag-cal { border-top: .5px solid var(--border); }
.mag-cal-row { display: grid; grid-template-columns: 190px 170px minmax(0,1fr) auto;
               gap: 10px 30px; align-items: center; padding: 22px 0;
               border-bottom: .5px solid var(--border); text-decoration: none; }
.mag-cal-row:hover .mag-cal-title { color: var(--brand-olive-text); }
.mag-cal-art { width: 190px; height: 190px; overflow: hidden; background: var(--card-bg);
               display: flex; align-items: center; justify-content: center; }
.mag-cal-mark { font-family: var(--mag-display); font-size: 46px; color: var(--text3); letter-spacing: .03em; }
.mag-cal-house { font-family: var(--mag-data); font-size: 11.5px; letter-spacing: .16em;
                 text-transform: uppercase; color: var(--brand-olive-text); }
.mag-cal-title { font-family: var(--mag-display); font-weight: 500;
                 font-size: clamp(20px,2.3vw,27px); line-height: 1.12; display: block; }
.mag-cal-place { font-size: 14.5px; color: var(--text2); margin-top: 5px; display: block; }
.mag-cal-when { font-family: var(--mag-data); font-size: 14px; color: var(--text1);
                text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.mag-live { display: inline-block; margin-left: 8px; font-size: 10.5px; letter-spacing: .1em;
            text-transform: uppercase; color: var(--brand-olive-text);
            border: .5px solid var(--brand-olive-text); border-radius: 999px; padding: 2px 7px; }

@media (max-width: 820px) {
  /* Everything to the RIGHT of the picture (Mark, 2026-09-07). The date used
     to drop to a line of its own under the thumbnail, which read as a broken
     row rather than a calendar entry. */
  .mag-cal-row { grid-template-columns: 116px minmax(0,1fr); align-items: start;
                 gap: 4px 16px; padding: 16px 0; }
  .mag-cal-art { width: 116px; height: 116px; grid-row: span 3; }
  .mag-cal-house, .mag-cal-when { grid-column: 2; }
  .mag-cal-when { text-align: left; margin-top: 6px; }
  .mag-cal-title { font-size: 19px; }
  .mag-cal-place { font-size: 13px; margin-top: 3px; }
}
@media (max-width: 900px) { .mag-bar .mag-searchwrap { max-width: none; } }
@media (max-width: 860px) { .mag-pick { grid-template-columns: minmax(0,1fr); } }
@media (max-width: 700px) {
  .mag-cover { aspect-ratio: auto; overflow: visible; background: transparent; }
  .mag-cover::after { display: none; }
  .mag-cover-pic { position: relative; inset: auto; aspect-ratio: 4/3; overflow: hidden; background: var(--card-bg); display: block; }
  .mag-cover-lines { position: static; padding: 14px 0 0; gap: 8px; background: none; }
  .mag-kicker { color: var(--brand-olive-text); }
  .mag-cover-head { color: var(--text1); font-size: 27px; max-width: none; }
  .mag-cover-stand { color: var(--text2); max-width: none; }
  .mag-cover-lines .mag-stamp { color: var(--text3); }
  .mag-dots { right: 12px; bottom: 12px; }
}
@media (max-width: 620px) {
  .mag-bar-link { display: none; }
}
@media (prefers-reduced-motion: reduce) { .mag * { transition: none !important; } }
`;
