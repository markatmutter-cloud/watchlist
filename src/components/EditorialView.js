import React, { useEffect, useMemo, useState } from "react";
import { SubTabIntro } from "./SubTabIntro";
import { pillBase, innerToggleButton, inputBase } from "../styles";

// Editorial sub-tab — v0 (2026-05-18). Surfaces the saved editorial
// corpus (Hairspring Finds + Hodinkee Bring a Loupe today; more sources
// land here as their scrapers ship). Cards are READ-ONLY links out to
// the original article — we never re-host content, only surface our
// own metadata + an excerpt to drive discovery to the publisher.
//
// Filter / sort surface is intentionally close to the Listings tab
// pattern (filter chips + sort dropdown + date dividers) so the
// mental model carries over.
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

const SOURCES = [
  {
    key: "hairspring_finds",
    label: "Hairspring Finds",
    publication: "Hairspring",
    column: "Finds",
    url: "/hairspring_finds.json",
  },
  {
    key: "hodinkee_bring_a_loupe",
    label: "Bring a Loupe",
    publication: "Hodinkee",
    column: "Bring a Loupe",
    url: "/bring_a_loupe.json",
  },
];

const SORT_OPTIONS = [
  { key: "date_desc", label: "Date ↓" },
  { key: "date_asc",  label: "Date ↑" },
  { key: "source",    label: "Source A→Z" },
];

const BRAND_TOP_N = 12;       // Show top N brands as chips; rest under "More"
const RESULTS_PAGE_SIZE = 24; // Lazy-render in chunks so a 1,860-article
                              // filter doesn't construct 1,860 DOM nodes upfront

export function EditorialView({ isMobile }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [articles, setArticles] = useState([]);

  const [search, setSearch] = useState("");
  const [activeSources, setActiveSources] = useState([]); // [] = all
  const [activeBrand, setActiveBrand] = useState("");      // "" = all
  const [sort, setSort] = useState("date_desc");
  const [showMoreBrands, setShowMoreBrands] = useState(false);
  const [collapsedYears, setCollapsedYears] = useState({});
  const [pageSize, setPageSize] = useState(RESULTS_PAGE_SIZE);

  // Load both corpuses on first mount. ~5 MB total but only loads
  // when the user opens the Editorial sub-tab. fetchOpts mirrors the
  // listings pipeline's no-cache pattern so PWA + GitHub raw caching
  // doesn't serve stale data after a fresh scrape.
  useEffect(() => {
    let alive = true;
    const fetchOpts = { cache: "no-cache" };
    Promise.all(SOURCES.map(s =>
      fetch(s.url, fetchOpts)
        .then(r => r.ok ? r.json() : {})
        .catch(() => ({}))
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

  // Build brand chip list from the corpus, ordered by frequency.
  const brandOptions = useMemo(() => {
    const counts = {};
    articles.forEach(a => {
      const b = (a.brand || "").trim();
      if (b) counts[b] = (counts[b] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([brand, count]) => ({ brand, count }));
  }, [articles]);

  // Apply filters + sort. Free-text search hits title + body_text +
  // author so body-derived brand/model mentions are reachable today
  // without the Phase 2 enrichment (typing "Railmaster" finds every
  // article whose prose names it).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sourceSet = activeSources.length ? new Set(activeSources) : null;
    let out = articles.filter(a => {
      if (sourceSet && !sourceSet.has(a._source.key)) return false;
      if (activeBrand && (a.brand || "").trim() !== activeBrand) return false;
      if (q) {
        const hay =
          ((a.title || "") + " " + (a.body_text || "") + " " + (a.author || "")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === "date_desc") {
      out.sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));
    } else if (sort === "date_asc") {
      out.sort((a, b) => (a.published_at || "").localeCompare(b.published_at || ""));
    } else if (sort === "source") {
      out.sort((a, b) =>
        a._source.label.localeCompare(b._source.label) ||
        (b.published_at || "").localeCompare(a.published_at || ""));
    }
    return out;
  }, [articles, search, activeSources, activeBrand, sort]);

  // Lazy page-size reset whenever filters or sort change (otherwise a
  // previously-scrolled page would re-render mid-list across filter taps).
  useEffect(() => {
    setPageSize(RESULTS_PAGE_SIZE);
  }, [search, activeSources, activeBrand, sort]);

  const visible = useMemo(() => filtered.slice(0, pageSize), [filtered, pageSize]);

  // Group visible items by year when sorting by date. Source sort
  // returns a single flat block grouped by source label instead.
  const groups = useMemo(() => {
    if (sort === "source") {
      const buckets = {};
      visible.forEach(a => {
        const k = a._source.label;
        (buckets[k] = buckets[k] || []).push(a);
      });
      return Object.entries(buckets).map(([label, items]) => ({ label, items }));
    }
    const buckets = {};
    visible.forEach(a => {
      const y = (a.published_at || "").slice(0, 4) || "Undated";
      (buckets[y] = buckets[y] || []).push(a);
    });
    const years = Object.keys(buckets).sort((a, b) =>
      sort === "date_desc" ? b.localeCompare(a) : a.localeCompare(b));
    return years.map(y => ({ label: y, items: buckets[y] }));
  }, [visible, sort]);

  const toggleSource = (key) => {
    setActiveSources(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };
  const toggleYearCollapse = (label) => {
    setCollapsedYears(prev => ({ ...prev, [label]: !prev[label] }));
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

  return (
    <div style={{ paddingTop: 4 }}>
      <SubTabIntro
        title="Editorial"
        blurb={<>
          Long-form writing from independent watch publications, indexed and
          searchable. Tap a card to read the original article on the
          publisher's site. Today: Hairspring Finds + Hodinkee Bring a Loupe;
          more sources land here as their scrapers ship.
        </>}
      />

      {/* Filter row — search + source chips + brand chips + sort */}
      <div style={{
        padding: "8px 16px 0",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {/* Search */}
        <input
          type="search"
          placeholder="Search title, author, or body text…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputBase, width: "100%" }}
        />

        {/* Source chips + sort dropdown — same row on desktop, stacked on mobile */}
        <div style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: 8,
          alignItems: isMobile ? "stretch" : "center",
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
            {SOURCES.map(s => {
              const active = activeSources.includes(s.key);
              const count = articles.filter(a => a._source.key === s.key).length;
              return (
                <button key={s.key}
                  onClick={() => toggleSource(s.key)}
                  style={pillBase(active, { compact: true })}>
                  {s.label} {count > 0 && <span style={{ opacity: 0.7 }}>· {count.toLocaleString()}</span>}
                </button>
              );
            })}
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            style={{
              ...inputBase,
              padding: "8px 10px",
              minWidth: 130,
              maxWidth: isMobile ? "100%" : 160,
            }}>
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Brand chips — top N by frequency, with "More" expander */}
        {brandOptions.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={() => setActiveBrand("")}
              style={pillBase(!activeBrand, { compact: true })}>
              All brands
            </button>
            {(showMoreBrands ? brandOptions : brandOptions.slice(0, BRAND_TOP_N)).map(b => (
              <button key={b.brand}
                onClick={() => setActiveBrand(b.brand === activeBrand ? "" : b.brand)}
                style={pillBase(activeBrand === b.brand, { compact: true })}>
                {b.brand} <span style={{ opacity: 0.7 }}>· {b.count}</span>
              </button>
            ))}
            {brandOptions.length > BRAND_TOP_N && (
              <button
                onClick={() => setShowMoreBrands(s => !s)}
                style={innerToggleButton(false)}>
                {showMoreBrands ? "Less" : `+${brandOptions.length - BRAND_TOP_N} more`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Result count */}
      <div style={{
        padding: "12px 16px 6px",
        fontSize: 12,
        color: "var(--text3)",
      }}>
        {loading
          ? "Loading editorial corpus…"
          : `${filtered.length.toLocaleString()} ${filtered.length === 1 ? "article" : "articles"}`}
      </div>

      {/* Card grid grouped by year (or source) */}
      <div style={{ padding: "0 16px 110px" }}>
        {!loading && filtered.length === 0 && (
          <div style={{
            padding: 32, color: "var(--text2)", textAlign: "center",
            border: "0.5px dashed var(--border)", borderRadius: 8,
          }}>
            No articles match your filters.
          </div>
        )}

        {groups.map((group, gi) => {
          const collapsed = !!collapsedYears[group.label];
          return (
            <div key={group.label + gi} style={{ marginBottom: 12 }}>
              <button
                onClick={() => toggleYearCollapse(group.label)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "transparent", border: "none",
                  padding: "10px 0 8px", margin: 0,
                  fontSize: 13, fontWeight: 600, color: "var(--text2)",
                  cursor: "pointer", fontFamily: "inherit",
                  borderBottom: "0.5px solid var(--border)",
                  width: "100%", textAlign: "left",
                }}>
                <span style={{
                  display: "inline-block", width: 12,
                  transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
                  transition: "transform 120ms",
                }}>▾</span>
                {group.label} <span style={{ fontWeight: 400, color: "var(--text3)" }}>· {group.items.length}</span>
              </button>
              {!collapsed && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "1fr"
                    : "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 12,
                  paddingTop: 10,
                }}>
                  {group.items.map(a => (
                    <ArticleCard key={a.url} article={a} isMobile={isMobile} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Load more — only when there's more in the filtered set */}
        {!loading && pageSize < filtered.length && (
          <div style={{ textAlign: "center", padding: "16px 0 24px" }}>
            <button
              onClick={() => setPageSize(s => s + RESULTS_PAGE_SIZE)}
              style={{
                padding: "10px 20px",
                borderRadius: 6,
                border: "0.5px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text2)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
              }}>
              Show {Math.min(RESULTS_PAGE_SIZE, filtered.length - pageSize)} more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ArticleCard — slim variant of the Card pattern for editorial.
// No price, no heart, no dealer link. Just image + title + meta +
// excerpt + click-out behaviour.
// ─────────────────────────────────────────────────────────────────

function ArticleCard({ article, isMobile }) {
  const dateStr = formatDate(article.published_at);
  const sourceLabel = article._source.label;
  const excerpt = (article.body_text || "").slice(0, 220).trim();

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
        background: "var(--surface)",
        border: "0.5px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
        cursor: "pointer",
        height: "100%",
      }}>
      {article.image && (
        <div style={{
          width: "100%",
          aspectRatio: "16 / 10",
          background: "var(--bg)",
          overflow: "hidden",
        }}>
          <img
            src={article.image}
            alt=""
            loading="lazy"
            style={{
              width: "100%", height: "100%",
              objectFit: "cover", display: "block",
            }}
          />
        </div>
      )}
      <div style={{
        padding: "12px 14px 14px",
        display: "flex", flexDirection: "column", gap: 6, flex: 1,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", gap: 8,
          fontSize: 11, color: "var(--text3)",
          textTransform: "uppercase", letterSpacing: 0.4,
        }}>
          <span>{sourceLabel}</span>
          <span>{dateStr}</span>
        </div>
        <div style={{
          fontSize: 15, fontWeight: 600, lineHeight: 1.3,
          color: "var(--text1)",
        }}>{article.title}</div>
        {article.author && (
          <div style={{ fontSize: 12, color: "var(--text2)" }}>
            {article.author}
          </div>
        )}
        {excerpt && (
          <div style={{
            fontSize: 12, color: "var(--text2)", lineHeight: 1.45,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>{excerpt}…</div>
        )}
        {article.brand && (
          <div style={{
            marginTop: 4, fontSize: 11, color: "var(--text3)",
          }}>
            {article.brand}
          </div>
        )}
      </div>
    </a>
  );
}

function formatDate(iso) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m[2], 10) - 1]} ${parseInt(m[3], 10)}, ${m[1]}`;
}
