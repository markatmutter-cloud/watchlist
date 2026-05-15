import React, { useState, useEffect, useRef } from "react";
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

// Both mobile and desktop now use a horizontal slider strip (Mark
// spec 2026-05-12: "I meant slider for desktop browser like mobile").
// 14 items per section — about two screens' worth of swipe depth on
// either viewport. No lazy-loading; the full set is rendered and the
// browser virtualises with its own scroll-paint optimisations.
const CARDS_PER_SECTION = 14;

// Editorial hero — phase 4c (2026-05-11). Restraint dial-up per
// Mark feedback after #228: drop the weight and tracking a notch,
// flank an italic tagline with hairline rules above + below. Reads
// as a masthead rather than a header label. No new typefaces — the
// system stack carries the italic via the regular `font-style`.
function EditorialHero({ isMobile }) {
  return (
    <section style={{
      // Mobile compressed 2026-05-11 — Mark flagged the prior 28/22
      // padding as wasted vertical real estate (top of phone had ~150px
      // of empty space between URL bar and the wordmark). Halve the
      // breathing room on phones without making it feel cramped on
      // desktop.
      // Desktop top padding tightened 52 → 18 (2026-05-11). Top bar
      // tab pills are about to be hidden on Home (moved inline below
      // the search bar), so the wordmark sits closer to the top edge
      // and the hero feels less wasteful.
      // Top + bottom equalized 2026-05-11 (Mark feedback): wordmark
      // needs to sit visually centered between the top-bar's
      // border-bottom and the hairline below it. Section's top
      // padding == h1's bottom margin, so the gap above the wordmark
      // matches the gap below it (to the hairline). Bottom padding
      // adds breathing room INTO the next section but doesn't affect
      // the perceived centering.
      padding: isMobile ? "12px 16px 14px" : "22px 16px 22px",
      textAlign: "center",
    }}>
      {/* The hairline-above the wordmark was removed 2026-05-11 —
          the top bar already has a `border-bottom`, so the page
          was reading as having two horizontal rules in close
          succession. The hairline below the wordmark stays as the
          divider into the search section. */}
      <h1 style={{
        margin: isMobile ? "0 0 12px" : "0 0 22px",
        fontFamily: "inherit",
        fontSize: isMobile ? 30 : 56,
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

// Search composite (2026-05-11). Empty state: just the input + a
// primary "Search" button (Listings default on click / Enter).
// When the user starts typing, a typeahead popover drops below
// the input with three target rows — Listings / Auctions / Sold —
// so the user can pick which sub-tab they want before submitting.
// Click outside or empty the input to dismiss.
function HomeSearchBar({ onSubmit, isMobile, dealerSources, onJumpToDealer }) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef(null);
  const fire = (target) => {
    const q = draft.trim();
    onSubmit(q, target);
    setDraft("");
    setFocused(false);
  };

  // Click-outside dismiss. mousedown not click so the popover row's
  // own click still fires (mousedown-on-row → blur on input → click
  // on row; without this guard the popover would unmount before the
  // click lands).
  useEffect(() => {
    if (!focused) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [focused]);

  const trimmed = draft.trim();
  const showPopover = focused && trimmed.length > 0;
  const echo = trimmed.length > 24 ? trimmed.slice(0, 24) + "…" : trimmed;

  const targets = [
    ["live",     "Listings", "Live dealer items"],
    ["auctions", "Auctions", "Active auction lots"],
    ["sold",     "Sold",     "Archive of sold items"],
  ];

  // Dealer name typeahead — case-insensitive substring match. Caps at
  // 5 results so the popover doesn't dominate the page. Only shows
  // for queries ≥ 2 chars (single-char matches are too noisy).
  const dealerMatches = (() => {
    if (!dealerSources || !onJumpToDealer) return [];
    if (trimmed.length < 2) return [];
    const q = trimmed.toLowerCase();
    return dealerSources
      .filter(n => n && n.toLowerCase().includes(q))
      .slice(0, 5);
  })();
  const jumpToDealer = (name) => {
    onJumpToDealer(name);
    setDraft("");
    setFocused(false);
  };

  return (
    <section style={{
      padding: isMobile ? "0 16px 28px" : "0 16px 36px",
      maxWidth: 720,
      margin: "0 auto",
      width: "100%",
    }}>
      <div ref={wrapRef} style={{ position: "relative" }}>
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
              onFocus={() => setFocused(true)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fire("live"); } }}
              placeholder={isMobile ? "Reference or brand…" : "Reference, brand, model…"}
              style={{ flex: 1, border: "none", background: "transparent", fontSize: isMobile ? 14 : 15, color: "var(--text1)", outline: "none", fontFamily: "inherit", minWidth: 0, padding: isMobile ? "11px 0" : "13px 0" }}
            />
            {draft && (
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => setDraft("")} aria-label="Clear" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 2, fontFamily: "inherit", display: "flex", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <button onClick={() => fire("live")}
            aria-label="Search"
            style={{
              flexShrink: 0,
              border: "none", borderLeft: "0.5px solid var(--border)",
              background: "var(--text1)", color: "var(--bg)",
              fontFamily: "inherit", fontSize: isMobile ? 12 : 13, fontWeight: 600,
              letterSpacing: "0.04em", cursor: "pointer",
              padding: isMobile ? "0 14px" : "0 22px",
              display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
            }}>
            Search <span aria-hidden style={{ fontSize: 14 }}>→</span>
          </button>
        </div>
        {/* Typeahead popover — appears on the first keystroke. Three
            rows pointing at Listings / Auctions / Sold sub-tabs. The
            user's query echoes on the right of each row so the
            destination is unambiguous before they click. */}
        {showPopover && (
          <div role="listbox"
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
              background: "var(--card-bg)", border: "0.5px solid var(--border)",
              borderRadius: 10, overflow: "hidden", zIndex: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            }}>
            <div style={{ padding: "8px 14px 6px", fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text3)" }}>
              Search in
            </div>
            {targets.map(([key, label, hint], idx) => (
              <button key={key}
                onMouseDown={(e) => { e.preventDefault(); fire(key); }}
                role="option"
                style={{
                  display: "flex", alignItems: "baseline", justifyContent: "space-between",
                  width: "100%", gap: 12,
                  padding: "10px 14px",
                  background: "transparent", border: "none",
                  borderTop: idx === 0 ? "none" : "0.5px solid var(--border)",
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>{label}</span>
                  <span style={{ fontSize: 11, color: "var(--text3)" }}>{hint}</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--text2)", fontStyle: "italic", flexShrink: 0 }}>
                  "{echo}"
                </span>
              </button>
            ))}
            {dealerMatches.length > 0 && (
              <>
                <div style={{ padding: "10px 14px 6px", borderTop: "0.5px solid var(--border)", fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text3)" }}>
                  Dealers matching
                </div>
                {dealerMatches.map((name) => (
                  <button key={name}
                    onMouseDown={(e) => { e.preventDefault(); jumpToDealer(name); }}
                    role="option"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      width: "100%", gap: 12,
                      padding: "10px 14px",
                      background: "transparent", border: "none",
                      borderTop: "0.5px solid var(--border)",
                      cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)" }}>{name}</span>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>Browse listings →</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
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
function SectionStrip({ heading, descriptor, items, onViewAll, onScreen, screenCount, isMobile, watchlist, hidden, handleWish, toggleHide, toggleHomeHide, primaryCurrency, onShare, onView, onClickListing, openCollectionPicker, isAdmin, user, compact, inverted, shellPad }) {
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
  const descriptorColor = inverted ? "var(--text-on-dark-2)" : "var(--text2)";
  const viewAllColor = inverted ? "var(--text-on-dark-1)" : "var(--text2)";
  return (
    <section style={wrapperStyle}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: inverted ? 0 : "0 16px", marginBottom: 12, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: headingColor, letterSpacing: "-0.3px" }}>
            {heading}
          </h2>
          {descriptor && (
            <div style={{ fontSize: 13, color: descriptorColor, marginTop: 4, maxWidth: 480 }}>
              {descriptor}
            </div>
          )}
        </div>
        {/* "View all" lifted from a muted text link to a bordered
            pill button (Mark feedback 2026-05-11: needs to read as
            "this is a real destination" rather than incidental
            metadata). Keeps a low-key affordance — outline pill,
            not a CTA fill — but the border + slightly bolder weight
            communicates clickability.
            "Screen N new" pill (2026-05-15) sits to the left when
            there's a fresh-listings diff to review. Filled brand
            because it's the primary action when present; the prior
            grey-bar banner above the page got retired in favour of
            this in-context affordance (Mark spec: "I want it to not
            have a grey bar at the top"). */}
        <div style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
          {onScreen && screenCount > 0 && (
            <button onClick={onScreen}
              style={{
                cursor: "pointer", fontFamily: "inherit",
                fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
                padding: "7px 14px", borderRadius: 999,
                border: "none",
                background: "var(--brand)",
                color: "#fff",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
              Screen
            </button>
          )}
          <button onClick={onViewAll}
            style={{
              cursor: "pointer", fontFamily: "inherit",
              fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
              padding: "7px 14px", borderRadius: 999,
              border: `0.5px solid ${inverted ? "var(--text-on-dark-3)" : "var(--text2)"}`,
              background: "transparent",
              color: viewAllColor,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
            View all <span aria-hidden style={{ fontSize: 13 }}>→</span>
          </button>
        </div>
      </div>
      {/* Unified horizontal-slider strip (Mark spec 2026-05-12):
          desktop now scrolls horizontally like mobile rather than
          rendering everything in a 7-col grid. Tile widths differ by
          viewport — narrower flex-percentage tiles on mobile, fixed
          pixel-width tiles on desktop so the slider feels intentional
          at large viewports. */}
      <div style={{
        display: "flex", gap: 1, overflowX: "auto", overflowY: "hidden",
        padding: inverted ? "0 0 4px" : "0 16px 4px",
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none", msOverflowStyle: "none",
        background: inverted ? "var(--surface-on-dark)" : "var(--border)",
      }}>
        {slice.map(item => (
          <div key={item.id} style={isMobile ? {
            // Smaller mobile tiles — Mark feedback 2026-05-11: previous
            // 60% / 240px tiles were too tall, the next section sat off-
            // screen. Tighter slots let row 1 + the top of the next
            // section show together so the page reads as scrollable.
            flex: "0 0 44%", maxWidth: 180, scrollSnapAlign: "start", background: "var(--card-bg)",
            position: "relative",
          } : {
            // Desktop tiles — fixed pixel width so the strip reads as a
            // proper slider regardless of viewport. ~210px lands ~6 tiles
            // visible on a typical 1440px window with the rest hinting
            // off the right edge.
            flex: "0 0 210px", scrollSnapAlign: "start", background: "var(--card-bg)",
            position: "relative",
          }}>
            <Card item={item} wished={!!watchlist[item.id]} onWish={handleWish}
              compact={compact}
              onHide={isAdmin ? toggleHide : undefined}
              // On Home the × overlay handles Home-only hide.
              // Rename the ⋯ menu Hide entry to "Hide everywhere"
              // so the two actions are visually disambiguated
              // (Mark feedback 2026-05-11). Card respects
              // hideLabel via its existing prop.
              hideLabel="Hide everywhere"
              isHidden={!!hidden[item.id]}
              onAddToCollection={user ? openCollectionPicker : undefined}
              primaryCurrency={primaryCurrency}
              onShare={onShare} onView={onView} onClickListing={onClickListing} />
            {/* Admin one-tap quick-hide overlay — Home only (2026-05-11).
                Mark report: "crappy watches showing up on the home
                screen and I want to hide on a daily basis." Fires
                `toggleHomeHide(item.id)` which writes to a local
                home-only set (localStorage `dial_home_hidden_v1`) —
                hides the listing from THIS page only, doesn't touch
                hidden_listings or admin_hidden_listings. Other tabs
                and other users still see it. The ⋯ menu Hide is
                unchanged and still does the full per-user + global
                curation hide for cases where Mark wants the listing
                gone from everywhere. */}
            {isAdmin && toggleHomeHide && (
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleHomeHide(item.id); }}
                aria-label="Hide from Home"
                title="Hide from Home (this page only)"
                style={{
                  position: "absolute", top: 6, left: 6, zIndex: 5,
                  width: 26, height: 26, borderRadius: "50%",
                  border: "none",
                  background: "rgba(0,0,0,0.55)", color: "#fff",
                  cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 0,
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
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
// Manage callout — phase 4e (2026-05-11). Tried the inverted-bleed
// treatment on the search composite (#232 → reverted) and the Ending
// Next section (#230 → reverted) and both crashed: too heavy at the
// top, and white cards on dark read as broken respectively. The
// callout is the right surface for the bleed band — it's mid-page
// (visual rhythm break lands cleanly), all text + CTAs (no card
// photography), and reads as a "pause and think" beat between the
// discovery sections and the footer. Negative-margin escape via
// shellPad so the band runs edge-to-edge of the viewport.
function ManageCallout({ goToSavedLists, goToMyWatches, goToChallenges, isMobile, shellPad }) {
  return (
    <section style={{
      background: "var(--text1)",
      color: "var(--bg)",
      marginLeft: -shellPad,
      marginRight: -shellPad,
      marginTop: isMobile ? 8 : 16,
      marginBottom: isMobile ? 28 : 36,
      padding: isMobile ? "36px 20px" : "56px 28px",
      textAlign: "center",
    }}>
      <h2 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 600, color: "var(--bg)", letterSpacing: "-0.3px" }}>
        Build your collection
      </h2>
      <p style={{ margin: "10px auto 0", maxWidth: 520, fontSize: 14, color: "var(--text-on-dark-2)", lineHeight: 1.5 }}>
        Save what catches your eye, keep track of what you own, and plan what's next — all from the same feed.
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
        <button onClick={goToSavedLists} style={calloutCtaStyle()}>Saved lists</button>
        <button onClick={goToMyWatches} style={calloutCtaStyle()}>Watchbox</button>
        <button onClick={goToChallenges} style={calloutCtaStyle()}>Challenges</button>
      </div>
    </section>
  );
}

// Filled pill buttons against a dark band — light fill, dark text
// (inverted from the previous outline-on-light scheme since the
// callout is now on a dark bleed band).
function calloutCtaStyle() {
  return {
    padding: "10px 18px", borderRadius: 999,
    border: "none", background: "var(--bg)",
    color: "var(--text1)", fontFamily: "inherit", fontSize: 13,
    fontWeight: 600, letterSpacing: "0.02em", cursor: "pointer",
  };
}

// (NewSinceLastVisitBanner retired 2026-05-15 — the grey bar at the
// top of Home cycled back every few hours as scrapers landed fresh
// items, which read as "the banner is stuck" rather than "fresh
// listings landed since your last screening." Replaced by a "Screen
// N new" pill on the Recently added section header.)

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
    homeRecentlyHearted, goToSavedHearts,
    homeDealerSources, homeJumpToDealer,
    goToRecentAdded, goToRecentSold, goToEndingNext,
    homeSearchSubmit,
    homeCounts,
    goToSavedLists, goToMyWatches, goToChallenges,
    openAbout, signInWithGoogle,
    isMobile,
    watchlist, hidden, handleWish, toggleHide, toggleHomeHide, primaryCurrency,
    onShare, onView, onClickListing, openCollectionPicker, isAdmin,
    user, compact,
    feedScreenerItemsCount, openFeedScreener,
  } = props;

  // The shell adds horizontal padding around its main content (16px
  // mobile, 20px desktop). The inverted-bleed section needs to extend
  // past that padding to reach the viewport edges — pass shellPad
  // through so the negative-margin escape uses the right value.
  const shellPad = isMobile ? 16 : 20;

  return (
    <div style={{ paddingBottom: 0 }}>
      <EditorialHero isMobile={isMobile} />
      {/* Hero search bar — desktop only. On mobile the shell renders
          a sticky search bar at the top of Home (restored 2026-05-11
          per Mark spec: "search and sign-in circle should stay at the
          top of the page like on the other tabs"). Showing a second
          search bar inside the hero on mobile read as a duplicate
          (Mark report 2026-05-12). Desktop keeps it — the top-bar
          search is suppressed on Home there, so the hero search is
          the canonical entry point. */}
      {homeSearchSubmit && !isMobile && (
        <HomeSearchBar
          onSubmit={homeSearchSubmit}
          isMobile={isMobile}
          dealerSources={homeDealerSources}
          onJumpToDealer={homeJumpToDealer}
        />
      )}
      <SectionStrip
        heading="Recently added"
        items={homeRecentAdded}
        onViewAll={goToRecentAdded}
        onScreen={openFeedScreener}
        screenCount={feedScreenerItemsCount}
        isMobile={isMobile} shellPad={shellPad}
        watchlist={watchlist} hidden={hidden} handleWish={handleWish}
        toggleHide={toggleHide} toggleHomeHide={toggleHomeHide} primaryCurrency={primaryCurrency}
        onShare={onShare} onView={onView} onClickListing={onClickListing}
        openCollectionPicker={openCollectionPicker} isAdmin={isAdmin}
        user={user} compact={compact}
      />
      {/* Signed-in user's most-recently hearted strip — Mark spec
          2026-05-11: "users most recent hearted items on the home
          page as a strip... if they are logged in... second row".
          SectionStrip already returns null on empty items so signed-
          out users / users with no hearts get no row. */}
      <SectionStrip
        heading="Recently hearted"
        items={homeRecentlyHearted}
        onViewAll={goToSavedHearts}
        isMobile={isMobile} shellPad={shellPad}
        watchlist={watchlist} hidden={hidden} handleWish={handleWish}
        toggleHide={toggleHide} toggleHomeHide={toggleHomeHide} primaryCurrency={primaryCurrency}
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
        toggleHide={toggleHide} toggleHomeHide={toggleHomeHide} primaryCurrency={primaryCurrency}
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
        toggleHide={toggleHide} toggleHomeHide={toggleHomeHide} primaryCurrency={primaryCurrency}
        onShare={onShare} onView={onView} onClickListing={onClickListing}
        openCollectionPicker={openCollectionPicker} isAdmin={isAdmin}
        user={user} compact={compact}
      />
      <ManageCallout
        goToSavedLists={goToSavedLists}
        goToMyWatches={goToMyWatches}
        goToChallenges={goToChallenges}
        isMobile={isMobile}
        shellPad={shellPad}
      />
      <FooterBand openAbout={openAbout} signInWithGoogle={signInWithGoogle} user={user} />
    </div>
  );
}
