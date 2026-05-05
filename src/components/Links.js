import React, { useMemo } from "react";

// Cool Stuff > Links — curated outbound destinations beyond the feed
// itself. Two kinds of section:
//   1. Dealers — derived at render time from allListings (pick the
//      first listing per source, parse the URL host, link to the
//      homepage). Auto-current as new dealers join the scrape pipeline.
//      eBay excluded as it's a marketplace, not a curated dealer.
//   2. References — hand-curated link sets per watch reference
//      (Rolex GMT 1675, Tudor Sub 7021, etc.). Add a new ref by
//      appending to REFERENCE_SECTIONS below; sections render in
//      list order.

// Topic-themed link sections beyond per-reference research. Each entry
// is its own LinkSection. Add a new topic by appending here — the
// render loop picks it up automatically.
const TOPIC_SECTIONS = [
  {
    title: "Art",
    links: [
      "https://cmvisualartist.com/",
      "https://www.labeg.art/",
      "https://badartnicewatch.com/",
    ],
  },
  {
    title: "Straps",
    links: [
      "https://erikasoriginals.com/",
      "https://thestraptailor.com/",
      "https://delugs.com/",
      "https://veblenist.com/",
    ],
  },
  {
    title: "Editorial",
    links: [
      "https://www.rolexmagazine.com/",
      "https://www.rescapement.com/blog/resources",
      "https://www.hodinkee.com/",
      "https://www.fratellowatches.com/",
      "https://perezcope.com/about/",
      "https://www.watchuseek.com/",
      "https://www.strictlyvintagewatches.com/",
      "https://www.ablogtowatch.com/retail-me-not/",
      "https://www.screwdowncrown.com/",
      "https://www.thefourthwheel.co.uk/",
    ],
  },
];

// Per-reference resource link sets. Each item is { title, links: [url] }.
// Add a new reference cluster by appending to this array — the render
// loop picks them up automatically.
const REFERENCE_SECTIONS = [
  {
    title: "Rolex GMT 1675",
    links: [
      "https://millenarywatches.com/gmt-master-1675/",
      "https://gmtmaster1675.com/",
      "https://www.hodinkee.com/articles/rolex-gmt-master-reference-points",
    ],
  },
  {
    title: "Tudor Submariner 7021",
    links: [
      "https://bazamu.com/tudor-submariner-ref-7021-0-2/",
      "https://www.tudorwatch.com/en/inside-tudor/history/tudor-history-submariners-1969-to-1999",
      "https://www.tudorsub.com/",
      "https://tudorcollector.com/the-collection/",
      "https://www.rescapement.com/blog/tudor-submariner-a-brief-history",
      "https://revolutionwatch.com/the-tudor-milsub-part-i-2/",
      "https://revolutionwatch.com/the-tudor-milsub-part-ii-2/",
      "https://bulangandsons.com/blogs/watch-talks/tudor-and-the-french-navy-a-quarter-of-a-century-of-collaboration",
    ],
  },
  {
    title: "Omega Seamaster 300",
    links: [
      "https://www.omegaploprof.com/",
      "https://www.omegaseamaster300.com/",
      "https://www.watchgecko.com/blogs/magazine/is-this-watch-fake-the-story-of-the-watchco-omega-seamaster",
      "https://omegaforums.net/threads/opinions-on-seamaster-165-024-please.157000/",
      "https://www.fratellowatches.com/vintage-omega-seamaster-300-reference-165-024/",
    ],
  },
  {
    title: "Rolex Explorer 1016",
    links: [
      "https://explorer1016.com/",
    ],
  },
  {
    title: "Audemars Piguet 5548 BA",
    links: [
      "https://hairspring.com/blogs/finds/25657ba-audemars-piguet-quantieme-perpetuel",
      "https://www.watchbrotherslondon.com/articles/reference-talk-audemars-piguet-quantieme-perpetual-automatique",
      "https://www.hodinkee.com/articles/early-audemars-piguet-royal-oak-perpetual-calendar-in-depth",
    ],
  },
  {
    title: "Rolex DayDate 1803",
    links: [
      "https://www.fratellowatches.com/rolex-day-date-historical-overview-of-rolexs-flagship/",
    ],
  },
  {
    title: "Heuer",
    links: [
      "https://www.fratellowatches.com/tag-heuer-carrera-reissues-from-the-90s-are-huge-value-including-an-18k-gold-grail/#gref",
      "https://www.vintageheuercarrera.com/#models",
      "https://www.hodinkee.com/articles/reference-points-tag-heuer-carrera",
      "https://www.hodinkee.com/articles/understanding-the-earliest-heuer-carreras",
      "https://www.hodinkee.com/articles/the-drivers-who-put-heuer-at-the-heart-of-racing",
      "https://www.vintageheuer.com/",
      "https://www.classicheuer.de/en/",
      "https://www.swisswatchexpo.com/thewatchclub/2018/07/12/daytona-and-carrera-more-alike-than-you-know/",
      "https://heuerville.wordpress.com/%E2%96%BA-the-history-of-heuer/",
      "https://www.heuerpriceguide.com/heuer-collector-books",
    ],
  },
];

function dealerHomepage(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch { return null; }
}

function hostOf(url) {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; }
}

// Turn a URL like https://www.hodinkee.com/articles/reference-points-tag-heuer-carrera
// into "hodinkee.com" + "Reference points tag heuer carrera" so a list of
// reference-research links reads richer than a wall of bare hosts. Decoded,
// hyphens-to-spaces, sentence-cased, trailing slashes trimmed. Falls back
// to the raw URL on parse failure.
function describeLink(url) {
  try {
    const u = new URL(url);
    const host = u.host.replace(/^www\./, "");
    const segs = u.pathname.split("/").filter(Boolean);
    const last = segs[segs.length - 1] || "";
    let label = "";
    if (last) {
      try { label = decodeURIComponent(last); } catch { label = last; }
      label = label.replace(/[-_]+/g, " ").replace(/\.html?$/i, "").trim();
      if (label) label = label.charAt(0).toUpperCase() + label.slice(1);
    }
    return { host, label };
  } catch {
    return { host: url, label: "" };
  }
}

export function Links({ allListings = [], onBack }) {
  const dealers = useMemo(() => {
    const byName = new Map();
    for (const it of allListings) {
      const name = it.source;
      const url = it.url || "";
      if (!name || !url || byName.has(name)) continue;
      if (name === "eBay") continue;
      const home = dealerHomepage(url);
      if (home) byName.set(name, home);
    }
    return [...byName.entries()]
      .map(([name, url]) => ({ name, url }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allListings]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "4px 4px 24px" }}>
      <div style={{ display: "flex", marginBottom: 14 }}>
        {onBack && (
          <button onClick={onBack} aria-label="Back to Cool Stuff" style={{
            border: "none", background: "transparent", color: "var(--text2)",
            fontFamily: "inherit", fontSize: 13, cursor: "pointer", padding: "4px 0",
          }}>← Cool Stuff</button>
        )}
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: "var(--text1)" }}>
        Links
      </h1>
      <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 24px" }}>
        Outbound links to the dealers and resources behind the feed. More sections coming as the curated set grows.
      </p>

      <LinkSection
        title="Dealers"
        desc={`The ${dealers.length} independent dealers we aggregate into Listings. Every link opens the dealer's own site in a new tab — Watchlist is a directory layer, not a marketplace.`}
        items={dealers.map(d => ({ kind: "dealer", name: d.name, url: d.url }))}
      />

      {/* References — hand-curated link clusters per watch reference.
          Each cluster renders as its own LinkSection so the grouping
          stays scannable. URL-only items get auto-derived host + path
          labels via describeLink. */}
      <h2 style={{
        fontSize: 11, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.08em", color: "var(--text3)",
        margin: "8px 0 12px",
      }}>
        References
      </h2>
      {REFERENCE_SECTIONS.map(s => (
        <LinkSection
          key={s.title}
          title={s.title}
          items={s.links.map(url => ({ kind: "reference", url }))}
        />
      ))}

      {TOPIC_SECTIONS.map(s => (
        <LinkSection
          key={s.title}
          title={s.title}
          items={s.links.map(url => ({ kind: "reference", url }))}
        />
      ))}
    </div>
  );
}

function LinkSection({ title, desc, items }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{
        display: "flex", alignItems: "baseline", gap: 12,
        padding: "0 0 10px",
        borderBottom: "0.5px solid var(--border)",
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>{title}</span>
        <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto" }}>{items.length}</span>
      </div>
      {desc && (
        <p style={{ fontSize: 12, color: "var(--text2)", margin: "0 0 12px", lineHeight: 1.5 }}>{desc}</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map(item => <LinkRow key={item.url} {...item} />)}
      </div>
    </section>
  );
}

function LinkRow({ kind, name, url }) {
  // Two visual variants share the same shell. Dealer rows lead with the
  // dealer name (left) + bare host (right). Reference rows lead with a
  // derived path label (left) + bare host (right) — a path-derived title
  // reads better than a wall of "hodinkee.com / hodinkee.com / ...".
  const { host, label } = describeLink(url);
  const primary = kind === "dealer" ? name : (label || host);
  const secondary = kind === "dealer" ? host : (label ? host : "");
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={url} style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
      padding: "12px 14px", borderRadius: 10,
      border: "0.5px solid var(--border)", background: "var(--card-bg)",
      color: "var(--text1)", fontFamily: "inherit", textDecoration: "none",
    }}>
      <span style={{ fontWeight: 500, fontSize: 14, minWidth: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {primary}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
                    color: "var(--text3)", fontSize: 12 }}>
        {secondary && (
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                         maxWidth: 220 }}>
            {secondary}
          </span>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </span>
    </a>
  );
}
