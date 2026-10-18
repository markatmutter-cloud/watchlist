import React, { useEffect, useState, useCallback } from "react";
import { ReferencePage } from "./ReferencePage";
import { Breadcrumb } from "./Breadcrumb";
import { Pill, Chip, ChipPanel, SavedPill, SearchField, FilterBar, PageFrame, HeaderSearch, Button, OverlayHeart, OverlayMenu, MenuItem, Textarea } from "../ui";
import { editorialHeading, editorialProse, editorialTitle, cardGridStyle, FONT_SERIF } from "../styles";
import { imgSrc } from "../utils";
import {
  REFERENCE_NODES,
  REFERENCE_NODES_BY_ID,
  isLiveNode,
  referenceUpdatedAt,
  referenceAsListing,
} from "../data/referencePages";
import { askLumeAbout } from "./LumeBus";

// Reference browse surface (Collecting ▸ Reference guides).
//
// 2026-06-01 (Mark): while the corpus is small, the brand→model-line→reference
// TREE was over-built — three taps to reach four guides. Flattened to a single
// card grid (hero + reference name, like the Articles tab), newest-updated
// first, with a search box + brand filter on top. The hierarchy returns when
// the corpus grows. Live nodes open the full ReferencePage; coming_soon stubs
// open a teaser with a "subscribe to unlock" demand smoke test.
//
// Self-contained nav (its own ?ref URL param) so it adds NO hooks to App.js's
// top level (React #310 safety).

const comingBadge = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "var(--text3)",
  border: "0.5px solid var(--border)",
  borderRadius: 999,
  padding: "1px 7px",
};

function viewFromSearch(search) {
  const p = new URLSearchParams(search || "");
  const ref = p.get("ref");
  if (ref) return { level: "node", nodeId: ref };
  return { level: "home" };
}

// Build a URL from the CURRENT location, replacing only the ?ref param —
// preserves the app's ?tab=/?sub= params so the sub-tab stays selected.
function urlForView(view) {
  const p = new URLSearchParams(window.location.search);
  ["ref", "rbrand", "rmodel"].forEach((k) => p.delete(k));
  if (view.level === "node") p.set("ref", view.nodeId);
  const qs = p.toString();
  return qs ? "?" + qs : window.location.pathname;
}

export function ReferenceBrowse(props) {
  const { isMobile } = props;
  const [view, setView] = useState(() => viewFromSearch(window.location.search));
  const [q, setQ] = useState("");
  // Brand filter — multi-select via a Brand pill + chip expansion panel
  // (P-4, 2026-06-03): the spelled-out brand row under the search didn't
  // match the Articles pattern; same pill + panel as every other surface.
  const [activeBrands, setActiveBrands] = useState([]);
  // ♥ Saved — filter to guides the user has saved (P-4; label never
  // "Hearted" — Mark's no-hearted-label rule).
  const [heartedOnly, setHeartedOnly] = useState(false);
  const [activeFilterPop, setActiveFilterPop] = useState(null);

  useEffect(() => {
    const onPop = () => setView(viewFromSearch(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Drill-in pushes (browser-back returns to the grid); see CLAUDE.md nav rules.
  const go = useCallback((next) => {
    window.history.pushState({}, "", urlForView(next));
    setView(next);
  }, []);

  // Re-tap of the active Reference Guides top pill → exit a drilled-in guide
  // back to the index (P-15, Mark 2026-06-03). The breadcrumb stays as the
  // second door. URL cleanup is a REPLACE (drops ?ref) per CLAUDE.md nav
  // rules — the drill-in itself was the pushState.
  useEffect(() => {
    if (!props.resetTick || props.resetTick <= 0) return;
    setView((v) => {
      if (v.level !== "node") return v;
      try { window.history.replaceState({}, "", urlForView({ level: "home" })); } catch {}
      return { level: "home" };
    });
  }, [props.resetTick]);

  // ── Reference leaf (full guide / coming-soon teaser) ────────────
  if (view.level === "node") {
    const node = REFERENCE_NODES_BY_ID[view.nodeId];
    if (!node) return <NotFound onHome={() => go({ level: "home" })} />;
    const crumbs = [
      { label: "Reference guides", onClick: () => go({ level: "home" }) },
      { label: node.group || (node.refs || []).join(" / ") },
    ];
    return (
      <PageFrame>
        <Breadcrumb items={crumbs} />
        {isLiveNode(node) ? (
          <ReferencePage
            node={node}
            items={props.items || []}
            isMobile={isMobile}
            watchlist={props.watchlist}
            handleWish={props.handleWish}
            openCollectionPicker={props.openCollectionPicker}
            handleShare={props.handleShare}
            hidden={props.hidden}
            primaryCurrency={props.primaryCurrency}
            compact={props.compact}
            user={props.user}
            onClickListing={props.onClickListing}
            onViewAll={props.onViewAll}
          />
        ) : (
          <ComingSoon node={node} isMobile={isMobile}>
            <ReferencePage
              node={node}
              items={props.items || []}
              isMobile={isMobile}
              primaryCurrency={props.primaryCurrency}
              compact={props.compact}
            />
          </ComingSoon>
        )}
      </PageFrame>
    );
  }

  // ── Card landing (flat grid + standard filter bar) ──────────────
  const brandCounts = REFERENCE_NODES.reduce((acc, n) => {
    if (n.brand) acc[n.brand] = (acc[n.brand] || 0) + 1;
    return acc;
  }, {});
  const brands = Object.keys(brandCounts).sort((a, b) => brandCounts[b] - brandCounts[a] || a.localeCompare(b));
  const ql = q.trim().toLowerCase();
  const cards = REFERENCE_NODES
    .filter((n) => activeBrands.length === 0 || activeBrands.includes(n.brand))
    .filter((n) => {
      if (!heartedOnly) return true;
      const asListing = referenceAsListing(n);
      return !!(asListing && props.watchlist && props.watchlist[asListing.id]);
    })
    .filter((n) => {
      if (!ql) return true;
      const hay = [n.brand, n.modelLine, n.group, (n.refs || []).join(" "), n.definer]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(ql);
    })
    .sort((a, b) => {
      const al = isLiveNode(a), bl = isLiveNode(b);
      if (al !== bl) return al ? -1 : 1; // live guides first, coming-soon last
      return referenceUpdatedAt(b).localeCompare(referenceUpdatedAt(a)); // newest updated first
    });
  // The Saved heart is a filter pill again (2026-10-16), so it raises
  // "× Clear all" and is swept by it. `narrowing` (search / brand) is what
  // tells the "nothing saved yet" invite from "no matches".
  const narrowing = !!ql || activeBrands.length > 0;
  const hasFilters = narrowing || heartedOnly;
  const clearAll = () => { setQ(""); setActiveBrands([]); setHeartedOnly(false); setActiveFilterPop(null); };
  const toggleBrand = (b) =>
    setActiveBrands((prev) => prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]);

  // Built from src/ui (Mark, 2026-10-17): no page title, the filter bar sticks under the
  // header, one inset, and the search is the same field on a phone and a desktop.
  const filterBarJSX = (
    <FilterBar
      sticky
      count={`${cards.length} ${cards.length === 1 ? "guide" : "guides"}`}
      pills={
        <>
          <Pill on={activeBrands.length > 0 || activeFilterPop === "brand"} n={activeBrands.length || null}
                onClick={() => setActiveFilterPop((p) => (p === "brand" ? null : "brand"))}>Brand</Pill>
          <SavedPill on={heartedOnly} onClick={() => setHeartedOnly((v) => !v)} what="saved guides" />
          {hasFilters && <Pill quiet onClick={clearAll}>× Clear all</Pill>}
        </>
      }
      panel={activeFilterPop === "brand" ? (
        <ChipPanel>
          {brands.map((b) => (
            <Chip key={b} on={activeBrands.includes(b)} n={brandCounts[b]}
                  onClick={() => toggleBrand(b)}>{b}</Chip>
          ))}
        </ChipPanel>
      ) : null}
    />
  );

  return (
    <>
    <HeaderSearch>
      <SearchField
        size={isMobile ? "full" : "bar"}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onClear={() => setQ("")}
        placeholder="Search guides…"
        ariaLabel="Search guides" />
    </HeaderSearch>
    <PageFrame filterBar={filterBarJSX}>
      {cards.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text3)" }}>
          {/* Saved sub-tab with nothing saved is an invite, not a dead end. */}
          {heartedOnly && !narrowing
            ? "Nothing saved yet. Tap the heart on any guide and it lands here."
            : "No guides match your search."}
        </p>
      ) : (
        <div style={cardGridStyle({ isMobile })}>
          {cards.map((n) => (
            <RefGuideCard key={n.id} node={n} isMobile={isMobile}
              onClick={() => go({ level: "node", nodeId: n.id })}
              watchlist={props.watchlist} handleWish={props.handleWish}
              openCollectionPicker={props.openCollectionPicker} handleShare={props.handleShare}
              user={props.user} />
          ))}
        </div>
      )}
    </PageFrame>
    </>
  );
}

// ── Presentational helpers ────────────────────────────────────────

// Article-style guide card: hero on top, brand·model kicker, serif reference
// name. Carries the same heart + ⋯ actions as article cards (Mark 2026-06-02)
// — save / add to list / share / Ask Lumé — via referenceAsListing(node).
function RefGuideCard({ node, isMobile, onClick, watchlist, handleWish, openCollectionPicker, handleShare, user }) {
  const coming = !isLiveNode(node);
  const title = node.group || (node.refs || []).join(" / ");
  const asListing = referenceAsListing(node);
  const wished = !!(watchlist && asListing && watchlist[asListing.id]);
  const onKey = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } };
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  const hasActions = asListing && (handleWish || (openCollectionPicker && user) || handleShare);
  return (
    <div style={{ position: "relative" }}>
      <div role="button" tabIndex={0} onClick={onClick} onKeyDown={onKey} style={{
        textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "block",
      }}>
        <div style={{
          position: "relative", width: "100%", aspectRatio: "16 / 10",
          background: "var(--surface)", overflow: "hidden", marginBottom: 12,
        }}>
          {node.hero && node.hero.img && (
            <img src={imgSrc(node.hero.img)} alt="" loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
          )}
          {coming && (
            <span style={{
              position: "absolute", top: 8, left: 8,
              fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase",
              color: "#fff", background: "rgba(0,0,0,0.5)", borderRadius: 999, padding: "2px 8px",
            }}>Coming soon</span>
          )}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "var(--text3)", marginBottom: 4,
        }}>{[node.brand, node.modelLine].filter(Boolean).join(" · ")}</div>
        <div style={{ ...editorialTitle({ isMobile }), color: "var(--text1)" }}>{title}</div>
        {node.definer && (
          <div style={{
            fontSize: 12, color: "var(--text2)", lineHeight: 1.4, marginTop: 4,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>{node.definer}</div>
        )}
      </div>
      {hasActions && (
        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
          {handleWish && (
            <OverlayHeart on={wished} onClick={(e) => { stop(e); handleWish(asListing); }}
              aria-label={wished ? "Saved: tap to remove" : "Save guide"} />
          )}
          {((openCollectionPicker && user) || handleShare) && (
            <OverlayMenu label="More">
              {({ close }) => (
                <>
                  {openCollectionPicker && user && (
                    <MenuItem onClick={() => { close(); openCollectionPicker(asListing); }}>Add to list…</MenuItem>
                  )}
                  {handleShare && (
                    <MenuItem onClick={() => { close(); handleShare(asListing); }}>Share</MenuItem>
                  )}
                  <MenuItem onClick={() => { close(); askLumeAbout(asListing); }}>Ask Lumé</MenuItem>
                </>
              )}
            </OverlayMenu>
          )}
        </div>
      )}
    </div>
  );
}

function ComingSoon({ node, isMobile, children }) {
  // Coming-soon guides render the REAL guide layout (hero, nav, whatever the
  // stub carries) under a frosted overlay, so the page reads as a preview of
  // the finished thing rather than a placeholder (Mark 2026-06-07). The frost
  // starts below the hero so the photograph and title stay readable. The
  // interest button is the demand smoke test (local state; a
  // reference_interest table is the follow-up). The suggestion box sends via
  // mail so it works without auth or a new table.
  const [noted, setNoted] = useState(false);
  const [note, setNote] = useState("");
  const heroH = isMobile ? 320 : 480;
  const send = () => {
    const subject = encodeURIComponent(`Reference guide suggestion (${node.brand} ${node.modelLine})`);
    const body = encodeURIComponent(note || "");
    window.location.href = `mailto:mark@mutter.co.uk?subject=${subject}&body=${body}`;
  };
  return (
    <div style={{ position: "relative" }}>
      <div style={{ pointerEvents: "none" }} aria-hidden="true">{children}</div>
      <div style={{
        position: "absolute", left: 0, right: 0, top: heroH, bottom: 0, zIndex: 16,
        background: "color-mix(in srgb, var(--bg) 55%, transparent)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        display: "flex", justifyContent: "center", alignItems: "flex-start",
      }}>
        <div style={{ maxWidth: 480, width: "100%", margin: isMobile ? "40px 16px" : "72px 20px", background: "var(--bg)", border: "0.5px solid var(--border)", borderRadius: 14, padding: isMobile ? 18 : 24, boxShadow: "0 8px 40px rgba(0,0,0,0.12)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--brand-olive-text)", marginBottom: 8 }}>Coming soon</div>
          <div style={{ fontFamily: FONT_SERIF, fontSize: isMobile ? 20 : 23, fontWeight: 600, color: "var(--text1)", lineHeight: 1.2, marginBottom: 8 }}>
            The {node.group} guide is on the way
          </div>
          {node.teaser && <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text2)", margin: "0 0 14px" }}>{node.teaser}</p>}
          {noted ? (
            <div style={{ fontSize: 13, color: "var(--text1)", fontWeight: 600, marginBottom: 16 }}>✓ Noted. We'll let you know when it's live.</div>
          ) : (
            <Button small primary inline onClick={() => setNoted(true)} style={{ marginBottom: 16 }}>I want this guide</Button>
          )}
          <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", marginBottom: 6 }}>Help shape the guides</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text2)", marginBottom: 10 }}>
              Suggest the next reference we should cover, or tell us what to add or change in the guides so far.
            </div>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              placeholder="A reference you'd like covered, or a fix for an existing guide…" />
            <Button small inline onClick={send} disabled={!note.trim()} style={{ marginTop: 8 }}>Send suggestion</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotFound({ onHome }) {
  return (
    <div style={{ paddingTop: 4 }}>
      <p style={{ fontSize: 14, color: "var(--text2)" }}>That reference isn't available.</p>
      <Button link onClick={onHome}>← Back to reference guides</Button>
    </div>
  );
}
