import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { imgSrc, fmtUSD } from "../utils";

// Swipe gesture thresholds + tap detection.
const SWIPE_THRESHOLD_X = 90;
const SWIPE_ROTATE_PER_PX = 0.06;
const TAP_MAX_MOVE = 8;
// "Take a break?" interstitial every N reviewed cards on long
// queues (see [[feedback-screening-long-queues]]).
const BREAK_INTERVAL = 25;
// At/above this viewport width the screening surface renders
// INLINE in the tab body (Mark spec 2026-05-13 "Approach B" — top
// wordmark / nav / filter row stay visible). Mobile gets the
// fullscreen portal for focus.
const SIDE_BY_SIDE_MIN = 900;

// Editorial type stacks.
const SANS_STACK = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif";
// Serif system stack for display headlines — Mark feedback
// "title and option fonts still a bit simple, don't look produced."
const SERIF_DISPLAY_STACK = "'Hoefler Text', 'Garamond', 'Georgia', 'Times New Roman', serif";

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
// card even when the queue shrinks (items reacted to drop out).
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
  onReset,           // parent clears the reactions; we just trigger
}) {
  // Frozen queue at mount.
  const [initialQueue] = useState(() => {
    if (!currentUserId) return items;
    return items.filter(it => {
      const rs = reactionsByItem.get(it.rowId) || [];
      return !rs.some(r => r.user_id === currentUserId);
    });
  });

  const total = initialQueue.length;

  const [idx, setIdx] = useState(() => {
    const persistedRowId = readPersistedRowId(listId);
    if (!persistedRowId) return 0;
    const directHit = initialQueue.findIndex(it => it.rowId === persistedRowId);
    if (directHit >= 0) return directHit;
    const persistedPos = items.findIndex(it => it.rowId === persistedRowId);
    if (persistedPos < 0) return 0;
    const next = initialQueue.findIndex(it => items.indexOf(it) > persistedPos);
    return next >= 0 ? next : initialQueue.length;
  });
  const done = idx >= total;
  const current = done ? null : initialQueue[idx];
  const nextCard = !done && idx + 1 < total ? initialQueue[idx + 1] : null;

  // Persist current rowId.
  useEffect(() => {
    if (!listId) return;
    if (done || !current) clearPersistedRowId(listId);
    else writePersistedRowId(listId, current.rowId);
  }, [current, done, listId]);

  // Completion haptic — fires once when the queue finishes.
  // Three-pulse pattern reads as "done" vs the per-reaction tap.
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

  // ESC closes; arrows nav.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowRight" && idx < total) advance();
      else if (e.key === "ArrowLeft" && idx > 0) goBack();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
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

  const myReactionOnCurrent = useMemo(() => {
    if (!current || !currentUserId) return null;
    const rs = reactionsByItem.get(current.rowId) || [];
    const mine = rs.find(r => r.user_id === currentUserId);
    return mine?.emoji || null;
  }, [current, currentUserId, reactionsByItem]);

  // Cumulative tally — derived from reactionsByItem (not a session
  // counter) so resume + recap reflects ALL reactions on this list.
  // Counts an item once even if it has both Yes AND Pass rows
  // (defensive against any historical pre-v1.3.3 duplicates). Yes
  // wins ties as the more recent intent is harder to derive without
  // iterating timestamps; not worth the cycles.
  const cumulativeTally = useMemo(() => {
    let yes = 0, pass = 0, hearted = 0;
    if (!currentUserId) return { yes, pass, hearted };
    for (const item of items) {
      const rs = reactionsByItem.get(item.rowId) || [];
      const hasYes = rs.some(r => r.user_id === currentUserId && r.emoji === "👍");
      const hasPass = rs.some(r => r.user_id === currentUserId && r.emoji === "❌");
      if (hasYes) yes++;
      else if (hasPass) pass++;
      if (watchlist && watchlist[item.id]) hearted++;
    }
    return { yes, pass, hearted };
  }, [items, reactionsByItem, currentUserId, watchlist]);

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

  const recordReaction = async (emoji) => {
    if (!current) return;
    // Short tap haptic on every reaction. Android only — iOS no-ops.
    haptic(15);
    // Screening enforces a single primary reaction per item (Yes XOR
    // Pass — Heart is a separate signal). The underlying
    // toggleReaction RPC only acts on the SPECIFIC emoji passed, so
    // switching from Yes to Pass without explicitly clearing Yes
    // leaves both rows in the DB. Fix: enumerate the user's existing
    // Yes/Pass on this item and clear them all before inserting the
    // new one. Same pattern in handleClearCurrent / handleUndo below.
    const mineYesPass = (reactionsByItem.get(current.rowId) || [])
      .filter(r => r.user_id === currentUserId && (r.emoji === "👍" || r.emoji === "❌"));
    for (const r of mineYesPass) {
      try { await onToggleReaction(current.rowId, r.emoji); }
      catch (e) { /* swallow */ }
    }
    const tappingSameAsOnly = mineYesPass.length === 1
      && mineYesPass[0].emoji === emoji;
    if (!tappingSameAsOnly) {
      try { await onToggleReaction(current.rowId, emoji); }
      catch (e) { /* swallow */ }
    }
    advance();
  };

  const handleYes = () => recordReaction("👍");
  const handlePass = () => recordReaction("❌");
  const handleSkip = () => advance();

  // Undo — step back one AND clear ALL the user's Yes/Pass on the
  // previous card (defensive against pre-fix stale duplicates).
  const handleUndo = async () => {
    if (idx === 0) return;
    const prevItem = initialQueue[idx - 1];
    const myPrev = (reactionsByItem.get(prevItem.rowId) || [])
      .filter(r => r.user_id === currentUserId && (r.emoji === "👍" || r.emoji === "❌"));
    for (const r of myPrev) {
      try { await onToggleReaction(prevItem.rowId, r.emoji); }
      catch (e) { /* swallow */ }
    }
    goBack();
  };

  const handleClearCurrent = async () => {
    if (!current) return;
    const mine = (reactionsByItem.get(current.rowId) || [])
      .filter(r => r.user_id === currentUserId && (r.emoji === "👍" || r.emoji === "❌"));
    for (const r of mine) {
      try { await onToggleReaction(current.rowId, r.emoji); }
      catch (e) { /* swallow */ }
    }
  };

  const isHearted = !!(watchlist && current && watchlist[current.id]);
  const handleHeart = () => {
    if (!current || !handleWish) return;
    handleWish(current);
  };

  // ⋯ menu state.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef(null);

  // Onboarding card — once per browser before the first card.
  const [showIntro, setShowIntro] = useState(() => !readIntroSeen() && total > 0);
  const dismissIntro = () => {
    markIntroSeen();
    setShowIntro(false);
  };

  // Reset action retired from the in-screening UI 2026-05-14 (Mark
  // spec: "take the reset off desktop as well"). Reset still
  // reachable via the list-level ⋯ overflow menu ("Reset my
  // reactions (N)"). The onReset prop is currently unused — leaving
  // wired in case a future surface (e.g., post-recap CTA) wants it.

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
      setTimeout(() => recordReaction("👍"), 220);
    } else if (dx < -SWIPE_THRESHOLD_X) {
      setFlyOut("left");
      setDrag({ x: -window.innerWidth - 200, y: dy * 0.4 });
      setTimeout(() => recordReaction("❌"), 220);
    } else {
      setDrag({ x: 0, y: 0 });
    }
  };

  // Open the listing's source URL in a new tab. Used by the
  // clickable side detail block and the ⋯ menu's "View original
  // listing" item.
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

  const outerStyle = isWide ? {
    // v1.3: chrome around the drill-in (title row + recipient banner)
    // is hidden when screening is active, so the wordmark + nav +
    // filter row are the only chrome above us. Tighter constant
    // keeps the action bar in the visible viewport without scroll.
    display: "flex", flexDirection: "column",
    width: "100%",
    height: "calc(100vh - 150px)",
    minHeight: 520,
    background: "var(--bg)",
    border: "0.5px solid var(--border)",
    borderRadius: 14,
    overflow: "hidden",
    fontFamily: SANS_STACK,
    position: "relative",
  } : {
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
          fontFamily: SANS_STACK,
          fontSize: 13, color: "var(--text2)",
          letterSpacing: "0.18em", textTransform: "uppercase",
          fontWeight: 400, textAlign: "center",
          minWidth: 0, flex: 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {listName}
        </div>
        <div style={{
          fontFamily: SANS_STACK,
          fontSize: 13, color: "var(--text2)", flexShrink: 0,
          minWidth: 56, textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.04em",
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
            <EdgeWash side="left" color="rgba(30,30,30,1)" label="Pass" opacity={washOpacity(-1)} />
            <EdgeWash side="right" color="var(--brand)" label="Yes" opacity={washOpacity(1)} />
          </>
        )}

        {done ? (
          <RecapView tally={cumulativeTally} total={total} ownerName={ownerName} onClose={onClose} />
        ) : current ? (
          <>
            {/* Image stack with peek behind. Desktop card sized so
                the image + side details + bottom action bar all fit
                in a typical desktop viewport without scroll (Mark
                feedback 2026-05-13). Was 520 → 420. */}
            <div style={{
              position: "relative",
              width: "100%",
              maxWidth: isWide ? 420 : 380,
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
                  borderRadius: 14,
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

                {/* Heart — top-right. Standard red bg when active
                    (matches Card.js convention). */}
                {handleWish && (
                  <button data-no-drag
                    onClick={(e) => { e.stopPropagation(); handleHeart(); }}
                    aria-label={isHearted ? "Remove from watchlist" : "Add to watchlist"}
                    style={overlayIconBtn("right", 10, "heart", isHearted)}>
                    <svg width="15" height="15" viewBox="0 0 24 24"
                      fill={isHearted ? "#fff" : "none"}
                      stroke="#fff"
                      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </button>
                )}

                {/* ⋯ menu — top-right under heart. */}
                {(openCollectionPicker || onShare || onOpenDetail) && (
                  <button data-no-drag ref={menuTriggerRef}
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
                    aria-label="More actions"
                    style={overlayIconBtn("right", 52, "menu", menuOpen)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="5" cy="12" r="1.5"/>
                      <circle cx="12" cy="12" r="1.5"/>
                      <circle cx="19" cy="12" r="1.5"/>
                    </svg>
                  </button>
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
                maxWidth: isWide ? 380 : 480,
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
                  fontSize: isWide ? 36 : 26,
                  fontWeight: 500, color: "var(--text1)",
                  lineHeight: 1.1, marginBottom: 6,
                  letterSpacing: "-0.005em",
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
                  padding: "4px 9px",
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
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 18px",
                    border: "1px solid var(--brand)",
                    borderRadius: 6,
                    color: "var(--brand)",
                    fontFamily: SANS_STACK,
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                  }}>
                    View listing
                    <span style={{ fontSize: 14, fontWeight: 400, letterSpacing: 0 }}>→</span>
                  </span>
                </div>
              )}
            </a>
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
            gap: 10, alignItems: "center",
            maxWidth: 720, margin: "0 auto",
          }}>
            {/* Action bar (Mark feedback 2026-05-14): arrows
                migrate from the secondary buttons (Undo / Skip) onto
                the primary reactions so the direction reads "Pass =
                swipe left" / "Yes = swipe right". Undo + Skip drop
                arrows entirely and shrink so they don't compete with
                the rating decision. */}
            <button onClick={handleUndo} disabled={idx === 0} style={edgeNavStyle(idx === 0, { small: true })}>
              Undo
            </button>
            <button onClick={handlePass} style={reactionBtnStyle("pass", myReactionOnCurrent === "❌")}>
              <span style={{ fontSize: 18, fontWeight: 300, letterSpacing: 0, marginRight: -2 }}>←</span>
              <span>Pass</span>
            </button>
            <button onClick={handleYes} style={reactionBtnStyle("yes", myReactionOnCurrent === "👍")}>
              <span>Yes</span>
              <span style={{ fontSize: 18, fontWeight: 300, letterSpacing: 0, marginLeft: -2 }}>→</span>
            </button>
            <button onClick={handleSkip} style={edgeNavStyle(false, { small: true })}>
              Skip
            </button>
          </div>
          {myReactionOnCurrent && (
            <div style={{
              textAlign: "right",
              marginTop: 6, maxWidth: 720,
              marginLeft: "auto", marginRight: "auto",
            }}>
              <button onClick={handleClearCurrent} style={subtleLinkStyle}>
                Remove my reaction
              </button>
            </div>
          )}
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
          openSourceListing={openSourceListing}
        />
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
  if (isWide) return overlay;                            // inline content surface
  return createPortal(overlay, document.body);           // fullscreen portal
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
        fontSize: 15, fontWeight: 600,
        letterSpacing: "0.24em", textTransform: "uppercase",
        textShadow: "0 1px 3px rgba(0,0,0,0.35)",
        opacity: Math.min(1, opacity * 3),
      }}>
        {label}
      </span>
    </div>
  );
}

function OverflowMenu({ triggerRef, onClose, item, openCollectionPicker, onShare, openSourceListing }) {
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
      fontFamily: SANS_STACK,
    }}>
      {openSourceListing && item.url && (
        <MenuItem label="View listing →" onClick={() => { onClose(); openSourceListing(); }} />
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
      color: "var(--text1)",
      fontFamily: SANS_STACK,
      fontSize: 13, fontWeight: 400,
      letterSpacing: "0.01em",
      textAlign: "left", cursor: "pointer",
    }}>
      {label}
    </button>
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
          fontSize: 24, fontWeight: 600, color: "var(--text1)",
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
          Screen watches one by one to get through a list or auction
          catalog and quickly shortlist what's worth coming back to.
          Results group at the bottom of this list when you're done.
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
          <IntroRow color="var(--accent-positive)" glyph="→">
            <strong>Yes</strong> — swipe right or tap Yes. Watches you want to consider.
          </IntroRow>
          <IntroRow color="var(--danger)" glyph="←">
            <strong>Pass</strong> — swipe left or tap Pass. Not for you.
          </IntroRow>
          <IntroRow color="#d92626" glyph="♥">
            <strong>Heart</strong> — tap to save to your watchlist. Independent from this list.
          </IntroRow>
          <IntroRow color="var(--text2)" glyph="↗">
            <strong>Details</strong> — tap the card to read the full listing.
          </IntroRow>
        </ul>
        <button onClick={onDismiss} style={primaryBtnStyle()}>
          Start review
        </button>
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

function ResetConfirm({ onCancel, onConfirm }) {
  return (
    <div style={modalScrim(2130)}>
      <div style={editorialPanel(360)}>
        <div style={{
          fontFamily: SANS_STACK,
          fontSize: 11, color: "var(--text3)",
          letterSpacing: "0.20em", textTransform: "uppercase",
          fontWeight: 500, marginBottom: 14,
        }}>
          Reset
        </div>
        <div style={{
          fontFamily: SANS_STACK,
          fontSize: 20, fontWeight: 600, color: "var(--text1)",
          lineHeight: 1.25, marginBottom: 10,
          letterSpacing: "-0.005em",
        }}>
          Clear all your reactions?
        </div>
        <div style={{
          fontFamily: SANS_STACK,
          fontSize: 13, color: "var(--text2)",
          lineHeight: 1.5, marginBottom: 22,
        }}>
          Removes every Yes / Pass you've placed on this list and starts you over at the first card. Hearted items stay in your watchlist.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={ghostBtnStyle()}>
            Keep my reactions
          </button>
          <button onClick={onConfirm} style={dangerBtnStyle()}>
            Clear &amp; restart
          </button>
        </div>
      </div>
    </div>
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
          {idx} of {total} reviewed. Come back anytime — your place is saved.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onPause} style={ghostBtnStyle()}>
            Pause &amp; bookmark
          </button>
          <button onClick={onContinue} style={primaryBtnStyle()}>
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
        fontSize: 24, fontWeight: 600, color: "var(--text1)",
        lineHeight: 1.2, marginBottom: 26,
        letterSpacing: "-0.005em",
      }}>
        Your take on this list.
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: 10, margin: "0 auto 26px", maxWidth: 340,
      }}>
        <TallyCard label="Yes" value={tally.yes} color="var(--brand)" />
        <TallyCard label="Hearted" value={tally.hearted} color="#d92626" />
        <TallyCard label="Pass" value={tally.pass} color="var(--text2)" />
      </div>
      <div style={{
        fontSize: 13, color: "var(--text2)",
        marginBottom: 26, lineHeight: 1.5,
        fontStyle: "italic",
      }}>
        {ownerName ? `${ownerName} will see your reactions next time they open the list.` : "Your reactions are saved."}
      </div>
      <button onClick={onClose} style={primaryBtnStyle()}>
        Back to list
      </button>
    </div>
  );
}

function TallyCard({ label, value, color }) {
  return (
    <div style={{
      padding: "16px 8px",
      border: "0.5px solid var(--border)",
      borderRadius: 10,
      background: "var(--surface)",
    }}>
      <div style={{
        fontFamily: SANS_STACK,
        fontSize: 26, fontWeight: 600,
        color: value > 0 ? color : "var(--text3)",
        fontVariantNumeric: "tabular-nums lining-nums",
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: SANS_STACK,
        fontSize: 10, color: "var(--text3)",
        letterSpacing: "0.18em", textTransform: "uppercase",
        marginTop: 8, fontWeight: 500,
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Shared styles ───────────────────────────────────────────────

const topLinkStyle = {
  border: "none", background: "transparent", cursor: "pointer",
  color: "var(--brand)",
  fontFamily: SANS_STACK,
  fontSize: 14, padding: 0,
  display: "flex", alignItems: "center", gap: 4,
  fontWeight: 500,
  letterSpacing: "0.02em",
};

const subtleLinkStyle = {
  border: "none", background: "transparent",
  color: "var(--text3)",
  fontFamily: SANS_STACK,
  fontSize: 12, padding: "4px 10px",
  cursor: "pointer", textDecoration: "underline",
  textUnderlineOffset: 2,
  letterSpacing: "0.04em",
};

function reactionBtnStyle(kind, active) {
  // Mark feedback 2026-05-14: action buttons "look a bit basic text"
  // — needed stronger presence to read as designed primary/secondary
  // CTAs rather than text-on-rectangles. Yes is now a solid brand-blue
  // primary fill (high contrast, weight 600); Pass is a substantial
  // ghost with a heavier 1px border + var(--text1) label. Active
  // states stay subtle so the rated card doesn't shout.
  if (kind === "yes") {
    return {
      padding: "14px 22px",
      border: "1px solid var(--brand)",
      background: "var(--brand)",
      color: "#fff",
      fontFamily: SANS_STACK,
      fontSize: 14, fontWeight: 600,
      letterSpacing: "0.18em", textTransform: "uppercase",
      borderRadius: 8, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      minHeight: 52,
      // Subtle press-state shadow so it feels like a CTA, not flat.
      boxShadow: active
        ? "inset 0 0 0 2px var(--brand), 0 0 0 1px var(--brand)"
        : "0 1px 2px rgba(0,0,0,0.08)",
    };
  }
  // Pass — substantial outlined ghost.
  return {
    padding: "14px 22px",
    border: active ? "1px solid var(--text1)" : "1px solid var(--border)",
    background: active ? "var(--text1)" : "var(--surface)",
    color: active ? "var(--bg)" : "var(--text1)",
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

function overlayIconBtn(side, top, kind, active = false) {
  let bg = "rgba(0,0,0,0.50)";
  if (kind === "heart" && active) bg = "rgba(217,38,38,0.92)";
  else if (kind === "menu" && active) bg = "rgba(0,0,0,0.72)";
  return {
    position: "absolute",
    top,
    [side]: 10,
    zIndex: 5,
    width: 34, height: 34,
    borderRadius: "50%",
    border: "none",
    background: bg,
    color: "#fff",
    cursor: "pointer",
    fontFamily: SANS_STACK,
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0,
    backdropFilter: "blur(6px)",
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
    borderRadius: 14,
    padding: "32px 28px",
    maxWidth, width: "100%",
    fontFamily: SANS_STACK,
    boxShadow: "0 24px 60px rgba(0,0,0,0.20)",
  };
}

function ghostBtnStyle() {
  return {
    flex: 1, padding: "12px 14px",
    border: "0.5px solid var(--border)",
    background: "transparent", color: "var(--text2)",
    borderRadius: 8,
    fontFamily: SANS_STACK,
    fontSize: 13, fontWeight: 500,
    letterSpacing: "0.06em",
    cursor: "pointer",
  };
}

function primaryBtnStyle() {
  return {
    width: "100%",
    padding: "13px 18px",
    border: "none",
    background: "var(--brand)", color: "#fff",
    borderRadius: 8,
    fontFamily: SANS_STACK,
    fontSize: 13, fontWeight: 500,
    letterSpacing: "0.14em", textTransform: "uppercase",
    cursor: "pointer",
  };
}

function dangerBtnStyle() {
  return {
    flex: 1, padding: "12px 14px",
    border: "none",
    background: "var(--danger)", color: "#fff",
    borderRadius: 8,
    fontFamily: SANS_STACK,
    fontSize: 13, fontWeight: 500,
    letterSpacing: "0.06em",
    cursor: "pointer",
  };
}
