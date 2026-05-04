import React from "react";
import { Card } from "./Card";

// "Ending soon" — pinned section above the Watchlist sub-tab strip.
// Surfaces the user's tracked auction lots whose auction_end falls
// within the next 7 days (or that are currently live). Three urgency
// tiers:
//   1. LIVE NOW   — auction_start has passed, auction_end hasn't.
//                   Strongest emphasis (red border + label).
//   2. TODAY/TOMORROW — within 48h of auction_end and not yet started.
//                   Amber border + label.
//   3. Within 7 days — standard card; included for context, no label.
//
// Items are sorted live-first, then by auction_end ascending. Ended
// auctions never appear here (they show in Watchlist > Favorites and
// in the auction filter sort).
//
// The whole section returns null when there are no items, so callers
// can mount it unconditionally — no empty state per Mark's spec.
//
// Mounted by both shells (MobileShell + DesktopShell) above the
// watchSubTabsJSX strip when tab === "watchlist". Visible regardless
// of which sub-tab the user is on — it's a tab-level urgency surface,
// not a sub-tab feature.

const DAY_MS = 86400000;

// Classify a lot into one of: "live" | "today" | "tomorrow" | "soon".
// "soon" covers anything between 48h and 7 days from end. Returns null
// if the lot doesn't belong in this section at all (no auction_end,
// already ended, or end is more than 7 days away).
export function classifyEndingSoon(item, now = Date.now()) {
  if (!item || !item._isAuctionFormat) return null;
  if (!item.auction_end) return null;
  const endMs = new Date(item.auction_end).getTime();
  if (Number.isNaN(endMs)) return null;
  if (endMs <= now) return null;                  // already ended
  if (endMs - now > 7 * DAY_MS) return null;      // beyond 7 days
  // Live? auction_start has passed and end hasn't.
  if (item.auction_start) {
    const startMs = new Date(item.auction_start).getTime();
    if (!Number.isNaN(startMs) && startMs <= now) return "live";
  }
  // Today = ends within next 24h.
  if (endMs - now <= DAY_MS) return "today";
  // Tomorrow = ends within next 48h.
  if (endMs - now <= 2 * DAY_MS) return "tomorrow";
  return "soon";
}

// Pull the auction-format, ending-within-7-days subset out of the
// user's full watchlist (including projected tracked lots), sorted
// live-first then by auction_end asc.
export function selectEndingSoonItems(watchItems, now = Date.now()) {
  const tagged = [];
  for (const it of watchItems || []) {
    const tier = classifyEndingSoon(it, now);
    if (!tier) continue;
    tagged.push({ item: it, tier });
  }
  // Live first; then by auction_end ascending. Stable for items with
  // identical end times (e.g. all lots in the same Antiquorum sale).
  tagged.sort((a, b) => {
    const ar = a.tier === "live" ? 0 : 1;
    const br = b.tier === "live" ? 0 : 1;
    if (ar !== br) return ar - br;
    return (a.item.auction_end || "").localeCompare(b.item.auction_end || "");
  });
  return tagged;
}

const TIER_STYLE = {
  live:     { label: "LIVE NOW",  color: "#fff", bg: "#c0392b", border: "#c0392b" },
  today:    { label: "TODAY",     color: "#fff", bg: "#d97706", border: "#d97706" },
  tomorrow: { label: "TOMORROW",  color: "#fff", bg: "#d97706", border: "#d97706" },
  soon:     { label: null,        color: null,    bg: null,      border: null },
};

export function EndingSoon({
  items,           // raw watchItems (App.js will pass watchItems)
  handleWish,
  compact,
  primaryCurrency,
  handleShare,
  openCollectionPicker,
  user,
}) {
  // No section for signed-out users — the watchlist itself is empty.
  if (!user) return null;
  const now = Date.now();
  const tagged = selectEndingSoonItems(items, now);
  if (tagged.length === 0) return null;

  return (
    <div style={{
      padding: "10px 14px 12px",
      borderBottom: "0.5px solid var(--border)",
      background: "var(--bg)",
    }}>
      <div style={{
        display: "flex", alignItems: "baseline", gap: 8,
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
          Ending soon
        </span>
        <span style={{ fontSize: 12, color: "var(--text3)" }}>
          ({tagged.length})
        </span>
      </div>
      {/* Horizontal scrollable strip. Each child is a fixed-width card
          slot so the row reads as a "swipe to see more" surface rather
          than wrapping into a grid (which would compete with the
          sub-tab content below). 160px on mobile-ish viewports keeps
          the whole strip visible at once for typical 1-2 item counts;
          larger card counts scroll. */}
      <div style={{
        display: "flex", gap: 10,
        overflowX: "auto", overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none", msOverflowStyle: "none",
        // Negative margin + padding keeps the scroll edge flush with
        // the section padding while still letting the first/last card
        // breathe at the gutters.
        margin: "0 -14px", padding: "0 14px 4px",
      }}>
        {tagged.map(({ item, tier }) => {
          const ts = TIER_STYLE[tier];
          return (
            <div key={item.id} style={{
              flexShrink: 0, width: 160,
              borderRadius: 10, overflow: "hidden",
              border: ts.border ? `1.5px solid ${ts.border}` : "0.5px solid var(--border)",
              background: "var(--card-bg)",
              display: "flex", flexDirection: "column",
            }}>
              {ts.label && (
                <div style={{
                  background: ts.bg, color: ts.color,
                  fontSize: 9, fontWeight: 700,
                  letterSpacing: "0.08em",
                  padding: "3px 8px",
                  textAlign: "center",
                }}>{ts.label}</div>
              )}
              <Card
                item={item}
                /* Every Ending Soon card is a tracked auction lot
                   from the user's watchlist by definition (the
                   selectEndingSoonItems filter requires
                   _isAuctionFormat + a future auction_end). Looking
                   up `watchlist[item.id]` returns undefined for
                   tracked lots because they live in `tracked_lots`
                   (keyed by URL), not `watchlist_items` (keyed by
                   listing_id). Hardcoding `wished={true}` mirrors
                   how WatchlistTab > Favorites renders the same
                   items. handleWish guards on `_isTrackedLot` so
                   the heart click stays a no-op rather than writing
                   a phantom watchlist_items row. */
                wished={true}
                onWish={handleWish}
                compact={compact}
                primaryCurrency={primaryCurrency}
                onShare={handleShare}
                onAddToCollection={openCollectionPicker}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
