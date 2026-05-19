import React, { useMemo, useState } from "react";

// Cool Stuff > Links — curated outbound destinations beyond the feed
// itself. Two kinds of section:
//   1. Dealers — derived at render time from allListings (pick the
//      first listing per source, parse the URL host, link to the
//      homepage). Auto-current as new dealers join the scrape pipeline.
//      eBay excluded as it's a marketplace, not a curated dealer.
//   2. References + Topics — hand-curated link sets per watch reference
//      or theme (Rolex GMT 1675, Tudor Sub 7021, Art, Straps, etc.).
//      Add a new section by appending to REFERENCE_SECTIONS or
//      TOPIC_SECTIONS below; the render loop picks them up.
//
// Sections render as accordions (2026-05-05). Each section header is a
// tappable button that toggles its body open/closed; default state is
// all collapsed so the page reads as a clean menu rather than a wall
// of links. Per Mark — wants to scan section names first, drill in
// only when interested.

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
      "https://monochrome-watches.com/",
      {
        url: "https://www.heuerpriceguide.com/heuervintage-blog",
        name: "Heuer Price Guide — Vintage Heuer blog",
      },
    ],
  },
  {
    // Price Guides — distinct genre from editorial. Curated tables
    // covering specific Heuer model families with private/retail
    // pricing across condition tiers. The full corpus of HEUER
    // editorial blog posts lives in the Editorial corpus (Collecting >
    // Editorial sub-tab); the tables here are flat-page reference
    // material and live as bookmarks.
    title: "Price Guides",
    links: [
      {
        url: "https://www.heuerpriceguide.com/price-guide",
        name: "Vintage Heuer Price Guide — index",
      },
      {
        url: "https://www.heuerpriceguide.com/carrera-1960s-price-guide",
        name: "Heuer Carrera 1963–85 — refs 2447S/N/SF/SD/ST, 3647, 3147, 2547, 7753, 1153, 1158, 73353, 73653",
      },
      {
        url: "https://www.heuerpriceguide.com/carrera-1970s---cushion-case",
        name: "Heuer Carrera 1970s cushion case — refs 1153, 1158, 73653",
      },
      {
        url: "https://www.heuerpriceguide.com/autavia-1960s-price-guide",
        name: "Heuer Autavia 1960s — refs 2446, 3646, 2446c, 7763c, 7863c (+ Skipper, Seafarer, Mareographe)",
      },
      {
        url: "https://www.heuerpriceguide.com/autavia-70-80s-price-guide",
        name: "Heuer Autavia 70s/80s — refs 1163, 1563, 11063, 11630, 73363, 73463, 73663, 1564/15640",
      },
      {
        url: "https://www.heuerpriceguide.com/autavia-compressor-case",
        name: "Heuer Autavia compressor case — refs 2446c, 7763c, 7863c",
      },
      {
        url: "https://www.heuerpriceguide.com/heuer-monaco-price-guide",
        name: "Heuer Monaco — refs 1133B/G, 1533B/G, 73633B/G, 740303",
      },
      {
        url: "https://www.heuerpriceguide.com/vintage-heuer-rarity",
        name: "Vintage Heuer — production & rarity",
      },
      {
        url: "https://www.heuerpriceguide.com/about-the-price-guide",
        name: "About the Heuer Price Guide — methodology + condition tiers",
      },
      {
        url: "https://www.heuerpriceguide.com/heuer-price-guide-update-december-2024",
        name: "Heuer Price Guide — latest update (Dec 2024)",
      },
    ],
  },
  {
    title: "Major Auctions",
    // Entries can be either a bare URL string (label is auto-derived
    // from the URL path via describeLink) or a `{url, name}` object
    // when the auto-label would be uninformative — e.g. Phillips
    // sale codes like CH080317 that need their friendly title spelled
    // out. The render loop normalises either form to the same item shape.
    links: [
      {
        url: "https://www.phillips.com/auctions/auction/CH080317",
        name: "Phillips · Exceptional Heuer Chronographs from the Jack Heuer Era",
      },
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
      "https://www.fratellowatches.com/vintage-heuer-the-most-predictably-volatile-market-around/",
      "https://www.vintageheuercarrera.com/#models",
      "https://www.hodinkee.com/articles/reference-points-tag-heuer-carrera",
      "https://www.hodinkee.com/articles/understanding-the-earliest-heuer-carreras",
      "https://www.hodinkee.com/articles/the-drivers-who-put-heuer-at-the-heart-of-racing",
      "https://www.vintageheuer.com/",
      "https://www.classicheuer.de/en/",
      "https://www.swisswatchexpo.com/thewatchclub/2018/07/12/daytona-and-carrera-more-alike-than-you-know/",
      "https://heuerville.wordpress.com/%E2%96%BA-the-history-of-heuer/",
      "https://www.heuerpriceguide.com/heuer-collector-books",
      // Heuer Price Guide — model-info galleries (distinct from the
      // price-table pages in the Price Guides topic section).
      {
        url: "https://www.heuerpriceguide.com/model-information",
        name: "Heuer Price Guide — model information (hub)",
      },
      {
        url: "https://www.heuerpriceguide.com/carrera-1960s",
        name: "Heuer Price Guide — Carrera 1960s screw-back case (2447/2448) gallery",
      },
      {
        url: "https://www.heuerpriceguide.com/carrera-1970/80s---barrel-case-/-quartz",
        name: "Heuer Price Guide — Carrera 1970s/80s barrel-case + quartz gallery",
      },
      {
        url: "https://www.heuerpriceguide.com/autavia-screw-back-case",
        name: "Heuer Price Guide — Autavia screw-back case 1962–68 gallery",
      },
      {
        url: "https://www.heuerpriceguide.com/autavia-cushion-case6099a6cb",
        name: "Heuer Price Guide — Autavia cushion case 1969–85 (GMT, Siffert, Orange Boy)",
      },
      {
        url: "https://www.heuerpriceguide.com/monaco-case6288295e",
        name: "Heuer Price Guide — Monaco case references 1969–78",
      },
      {
        url: "https://www.heuerpriceguide.com/vintage-heuer-authentication",
        name: "Heuer Price Guide — authentication & valuation service",
      },
      {
        url: "https://www.heuerpriceguide.com/condition-condition-condition",
        name: "Heuer Price Guide — why condition drives vintage Heuer value",
      },
      {
        url: "https://www.heuerpriceguide.com/famous-heuer-ambassadors",
        name: "Heuer Price Guide — famous Heuer ambassadors (McQueen, Jagger, Lauda, Andretti)",
      },
      {
        url: "https://www.heuerpriceguide.com/heuer-parts-for-sale",
        name: "Heuer Price Guide — vintage Heuer parts catalog",
      },
    ],
  },
  {
    // Heuer Camaro reference site — full set of reference index pages.
    // 40+ per-dial-variant deep dives exist one click deeper from
    // each reference index page; not linked individually here to keep
    // this section scannable.
    title: "Heuer Camaro",
    links: [
      { url: "https://www.heuercamaro.com",          name: "Heuer Camaro — reference site" },
      { url: "https://www.heuercamaro.com/history",  name: "Heuer Camaro — history essay" },
      { url: "https://www.heuercamaro.com/features", name: "Heuer Camaro — case, dial, hands, movements, bracelet" },
      { url: "https://www.heuercamaro.com/models",   name: "Heuer Camaro — models (refs 7220, 7228, 9220, 7743, 7843, 73x43/45)" },
      { url: "https://www.heuercamaro.com/models/7220",                    name: "Camaro Ref. 7220 — steel (Valjoux 7730/7733)" },
      { url: "https://www.heuercamaro.com/models/7228-18k-gold",           name: "Camaro Ref. 7228 — 18k gold" },
      { url: "https://www.heuercamaro.com/models/9220",                    name: "Camaro Ref. 9220 — gold-filled" },
      { url: "https://www.heuercamaro.com/models/7743",                    name: "Camaro Ref. 7743 — Valjoux 7740" },
      { url: "https://www.heuercamaro.com/models/7843-dato",               name: "Camaro Ref. 7843 Dato" },
      { url: "https://www.heuercamaro.com/models/73643",                   name: "Camaro Ref. 73643" },
      { url: "https://www.heuercamaro.com/models/73343",                   name: "Camaro Ref. 73343" },
      { url: "https://www.heuercamaro.com/models/73345-gold-plated",       name: "Camaro Ref. 73345 — gold-plated" },
      { url: "https://www.heuercamaro.com/models/73443-dato",              name: "Camaro Ref. 73443 Dato" },
      { url: "https://www.heuercamaro.com/models/73445-dato-gold-plated",  name: "Camaro Ref. 73445 Dato — gold-plated" },
      { url: "https://www.heuercamaro.com/otherco-brands",                 name: "Camaro — other-brand reissues + co-brands + distributor variants" },
    ],
  },
  {
    // Heuerchrono — yachting-chronograph reference (Skipper / Mareographe
    // / Seafarer / Solunar / Carrera Yachting / Regatta). Curated from
    // the site's ~80 reference pages to the highest-leverage entries;
    // the rest are reachable one click deeper from each cluster hub.
    title: "Heuer Yachting & Skipper",
    links: [
      { url: "https://www.heuerchrono.com",                                                              name: "Heuerchrono — vintage yachting chronograph reference" },
      // Skipper essentials
      { url: "https://www.heuerchrono.com/heuer-skipper/heuer-skipper-grid/",                            name: "Skipper grid (refs 7754, 7764, 73464, 1564/15640)" },
      { url: "https://www.heuerchrono.com/heuer-skipper/all-about-heuer-skipper/",                       name: "All about the Heuer Skipper" },
      { url: "https://www.heuerchrono.com/heuer-skipper/the-story-of-the-heuer-skipper/",                name: "The story of the Heuer Skipper" },
      { url: "https://www.heuerchrono.com/heuer-skipper/skipper-gallery/",                               name: "Skipper visual gallery (all dial variants)" },
      { url: "https://www.heuerchrono.com/heuerchrono-com/the-most-rare-skipper-how-many-skipper-we-know-in-total/", name: "Skipper census — how many do we know?" },
      { url: "https://www.heuerchrono.com/heuer-skipper-movements/",                                     name: "Skipper movements reference (Valjoux 7733, 7734, 7740…)" },
      { url: "https://www.heuerchrono.com/heuer-skipper/heuer-skipper-bracelets-and-straps/",            name: "Skipper bracelets & straps (period-correct)" },
      { url: "https://www.heuerchrono.com/how-to-buy-a-vintage-heuer-skipper/",                          name: "How to buy a vintage Heuer Skipper" },
      { url: "https://www.heuerchrono.com/heuer-skipper/wrong-vs-right-about-genuine-parts/",            name: "Skipper authenticity — wrong vs right parts" },
      // Skipper deep dives (selected)
      { url: "https://www.heuerchrono.com/heuer-skipper/new-type-of-skipper-73464/",                     name: "Skipper 73464 — newly-identified variant" },
      { url: "https://www.heuerchrono.com/heuer-skipper/mareographe-2443-reference-mystery-solved-its-a-2447-confirmed/", name: "Mareographe 2443 vs 2447 — reference mystery solved" },
      // Other Heuer yachting model lines
      { url: "https://www.heuerchrono.com/heuer-solunar-heuer-mareographe-abercrombie-fitch-seafarer/",  name: "Mareographe / Seafarer / Solunar (hub)" },
      { url: "https://www.heuerchrono.com/heuer-carrera-yachting/",                                      name: "Heuer Carrera Yachting (hub)" },
      { url: "https://www.heuerchrono.com/heuer-5-dots/",                                                name: "Heuer Regatta '5-dots' (hub)" },
      { url: "https://www.heuerchrono.com/heuer-yacht-timers/",                                          name: "Heuer Yacht Timer stopwatches" },
      // Other-brand yachting hub
      { url: "https://www.heuerchrono.com/vintage-yachting-watches/colored-segment-subdials-for-using-as-regatta-yachting-watches/", name: "Other vintage yachting brands — segment-subdial overview" },
    ],
  },
  // Enicar 101 — split into six clusters because the site is deep
  // enough that one flat section would be a wall. Each cluster maps
  // to one of the Enicar model lines + the reference / provenance
  // research hub.
  {
    title: "Enicar — Reference & Provenance",
    links: [
      { url: "https://enicar101.com",                                                                                    name: "Enicar 101 — home" },
      { url: "https://enicar101.com/information/",                                                                       name: "Enicar 101 — information hub" },
      { url: "https://enicar101.com/serial-reference/",                                                                  name: "Enicar 101 — serial reference database" },
      { url: "https://enicar101.com/enicar-production-dates/",                                                           name: "Enicar 101 — production dates" },
      { url: "https://enicar101.com/racing-heritage-2/",                                                                 name: "Enicar 101 — racing heritage" },
      { url: "https://enicar101.com/brochures-ads/",                                                                     name: "Enicar 101 — brochures & manuals archive" },
      { url: "https://enicar101.com/enicar-book/",                                                                       name: "Enicar 101 — Enicar Book" },
      { url: "https://enicar101.com/blog/",                                                                              name: "Enicar 101 — blog index" },
      // Top provenance pieces (long-form research)
      { url: "https://enicar101.com/2021/11/19/the-correct-reference-of-jim-clarks-sherpa-graph/",                       name: "Provenance: Jim Clark's Sherpa Graph reference" },
      { url: "https://enicar101.com/2020/07/29/stirling-moss-and-his-stirling-moss/",                                    name: "Provenance: Stirling Moss's Sherpa Graph" },
      { url: "https://enicar101.com/2022/05/15/brigitte-bardot-romy-schneider-and-maurice-ronets-aqua-graph/",           name: "Provenance: Bardot / Schneider / Ronet Aqua Graph" },
      { url: "https://enicar101.com/2021/02/04/alain-delons-ultra-dive/",                                                name: "Provenance: Alain Delon's Ultra Dive" },
      { url: "https://enicar101.com/2024/01/14/hans-hass-expedition-xarifa-ii-and-the-enicar-sherpa-dive/",              name: "Provenance: Hans Hass Xarifa II expedition Sherpa Dive" },
      { url: "https://enicar101.com/2021/12/08/1960s-formula-1-drivers-and-the-enicar-sherpa-graph/",                    name: "Provenance: 1960s F1 drivers and the Sherpa Graph" },
      { url: "https://enicar101.com/2025/03/04/the-polish-navy-super-dives/",                                            name: "Provenance: Polish Navy Super Dives" },
      { url: "https://enicar101.com/2023/01/01/east-german-enicar-sherpa-ultradive-in-cuba/",                            name: "Provenance: East German Sherpa Ultradive in Cuba" },
      { url: "https://enicar101.com/2021/01/20/enicar-chronometers-at-the-cold-edge-of-the-world/",                      name: "Provenance: Enicar chronometers on polar expeditions" },
    ],
  },
  {
    title: "Enicar Sherpa Graph",
    links: [
      { url: "https://enicar101.com/sherpa-graph/",                                                                      name: "Sherpa Graph — model overview" },
      { url: "https://enicar101.com/sherpa-graph-mkia/",                                                                 name: "Sherpa Graph MK Ia" },
      { url: "https://enicar101.com/sherpa-graph-mk-1a-roll-call/",                                                      name: "Sherpa Graph MK Ia — Roll Call (serial DB)" },
      { url: "https://enicar101.com/sherpa-graph-mkib/",                                                                 name: "Sherpa Graph MK Ib" },
      { url: "https://enicar101.com/sherpa-graph-ic/",                                                                   name: "Sherpa Graph MK Ic" },
      { url: "https://enicar101.com/serhpa-graph-mk-id/",                                                                name: "Sherpa Graph MK Id (coming soon)" },
      { url: "https://enicar101.com/sherpa-graph-mkii/",                                                                 name: "Sherpa Graph MK IIa" },
      { url: "https://enicar101.com/sherpa-graph-mk-iib/",                                                               name: "Sherpa Graph MK IIb" },
      { url: "https://enicar101.com/sherpa-graph-mkiii/",                                                                name: "Sherpa Graph MK III" },
      { url: "https://enicar101.com/sherpa-graph-iv/",                                                                   name: "Sherpa Graph MK IV" },
      { url: "https://enicar101.com/sherpa-graph-cousins/",                                                              name: "Sherpa Graph Cousins" },
      { url: "https://enicar101.com/2021/04/03/how-to-spot-one-of-500-sherpa-graph-mk1a/",                               name: "How to spot one of 500 Sherpa Graph MK Ia" },
    ],
  },
  {
    title: "Enicar Aqua Graph",
    links: [
      { url: "https://enicar101.com/aqua-graph/",      name: "Aqua Graph — model overview" },
      { url: "https://enicar101.com/aqua-graph-mki/",  name: "Aqua Graph MK Ia" },
      { url: "https://enicar101.com/aqua-graph-mk-ib-2/", name: "Aqua Graph MK Ib" },
      { url: "https://enicar101.com/aqua-graph-mkii/", name: "Aqua Graph MK II" },
      { url: "https://enicar101.com/aqua-graph-mkiii/", name: "Aqua Graph MK III" },
      { url: "https://enicar101.com/aqua-graph-mk-iv/", name: "Aqua Graph MK IV" },
      { url: "https://enicar101.com/2018/06/03/early-aqua-graph-bezel-mystery/", name: "Early Aqua Graph bezel mystery" },
    ],
  },
  {
    title: "Enicar Jet Graph",
    links: [
      { url: "https://enicar101.com/jet-graph/",       name: "Jet Graph — model overview" },
      { url: "https://enicar101.com/jet-graph-mk-i/",  name: "Jet Graph MK Ia" },
      { url: "https://enicar101.com/jet-graph-mk-ib/", name: "Jet Graph MK Ib (coming soon)" },
      { url: "https://enicar101.com/jet-graph-mkii/",  name: "Jet Graph MK II" },
      { url: "https://enicar101.com/jet-graph-mkiii/", name: "Jet Graph MK III" },
      { url: "https://enicar101.com/jet-graph-mkiv/",  name: "Jet Graph MK IV" },
      { url: "https://enicar101.com/2021/06/16/jet-graph-served-its-tour-of-duty/", name: "Jet Graph military service" },
    ],
  },
  {
    title: "Enicar Super Graph",
    links: [
      { url: "https://enicar101.com/super-graph/",            name: "Super Graph — overview" },
      { url: "https://enicar101.com/super-graph-coming-soon/", name: "Super Graph MK I" },
      { url: "https://enicar101.com/super-graph-simonet/",    name: "Super Graph 'Simonet'" },
      { url: "https://enicar101.com/super-graph-mk-ii/",      name: "Super Graph MK II" },
      { url: "https://enicar101.com/super-graph-mk-iii/",     name: "Super Graph MK III" },
      { url: "https://enicar101.com/2020/12/18/enicar-super-graph-simonet/", name: "Super Graph Simonet research" },
    ],
  },
  {
    title: "Enicar Dive Watches",
    links: [
      { url: "https://enicar101.com/dive-watches/",                                                                      name: "Enicar Dive Watches — overview" },
      { url: "https://enicar101.com/sherpa-ultradive/",                                                                  name: "Sherpa Ultradive & OPS" },
      { url: "https://enicar101.com/sherpa-ops/",                                                                        name: "Sherpa OPS" },
      { url: "https://enicar101.com/super-dive-polish-navy/",                                                            name: "Super Dive 'Polish Navy'" },
      { url: "https://enicar101.com/2021/12/30/enicar-sherpa-ultradive-and-ops-sn-research/",                            name: "Sherpa Ultradive & OPS serial research" },
      { url: "https://enicar101.com/2023/08/09/is-the-sherpa-ultradive-older-then-we-thought/",                          name: "Sherpa Ultradive dating research" },
      { url: "https://enicar101.com/2021/03/08/sherpa-dive-review-from-1961/",                                           name: "1961 Sherpa Dive review" },
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

  // Open/closed state for every section, keyed by title. Default: all
  // collapsed. The user opens whatever they're interested in.
  const [openSections, setOpenSections] = useState(() => ({}));
  const toggle = (title) => setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));

  // Normalise a section's `links` entry — accepts a bare URL string
  // OR `{url, name}` when the auto-derived label would be useless
  // (e.g. Phillips sale codes like CH080317).
  const toRefItem = (entry) => {
    if (typeof entry === "string") return { kind: "reference", url: entry };
    return { kind: "reference", url: entry.url, name: entry.name };
  };

  const dealerSection = {
    title: "Dealers",
    items: dealers.map(d => ({ kind: "dealer", name: d.name, url: d.url })),
  };
  const refSections = REFERENCE_SECTIONS.map(s => ({
    title: s.title,
    items: s.links.map(toRefItem),
  }));
  const topicSections = TOPIC_SECTIONS.map(s => ({
    title: s.title,
    items: s.links.map(toRefItem),
  }));

  return (
    <div style={{ paddingTop: 4 }}>
      {onBack && (
        <div style={{ marginBottom: 10 }}>
          <button onClick={onBack} aria-label="Back to Learn" style={{
            border: "none", background: "transparent", color: "var(--text2)",
            fontFamily: "inherit", fontSize: 13, cursor: "pointer", padding: "4px 0",
          }}>← Learn</button>
        </div>
      )}

      {/* Sections render in order: Dealers (auto-derived), then the
          curated References list, then thematic Topic sections. Each
          section is collapsed by default — the user opens what they
          want. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <LinkSection
          {...dealerSection}
          isOpen={!!openSections[dealerSection.title]}
          onToggle={() => toggle(dealerSection.title)}
        />

        {/* Sub-header for the References cluster. Visual breadcrumb so
            "Rolex GMT 1675" reads as a sub-row, not a top-level section. */}
        <div style={{
          fontSize: 11, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: "0.08em", color: "var(--text3)",
          margin: "12px 0 4px",
        }}>
          References
        </div>
        {refSections.map(s => (
          <LinkSection
            key={s.title}
            title={s.title}
            items={s.items}
            isOpen={!!openSections[s.title]}
            onToggle={() => toggle(s.title)}
          />
        ))}

        <div style={{
          fontSize: 11, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: "0.08em", color: "var(--text3)",
          margin: "12px 0 4px",
        }}>
          Themes
        </div>
        {topicSections.map(s => (
          <LinkSection
            key={s.title}
            title={s.title}
            items={s.items}
            isOpen={!!openSections[s.title]}
            onToggle={() => toggle(s.title)}
          />
        ))}
      </div>
    </div>
  );
}

function LinkSection({ title, items, isOpen, onToggle }) {
  return (
    <section style={{
      borderRadius: 12,
      border: "0.5px solid var(--border)",
      background: "var(--card-bg)",
      overflow: "hidden",
    }}>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "14px 16px",
          border: "none", background: "transparent",
          color: "var(--text1)", cursor: "pointer",
          fontFamily: "inherit", textAlign: "left",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)" }}>{title}</span>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>{items.length}</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
             style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 120ms ease" }}
             aria-hidden="true">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
      {isOpen && (
        <div style={{
          padding: "0 12px 12px",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {items.length === 0 ? (
            <div style={{ padding: "8px 4px 0", fontSize: 12, color: "var(--text3)" }}>
              Nothing curated here yet — check back as the section grows.
            </div>
          ) : (
            items.map(item => <LinkRow key={item.url} {...item} />)
          )}
        </div>
      )}
    </section>
  );
}

function LinkRow({ kind, name, url }) {
  // Two visual variants share the same shell. Dealer rows lead with the
  // dealer name (left) + bare host (right). Reference rows lead with a
  // derived path label (left) + bare host (right) — a path-derived title
  // reads better than a wall of "hodinkee.com / hodinkee.com / ...".
  // Reference rows can ALSO carry an explicit `name` override when the
  // auto-derived label would be useless (Phillips sale codes etc.).
  const { host, label } = describeLink(url);
  const primary = kind === "dealer"
    ? name
    : (name || label || host);
  const secondary = kind === "dealer"
    ? host
    : (name ? host : (label ? host : ""));
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={url} style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
      padding: "10px 12px", borderRadius: 8,
      border: "0.5px solid var(--border)", background: "var(--surface)",
      color: "var(--text1)", fontFamily: "inherit", textDecoration: "none",
    }}>
      <span style={{ fontWeight: 500, fontSize: 13, minWidth: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {primary}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
                    color: "var(--text3)", fontSize: 11 }}>
        {secondary && (
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                         maxWidth: 220 }}>
            {secondary}
          </span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </span>
    </a>
  );
}
