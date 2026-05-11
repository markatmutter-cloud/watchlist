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

// Editorial hero — phase 4c (2026-05-11). Restraint dial-up per
// Mark feedback after #228: drop the weight and tracking a notch,
// flank an italic tagline with hairline rules above + below. Reads
// as a masthead rather than a header label. No new typefaces — the
// system stack carries the italic via the regular `font-style`.
function EditorialHero({ isMobile }) {
  return (
    <section style={{
      padding: isMobile ? "28px 16px 22px" : "52px 16px 30px",
      textAlign: "center",
    }}>
      <div style={{ height: 0.5, background: "var(--border)", margin: isMobile ? "0 0 22px" : "0 0 30px" }} />
      <h1 style={{
        margin: isMobile ? "0 0 22px" : "0 0 30px",
        fontFamily: "inherit",
        fontSize: isMobile ? 34 : 56,
        fontWeight: 400,
        letterSpacing: isMobile ? "0.14em" : "0.16em",
        color: "var(--text1)",
        textTransform: "uppercase",
        // Visual centering: nudge right by half a "track" so the
        // trailing letter-spacing on the last glyph doesn't pull
        // the wordmark visually left.
        paddingLeft: isMobile ? "0.14em" : "0.16em",
      }}>
        Watchlist
      </h1>
      <div style={{ height: 0.5, background: "var(--border)" }} />
    </section>
  );
}

// Live counts strip — small caps under the hero confirming the
// value prop at a glance. Numbers come from the same arrays
// every other surface reads.
function LiveCounts({ counts }) {
  if (!counts) return null;
  const fmt = (n) => (n || 0).toLocaleString("en-US");
  return (
    <div style={{
      textAlign: "center", padding: "14px 16px 22px",
      fontSize: 11, fontWeight: 500, letterSpacing: "0.18em",
      textTransform: "uppercase", color: "var(--text3)",
    }}>
      Status: {fmt(counts.listings)} listings · {fmt(counts.lots)} lots
    </div>
  );
}

// Search composite — phase 4d (2026-05-11). Now in a full-width
// inverted bleed band: the dark treatment moved off the Ending-Next
// section (white cards on black read as harsh) onto the search
// surface, which is text + input only and absorbs the dark mood
// cleanly. Negative-margin escape uses shellPad to bleed past the
// parent shell's horizontal padding. The search input itself stays
// light/elevated so it reads as a tappable surface against the dark
// frame.
function HomeSearchBar({ onSubmit, isMobile, shellPad }) {
  const [draft, setDraft] = useState("");
  const fire = (target) => {
    const q = draft.trim();
    onSubmit(q, target);
  };
  return (
    <section style={{
      background: "var(--text1)",
      color: "var(--bg)",
      marginLeft: -shellPad,
      marginRight: -shellPad,
      padding: isMobile ? "32px 16px 28px" : "44px 20px 40px",
      marginBottom: isMobile ? 28 : 36,
    }}>
    <div style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
      <div style={{
        display: "flex", alignItems: "stretch",
        background: "var(--surface)", borderRadius: 12,
        border: "0.5px solid var(--border)",
        overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 10, padding: isMobile ? "0 12px" : "0 14px", flex: 1, minWidth: 0 }}>
          <SearchIcon />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fire("live"); } }}
            placeholder={isMobile ? "Reference or brand…" : "Reference, brand, model…"}
            style={{ flex: 1, border: "none", background: "transparent", fontSize: isMobile ? 14 : 15, color: "var(--text1)", outline: "none", fontFamily: "inherit", minWidth: 0, padding: isMobile ? "11px 0" : "13px 0" }}
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
          aria-label="Search Listings"
          style={{
            flexShrink: 0,
            border: "none", borderLeft: "0.5px solid var(--border)",
            background: "var(--text1)", color: "var(--bg)",
            fontFamily: "inherit", fontSize: isMobile ? 12 : 13, fontWeight: 600,
            letterSpacing: "0.04em", cursor: "pointer",
            padding: isMobile ? "0 14px" : "0 22px",
            display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
          }}>
          {isMobile ? "Search" : "Search Listings"} <span aria-hidden style={{ fontSize: 14 }}>→</span>
        </button>
      </div>
      {/* Secondary search targets — sit directly under the Search
          Listings button, right-aligned. Visual descendents of the
          primary CTA; reads as an "or…" dropdown without needing a
          toggle interaction. */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 10, paddingRight: 2 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", alignSelf: "center", marginRight: 2 }}>Search in</span>
        <button onClick={() => fire("auctions")}
          style={{
            padding: "5px 12px", borderRadius: 999,
            border: "0.5px solid rgba(255,255,255,0.18)",
            background: "transparent", color: "var(--bg)",
            fontFamily: "inherit", fontSize: 12, fontWeight: 500, cursor: "pointer",
          }}>
          Auctions
        </button>
        <button onClick={() => fire("sold")}
          style={{
            padding: "5px 12px", borderRadius: 999,
            border: "0.5px solid rgba(255,255,255,0.18)",
            background: "transparent", color: "var(--bg)",
            fontFamily: "inherit", fontSize: 12, fontWeight: 500, cursor: "pointer",
          }}>
          Sold
        </button>
      </div>
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
function SectionStrip({ heading, descriptor, items, onViewAll, isMobile, watchlist, hidden, handleWish, toggleHide, primaryCurrency, onShare, onView, onClickListing, openCollectionPicker, isAdmin, user, compact, inverted, shellPad }) {
  if (!items || items.length === 0) return null;
  const slice = items.slice(0, CARDS_PER_SECTION);
  // Inverted bleed (phase 4c, 2026-05-11): one section gets a dark
  // band that runs edge-to-edge of the viewport, breaking the
  // visual rhythm of the page (editorial trick — Mark's v0.5
  // mockup had this for one section). We escape the parent shell's
  // horizontal padding via negative margins matching `shellPad`,
  // then add our own padding back inside so card content sits in
  // the right rhythm.
  const wrapperStyle = inverted ? {
    background: "var(--text1)",
    marginLeft: -shellPad,
    marginRight: -shellPad,
    padding: `${isMobile ? 26 : 34}px ${shellPad}px ${isMobile ? 30 : 38}px`,
    marginBottom: isMobile ? 30 : 36,
  } : { marginBottom: 28 };
  const headingColor = inverted ? "var(--bg)" : "var(--text1)";
  const descriptorColor = inverted ? "rgba(255,255,255,0.62)" : "var(--text2)";
  const viewAllColor = inverted ? "rgba(255,255,255,0.78)" : "var(--text2)";
  return (
    <section style={wrapperStyle}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: inverted ? 0 : "0 16px", marginBottom: 12, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: headingColor, letterSpacing: "-0.3px" }}>
            {heading}
          </h2>
          {descriptor && (
            <div style={{ fontSize: 13, color: descriptorColor, marginTop: 4, maxWidth: 480 }}>
              {descriptor}
            </div>
          )}
        </div>
        <button onClick={onViewAll}
          style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: viewAllColor }}>
          View all →
        </button>
      </div>
      <div style={{
        ...(isMobile ? {
          display: "flex", gap: 1, overflowX: "auto", overflowY: "hidden",
          padding: inverted ? "0 0 4px" : "0 16px 4px", scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch", background: inverted ? "rgba(255,255,255,0.1)" : "var(--border)",
        } : {
          display: "grid", gridTemplateColumns: `repeat(${COLS_PER_ROW}, minmax(0, 1fr))`,
          gap: 1, background: inverted ? "rgba(255,255,255,0.1)" : "var(--border)",
          padding: 0, margin: inverted ? 0 : "0 16px",
          borderRadius: 10, overflow: "hidden",
        }),
      }}>
        {slice.map(item => (
          <div key={item.id} style={isMobile ? {
            // Smaller mobile tiles — Mark feedback 2026-05-11: previous
            // 60% / 240px tiles were too tall, the next section sat off-
            // screen. Tighter slots let row 1 + the top of the next
            // section show together so the page reads as scrollable.
            flex: "0 0 44%", maxWidth: 180, scrollSnapAlign: "start", background: "var(--card-bg)",
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

// Manage-your-collection callout. Single editorial strip between the
// discovery sections and the footer that nudges signed-in users back
// into the collection-management surfaces (Saved listings, My watches,
// Lists). Three small text-style CTAs — no card chrome, no images.
function ManageCallout({ goToSavedLists, goToMyWatches, goToChallenges, isMobile }) {
  return (
    <section style={{
      margin: isMobile ? "8px 16px 28px" : "16px 16px 36px",
      padding: isMobile ? "28px 20px" : "44px 28px",
      textAlign: "center",
      border: "0.5px solid var(--border)",
      borderRadius: 14,
      background: "var(--bg)",
    }}>
      <h2 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 600, color: "var(--text1)", letterSpacing: "-0.3px" }}>
        Build your collection
      </h2>
      <p style={{ margin: "10px auto 0", maxWidth: 520, fontSize: 14, color: "var(--text2)", lineHeight: 1.5 }}>
        Save what catches your eye, keep track of what you own, and plan what's next — all from the same feed.
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
        <button onClick={goToSavedLists} style={calloutCtaStyle()}>Saved lists</button>
        <button onClick={goToMyWatches} style={calloutCtaStyle()}>My watches</button>
        <button onClick={goToChallenges} style={calloutCtaStyle()}>Challenges</button>
      </div>
    </section>
  );
}

// Filled pill buttons — clearer "this is a CTA" affordance than the
// outline-with-arrow look (Mark feedback 2026-05-11: those read as
// breadcrumb links, not buttons). Dark fill, light text, no arrow.
function calloutCtaStyle() {
  return {
    padding: "10px 18px", borderRadius: 999,
    border: "none", background: "var(--text1)",
    color: "var(--bg)", fontFamily: "inherit", fontSize: 13,
    fontWeight: 600, letterSpacing: "0.02em", cursor: "pointer",
  };
}

// Footer band — closes the page rather than trailing off. Hairline
// rule above the link row, small centered text. About + Privacy +
// Terms always; Sign in only when signed-out.
function FooterBand({ openAbout, signInWithGoogle, user }) {
  const linkStyle = {
    background: "none", border: "none", padding: 0,
    fontFamily: "inherit", fontSize: 12, color: "var(--text2)",
    cursor: "pointer", letterSpacing: "0.02em",
  };
  return (
    <footer style={{
      marginTop: 24,
      padding: "24px 16px 16px",
      borderTop: "0.5px solid var(--border)",
      textAlign: "center",
    }}>
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 16, alignItems: "baseline" }}>
        <button onClick={openAbout} style={linkStyle}>About</button>
        <a href="/privacy.html" style={{ ...linkStyle, textDecoration: "none" }}>Privacy</a>
        <a href="/terms.html" style={{ ...linkStyle, textDecoration: "none" }}>Terms</a>
        {!user && signInWithGoogle && (
          <button onClick={signInWithGoogle} style={linkStyle}>Sign in</button>
        )}
      </div>
      <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 14 }}>
        © Watchlist · 2026
      </div>
    </footer>
  );
}

export function HomeTab(props) {
  const {
    homeRecentAdded, homeRecentSold, homeEndingNext,
    goToRecentAdded, goToRecentSold, goToEndingNext,
    homeSearchSubmit,
    homeCounts,
    goToSavedLists, goToMyWatches, goToChallenges,
    openAbout, signInWithGoogle,
    isMobile,
    watchlist, hidden, handleWish, toggleHide, primaryCurrency,
    onShare, onView, onClickListing, openCollectionPicker, isAdmin,
    user, compact,
  } = props;

  // The shell adds horizontal padding around its main content (16px
  // mobile, 20px desktop). The inverted-bleed section needs to extend
  // past that padding to reach the viewport edges — pass shellPad
  // through so the negative-margin escape uses the right value.
  const shellPad = isMobile ? 16 : 20;

  return (
    <div style={{ paddingBottom: 0 }}>
      <EditorialHero isMobile={isMobile} />
      {homeSearchSubmit && (
        <HomeSearchBar onSubmit={homeSearchSubmit} isMobile={isMobile} shellPad={shellPad} />
      )}
      <SectionStrip
        heading="Recently added"
        items={homeRecentAdded}
        onViewAll={goToRecentAdded}
        isMobile={isMobile} shellPad={shellPad}
        watchlist={watchlist} hidden={hidden} handleWish={handleWish}
        toggleHide={toggleHide} primaryCurrency={primaryCurrency}
        onShare={onShare} onView={onView} onClickListing={onClickListing}
        openCollectionPicker={openCollectionPicker} isAdmin={isAdmin}
        user={user} compact={compact}
      />
      <SectionStrip
        heading="Recently sold"
        items={homeRecentSold}
        onViewAll={goToRecentSold}
        isMobile={isMobile} shellPad={shellPad}
        watchlist={watchlist} hidden={hidden} handleWish={handleWish}
        toggleHide={toggleHide} primaryCurrency={primaryCurrency}
        onShare={onShare} onView={onView} onClickListing={onClickListing}
        openCollectionPicker={openCollectionPicker} isAdmin={isAdmin}
        user={user} compact={compact}
      />
      <SectionStrip
        heading="Ending next at auction"
        items={homeEndingNext}
        onViewAll={goToEndingNext}
        isMobile={isMobile} shellPad={shellPad}
        watchlist={watchlist} hidden={hidden} handleWish={handleWish}
        toggleHide={toggleHide} primaryCurrency={primaryCurrency}
        onShare={onShare} onView={onView} onClickListing={onClickListing}
        openCollectionPicker={openCollectionPicker} isAdmin={isAdmin}
        user={user} compact={compact}
      />
      <ManageCallout
        goToSavedLists={goToSavedLists}
        goToMyWatches={goToMyWatches}
        goToChallenges={goToChallenges}
        isMobile={isMobile}
      />
      <FooterBand openAbout={openAbout} signInWithGoogle={signInWithGoogle} user={user} />
    </div>
  );
}
