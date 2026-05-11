import React from "react";
import { Card } from "./Card";

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

const CARDS_PER_SECTION = 6;

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
        // Mobile: horizontal scroll snap. Desktop: 6-up grid.
        ...(isMobile ? {
          display: "flex", gap: 1, overflowX: "auto", overflowY: "hidden",
          padding: "0 16px 4px", scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        } : {
          display: "grid", gridTemplateColumns: `repeat(${Math.min(CARDS_PER_SECTION, slice.length)}, minmax(0, 1fr))`,
          gap: 1, background: "var(--border)", padding: 0, margin: "0 16px",
          borderRadius: 10, overflow: "hidden",
        }),
      }}>
        {slice.map(item => (
          <div key={item.id} style={isMobile ? {
            flex: "0 0 70%", maxWidth: 280, scrollSnapAlign: "start", background: "var(--card-bg)",
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
    isMobile,
    watchlist, hidden, handleWish, toggleHide, primaryCurrency,
    onShare, onView, onClickListing, openCollectionPicker, isAdmin,
    user, compact,
  } = props;

  return (
    <div style={{ paddingTop: 8, paddingBottom: 40 }}>
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
