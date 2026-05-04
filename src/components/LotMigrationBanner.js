import React, { useEffect, useState } from "react";
import { shortHash } from "../utils";

// One-shot Phase B2 migration (2026-05-04). Before B2, users tracked
// auction-house lots via the +Track flow which wrote a row to the
// `tracked_lots` Supabase table; the App.js watchItems memo projected
// each row into the user's Watchlist with the heart visually filled
// (but `handleWish` no-op-guarded so the heart wasn't actually
// re-clickable). After B2:
//   - auction-lot data comes from the comprehensive scrape
//     (auction_lots.json), refreshed daily.
//   - hearting an auction lot writes to watchlist_items (same path
//     as dealer items).
//   - the +Track modal is narrowed to eBay URLs only.
//
// This component runs the per-user migration: it copies every
// non-eBay tracked URL into watchlist_items (so the lot stays in
// Favorites), then removes the now-redundant tracked_lots row. eBay
// rows are left untouched. A one-shot localStorage flag keyed by
// user.id makes the migration idempotent across refreshes; signing
// in on a 2nd device just runs again with nothing to migrate.
//
// Hooks are isolated inside this component (vs adding more hooks to
// App.js's already-long list) per the CLAUDE.md "don't add hooks
// deep in App.js" rule. Mounted unconditionally — null render when
// the migration banner shouldn't show.

const FLAG_KEY = (uid) => `dial_lot_migration_v1_${uid}`;

const EBAY_HOST_RE = /ebay\.(?:com|co\.uk|de|fr|it|es|nl|at|ch|ca|com\.au|us|gg|to)/i;

export function LotMigrationBanner({
  user,
  watchlist,
  trackedLotUrls,
  trackedLotsState,
  auctionLotsState,
  toggleWatchlist,
  removeTrackedLot,
}) {
  const [bannerCount, setBannerCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let flag;
    try { flag = localStorage.getItem(FLAG_KEY(user.id)); } catch { return; }
    if (flag === "done") return;
    // Wait for both data sources to load before deciding what to do —
    // an empty trackedLotUrls before the hook resolves would falsely
    // mark the migration done.
    if (trackedLotUrls === null || trackedLotUrls === undefined) return;
    if (trackedLotUrls.length === 0) {
      try { localStorage.setItem(FLAG_KEY(user.id), "done"); } catch {}
      return;
    }
    // Need lot data to project an item shape into watchlist_items.
    // If both sources are still loading (both empty), wait.
    const haveLotData = Object.keys(trackedLotsState || {}).length > 0
                     || Object.keys(auctionLotsState || {}).length > 0;
    if (!haveLotData) return;

    const toMigrate = trackedLotUrls.filter(u => !EBAY_HOST_RE.test(u));
    if (toMigrate.length === 0) {
      try { localStorage.setItem(FLAG_KEY(user.id), "done"); } catch {}
      return;
    }

    let cancelled = false;
    (async () => {
      let migrated = 0;
      for (const url of toMigrate) {
        if (cancelled) return;
        const data = (auctionLotsState || {})[url] || (trackedLotsState || {})[url];
        const id = shortHash(url);
        // If already in watchlist (e.g. user hearted it post-deploy
        // but pre-migration completion), skip the insert — but still
        // remove from tracked_lots so we don't carry a stale row.
        if (!watchlist[id] && data) {
          const isEnded = data.status === "ended";
          const price = (isEnded ? data.sold_price : data.current_bid)
            || data.starting_price || data.estimate_low || 0;
          const priceUsd = (isEnded ? data.sold_price_usd : data.current_bid_usd)
            || data.starting_price_usd || data.estimate_low_usd || price;
          const item = {
            id,
            brand: "Other",
            ref: data.title || url,
            title: data.title || "",
            price: price || 0,
            currency: data.currency || "USD",
            priceUSD: priceUsd || price || 0,
            source: data.house || "—",
            url,
            img: data.cached_img_url || data.image || "",
            sold: isEnded,
            // Carry the auction fields so the Card render shows the
            // countdown / estimate / lot number after migration the
            // same way the live projection does.
            buying_option: data.buying_option,
            current_bid: data.current_bid,
            current_bid_usd: data.current_bid_usd,
            sold_price: data.sold_price,
            sold_price_usd: data.sold_price_usd,
            estimate_low: data.estimate_low,
            estimate_high: data.estimate_high,
            estimate_low_usd: data.estimate_low_usd,
            estimate_high_usd: data.estimate_high_usd,
            starting_price: data.starting_price,
            auction_end: data.auction_end,
            auction_start: data.auction_start,
            auction_title: data.auction_title,
            lot_number: data.lot_number,
          };
          try { await toggleWatchlist(item); migrated++; }
          catch (e) { console.warn("lot migration insert failed", url, e); continue; }
        }
        try { await removeTrackedLot(url); }
        catch (e) { console.warn("lot migration tracked_lots delete failed", url, e); }
      }
      if (cancelled) return;
      try { localStorage.setItem(FLAG_KEY(user.id), "done"); } catch {}
      if (migrated > 0) setBannerCount(migrated);
    })();
    return () => { cancelled = true; };
  }, [user, trackedLotUrls, trackedLotsState, auctionLotsState, watchlist, toggleWatchlist, removeTrackedLot]);

  if (!bannerCount || dismissed) return null;
  return (
    <div style={{
      margin: "10px 14px 4px",
      padding: "10px 14px",
      borderRadius: 10,
      border: "0.5px solid var(--border)",
      background: "var(--surface)",
      color: "var(--text1)",
      fontSize: 13,
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
    }}>
      <div style={{ flex: 1, lineHeight: 1.4 }}>
        Moved {bannerCount} of your tracked auction lots into Favorites.
        Auction lots are now hearted just like dealer listings — no more
        +Track button for auction houses. eBay items still work via +Track.
      </div>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss" style={{
        flexShrink: 0,
        background: "transparent",
        border: "0.5px solid var(--border)",
        color: "var(--text2)",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: 16,
      }}>Got it</button>
    </div>
  );
}
