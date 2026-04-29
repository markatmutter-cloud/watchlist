import React, { useState, memo } from "react";
import { fmt, fmtUSD, daysAgo, freshDate, imgSrc } from "../utils";
import { HeartIcon } from "./icons";

// Wrapped in React.memo so an unrelated state change in App (heart toggle
// on a different card, scroll-triggered page bump, filter tweak) doesn't
// re-render every card in the grid. Default shallow-compare works because
// onWish/onHide are useCallback-stable and item identity is preserved
// across renders for the listings feed. Watchlist tab spreads item to
// override snapshot fields, so its cards still re-render — that's fine,
// re-render ≠ image remount.
export const Card = memo(function Card({ item, wished, onWish, compact, onHide, isHidden }) {
  // When the dealer's image URL goes 404 (e.g. they cleaned up their CDN
  // for a sold listing), the browser shows an ugly broken-image icon.
  // Track the failure and render a clean placeholder instead.
  const [imgFailed, setImgFailed] = useState(false);
  // `backfilled` is set by merge.py when a single source contributes 10+
  // listings whose firstSeen == today — that pattern is almost always a
  // scraper change retroactively picking up listings that were already on
  // the dealer's site, not real new inventory. Suppress the NEW badge for
  // those so the signal stays useful.
  const isNew = daysAgo(freshDate(item)) <= 1 && !item.sold && !item.backfilled;
  // priceOnRequest items have price=0 — show "Price on request" instead
  // of "$0". Set by the WV scraper for INQUIRE / ON HOLD-no-price pages.
  const displayPrice = item.priceOnRequest ? "Price on request" : fmt(item.price, item.currency || "USD");
  const showUSD = item.currency && item.currency !== "USD" && item.priceUSD && !item.priceOnRequest;
  // Show CUMULATIVE drop from peak (priceDropTotal) — so two
  // consecutive $400 cuts read as "↓ $800" rather than just the
  // latest step. Falls back to the last-step `priceChange` for items
  // scraped before priceDropTotal was introduced.
  const cumulativeDrop = (item.priceDropTotal && item.priceDropTotal > 0)
    ? item.priceDropTotal
    : ((item.priceChange || 0) < 0 ? -item.priceChange : 0);
  const priceDropped = !item.priceOnRequest && cumulativeDrop > 0;
  const peakPrice = item.pricePeak || (item.price + cumulativeDrop);
  return (
    <div style={{ background: "var(--card-bg)", display: "flex", flexDirection: "column", position: "relative", minWidth: 0, overflow: "hidden" }}>
      <a href={item.url} target="_blank" rel="noopener noreferrer"
        style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column" }}>
        <div style={{ position: "relative", paddingTop: "100%", overflow: "hidden" }}>
          {item.img && !imgFailed ? (
            <img src={imgSrc(item.img)} alt={item.ref}
              onError={() => setImgFailed(true)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              loading="lazy" />
          ) : (
            // On-brand placeholder when the image is missing or the dealer's
            // URL has gone 404. Uses the same hourglass mark as the favicon
            // / app icon. Tinted against the existing site palette.
            <div style={{
              position: "absolute", inset: 0,
              background: "var(--surface)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 6,
            }}>
              <img src="/favicon-192.png" alt="" aria-hidden="true"
                style={{ width: "44%", maxWidth: 88, opacity: 0.55 }} />
              <span style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text3)" }}>
                Image not available
              </span>
            </div>
          )}
          {item.sold && <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.06em" }}>SOLD</div>}
          {!item.sold && isHidden && <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(120,120,120,0.85)", color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.06em" }}>HIDDEN</div>}
          {isNew && !isHidden && <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(24,95,165,0.92)", color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.06em", fontWeight: 600 }}>NEW</div>}
        </div>
        <div style={{ padding: compact ? "5px 7px 8px" : "7px 9px 10px" }}>
          <div style={{ fontSize: compact ? 8 : 9, color: "var(--text3)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.source}</div>
          {/* Always reserve 2 lines' worth of height so cards in a grid row
              line up regardless of whether the title wraps. Empty title gets
              a space so the line-height still renders. */}
          <div style={{ fontSize: compact ? 10 : 12, fontWeight: 500, lineHeight: 1.3, marginBottom: 4, color: "var(--text1)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: compact ? 26 : 32 }}>{item.ref || " "}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <div style={{ fontSize: compact ? 11 : 13, fontWeight: 500, color: item.sold ? "var(--text2)" : "var(--text1)" }}>{displayPrice}</div>
            {priceDropped && (
              <span title={`Peak ${fmt(peakPrice, item.currency || "USD")} → ${fmt(item.price, item.currency || "USD")}`}
                style={{ fontSize: 9, color: "#1b8f3a", fontWeight: 600 }}>
                ↓ {fmt(cumulativeDrop, item.currency || "USD")}
              </span>
            )}
          </div>
          {/* Always render this line (even invisibly) so GBP cards stay the same height as USD cards — avoids the mixed-size grid on mobile. */}
          <div style={{ fontSize: 9, color: "var(--text3)", minHeight: 12 }}>{showUSD ? `~${fmtUSD(item.priceUSD)}` : " "}</div>
        </div>
      </a>
      <div style={{ position: "absolute", top: 6, right: 6, display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); onWish(item); }}
          aria-label="Save"
          style={{ width: 26, height: 26, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: wished ? "rgba(220,38,38,0.88)" : "rgba(0,0,0,0.28)",
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <HeartIcon filled={wished} size={12} />
        </button>
        {onHide && (
          <button onClick={e => { e.preventDefault(); e.stopPropagation(); onHide(item); }}
            aria-label={isHidden ? "Unhide" : "Hide"}
            title={isHidden ? "Unhide" : "Hide from feed"}
            style={{ width: 26, height: 26, borderRadius: "50%", border: "none", cursor: "pointer",
                    background: isHidden ? "rgba(24,95,165,0.88)" : "rgba(0,0,0,0.28)",
                    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: "inherit" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              {isHidden
                ? <><path d="M4 12h16"/><path d="M12 4v16"/></> /* + sign = restore */
                : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> /* X = hide */
              }
            </svg>
          </button>
        )}
      </div>
    </div>
  );
});
