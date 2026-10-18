// CardStrip — the shared horizontal-scroll strip for card rows.
//
// Part of the unified card design system. The scroll container + the per-tile
// wrapper (fixed-width, scroll-snap, card-bg) were copy-pasted in THREE places
// — SearchResultsView's Strip + ArticleStrip and HomeTab's SectionStrip — and
// had quietly diverged (different backgrounds, an inverted padding variant on
// Home). This consolidates them. The caller owns the section HEADER and passes
// a `renderCard` function for the per-item card, so listings/auctions/sold/
// article cards all sit in identical tiles that line up by construction.
//
// Tile sizing (history baked in): mobile 38% / max 170px so ~2.5 tiles +
// a hint show; desktop fixed 210px so ~6 show on a 1440px window. The action
// buttons on the card are absolute and don't shrink with the tile, which is
// why mobile didn't go narrower than 38%.
//
// Scroll affordance (B-33, 2026-05-27; reworked 2026-05-28; arrows added
// 2026-08-30 for B-88):
//
//   The row scrolls sideways. Native scrollbars stay hidden, and we still do
//   NOT render a custom thumb: the 2026-05 version drove a thumb off
//   `onScroll` -> setState every frame with a `transition: left 0.06s`, so the
//   indicator visibly trailed the scroll ("scroll, stop, then the bar catches
//   up"). Fades signal that more exists.
//
//   But a fade is not a control. B-88: with the native scrollbar hidden,
//   `overflowY: hidden` sending the wheel to the page, and no arrows or drag
//   handler, a plain wheel mouse had NO gesture at all — measured on Home,
//   4259px of strip inside a 1240px viewport, so ~79% of every row was
//   unreachable. Trackpads were always fine, which is why this survived so
//   long. Desktop now gets prev/next buttons; they appear on hover and on
//   keyboard focus, and page by one viewport width less one tile so the tile
//   you were looking at stays on screen as an anchor.
//
//   `overscroll-behavior-x: contain` (B-89) stops a swipe at either end of the
//   rail chaining into browser / PWA back-navigation.

import React, { useRef, useState, useEffect, useCallback } from "react";
import { OverlayButton } from "../ui";

// Arrows page by (viewport - one tile) so the tile at the edge carries over
// and the reader never loses their place. Matches how Netflix and Apple TV
// page their rows.
const TILE_DESKTOP = 210;

export default function CardStrip({
  items,
  renderCard,            // (item) => node — the per-item card (Card / CardShell)
  isMobile,
  max,                   // cap visible tiles (STRIP_MAX / CARDS_PER_SECTION)
  background = "transparent",
  inset = true,          // false = bleed to edges (Home inverted band)
  fadeColor = "var(--bg)", // right-edge fade target; pass var(--text1) on inverted bands
  label,                 // accessible name for the arrows ("Recently added")
}) {
  const slice = max != null ? items.slice(0, max) : items;
  const scrollRef = useRef(null);
  // Three cheap booleans, not per-frame geometry: does the strip overflow, is
  // it scrolled to the end, is it scrolled off the start. Fades and arrows
  // both read them; each setState is guarded so dragging doesn't churn React.
  const [overflowing, setOverflowing] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [hovered, setHovered] = useState(false);
  // Resting scrollLeft is NOT 0. The container carries 16-20px of left padding
  // and the tiles are scroll-snap-align: start, so the browser settles the
  // first tile at scrollLeft === paddingLeft. Comparing against 0 made
  // `atStart` false on a freshly loaded row, which showed the left fade over
  // the first card and washed it out. Cached in measure() rather than read per
  // scroll event.
  const startPadRef = useRef(0);

  const readEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ended = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    const started = el.scrollLeft <= startPadRef.current + 4;
    setAtEnd((prev) => (prev === ended ? prev : ended));
    setAtStart((prev) => (prev === started ? prev : started));
  }, []);

  // Measure overflow on mount / resize / content change — NOT on scroll.
  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setOverflowing(el.scrollWidth > el.clientWidth + 2);
    startPadRef.current = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    readEdges();
  }, [readEdges]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, slice.length, isMobile]);

  const page = useCallback((dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(TILE_DESKTOP, el.clientWidth - TILE_DESKTOP);
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

  // Arrows are desktop-only: touch already has the gesture, and on a phone
  // they would sit on top of the tiles they are meant to reveal.
  const showArrows = !isMobile && overflowing;
  // Placement and reveal only: the look is the shared OverlayButton `light` (44px, the touch floor,
  // even though this is a pointer control: it doubles as the keyboard target).
  const arrowStyle = (side, disabled) => ({
    position: "absolute",
    top: "50%",
    [side]: 6,
    transform: "translateY(-50%)",
    zIndex: 2,
    // Hidden until hover or keyboard focus so a resting page stays quiet.
    // `visibility` rather than unmounting so focus can still land on them
    // when tabbing through, which is what reveals them for keyboard users.
    opacity: disabled ? 0 : hovered ? 1 : 0,
    visibility: disabled ? "hidden" : "visible",
    transition: "opacity 0.15s ease",
  });

  return (
    <div>
      <div
        style={{ position: "relative" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
      >
        {/* scrollbarWidth:none is Firefox-only — WebKit (Safari/Chrome with
            "always show scroll bars" on macOS) needs the ::-webkit-scrollbar
            rule, which inline styles can't express. Without it some strips
            drew a grey track bar and others didn't (Mark 2026-06-03).
            overscroll-behavior-x is here for the same reason: inline styles
            can express it, but keeping both scroll rules in one place means
            the next person changing scroll behaviour sees them together. */}
        <style>{`.wl-hscroll::-webkit-scrollbar{display:none}
.wl-hscroll{overscroll-behavior-x:contain}`}</style>
        <div ref={scrollRef} onScroll={readEdges} className="wl-hscroll" style={{
          display: "flex", gap: 1, overflowX: "auto", overflowY: "hidden",
          // Mobile inset 16 -> 24 (B-89): at 16 the first tile's grab surface
          // sat inside the iOS edge-swipe zone, so a swipe meant for the rail
          // triggered back-navigation instead.
          padding: inset ? (isMobile ? "0 24px 4px" : "0 20px 4px") : "0 0 4px",
          // proximity (not mandatory) so the drag stays free / un-sticky and
          // only gently lands on a tile when you let go near one.
          scrollSnapType: "x proximity",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none", msOverflowStyle: "none",
          background,
        }}>
          {slice.map((item, i) => (
            <div key={item.id || item.url || i} style={isMobile
              ? { flex: "0 0 38%", maxWidth: 170, scrollSnapAlign: "start", background: "var(--card-bg)", position: "relative" }
              : { flex: "0 0 210px", scrollSnapAlign: "start", background: "var(--card-bg)", position: "relative" }}>
              {renderCard(item, i)}
            </div>
          ))}
        </div>
        {/* Edge fades — the passive affordance. Each shows only when the strip
            overflows AND there is content that way, and fades in/out via
            opacity (cheap; no layout, no per-frame state). pointerEvents none
            so neither ever swallows taps/swipes. */}
        <div aria-hidden style={{
          position: "absolute", top: 0, left: 0, bottom: 0,
          width: isMobile ? 36 : 72, pointerEvents: "none",
          background: `linear-gradient(to left, transparent 0%, ${fadeColor} 75%)`,
          opacity: overflowing && !atStart ? 1 : 0,
          transition: "opacity 0.15s ease",
        }} />
        <div aria-hidden style={{
          position: "absolute", top: 0, right: 0, bottom: 0,
          width: isMobile ? 36 : 72, pointerEvents: "none",
          background: `linear-gradient(to right, transparent 0%, ${fadeColor} 75%)`,
          opacity: overflowing && !atEnd ? 1 : 0,
          transition: "opacity 0.15s ease",
        }} />
        {showArrows && (
          <>
            <OverlayButton light onClick={() => page(-1)}
              aria-label={label ? `Scroll ${label} left` : "Scroll left"}
              tabIndex={atStart ? -1 : 0}
              style={arrowStyle("left", atStart)}>
              <span aria-hidden>‹</span>
            </OverlayButton>
            <OverlayButton light onClick={() => page(1)}
              aria-label={label ? `Scroll ${label} right` : "Scroll right"}
              tabIndex={atEnd ? -1 : 0}
              style={arrowStyle("right", atEnd)}>
              <span aria-hidden>›</span>
            </OverlayButton>
          </>
        )}
      </div>
    </div>
  );
}
