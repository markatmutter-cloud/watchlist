import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { imgSrc, fmtUSD } from "../utils";
import { FONT_SANS, FONT_SERIF_DISPLAY } from "../styles";
import { Pill, Button, OverlayHeart, OverlayMenu, MenuItem } from "../ui";

// Swipe gesture thresholds + tap detection.
const SWIPE_THRESHOLD_X = 90;
const SWIPE_ROTATE_PER_PX = 0.06;
const TAP_MAX_MOVE = 8;
// "Take a break?" interstitial every N reviewed cards on long
// queues (see [[feedback-screening-long-queues]]). 25 → 50 (B-04,
// 2026-05-24, Mark): 25 fired too soon; fires at 50/100/150…
const BREAK_INTERVAL = 50;
// At/above this viewport width the screening surface renders
// INLINE in the tab body (Mark spec 2026-05-13 "Approach B" — top
// wordmark / nav / filter row stay visible). Mobile gets the
// fullscreen portal for focus.
const SIDE_BY_SIDE_MIN = 900;

// Editorial type stacks (shared tokens — 2026-05-28 type-system pass).
const SANS_STACK = FONT_SANS;
// Serif display headlines — Mark feedback "title and option fonts still
// a bit simple, don't look produced."
const SERIF_DISPLAY_STACK = FONT_SERIF_DISPLAY;

// One-time onboarding flag — global per browser.
const INTRO_SEEN_KEY = "screening_intro_seen_v1";
function readIntroSeen() {
  try { return !!localStorage.getItem(INTRO_SEEN_KEY); }
  catch { return false; }
}
function markIntroSeen() {
  try { localStorage.setItem(INTRO_SEEN_KEY, "1"); } catch {}
}

// Tiny haptic helper — uses the Web Vibration API. Android browsers
// honour it; iOS Safari / iOS PWAs don't support it, so this is a
// silent no-op there until iOS adds a haptic API (or we wrap into
// a native shell). Cost of including: zero on iOS, a faint tap on
// Android.
function haptic(pattern) {
  try { navigator.vibrate?.(pattern); } catch {}
}

// Per-list persistence keyed by rowId so resume locates the right
// card even when the queue order is stable across visits.
const persistenceKey = (listId) => `screening_${listId || "default"}`;
function readPersistedRowId(listId) {
  try {
    const raw = localStorage.getItem(persistenceKey(listId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.rowId || null;
  } catch { return null; }
}
function writePersistedRowId(listId, rowId) {
  try {
    localStorage.setItem(persistenceKey(listId), JSON.stringify({ rowId, ts: Date.now() }));
  } catch {}
}
function clearPersistedRowId(listId) {
  try { localStorage.removeItem(persistenceKey(listId)); } catch {}
}

// Binary screening (Mark spec 2026-05-26, supersedes the old Yes/Pass
// reactions machinery): the swipe is now a two-way shortlist pass.
//   Swipe RIGHT  → heart (save to the watchlist) + advance.
//   Swipe LEFT   → skip (records NOTHING) + advance.
// No reactions table, no per-item verdict, no recap tally — results
// ARE the hearted watchlist. Collaborative "who-hearted-what"
// visibility is a deliberate later add.
export function ListReviewMode({
  items,
  listId,
  listName,
  ownerName,
  onClose,
  primaryCurrency,
  watchlist,
  handleWish,
  openCollectionPicker,
  onShare,
}) {
  // Frozen queue at mount.
  // initialQueue uses useState lazy init (snapshot at mount), NOT useMemo — useMemo re-derives when deps change and would shift the current card out from under the user mid-flow.
  const [initialQueue] = useState(() => items);

  const total = initialQueue.length;

  const [idx, setIdx] = useState(() => {
    const persistedRowId = readPersistedRowId(listId);
    if (!persistedRowId) return 0;
    const directHit = initialQueue.findIndex(it => it.rowId === persistedRowId);
    return directHit >= 0 ? directHit : 0;
  });
  const done = idx >= total;
  const current = done ? null : initialQueue[idx];
  const nextCard = !done && idx + 1 < total ? initialQueue[idx + 1] : null;

  // Light session feedback — how many cards the user hearted this
  // pass. Drives the completion line ("N saved to your watchlist").
  const [heartedThisSession, setHeartedThisSession] = useState(0);

  // Persist current rowId.
  useEffect(() => {
    if (!listId) return;
    if (done || !current) clearPersistedRowId(listId);
    else writePersistedRowId(listId, current.rowId);
  }, [current, done, listId]);

  // Completion haptic — fires once when the queue finishes.
  // Three-pulse pattern reads as "done" vs the per-action tap.
  const didCompleteHapticRef = useRef(false);
  useEffect(() => {
    if (done && total > 0 && !didCompleteHapticRef.current) {
      didCompleteHapticRef.current = true;
      haptic([40, 30, 40, 30, 60]);
    }
  }, [done, total]);

  // Break interstitial trigger.
  const [showBreak, setShowBreak] = useState(false);
  const lastBreakRef = useRef(0);
  useEffect(() => {
    if (done) return;
    const threshold = Math.floor(idx / BREAK_INTERVAL) * BREAK_INTERVAL;
    if (threshold > 0 && threshold > lastBreakRef.current) {
      lastBreakRef.current = threshold;
      setShowBreak(true);
    }
  }, [idx, done]);

  // ESC closes; arrows nav (pure navigation — hearting is an explicit
  // swipe-right / Save action, never a side effect of stepping).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowRight" && idx < total) advance();
      else if (e.key === "ArrowLeft" && idx > 0) goBack();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, idx, total]);

  // Responsive layout — inline on desktop, fullscreen on mobile.
  const [isWide, setIsWide] = useState(() =>
    typeof window !== "undefined" && window.innerWidth >= SIDE_BY_SIDE_MIN
  );
  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= SIDE_BY_SIDE_MIN);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Body-scroll lock only in fullscreen mode.
  useEffect(() => {
    if (isWide) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isWide]);

  // Swipe / mount-rise state.
  const dragStartRef = useRef(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [flyOut, setFlyOut] = useState(null);
  const [rising, setRising] = useState(false);
  // After mount with rising=true (scale 0.94), flip to false on the
  // next frame so the transition animates up to 1.0.
  useEffect(() => {
    if (!rising) return undefined;
    const t = setTimeout(() => setRising(false), 30);
    return () => clearTimeout(t);
  }, [rising]);

  // Advance + back batch the drag/flyOut/rising reset with the idx
  // change so the new card mounts at scale 0.94 with drag {0,0} —
  // not inheriting the fly-out transform, which would slide it in
  // from the swipe-off direction.
  const advance = () => {
    setDrag({ x: 0, y: 0 });
    setFlyOut(null);
    setRising(true);
    setIdx(i => i + 1);
  };
  const goBack = () => {
    if (idx === 0) return;
    setDrag({ x: 0, y: 0 });
    setFlyOut(null);
    setRising(true);
    setIdx(i => Math.max(0, i - 1));
  };

  const isHearted = !!(watchlist && current && watchlist[current.id]);

  // Ids saved during THIS screening pass — lets Undo reverse a save
  // and keeps the heartedThisSession counter honest when the user
  // toggles a card off mid-flow. Pre-existing hearts (saved before
  // this session) aren't in here, so un-hearting one doesn't dip the
  // counter below the work done this pass.
  const savedThisSessionRef = useRef(new Set());

  // Heart toggle from the on-card button — saves/unsaves WITHOUT
  // advancing, so the user can correct a save and keep screening.
  const handleHeart = () => {
    if (!current || !handleWish) return;
    handleWish(current);
    if (isHearted) {
      // Un-saving. Only decrement if this was a save we made this pass.
      if (savedThisSessionRef.current.delete(current.id)) {
        setHeartedThisSession(n => Math.max(0, n - 1));
      }
    } else {
      savedThisSessionRef.current.add(current.id);
      setHeartedThisSession(n => n + 1);
    }
  };

  // Swipe RIGHT / Save: ensure the card is in the watchlist (idempotent
  // — never un-hearts on a right swipe), then advance.
  const handleSaveAndAdvance = () => {
    haptic(15);
    if (current && handleWish && !isHearted) {
      handleWish(current);
      savedThisSessionRef.current.add(current.id);
      setHeartedThisSession(n => n + 1);
    }
    advance();
  };

  // Swipe LEFT / Skip: records nothing, just moves on.
  const handleSkip = () => {
    haptic(15);
    advance();
  };

  // Undo steps back a card AND reverses a save made this pass — so a
  // mistaken swipe-right is one tap to take back. A skipped card has
  // nothing to unwind, so Undo there is pure navigation.
  const handleUndo = () => {
    if (idx === 0) return;
    const prev = initialQueue[idx - 1];
    if (prev && handleWish
        && savedThisSessionRef.current.has(prev.id)
        && watchlist && watchlist[prev.id]) {
      handleWish(prev);
      savedThisSessionRef.current.delete(prev.id);
      setHeartedThisSession(n => Math.max(0, n - 1));
    }
    goBack();
  };

  // Onboarding card — once per browser before the first card.
  const [showIntro, setShowIntro] = useState(() => !readIntroSeen() && total > 0);
  const dismissIntro = () => {
    markIntroSeen();
    setShowIntro(false);
  };

  // Pointer handlers — skip drag when target is a no-drag descendant
  // (heart, ⋯ menu) so their onClicks fire.
  const onPointerDown = (e) => {
    if (!current || flyOut) return;
    if (e.target.closest && e.target.closest('[data-no-drag]')) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
  };
  const onPointerMove = (e) => {
    if (!dragStartRef.current || flyOut) return;
    setDrag({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };
  const onPointerUp = (e) => {
    if (!dragStartRef.current || flyOut) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current = null;
    const moved = Math.hypot(dx, dy);
    if (moved < TAP_MAX_MOVE) {
      // Tap on the image area is a no-op (only swipes register here).
      // Mark feedback 2026-05-13: opening the WatchDetailSheet on tap
      // surfaced an editing card meant for the My Watches surface,
      // not for screening someone else's list. Side-panel title/price
      // is the click target now, opening the original listing.
      setDrag({ x: 0, y: 0 });
      return;
    }
    if (dx > SWIPE_THRESHOLD_X) {
      setFlyOut("right");
      setDrag({ x: window.innerWidth + 200, y: dy * 0.4 });
      setTimeout(() => handleSaveAndAdvance(), 220);
    } else if (dx < -SWIPE_THRESHOLD_X) {
      setFlyOut("left");
      setDrag({ x: -window.innerWidth - 200, y: dy * 0.4 });
      setTimeout(() => handleSkip(), 220);
    } else {
      setDrag({ x: 0, y: 0 });
    }
  };

  // Open the listing's source URL in a new tab. Used by the
  // clickable side detail block and the ⋯ menu's "View listing"
  // item.
  const openSourceListing = () => {
    if (!current?.url) return;
    try { window.open(current.url, "_blank", "noopener,noreferrer"); }
    catch {}
  };
  const onPointerCancel = () => {
    if (flyOut) return;
    dragStartRef.current = null;
    setDrag({ x: 0, y: 0 });
  };

  // Full-background tint that washes the whole screening surface in
  // direction-coded color (Mark feedback 2026-05-13: "shaded color
  // across the whole of background, not just the half you are
  // sliding it towards"). Slightly lower max opacity than the
  // earlier edge-only variant since a full bg is more impactful.
  const washOpacity = (sign) => {
    const v = sign === 1 ? Math.max(0, drag.x) : Math.max(0, -drag.x);
    return Math.min(0.20, v / SWIPE_THRESHOLD_X * 0.20);
  };

  const cardScale = rising ? 0.94 : 1;
  const cardTransform = `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x * SWIPE_ROTATE_PER_PX}deg) scale(${cardScale})`;
  const cardTransition = flyOut
    ? "transform 220ms ease-out"
    : (dragStartRef.current ? "none" : "transform 240ms cubic-bezier(0.22, 0.61, 0.36, 1)");

  // ── Render ────────────────────────────────────────────────────

  // All modes render as a fullscreen portal (Mark feedback
  // 2026-05-15 desktop audit: "feels like a tiny card in the middle
  // of a huge screen. The mobile version works really well as it's
  // more immersive"). Previously list mode rendered inline inside
  // the drill-in on desktop to preserve nav context, but the card
  // ended up ~33% of the available viewport with chrome dominating
  // the rest. Portal takeover trades nav context for visual focus —
  // the screener header already carries an Exit button for return.
  const outerStyle = {
    position: "fixed", inset: 0, zIndex: 2000,
    background: "var(--bg)",
    display: "flex", flexDirection: "column",
    fontFamily: SANS_STACK,
    paddingTop: "env(safe-area-inset-top)",
    paddingBottom: "env(safe-area-inset-bottom)",
  };

  const overlay = (
    <div style={outerStyle}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, padding: "12px 16px",
        borderBottom: "0.5px solid var(--border)",
        background: "var(--bg)",
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={topLinkStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          {isWide ? "Exit" : "Done"}
        </button>
        <div style={{
          // Mark feedback 2026-05-14: the all-caps + 0.18em tracking
          // was chewing horizontal space and forcing mid-word ellipsis
          // ("TEST — PICK MY NEXT WA..."). Dropped to title-case sans
          // at weight 500 / tight tracking so longer list names fit
          // without truncation. Sub-eyebrow "Reviewing" label sits
          // above so the screening context still reads at a glance.
          fontFamily: SANS_STACK,
          minWidth: 0, flex: 1, textAlign: "center",
          overflow: "hidden",
        }}>
          <div style={{
            fontSize: 10, color: "var(--text3)",
            letterSpacing: "0.16em", textTransform: "uppercase",
            fontWeight: 600, marginBottom: 1,
          }}>
            Reviewing
          </div>
          <div style={{
            fontSize: 14, color: "var(--text1)",
            fontWeight: 500, letterSpacing: "-0.005em",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {listName}
          </div>
        </div>
        <div style={{
          fontFamily: SANS_STACK,
          fontSize: 12, color: "var(--text3)", flexShrink: 0,
          minWidth: 56, textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.02em",
          fontWeight: 500,
        }}>
          {done ? `${total} / ${total}` : `${idx + 1} / ${total}`}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: "var(--border)", flexShrink: 0 }}>
        <div style={{
          height: "100%",
          width: total > 0 ? `${(Math.min(idx, total) / total) * 100}%` : "0%",
          background: "var(--brand-olive-text)",
          transition: "width 200ms ease",
        }} />
      </div>

      {/* Body */}
      <div style={{
        flex: 1, overflow: "hidden",
        display: "flex",
        flexDirection: isWide ? "row" : "column",
        alignItems: "center", justifyContent: "center",
        padding: isWide ? "24px 32px" : "16px 16px 12px",
        gap: isWide ? 32 : 12,
        position: "relative",
      }}>
        {/* Edge washes pinned to body container — stay on viewport
            edges as the card flies off. */}
        {!done && current && (
          <>
            <EdgeWash side="left" color="rgba(30,30,30,1)" label="Skip" opacity={washOpacity(-1)} />
            <EdgeWash side="right" color="var(--heart)" label="Save" opacity={washOpacity(1)} />
          </>
        )}

        {done ? (
          <CompletionView
            total={total}
            heartedThisSession={heartedThisSession}
            onClose={onClose}
          />
        ) : current ? (
          <>
            {/* Image stack with peek behind. Desktop card sized so
                the image + side details + bottom action bar all fit
                in a typical desktop viewport without scroll (Mark
                feedback 2026-05-13 was 520→420). After the 2026-05-15
                portal-fullscreen flip the screener takes the entire
                viewport, so the card has the full vertical real
                estate (~700+) and we can step back up. 520 brings
                the card weight closer to mobile parity (where the
                card is ~85% of the viewport width). */}
            <div style={{
              position: "relative",
              width: "100%",
              // PR 2026-05-22 (Mark feedback "image feels too big"):
              // shrink the desktop card 520 → 400 so the details
              // column gets equal weight and the horizontal layout
              // reads as two balanced sides, not image-dominated.
              maxWidth: isWide ? 400 : 380,
              flexShrink: 0,
              alignSelf: "center",
              zIndex: 1,
            }}>
              {/* Peek — shows the NEXT card's image so the deck reads
                  as real (was a blank placeholder before). */}
              {nextCard && (
                <div aria-hidden style={{
                  position: "absolute",
                  top: 16, left: "4%", right: "4%",
                  aspectRatio: "1 / 1",
                  borderRadius: 12,
                  background: "var(--surface)",
                  border: "0.5px solid var(--border)",
                  boxShadow: "0 10px 22px rgba(0,0,0,0.10)",
                  overflow: "hidden",
                  pointerEvents: "none",
                }}>
                  {nextCard.img && (
                    <img src={imgSrc(nextCard.img)} alt=""
                      style={{
                        width: "100%", height: "100%",
                        objectFit: "cover",
                        opacity: 0.55,
                        filter: "saturate(0.85)",
                      }} />
                  )}
                </div>
              )}

              {/* Active card */}
              <div
                // Stable per-card key so the DOM node remounts on
                // advance — otherwise CSS transitions the transform
                // from the fly-out position (off-screen) back to 0,
                // making the next card "slide in from the side"
                // instead of rising up from the deck.
                key={current.rowId || current.id}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "1 / 1",
                  borderRadius: 12, overflow: "hidden",
                  background: "var(--surface)",
                  border: "0.5px solid var(--border)",
                  boxShadow: "0 18px 36px rgba(0,0,0,0.16), 0 2px 6px rgba(0,0,0,0.06)",
                  touchAction: "none",
                  transform: cardTransform,
                  transition: cardTransition,
                  userSelect: "none",
                  cursor: dragStartRef.current ? "grabbing" : "grab",
                  zIndex: 2,
                }}>
                {current.img ? (
                  <img src={imgSrc(current.img)} alt={current.title || ""}
                    draggable={false}
                    style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                    loading="eager"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <div style={{
                    width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, color: "var(--text3)", letterSpacing: "0.12em",
                    fontFamily: SANS_STACK,
                  }}>
                    NO IMAGE
                  </div>
                )}

                {/* Heart + ⋯ — top-right, the shared overlay pieces (olive when saved). */}
                {(handleWish || openCollectionPicker || onShare) && (
                  <div style={{ position: "absolute", top: 10, right: 10, zIndex: 5, display: "flex", flexDirection: "column", gap: 8 }}>
                    {handleWish && (
                      <OverlayHeart data-no-drag on={isHearted}
                        onClick={(e) => { e.stopPropagation(); handleHeart(); }}
                        aria-label={isHearted ? "Remove from watchlist" : "Add to watchlist"} />
                    )}
                    {(openCollectionPicker || onShare) && current && (
                      <OverlayMenu above data-no-drag>
                        {({ close }) => (
                          <>
                            {openSourceListing && current.url && (
                              <MenuItem onClick={() => { close(); openSourceListing(); }}>View listing →</MenuItem>
                            )}
                            {openCollectionPicker && (
                              <MenuItem onClick={() => { close(); openCollectionPicker(current); }}>Add to list…</MenuItem>
                            )}
                            {onShare && (
                              <MenuItem onClick={() => { close(); onShare(current); }}>Share</MenuItem>
                            )}
                          </>
                        )}
                      </OverlayMenu>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Detail block — beside image on wide, below on mobile.
                Clickable: opens the original listing in a new tab
                (Mark spec 2026-05-13). Use a <a> so middle-click /
                cmd-click / context-menu behave naturally. */}
            <a
              href={current.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!current.url) e.preventDefault();
              }}
              style={{
                display: "block",
                width: "100%",
                maxWidth: isWide ? 440 : 480,
                textAlign: isWide ? "left" : "center",
                flexShrink: 0,
                minWidth: 0,
                fontFamily: SANS_STACK,
                textDecoration: "none",
                color: "inherit",
                cursor: current.url ? "pointer" : "default",
              }}>
              {current.source && (
                <div style={{
                  fontSize: 11, color: "var(--text3)",
                  letterSpacing: "0.20em", textTransform: "uppercase",
                  fontWeight: 500, marginBottom: isWide ? 14 : 6,
                }}>
                  {current.source}
                </div>
              )}
              {current.brand && (
                <div style={{
                  fontFamily: SERIF_DISPLAY_STACK,
                  // PR 2026-05-22 (Mark feedback "title looks too
                  // small"): 36 → 52 on desktop so the brand reads
                  // as the page anchor next to the image.
                  fontSize: isWide ? 52 : 26,
                  fontWeight: 500, color: "var(--text1)",
                  lineHeight: 1.05, marginBottom: 8,
                  letterSpacing: "-0.01em",
                  fontVariantLigatures: "common-ligatures",
                }}>
                  {current.brand}
                </div>
              )}
              <div style={{
                fontSize: isWide ? 14 : 13, color: "var(--text2)",
                lineHeight: 1.45, marginBottom: isWide ? 16 : 6,
                overflow: "hidden", textOverflow: "ellipsis",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                fontStyle: "italic",
              }}>
                {modelTitle(current)}
              </div>
              {referenceChip(current) && (
                <div style={{
                  display: "inline-block",
                  fontSize: 11, color: "var(--text2)",
                  letterSpacing: "0.06em",
                  padding: "4px 10px",
                  border: "0.5px solid var(--border)",
                  borderRadius: 4,
                  marginBottom: isWide ? 16 : 6,
                  fontVariantNumeric: "tabular-nums",
                  textTransform: "uppercase",
                }}>
                  {referenceChip(current)}
                </div>
              )}
              {current.priceUSD > 0 && (
                <div style={{
                  fontSize: isWide ? 24 : 18, color: "var(--text1)", fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  marginTop: 6,
                  letterSpacing: "-0.005em",
                }}>
                  {fmtUSD(current.priceUSD)}
                  {current.currency && current.currency !== primaryCurrency && current.price > 0 && (
                    <span style={{
                      color: "var(--text3)", fontWeight: 400,
                      marginLeft: 10, fontSize: isWide ? 14 : 12,
                    }}>
                      · {current.currency} {current.price.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
              {current.url && (
                <div style={{
                  marginTop: isWide ? 20 : 14,
                  // Center the pill on mobile (the detail block is
                  // centered there); left-aligned on desktop where the
                  // block sits beside the image.
                  textAlign: isWide ? "left" : "center",
                }}>
                  <Pill as="span">View listing →</Pill>
                </div>
              )}
            </a>
            {/* Desktop-only inline action zone (PR 2026-05-22 Mark
                spec: "horizontal engagement design... buttons at the
                bottom of the screen are too big but also feel in the
                wrong place"). Skip / Save sit alongside the details
                column so the user's eye doesn't have to travel from
                the card to a far-away bottom bar. Undo demoted to a
                small text link underneath. Mobile keeps the
                bottom-pinned action bar (vertical-stacking pattern
                works there). Note: this is OUTSIDE the <a> so clicks
                on the buttons don't bubble through to "open listing." */}
            {isWide && (
              <div style={{
                width: "100%",
                maxWidth: 440,
                marginTop: 4,
                fontFamily: SANS_STACK,
              }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}>
                  <button onClick={handleSkip} style={skipBtnStyle()}>
                    <span style={{ fontSize: 18, fontWeight: 300, letterSpacing: 0, marginRight: -2 }}>←</span>
                    <span>Skip</span>
                  </button>
                  <button onClick={handleSaveAndAdvance} style={saveBtnStyle(isHearted)}>
                    <HeartGlyph filled={isHearted} />
                    <span>{isHearted ? "Saved" : "Save"}</span>
                    <span style={{ fontSize: 18, fontWeight: 300, letterSpacing: 0, marginLeft: -2 }}>→</span>
                  </button>
                </div>
                {/* Secondary nav as a quiet text link — much less
                    visual weight than the primary action CTAs. */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 16,
                  marginTop: 12,
                  fontSize: 12, color: "var(--text3)",
                }}>
                  <button onClick={handleUndo} disabled={idx === 0}
                    style={{
                      background: "transparent", border: "none",
                      padding: "4px 0", cursor: idx === 0 ? "default" : "pointer",
                      fontFamily: SANS_STACK, fontSize: 12,
                      color: idx === 0 ? "var(--text3)" : "var(--text2)",
                      opacity: idx === 0 ? 0.5 : 1,
                      textDecoration: "underline", textUnderlineOffset: 2,
                      letterSpacing: "0.02em",
                    }}>
                    Undo
                  </button>
                  {heartedThisSession > 0 && (
                    <span style={{
                      marginLeft: "auto",
                      fontSize: 11, color: "var(--text3)",
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: "0.06em",
                    }}>
                      {heartedThisSession} saved
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Bottom action bar — mobile only (PR 2026-05-22 redesign).
          Desktop moves the buttons inline with the details column
          above so the user's eye stays in the content. Vertical
          stacking on mobile keeps the bottom bar as the natural
          thumb-zone. */}
      {!done && current && !isWide && (
        <div style={{
          flexShrink: 0,
          borderTop: "0.5px solid var(--border)",
          background: "var(--bg)",
          padding: "10px 16px 12px",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr 1fr",
            gap: 10, alignItems: "center",
            maxWidth: 720, margin: "0 auto",
          }}>
            {/* Undo sits quiet on the left; Skip / Save are the
                primary pair, arrow-cued to match the swipe direction
                ("Skip = swipe left" / "Save = swipe right"). */}
            <button onClick={handleUndo} disabled={idx === 0} style={edgeNavStyle(idx === 0, { small: true })}>
              Undo
            </button>
            <button onClick={handleSkip} style={skipBtnStyle()}>
              <span style={{ fontSize: 18, fontWeight: 300, letterSpacing: 0, marginRight: -2 }}>←</span>
              <span>Skip</span>
            </button>
            <button onClick={handleSaveAndAdvance} style={saveBtnStyle(isHearted)}>
              <HeartGlyph filled={isHearted} />
              <span>{isHearted ? "Saved" : "Save"}</span>
              <span style={{ fontSize: 18, fontWeight: 300, letterSpacing: 0, marginLeft: -2 }}>→</span>
            </button>
          </div>
        </div>
      )}

      {/* Onboarding (one-time per browser) */}
      {showIntro && current && (
        <OnboardingCard
          ownerName={ownerName}
          total={total}
          onDismiss={dismissIntro}
        />
      )}

      {/* Break interstitial */}
      {showBreak && (
        <BreakInterstitial
          idx={idx} total={total}
          onContinue={() => setShowBreak(false)}
          onPause={() => { setShowBreak(false); onClose?.(); }}
        />
      )}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}

// ── Helpers ─────────────────────────────────────────────────────

function modelTitle(item) {
  if (item.model && item.model.trim()) return item.model.trim();
  const raw = (item.ref || item.title || "").trim();
  if (item.brand && raw.toLowerCase().startsWith(item.brand.toLowerCase())) {
    return raw.slice(item.brand.length).replace(/^[\s,·:-]+/, "").trim() || raw;
  }
  return raw;
}

function referenceChip(item) {
  if (item.reference && item.reference.trim()) return item.reference.trim();
  return null;
}

// Small heart glyph for the Save button — filled once the card is in
// the watchlist so the button doubles as a saved-state indicator.
function HeartGlyph({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}

function EdgeWash({ side, color, label, opacity }) {
  return (
    <div aria-hidden style={{
      position: "absolute",
      inset: 0,
      background: color,
      opacity,
      pointerEvents: "none",
      transition: "opacity 80ms linear",
      display: "flex", alignItems: "center",
      justifyContent: side === "left" ? "flex-start" : "flex-end",
      padding: side === "left" ? "0 0 0 36px" : "0 36px 0 0",
      zIndex: 0,
    }}>
      <span style={{
        fontFamily: SANS_STACK,
        color: "#fff",
        fontSize: 14, fontWeight: 600,
        letterSpacing: "0.24em", textTransform: "uppercase",
        textShadow: "0 1px 3px rgba(0,0,0,0.35)",
        opacity: Math.min(1, opacity * 3),
      }}>
        {label}
      </span>
    </div>
  );
}

function OnboardingCard({ ownerName, total, onDismiss }) {
  return (
    <div style={modalScrim(2120)}>
      <div style={editorialPanel(420)}>
        <div style={{
          fontFamily: SANS_STACK,
          fontSize: 11, color: "var(--text3)",
          letterSpacing: "0.20em", textTransform: "uppercase",
          fontWeight: 500, marginBottom: 16,
        }}>
          Screening
        </div>
        <div style={{
          fontFamily: SANS_STACK,
          fontSize: 22, fontWeight: 600, color: "var(--text1)",
          lineHeight: 1.2, marginBottom: 12,
          letterSpacing: "-0.005em",
        }}>
          Quick review
        </div>
        {/* Why — the purpose of the feature, not just the mechanics
            (Mark feedback 2026-05-13). */}
        <div style={{
          fontFamily: SANS_STACK,
          fontSize: 13, color: "var(--text2)",
          lineHeight: 1.55, marginBottom: 18,
        }}>
          Go through the list one watch at a time and save the ones
          worth coming back to. Saves land in your watchlist; skip
          the rest.
        </div>
        <div style={{
          fontFamily: SANS_STACK,
          fontSize: 12, color: "var(--text3)",
          lineHeight: 1.5, marginBottom: 18,
        }}>
          {total} {total === 1 ? "watch" : "watches"}{ownerName ? ` from ${ownerName}` : ""}.
        </div>
        <ul style={{
          listStyle: "none", margin: 0, padding: 0,
          fontFamily: SANS_STACK,
          fontSize: 13, color: "var(--text1)",
          lineHeight: 1.55,
          marginBottom: 24,
        }}>
          <IntroRow color="var(--heart)" glyph="♥">
            <strong>Save</strong>: swipe right or tap Save. Adds the watch to your watchlist.
          </IntroRow>
          <IntroRow color="var(--text2)" glyph="←">
            <strong>Skip</strong>: swipe left or tap Skip. Moves on, saves nothing.
          </IntroRow>
          <IntroRow color="var(--text2)" glyph="↗">
            <strong>Details</strong>: tap the card to read the full listing.
          </IntroRow>
        </ul>
        <Button primary inline onClick={onDismiss}>Start review</Button>
      </div>
    </div>
  );
}

function IntroRow({ color, glyph, children }) {
  return (
    <li style={{
      display: "flex", alignItems: "flex-start",
      gap: 12, marginBottom: 12,
    }}>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        width: 24, height: 24, borderRadius: "50%",
        background: "var(--surface)",
        border: `0.5px solid ${color}`,
        color, fontSize: 12, fontWeight: 600,
        marginTop: 1,
        fontFamily: SANS_STACK,
      }}>
        {glyph}
      </span>
      <span>{children}</span>
    </li>
  );
}

function BreakInterstitial({ idx, total, onContinue, onPause }) {
  return (
    <div style={modalScrim(2050)}>
      <div style={editorialPanel(380)}>
        <div style={{
          fontFamily: SANS_STACK,
          fontSize: 11, color: "var(--text3)",
          letterSpacing: "0.20em", textTransform: "uppercase",
          fontWeight: 500, marginBottom: 14,
        }}>
          Pause
        </div>
        <div style={{
          fontFamily: SANS_STACK,
          fontSize: 22, fontWeight: 600, color: "var(--text1)",
          lineHeight: 1.25, marginBottom: 10,
          letterSpacing: "-0.005em",
        }}>
          Take a break?
        </div>
        <div style={{
          fontFamily: SANS_STACK,
          fontSize: 14, color: "var(--text2)",
          lineHeight: 1.5, marginBottom: 24,
        }}>
          {idx} of {total} reviewed. Come back anytime; your place is saved.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button inline onClick={onPause}>Pause &amp; bookmark</Button>
          <Button primary inline onClick={onContinue}>Keep going</Button>
        </div>
      </div>
    </div>
  );
}

// Completion view — shown when the queue runs out. Binary screening
// has no recap tally (results ARE the hearted watchlist); this is a
// light close-out with a count of what was saved this pass.
function CompletionView({ total, heartedThisSession, onClose }) {
  return (
    <div style={{
      textAlign: "center", maxWidth: 460,
      margin: "auto", padding: "32px 16px",
      fontFamily: SANS_STACK,
    }}>
      <div style={{
        fontSize: 11, color: "var(--text3)",
        letterSpacing: "0.22em", textTransform: "uppercase",
        fontWeight: 500, marginBottom: 16,
      }}>
        All reviewed
      </div>
      <div style={{
        fontFamily: SANS_STACK,
        fontSize: 22, fontWeight: 600, color: "var(--text1)",
        lineHeight: 1.2, marginBottom: 14,
        letterSpacing: "-0.005em",
      }}>
        {heartedThisSession > 0
          ? `Saved ${heartedThisSession} of ${total}.`
          : "Nothing saved this time."}
      </div>
      <div style={{
        fontSize: 13, color: "var(--text2)",
        marginBottom: 26, lineHeight: 1.5,
        fontStyle: "italic",
      }}>
        {heartedThisSession > 0
          ? "Your saves are in your watchlist."
          : "Swipe right or tap Save to add a watch to your watchlist."}
      </div>
      <Button primary inline onClick={onClose}>Done</Button>
    </div>
  );
}

// ── Shared styles ───────────────────────────────────────────────

const topLinkStyle = {
  border: "none", background: "transparent", cursor: "pointer",
  color: "var(--brand-olive-text)",
  fontFamily: SANS_STACK,
  fontSize: 14, padding: 0,
  display: "flex", alignItems: "center", gap: 4,
  fontWeight: 500,
  letterSpacing: "0.02em",
};

// Save — solid heart-red fill so the primary "save to watchlist"
// action carries the watchlist's own color language (matches the
// active on-card heart). Subtle press shadow so it reads as a CTA.
function saveBtnStyle(saved) {
  return {
    padding: "14px 20px",
    border: "1px solid var(--heart)",
    background: "var(--heart)",
    color: "#fff",
    fontFamily: SANS_STACK,
    fontSize: 14, fontWeight: 600,
    letterSpacing: "0.18em", textTransform: "uppercase",
    borderRadius: 8, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    minHeight: 52,
    boxShadow: saved
      ? "inset 0 0 0 2px var(--heart), 0 0 0 1px var(--heart)"
      : "0 1px 2px rgba(0,0,0,0.08)",
  };
}

// Skip — substantial outlined ghost (the neutral, no-op pass).
function skipBtnStyle() {
  return {
    padding: "14px 20px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text1)",
    fontFamily: SANS_STACK,
    fontSize: 14, fontWeight: 600,
    letterSpacing: "0.18em", textTransform: "uppercase",
    borderRadius: 8, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    minHeight: 52,
  };
}

function edgeNavStyle(disabled, { small = false } = {}) {
  return {
    border: "none", background: "transparent",
    color: disabled ? "var(--text3)" : "var(--text2)",
    fontFamily: SANS_STACK,
    fontSize: small ? 11 : 13,
    letterSpacing: "0.10em", textTransform: "uppercase",
    padding: small ? "8px 8px" : "12px 10px",
    cursor: disabled ? "default" : "pointer",
    fontWeight: 400,
  };
}

function modalScrim(z) {
  return {
    position: "fixed", inset: 0, zIndex: z,
    background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 24,
  };
}

function editorialPanel(maxWidth) {
  return {
    background: "var(--bg)",
    border: "0.5px solid var(--border)",
    borderRadius: 12,
    padding: "32px 24px",
    maxWidth, width: "100%",
    fontFamily: SANS_STACK,
    boxShadow: "0 24px 60px rgba(0,0,0,0.20)",
  };
}

