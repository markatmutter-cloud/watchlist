import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { imgSrc, fmtUSD } from "../utils";

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
          <>
            {/* Big image */}
            <div style={{
              width: "100%", maxWidth: 480,
              aspectRatio: "1 / 1",
              borderRadius: 12, overflow: "hidden",
              background: "var(--surface)",
              border: "0.5px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {current.image ? (
                <img src={imgSrc(current.image)} alt={current.title || ""}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  loading="eager"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <div style={{ fontSize: 13, color: "var(--text3)" }}>No image</div>
              )}
            </div>

            {/* Details */}
            <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
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
          </>
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
