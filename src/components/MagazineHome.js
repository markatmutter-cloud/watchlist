// MagazineHome — the landing page.
//
// Built as a parallel page behind `?view=magazine` on 2026-09-07 and promoted
// to the default the same week, after Mark used it daily and signed it off.
// HomeTab, the page it replaced, was retired at the same time; its footer
// moved to SiteFooter.js so nothing here depends on a deleted component.
//
// It reads the props Home has always received: the same listings, articles,
// auctions and counts, with no separate fetch.
//
// Two deliberate departures, both scoped to this component:
//  - Three faces (Bodoni Moda / Archivo / IBM Plex Mono) loaded on mount, so
//    the rest of the app's font payload is unchanged. This is the one place
//    DESIGN_SYSTEM's "no new typefaces" rule is set aside, on purpose.
//  - One <style> block rather than inline styles. Media queries, hover, the
//    cover gradient and ::placeholder can't be expressed inline; CardStrip
//    already sets the precedent for a component injecting its own rule.
//    Everything is namespaced `mag-` and every colour comes from the app's
//    own :root tokens, so dark mode needs no second palette.

import React, { useEffect, useMemo, useRef, useState } from "react";
import MagazineChrome, { MAG_CSS } from "./MagazineChrome";
import { imgSrc, fmt, priceIn, CURRENCY_SYM, fmtSaleDateRange } from "../utils";
import { FooterBand } from "./SiteFooter";
import { articleAsListing, sourceLabel } from "./EditorialView";

// A lot closing further out than this isn't "next" in any useful sense.
const CAL_HORIZON_DAYS = 60;
const CAL_MAX = 8;
const ROTATOR_COUNT = 5;
const DEALER_MAX = 12;

// Signed out there are no hearts to rank by, and ranking on "who happened to
// list this week" is arbitrary. This is Mark's own order, taken from his 570
// saved watches with the auction houses removed, so a stranger sees the
// dealers the site actually rates rather than a scrape artefact. Any name
// that isn't currently a source is skipped, so a retired dealer drops out on
// its own (Mark, 2026-09-07).
const SEEDED_DEALERS = [
  "Wind Vintage", "Tropical Watch", "Hodinkee Shop", "Bulang & Sons",
  "Moonphase", "Grey & Patina", "Falco Watches", "Collectors Corner NY",
  "Oliver & Clarke", "Shuck the Oyster", "Watchfid", "Somlo",
  "MVV Watches", "Menta Watches", "Analog Shift", "Craft & Tailored",
];

// Fill the row, don't leave a ragged tail. Mark: "I'd still like the width to
// define the number of articles shown ... then if I hide an article the next
// oldest adds to the screen." CSS can't tell you how many columns auto-fill
// produced, so measure the resolved template and round the slice down to a
// whole number of rows. Re-measures on resize; when an item disappears the
// next one moves up on its own because the list is just re-sliced.
function useWholeRows(ref, total, maxRows) {
  const [cols, setCols] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return undefined;
    const measure = () => {
      const t = window.getComputedStyle(el).gridTemplateColumns;
      const n = t && t !== "none" ? t.split(" ").filter(Boolean).length : 0;
      setCols((prev) => (prev === n ? prev : n));
    };
    measure();
    const RO = window.ResizeObserver;
    if (RO) { const ro = new RO(measure); ro.observe(el); return () => ro.disconnect(); }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ref, total]);
  if (!cols) return total;
  const rows = Math.max(1, Math.min(maxRows, Math.floor(total / cols)));
  return Math.min(total, rows * cols);
}

// A white cut-out on a near-white page has no edge, and most dealer product
// shots are exactly that, so the featured slot kept landing on a watch that
// floated (Mark, 2026-09-07). We can't know a photo's background without
// looking at it, so look: pull a 24px thumbnail of the top candidates through
// the same wsrv proxy the page already uses (it sends CORS headers, so the
// canvas isn't tainted) and measure how white the border pixels are. Four
// tiny requests, off the critical path, and the pick upgrades when they land.
function edgeWhiteness(src) {
  return new Promise((resolve) => {
    if (typeof document === "undefined") { resolve(1); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const n = 24;
        const c = document.createElement("canvas");
        c.width = n; c.height = n;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, n, n);
        const d = ctx.getImageData(0, 0, n, n).data;
        let white = 0, total = 0;
        const at = (x, y) => { const i = (y * n + x) * 4; return d[i] > 232 && d[i + 1] > 232 && d[i + 2] > 232; };
        for (let x = 0; x < n; x++) { [0, n - 1].forEach((y) => { total++; if (at(x, y)) white++; }); }
        for (let y = 1; y < n - 1; y++) { [0, n - 1].forEach((x) => { total++; if (at(x, y)) white++; }); }
        resolve(total ? white / total : 1);
      } catch { resolve(1); }
    };
    img.onerror = () => resolve(1);
    img.src = src;
  });
}

// Same price rule as Card's dealer branch: show native when it matches the
// user's primary currency, otherwise convert via priceUSD, and only fall back
// to native when there's no bridge. Getting this wrong is the "CHF doesn't
// convert 1:1 to USD" bug from May 2026.
function money(item, primaryCurrency) {
  if (!item) return "";
  if (item.priceOnRequest) return "Price on request";
  const itemCurrency = item.currency || "USD";
  if (itemCurrency === primaryCurrency) return fmt(item.price, primaryCurrency);
  const converted = priceIn(item, primaryCurrency);
  if (converted == null) return fmt(item.price, itemCurrency);
  return `${CURRENCY_SYM[primaryCurrency] || ""}${Math.round(converted).toLocaleString()}`;
}

function refLine(item) {
  const bits = [];
  if (item.reference_id) bits.push(`Ref. ${item.reference_id}`);
  if (item.model_line) bits.push(item.model_line);
  return bits.join(" · ");
}

// Sale cover if the house publishes one, else the sale's top lot, else a
// monogram. Never another sale's picture: a borrowed photo next to this
// sale's date is a small lie.
// Dealer marks come from the dealer's own favicon, resolved from a URL we
// already hold for them. No logo files to collect and nothing to maintain: a
// dealer we scrape is a dealer we can show. Falls back to the name alone.
function faviconFor(url) {
  try { return `https://icons.duckduckgo.com/ip3/${new URL(url).hostname.replace(/^www\./, "")}.ico`; }
  catch { return null; }
}

// Mark's hot list, computed from his own hearts rather than a static ranking:
// "are you able to see my most hearted items and which dealers they are from".
// Signed out there are no hearts, so fall back to who is listing right now,
// which is at least true rather than a guess at taste.
function topDealers(watchlist, fallbackItems, exclude, known) {
  const tally = new Map();
  const seenUrl = new Map();
  const skip = new Set(exclude || []);
  const add = (source, url) => {
    // Auction houses are not dealers and their listings live behind the
    // Auctions sub-tab, so a chip that filters "For sale" by Phillips returns
    // nothing (Mark, 2026-09-07).
    if (!source || skip.has(source)) return;
    tally.set(source, (tally.get(source) || 0) + 1);
    if (url && !seenUrl.has(source)) seenUrl.set(source, url);
  };
  const hearted = watchlist ? Object.values(watchlist) : [];
  hearted.forEach((it) => add(it && it.source, it && it.url));

  // Any hearts at all beat the seed: three saved dealers is still this
  // person's taste, where the seed is only ever a stand-in for not knowing it.
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 0) {
    return ranked.slice(0, DEALER_MAX)
      .map(([name, n]) => ({ name, n, icon: faviconFor(seenUrl.get(name)) }));
  }

  // No hearts: fall back to the seeded order, keeping only names that are
  // still live sources, then top up from whoever is listing now.
  const live = new Set((fallbackItems || []).map((i) => i && i.source).filter(Boolean));
  const urlFor = new Map();
  (fallbackItems || []).forEach((i) => { if (i && i.source && i.url && !urlFor.has(i.source)) urlFor.set(i.source, i.url); });
  const sources = known && known.length ? new Set(known) : null;
  const out = [];
  const push = (name) => {
    if (!name || skip.has(name) || out.some((d) => d.name === name)) return;
    out.push({ name, n: 0, icon: faviconFor(urlFor.get(name) || seenUrl.get(name)) });
  };
  SEEDED_DEALERS.forEach((name) => {
    if (out.length >= DEALER_MAX) return;
    if (sources ? sources.has(name) : live.has(name)) push(name);
  });
  (fallbackItems || []).forEach((i) => { if (out.length < DEALER_MAX) push(i && i.source); });
  return out;
}

function saleArt(sale, heroes) {
  if (!sale) return null;
  return sale.image || (heroes && heroes[sale.url]) || null;
}

function initials(house) {
  const parts = String(house || "").split(/[^A-Za-z]+/).filter((p) => p.length > 1);
  if (!parts.length) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts.slice(0, 2).map((p) => p[0]).join("")).toUpperCase();
}

function articleSource(a) {
  if (!a) return "";
  // sourceLabel first: a caller may attach `_source.label` that is really the
  // corpus key, which is exactly how "rolex_magazine" reached the page.
  return sourceLabel(a.source)
    || (a._source && (a._source.publication || a._source.label))
    || "";
}

function fmtDate(iso, opts) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, opts || { day: "numeric", month: "long", year: "numeric" });
}

// The featured watch is picked on how much we can SAY about it, not on how
// new it is (Mark, 2026-09-07: "the one with the best new content and image,
// not necessarily the very latest"). Reference intelligence is the thing
// Watchlist knows that the dealer's own page doesn't say out loud, so an item
// we can caption properly beats a bare one that landed an hour later.
function featureScore(i) {
  return (i.reference_id ? 2 : 0) +
    (i.model_line ? 2 : 0) +
    (i.brand && i.brand !== "Other" ? 1 : 0) +
    (i.priceUSD ? 1 : 0);
}

function featureCandidates(items) {
  return (items || [])
    .filter((i) => i && i.img && i.ref)
    .slice()
    .sort((a, b) => featureScore(b) - featureScore(a) || (b.priceUSD || 0) - (a.priceUSD || 0));
}

// Metadata picks the shortlist; the photograph picks the winner. A candidate
// whose border is more than 70% white loses to one that isn't, and within
// each group the metadata order stands.
function useFeature(items) {
  const candidates = useMemo(() => featureCandidates(items), [items]);
  const [best, setBest] = useState(null);
  useEffect(() => {
    let dead = false;
    setBest(null);
    const shortlist = candidates.slice(0, 4);
    if (!shortlist.length) return undefined;
    Promise.all(shortlist.map((i) => edgeWhiteness(imgSrc(i.img, 24)).then((w) => ({ i, w }))))
      .then((scored) => {
        if (dead) return;
        const good = scored.filter((s) => s.w <= 0.7);
        setBest((good.length ? good : scored)[0].i);
      })
      .catch(() => {});
    return () => { dead = true; };
  }, [candidates]);
  return best || candidates[0] || null;
}

function Rotator({ articles, isAdmin, onHide }) {
  const [at, setAt] = useState(0);
  const timer = useRef(null);
  const slides = articles.slice(0, ROTATOR_COUNT);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    if (calm && calm.matches) return undefined;
    timer.current = setInterval(() => setAt((n) => (n + 1) % slides.length), 7000);
    return () => clearInterval(timer.current);
  }, [slides.length]);

  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  if (!slides.length) return null;
  const a = slides[at];

  return (
    <div className="mag-rot" onMouseEnter={stop} onFocus={stop}>
      <div className="mag-cover">
        <span className="mag-cover-pic">
          {a.image ? <img src={imgSrc(a.image, 1200)} alt="" /> : null}
          {slides.length > 1 && (
            <span className="mag-dots">
              {slides.map((s, i) => (
                <button key={s.url || i} type="button" className="mag-dot"
                  aria-current={i === at ? "true" : "false"}
                  aria-label={`Show story ${i + 1} of ${slides.length}`}
                  onClick={() => { stop(); setAt(i); }} />
              ))}
            </span>
          )}
        </span>
        {isAdmin && onHide ? (
          <button type="button" className="mag-hide" title="Hide from Home"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onHide(a); }}>
            &times;
          </button>
        ) : null}
        <div className="mag-cover-lines">
          <p className="mag-kicker">{articleSource(a)}</p>
          <h3 className="mag-cover-head">
            <a href={a.url} target="_blank" rel="noopener noreferrer">{a.title}</a>
          </h3>
          {a.excerpt ? <p className="mag-cover-stand">{a.excerpt}</p> : null}
          <p className="mag-stamp">{fmtDate(a.published_at)}</p>
        </div>
      </div>
    </div>
  );
}

function SectionHeadBtn({ title, onClick, cta }) {
  return (
    <div className="mag-sec-head">
      <h2 className="mag-sec-title">{title}</h2>
      {onClick ? <button type="button" className="mag-viewall" onClick={onClick}>{cta} <span aria-hidden>&rarr;</span></button> : null}
    </div>
  );
}

export default function MagazineHome(props) {
  const {
    homeRecentAdded, homeRecentArticles, homeEndingNext,
    homeAuctionSales, homeSectionCounts,
    goToRecentAdded, goToArticles, homeOpenCalendar, homeOpenSale,
    onClickListing, primaryCurrency, isMobile, user, dark, cols,
    homeMastheadTabs, homeSearchSubmit, watchlist, homeJumpToDealer, homeAuctionSources,
    homeDealerSources,
    goToSavedHearts,
    homeSearchLiveQuery, homeSearchCounts, homeRecentSearches, homeAddRecentSearch,
    homeSavedSearches, homeRunSavedSearch, homeRemoveSavedSearch,
    homeAuctionHeroes, toggleHide, isAdmin, openAbout, signInWithGoogle, homeMastheadAuthJSX,
  } = props;

  const counts = homeSectionCounts || {};

  const articles = useMemo(() => (homeRecentArticles || []).filter((a) => a && a.title && a.image), [homeRecentArticles]);
  const feature = useFeature(homeRecentAdded);
  const grid = useMemo(
    () => (homeRecentAdded || []).filter((i) => i && i.img && (!feature || i.id !== feature.id)).slice(0, 12),
    [homeRecentAdded, feature]
  );
  const sales = useMemo(() => {
    const now = Date.now();
    const horizon = now + CAL_HORIZON_DAYS * 86400000;
    const dated = (homeAuctionSales || [])
      .filter((s) => s && (s.status === "live" || s.status === "upcoming"))
      .map((s) => ({ sale: s, ends: Date.parse(s.dateEnd || s.dateStart || "") }))
      .filter((x) => !Number.isNaN(x.ends) && x.ends >= now && x.ends <= horizon)
      .sort((a, b) => a.ends - b.ends);
    // One row per house first, so the block reads as a spread of the trade
    // rather than four rows from whoever runs a weekly sale.
    const seen = new Set();
    const out = [];
    dated.forEach(({ sale }) => {
      if (out.length >= CAL_MAX || seen.has(sale.house)) return;
      seen.add(sale.house); out.push(sale);
    });
    dated.forEach(({ sale }) => { if (out.length < CAL_MAX && !out.includes(sale)) out.push(sale); });
    return out;
  }, [homeAuctionSales]);

  const dealers = useMemo(() => topDealers(watchlist, homeRecentAdded, homeAuctionSources, homeDealerSources),
    [watchlist, homeRecentAdded, homeAuctionSources, homeDealerSources]);

  const cardsRef = useRef(null);
  const catRef = useRef(null);
  // Two rows each, always whole (Mark, 2026-09-07). At two columns that is
  // four stories under the rotator and four watches under the featured one;
  // at three it is six and six. The count follows the Columns setting rather
  // than being fixed, so the page stays the same shape at any width.
  const articleRows = useWholeRows(cardsRef, articles.length, 2);
  const listingRows = useWholeRows(catRef, grid.length, 2);

  const initial = String((user && ((user.user_metadata && user.user_metadata.full_name) || user.email)) || "")
    .trim().charAt(0).toUpperCase() || "\u2022";

  const hideArticle = (a) => {
    const projected = articleAsListing(a);
    if (projected && toggleHide) toggleHide(projected);
  };

  const tile = (i) => (
    <article className="mag-lot" key={i.id || i.url}>
      <a className="mag-lot-img" href={i.url} target="_blank" rel="noopener noreferrer"
         onClick={() => onClickListing && onClickListing(i)}>
        <img src={imgSrc(i.img, 480)} alt="" loading="lazy" />
        {isAdmin && toggleHide ? (
          <button type="button" className="mag-hide mag-hide--tile" title="Hide from Home"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleHide(i); }}>
            &times;
          </button>
        ) : null}
      </a>
      <div className="mag-lot-body">
        <p className="mag-dealer">{i.source}</p>
        <h3 className="mag-lot-title">
          <a href={i.url} target="_blank" rel="noopener noreferrer" onClick={() => onClickListing && onClickListing(i)}>{i.brand}</a>
        </h3>
        <p className="mag-lot-ref">{i.ref}</p>
        {refLine(i) ? <p className="mag-lot-meta">{refLine(i)}</p> : null}
        <p className="mag-lot-price">{money(i, primaryCurrency)}</p>
      </div>
    </article>
  );

  // The app already has a Columns control (Settings: Auto / 3-7, plus the
  // mobile 1-3). The magazine was ignoring it and sizing off a fixed tile
  // width instead, which is why it sat at four columns whatever you chose.
  // One source of truth: use the resolved count, and only fall back to the
  // fluid tile when a caller hasn't supplied one.
  const gridCols = Number.isFinite(cols) && cols > 0 ? cols : null;

  return (
    <div className="mag" style={gridCols ? { "--mag-cols": gridCols } : undefined}>
      <style>{MAG_CSS}</style>

      <MagazineChrome
        isMobile={isMobile}
        tabs={homeMastheadTabs}
        authJSX={homeMastheadAuthJSX}
        showSaved={!!user}
        onSavedClick={goToSavedHearts}
        onSearchSubmit={homeSearchSubmit}
        onSearchLiveQuery={homeSearchLiveQuery}
        searchCounts={homeSearchCounts}
        recentSearches={homeRecentSearches}
        addRecentSearch={homeAddRecentSearch}
        savedSearches={homeSavedSearches}
        onRunSavedSearch={homeRunSavedSearch}
        onRemoveSavedSearch={homeRemoveSavedSearch}
      />

      {articles.length > 0 && (
        <section className="mag-sec mag-sec--first">
          <SectionHeadBtn title="Recent Articles" onClick={goToArticles} cta="All articles" />
          <Rotator articles={articles} isAdmin={isAdmin} onHide={hideArticle} />
          <div className="mag-cards" ref={cardsRef}>
            {articles.slice(0, articleRows).map((a) => (
              <article className="mag-card" key={a.url}>
                <a className="mag-card-img" href={a.url} target="_blank" rel="noopener noreferrer">
                  <img src={imgSrc(a.image, 520)} alt="" loading="lazy" />
                  {isAdmin ? (
                    <button type="button" className="mag-hide mag-hide--tile" title="Hide from Home"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); hideArticle(a); }}>
                      &times;
                    </button>
                  ) : null}
                </a>
                <p className="mag-kicker mag-kicker--card">{articleSource(a)}</p>
                <h3 className="mag-card-head">
                  <a href={a.url} target="_blank" rel="noopener noreferrer">{a.title}</a>
                </h3>
                {a.excerpt ? <p className="mag-card-stand">{a.excerpt}</p> : null}
                <p className="mag-stamp">{fmtDate(a.published_at, { day: "numeric", month: "short" })}</p>
              </article>
            ))}
          </div>
          {/* Mirrors the listings section: a way out at the foot of the grid
              as well as at the head, so you don't have to scroll back up. */}
          <div className="mag-sec-foot">
            <button type="button" className="mag-viewall" onClick={goToArticles}>
              View all articles <span aria-hidden>&rarr;</span>
            </button>
          </div>
        </section>
      )}

      {(feature || grid.length > 0) && (
        <section className="mag-sec">
          <SectionHeadBtn title="New Listings This Week" onClick={goToRecentAdded} cta="All watches" />
          {dealers.length > 0 && homeJumpToDealer && (
            <div className="mag-dealers-band">
              <div className="mag-dealers-inner">
                <p className="mag-dealers-label">{user ? "Your dealers" : "Dealers we follow"}</p>
                <div className="mag-dealers">
                  {dealers.map((d) => (
                    <button key={d.name} type="button" className="mag-dealer-chip"
                            onClick={() => homeJumpToDealer(d.name)} title={`${d.n} saved from ${d.name}`}>
                      {d.icon ? (
                        <img src={d.icon} alt="" loading="lazy"
                             onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      ) : null}
                      <span>{d.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* A band behind the featured watch: dealer product shots are shot
              on white, so on a near-white page the watch floated with no edge
              (Mark, 2026-09-07). The band gives it a ground to sit on. */}
          {feature && (
            <div className="mag-pick-band">
            <div className="mag-pick">
              <a className="mag-pick-img" href={feature.url} target="_blank" rel="noopener noreferrer"
                 onClick={() => onClickListing && onClickListing(feature)}>
                <img src={imgSrc(feature.img, 900)} alt="" />
                {isAdmin && toggleHide ? (
                  <button type="button" className="mag-hide" title="Hide from Home"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleHide(feature); }}>
                    &times;
                  </button>
                ) : null}
              </a>
              <div className="mag-pick-body">
                <p className="mag-dealer mag-dealer--bare">{feature.source}</p>
                <h3 className="mag-pick-brand">
                  <a href={feature.url} target="_blank" rel="noopener noreferrer">{feature.brand}</a>
                </h3>
                <p className="mag-pick-ref">{feature.ref}</p>
                {refLine(feature) ? <p className="mag-lot-meta">{refLine(feature)}</p> : null}
                <p className="mag-pick-price">{money(feature, primaryCurrency)}</p>
              </div>
            </div>
            </div>
          )}
          <div className="mag-cat" ref={catRef}>{grid.slice(0, listingRows).map(tile)}</div>
          <div className="mag-sec-foot">
            <button type="button" className="mag-viewall" onClick={goToRecentAdded}>
              See all new listings <span aria-hidden>&rarr;</span>
            </button>
          </div>
        </section>
      )}

      {sales.length > 0 && (
        <section className="mag-sec">
          <SectionHeadBtn title="Auction Calendar" onClick={homeOpenCalendar} cta="Full calendar" />
          <div className="mag-cal">
            {sales.map((s) => (
              <a className="mag-cal-row" key={s.id || s.url} href={s.url} target="_blank" rel="noopener noreferrer"
                 onClick={(e) => { if (homeOpenSale) { e.preventDefault(); homeOpenSale(s); } }}>
                <span className="mag-cal-art">
                  {saleArt(s, homeAuctionHeroes)
                    ? <img src={imgSrc(saleArt(s, homeAuctionHeroes), 320)} alt="" loading="lazy" />
                    : <span className="mag-cal-mark">{initials(s.house)}</span>}
                </span>
                <span className="mag-cal-house">{s.house}</span>
                <span>
                  <span className="mag-cal-title">{s.title}</span>
                  {s.location ? <span className="mag-cal-place">{s.location}</span> : null}
                </span>
                <span className="mag-cal-when">
                  {fmtSaleDateRange(s)}
                  {s.status === "live" ? <span className="mag-live">Bidding open</span> : null}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* The site's own footer, not a second one invented for this page. */}
      <FooterBand openAbout={openAbout} signInWithGoogle={signInWithGoogle} user={user} />
    </div>
  );
}
