// ReferencePage — the editorial reference-guide surface (Collecting ▸ References).
//
// A hand-authored content node (src/data/referencePages/*) enriched at render by
// the LLM synthesis (public/reference_synthesis_<synthesisNode>.json), presented
// as a collector-led editorial essay.
//
// REDESIGN (2026-06-07, docs/REFERENCE_PAGE_REDESIGN.md — Mark's review burst):
//  - Single readable column for prose (READW max-width), wide strips for
//    browsing. No drop cap, no two-column intro split.
//  - Section order: hero → the reference → what the shorthand misses (editorial
//    evidence blocks; hand-authored node.shorthand, synthesis conflicts as
//    fallback) → Reference stories (promoted into the body) → What to notice
//    (strip, replaces "Reading the marks") → Key configurations (strip,
//    replaces "Variants worth seeing") → Read it first (featured 4 + collapse)
//    → real examples (NO grey checklist — buying-risk content never renders
//    here; node.howToLook is retained in data for future listing context) →
//    explore next → modern legacy (optional) → library → scope.
//  - Page rule: teach the reader how to SEE the watch; no em-dashes in copy.

import React, { useState, useEffect } from "react";
import CardStrip from "./CardStrip";
import { Card } from "./Card";
import { imgSrc } from "../utils";
import { FONT_SERIF, editorialDisplay, editorialHeading } from "../styles";
import { Pill, SubTabs } from "../ui";
import { referenceAsListing } from "../data/referencePages";

const SERIF = FONT_SERIF;
const MAXW = 1080;
const READW = 820; // editorial reading measure (redesign: narrow to read, wide to browse)
const NONDEBATE = /(not a factual conflict|no source ranks|tonal|sibling watches|consensus is that)/i;

// Image with the wsrv→raw retry ladder (same fix class as the share hero,
// P-30): several guide-source hosts (WatchProSite, A Collected Man, Phillips,
// Beaumont Miller …) block wsrv's datacenter fetcher or hot-linking, so the
// resized URL 404s and the box rendered empty (Mark 2026-06-03). Attempt 0 =
// wsrv-resized, attempt 1 = the raw origin URL, then give up (caller's
// placeholder/empty box shows).
function RefImg({ src, width, alt, style }) {
  const [attempt, setAttempt] = useState(0);
  if (!src || attempt >= 2) return null;
  return (
    <img
      src={attempt === 0 ? imgSrc(src, width) : src}
      alt={alt} loading="lazy"
      onError={() => setAttempt((n) => n + 1)}
      style={style}
    />
  );
}

const itemBlob = (it) =>
  `${it.ref || ""} ${it.reference_no || ""} ${it.model_line || ""} ${it.brand || ""}`.toLowerCase();
function matchItem(it, spec) {
  const blob = itemBlob(it);
  if (spec.brand && !blob.includes(spec.brand)) return false;
  if (spec.refs && spec.refs.some((r) => new RegExp(`\\b${r}\\b`).test(blob))) return true;
  if (spec.text && spec.text.some((t) => blob.includes(t))) return true;
  return false;
}
const isAuctionItem = (it) => !!it._isAuctionFormat || !!it._isTrackedLot;
const DIST = {
  similar: { label: "Similar", bg: "var(--brand-olive-tint-12)", fg: "var(--brand-olive-text)" },
  adjacent: { label: "Adjacent", bg: "var(--brand-tint-10)", fg: "var(--brand)" },
  edge: { label: "Edge case", bg: "var(--accent-warn-tint-10)", fg: "var(--accent-warn)" },
};

export function ReferencePage({
  node, items = [], isMobile,
  watchlist = {}, handleWish, openCollectionPicker, handleShare,
  hidden = {}, primaryCurrency, onClickListing, compact, user, onViewAll,
}) {
  const [segment, setSegment] = useState(null);
  const [openConn, setOpenConn] = useState(null);
  const [synthesis, setSynthesis] = useState(null);
  const [active, setActive] = useState(null);
  const [allSources, setAllSources] = useState(false);
  const [moreStories, setMoreStories] = useState(false);

  useEffect(() => {
    const sn = node && node.synthesisNode;
    if (!sn || typeof fetch !== "function") { setSynthesis(null); return; }
    let alive = true;
    fetch(`/reference_synthesis_${sn}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setSynthesis(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [node && node.synthesisNode]);

  // Scroll-spy: highlight the section in the nav as it crosses the top third.
  useEffect(() => {
    if (typeof IntersectionObserver !== "function") return;
    const els = Array.from(document.querySelectorAll("[data-refsection]"));
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: "-18% 0px -72% 0px", threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [synthesis, node && node.id]);

  if (!node) return null;

  // node.market is optional — coming-soon stubs render this page under the
  // frost without one (the unguarded read crashed prod, 2026-06-07).
  const matched = node.market ? items.filter((it) => matchItem(it, node.market)) : [];
  const market = {
    live: matched.filter((it) => !it.sold && !isAuctionItem(it)),
    auctions: matched.filter((it) => isAuctionItem(it) && !it.sold),
    sold: matched.filter((it) => it.sold),
  };
  const seg = segment || (market.live.length ? "live" : market.auctions.length ? "auctions" : "sold");

  // Synthesis, filtered to this reference's scope; evidence = real debates only.
  const scope = node.synthesisScope || node.refs || [];
  const inScope = (it) => !it.applies_to || !it.applies_to.length || it.applies_to.some((t) => scope.includes(t));
  const synStories = (synthesis?.stories || []).filter(inScope);
  const realConflicts = (synthesis?.conflicts || []).filter(inScope).filter((c) => !NONDEBATE.test(c.note || ""));

  // "What the shorthand misses": hand-authored blocks win; synthesis conflicts
  // are the fallback, recast into the same editorial shape.
  const shorthand = node.shorthand?.length
    ? node.shorthand
    : realConflicts.map((c) => ({
        heading: c.topic,
        body: c.note,
        sourcePosition: (c.positions || []).join(" · "),
      }));

  const has = {
    guides: node.guides?.length > 0,
    marks: node.marks?.length > 0,
    variants: node.variants?.length > 0,
    shorthand: shorthand.length > 0,
    stories: node.storiesAndImages?.length > 0 || synStories.length > 0,
    explore: node.connections?.length > 0,
    legacy: !!node.modernLegacy,
    library: node.books?.length > 0,
  };
  const NAV = [
    { id: "overview", label: "Overview", show: true },
    { id: "shorthand", label: node.shorthandNav || "Production", show: has.shorthand },
    { id: "marks", label: "Details", show: has.marks },
    { id: "variants", label: "Configurations", show: has.variants },
    { id: "stories", label: "Stories", show: has.stories },
    { id: "guides", label: "Sources", show: has.guides },
    { id: "examples", label: "Examples", show: true },
    { id: "explore", label: "Explore", show: has.explore },
    { id: "library", label: "Library", show: has.library },
  ].filter((s) => s.show);
  const goTo = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };

  // ── shared layout helpers ──
  // shell = the wide browse width; readShell = the narrow editorial measure.
  const PAD = isMobile ? 16 : 20;
  const shell = (children, style) => <div style={{ maxWidth: MAXW, margin: "0 auto", width: "100%", padding: `0 ${PAD}px`, ...style }}>{children}</div>;
  const readShell = (children, style) => shell(<div style={{ maxWidth: READW }}>{children}</div>, style);
  const sectionGap = isMobile ? 40 : 64;

  const Section = (id, kicker, title, intro, children, { narrowHeader = false } = {}) => {
    const header = (
      <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: isMobile ? 22 : 30, marginBottom: isMobile ? 16 : 22 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--brand-olive-text)", marginBottom: 8 }}>{kicker}</div>
        <h2 style={{ ...editorialHeading({ isMobile }), color: "var(--text1)", margin: 0 }}>{title}</h2>
        {intro && <p style={{ fontSize: isMobile ? 15 : 16, lineHeight: 1.5, color: "var(--text2)", marginTop: 10, marginBottom: 0, maxWidth: 640 }}>{intro}</p>}
      </div>
    );
    return (
      <section id={id} data-refsection style={{ scrollMarginTop: "calc(var(--sticky-top, 0px) + 70px)", marginTop: sectionGap }}>
        {narrowHeader ? readShell(header) : shell(header)}
        {children}
      </section>
    );
  };

  const renderListingCard = (item) => (
    <Card item={item} wished={!!watchlist[item.id]} onWish={handleWish} compact={compact}
      isHidden={!!hidden[item.id]} onAddToCollection={user ? openCollectionPicker : undefined}
      primaryCurrency={primaryCurrency} onShare={handleShare} onClickListing={onClickListing} />
  );
  const renderEditorialCard = (a) => (
    <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
      <div style={{ width: "100%", aspectRatio: "4 / 3", overflow: "hidden", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 }}>
        {a.img ? <RefImg src={a.img} alt={a.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
               : <span style={{ fontFamily: SERIF, fontSize: 15, color: "var(--text3)", padding: 12, textAlign: "center" }}>{a.publication}</span>}
      </div>
      <div style={{ padding: "8px 10px 12px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)", lineHeight: 1.3 }}>{a.title}</div>
        {a.blurb && <div style={{ fontSize: 12, lineHeight: 1.45, color: "var(--text2)", marginTop: 5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.blurb}</div>}
        <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>{a.publication} ↗</div>
      </div>
    </a>
  );

  // Detail card — the "What to notice" / "Key configurations" strips: image,
  // name, a clamped line or two, click-through to the source.
  const renderDetailCard = ({ name, text, img, url, source }) => (
    <a href={url || undefined} target={url ? "_blank" : undefined} rel="noopener noreferrer" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
      <div style={{ width: "100%", aspectRatio: "4 / 3", overflow: "hidden", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 }}>
        {img ? <RefImg src={img} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
             : <span style={{ fontFamily: SERIF, fontSize: 14, color: "var(--text3)", padding: 12, textAlign: "center" }}>{source || name}</span>}
      </div>
      <div style={{ padding: "8px 2px 12px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)", lineHeight: 1.3 }}>{name}</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--text2)", marginTop: 5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{text}</div>
        {source && <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>{source} ↗</div>}
      </div>
    </a>
  );

  // paired two-column row (desktop) — still used by Read it first.
  const paired = (text, media, key, { flip = false, ratio = "4 / 3" } = {}) => {
    const m = media && <div key="m" style={{ borderRadius: 10, overflow: "hidden", background: "var(--surface)", aspectRatio: ratio }}>{media}</div>;
    return (
      <div key={key} style={{ display: "grid", gridTemplateColumns: isMobile || !media ? "1fr" : "1fr 1fr", gap: isMobile ? 14 : 36, alignItems: "center", padding: isMobile ? "16px 0" : "20px 0", borderTop: "0.5px solid var(--border)" }}>
        {isMobile ? <>{m}{text}</> : (flip ? <>{m}{text}</> : <>{text}{m}</>)}
      </div>
    );
  };

  const story = node.story || [];
  const FEATURED_SOURCES = 4;
  const guidesShown = allSources ? (node.guides || []) : (node.guides || []).slice(0, FEATURED_SOURCES);

  return (
    <div style={{ background: "var(--bg)", paddingBottom: isMobile ? 60 : 48 }}>
      {/* HERO */}
      <div style={{ position: "relative", width: "100%", height: isMobile ? 320 : 480, overflow: "hidden" }}>
        {/* Hero is a full-width banner — request it at 1600px (vs imgSrc's 720
            default) so it's sharp on wide/retina screens. wsrv's `we` flag means
            no upscaling, so smaller-source heroes are still safe. */}
        <RefImg src={node.hero.img} width={1600} alt={`${node.brand} ${node.modelLine} ${node.group}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.74) 0%, rgba(0,0,0,0.18) 48%, rgba(0,0,0,0.05) 100%)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: isMobile ? "0 16px 20px" : "0 20px 34px" }}>
          <div style={{ maxWidth: MAXW, margin: "0 auto" }}>
            <div style={{ fontSize: isMobile ? 15 : 20, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.86)", marginBottom: isMobile ? 8 : 10 }}>{node.brand} · {node.modelLine}</div>
            <h1 style={{ ...editorialDisplay({ isMobile }), color: "#fff", margin: 0 }}>{node.group}</h1>
            <div style={{ color: "rgba(255,255,255,0.82)", fontSize: isMobile ? 13 : 14, marginTop: 10 }}>{node.definer}</div>
          </div>
        </div>
        {node.hero.credit && (
          <a href={node.hero.creditUrl} target="_blank" rel="noopener noreferrer" style={{ position: "absolute", right: 10, top: 10, fontSize: 10, color: "rgba(255,255,255,0.66)", textDecoration: "none", background: "rgba(0,0,0,0.32)", padding: "3px 8px", borderRadius: 999 }}>Photo · {node.hero.credit} ↗</a>
        )}
      </div>

      {/* SAVE THIS GUIDE — heart + add-to-list at the point of reading (B-37).
          Routes through the same handlers as listings/articles; the guide is
          projected to a kind:"reference" listing snapshot. */}
      {(handleWish || openCollectionPicker) && (() => {
        const asListing = referenceAsListing(node);
        if (!asListing) return null;
        const wished = !!(watchlist && watchlist[asListing.id]);
        return shell(
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: isMobile ? "12px 0 2px" : "14px 0 2px" }}>
            {handleWish && (
              <button onClick={() => handleWish(asListing)}
                aria-label={wished ? "Saved (tap to remove)" : "Save this guide"}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 600, padding: "7px 14px",
                  borderRadius: 999, border: "0.5px solid var(--border)",
                  background: wished ? "var(--brand-olive-tint-12)" : "var(--surface)",
                  color: wished ? "var(--brand-olive-ink)" : "var(--text1)",
                }}>
                <span style={{ color: wished ? "var(--heart)" : "var(--text2)" }}>{wished ? "♥" : "♡"}</span>
                {wished ? "Saved" : "Save guide"}
              </button>
            )}
            {openCollectionPicker && user && (
              <button onClick={() => openCollectionPicker(asListing)}
                style={{
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                  padding: "7px 14px", borderRadius: 999, border: "0.5px solid var(--border)",
                  background: "var(--surface)", color: "var(--text1)",
                }}>
                Add to list…
              </button>
            )}
          </div>
        );
      })()}

      {/* STICKY SCROLL-SPY NAV — where am I + jump.
          top reads --sticky-top (the measured height of the mobile sticky
          chrome stack, set in App.js) so the nav pins BELOW the tab/sub-tab
          chrome instead of on top of it (P-11 — it used to overlap the green
          band). Desktop has no [data-sticky-chrome] → var stays 0 → top:0 in
          the scroll pane, as before. zIndex 15 < the chrome's 20 so during
          scroll transitions the nav tucks under the chrome, never over it. */}
      <nav style={{ position: "sticky", top: "var(--sticky-top, 0px)", zIndex: 15, background: "var(--bg)", borderBottom: "0.5px solid var(--border)" }}>
        {shell(
          <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none", padding: "8px 0" }}>
            {NAV.map((s) => (
              <Pill key={s.id} on={active === s.id} onClick={() => goTo(s.id)}>{s.label}</Pill>
            ))}
          </div>
        )}
      </nav>

      {/* OVERVIEW — "The reference": one clean single-column block. No drop
          cap, no two-column split (redesign: narrow to read, wide to browse). */}
      <section id="overview" data-refsection style={{ scrollMarginTop: "calc(var(--sticky-top, 0px) + 70px)", marginTop: sectionGap }}>
        {readShell(
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--brand-olive-text)", marginBottom: 8 }}>Overview</div>
            <h2 style={{ ...editorialHeading({ isMobile }), color: "var(--text1)", margin: "0 0 12px" }}>The {node.group}</h2>
            {node.modelIntro && (
              <p style={{ fontFamily: SERIF, fontSize: isMobile ? 17 : 19, lineHeight: 1.6, color: "var(--text1)", margin: 0 }}>{node.modelIntro}</p>
            )}
            {story.map((p, i) => (
              <p key={i} style={{ fontFamily: SERIF, fontSize: isMobile ? 16 : 17, lineHeight: 1.65, color: "var(--text1)", marginTop: 16, marginBottom: 0 }}>{p}</p>
            ))}
            {node.inItsTime && (
              <p style={{ fontFamily: SERIF, fontSize: isMobile ? 16 : 17, lineHeight: 1.65, color: "var(--text1)", marginTop: 16, marginBottom: 0 }}>{node.inItsTime}</p>
            )}
          </div>
        )}
      </section>

      {/* EVIDENCE — what the shorthand misses. Editorial blocks, not Q&A;
          hand-authored node.shorthand first, synthesis conflicts fallback. */}
      {has.shorthand && Section("shorthand", node.shorthandKicker || "Production", node.shorthandTitle || "From prototype to icon", null,
        readShell(
          <div>
            {shorthand.map((b, i) => (
              <div key={i} style={{ padding: shorthand.some((x) => x.heading) ? (isMobile ? "14px 0" : "16px 0") : "8px 0", borderTop: i && shorthand.some((x) => x.heading) ? "0.5px solid var(--border)" : "none" }}>
                {b.heading && <div style={{ fontFamily: SERIF, fontSize: isMobile ? 17 : 19, fontWeight: 600, color: "var(--text1)" }}>{b.heading}</div>}
                <p style={{ fontFamily: SERIF, fontSize: isMobile ? 16 : 17, lineHeight: 1.65, color: "var(--text1)", margin: b.heading ? "6px 0 0" : 0 }}>{b.body}</p>
                {b.sourcePosition && <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text3)", marginTop: 8 }}>Source position: {b.sourcePosition}</div>}
              </div>
            ))}
          </div>
        ), { narrowHeader: true }
      )}

      {/* WHAT TO NOTICE — replaces "Reading the marks": a visual strip, not a
          card-grid essay. Education, not warning. */}
      {has.marks && Section("marks", "Details", "Reference details", node.marksIntro || `How to read a ${node.group}: the physical cues that define the reference.`,
        shell(
          <div style={{ margin: "0 -8px" }}>
            <CardStrip
              items={node.marks}
              isMobile={isMobile} inset={false} background="transparent"
              renderCard={(m) => renderDetailCard({ name: m.name, text: m.short || m.body, img: m.img, url: m.url, source: m.source })}
            />
          </div>
        )
      )}

      {/* KEY CONFIGURATIONS — replaces "Variants worth seeing": compact strip. */}
      {has.variants && Section("variants", "Configurations", "Key configurations", `The main ways the ${node.group} appears in the literature, auction records and collector shorthand.`,
        shell(
          <div style={{ margin: "0 -8px" }}>
            <CardStrip
              items={node.variants}
              isMobile={isMobile} inset={false} background="transparent"
              renderCard={(v) => renderDetailCard({ name: v.name, text: v.traits, img: v.img, url: v.url, source: v.source })}
            />
          </div>
        )
      )}

      {/* REFERENCE STORIES — after Details/Configurations (rewrite brief): the
          stories land once the reader has the physical vocabulary. Card grid
          is the featured set; synthesis stories collapse behind a toggle. */}
      {has.stories && Section("stories", "Stories", "Reference stories", node.storiesIntro || `The pieces that explain the ${node.group} beyond the spec sheet.`,
        <>
          {node.storiesAndImages?.length > 0 && shell(<div style={{ margin: "0 -8px" }}><CardStrip items={node.storiesAndImages} isMobile={isMobile} inset={false} background="transparent" renderCard={renderEditorialCard} /></div>)}
          {synStories.length > 0 && (!node.storiesAndImages?.length || moreStories) && shell(
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 0 : "0 36px", marginTop: node.storiesAndImages?.length ? 16 : 0 }}>
              {synStories.map((s, i) => (
                <a key={i} href={s.source || undefined} target={s.source ? "_blank" : undefined} rel="noopener noreferrer" style={{ display: "block", textDecoration: "none", color: "inherit", padding: "12px 0", borderTop: "0.5px solid var(--border)" }}>
                  <div style={{ fontSize: isMobile ? 15 : 16, fontWeight: 600, color: "var(--text1)", lineHeight: 1.3 }}>{s.title}{s.source ? " ↗" : ""}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text2)", marginTop: 4 }}>{s.why}</div>
                </a>
              ))}
            </div>
          )}
          {synStories.length > 0 && node.storiesAndImages?.length > 0 && shell(
            <div style={{ paddingTop: 12 }}>
              <button onClick={() => setMoreStories((v) => !v)}
                style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: "var(--brand)", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                {moreStories ? "Fewer stories" : `More reference stories (${synStories.length})`}
              </button>
            </div>
          )}
        </>
      )}

      {/* READ IT FIRST — after the visual explainers (understand the watch
          first, then the research trail). Featured 4, the rest collapsed. */}
      {has.guides && Section("guides", "Sources", "The core references behind this guide", null,
        shell(
          <div>
            {guidesShown.map((g, i) => paired(
              <div key="t">
                <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{g.publication}</div>
                <a href={g.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: isMobile ? 16 : 18, fontWeight: 600, color: "var(--text1)", textDecoration: "none", lineHeight: 1.25, display: "block" }}>{g.title}</a>
                <p style={{ fontSize: isMobile ? 13 : 14, lineHeight: 1.5, color: "var(--text2)", marginTop: 8, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{g.blurb}</p>
                <div style={{ fontSize: 13, color: "var(--text2)" }}><span style={{ fontWeight: 600 }}>Read this for:</span> {g.readThisFor}. <a href={g.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", textDecoration: "none", whiteSpace: "nowrap" }}>Read ↗</a></div>
              </div>,
              g.img
                ? <a href={g.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", width: "100%", height: "100%" }}><RefImg src={g.img} alt={g.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /></a>
                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, color: "var(--text3)", fontSize: 16, textAlign: "center", padding: 16 }}>{g.publication}</div>,
              i
            ))}
            {(node.guides || []).length > FEATURED_SOURCES && (
              <div style={{ paddingTop: 14, borderTop: "0.5px solid var(--border)" }}>
                <button onClick={() => setAllSources((v) => !v)}
                  style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: "var(--brand)", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                  {allSources ? "Show fewer sources" : `More sources (${node.guides.length - FEATURED_SOURCES})`}
                </button>
              </div>
            )}
          </div>
        )
      )}

      {/* EXAMPLES — straight to the market. The due-diligence checklist no
          longer renders here (page rule: teach how to see, not what to fear;
          node.howToLook stays in data for future listing-context use). */}
      <section id="examples" data-refsection style={{ scrollMarginTop: "calc(var(--sticky-top, 0px) + 70px)", marginTop: sectionGap }}>
        {shell(
          <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: isMobile ? 22 : 30, marginBottom: isMobile ? 16 : 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--brand-olive-text)", marginBottom: 8 }}>Examples</div>
            <h2 style={{ ...editorialHeading({ isMobile }), color: "var(--text1)", margin: 0 }}>Look at real examples</h2>
            <p style={{ fontSize: isMobile ? 15 : 16, lineHeight: 1.5, color: "var(--text2)", marginTop: 10, marginBottom: 0, maxWidth: 640 }}>Compare current listings, sold examples and auction records to see how dial type, condition, originality, completeness and provenance change the story.</p>
          </div>
        )}
        {shell(
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: isMobile ? 16 : "22px 24px", overflow: "hidden" }}>
            {/* segmented control */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <SubTabs ariaLabel="Market" activeKey={seg} onSelect={setSegment}
                tabs={[{ k: "live", label: "Available" }, { k: "auctions", label: "At auction" }, { k: "sold", label: "Sold" }].map(({ k, label }) => ({
                  key: k,
                  label: <>{label} <span style={{ opacity: 0.7, fontWeight: 500 }}>{market[k].length}</span></>,
                }))} />
              {market[seg].length > 0 && onViewAll && (
                <button onClick={() => onViewAll(node.market.refs, seg)} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: "var(--brand)", fontSize: 12, fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap" }}>View all →</button>
              )}
            </div>
            {market[seg].length > 0
              ? <div style={{ margin: "0 -8px" }}><CardStrip items={market[seg]} isMobile={isMobile} max={12} inset={false} background="transparent" renderCard={renderListingCard} /></div>
              : <div style={{ fontSize: 13, color: "var(--text3)", padding: "4px 0 8px" }}>None in this bucket right now. It refreshes as the scrape runs.</div>}
          </div>
        )}
      </section>

      {/* EXPLORE — go wider: the rabbit hole */}
      {has.explore && Section("explore", "Explore", "Where to explore next", node.whereNext,
        <>
          {shell(
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 0 : "0 36px" }}>
              {node.connections.map((conn, i) => {
                const ex = items.filter((it) => matchItem(it, conn.match));
                ex.sort((a, b) => (a.sold === b.sold ? 0 : a.sold ? 1 : -1));
                const d = DIST[conn.distance] || DIST.adjacent;
                const open = openConn === i;
                const chip = <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: d.fg, background: d.bg, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>{d.label}</span>;
                if (open) {
                  return (
                    <div key={i} style={{ gridColumn: isMobile ? "auto" : "1 / -1", borderTop: "0.5px solid var(--border)", padding: isMobile ? "14px 0" : "16px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5, flexWrap: "wrap" }}>
                        <button onClick={() => setOpenConn(null)} style={{ border: "none", background: "var(--surface)", color: "var(--text2)", cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 999 }}>✕ Close</button>
                        {chip}<span style={{ fontSize: isMobile ? 16 : 17, fontWeight: 600, color: "var(--text1)" }}>{conn.label}</span>
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text2)", maxWidth: 640 }}>{conn.why}</div>
                      {ex.length > 0 && <div style={{ marginTop: 12, marginLeft: -8, marginRight: -8 }}><CardStrip items={ex} isMobile={isMobile} max={14} inset={false} background="transparent" renderCard={renderListingCard} /></div>}
                    </div>
                  );
                }
                const thumb = ex[0]?.img;
                const canOpen = ex.length > 0;
                return (
                  <div key={i} onClick={canOpen ? () => setOpenConn(i) : undefined} style={{ display: "flex", gap: 12, alignItems: "center", borderTop: "0.5px solid var(--border)", padding: "14px 0", cursor: canOpen ? "pointer" : "default" }}>
                    <div style={{ flex: "0 0 auto", width: 72, height: 72, borderRadius: 8, overflow: "hidden", background: "var(--surface)" }}>
                      {thumb && <RefImg src={thumb} alt={conn.label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>{chip}<span style={{ fontSize: isMobile ? 15 : 16, fontWeight: 600, color: "var(--text1)" }}>{conn.label}</span></div>
                      <div style={{ fontSize: 13, lineHeight: 1.45, color: "var(--text2)" }}>{conn.why}</div>
                    </div>
                    {canOpen && <div style={{ flex: "0 0 auto", color: "var(--brand)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{ex.length} →</div>}
                  </div>
                );
              })}
            </div>
          )}
          {synthesis?.module_candidates?.length > 0 && shell(
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", marginBottom: 6 }}>Also in this family, coming as their own pages</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {synthesis.module_candidates.map((m, i) => (
                  <span key={i} style={{ fontSize: 11, color: "var(--text2)", border: "0.5px solid var(--border)", borderRadius: 999, padding: "2px 9px" }}>{m.module}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* MODERN LEGACY — optional, for line-spanning guides: the relaunch /
          successor history, kept out of the opening narrative. */}
      {has.legacy && Section("legacy", "The line today", "Modern legacy", null,
        readShell(
          <p style={{ fontFamily: SERIF, fontSize: isMobile ? 16 : 17, lineHeight: 1.65, color: "var(--text1)", margin: 0 }}>{node.modernLegacy}</p>
        ), { narrowHeader: true }
      )}

      {/* LIBRARY — books, two columns */}
      {has.library && Section("library", "The shelf", "Books worth having nearby", "Credited links, no affiliations.",
        shell(
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 0 : "0 36px" }}>
            {node.books.map((b, i) => (
              <a key={i} href={b.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none", color: "inherit", padding: "12px 0", borderTop: "0.5px solid var(--border)" }}>
                <div style={{ fontFamily: SERIF, fontSize: isMobile ? 16 : 17, color: "var(--text1)", lineHeight: 1.3 }}>{b.title}</div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3, letterSpacing: "0.02em" }}>{b.author} ↗</div>
                {b.note && <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 5, lineHeight: 1.45 }}>{b.note}</div>}
              </a>
            ))}
          </div>
        )
      )}

      {/* SCOPE & SOURCING — footer (incl. the honest AI-provenance line, demoted here) */}
      {node.scopeNote && (
        <div style={{ marginTop: sectionGap }}>
          {shell(
            <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 8 }}>Scope &amp; sourcing</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text2)" }}>{node.scopeNote}</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text3)", marginTop: 8 }}>
                Compiled from dealer listings, auction records, reference articles and collector write-ups, then reviewed by hand. Spot something off?{" "}
                <a href="mailto:mark@mutter.co.uk?subject=Reference%20note" style={{ color: "var(--brand)", textDecoration: "none" }}>Suggest a fix</a>.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReferencePage;
