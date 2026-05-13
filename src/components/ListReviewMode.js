import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { imgSrc, fmtUSD } from "../utils";

// Swipe-gesture thresholds. Past this on release commits the
// corresponding reaction; below, the card springs back. Values
// tuned on iPhone SE (375px wide) — ~25% of viewport to commit.
const SWIPE_THRESHOLD_X = 90;
const SWIPE_ROTATE_PER_PX = 0.06;
// Tap detection — if pointer moved less than this between down/up,
// treat as a tap-to-expand rather than a swipe.
const TAP_MAX_MOVE = 8;
// Insert a "take a break?" interstitial every N reviewed cards on
// long queues (auction catalogs of 600+ lots, see [[feedback-
// screening-long-queues]]).
const BREAK_INTERVAL = 25;
// Viewport breakpoint for side-by-side desktop layout.
const SIDE_BY_SIDE_MIN = 900;

// Per-list persistence — survives mid-flow exit + browser refresh.
// Keyed by listId; stores the rowId of the last reviewed item, NOT
// the numeric index. On resume, we re-locate that rowId in the
// freshly-filtered queue so an off-by-one doesn't happen when the
// queue shrinks because items were reacted to.
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

// Editorial Screening mode (Mark's "tinder function" — see
// [[feedback-screening-mode-naming]]). Fullscreen one-at-a-time
// review of items in a list (or, later, an auction catalog).
// Editorial chrome — thin borders, monochrome SVG glyphs, brand-blue
// + danger accents. Explicitly NOT cellphone-emoji thumbs/hearts.
//
// Reactions: Yes + Pass. Heart is a separate tap action that
// promotes the item to the user's own watchlist (independent of the
// list-reaction layer). Per Mark feedback 2026-05-13: "three
// responses is tough... heart for serious interest rather than
// swipe up."
//
// Swipe right = Yes / left = Pass / tap = open detail sheet.
// Edge color washes (rendered OUTSIDE the moving card so they stay
// on the screen edges during fly-out) give feedback that can't be
// hidden by the user's thumb.

export function ListReviewMode({
  items,
  listId,
  listName,
  ownerName,
  currentUserId,
  reactionsByItem,
  onToggleReaction,
  onClose,
  primaryCurrency,
  watchlist,
  handleWish,
  openCollectionPicker,
  onShare,
  onOpenDetail,
}) {
  // Frozen queue at mount via lazy-init useState — items the user
  // hasn't reacted to. useMemo would re-derive when reactionsByItem
  // updates, shifting the current item out from under the user.
  const [initialQueue] = useState(() => {
    if (!currentUserId) return items;
    return items.filter(it => {
      const rs = reactionsByItem.get(it.rowId) || [];
      return !rs.some(r => r.user_id === currentUserId);
    });
  });

  const total = initialQueue.length;

  // Resume from a persisted rowId if there is one. We find the
  // index of that rowId in the freshly-filtered queue (the item the
  // user was last LOOKING at when they exited). If it's been
  // reacted to since (so filtered out of the new queue), start at
  // the first item past it in the original items ordering.
  const [idx, setIdx] = useState(() => {
    const persistedRowId = readPersistedRowId(listId);
    if (!persistedRowId) return 0;
    const directHit = initialQueue.findIndex(it => it.rowId === persistedRowId);
    if (directHit >= 0) return directHit;
    // Not in the new queue — find the first queue item whose
    // original-list position is at/after the persisted item's.
    const persistedPos = items.findIndex(it => it.rowId === persistedRowId);
    if (persistedPos < 0) return 0;
    const next = initialQueue.findIndex(it => items.indexOf(it) > persistedPos);
    return next >= 0 ? next : initialQueue.length;
  });
  const done = idx >= total;
  const current = done ? null : initialQueue[idx];

  // Persist the rowId of the item the user is CURRENTLY viewing
  // (not the next-to-view). Resume lands the user back on this
  // exact card.
  useEffect(() => {
    if (!listId) return;
    if (done || !current) clearPersistedRowId(listId);
    else writePersistedRowId(listId, current.rowId);
  }, [current, done, listId]);

  // Break-interstitial trigger.
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

  // ESC closes; arrows nav.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowRight" && idx < total) setIdx(i => i + 1);
      else if (e.key === "ArrowLeft" && idx > 0) setIdx(i => i - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, idx, total]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Responsive layout — side-by-side on wide viewports.
  const [isWide, setIsWide] = useState(() =>
    typeof window !== "undefined" && window.innerWidth >= SIDE_BY_SIDE_MIN
  );
  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= SIDE_BY_SIDE_MIN);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const myReactionOnCurrent = useMemo(() => {
    if (!current || !currentUserId) return null;
    const rs = reactionsByItem.get(current.rowId) || [];
    const mine = rs.find(r => r.user_id === currentUserId);
    return mine?.emoji || null;
  }, [current, currentUserId, reactionsByItem]);

  // Running tally for the recap.
  const [tally, setTally] = useState({ yes: 0, pass: 0, hearted: 0 });

  // Swipe state.
  const dragStartRef = useRef(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [flyOut, setFlyOut] = useState(null);
  // Mount-rise animation — new cards rise from the deck (scale
  // 0.94 → 1.0) instead of sliding in from the swipe-out direction.
  // Per Mark feedback 2026-05-13: "new cards come in from the left
  // — be good if they came from behind so up from the phone screen
  // to the top like a deck of cards."
  const [rising, setRising] = useState(false);
  const prevIdxRef = useRef(idx);
  useEffect(() => {
    setDrag({ x: 0, y: 0 });
    setFlyOut(null);
    if (idx > prevIdxRef.current) {
      // Advancing — animate the new card up from the peek state.
      setRising(true);
      const t = setTimeout(() => setRising(false), 240);
      prevIdxRef.current = idx;
      return () => clearTimeout(t);
    }
    prevIdxRef.current = idx;
  }, [idx]);

  const recordReaction = async (emoji) => {
    if (!current) return;
    if (myReactionOnCurrent !== emoji) {
      try { await onToggleReaction(current.rowId, emoji); }
      catch (e) { /* swallow */ }
    }
    if (emoji === "👍") setTally(t => ({ ...t, yes: t.yes + 1 }));
    if (emoji === "❌") setTally(t => ({ ...t, pass: t.pass + 1 }));
    setIdx(i => i + 1);
  };

  const handleYes = () => recordReaction("👍");
  const handlePass = () => recordReaction("❌");
  const handleSkip = () => setIdx(i => i + 1);
  const handlePrev = () => setIdx(i => Math.max(0, i - 1));
  const handleClearCurrent = async () => {
    if (!current || !myReactionOnCurrent) return;
    try { await onToggleReaction(current.rowId, myReactionOnCurrent); }
    catch (e) { /* swallow */ }
  };

  const isHearted = !!(watchlist && current && watchlist[current.id]);
  const handleHeart = () => {
    if (!current || !handleWish) return;
    handleWish(current);
    if (!isHearted) setTally(t => ({ ...t, hearted: t.hearted + 1 }));
  };

  // ⋯ menu state — portal-rendered.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef(null);

  // Pointer handlers. Skip drag/capture entirely if the pointer
  // started on an interactive overlay (heart, ⋯ menu) — otherwise
  // the parent's setPointerCapture swallows the events and the
  // button's onClick never fires.
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
      setDrag({ x: 0, y: 0 });
      if (current && onOpenDetail) onOpenDetail(current);
      return;
    }
    if (dx > SWIPE_THRESHOLD_X) {
      setFlyOut("right");
      setDrag({ x: window.innerWidth + 200, y: dy * 0.4 });
      setTimeout(() => recordReaction("👍"), 220);
    } else if (dx < -SWIPE_THRESHOLD_X) {
      setFlyOut("left");
      setDrag({ x: -window.innerWidth - 200, y: dy * 0.4 });
      setTimeout(() => recordReaction("❌"), 220);
    } else {
      setDrag({ x: 0, y: 0 });
    }
  };
  const onPointerCancel = () => {
    if (flyOut) return;
    dragStartRef.current = null;
    setDrag({ x: 0, y: 0 });
  };

  // Edge-wash opacity from drag distance.
  const washOpacity = (sign) => {
    const v = sign === 1 ? Math.max(0, drag.x) : Math.max(0, -drag.x);
    return Math.min(0.55, v / SWIPE_THRESHOLD_X * 0.55);
  };

  // Card transform — combines drag, rotation, and the rise-from-peek
  // mount animation.
  const cardScale = rising ? 0.94 : 1;
  const cardTransform = `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x * SWIPE_ROTATE_PER_PX}deg) scale(${cardScale})`;
  const cardTransition = flyOut
    ? "transform 220ms ease-out"
    : (dragStartRef.current ? "none" : "transform 220ms ease-out");

  const overlay = (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "var(--bg)",
      display: "flex", flexDirection: "column",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {/* Top bar — Done · list name · counter */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, padding: "12px 16px",
        borderBottom: "0.5px solid var(--border)",
        background: "var(--bg)",
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={topLinkStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          Done
        </button>
        <div style={{
          fontSize: 13, color: "var(--text2)",
          letterSpacing: "0.10em", textTransform: "uppercase",
          fontWeight: 400, textAlign: "center",
          minWidth: 0, flex: 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {listName}
        </div>
        <div style={{
          fontSize: 13, color: "var(--text2)", flexShrink: 0,
          minWidth: 56, textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}>
          {done ? `${total} / ${total}` : `${idx + 1} / ${total}`}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: "var(--border)", flexShrink: 0 }}>
        <div style={{
          height: "100%",
          width: total > 0 ? `${(Math.min(idx, total) / total) * 100}%` : "0%",
          background: "var(--brand)",
          transition: "width 200ms ease",
        }} />
      </div>

      {/* Body — relative-positioned so edge washes can pin to its sides. */}
      <div style={{
        flex: 1, overflow: "hidden",
        display: "flex",
        flexDirection: isWide ? "row" : "column",
        alignItems: "center", justifyContent: "center",
        padding: isWide ? "24px 32px 24px" : "16px 16px 12px",
        gap: isWide ? 32 : 12,
        position: "relative",
      }}>
        {/* Edge washes — rendered OUTSIDE the moving card so the
            colored area stays visible on the viewport edge as the
            card flies off. Per Mark feedback 2026-05-13: "the color
            on the car as you swipe is good but maybe behind the card
            as the car is off the screen." */}
        {!done && current && (
          <>
            <EdgeWash side="left" color="var(--danger)" label="PASS" opacity={washOpacity(-1)} />
            <EdgeWash side="right" color="var(--brand)" label="YES" opacity={washOpacity(1)} />
          </>
        )}

        {done ? (
          <RecapView tally={tally} total={total} ownerName={ownerName} onClose={onClose} />
        ) : current ? (
          <>
            {/* Image stack — image card on top, peek behind. */}
            <div style={{
              position: "relative",
              width: "100%",
              maxWidth: isWide ? 520 : 380,
              flexShrink: 0,
              alignSelf: "center",
            }}>
              {/* Card-stack peek — slightly down + scaled, with its
                  own shadow so it reads as a layer behind. */}
              {idx + 1 < total && (
                <div aria-hidden style={{
                  position: "absolute",
                  top: 14, left: "4%", right: "4%",
                  aspectRatio: "1 / 1",
                  borderRadius: 14,
                  background: "var(--surface)",
                  border: "0.5px solid var(--border)",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.10)",
                  pointerEvents: "none",
                }} />
              )}

              {/* Active card — image only (details live next to it
                  on wide viewports, below it on mobile). */}
              <div
                key={current.rowId}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "1 / 1",
                  borderRadius: 14, overflow: "hidden",
                  background: "var(--surface)",
                  border: "0.5px solid var(--border)",
                  boxShadow: "0 14px 32px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.06)",
                  touchAction: "none",
                  transform: cardTransform,
                  transition: cardTransition,
                  userSelect: "none",
                  cursor: dragStartRef.current ? "grabbing" : "grab",
                  zIndex: 1,
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
                    fontSize: 11, color: "var(--text3)", letterSpacing: "0.10em",
                  }}>
                    NO IMAGE
                  </div>
                )}

                {/* Heart — top-right. Stays Card-like. */}
                {handleWish && (
                  <button data-no-drag
                    onClick={(e) => { e.stopPropagation(); handleHeart(); }}
                    aria-label={isHearted ? "Remove from watchlist" : "Add to watchlist"}
                    style={overlayIconBtn("right", 10, isHearted)}>
                    <svg width="15" height="15" viewBox="0 0 24 24"
                      fill={isHearted ? "currentColor" : "none"}
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </button>
                )}

                {/* ⋯ — top-right under heart so it stacks like
                    Card.js's chrome (Mark feedback 2026-05-13). */}
                {(openCollectionPicker || onShare || onOpenDetail) && (
                  <button data-no-drag ref={menuTriggerRef}
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
                    aria-label="More actions"
                    style={overlayIconBtn("right", 52)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="5" cy="12" r="1.5"/>
                      <circle cx="12" cy="12" r="1.5"/>
                      <circle cx="19" cy="12" r="1.5"/>
                    </svg>
                  </button>
                )}

                {/* Price chip — subtle, bottom-left. */}
                {current.priceUSD > 0 && (
                  <div style={{
                    position: "absolute", bottom: 12, left: 12,
                    background: "rgba(0,0,0,0.55)",
                    color: "#fff",
                    padding: "5px 9px",
                    borderRadius: 4,
                    fontSize: 13, fontWeight: 500,
                    letterSpacing: "0.02em",
                    pointerEvents: "none",
                    fontVariantNumeric: "tabular-nums",
                    backdropFilter: "blur(4px)",
                  }}>
                    {fmtUSD(current.priceUSD)}
                    {current.sold ? "  ·  SOLD" : ""}
                  </div>
                )}
              </div>
            </div>

            {/* Detail block — beside the image on wide, below on
                mobile. Compact on mobile so the whole interface
                fits within typical phone viewport height without
                requiring scroll. */}
            <div style={{
              width: "100%",
              maxWidth: isWide ? 380 : 480,
              textAlign: isWide ? "left" : "center",
              flexShrink: 0,
              minWidth: 0,
            }}>
              {current.source && (
                <div style={{
                  fontSize: 11, color: "var(--text3)",
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  fontWeight: 500, marginBottom: isWide ? 12 : 6,
                }}>
                  {current.source}
                </div>
              )}
              {current.brand && (
                <div style={{
                  fontSize: isWide ? 28 : 20, fontWeight: 600, color: "var(--text1)",
                  lineHeight: 1.2, marginBottom: 4,
                  letterSpacing: "-0.01em",
                }}>
                  {current.brand}
                </div>
              )}
              <div style={{
                fontSize: isWide ? 15 : 13, color: "var(--text2)",
                lineHeight: 1.4, marginBottom: isWide ? 14 : 6,
                overflow: "hidden", textOverflow: "ellipsis",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              }}>
                {modelTitle(current)}
              </div>
              {referenceChip(current) && (
                <div style={{
                  display: "inline-block",
                  fontSize: 11, color: "var(--text2)",
                  letterSpacing: "0.05em",
                  padding: "3px 8px",
                  border: "0.5px solid var(--border)",
                  borderRadius: 4,
                  marginBottom: isWide ? 14 : 6,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {referenceChip(current)}
                </div>
              )}
              {current.priceUSD > 0 && (
                <div style={{
                  fontSize: isWide ? 22 : 17, color: "var(--text1)", fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  marginTop: 4,
                }}>
                  {fmtUSD(current.priceUSD)}
                  {current.currency && current.currency !== primaryCurrency && current.price > 0 && (
                    <span style={{
                      color: "var(--text3)", fontWeight: 400,
                      marginLeft: 8, fontSize: isWide ? 14 : 12,
                    }}>
                      · {current.currency} {current.price.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
              <div style={{
                fontSize: 12, color: "var(--text3)",
                marginTop: isWide ? 18 : 10,
                letterSpacing: "0.04em",
              }}>
                Tap card to view full details
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Bottom action bar */}
      {!done && current && (
        <div style={{
          flexShrink: 0,
          borderTop: "0.5px solid var(--border)",
          background: "var(--bg)",
          padding: "10px 16px 12px",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr 1fr auto",
            gap: 12, alignItems: "center",
            maxWidth: 640, margin: "0 auto",
          }}>
            <button onClick={handlePrev} disabled={idx === 0} style={edgeNavStyle(idx === 0)}>
              ← Back
            </button>
            <button onClick={handlePass} style={reactionBtnStyle("pass", myReactionOnCurrent === "❌")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              <span>Pass</span>
            </button>
            <button onClick={handleYes} style={reactionBtnStyle("yes", myReactionOnCurrent === "👍")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              <span>Yes</span>
            </button>
            <button onClick={handleSkip} style={edgeNavStyle(false)}>
              Skip →
            </button>
          </div>
          {myReactionOnCurrent ? (
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <button onClick={handleClearCurrent} style={subtleLinkStyle}>
                Remove my reaction
              </button>
            </div>
          ) : idx === 0 ? (
            <div style={{
              textAlign: "center", marginTop: 8,
              fontSize: 12, color: "var(--text3)", letterSpacing: "0.03em",
              lineHeight: 1.4,
            }}>
              Swipe the card right for Yes, left for Pass — or use the buttons. Tap the card for details, tap heart for serious interest.
            </div>
          ) : null}
        </div>
      )}

      {/* ⋯ menu */}
      {menuOpen && menuTriggerRef.current && current && (
        <OverflowMenu
          triggerRef={menuTriggerRef}
          onClose={() => setMenuOpen(false)}
          item={current}
          openCollectionPicker={openCollectionPicker}
          onShare={onShare}
          onOpenDetail={onOpenDetail}
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

// Derive the secondary identification line. Listings use `ref` as a
// title-blob; manual entries have separate model/ref columns.
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

// Edge color wash — pinned to the viewport edge, stays put as the
// card flies off.
function EdgeWash({ side, color, label, opacity }) {
  const gradient = side === "left"
    ? `linear-gradient(to right, ${color} 0%, ${color} 20%, transparent 100%)`
    : `linear-gradient(to left,  ${color} 0%, ${color} 20%, transparent 100%)`;
  return (
    <div aria-hidden style={{
      position: "absolute",
      top: 0, bottom: 0,
      [side]: 0,
      width: "40%",
      maxWidth: 320,
      background: gradient,
      opacity,
      pointerEvents: "none",
      transition: "opacity 80ms linear",
      display: "flex", alignItems: "center",
      justifyContent: side === "left" ? "flex-start" : "flex-end",
      padding: side === "left" ? "0 0 0 24px" : "0 24px 0 0",
      zIndex: 0,
    }}>
      <span style={{
        color: "#fff",
        fontSize: 15, fontWeight: 500,
        letterSpacing: "0.18em", textTransform: "uppercase",
        textShadow: "0 1px 3px rgba(0,0,0,0.35)",
        opacity: Math.min(1, opacity * 1.5),
      }}>
        {label}
      </span>
    </div>
  );
}

function OverflowMenu({ triggerRef, onClose, item, openCollectionPicker, onShare, onOpenDetail }) {
  const portalRef = useRef(null);
  useEffect(() => {
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (portalRef.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [onClose, triggerRef]);
  const rect = triggerRef.current?.getBoundingClientRect();
  if (!rect) return null;
  // Anchor under the trigger; if it would clip off the right edge of
  // the viewport, right-align instead.
  const minWidth = 180;
  const left = Math.min(rect.left, window.innerWidth - minWidth - 12);
  const menu = (
    <div ref={portalRef} style={{
      position: "fixed",
      top: rect.bottom + 6,
      left,
      minWidth,
      background: "var(--bg)",
      border: "0.5px solid var(--border)",
      borderRadius: 8,
      boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
      padding: "4px 0",
      zIndex: 2100,
      fontFamily: "inherit",
    }}>
      {onOpenDetail && (
        <MenuItem label="Watch details" onClick={() => { onClose(); onOpenDetail(item); }} />
      )}
      {openCollectionPicker && (
        <MenuItem label="Add to list…" onClick={() => { onClose(); openCollectionPicker(item); }} />
      )}
      {onShare && (
        <MenuItem label="Share" onClick={() => { onClose(); onShare(item); }} />
      )}
    </div>
  );
  return createPortal(menu, document.body);
}

function MenuItem({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%",
      padding: "10px 14px",
      border: "none", background: "transparent",
      color: "var(--text1)", fontFamily: "inherit", fontSize: 13,
      textAlign: "left", cursor: "pointer",
    }}>
      {label}
    </button>
  );
}

function BreakInterstitial({ idx, total, onContinue, onPause }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2050,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: "var(--bg)",
        border: "0.5px solid var(--border)",
        borderRadius: 14,
        padding: "32px 24px",
        maxWidth: 380, width: "100%",
        textAlign: "center",
        fontFamily: "inherit",
        boxShadow: "0 24px 60px rgba(0,0,0,0.20)",
      }}>
        <div style={{
          fontSize: 11, color: "var(--text3)",
          letterSpacing: "0.16em", textTransform: "uppercase",
          fontWeight: 500, marginBottom: 14,
        }}>
          Pause
        </div>
        <div style={{
          fontSize: 24, fontWeight: 600, color: "var(--text1)",
          lineHeight: 1.25, marginBottom: 10,
          letterSpacing: "-0.01em",
        }}>
          Take a break?
        </div>
        <div style={{
          fontSize: 14, color: "var(--text2)",
          lineHeight: 1.5, marginBottom: 24,
        }}>
          {idx} of {total} reviewed. Come back anytime — your place is saved.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onPause} style={{
            flex: 1, padding: "12px 14px",
            border: "0.5px solid var(--border)",
            background: "transparent", color: "var(--text2)",
            borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            cursor: "pointer",
          }}>
            Pause &amp; bookmark
          </button>
          <button onClick={onContinue} style={{
            flex: 1, padding: "12px 14px",
            border: "none",
            background: "var(--brand)", color: "#fff",
            borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            cursor: "pointer",
          }}>
            Keep going
          </button>
        </div>
      </div>
    </div>
  );
}

function RecapView({ tally, total, ownerName, onClose }) {
  return (
    <div style={{
      textAlign: "center", maxWidth: 420,
      margin: "auto", padding: "40px 16px",
    }}>
      <div style={{
        fontSize: 11, color: "var(--text3)",
        letterSpacing: "0.18em", textTransform: "uppercase",
        fontWeight: 500, marginBottom: 14,
      }}>
        All reviewed
      </div>
      <div style={{
        fontSize: 28, fontWeight: 600, color: "var(--text1)",
        lineHeight: 1.2, marginBottom: 22,
        letterSpacing: "-0.01em",
      }}>
        {total} {total === 1 ? "watch" : "watches"}, sorted.
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: 10, margin: "0 auto 24px", maxWidth: 320,
      }}>
        <TallyCard label="Yes" value={tally.yes} color="var(--brand)" />
        <TallyCard label="Hearted" value={tally.hearted} color="var(--brand)" />
        <TallyCard label="Pass" value={tally.pass} color="var(--danger)" />
      </div>
      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24, lineHeight: 1.5 }}>
        {ownerName} will see your reactions next time they open the list.
      </div>
      <button onClick={onClose} style={{
        padding: "12px 30px", borderRadius: 8,
        border: "none", background: "var(--brand)", color: "#fff",
        fontFamily: "inherit", fontSize: 13, fontWeight: 500,
        cursor: "pointer",
        letterSpacing: "0.02em",
      }}>
        Back to list
      </button>
    </div>
  );
}

function TallyCard({ label, value, color }) {
  return (
    <div style={{
      padding: "14px 8px",
      border: "0.5px solid var(--border)",
      borderRadius: 10,
      background: "var(--surface)",
    }}>
      <div style={{
        fontSize: 24, fontWeight: 600,
        color: value > 0 ? color : "var(--text3)",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10, color: "var(--text3)",
        letterSpacing: "0.14em", textTransform: "uppercase",
        marginTop: 6, fontWeight: 500,
      }}>
        {label}
      </div>
    </div>
  );
}

// ── shared style helpers ────────────────────────────────────────

const topLinkStyle = {
  border: "none", background: "transparent", cursor: "pointer",
  color: "var(--brand)", fontFamily: "inherit", fontSize: 14, padding: 0,
  display: "flex", alignItems: "center", gap: 4,
  fontWeight: 500,
};

const subtleLinkStyle = {
  border: "none", background: "transparent",
  color: "var(--text3)", fontFamily: "inherit",
  fontSize: 12, padding: "4px 10px",
  cursor: "pointer", textDecoration: "underline",
  textUnderlineOffset: 2,
};

// Reaction buttons. Editorial CTA treatment: light-tracked label,
// brand/danger accent color does the work (not weight). Bigger
// presence than the surrounding chrome but quieter than emoji
// chips. Per Mark feedback 2026-05-13.
function reactionBtnStyle(kind, active) {
  const color = kind === "yes" ? "var(--brand)" : "var(--danger)";
  const tintActive = kind === "yes" ? "var(--brand-tint-12)" : "rgba(199,82,84,0.12)";
  return {
    padding: "13px 18px",
    border: active ? `1px solid ${color}` : `0.5px solid var(--border)`,
    background: active ? tintActive : "var(--surface)",
    color: color,
    fontFamily: "inherit",
    fontSize: 13, fontWeight: 500,
    letterSpacing: "0.14em", textTransform: "uppercase",
    borderRadius: 8, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    minHeight: 48,
  };
}

function edgeNavStyle(disabled) {
  return {
    border: "none", background: "transparent",
    color: disabled ? "var(--text3)" : "var(--text2)",
    fontFamily: "inherit", fontSize: 13,
    letterSpacing: "0.04em",
    padding: "12px 10px",
    cursor: disabled ? "default" : "pointer",
  };
}

function overlayIconBtn(side, top, active = false) {
  return {
    position: "absolute",
    top,
    [side]: 10,
    zIndex: 5,
    width: 34, height: 34,
    borderRadius: "50%",
    border: "none",
    background: "rgba(0,0,0,0.50)",
    color: active ? "var(--brand)" : "#fff",
    cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0,
    backdropFilter: "blur(6px)",
  };
}
