// CardShell — the shared presentational frame for every card in the app.
//
// Part of the unified card design system (see memory project-card-design-system
// / DESIGN_SYSTEM.md). CardShell owns the LAYOUT and CHROME that every card
// shares — square/editorial image area + placeholder, the L1/L2/L3 text slots,
// the action stack (quick-action ↑ / heart / ⋯ menu), and the single portal
// menu — so listings, auctions, sold, and articles all line up by construction
// and future surfaces (reference pages, wishlists) inherit correct cards.
//
// It is purely presentational + slot-driven: callers (Card.js for priced items,
// the article card for editorial) compute their own content and hand it in as
// nodes. NONE of Card.js's price/FX/auction logic lives here — that stays in
// Card.js, which simply renders INTO these slots.
//
// Stage 0 of the migration: extracted verbatim from Card.js so the priced card
// is pixel-identical. Other renderers fold in over later stages.
//
// The heart, ⋯ and quick-action buttons and the portal menu are the shared
// OverlayButton / OverlayHeart / OverlayMenu / MenuItem in src/ui (the portal font pin, the
// viewport anchoring and the click-outside close live there). `size="compact"` picks the small
// 26px button; the full card uses the 34px one.

import React, { useState } from "react";
import { OverlayButton, OverlayHeart, OverlayMenu, MenuItem } from "../ui";

// Image sub-component: owns the onError→placeholder fallback (dealer image
// URLs 404 over time — Card.js relied on this). Falls back to the same
// favicon placeholder when there's no src OR the load fails.
function CardImage({ image, priority, aspect }) {
  const [failed, setFailed] = useState(false);
  const showImg = image && image.src && !failed;
  return (
    <>
      {showImg ? (
        <img src={image.src} alt={image.alt || ""}
          width={720} height={aspect === "editorial" ? 450 : 720}
          onError={() => setFailed(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          loading={priority ? "eager" : "lazy"} decoding="async" fetchpriority={priority ? "high" : "auto"} />
      ) : (
        <div style={{
          position: "absolute", inset: 0, background: "var(--surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 6,
        }}>
          <img src="/favicon-192.png" alt="" aria-hidden="true"
            style={{ width: "44%", maxWidth: 88, opacity: 0.55 }} />
          <span style={{ fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text3)" }}>
            Image not available
          </span>
        </div>
      )}
    </>
  );
}

const ASPECT = { square: "100%", editorial: "62.5%" /* 16:10 */ };

export default function CardShell({
  // Image
  image,                 // { src, alt } | null  (src already run through imgSrc by caller)
  priority,              // high fetchpriority for above-the-fold cards
  aspect = "square",     // "square" | "editorial"
  imageOverlay,          // node — top-left state chips (SOLD / countdown / AUCTION)
  // Text levels
  level1,                // node — title (brand+model prefix for priced; article title)
  level2,                // node — source / house / publication kicker (rendered above L1)
  level3,                // node — price block / sold-date / days-left / byline
  // Link
  href,
  onClickLink,           // fired on link follow (telemetry: onClickListing)
  onOpen,                // no href: the card opens in-app (a watch's detail sheet) instead of a link
  // Sizing
  size = "full",         // "compact" | "full" — chrome + action-button scale
  // Body padding (caller can match its old value during migration)
  bodyPadding,
  // Actions
  quickAction,           // { label, icon, active, onClick } | null
  heart,                 // { wished, onToggle } | null
  menu,                  // { onShare, onAddToCollection, onHide, hideLabel, isHidden, extraMenuItems: [{ label, onClick, danger? }], shareFeedbackText } | null
  // Telemetry / layout
  innerRef,              // ref forwarded to the root (IntersectionObserver in Card)
  children,              // optional extra body content below L3
}) {
  const compact = size === "compact";
  const [shareFeedback, setShareFeedback] = useState("");
  const hasMenu = !!menu && (menu.onShare || menu.onAddToCollection || menu.onHide
    || (menu.extraMenuItems && menu.extraMenuItems.length > 0));

  const body = (
    <>
      <div style={{ position: "relative", paddingTop: ASPECT[aspect] || ASPECT.square, overflow: "hidden" }}>
        <CardImage image={image} priority={priority} aspect={aspect} />
        {imageOverlay}
      </div>
      <div style={{ padding: bodyPadding || (compact ? "8px 10px 10px" : "10px 12px 12px"), minWidth: 0 }}>
        {level2}
        {level1}
        {level3}
        {children}
      </div>
    </>
  );

  return (
    <div ref={innerRef} style={{ background: "var(--card-bg)", display: "flex", flexDirection: "column", position: "relative", minWidth: 0, overflow: "hidden" }}>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer"
          onClick={() => { if (onClickLink) onClickLink(); }}
          style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column" }}>
        {body}
        </a>
      ) : (
        <div role={onOpen ? "button" : undefined} tabIndex={onOpen ? 0 : undefined}
          onClick={onOpen || undefined}
          onKeyDown={onOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } } : undefined}
          style={{ color: "inherit", display: "flex", flexDirection: "column", cursor: onOpen ? "pointer" : "default" }}>
        {body}
        </div>
      )}
      {quickAction && (
        <div style={{ position: "absolute", top: 6, left: 6 }}>
          <OverlayButton small={compact} on={!!quickAction.active}
            onClick={e => { e.preventDefault(); e.stopPropagation(); quickAction.onClick(); }}
            aria-label={quickAction.label} title={quickAction.label}>{quickAction.icon || "↑"}</OverlayButton>
        </div>
      )}
      {(heart || hasMenu) && (
        <div style={{ position: "absolute", top: 6, right: 6, display: "flex", flexDirection: "column", gap: 6 }}>
          {heart && (
            <OverlayHeart small={compact} on={heart.wished} aria-label="Save"
              onClick={e => { e.preventDefault(); e.stopPropagation(); heart.onToggle(); }} />
          )}
          {hasMenu && (
            <OverlayMenu small={compact}>
              {({ close }) => (
                <>
                  {menu.onShare && (
                    <MenuItem onClick={async () => {
                      let result;
                      try { result = await menu.onShare(); }
                      catch (err) { console.warn("share failed", err); result = null; }
                      if (result?.copied) { setShareFeedback("Copied!"); setTimeout(() => { setShareFeedback(""); close(); }, 1200); }
                      else { close(); }
                    }}>{shareFeedback || "Share"}</MenuItem>
                  )}
                  {menu.onAddToCollection && (
                    <MenuItem onClick={() => { close(); menu.onAddToCollection(); }}>Add to…</MenuItem>
                  )}
                  {menu.onHide && (
                    <MenuItem onClick={() => { close(); menu.onHide(); }}>
                      {menu.hideLabel === "Remove from list" ? "Remove" : (menu.hideLabel || (menu.isHidden ? "Unhide" : "Hide"))}
                    </MenuItem>
                  )}
                  {(menu.extraMenuItems || []).map((entry, i) => (
                    <MenuItem key={i} danger={!!entry.danger} onClick={() => { close(); entry.onClick(); }}>{entry.label}</MenuItem>
                  ))}
                </>
              )}
            </OverlayMenu>
          )}
        </div>
      )}
    </div>
  );
}
