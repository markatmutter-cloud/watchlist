import React, { useState } from "react";
import { Card } from "./Card";
import { SearchIcon } from "./icons";

// Home tab — phase 4 polish (2026-05-11).
//
// Editorial landing: a centered uppercase "WATCHLIST" hero block, a
// dominant search composite with Listings as the primary submit
// (Auctions/Sold underneath), then three single-row section strips
// in the order Mark settled on:
//   Recently added → Recently sold → Ending next at auction.
//
// Scope decisions (confirmed with Mark 2026-05-11):
// - One row × 7 cards per section. Two rows felt heavy; 7 in a row
//   tightens the images and makes each section read as a slice.
// - Top-bar search input is suppressed on Home (shells gate on
//   tab === "home") to avoid the duplicate-search-bar pattern.
// - Persistent top-bar wordmark + tab pills stay for navigation —
//   the centered editorial wordmark in the body is a brand hero,
//   not the nav surface (Fratello reference: persistent right-side
//   sign-up + centered brand block coexist).
// - No new typefaces. Editorial feel comes from letter-spacing,
//   uppercase, thin horizontal rules — not serif imports.
//
// Component is render-only — every list it shows comes in as a
// precomputed prop. Hooks live in App.js above the loading early
// returns (CLAUDE.md "Don't add new useState/useMemo/useCallback
// deep into App.js").

const CARDS_PER_SECTION = 7;
const COLS_PER_ROW = 7;

// Centered "WATCHLIST" editorial wordmark.
// References Mark sent (Fratello + Hodinkee): centered, uppercase,
// generous whitespace, refined weight — not bold. Hodinkee in
// particular stands the wordmark alone with no tagline ornament;
// that restraint is what makes it read as editorial rather than
// branded-for-loudness. No new typefaces — letter-spacing + size
// + the existing system stack do the lift. Thin hairline rule
// below separates the editorial header from the body content
// (mirrors the rule both references use under their wordmark).
function EditorialHero({ isMobile }) {
  return (
    <section style={{
      padding: isMobile ? "24px 16px 18px" : "40px 16px 22px",
      textAlign: "center",
      borderBottom: "0.5px solid var(--border)",
      marginBottom: isMobile ? 20 : 28,
    }}>
      <h1 style={{
        margin: 0,
        fontFamily: "inherit",
        fontSize: isMobile ? 32 : 52,
        fontWeight: 500,
        letterSpacing: isMobile ? "0.16em" : "0.18em",
        color: "var(--text1)",
        textTransform: "uppercase",
        // Preserve the trailing letter-spacing visually by nudging
        // the wordmark right by half a "track" so it looks centered.
        paddingLeft: isMobile ? "0.16em" : "0.18em",
      }}>
        Watchlist
      </h1>
    </section>
  );
}

// Search composite — phase 4b (2026-05-11). Listings is the primary
// submit (dark pill inside the input on the right; Enter also fires
// it). Auctions and Sold sit RIGHT UNDER that button as a small
// secondary chip cluster — popover-style, right-aligned to the
// primary action. Reads as "the same dropdown, but flattened" — no
// open/close toggle state, no JS, just visual hierarchy.
function HomeSearchBar({ onSubmit, isMobile }) {
  const [draft, setDraft] = useState("");
  const fire = (target) => {
    const q = draft.trim();
    onSubmit(q, target);
  };
  return (
    <section style={{ padding: isMobile ? "0 16px 28px" : "0 16px 36px", maxWidth: 720, margin: "0 auto", width: "100%" }}>
      <div style={{
        display: "flex", alignItems: "stretch",
        background: "var(--surface)", borderRadius: 12,
        border: "0.5px solid var(--border)",
        overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", flex: 1, minWidth: 0 }}>
          <SearchIcon />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fire("live"); } }}
            placeholder="Reference, brand, model…"
            style={{ flex: 1, border: "none", background: "transparent", fontSize: 15, color: "var(--text1)", outline: "none", fontFamily: "inherit", minWidth: 0, padding: "13px 0" }}
          />
          {draft && (
            <button onClick={() => setDraft("")} aria-label="Clear" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 2, fontFamily: "inherit", display: "flex", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <button onClick={() => fire("live")}
          style={{
            flexShrink: 0,
            border: "none", borderLeft: "0.5px solid var(--border)",
            background: "var(--text1)", color: "var(--bg)",
            fontFamily: "inherit", fontSize: 13, fontWeight: 600,
            letterSpacing: "0.04em", cursor: "pointer",
            padding: isMobile ? "0 16px" : "0 22px",
            display: "flex", alignItems: "center", gap: 6,
          }}>
          Search Listings <span aria-hidden style={{ fontSize: 14 }}>→</span>
        </button>
      </div>
      {/* Secondary search targets — sit directly under the Search
          Listings button, right-aligned. Visual descendents of the
          primary CTA; reads as an "or…" dropdown without needing a
          toggle interaction. */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 8, paddingRight: 2 }}>
        <span style={{ fontSize: 11, color: "var(--text3)", alignSelf: "center", marginRight: 2 }}>or in</span>
        <button onClick={() => fire("auctions")}
          style={{
            padding: "5px 12px", borderRadius: 999,
            border: "0.5px solid var(--border)", background: "var(--card-bg)",
            color: "var(--text1)", fontFamily: "inherit", fontSize: 12,
            fontWeight: 500, cursor: "pointer",
          }}>
          Auctions
        </button>
        <button onClick={() => fire("sold")}
          style={{
            padding: "5px 12px", borderRadius: 999,
            border: "0.5px solid var(--border)", background: "var(--card-bg)",
            color: "var(--text1)", fontFamily: "inherit", fontSize: 12,
            fontWeight: 500, cursor: "pointer",
          }}>
          Sold
        </button>
      </div>
    </section>
  );
}

// One-row horizontal section. Desktop renders 7 cards in a CSS grid;
// mobile flips to a horizontal scroll with snap so cards 4-7 slide in
// from the right. The strip surfaces 7 — App.js still caps the slice
// at 12 so future grid changes don't require a data plumbing change.
// Eyebrow labels removed 2026-05-11 — Mark feedback: they
// duplicated the heading text below ("ON THE FEED" + "Recently
// added"). Heading + descriptor carry the editorial signal on
// their own.
function SectionStrip({ heading, descriptor, items, onViewAll, isMobile, watchlist, hidden, handleWish, toggleHide, primaryCurrency, onShare, onView, onClickListing, openCollectionPicker, isAdmin, user, compact }) {
  if (!items || items.length === 0) return null;
  const slice = items.slice(0, CARDS_PER_SECTION);
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 16px", marginBottom: 12, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--text1)", letterSpacing: "-0.3px" }}>
            {heading}
          </h2>
          {descriptor && (
            <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 4, maxWidth: 480 }}>
              {descriptor}
            </div>
          )}
        </div>
        <button onClick={onViewAll}
          style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: "var(--text2)" }}>
          View all →
        </button>
      </div>
      <div style={{
        ...(isMobile ? {
          display: "flex", gap: 1, overflowX: "auto", overflowY: "hidden",
          padding: "0 16px 4px", scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch", background: "var(--border)",
        } : {
          display: "grid", gridTemplateColumns: `repeat(${COLS_PER_ROW}, minmax(0, 1fr))`,
          gap: 1, background: "var(--border)", padding: 0, margin: "0 16px",
          borderRadius: 10, overflow: "hidden",
        }),
      }}>
        {slice.map(item => (
          <div key={item.id} style={isMobile ? {
            flex: "0 0 60%", maxWidth: 240, scrollSnapAlign: "start", background: "var(--card-bg)",
          } : { minWidth: 0 }}>
            <Card item={item} wished={!!watchlist[item.id]} onWish={handleWish}
              compact={compact}
              onHide={isAdmin ? toggleHide : undefined}
              isHidden={!!hidden[item.id]}
              onAddToCollection={user ? openCollectionPicker : undefined}
              primaryCurrency={primaryCurrency}
              onShare={onShare} onView={onView} onClickListing={onClickListing} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function HomeTab(props) {
  const {
    homeRecentAdded, homeRecentSold, homeEndingNext,
    goToRecentAdded, goToRecentSold, goToEndingNext,
    homeSearchSubmit,
    isMobile,
    watchlist, hidden, handleWish, toggleHide, primaryCurrency,
    onShare, onView, onClickListing, openCollectionPicker, isAdmin,
    user, compact,
  } = props;

  return (
    <div style={{ paddingBottom: 40 }}>
      <EditorialHero isMobile={isMobile} />
      {homeSearchSubmit && (
        <HomeSearchBar onSubmit={homeSearchSubmit} isMobile={isMobile} />
      )}
      <SectionStrip
        heading="Recently added"
        descriptor="The newest pieces from the dealers I follow — straight off the wire."
        items={homeRecentAdded}
        onViewAll={goToRecentAdded}
        isMobile={isMobile}
        watchlist={watchlist} hidden={hidden} handleWish={handleWish}
        toggleHide={toggleHide} primaryCurrency={primaryCurrency}
        onShare={onShare} onView={onView} onClickListing={onClickListing}
        openCollectionPicker={openCollectionPicker} isAdmin={isAdmin}
        user={user} compact={compact}
      />
      <SectionStrip
        heading="Recently sold"
        descriptor="What just changed hands — dealers and auction houses, the most recent results first."
        items={homeRecentSold}
        onViewAll={goToRecentSold}
        isMobile={isMobile}
        watchlist={watchlist} hidden={hidden} handleWish={handleWish}
        toggleHide={toggleHide} primaryCurrency={primaryCurrency}
        onShare={onShare} onView={onView} onClickListing={onClickListing}
        openCollectionPicker={openCollectionPicker} isAdmin={isAdmin}
        user={user} compact={compact}
      />
      <SectionStrip
        heading="Ending next at auction"
        descriptor="Bids about to close across Antiquorum, Christie's, Sotheby's, and Phillips."
        items={homeEndingNext}
        onViewAll={goToEndingNext}
        isMobile={isMobile}
        watchlist={watchlist} hidden={hidden} handleWish={handleWish}
        toggleHide={toggleHide} primaryCurrency={primaryCurrency}
        onShare={onShare} onView={onView} onClickListing={onClickListing}
        openCollectionPicker={openCollectionPicker} isAdmin={isAdmin}
        user={user} compact={compact}
      />
    </div>
  );
}
