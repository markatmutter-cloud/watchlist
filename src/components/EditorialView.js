import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { editorialTitle, cardGridStyle } from "../styles";
import { Pill, Chip, ChipPanel, SavedPill, SearchField, FilterBar, PageFrame, HeaderSearch } from "../ui";
import { shortHash, imgSrc, fetchJsonCached } from "../utils";
import { HeartIcon } from "./icons";

// Map an editorial article record into the listing-shaped item that
// useWatchlist / watchlist_items expects. The `kind: 'article'`
// marker on the snapshot is what downstream surfaces (Watchlists
// Saved sub-tabs, the Saved-articles virtual row, future sold-state
// inference) branch on. Listing-style toggling reuses the existing
// `toggleWatchlist` path so we don't fork the heart primitive.
// Publication label for a corpus key. SOURCES is the one place these names
// live; without a lookup, surfaces fall back to the raw key and a reader sees
// "ROLEX_MAGAZINE" on the page (Mark, 2026-09-07).
export function sourceLabel(key) {
  if (!key) return "";
  const hit = SOURCES.find((s) => s.key === key);
  if (hit) return hit.publication || hit.label || key;
  return String(key).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function articleAsListing(article) {
  if (!article || !article.url) return null;
  const sourceMeta = article._source || {};
  return {
    id: shortHash(article.url),
    url: article.url,
    img: article.image || null,
    ref: article.title || "",
    title: article.title || "",
    brand: article.brand || "",
    model: article.model || null,
    model_line: article.model_line || null,
    reference_no: article.reference_no || null,
    // kind marker — downstream code uses this to discriminate
    // article entries from real listings in shared watchlist_items.
    kind: "article",
    article: {
      author: article.author || "",
      published_at: article.published_at || "",
      excerpt: article.excerpt || "",
      source_key: sourceMeta.key || article.source || "",
      source_label: sourceMeta.label || sourceMeta.publication || "",
    },
    // Suppress the sold/active flow — articles never go sold.
    sold: false,
    price: null,
    currency: null,
  };
}

// Editorial sub-tab — v0 (2026-05-18). Surfaces the saved editorial
// corpus (Hairspring Finds + Hodinkee Bring a Loupe today; more sources
// land here as their scrapers ship). Cards are READ-ONLY links out to
// the original article — we never re-host content, only surface our
// own metadata + an excerpt to drive discovery to the publisher.
//
// Filter row deliberately mirrors the Listings / Watchlists shape
// (Mark spec 2026-05-18): single horizontal pill strip with Date sort
// toggle + Source pill + Brand pill, inline-expansion panels below the
// strip for the chip cluster, article count right-aligned, "× Clear
// all" link when any filter fires. Search lives above the strip as
// its own input (Listings uses the global top-bar search; Editorial
// needs its own field for body-text matching that's distinct from
// listing search).
//
// Phase 2 will add `tags` / `audience` / `references_mentioned` /
// `dates_referenced` to each record via the editorial_index.py
// enrichment script. The component already reads from those fields
// when present — chips for them are simply not rendered until the
// fields exist on the records. So a v1 upgrade is additive (new chip
// groups in the filter rail), not a rewrite.
//
// New sources plug in via a one-line addition to the SOURCES array
// once their JSON lands in public/.

// Per-source manifest. `url` is the metadata file (title / author /
// date / image / brand / etc.) — loaded eagerly on sub-tab open.
// `bodies_url` is the {url: body_text} map — loaded lazily on the
// first search keystroke so the initial render isn't blocked by
// ~14 MB of prose the user may never search.
const SOURCES = [
  {
    key: "hairspring_finds",
    label: "Hairspring Finds",
    publication: "Hairspring",
    column: "Finds",
    url: "/hairspring_finds.json",
    bodies_url: "/hairspring_finds_bodies.json",
  },
  {
    key: "hodinkee_bring_a_loupe",
    label: "Bring a Loupe",
    publication: "Hodinkee",
    column: "Bring a Loupe",
    url: "/bring_a_loupe.json",
    bodies_url: "/bring_a_loupe_bodies.json",
  },
  {
    key: "rolex_magazine",
    label: "Rolex Magazine",
    publication: "Rolex Magazine",
    column: null,
    url: "/rolex_magazine.json",
    bodies_url: "/rolex_magazine_bodies.json",
  },
  {
    key: "onthedash",
    label: "On The Dash",
    publication: "On The Dash",
    column: null,
    url: "/onthedash.json",
    bodies_url: "/onthedash_bodies.json",
  },
  {
    key: "bulang_watch_talks",
    label: "Bulang & Sons Watch Talks",
    publication: "Bulang & Sons",
    column: "Watch Talks",
    url: "/bulang_watch_talks.json",
    bodies_url: "/bulang_watch_talks_bodies.json",
  },
  // Hodinkee Shop deliberately NOT surfaced as an Editorial source
  // (Mark spec 2026-05-19: watch-listings don't belong in the
  // editorial section). The corpus JSON still ships — App.js's
  // hodinkeeShopItems memo projects records into Listings > Sold
  // archive as a dealer source, and the scraped body_text remains
  // available for the future editorial_index.py recommender pass.
  {
    key: "strictlyvintagewatches",
    label: "Strictly Vintage Watches",
    publication: "Strictly Vintage Watches",
    column: null,
    url: "/strictlyvintagewatches.json",
    bodies_url: "/strictlyvintagewatches_bodies.json",
    // Charlie Dunne's collector-scholarship site — Collector's Guides
    // (in-depth single-reference essays, heavily JLC), the long-form
    // "Collectibles of Jaeger-LeCoultre" feature, museum visits,
    // vintage-catalog scans. Mark spec 2026-06-06: prime reference-
    // guide fuel. Shop pages excluded at the scraper's sitemap filter.
    publication_url: "https://www.strictlyvintagewatches.com/",
  },
  {
    key: "le_monde_edmond",
    label: "Le Monde Edmond",
    publication: "Le Monde Edmond",
    column: null,
    url: "/le_monde_edmond.json",
    bodies_url: "/le_monde_edmond_bodies.json",
    // Collector-essay site (Edmond / "Mr. A"), 2012→present. Watch-side
    // categories only — the fine-watches tree + collecting-investing
    // (Mark spec 2026-06-06); the classic-cars tree is excluded at the
    // scraper's category filter. collecting-investing includes some
    // finance-desk posts (markets/M&A) by Mark's explicit category pick.
    publication_url: "https://le-monde-edmond.com/",
  },
  {
    key: "romainrea_editorial",
    label: "Romain Réa",
    publication: "Romain Réa",
    column: null,
    url: "/romainrea_editorial.json",
    bodies_url: "/romainrea_editorial_bodies.json",
    // Paris dealer (also scraped at listing level). Two Shopify blogs
    // (Expert Files + Dating) folded into one source; video/dead-PDF
    // stub posts are dropped at scrape time (<100 words), so the
    // corpus carries only the real essays (~16 of 31 posts).
    publication_url: "https://romainrea.com/en-int",
  },
  {
    key: "hodinkee_reference_points",
    label: "Reference Points",
    publication: "Hodinkee",
    column: "Reference Points",
    url: "/hodinkee_reference_points.json",
    bodies_url: "/hodinkee_reference_points_bodies.json",
  },
  {
    key: "hodinkee_picks",
    label: "Hodinkee Picks",
    publication: "Hodinkee",
    column: "Picks",
    url: "/hodinkee_picks.json",
    bodies_url: "/hodinkee_picks_bodies.json",
    // Curated URL list at data/hodinkee_picks_urls.json. Hodinkee mostly
    // covers new-watch content; this source captures the OCCASIONAL
    // vintage-relevant general /articles/... piece Mark hand-adds.
    // Complement to Bring a Loupe + Reference Points which target
    // specific Hodinkee columns. Pattern mirrors Christie's Stories.
    publication_url: "https://www.hodinkee.com/",
  },
  {
    key: "acollectedman_journal",
    label: "A Collected Man",
    publication: "A Collected Man",
    column: "Journal",
    url: "/acollectedman_journal.json",
    bodies_url: "/acollectedman_journal_bodies.json",
  },
  {
    key: "woe_dispatch",
    label: "WOE Dispatch",
    publication: "Watches of Espionage",
    column: "Dispatch",
    url: "/woe_dispatch.json",
    bodies_url: "/woe_dispatch_bodies.json",
  },
  {
    key: "screwdowncrown",
    label: "Screw Down Crown",
    publication: "Screw Down Crown",
    column: null,
    url: "/screwdowncrown.json",
    bodies_url: "/screwdowncrown_bodies.json",
    // Subscription publication on Substack. Every post since 2019 is
    // link-discoverable in the corpus; paid records carry `is_paid:
    // true` and ship only the public preview body (Substack handles
    // the paywall on click-through). `subscribe_url` amplifies the
    // publisher; consumers can render a "Subscribe to <publication>"
    // CTA when this source is filtered on.
    publication_url: "https://www.screwdowncrown.com/",
    subscribe_url: "https://www.screwdowncrown.com/subscribe",
  },
  {
    key: "watchfid_editorial",
    label: "Watchfid",
    publication: "Watchfid",
    column: null,
    url: "/watchfid_editorial.json",
    bodies_url: "/watchfid_editorial_bodies.json",
    // The blog half of watchfid.com. Watchfid is ALSO a dealer we scrape
    // for inventory (watchfid_scraper.py → the Listings feed); the two
    // never collide because inventory is a WordPress custom post type at
    // /watch/<slug>/ while articles are ordinary posts at root-level
    // slugs, so /wp-json/wp/v2/posts returns editorial only.
    publication_url: "https://www.watchfid.com/",
  },
  {
    key: "fratello",
    label: "Fratello Watches",
    publication: "Fratello",
    column: null,
    url: "/fratello.json",
    bodies_url: "/fratello_bodies.json",
    // Scrape is brand-allowlist-filtered at ingestion time (Mark spec
    // 2026-05-20). The corpus here is the watch-taste subset of
    // Fratello's full output, not the whole publication — covering
    // Rolex / Omega / TAG / IWC / Casio (G-Shock) / Lange / Longines
    // / Zenith / Breitling, plus the TBT (Throwback Thursday) vintage
    // series and a small collector-philosophy keyword fallback. AP /
    // Hublot / Seiko / sub-$500 / microbrand / gift-guide content is
    // explicitly excluded.
    publication_url: "https://www.fratellowatches.com/",
  },
  {
    key: "christies_stories",
    label: "Christie's Stories",
    publication: "Christie's",
    column: "Stories",
    url: "/christies_stories.json",
    bodies_url: "/christies_stories_bodies.json",
    // Curated URL list at data/christies_stories_urls.json — Christie's
    // stories index is a client-rendered SPA so we can't sitemap-walk.
    // Mark adds URLs by hand as he finds them. A small handful of
    // SPA-only articles fail body extraction (their text lives only in
    // the inline Sitecore JSS JSON, not in the static HTML); a follow-
    // up scraper enhancement could deep-parse the JSS payload for
    // those if Mark wants the count higher.
    publication_url: "https://www.christies.com/en/stories",
  },
];

const BRAND_TOP_N = 24;       // Show top N brands in expansion panel; "+more" expander reveals the rest
const RESULTS_PAGE_SIZE = 40; // 24 → 48 → 100 → 40 (2026-05-22). 100 was making Editorial slow to load (Mark report). Dropping to 40 cuts initial-paint card count 60%; Load more button picks up the rest in 40-card chunks. Body-text search is unaffected (it operates on the full corpus, not the visible page).
const FEATURED_COUNT = 8;     // Most-recent articles surfaced in the hero strip (visible only when no search / no filters active).

export function EditorialView({ isMobile, cols, compact, gridStyle, watchlist, handleWish, openCollectionPicker, handleShare, search: searchProp, setSearch: setSearchProp,
  // Admin article curation (Mark 2026-06-06): adminHidden is the global
  // admin_hidden_listings id-set (article ids = shortHash(url), same id
  // space articleAsListing uses); onAdminRemoveArticle toggles an article
  // into it via the card's ⋯ menu. Both optional — signed-out and
  // non-admin sessions just never see the menu item.
  isAdmin, adminHidden, onAdminRemoveArticle }) {
  // cols / compact / gridStyle come from App.js's useViewSettings — the
  // same grid sizing the Listings tab uses. ArticleCard adapts its
  // typography + excerpt density to `compact` so a 7-col packed grid
  // still reads cleanly.
  // PR 2026-05-22 magazine redesign: cap at 3 cols on desktop, 1 col
  // on mobile (Vogue/Hodinkee pattern). The site-wide useViewSettings
  // grid can go denser for the Listings feed where small tiles work;
  // Editorial intentionally stays sparser so the serif title + image
  // breathe. The shared gridStyle prop is ignored here in favour of
  // an editorial-specific grid with real gaps (no hairline background).
  // Standard-library card grid (Mark 2026-06-02): article cards now render at
  // the SAME size as reference-guide + list cards (was a sparser fixed 3-col).
  const articleGridStyle = cardGridStyle({ isMobile });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [articles, setArticles] = useState([]);

  // Bodies map (url → body_text). Loaded LAZILY — first user
  // keystroke in the search box triggers the fetch. Until then the
  // search box still works on title + author; body match kicks in
  // once the bodies arrive.
  const [bodies, setBodies] = useState(null); // null = not requested yet
  const [bodiesLoading, setBodiesLoading] = useState(false);

  // Search state may come from the parent (App.js's global search,
  // shared with the top-bar input on Collecting per Mark spec
  // 2026-05-21) OR fall back to local state when no controlled
  // search is wired (e.g. test fixtures or other mount points).
  // The controlled path is what production uses — Editorial search
  // travels across tabs as a single source of truth.
  const [localSearch, setLocalSearch] = useState("");
  const search = searchProp !== undefined ? searchProp : localSearch;
  const setSearch = setSearchProp || setLocalSearch;
  const [activeSources, setActiveSources] = useState([]); // [] = all
  const [activeBrands, setActiveBrands] = useState([]);    // [] = all
  // Hearted-only filter (PR_P, 2026-05-20). Mirrors the Listings
  // Hearted toggle. Off by default; tap to scope the visible set
  // to just articles the current user has hearted.
  const [heartedOnly, setHeartedOnly] = useState(false);
  // Sort is DERIVED, not user-facing (P-12, 2026-06-03): the Date ↓/↑ pill
  // "didn't do anything" visible and cost a row on mobile — removed. A typed
  // query sorts by relevance; otherwise newest-first. (The old cycleSort /
  // sortLabel pill machinery went with it.)
  const sort = (search || "").trim() ? "relevance" : "date_desc";
  // Inline-expansion popover state — same shape as Listings filter row.
  // null | "source" | "brand". Tapping the active pill closes it; tapping
  // a different pill switches.
  const [activeFilterPop, setActiveFilterPop] = useState(null);
  const [brandsExpanded, setBrandsExpanded] = useState(false);
  const [pageSize, setPageSize] = useState(RESULTS_PAGE_SIZE);

  // Eager fetch of metadata only on first mount — small (~5 MB total
  // across all sources) so this lands well inside a second on broadband.
  // The bigger bodies files defer until the user actually searches.
  useEffect(() => {
    let alive = true;
    // fetchJsonCached: dedupes against the Home strip + Search-all
    // loaders, which pull the same corpus meta (PageSpeed 2026-06-06).
    Promise.all(SOURCES.map(s =>
      fetchJsonCached(s.url).catch(() => ({}))
    )).then(results => {
      if (!alive) return;
      const flat = [];
      results.forEach((data, i) => {
        const source = SOURCES[i];
        Object.values(data || {}).forEach(rec => {
          if (rec && rec.url && rec.title) {
            flat.push({ ...rec, _source: source });
          }
        });
      });
      setArticles(flat);
      setLoading(false);
    }).catch(() => {
      if (alive) {
        setLoadError(true);
        setLoading(false);
      }
    });
    return () => { alive = false; };
  }, []);

  // Lazy bodies fetch — kicks off on the first search keystroke and
  // runs once per session. Title + author search works before bodies
  // arrive; body match enables silently as soon as the fetch lands.
  useEffect(() => {
    if (!search.trim()) return;
    if (bodies !== null || bodiesLoading) return;
    setBodiesLoading(true);
    let alive = true;
    Promise.all(SOURCES.map(s =>
      fetchJsonCached(s.bodies_url).catch(() => ({}))
    )).then(results => {
      if (!alive) return;
      const merged = {};
      results.forEach(data => {
        Object.entries(data || {}).forEach(([url, body]) => {
          if (body) merged[url] = body;
        });
      });
      setBodies(merged);
      setBodiesLoading(false);
    }).catch(() => {
      if (alive) {
        setBodies({});
        setBodiesLoading(false);
      }
    });
    return () => { alive = false; };
  }, [search, bodies, bodiesLoading]);

  // Admin-removed articles drop out for EVERYONE here — the one choke
  // point feeding counts, brand options, the filter block, and the
  // featured strip (Mark 2026-06-06; same global-curation semantics as
  // the listings feeds' adminHidden filter in App.js).
  const visibleArticles = useMemo(() => {
    if (!adminHidden || adminHidden.size === 0) return articles;
    return articles.filter(a => !adminHidden.has(shortHash(a.url)));
  }, [articles, adminHidden]);

  // Source counts (for the expansion-panel chip count badges).
  const sourceCounts = useMemo(() => {
    const out = {};
    visibleArticles.forEach(a => { out[a._source.key] = (out[a._source.key] || 0) + 1; });
    return out;
  }, [visibleArticles]);

  // Brand list from the corpus, ordered by frequency.
  const brandOptions = useMemo(() => {
    const counts = {};
    visibleArticles.forEach(a => {
      const b = (a.brand || "").trim();
      if (b) counts[b] = (counts[b] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([brand, count]) => ({ brand, count }));
  }, [visibleArticles]);

  // Apply filters + sort. Free-text search hits title + author always;
  // body match enables silently once the lazy bodies fetch lands. Until
  // then a search like "Railmaster" matches whichever articles name the
  // term in their title — once bodies arrive the same query expands to
  // include every article whose prose mentions it, no re-type needed.
  //
  // Relevance scoring (when sort === "relevance" + non-empty query):
  // weighted hits across title (10x) / author (5x) / body (1x per
  // occurrence, capped at 10 per term) + small recency tiebreaker.
  // Exact-title and title-contains matches get bonus weight so the
  // hero result for a typed reference number lands at the top.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const queryTerms = q ? q.split(/\s+/).filter(t => t.length > 1) : [];
    const sourceSet = activeSources.length ? new Set(activeSources) : null;
    const brandSet  = activeBrands.length  ? new Set(activeBrands)  : null;
    let out = visibleArticles.filter(a => {
      if (sourceSet && !sourceSet.has(a._source.key)) return false;
      if (brandSet && !brandSet.has((a.brand || "").trim())) return false;
      if (heartedOnly) {
        const id = shortHash(a.url);
        if (!watchlist || !watchlist[id]) return false;
      }
      if (q) {
        const body = bodies ? (bodies[a.url] || "") : "";
        const hay =
          ((a.title || "") + " " + body + " " + (a.author || "")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const effectiveSort = (sort === "relevance" && !q) ? "date_desc" : sort;

    if (effectiveSort === "relevance") {
      const scored = out.map(a => {
        const title  = (a.title  || "").toLowerCase();
        const author = (a.author || "").toLowerCase();
        const body   = bodies ? ((bodies[a.url] || "")).toLowerCase() : "";
        let score = 0;
        if (title === q) score += 100;
        if (title.includes(q)) score += 50;
        if (author.includes(q)) score += 8;
        for (const w of queryTerms) {
          if (title.includes(w)) score += 10;
          if (author.includes(w)) score += 4;
          if (body) {
            // Count occurrences via split — faster + safer than regex
            // for short query terms with potential special chars (e.g.
            // "6263" or "wgch0007").
            const occ = body.split(w).length - 1;
            score += Math.min(10, occ);
          }
        }
        // Tiny recency boost so two equally-scored articles land
        // newest-first; uses date as a string-comparable proxy.
        const dateProxy = (a.published_at || "0000-00-00");
        return { a, score, dateProxy };
      });
      scored.sort((x, y) => y.score - x.score || y.dateProxy.localeCompare(x.dateProxy));
      out = scored.map(s => s.a);
    } else if (effectiveSort === "date_desc") {
      out.sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));
    } else if (effectiveSort === "date_asc") {
      out.sort((a, b) => (a.published_at || "").localeCompare(b.published_at || ""));
    }
    return out;
  }, [visibleArticles, bodies, search, activeSources, activeBrands, sort, heartedOnly, watchlist]);

  // Lazy page-size reset whenever filters or sort change.
  useEffect(() => {
    setPageSize(RESULTS_PAGE_SIZE);
  }, [search, activeSources, activeBrands, sort, heartedOnly]);

  // hasFilters has to be defined BEFORE the featured memo references
  // it — useMemo callbacks run synchronously on first render, so a
  // forward reference to a const declared further down hits the TDZ.
  // `narrowing` = search / source / brand. The Saved heart is a filter pill
  // again (2026-10-16), so it raises "× Clear all" and is swept by it like the
  // pills beside it; `narrowing` is what tells "nothing saved yet" (an invite)
  // from "no matches" (the heart is on and nothing else is).
  const narrowing =
    !!search.trim() || activeSources.length > 0 || activeBrands.length > 0;
  const hasFilters = narrowing || heartedOnly;
  const isDefaultFeed = !hasFilters;

  // Featured strip — shown only on the default full feed. Top N most-recent
  // articles regardless of which source they came from. When filters fire, or
  // the user is on the Saved sub-tab, they have an intent and the featured
  // strip would just be visual noise above their results.
  const showFeatured = isDefaultFeed;
  const featured = useMemo(() => {
    if (!showFeatured) return [];
    return [...visibleArticles]
      .sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""))
      .slice(0, FEATURED_COUNT);
  }, [visibleArticles, showFeatured]);

  // When the featured strip is showing, exclude those URLs from the
  // dense scroll below — otherwise the newest articles appear twice
  // (once large in the featured strip, once dense in the grid below).
  const featuredUrls = useMemo(() => new Set(featured.map(a => a.url)), [featured]);
  const visible = useMemo(() => {
    const list = showFeatured
      ? filtered.filter(a => !featuredUrls.has(a.url))
      : filtered;
    return list.slice(0, pageSize);
  }, [filtered, pageSize, showFeatured, featuredUrls]);

  // (Year-bucket grouping retired 2026-06-03 — flat newest-first grid.)

  const toggleSource = (key) => {
    setActiveSources(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };
  const toggleBrand = (brand) => {
    setActiveBrands(prev =>
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]);
  };

  const clearAll = () => {
    setSearch("");
    setActiveSources([]);
    setActiveBrands([]);
    setHeartedOnly(false);
    setActiveFilterPop(null);
  };

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div style={{ paddingTop: 4 }}>
        <div style={{ padding: 24, color: "var(--text2)", textAlign: "center" }}>
          Couldn't load the editorial corpus. Refresh to try again.
        </div>
      </div>
    );
  }

  // The filter bar, built from src/ui (Mark, 2026-10-17: one definition per piece).
  // pills left · count right (the search is the header's: see HeaderSearch); the open
  // Source / Brand options panel lives INSIDE the sticky zone so it pins with the bar.
  const filterBarJSX = (
    <FilterBar
      sticky
      count={loading
        ? "Loading…"
        : `${filtered.length.toLocaleString()} ${filtered.length === 1 ? "article" : "articles"}`}
      pills={
        <>
          <Pill on={activeSources.length > 0 || activeFilterPop === "source"} n={activeSources.length || null}
                onClick={() => setActiveFilterPop((p) => (p === "source" ? null : "source"))}>Source</Pill>
          <Pill on={activeBrands.length > 0 || activeFilterPop === "brand"} n={activeBrands.length || null}
                onClick={() => setActiveFilterPop((p) => (p === "brand" ? null : "brand"))}>Brand</Pill>
          {/* Saved: the bare heart (Mark, 2026-10-16/17). Same `heartedOnly` state. */}
          <SavedPill on={heartedOnly} onClick={() => setHeartedOnly((v) => !v)} what="saved articles" />
          {hasFilters && <Pill quiet onClick={clearAll}>× Clear all</Pill>}
        </>
      }
      panel={
        activeFilterPop === "source" ? (
          <ChipPanel>
            {SOURCES.map((s) => (
              <Chip key={s.key} on={activeSources.includes(s.key)} n={sourceCounts[s.key] || 0}
                    onClick={() => toggleSource(s.key)}>{s.label}</Chip>
            ))}
            {activeSources.length > 0 && <Chip quiet onClick={() => setActiveSources([])}>× Clear</Chip>}
          </ChipPanel>
        ) : activeFilterPop === "brand" ? (
          <ChipPanel>
            {brandOptions.length === 0 ? (
              <span style={{ fontSize: 12, color: "var(--text3)" }}>No brands yet.</span>
            ) : (
              <>
                {(brandsExpanded ? brandOptions : brandOptions.slice(0, BRAND_TOP_N)).map((b) => (
                  <Chip key={b.brand} on={activeBrands.includes(b.brand)} n={b.count}
                        onClick={() => toggleBrand(b.brand)}>{b.brand}</Chip>
                ))}
                {brandOptions.length > BRAND_TOP_N && (
                  <Chip quiet onClick={() => setBrandsExpanded((v) => !v)}>
                    {brandsExpanded ? "Less ↑" : `+${brandOptions.length - BRAND_TOP_N} more`}
                  </Chip>
                )}
                {activeBrands.length > 0 && <Chip quiet onClick={() => setActiveBrands([])}>× Clear</Chip>}
              </>
            )}
          </ChipPanel>
        ) : null
      }
    />
  );

  // Built from src/ui (Mark, 2026-10-17): no page title (the header's active tab says where
  // you are), the filter bar sticks under the header, one inset. The old PageHeader, the
  // negative-margin sticky wrapper and the mobile portal into the shell are gone.
  return (
    <>
    <HeaderSearch>
      <SearchField
        size={isMobile ? "full" : "bar"}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch("")}
        placeholder="Search articles…"
        ariaLabel="Search articles" />
    </HeaderSearch>
    <PageFrame filterBar={filterBarJSX}>
      {/* Featured strip — top N most-recent articles, shown only when
          no filter / no search is active.
          The "FEATURED · most recent" dark slab above the cards was
          retired in PR_Y (2026-05-21) — the shell-level IdentityBand
          (label "Editorial", dark tone) now carries that role for
          consistency with every other tab. The larger-first card
          grid stays as the visual cue that these are surfaced
          items; no label slab needed. */}
      {showFeatured && featured.length > 0 && (
        // Top margin = breathing room below the pinned filter bar (Mark's
        // 2026-06-03 verification pass — cards sat flush against it).
        <div style={{ marginBottom: isMobile ? 32 : 48 }}>
          {/* Featured strip uses the same 3-col magazine layout as
              the year-grouped grid below — Vogue/Hodinkee top-of-
              page pattern. Mobile keeps 1-col so the hero card
              breathes; the rest of the featured set scrolls below. */}
          <div style={articleGridStyle}>
            {featured.map((a, idx) => (
              <ArticleCard
                priority={idx < 4}
                key={"featured-" + a.url}
                article={a}
                isMobile={isMobile}
                watchlist={watchlist}
                handleWish={handleWish}
                openCollectionPicker={openCollectionPicker}
                handleShare={handleShare}
                isAdmin={isAdmin}
                onAdminRemove={onAdminRemoveArticle}
              />
            ))}
          </div>
        </div>
      )}

      {/* Card grid grouped by year. Top padding gives the first year header
          breathing room below the pinned filter bar when the featured strip
          is hidden (filters/search active). */}
      <div style={{ paddingBottom: 110 }}>
        {!loading && filtered.length === 0 && (
          <div style={{
            padding: 32, color: "var(--text2)", textAlign: "center",
            border: "0.5px dashed var(--border)", borderRadius: 8,
            marginTop: 16,
          }}>
            {/* On the Saved sub-tab with nothing saved this is an invite, not
                a no-results message — "match your filters" would be wrong
                twice over (no filters are set, and none would help). */}
            {heartedOnly && !narrowing
              ? "Nothing saved yet. Tap the heart on any article and it lands here."
              : "No articles match your filters."}
          </div>
        )}

        {/* Flat newest-first grid (Mark 2026-06-03) — the year roll-up
            (collapsible buckets + year header rows) is retired: it was one
            more nonstandard chrome element, and infinite scroll makes the
            grouping redundant. */}
        <div style={articleGridStyle}>
          {visible.map((a, idx) => (
            <ArticleCard
              priority={!showFeatured && idx < 4}
              key={a.url}
              article={a}
              isMobile={isMobile}
              watchlist={watchlist}
              handleWish={handleWish}
              openCollectionPicker={openCollectionPicker}
              handleShare={handleShare}
              isAdmin={isAdmin}
              onAdminRemove={onAdminRemoveArticle}
            />
          ))}
        </div>

        {/* Infinite scroll sentinel — replaces the Load more button
            (Mark spec 2026-05-22: "yes to infinite scroll loading as
            scroll"). IntersectionObserver bumps pageSize whenever
            this node enters the viewport. Same callback-ref pattern
            App.js uses for the Listings grid (see App.js loaderRef).
            Footer text reads "Loading more…" while there's still
            corpus left, then "All N shown" once we've reached the
            end. */}
        {!loading && pageSize < filtered.length && (
          <div
            ref={(node) => {
              if (!node) return;
              const obs = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                  setPageSize(s => s + RESULTS_PAGE_SIZE);
                }
              }, { threshold: 0.1, rootMargin: "200px" });
              obs.observe(node);
              return () => obs.disconnect();
            }}
            style={{
              textAlign: "center", padding: "24px 0",
              color: "var(--text3)", fontSize: 12, fontFamily: "inherit",
            }}>
            Loading more…
          </div>
        )}
        {!loading && pageSize >= filtered.length && filtered.length > 0 && (
          <div style={{
            textAlign: "center", padding: "24px 0",
            color: "var(--text3)", fontSize: 12, fontFamily: "inherit",
          }}>
            All {filtered.length.toLocaleString()} shown
          </div>
        )}
      </div>
    </PageFrame>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// ArticleCard — slim variant of the Card pattern for editorial.
// No price, no heart, no dealer link. Just image + title + meta +
// excerpt + click-out behaviour.
// ─────────────────────────────────────────────────────────────────

export function ArticleCard({ article, isMobile, compact, cols, watchlist, handleWish, openCollectionPicker, handleShare, isAdmin, onAdminRemove, priority = false }) {
  const dateStr = formatDate(article.published_at);
  const sourceLabel = article._source.label;
  // Heart state — match the dealer-listing Card's behavior so the
  // primitive feels identical on both surfaces.
  const articleId = shortHash(article.url);
  const wished = !!(watchlist && watchlist[articleId]);
  const onHeartClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!handleWish) return;
    const asListing = articleAsListing(article);
    if (asListing) handleWish(asListing);
  };

  // "..." menu state (PR_R, 2026-05-20). Same portal-to-document.body
  // pattern as Card.js so longer labels (Add to list…) don't get
  // clipped by the card's overflow:hidden root. Click-outside +
  // Escape close.
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const [shareFeedback, setShareFeedback] = useState("");
  const triggerRef = useRef(null);
  const portalRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      const inTrigger = triggerRef.current && triggerRef.current.contains(e.target);
      const inPortal  = portalRef.current && portalRef.current.contains(e.target);
      if (!inTrigger && !inPortal) setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
  const onMenuClick = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!menuOpen && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
    }
    setMenuOpen(o => !o);
  };
  const onAddToList = (e) => {
    e.preventDefault(); e.stopPropagation();
    setMenuOpen(false);
    if (!openCollectionPicker) return;
    const asListing = articleAsListing(article);
    if (asListing) openCollectionPicker(asListing);
  };
  const onShareClick = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!handleShare) { setMenuOpen(false); return; }
    let result;
    try {
      result = await handleShare({
        // handleShare reads either an item (has .url) or a string URL.
        // Articles fit the item-shape contract via their url field.
        url: article.url,
        ref: article.title,
        title: article.title,
        brand: article.brand,
      });
    } catch (err) { console.warn("share failed", err); result = null; }
    if (result?.copied) {
      setShareFeedback("Copied!");
      setTimeout(() => { setShareFeedback(""); setMenuOpen(false); }, 1200);
    } else {
      setMenuOpen(false);
    }
  };
  const showMenu = !!(openCollectionPicker || handleShare);
  // PR 2026-05-22 magazine redesign (Mark spec: Vogue/Hodinkee
  // pattern). Drop card border + surface bg — cards float on the
  // page background. Uppercase letter-spaced kicker (source name)
  // above a serif title. Tiny uppercase letter-spaced byline below.
  // The density-mode complexity (dense / veryDense scaling) is
  // retired alongside the multi-col grid; the parent grids now
  // cap at 3 cols on desktop / 1 on mobile so a single card size
  // works everywhere.

  return (
    <div style={{ position: "relative", height: "100%" }}>
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
        height: "100%",
      }}>
      {article.image && (
        <div style={{
          width: "100%",
          aspectRatio: "16 / 10",
          background: "var(--surface)",
          overflow: "hidden",
          marginBottom: 12,
        }}>
          {/* imgSrc routing (PageSpeed 2026-06-06): article images were the
              ONE image surface bypassing the wsrv resize proxy — Rolex
              Magazine's blogger host serves 2MB/2000px originals for a
              ~360px tile, which was the 33.8s mobile LCP on Home and the
              12.5s LCP on Articles. Same proxy every listing image uses. */}
          <img
            src={imgSrc(article.image)}
            alt=""
            width={720} height={450}
            // First-row cards load eager/high (PageSpeed 2026-06-06: the
            // Articles LCP image was lazy — "LCP resources should not use
            // loading=lazy"). Same pattern as the listings grid's priority.
            loading={priority ? "eager" : "lazy"}
            fetchpriority={priority ? "high" : "auto"}
            decoding="async"
            style={{
              width: "100%", height: "100%",
              objectFit: "cover", display: "block",
            }}
          />
        </div>
      )}
      <div style={{
        display: "flex", flexDirection: "column", gap: 8, flex: 1,
      }}>
        {/* Kicker — source name in uppercase letter-spaced. */}
        <div style={{
          fontSize: 10, fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text3)",
        }}>
          {sourceLabel}
        </div>
        {/* Serif title — magazine voice. fontWeight 400 reads
            heavier on serif than sans; bumping past 500 starts to
            feel chunky. lineClamp 3 lines so longer titles wrap
            without ballooning the card height. */}
        <div style={{
          ...editorialTitle({ isMobile }),
          color: "var(--text1)",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>{article.title}</div>
        {/* Byline + relative date — tiny uppercase letter-spaced,
            same eyebrow voice as the kicker. */}
        {(article.author || dateStr) && (
          <div style={{
            fontSize: 10, fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text3)",
          }}>
            {article.author ? `By ${article.author}` : null}
            {article.author && dateStr ? " · " : null}
            {dateStr || null}
          </div>
        )}
      </div>
    </a>
    {/* Heart + "..." action stack (PR_P + PR_R, 2026-05-20). Mirrors
        the Card actions on dealer listings — same shape, same colors,
        same size logic. preventDefault + stopPropagation so taps
        don't escape to the wrapping <a>. The "..." menu portals to
        document.body so longer labels (Add to list…) don't get
        clipped by the card root's overflow:hidden. */}
    {(handleWish || showMenu) && (
      <div style={{
        position: "absolute", top: 8, right: 8, zIndex: 2,
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        {handleWish && (
          <button
            onClick={onHeartClick}
            aria-label={wished ? "Remove from saved articles" : "Save article"}
            title={wished ? "Saved · tap to remove" : "Save to articles"}
            style={{
              width: 32, height: 32,
              borderRadius: "50%", border: "none", cursor: "pointer",
              background: wished ? "rgba(220,38,38,0.88)" : "rgba(0,0,0,0.32)",
              color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0,
            }}>
            <HeartIcon filled={wished} size={16} />
          </button>
        )}
        {showMenu && (
          <button
            ref={triggerRef}
            onClick={onMenuClick}
            aria-label="More actions"
            style={{
              width: 32, height: 32,
              borderRadius: "50%", border: "none", cursor: "pointer",
              background: menuOpen ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.32)",
              color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0, fontFamily: "inherit",
              fontSize: 18, lineHeight: 1,
            }}>
            ⋯
          </button>
        )}
      </div>
    )}
    {menuOpen && menuPos && showMenu && createPortal(
      <div ref={portalRef} onClick={e => e.preventDefault()}
        style={{
          position: "fixed",
          top: menuPos.top, right: menuPos.right,
          zIndex: 1000,
          maxWidth: `calc(100vw - ${menuPos.right + 16}px)`,
          background: "var(--bg)", border: "0.5px solid var(--border)",
          borderRadius: 8, padding: 4,
          whiteSpace: "nowrap",
          boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        }}>
        {handleShare && (
          <button onClick={onShareClick} style={articleMenuItemStyle}>
            {shareFeedback || "Share"}
          </button>
        )}
        {openCollectionPicker && (
          <button onClick={onAddToList} style={articleMenuItemStyle}>
            Add to list…
          </button>
        )}
        {/* Admin-only curation (Mark 2026-06-06): drops the article into
            admin_hidden_listings (global — every visitor stops seeing it),
            same store the listings × overlay writes. */}
        {isAdmin && onAdminRemove && (
          <button
            onClick={(e) => {
              e.preventDefault(); e.stopPropagation();
              setMenuOpen(false);
              onAdminRemove(article);
            }}
            style={{ ...articleMenuItemStyle, color: "var(--danger)" }}>
            Remove article (admin)
          </button>
        )}
      </div>,
      document.body
    )}
    </div>
  );
}

// Menu-item style — slim, same shape as Card.js's menuItemStyle but
// kept local to this file so EditorialView doesn't depend on a
// non-exported style constant from Card.
const articleMenuItemStyle = {
  display: "block", width: "100%",
  padding: "8px 12px",
  background: "transparent", border: "none", cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit", fontSize: 13,
  color: "var(--text1)",
  borderRadius: 6,
};

function formatDate(iso) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m[2], 10) - 1]} ${parseInt(m[3], 10)}, ${m[1]}`;
}
