import React, { useState, useEffect, useRef, memo } from "react";
import { fmt, imgSrc, fmtCountdown, fmtLotPrice, fmtSoldDate, priceIn, daysOnSale, daysOnSaleLabel, CURRENCY_SYM, FX_RATES_USD_PER } from "../utils";
import { HeartIcon } from "./icons";
import { Popover, usePopoverState } from "./Popover";

// Shared style for action-menu rows. Module-scope so it's not
// re-created per Card render. Uses var(--text1) explicitly so the
// dropdown reads in both light and dark mode against var(--bg).
const menuItemStyle = {
  display: "block", width: "100%", textAlign: "left",
  padding: "8px 10px", border: "none", background: "transparent",
  color: "var(--text1)", cursor: "pointer",
  fontFamily: "inherit", fontSize: 13, borderRadius: 6,
  whiteSpace: "nowrap",
};

// Wrapped in React.memo so an unrelated state change in App (heart toggle
// on a different card, scroll-triggered page bump, filter tweak) doesn't
// re-render every card in the grid. Default shallow-compare works because
// onWish/onHide are useCallback-stable and item identity is preserved
// across renders for the listings feed. Watchlist tab spreads item to
// override snapshot fields, so its cards still re-render — that's fine,
// re-render ≠ image remount.
export const Card = memo(function Card({
  item, wished, onWish, compact, onHide, isHidden,
  // Optional: opens the collection picker for this item. When omitted
  // (e.g. signed-out browsing), the menu omits the "Add to collection"
  // entry and falls back to just Hide. When the menu has zero items,
  // the trigger button itself doesn't render.
  onAddToCollection,
  // Optional: override the default Hide menu label. The collection
  // drill-in view passes "Remove from collection" + an onHide that
  // actually calls removeItemFromCollection — single menu surface,
  // different action wiring per context.
  hideLabel,
  // User's primary display currency (USD/GBP/EUR). Falls back to
  // 'USD' for signed-out browsing or before useUserSettings has
  // loaded — matches the pre-2026-05-01 hardcoded behaviour.
  primaryCurrency = "USD",
  // Share — every Card surface in v1. Handler builds the share URL
  // and routes through Web Share API or clipboard fallback. Returns
  // { copied: bool } so we can show a brief "Copied!" hint after the
  // clipboard path. Optional — when omitted the menu omits the row.
  onShare,
  // Telemetry hooks (Epic 8 — Site analytics). When provided:
  //   onView      — registers this card with the App-level
  //                 IntersectionObserver via observeCard; fires once
  //                 per session when the card crosses 50% visibility.
  //   onClickListing — fires when the user follows the dealer link.
  // Both optional so signed-out browsing or non-Supabase environments
  // skip telemetry without per-Card guards.
  onView,
  onClickListing,
  // Optional: extra "..." menu actions injected by the surface.
  // Each entry is { label, onClick } — Card just renders them
  // as menu rows below the built-in Add/Hide/Share entries.
  // Used by Collections > Owned drill-in to add "Mark as sold"
  // (PR #88, 2026-05-06). Keeps Card unaware of collection
  // semantics — the surface owns the action wiring.
  extraMenuItems,
  // Optional: small overlay button at top-left for a one-tap
  // gesture (e.g. Plan > Keeping "↑ flag for sale"). Shape:
  // { icon, label, onClick, active }. Active flips the bg to red.
  // 2026-05-10 — Mark spec: replicate the pool's ↑ pattern on
  // owned cards so flagging for sale doesn't require the menu.
  quickAction,
  // Optional: arbitrary node rendered below the card body, typically
  // a <ReactionPill> / <ReactionSet> on shared-list surfaces. Slot
  // pattern keeps Card unaware of reaction state, pickers, and
  // realtime — the parent list view owns all of that and feeds a
  // pre-rendered node in. Lives outside the <a> wrapper so its
  // inner buttons don't nest inside the listing-link anchor.
  reactionSlot,
}) {
  // When the dealer's image URL goes 404 (e.g. they cleaned up their CDN
  // for a sold listing), the browser shows an ugly broken-image icon.
  // Track the failure and render a clean placeholder instead.
  const [imgFailed, setImgFailed] = useState(false);
  // Action menu open/close + portal mount. Promoted 2026-05-10 from
  // Card-local plumbing into a shared <Popover> primitive so the
  // drill-in overflow menu and the desktop reaction picker can reuse
  // the same click-outside / Escape / position-anchor logic.
  const menuPop = usePopoverState();
  // Brief "Copied!" feedback when Web Share API isn't available and
  // we fall back to the clipboard. 1.2s timeout, no toast component.
  const [shareFeedback, setShareFeedback] = useState("");
  // View-event observer registration. When onView is supplied, hand
  // the card's outer node to the App-level IntersectionObserver so it
  // can fire a `view` once the card crosses 50% visibility. Returns a
  // cleanup function from the effect for clean unobserve on unmount.
  const cardRef = useRef(null);
  useEffect(() => {
    if (!onView || !cardRef.current) return undefined;
    return onView(cardRef.current, item);
  }, [onView, item]);
  // (Previously had a NEW chip on cards <= 1 day old. Removed
  // 2026-04-30 — was firing inconsistently due to the backfill rule
  // and the date-order sort already conveys recency. Less chrome on
  // the image surface lets the image itself read.)
  // priceOnRequest items have price=0 — show "Price on request" instead
  // of "$0". Set by the WV scraper for INQUIRE / ON HOLD-no-price pages.
  // Currency display rule (2026-05-01): user's primary currency
  // (set in Settings; defaults to USD) is the primary line; if that
  // differs from the listing's native currency, the native price
  // shows on the secondary line. The conversion uses priceUSD as the
  // bridge via priceIn() in utils — exact native when match, ~approx
  // otherwise.
  // Sold-without-price-history fallback: a listing that disappears
  // from the dealer's site as priceOnRequest reads "Price on request"
  // even when sold — misleading because the dealer never showed a
  // price OR sold the item silently. If sold AND price is missing
  // AND there's no historic price record, show "—" instead.
  // Last non-zero ask, used as "last asking price" for sold items
  // whose current price has dropped to 0 (dealer hid it post-sale).
  // 40% of sold dealer items hit this — most dealers replace the
  // price label with "SOLD" so the next scrape captures price=0 +
  // priceOnRequest. Prefer the backend-emitted `lastMeaningfulPrice`
  // (added in merge.py 2026-05-05) and fall back to walking
  // priceHistory locally so older state.json snapshots — and any
  // surface that doesn't go through merge.py — keep working.
  const lastKnownPrice = (
    (typeof item.lastMeaningfulPrice === "number" && item.lastMeaningfulPrice > 0)
      ? item.lastMeaningfulPrice
      : (item.priceHistory || [])
          .map(h => h && h.price)
          .filter(p => typeof p === "number" && p > 0)
          .pop()
  );
  const hasHistoricPrice = !!lastKnownPrice || (item.price && item.price > 0);
  const itemCurrency = (item.currency || "USD").toUpperCase();
  const matchesPrimary = itemCurrency === primaryCurrency;
  // Compute the primary-currency display value. Exact when listing
  // is already in user's primary currency; ~approx otherwise.
  const primaryAmount = priceIn(item, primaryCurrency);
  const primarySym = CURRENCY_SYM[primaryCurrency] || "$";
  // Sold-with-historic-price: use the last non-zero asking price as the
  // display value (the "Sold" badge already conveys that this isn't a
  // current ask). Beats "Price on request" for items that DID have a
  // price visible while live but went dark after sale.
  const useHistoricForSold = !!(item.sold && item.priceOnRequest && lastKnownPrice);
  const displayPrice = (item.sold && item.priceOnRequest && !hasHistoricPrice)
    ? "—"
    : useHistoricForSold
      ? fmt(lastKnownPrice, itemCurrency)
      : item.priceOnRequest
        ? "Price on request"
        : matchesPrimary
          ? fmt(item.price, primaryCurrency)
          : (primaryAmount != null
              ? `~${primarySym}${primaryAmount.toLocaleString()}`
              // No conversion possible (no priceUSD bridge): fall back
              // to native so the user still sees a price rather than "—".
              : fmt(item.price, itemCurrency));
  // Show the native price on the secondary line whenever it's not
  // already the primary line and we have a real price.
  const showNative = !matchesPrimary && !item.priceOnRequest && item.price;
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
  // Fallback chain: pre-auction lots have null current_bid /
  // current_bid_usd; previously this fell straight through to
  // `lotNativeValue` (the native CHF/HKD/etc. amount), which then
  // got rendered with a `~$` prefix — Mark's "CHF doesn't actually
  // convert 1:1 to USD" report 2026-05-07. Walk every USD field
  // we have (sold/bid/starting/estimate-low USD), then `priceUSD`
  // (already FX-converted at projection time in App.js's
  // auctionLotItems memo), and only fall back to the native value
  // as a last resort.
  const lotUsdValue = !isLot ? null
    : item.sold ? (item.sold_price_usd ?? item.priceUSD ?? lotNativeValue)
    : (item.current_bid_usd ?? item.starting_price_usd ?? item.estimate_low_usd ?? item.priceUSD ?? lotNativeValue);
  // Same currency rule as dealer cards: lot's native shows as primary
  // when it matches user's primaryCurrency; otherwise convert via
  // lotUsdValue → primaryCurrency (FX rates in utils). Native price
  // moves to the secondary line when it differs from primary.
  const lotPrimaryAmount = (() => {
    if (!isLot) return null;
    if (matchesPrimary) return lotNativeValue;
    if (primaryCurrency === "USD") return lotUsdValue;
    if (lotUsdValue == null) return null;
    const rate = FX_RATES_USD_PER[primaryCurrency];
    if (!rate) return null;
    return Math.round(lotUsdValue / rate);
  })();
  const lotPrimaryDisplay = !isLot ? null
    : lotPrimaryAmount != null
      ? (matchesPrimary
          ? fmtLotPrice(lotPrimaryAmount, primaryCurrency) || "—"
          : `~${primarySym}${Math.round(lotPrimaryAmount).toLocaleString()}`)
      : fmtLotPrice(lotNativeValue, item.currency) || "—";
  const lotShowNative = isLot && !matchesPrimary && lotNativeValue;
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
    <div ref={cardRef} style={{ background: "var(--card-bg)", display: "flex", flexDirection: "column", position: "relative", minWidth: 0, overflow: "hidden" }}>
      <a href={item.url} target="_blank" rel="noopener noreferrer"
        onClick={() => { if (onClickListing) onClickListing(item); }}
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
          {/* Top-left state chip — fontSize bumped down to 9 (was 10)
              2026-04-30 so it doesn't eat ~40% of card width at narrow
              mobile widths (2-col view = ~165px cards). Stays legible
              and gives chip more breathing room on every density. */}
          {item.sold ? (() => {
            // Velocity chip: "SOLD · 4d" when we know firstSeen +
            // soldAt. Auctions don't have a firstSeen-from-listing
            // history (lots appear on the catalog ~weeks before the
            // sale and "sold" is the auction end), so the chip
            // would mislead — skip on auction-shaped items. Mark
            // wants this for dealer cycle-speed visibility (Mark
            // request 2026-05-09).
            const dur = (!item._isAuctionFormat && !item._isTrackedLot)
              ? daysOnSale(item) : null;
            const durLabel = dur != null ? daysOnSaleLabel(dur) : null;
            return (
              <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 9, padding: "2px 7px", borderRadius: 8, letterSpacing: "0.06em" }}
                title={durLabel ? `On sale for ${durLabel} before going sold` : undefined}>
                SOLD{durLabel ? ` · ${durLabel}` : ""}
              </div>
            );
          })() : isHidden ? (
            <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(120,120,120,0.85)", color: "#fff", fontSize: 9, padding: "2px 7px", borderRadius: 8, letterSpacing: "0.06em" }}>HIDDEN</div>
          ) : countdownLabel ? (
            <div style={{
              position: "absolute", top: 6, left: 6,
              background: countdownIsPast ? "rgba(0,0,0,0.55)" : "rgba(24,95,165,0.92)",
              color: "#fff", fontSize: 9,
              padding: "2px 7px", borderRadius: 8,
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
              fontSize: 9, padding: "2px 7px", borderRadius: 8,
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
              <span style={{ fontSize: 10, color: "var(--text3)", letterSpacing: "0.05em", fontWeight: 600 }}>
                {lotLabel}
              </span>
              <span style={{ fontSize: compact ? 11 : 13, fontWeight: 500, color: item.sold ? "var(--accent-positive)" : "var(--text1)" }}>
                {lotPrimaryDisplay}
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <div style={{ fontSize: compact ? 11 : 13, fontWeight: 500, color: item.sold ? "var(--text2)" : "var(--text1)" }}>{displayPrice}</div>
              {priceDropped && (
                <span title={`Peak ${fmt(peakPrice, item.currency || "USD")} → ${fmt(item.price, item.currency || "USD")}`}
                  style={{ fontSize: 9, color: "var(--accent-positive)", fontWeight: 600 }}>
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
      {reactionSlot && (
        <div style={{ padding: compact ? "0 7px 8px" : "0 9px 10px" }}>
          {reactionSlot}
        </div>
      )}
      {/* Action-button sizing tracks card density. compact mode is
          activated at cols >= 4 (App.js: const compact = cols >= 4),
          where cards are narrow and a tight 26px button is fine. At
          1 / 2 / 3 cols the cards are large enough that 26px reads as
          a tiny tap target — especially on mobile 1-col where each
          card spans the viewport. Bump to 36px (heart 16px, ⋯ 20px)
          for the non-compact case so the heart is comfortably tap-
          sized at all column counts. */}
      {quickAction && (
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); quickAction.onClick(item); }}
          aria-label={quickAction.label}
          title={quickAction.label}
          style={{
            position: "absolute", top: 6, left: 6,
            width: compact ? 22 : 28, height: compact ? 22 : 28,
            borderRadius: "50%", border: "none", cursor: "pointer",
            background: quickAction.active ? "rgba(220,38,38,0.88)" : "rgba(0,0,0,0.55)",
            color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: compact ? 12 : 14, fontWeight: 700,
            fontFamily: "inherit", padding: 0, lineHeight: 1,
          }}>{quickAction.icon || "↑"}</button>
      )}
      <div style={{ position: "absolute", top: 6, right: 6, display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); onWish(item); }}
          aria-label="Save"
          style={{ width: compact ? 26 : 36, height: compact ? 26 : 36, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: wished ? "rgba(220,38,38,0.88)" : "rgba(0,0,0,0.28)",
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <HeartIcon filled={wished} size={compact ? 12 : 16} />
        </button>
        {/* "..." menu — replaces the standalone × hide button as of
            2026-05-01. Houses Add-to-collection + Hide; Session 3
            adds Share. Renders only if at least one menu item is
            available (so signed-out browsing keeps the card clean).
            Anchored top-right with the dropdown opening down-and-left
            so it doesn't fall off the screen on rightmost cards. */}
        {(onAddToCollection || onHide || onShare || (extraMenuItems && extraMenuItems.length > 0)) && (
          <div style={{ position: "relative" }}>
            <button ref={menuPop.triggerRef}
              onClick={e => {
                e.preventDefault(); e.stopPropagation();
                menuPop.toggle();
              }}
              aria-label="More actions"
              style={{ width: compact ? 26 : 36, height: compact ? 26 : 36, borderRadius: "50%", border: "none", cursor: "pointer",
                      background: menuPop.open ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.28)",
                      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                      padding: 0, fontFamily: "inherit", fontSize: compact ? 16 : 20, lineHeight: 1 }}>
              ⋯
            </button>
            <Popover state={menuPop}>
              {onShare && (
                <button onClick={async e => {
                  e.preventDefault(); e.stopPropagation();
                  let result;
                  try { result = await onShare(item); }
                  catch (err) { console.warn("share failed", err); result = null; }
                  if (result?.copied) {
                    setShareFeedback("Copied!");
                    setTimeout(() => { setShareFeedback(""); menuPop.close(); }, 1200);
                  } else {
                    menuPop.close();
                  }
                }} style={menuItemStyle}>{shareFeedback || "Share"}</button>
              )}
              {/* Menu labels are intentionally short so the menu
                  fits inside a 3-col-mobile card (~114px wide).
                  Longer labels ("Add to collection…", "Hide from
                  feed", "Remove from collection") would push the
                  menu past the card's overflow:hidden edge and
                  get clipped. The "…" on "Add to" hints at the
                  second-step picker modal. */}
              {onAddToCollection && (
                <button onClick={e => { e.preventDefault(); e.stopPropagation(); menuPop.close(); onAddToCollection(item); }}
                  style={menuItemStyle}>Add to…</button>
              )}
              {onHide && (
                <button onClick={e => { e.preventDefault(); e.stopPropagation(); menuPop.close(); onHide(item); }}
                  style={menuItemStyle}>
                  {hideLabel === "Remove from list"
                    ? "Remove"
                    : (hideLabel || (isHidden ? "Unhide" : "Hide"))}
                </button>
              )}
              {(extraMenuItems || []).map((entry, i) => (
                <button key={i} onClick={e => {
                  e.preventDefault(); e.stopPropagation();
                  menuPop.close();
                  entry.onClick(item);
                }} style={menuItemStyle}>{entry.label}</button>
              ))}
            </Popover>
          </div>
        )}
      </div>
    </div>
  );
});
