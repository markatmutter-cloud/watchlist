import React, { useState, memo } from "react";
import { fmt, fmtUSD, imgSrc, fmtCountdown, fmtLotPrice, fmtSoldDate } from "../utils";
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
  // (Previously had a NEW chip on cards <= 1 day old. Removed
  // 2026-04-30 — was firing inconsistently due to the backfill rule
  // and the date-order sort already conveys recency. Less chrome on
  // the image surface lets the image itself read.)
  // priceOnRequest items have price=0 — show "Price on request" instead
  // of "$0". Set by the WV scraper for INQUIRE / ON HOLD-no-price pages.
  // Currency display rule (2026-04-30): USD-priced listings show their
  // native price as primary; non-USD listings show USD-converted as
  // primary ("~$11,300") with the native price on the secondary line
  // ("£8,900"). Mark prefers USD as the consistent comparison anchor.
  // Sold-without-price-history fallback: a listing that disappears
  // from the dealer's site as priceOnRequest reads "Price on request"
  // even when sold — misleading because the dealer never showed a
  // price OR sold the item silently. If sold AND price is missing
  // AND there's no historic price record, show "—" instead.
  const hasHistoricPrice = (item.priceHistory || []).some(h => (h?.price ?? 0) > 0)
    || (item.price && item.price > 0);
  const isUSD = !item.currency || item.currency.toUpperCase() === "USD";
  const displayPrice = (item.sold && item.priceOnRequest && !hasHistoricPrice)
    ? "—"
    : item.priceOnRequest
      ? "Price on request"
      : isUSD
        ? fmt(item.price, "USD")
        : `~${fmtUSD(item.priceUSD || item.price)}`;
  const showNative = !isUSD && !item.priceOnRequest && item.price;
  // Show CUMULATIVE drop from peak (priceDropTotal) — so two
  // consecutive $400 cuts read as "↓ $800" rather than just the
  // latest step. Falls back to the last-step `priceChange` for items
  // scraped before priceDropTotal was introduced.
  const cumulativeDrop = (item.priceDropTotal && item.priceDropTotal > 0)
    ? item.priceDropTotal
    : ((item.priceChange || 0) < 0 ? -item.priceChange : 0);
  const priceDropped = !item.priceOnRequest && cumulativeDrop > 0;
  const peakPrice = item.pricePeak || (item.price + cumulativeDrop);

  // Tracked-lot render switch. When the item is projected from
  // `tracked_lots` (auction-house lot, eBay item, future marketplace
  // URL), the Card surfaces auction-specific data: bid label, current
  // bid OR hammer, estimate range, and a countdown chip on the image.
  // Dealer items take the existing render path.
  const isLot = !!item._isTrackedLot;
  const isAuctionLot = isLot && item._isAuctionFormat;
  const isBinLot = isLot && !item._isAuctionFormat;
  const lotLabel = !isLot ? null
    : isBinLot ? (item.sold ? "SOLD" : "BUY NOW")
    : (item.sold ? "HAMMER" : "CURRENT");
  const lotNativeValue = !isLot ? null
    : item.sold
        ? (item.sold_price ?? item.price)
        : (item.current_bid ?? item.starting_price ?? item.price);
  const lotUsdValue = !isLot ? null
    : item.sold ? (item.sold_price_usd ?? lotNativeValue)
    : (item.current_bid_usd ?? lotNativeValue);
  // Same currency rule as dealer cards: USD-native lots show native
  // primary; non-USD lots show "~$X,XXX" primary + native secondary.
  const lotIsUSD = !item.currency || item.currency.toUpperCase() === "USD";
  const lotPrimaryDisplay = !isLot ? null
    : lotIsUSD
      ? fmtLotPrice(lotNativeValue, "USD") || "—"
      : (lotUsdValue
          ? `~$${Math.round(lotUsdValue).toLocaleString()}`
          : fmtLotPrice(lotNativeValue, item.currency) || "—");
  const lotShowNative = isLot && !lotIsUSD && lotNativeValue;
  // Estimate line — only shows on active auction-format lots when
  // both bounds are known. Drops once hammered (the HAMMER price
  // tells the story by then).
  const estimateLine = (isAuctionLot && !item.sold
    && item.estimate_low && item.estimate_high)
    ? `Est. ${fmtLotPrice(item.estimate_low, item.currency)}–${
        fmtLotPrice(item.estimate_high, "")?.trim() || ""
      }`
    : null;
  const countdownLabel = (isAuctionLot && !item.sold && item.auction_end)
    ? fmtCountdown(item.auction_end)
    : null;
  const countdownIsPast = countdownLabel && countdownLabel.startsWith("ended");
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
          {/* Top-left chip stack — only one of these renders at a
              time. SOLD wins (terminal state), then HIDDEN, then the
              auction countdown / fallback AUCTION pill. Mark moved
              the countdown from the right corner to the left
              2026-04-30 so it sits with the other state badges
              instead of crowding the heart/hide buttons on the right. */}
          {item.sold ? (
            <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.06em" }}>SOLD</div>
          ) : isHidden ? (
            <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(120,120,120,0.85)", color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.06em" }}>HIDDEN</div>
          ) : countdownLabel ? (
            <div style={{
              position: "absolute", top: 6, left: 6,
              background: countdownIsPast ? "rgba(0,0,0,0.55)" : "rgba(24,95,165,0.92)",
              color: "#fff", fontSize: 8,
              padding: "2px 6px", borderRadius: 8,
              letterSpacing: "0.04em", fontWeight: 600,
              textTransform: "uppercase",
            }}>{countdownLabel}</div>
          ) : isAuctionLot ? (
            // Auction-format lot without a known auction_end (e.g. a
            // Phillips lot before the calendar lookup populated it):
            // still mark it as an auction so users can tell at a glance.
            <div style={{
              position: "absolute", top: 6, left: 6,
              background: "rgba(24,95,165,0.92)", color: "#fff",
              fontSize: 8, padding: "2px 6px", borderRadius: 8,
              letterSpacing: "0.06em", fontWeight: 600,
            }}>AUCTION</div>
          ) : null}
        </div>
        <div style={{ padding: compact ? "5px 7px 8px" : "7px 9px 10px" }}>
          <div style={{ fontSize: compact ? 8 : 9, color: "var(--text3)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.source}</div>
          {/* Always reserve 2 lines' worth of height so cards in a grid row
              line up regardless of whether the title wraps. Empty title gets
              a space so the line-height still renders. */}
          <div style={{ fontSize: compact ? 10 : 12, fontWeight: 500, lineHeight: 1.3, marginBottom: 4, color: "var(--text1)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: compact ? 26 : 32 }}>{item.ref || " "}</div>
          {isLot ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 8, color: "var(--text3)", letterSpacing: "0.05em", fontWeight: 600 }}>
                {lotLabel}
              </span>
              <span style={{ fontSize: compact ? 11 : 13, fontWeight: 500, color: item.sold ? "#1b8f3a" : "var(--text1)" }}>
                {lotPrimaryDisplay}
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <div style={{ fontSize: compact ? 11 : 13, fontWeight: 500, color: item.sold ? "var(--text2)" : "var(--text1)" }}>{displayPrice}</div>
              {priceDropped && (
                <span title={`Peak ${fmt(peakPrice, item.currency || "USD")} → ${fmt(item.price, item.currency || "USD")}`}
                  style={{ fontSize: 9, color: "#1b8f3a", fontWeight: 600 }}>
                  ↓ {fmt(cumulativeDrop, item.currency || "USD")}
                </span>
              )}
            </div>
          )}
          {/* Secondary line carries (in priority order):
                1. Sold date — when the item is sold, surface when the
                   price was recorded. Mark wanted this front-and-center
                   for archive browsing.
                2. Native price for non-USD items (since primary is now
                   the USD-converted figure).
                3. Auction estimate range (active auction-format lots).
                4. Invisible spacer to keep row heights uniform. */}
          <div style={{ fontSize: 9, color: "var(--text3)", minHeight: 12 }}>
            {(() => {
              if (item.sold) {
                const soldDateStr = item.soldAt || item.lastSeen
                  || (isLot ? item.auction_end : null);
                const label = fmtSoldDate(soldDateStr);
                if (label) return label;
              }
              if (isLot) {
                if (lotShowNative) return fmtLotPrice(lotNativeValue, item.currency);
                return estimateLine || " ";
              }
              return showNative ? fmt(item.price, item.currency) : " ";
            })()}
          </div>
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
