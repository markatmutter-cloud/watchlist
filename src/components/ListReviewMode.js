import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { imgSrc, fmtUSD } from "../utils";

// Swipe-gesture thresholds. Anything past these on release commits
// the corresponding reaction; below, the card springs back. Values
// tuned on iPhone SE (375px wide) — ~25% of viewport width to commit.
const SWIPE_THRESHOLD_X = 90;
const SWIPE_THRESHOLD_Y = 80;
// How much rotation per pixel of horizontal drag (radians-ish; small
// number reads as a natural tilt without spinning).
const SWIPE_ROTATE_PER_PX = 0.06;

// Fullscreen one-at-a-time review mode for a recipient who's been
// asked for their take on someone else's shared list. Per Mark spec
// 2026-05-11 — "1 photo width on mobile to review things shared with
// you." Opens from the recipient banner's "Start review" CTA.
//
// Flow:
//   - Snapshot the list of items the user hasn't reacted to at mount.
//   - Show one item per screen: image, brand/model/ref, price.
//   - Three big reaction buttons (❤️ / 👍 / ❌). Tap any of them →
//     records the reaction + auto-advances to the next item.
//   - "Skip" advances without reacting.
//   - When all reviewed, show a done state with a "Back to list" CTA.
//
// Lock the to-review snapshot at mount so the user has a stable
// position even as reactions get recorded — otherwise the index
// shifts under them between taps. Items the user re-reacts to (e.g.
// they tapped ❌ and want to switch to 👍) stay reachable via Back.

export function ListReviewMode({
  items,
  listName,
  ownerName,
  currentUserId,
  reactionsByItem,
  onToggleReaction,
  onClose,
  primaryCurrency,
}) {
  // Snapshot the to-review queue once at mount via a lazy-init
  // useState. We deliberately want a frozen snapshot — using useMemo
  // with [items, reactionsByItem] as deps would re-derive every time
  // the user records a reaction (since reactionsByItem updates), and
  // that would shift the current item out from under them mid-flow.
  // Lazy useState runs the initializer exactly once on first render.
  const [initialQueue] = useState(() => {
    if (!currentUserId) return items;
    return items.filter(it => {
      const rs = reactionsByItem.get(it.rowId) || [];
      return !rs.some(r => r.user_id === currentUserId);
    });
  });

  const [idx, setIdx] = useState(0);
  const total = initialQueue.length;
  const done = idx >= total;
  const current = done ? null : initialQueue[idx];

  // ESC closes the overlay.
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

  const myReactionOnCurrent = (() => {
    if (!current || !currentUserId) return null;
    const rs = reactionsByItem.get(current.rowId) || [];
    const mine = rs.find(r => r.user_id === currentUserId);
    return mine?.emoji || null;
  })();

  // Swipe-gesture state. `drag` is the live translation (drives the
  // card's transform); `flyOut` is "we're past the threshold — animate
  // off-screen then commit." The dragStart ref captures the touch's
  // origin without re-rendering.
  const dragStartRef = useRef(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [flyOut, setFlyOut] = useState(null);  // null | "left" | "right" | "up"
  // Reset drag whenever the current item changes (incl. after commit).
  useEffect(() => {
    setDrag({ x: 0, y: 0 });
    setFlyOut(null);
  }, [idx]);

  const handleReact = async (emoji) => {
    if (!current) return;
    // toggleReaction is "if tapped emoji matches existing, remove;
    // else set". For the review flow we want "set to this emoji and
    // advance". If user already had a different reaction, the toggle
    // RPC handles the swap (delete-then-insert via unique key). If
    // they tapped the same emoji they already had, we just advance.
    if (myReactionOnCurrent !== emoji) {
      try { await onToggleReaction(current.rowId, emoji); }
      catch (e) { /* swallow — surfacing errors here interrupts the flow */ }
    }
    setIdx(i => i + 1);
  };

  const handleSkip = () => setIdx(i => i + 1);
  const handlePrev = () => setIdx(i => Math.max(0, i - 1));
  // Clear the current user's reaction on this item without advancing
  // (Mark feedback 2026-05-12: "is it possible to undo or reset
  // ratings"). toggleReaction is the same RPC used elsewhere — tapping
  // the same emoji you already have removes it. We stay on the
  // current card so the user can pick a different one (or just leave
  // it unrated).
  const handleClearCurrent = async () => {
    if (!current || !myReactionOnCurrent) return;
    try { await onToggleReaction(current.rowId, myReactionOnCurrent); }
    catch (e) { /* swallow */ }
  };

  // Pointer-event handlers — work for touch + mouse + pen via one
  // path. We only enable while the card is on-screen (not done) and
  // not already committing (flyOut === null).
  const onPointerDown = (e) => {
    if (!current || flyOut) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    // Capture the pointer so move/up keep firing even if the finger
    // leaves the element bounds during a fast swipe.
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
    const { x, y } = {
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    };
    dragStartRef.current = null;
    // Direction precedence: up beats horizontal (so a diagonal
    // up-and-right reads as "love" rather than "yes"), and only
    // counts as up if vertical magnitude dominates.
    const isUp = y < -SWIPE_THRESHOLD_Y && Math.abs(y) > Math.abs(x);
    const isRight = !isUp && x > SWIPE_THRESHOLD_X;
    const isLeft = !isUp && x < -SWIPE_THRESHOLD_X;
    if (isUp) {
      setFlyOut("up");
      setDrag({ x: 0, y: -window.innerHeight - 200 });
      setTimeout(() => handleReact("❤️"), 220);
    } else if (isRight) {
      setFlyOut("right");
      setDrag({ x: window.innerWidth + 200, y: y * 0.5 });
      setTimeout(() => handleReact("👍"), 220);
    } else if (isLeft) {
      setFlyOut("left");
      setDrag({ x: -window.innerWidth - 200, y: y * 0.5 });
      setTimeout(() => handleReact("❌"), 220);
    } else {
      // Spring back.
      setDrag({ x: 0, y: 0 });
    }
  };
  const onPointerCancel = () => {
    if (flyOut) return;
    dragStartRef.current = null;
    setDrag({ x: 0, y: 0 });
  };

  // Visual cue overlays based on current drag direction. Opacity
  // ramps with distance so the user gets feedback before they hit
  // the commit threshold.
  const cueOpacity = (axis, sign) => {
    if (axis === "y") {
      // Up cue: y is negative.
      const v = sign === -1 ? Math.max(0, -drag.y) : Math.max(0, drag.y);
      return Math.min(1, v / SWIPE_THRESHOLD_Y);
    }
    const v = sign === 1 ? Math.max(0, drag.x) : Math.max(0, -drag.x);
    return Math.min(1, v / SWIPE_THRESHOLD_X);
  };

  const overlay = (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "var(--bg)",
      display: "flex", flexDirection: "column",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      // Respect mobile safe area so the close button doesn't sit under the notch.
      paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, padding: "12px 16px",
        borderBottom: "0.5px solid var(--border)",
        background: "var(--bg)",
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          border: "none", background: "transparent", cursor: "pointer",
          color: "var(--brand)", fontFamily: "inherit", fontSize: 14, padding: 0,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          Done
        </button>
        <div style={{
          fontSize: 13, color: "var(--text2)", textAlign: "center",
          minWidth: 0, flex: 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {listName}
        </div>
        <div style={{
          fontSize: 13, color: "var(--text3)", flexShrink: 0,
          minWidth: 64, textAlign: "right",
        }}>
          {done ? `${total} / ${total}` : `${idx + 1} / ${total}`}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "var(--border)", flexShrink: 0 }}>
        <div style={{
          height: "100%",
          width: total > 0 ? `${(Math.min(idx, total) / total) * 100}%` : "0%",
          background: "var(--brand)",
          transition: "width 200ms ease",
        }} />
      </div>

      {/* Body — scrollable so taller cards still fit on small screens. */}
      <div style={{
        flex: 1, overflow: "auto",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "flex-start",
        padding: "20px 16px 24px",
        gap: 16,
      }}>
        {done ? (
          <div style={{
            textAlign: "center", maxWidth: 360,
            margin: "auto", padding: "40px 16px",
          }}>
            <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text1)", marginBottom: 8 }}>
              All reviewed!
            </div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20, lineHeight: 1.5 }}>
              {ownerName} will see your reactions next time they open the list.
            </div>
            <button onClick={onClose} style={{
              padding: "12px 24px", borderRadius: 10,
              border: "none", background: "var(--brand)", color: "#fff",
              fontFamily: "inherit", fontSize: 14, fontWeight: 600,
              cursor: "pointer",
            }}>
              Back to list
            </button>
          </div>
        ) : current ? (
          // Swipeable card: image + details bundled into one stack
          // that translates/rotates with the drag. Pointer events
          // unify touch + mouse + pen so desktop preview works too.
          // touchAction:"none" stops the browser interpreting the
          // gesture as a page scroll.
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
            }}>
            {/* Big image */}
            <div style={{
              width: "100%",
              aspectRatio: "1 / 1",
              borderRadius: 12, overflow: "hidden",
              background: "var(--surface)",
              border: "0.5px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
            }}>
              {current.image ? (
                <img src={imgSrc(current.image)} alt={current.title || ""}
                  draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                  loading="eager"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <div style={{ fontSize: 13, color: "var(--text3)" }}>No image</div>
              )}
              {/* Swipe-direction cues — three large emoji stamps on
                  the image, each fading in as the user drags toward
                  the corresponding direction. Reads like a
                  Tinder/Bumble card. */}
              <SwipeCue position="left"  emoji="❌" label="Pass" opacity={cueOpacity("x", -1)} />
              <SwipeCue position="right" emoji="👍" label="Yes"  opacity={cueOpacity("x",  1)} />
              <SwipeCue position="top"   emoji="❤️" label="Love" opacity={cueOpacity("y", -1)} />
            </div>

            {/* Details */}
            <div style={{ width: "100%", textAlign: "center", paddingTop: 16 }}>
              {current.source && (
                <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                  {current.source}
                </div>
              )}
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text1)", lineHeight: 1.35, marginBottom: 6 }}>
                {current.title || `${current.brand || ""} ${current.model || ""}`.trim() || "Watch"}
              </div>
              {(current.brand || current.reference) && (
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>
                  {[current.brand, current.reference].filter(Boolean).join(" · ")}
                </div>
              )}
              {current.priceUSD > 0 && (
                <div style={{ fontSize: 15, color: "var(--text1)", fontWeight: 500 }}>
                  {fmtUSD(current.priceUSD)}
                  {current.currency && current.currency !== primaryCurrency && current.price > 0 && (
                    <span style={{ color: "var(--text3)", fontWeight: 400, marginLeft: 8 }}>
                      · {current.currency} {current.price.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
              {current.sold && (
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Sold
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom action area (sticky at the foot) */}
      {!done && current && (
        <div style={{
          flexShrink: 0,
          borderTop: "0.5px solid var(--border)",
          background: "var(--bg)",
          padding: "12px 16px 16px",
        }}>
          <div style={{
            display: "flex", gap: 10, justifyContent: "center",
            maxWidth: 480, margin: "0 auto",
          }}>
            {[
              { emoji: "❌", label: "Pass" },
              { emoji: "👍", label: "Yes" },
              { emoji: "❤️", label: "Love" },
            ].map(({ emoji, label }) => {
              const active = myReactionOnCurrent === emoji;
              return (
                <button key={emoji}
                  onClick={() => handleReact(emoji)}
                  style={{
                    flex: 1,
                    minHeight: 56,
                    borderRadius: 12,
                    border: active ? "1.5px solid var(--brand)" : "0.5px solid var(--border)",
                    background: active ? "var(--brand-tint-12)" : "var(--surface)",
                    color: "var(--text1)",
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: 4,
                    fontSize: 12, fontWeight: 500,
                  }}>
                  <span aria-hidden style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          {/* Swipe hint (first card only) OR clear-reaction affordance
              (when the user already has a reaction on this item).
              The clear line wins precedence on cards they've reacted
              to so the undo action is always discoverable when
              relevant. */}
          {myReactionOnCurrent ? (
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <button onClick={handleClearCurrent}
                style={{
                  border: "none", background: "transparent",
                  color: "var(--text3)", fontFamily: "inherit",
                  fontSize: 12, padding: "4px 10px",
                  cursor: "pointer", textDecoration: "underline",
                  textUnderlineOffset: 2,
                }}>
                Remove my reaction
              </button>
            </div>
          ) : idx === 0 ? (
            <div style={{
              textAlign: "center", marginTop: 8,
              fontSize: 11, color: "var(--text3)", letterSpacing: "0.04em",
            }}>
              Swipe right Yes · left Pass · up Love
            </div>
          ) : null}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 10, maxWidth: 480, margin: "10px auto 0",
          }}>
            <button onClick={handlePrev} disabled={idx === 0}
              style={{
                border: "none", background: "transparent",
                color: idx === 0 ? "var(--text3)" : "var(--brand)",
                fontFamily: "inherit", fontSize: 13,
                padding: "6px 8px",
                cursor: idx === 0 ? "default" : "pointer",
              }}>
              ← Back
            </button>
            <button onClick={handleSkip}
              style={{
                border: "none", background: "transparent",
                color: "var(--text2)", fontFamily: "inherit", fontSize: 13,
                padding: "6px 8px",
                cursor: "pointer",
              }}>
              Skip →
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Render via portal so the overlay sits above every page chrome
  // (top nav, filter row, etc.) and isn't constrained by ancestor
  // overflow. Same pattern as Card's ⋯ menu + WatchDetailSheet.
  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}

// Direction stamp overlaid on the card while swiping — fades in as
// the user drags, gives the same "you're about to like this" feedback
// as Tinder/Bumble. Positioned absolutely on top of the image; the
// parent has `position: relative`.
function SwipeCue({ position, emoji, label, opacity }) {
  const base = {
    position: "absolute",
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    padding: "6px 12px",
    borderRadius: 10,
    fontFamily: "inherit",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontSize: 11,
    display: "flex", alignItems: "center", gap: 6,
    pointerEvents: "none",
    opacity,
    transition: "opacity 80ms linear",
  };
  const pos = position === "left"
    ? { top: 16, left: 16, transform: "rotate(-12deg)" }
    : position === "right"
      ? { top: 16, right: 16, transform: "rotate(12deg)" }
      : { top: 16, left: "50%", transform: "translateX(-50%) scale(1.05)" };
  return (
    <div style={{ ...base, ...pos }}>
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>{emoji}</span>
      <span>{label}</span>
    </div>
  );
}
