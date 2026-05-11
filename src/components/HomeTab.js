import React, { useState } from "react";
import { Card } from "./Card";
import { SearchIcon } from "./icons";

// Home tab — step 1 (2026-05-11).
//
// Three horizontal section strips: Recently added (live dealer
// listings), Recently sold (dealer + auction lots), Closing next
// (active auction lots, ending soonest). Each "View all →" routes
// the user to the matching Listings sub-tab.
//
// Scope decisions (locked with Mark 2026-05-11):
// - Not the new default — Listings stays the cold landing. Home is
//   reachable via the Watchlist wordmark in both shells.
// - 6 cards per section, horizontal scroll on mobile, 6-in-a-row
//   on desktop.
// - No filter row, no search bar — those come in step 2.
// - Editorial typography (bleed bars, serif eyebrows, "by the best
//   dealers" descriptors) parked for step 4 — this step ships with
//   the existing type scale and Card so adjacent tabs don't read
//   as a different app.
//
// The component is self-contained on purpose. The last Home attempt
// added useState/useMemo deep in App.js and tripped React #310 by
// growing the hook list past existing early-return paths.
// `<ShareReceiver/>` is the reference pattern for "new feature, no
// new App.js hooks". HomeTab here is render-only — every slice it
// shows is precomputed in App.js and handed in as a prop.

// Two rows × six columns = 12 cards per section. Per Mark 2026-05-11:
// one row felt thin; two reads as a curated set without losing the
// "this is a slice, not the firehose" feel. The App.js slice memos
// already cap at 12 so this just renders all of them.
const CARDS_PER_SECTION = 12;
const COLS_PER_ROW = 6;

// Horizontal scroll on mobile; CSS Grid on desktop with the same
// column count as the Listings grid would have at the user's
// configured `cols` (see App.js). We compute `cols` from window
// width via the shell, but pass `compact` so the Card renders the
// same way it does elsewhere — no special variant.
function SectionStrip({ eyebrow, heading, items, onViewAll, isMobile, watchlist, hidden, handleWish, toggleHide, primaryCurrency, onShare, onView, onClickListing, openCollectionPicker, isAdmin, user, compact }) {
  if (!items || items.length === 0) return null;
  const slice = items.slice(0, CARDS_PER_SECTION);
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 16px", marginBottom: 10, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          {eyebrow && (
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 4 }}>
              {eyebrow}
            </div>
          )}
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text1)", letterSpacing: "-0.2px" }}>
            {heading}
          </h2>
        </div>
        <button onClick={onViewAll}
          style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: "var(--text2)" }}>
          View all →
        </button>
      </div>
      <div style={{
        // Mobile: 2-row horizontal scroll (grid-auto-flow:column so
        // items flow top-to-bottom then left-to-right; row 1 has card
        // 1+3+5..., row 2 has card 2+4+6...). Desktop: 6-col × 2-row
        // grid that wraps naturally. Both surface 12 cards.
        ...(isMobile ? {
          display: "grid", gridAutoFlow: "column",
          gridTemplateRows: "repeat(2, minmax(0, auto))",
          gridAutoColumns: "70%",
          gap: 1, overflowX: "auto", overflowY: "hidden",
          padding: "0 16px 4px",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          background: "var(--border)",
        } : {
          display: "grid", gridTemplateColumns: `repeat(${COLS_PER_ROW}, minmax(0, 1fr))`,
          gap: 1, background: "var(--border)", padding: 0, margin: "0 16px",
          borderRadius: 10, overflow: "hidden",
        }),
      }}>
        {slice.map(item => (
          <div key={item.id} style={isMobile ? {
            scrollSnapAlign: "start", background: "var(--card-bg)", minWidth: 0,
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

// Search composite — step 2 (2026-05-11). Single text input plus a
// three-chip target row: Listings / Auctions / Sold. Tapping any chip
// commits the query to App.js's `search` state, navigates to Listings
// with the matching sub-tab pre-selected, and resets pagination. The
// existing filter pipeline (`allFiltered`) does the rest — no special
// search logic needed here. Enter in the input defaults to Listings.
//
// State is local to this component (the input value). Lifted on
// submit only — keeps the global `search` state from oscillating as
// the user types on Home.
function HomeSearchBar({ onSubmit, isMobile }) {
  const [draft, setDraft] = useState("");
  const fire = (target) => {
    const q = draft.trim();
    onSubmit(q, target);
  };
  const targets = [
    ["live",     "Listings"],
    ["auctions", "Auctions"],
    ["sold",     "Sold"],
  ];
  return (
    <section style={{ padding: isMobile ? "0 16px 24px" : "8px 16px 28px" }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 6 }}>
        Search the market
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", borderRadius: 12, padding: "10px 14px", border: "0.5px solid var(--border)" }}>
        <SearchIcon />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fire("live"); } }}
          placeholder="Reference, brand, model…"
          style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, color: "var(--text1)", outline: "none", fontFamily: "inherit", minWidth: 0 }}
        />
        {draft && (
          <button onClick={() => setDraft("")} aria-label="Clear" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 2, fontFamily: "inherit", display: "flex" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text3)", alignSelf: "center", marginRight: 4 }}>Go to →</span>
        {targets.map(([key, label]) => (
          <button key={key} onClick={() => fire(key)}
            style={{
              padding: "6px 12px", borderRadius: 999,
              border: "0.5px solid var(--border)",
              background: "var(--card-bg)", color: "var(--text1)",
              fontFamily: "inherit", fontSize: 12, fontWeight: 500,
              cursor: "pointer",
            }}>
            {label}{draft.trim() ? ` "${draft.trim().length > 18 ? draft.trim().slice(0, 18) + "…" : draft.trim()}"` : ""}
          </button>
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
    <div style={{ paddingTop: 8, paddingBottom: 40 }}>
      {homeSearchSubmit && (
        <HomeSearchBar onSubmit={homeSearchSubmit} isMobile={isMobile} />
      )}
      <SectionStrip
        eyebrow="On the feed"
        heading="Recently added"
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
        eyebrow="Closing soon"
        heading="Ending next at auction"
        items={homeEndingNext}
        onViewAll={goToEndingNext}
        isMobile={isMobile}
        watchlist={watchlist} hidden={hidden} handleWish={handleWish}
        toggleHide={toggleHide} primaryCurrency={primaryCurrency}
        onShare={onShare} onView={onView} onClickListing={onClickListing}
        openCollectionPicker={openCollectionPicker} isAdmin={isAdmin}
        user={user} compact={compact}
      />
      <SectionStrip
        eyebrow="Just settled"
        heading="Recently sold"
        items={homeRecentSold}
        onViewAll={goToRecentSold}
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
