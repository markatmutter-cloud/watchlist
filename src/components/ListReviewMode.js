import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { imgSrc, fmtUSD } from "../utils";

// Swipe-gesture thresholds. Anything past these on release commits
// the corresponding reaction; below, the card springs back. Values
// tuned on iPhone SE (375px wide) — ~25% of viewport width to commit.
const SWIPE_THRESHOLD_X = 90;
const SWIPE_ROTATE_PER_PX = 0.06;
// Tap detection — if the pointer moved less than this between down
// and up, treat as a tap-to-expand rather than a swipe.
const TAP_MAX_MOVE = 8;
// Insert a "take a break?" interstitial every N reviewed cards so
// long queues (auction catalogs of 600+ lots, see [[feedback-
// screening-long-queues]]) don't grind the user down.
const BREAK_INTERVAL = 25;

// Per-list persistence so a user who pauses mid-flow can pick up
// where they left off. Stored in localStorage; cross-device resume
// is out of scope for v1 (revisit via Supabase if it matters later).
const persistenceKey = (listId) => `screening_${listId || "default"}`;
function readPersistedIdx(listId) {
  try {
    const raw = localStorage.getItem(persistenceKey(listId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Number.isFinite(parsed?.idx) ? parsed.idx : null;
  } catch { return null; }
}
function writePersistedIdx(listId, idx) {
  try {
    localStorage.setItem(persistenceKey(listId), JSON.stringify({ idx, ts: Date.now() }));
  } catch {}
}
function clearPersistedIdx(listId) {
  try { localStorage.removeItem(persistenceKey(listId)); } catch {}
}

// Editorial Screening mode (Mark's "tinder function" — see
// [[feedback-screening-mode-naming]]). Fullscreen one-at-a-time
// review of items in a list (or, later, an auction catalog).
// Visual ethos matches the rest of Watchlist: thin chrome, tracked
// uppercase labels, brand-blue + danger accents, monochrome SVG
// glyphs — explicitly NOT cellphone-emoji thumbs/hearts.
//
// Two reactions: Yes (👍 conceptually) + Pass (👎). Heart is a
// separate tap action that promotes the item to the user's own
// watchlist (independent of the list-reaction layer). Per Mark
// feedback 2026-05-13: "three responses is tough... heart for
// serious interest rather than swipe up."
//
// Swipe gestures (right = Yes, left = Pass) translate the card
// with a subtle rotation; an edge color wash gives feedback that
// doesn't depend on a small icon being visible behind the user's
// thumb. Tap the image to open the detail sheet without losing
// position. Pointer events unify touch + mouse + pen.

export function ListReviewMode({
  items,
  listId,                // for localStorage persistence
  listName,
  ownerName,
  currentUserId,
  reactionsByItem,
  onToggleReaction,
  onClose,
  primaryCurrency,
  // Card-style affordances on the swipe card (Mark spec 2026-05-13):
  // heart promotes to the user's own watchlist; ⋯ opens add-to-list /
  // share / details. All optional — if absent, the overlay button
  // doesn't render.
  watchlist,
  handleWish,
  openCollectionPicker,
  onShare,
  onOpenDetail,
}) {
  // Snapshot the to-review queue once at mount via a lazy-init
  // useState. We deliberately want a frozen snapshot — using useMemo
  // with [items, reactionsByItem] would re-derive every time the
  // user records a reaction (reactionsByItem updates), shifting the
  // current item out from under them mid-flow.
  const [initialQueue] = useState(() => {
    if (!currentUserId) return items;
    return items.filter(it => {
      const rs = reactionsByItem.get(it.rowId) || [];
      return !rs.some(r => r.user_id === currentUserId);
    });
  });

  const total = initialQueue.length;
  // Resume from a persisted index if there is one for this list,
  // clamped to the current queue size.
  const [idx, setIdx] = useState(() => {
    const persisted = readPersistedIdx(listId);
    if (persisted == null) return 0;
    return Math.max(0, Math.min(persisted, total));
  });
  const done = idx >= total;
  const current = done ? null : initialQueue[idx];

  // Persist on every advance. When done, clear so a re-entry starts
  // fresh rather than landing on the recap.
  useEffect(() => {
    if (!listId) return;
    if (done) clearPersistedIdx(listId);
    else writePersistedIdx(listId, idx);
  }, [idx, done, listId]);

  // Break-interstitial trigger. Fires when idx crosses a multiple
  // of BREAK_INTERVAL upward. lastBreakRef tracks the last threshold
  // we showed so we don't re-show on Back navigation.
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

  // ESC closes the overlay; arrows nav previous/next.
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

  const myReactionOnCurrent = useMemo(() => {
    if (!current || !currentUserId) return null;
    const rs = reactionsByItem.get(current.rowId) || [];
    const mine = rs.find(r => r.user_id === currentUserId);
    return mine?.emoji || null;
  }, [current, currentUserId, reactionsByItem]);

  // Running tallies for the recap screen. Snapshot at mount + update
  // on every commit so the final recap reflects this session's work,
  // not the full per-list reaction history.
  const [tally, setTally] = useState({ yes: 0, pass: 0, hearted: 0 });

  // Swipe-gesture state. `drag` drives the card transform; `flyOut`
  // is "we're past the threshold — animate off then commit."
  // dragStartRef captures the touch origin without re-render.
  const dragStartRef = useRef(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [flyOut, setFlyOut] = useState(null);  // null | "left" | "right"
  useEffect(() => {
    setDrag({ x: 0, y: 0 });
    setFlyOut(null);
  }, [idx]);

  const recordReaction = async (emoji) => {
    if (!current) return;
    if (myReactionOnCurrent !== emoji) {
      try { await onToggleReaction(current.rowId, emoji); }
      catch (e) { /* swallow — surfacing errors interrupts the flow */ }
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

  // ⋯ menu state — portal-rendered like Card's overflow menu so
  // long labels aren't clipped by the card's overflow:hidden.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef(null);

  // Pointer-event handlers — touch + mouse + pen via one path.
  // Distinguish tap (movement < TAP_MAX_MOVE) from swipe so a tap on
  // the image expands the detail sheet rather than triggering a
  // micro-swipe.
  const onPointerDown = (e) => {
    if (!current || flyOut) return;
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
    // Tap → open detail.
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

  // Edge-wash opacity for swipe feedback. Tasteful color gradient
  // creeping in from the side rather than a bouncy emoji stamp.
  const washOpacity = (sign) => {
    const v = sign === 1 ? Math.max(0, drag.x) : Math.max(0, -drag.x);
    return Math.min(0.65, v / SWIPE_THRESHOLD_X * 0.65);
  };

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
          fontSize: 11, color: "var(--text3)",
          letterSpacing: "0.12em", textTransform: "uppercase",
          fontWeight: 500, textAlign: "center",
          minWidth: 0, flex: 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {listName}
        </div>
        <div style={{
          fontSize: 12, color: "var(--text3)", flexShrink: 0,
          minWidth: 56, textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}>
          {done ? `${total} / ${total}` : `${idx + 1} / ${total}`}
        </div>
      </div>

      {/* Progress bar — hairline */}
      <div style={{ height: 2, background: "var(--border)", flexShrink: 0 }}>
        <div style={{
          height: "100%",
          width: total > 0 ? `${(Math.min(idx, total) / total) * 100}%` : "0%",
          background: "var(--brand)",
          transition: "width 200ms ease",
        }} />
      </div>

      {/* Body */}
      <div style={{
        flex: 1, overflow: "auto",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "flex-start",
        padding: "20px 16px 24px",
        gap: 16,
        position: "relative",
      }}>
        {done ? (
          <RecapView tally={tally} total={total} ownerName={ownerName} onClose={onClose} />
        ) : current ? (
          <>
            {/* Card-stack peek: thin slice of the next card behind
                the current one. Pure delight — reads as continuous
                flow, builds anticipation. */}
            {idx + 1 < total && (
              <div aria-hidden style={{
                position: "absolute", top: 28, left: "50%",
                transform: "translateX(-50%) scale(0.96)",
                width: "calc(100% - 32px)", maxWidth: 460,
                aspectRatio: "1 / 1",
                borderRadius: 12,
                border: "0.5px solid var(--border)",
                background: "var(--surface)",
                opacity: 0.45,
                pointerEvents: "none",
              }} />
            )}

            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              style={{
                width: "100%", maxWidth: 480,
                touchAction: "none",
                transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x * SWIPE_ROTATE_PER_PX}deg)`,
                transition: (dragStartRef.current || flyOut)
                  ? (flyOut ? "transform 220ms ease-out" : "none")
                  : "transform 220ms ease-out",
                userSelect: "none",
                position: "relative",
                zIndex: 1,
              }}>
              {/* Image area */}
              <div style={{
                width: "100%",
                aspectRatio: "1 / 1",
                borderRadius: 12, overflow: "hidden",
                background: "var(--surface)",
                border: "0.5px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative",
              }}>
                {current.img ? (
                  <img src={imgSrc(current.img)} alt={current.title || ""}
                    draggable={false}
                    style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                    loading="eager"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text3)", letterSpacing: "0.06em" }}>NO IMAGE</div>
                )}

                {/* Edge color washes — drag-feedback that doesn't
                    depend on a small icon visible behind the thumb. */}
                <EdgeWash side="left" color="var(--danger)" label="PASS" opacity={washOpacity(-1)} />
                <EdgeWash side="right" color="var(--brand)" label="YES" opacity={washOpacity(1)} />

                {/* ⋯ menu trigger — top-left, monochrome thin glyph
                    in a subtle dark pill so it reads on any image. */}
                {(openCollectionPicker || onShare || onOpenDetail) && (
                  <button ref={menuTriggerRef}
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
                    aria-label="More actions"
                    style={overlayIconBtn("left")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="5" cy="12" r="1" fill="currentColor"/>
                      <circle cx="12" cy="12" r="1" fill="currentColor"/>
                      <circle cx="19" cy="12" r="1" fill="currentColor"/>
                    </svg>
                  </button>
                )}

                {/* Heart — top-right. Filled when in user's watchlist
                    (a separate, persistent signal from list reactions). */}
                {handleWish && (
                  <button onClick={(e) => { e.stopPropagation(); handleHeart(); }}
                    aria-label={isHearted ? "Remove from watchlist" : "Add to watchlist"}
                    style={overlayIconBtn("right", isHearted)}>
                    <svg width="15" height="15" viewBox="0 0 24 24"
                      fill={isHearted ? "currentColor" : "none"}
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </button>
                )}

                {/* Price chip — subtle bottom-left overlay so price
                    lands in peripheral vision without scrolling. */}
                {current.priceUSD > 0 && (
                  <div style={{
                    position: "absolute", bottom: 10, left: 10,
                    background: "rgba(0,0,0,0.55)",
                    color: "#fff",
                    padding: "4px 8px",
                    borderRadius: 4,
                    fontSize: 12, fontWeight: 500,
                    letterSpacing: "0.02em",
                    pointerEvents: "none",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {fmtUSD(current.priceUSD)}
                    {current.sold ? " · SOLD" : ""}
                  </div>
                )}
              </div>

              {/* Detail block — editorial hierarchy. */}
              <div style={{ width: "100%", textAlign: "center", paddingTop: 18 }}>
                {current.source && (
                  <div style={{
                    fontSize: 10, color: "var(--text3)",
                    letterSpacing: "0.14em", textTransform: "uppercase",
                    fontWeight: 500, marginBottom: 8,
                  }}>
                    {current.source}
                  </div>
                )}
                {current.brand && (
                  <div style={{
                    fontSize: 22, fontWeight: 600, color: "var(--text1)",
                    lineHeight: 1.2, marginBottom: 4,
                    letterSpacing: "-0.005em",
                  }}>
                    {current.brand}
                  </div>
                )}
                <div style={{
                  fontSize: 14, color: "var(--text2)",
                  lineHeight: 1.4, marginBottom: 8,
                  overflow: "hidden", textOverflow: "ellipsis",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                }}>
                  {modelTitle(current)}
                </div>
                {referenceChip(current) && (
                  <div style={{
                    display: "inline-block",
                    fontSize: 11, color: "var(--text2)",
                    letterSpacing: "0.04em",
                    padding: "3px 8px",
                    border: "0.5px solid var(--border)",
                    borderRadius: 4,
                    marginBottom: 10,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {referenceChip(current)}
                  </div>
                )}
                {current.priceUSD > 0 && (
                  <div style={{
                    fontSize: 18, color: "var(--text1)", fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    marginTop: 4,
                  }}>
                    {fmtUSD(current.priceUSD)}
                    {current.currency && current.currency !== primaryCurrency && current.price > 0 && (
                      <span style={{ color: "var(--text3)", fontWeight: 400, marginLeft: 8, fontSize: 13 }}>
                        · {current.currency} {current.price.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
                <div style={{
                  fontSize: 11, color: "var(--text3)", marginTop: 12,
                  letterSpacing: "0.04em",
                }}>
                  Tap card for details
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Bottom action area */}
      {!done && current && (
        <div style={{
          flexShrink: 0,
          borderTop: "0.5px solid var(--border)",
          background: "var(--bg)",
          padding: "12px 16px 14px",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr 1fr auto",
            gap: 10, alignItems: "center",
            maxWidth: 560, margin: "0 auto",
          }}>
            <button onClick={handlePrev} disabled={idx === 0} style={edgeNavStyle(idx === 0)}>
              ← Back
            </button>
            <button onClick={handlePass} style={reactionBtnStyle("pass", myReactionOnCurrent === "❌")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              Pass
            </button>
            <button onClick={handleYes} style={reactionBtnStyle("yes", myReactionOnCurrent === "👍")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              Yes
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
              textAlign: "center", marginTop: 10,
              fontSize: 11, color: "var(--text3)", letterSpacing: "0.04em",
            }}>
              Swipe right or tap Yes · left or tap Pass · tap heart for serious interest · ⋯ for more
            </div>
          ) : null}
        </div>
      )}

      {/* ⋯ menu — portal-rendered so the menu isn't clipped by
          any ancestor overflow. */}
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

      {/* Break interstitial — drops over the body when triggered. */}
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

// Derive the secondary identification line. For listings, the
// scraper-supplied `ref` is title-like (brand + model + ref blob);
// for manual entries we have separate model/ref columns. Prefer
// `model` when present, else strip leading brand from `ref` to
// avoid duplicating the brand we already render above.
function modelTitle(item) {
  if (item.model && item.model.trim()) return item.model.trim();
  const raw = (item.ref || item.title || "").trim();
  if (item.brand && raw.toLowerCase().startsWith(item.brand.toLowerCase())) {
    return raw.slice(item.brand.length).replace(/^[\s,·:-]+/, "").trim() || raw;
  }
  return raw;
}

function referenceChip(item) {
  // Manual entries have a dedicated `reference` field; listings don't
  // — the scraper's `ref` is a title-blob, not a reference number.
  // Only surface the chip when we have a clean reference number.
  if (item.reference && item.reference.trim()) return item.reference.trim();
  return null;
}

// Edge color wash overlay — fades in from the swipe direction as
// the user drags, with a small uppercase label. Matches the
// "screen shades not bubble-up reactions" direction.
function EdgeWash({ side, color, label, opacity }) {
  const gradient = side === "left"
    ? `linear-gradient(to right, ${color}, transparent)`
    : `linear-gradient(to left, ${color}, transparent)`;
  return (
    <div aria-hidden style={{
      position: "absolute",
      top: 0, bottom: 0,
      [side]: 0,
      width: "55%",
      background: gradient,
      opacity,
      pointerEvents: "none",
      transition: "opacity 80ms linear",
      display: "flex", alignItems: "center",
      justifyContent: side === "left" ? "flex-start" : "flex-end",
      padding: side === "left" ? "0 0 0 18px" : "0 18px 0 0",
    }}>
      <span style={{
        color: "#fff",
        fontSize: 14, fontWeight: 600,
        letterSpacing: "0.18em", textTransform: "uppercase",
        textShadow: "0 1px 3px rgba(0,0,0,0.35)",
        opacity: Math.min(1, opacity * 1.6),
      }}>
        {label}
      </span>
    </div>
  );
}

// Portal-rendered overflow menu — same pattern as Card.js's ⋯ menu.
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
  const menu = (
    <div ref={portalRef} style={{
      position: "fixed",
      top: rect.bottom + 6,
      left: rect.left,
      minWidth: 180,
      background: "var(--bg)",
      border: "0.5px solid var(--border)",
      borderRadius: 8,
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
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

// Take-a-break interstitial. Shown every BREAK_INTERVAL reviewed
// cards on long queues so users can pause without feeling like
// they're quitting (see [[feedback-screening-long-queues]]).
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
        borderRadius: 12,
        padding: "32px 24px",
        maxWidth: 360, width: "100%",
        textAlign: "center",
        fontFamily: "inherit",
      }}>
        <div style={{
          fontSize: 11, color: "var(--text3)",
          letterSpacing: "0.14em", textTransform: "uppercase",
          fontWeight: 500, marginBottom: 12,
        }}>
          Pause
        </div>
        <div style={{
          fontSize: 22, fontWeight: 600, color: "var(--text1)",
          lineHeight: 1.25, marginBottom: 10,
        }}>
          Take a break?
        </div>
        <div style={{
          fontSize: 13, color: "var(--text2)",
          lineHeight: 1.5, marginBottom: 22,
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

// End-of-queue recap. Editorial tally — no bouncy fireworks. The
// owner will see reactions through their own list view; the
// closing message acknowledges that.
function RecapView({ tally, total, ownerName, onClose }) {
  return (
    <div style={{
      textAlign: "center", maxWidth: 360,
      margin: "auto", padding: "40px 16px",
    }}>
      <div style={{
        fontSize: 10, color: "var(--text3)",
        letterSpacing: "0.16em", textTransform: "uppercase",
        fontWeight: 500, marginBottom: 14,
      }}>
        All reviewed
      </div>
      <div style={{
        fontSize: 26, fontWeight: 600, color: "var(--text1)",
        lineHeight: 1.2, marginBottom: 18,
      }}>
        {total} watch{total === 1 ? "" : "es"}, sorted.
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: 10, margin: "0 auto 24px", maxWidth: 280,
      }}>
        <TallyCard label="Yes" value={tally.yes} color="var(--brand)" />
        <TallyCard label="Hearted" value={tally.hearted} color="var(--brand)" />
        <TallyCard label="Pass" value={tally.pass} color="var(--danger)" />
      </div>
      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 22, lineHeight: 1.5 }}>
        {ownerName} will see your reactions next time they open the list.
      </div>
      <button onClick={onClose} style={{
        padding: "12px 28px", borderRadius: 8,
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
      padding: "12px 8px",
      border: "0.5px solid var(--border)",
      borderRadius: 8,
      background: "var(--surface)",
    }}>
      <div style={{
        fontSize: 22, fontWeight: 600,
        color: value > 0 ? color : "var(--text3)",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10, color: "var(--text3)",
        letterSpacing: "0.12em", textTransform: "uppercase",
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
  color: "var(--brand)", fontFamily: "inherit", fontSize: 13, padding: 0,
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

function reactionBtnStyle(kind, active) {
  const color = kind === "yes" ? "var(--brand)" : "var(--danger)";
  return {
    padding: "12px 16px",
    border: active ? `1px solid ${color}` : "0.5px solid var(--border)",
    background: active
      ? (kind === "yes" ? "var(--brand-tint-10)" : "rgba(199,82,84,0.10)")
      : "var(--surface)",
    color: color,
    fontFamily: "inherit",
    fontSize: 13, fontWeight: 600,
    letterSpacing: "0.06em", textTransform: "uppercase",
    borderRadius: 8, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  };
}

function edgeNavStyle(disabled) {
  return {
    border: "none", background: "transparent",
    color: disabled ? "var(--text3)" : "var(--text2)",
    fontFamily: "inherit", fontSize: 12,
    letterSpacing: "0.04em",
    padding: "10px 8px",
    cursor: disabled ? "default" : "pointer",
  };
}

function overlayIconBtn(side, active = false) {
  return {
    position: "absolute",
    top: 10,
    [side]: 10,
    zIndex: 5,
    width: 32, height: 32,
    borderRadius: "50%",
    border: "none",
    background: "rgba(0,0,0,0.45)",
    color: active ? "var(--brand)" : "#fff",
    cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0,
    backdropFilter: "blur(6px)",
  };
}
