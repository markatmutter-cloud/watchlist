import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

// Admin-only source-quality dashboard. Surfaces the data the Epic 0
// verification script + per-source aggregates produce, in a dense
// monospace table. Sortable; default sort puts the worst-performing
// sources first so prune candidates surface immediately.
//
// Data sources:
// - public/verification.json — today's report (counts + alerts)
// - public/verification_history.json — rolling 14-day per-source counts
//   (used for the trend sparkline)
// - public/listings.json — for live counts, prices, brand mix, recent
//   firstSeen → days-stale and new-per-week
// - props watchItems (Mark's hearted listings — source on each snapshot)
// - props hiddenItems (currently-active items Mark has hidden)
//
// Caveats acknowledged in code:
// - Hide counts only cover hides on *currently-active* listings (because
//   hidden_listings stores listing_id only — no snapshot). A hide on an
//   aged-out listing won't surface here. Acceptable for v1 — most hides
//   are recent.
// - "Total ever seen" denominator for heart/hide rates is approximated
//   as max(live, hearts+hides). True ever-seen would need walking
//   state.json which is 1.8MB — defer until the simpler proxy proves
//   inadequate.

// Earning-keep rule. Tunable in one place.
function earningChip(heartRate, hideRate, newPerWeek, daysStale, healthOk) {
  if (heartRate >= 0.05 || (newPerWeek >= 5 && healthOk)) return "good";
  if ((heartRate < 0.01 && hideRate > 0.05) || daysStale > 30) return "bad";
  return "meh";
}

function Sparkline({ values, width = 64, height = 16 }) {
  if (!values || values.length < 2) {
    return <span style={{ color: "var(--text3)", fontSize: 11 }}>—</span>;
  }
  const max = Math.max(...values, 1);
  const stepX = width / Math.max(values.length - 1, 1);
  const points = values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - (v / max) * (height - 2) - 1).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} style={{ display: "inline-block", verticalAlign: "middle" }}>
      <polyline
        points={points}
        fill="none"
        stroke="var(--text2)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChipDot({ kind }) {
  // kind: "good" | "meh" | "bad" | "ok" | "warn" | "error"
  const map = {
    good: { color: "#1f9d4f", glyph: "●", label: "Earning" },
    meh:  { color: "#c9a227", glyph: "●", label: "Marginal" },
    bad:  { color: "var(--danger)", glyph: "●", label: "Prune candidate" },
    ok:   { color: "#1f9d4f", glyph: "✓", label: "Healthy" },
    warn: { color: "#c9a227", glyph: "⚠", label: "Warning" },
    error:{ color: "var(--danger)", glyph: "✗", label: "Error" },
  };
  const c = map[kind] || map.meh;
  return (
    <span title={c.label} style={{ color: c.color, fontWeight: 600 }}>{c.glyph}</span>
  );
}

const fmtPct = (n) => (n ? `${(n * 100).toFixed(1)}%` : "—");
const fmtPer100 = (n) => (n ? n.toFixed(1) : "—");
// Compact $ — switches between $X.XK / $X.XM so a wide range of
// values reads cleanly in a fixed-width column.
const fmtMoney = (n) => {
  if (!n) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
};

const COLUMNS = [
  { key: "source",      label: "Source",      align: "left",  fmt: (r) => r.source },
  { key: "live",        label: "Live",        align: "right", fmt: (r) => r.live.toLocaleString() },
  { key: "newPerWeek",  label: "New/wk",      align: "right", fmt: (r) => r.newPerWeek.toFixed(1) },
  { key: "trend",       label: "Trend (14d)", align: "left",  fmt: (r) => <Sparkline values={r.trend} /> },
  { key: "daysStale",   label: "Stale",       align: "right", fmt: (r) => r.daysStale >= 999 ? "—" : `${r.daysStale}d` },
  { key: "hearts",      label: "♥",           align: "right", fmt: (r) => r.hearts.toLocaleString() },
  { key: "heartRate",   label: "♥ %",         align: "right", fmt: (r) => fmtPct(r.heartRate) },
  { key: "hides",       label: "✕",           align: "right", fmt: (r) => r.hides.toLocaleString() },
  { key: "hideRate",    label: "✕ %",         align: "right", fmt: (r) => fmtPct(r.hideRate) },
  { key: "avgPrice",    label: "Avg $",       align: "right", fmt: (r) => r.avgPrice ? `$${(r.avgPrice/1000).toFixed(1)}K` : "—" },
  // Throughput in $ — supply-side rolling 30d. $ added is the sum of
  // priceUSD across listings that first appeared in the last 30 days
  // (regardless of current sold state — a listing is "added" once
  // even if it later sells). $ sold is the sum of lastMeaningfulPrice
  // for listings that went sold within 30 days. Together they give
  // a velocity read that the unit-count + heart-rate columns miss
  // for high-value-low-volume dealers.
  { key: "addedUsd30d", label: "$ added (30d)", align: "right", fmt: (r) => fmtMoney(r.addedUsd30d) },
  { key: "soldUsd30d",  label: "$ sold (30d)",  align: "right", fmt: (r) => fmtMoney(r.soldUsd30d) },
  { key: "topBrand",    label: "Top brand",   align: "left",  fmt: (r) => r.topBrand ? `${r.topBrand} ${(r.topBrandPct*100).toFixed(0)}%` : "—" },
  // Demand-side columns from listing_events (Epic 8). 30-day rolling
  // window, sourced from listing_events_daily via the
  // source_engagement_summary RPC. Today's events appear after the
  // next rollup runs.
  { key: "views30d",    label: "Views (30d)", align: "right", fmt: (r) => r.views30d.toLocaleString() },
  { key: "ctr",         label: "CTR",         align: "right", fmt: (r) => fmtPct(r.ctr) },
  { key: "savePer100v", label: "♥/100v",      align: "right", fmt: (r) => fmtPer100(r.savePer100v) },
  { key: "listAddPer100v", label: "+List/100v", align: "right", fmt: (r) => fmtPer100(r.listAddPer100v) },
  { key: "sharePer100v",label: "Sh/100v",     align: "right", fmt: (r) => fmtPer100(r.sharePer100v) },
  { key: "health",      label: "Health",      align: "center",fmt: (r) => <ChipDot kind={r.health} /> },
  { key: "earning",     label: "Earning?",    align: "center",fmt: (r) => <ChipDot kind={r.earning} /> },
];

// Auction-house quality table. Different signal set than dealer
// sources: houses publish in batches around scheduled sales rather
// than rolling inventory, so unit-count / new-per-week / heart-rate
// don't carry the same meaning. Instead surface what actually matters:
// scrape coverage, sold-rate, $ throughput, estimate calibration.
const HOUSE_COLUMNS = [
  { key: "house",         label: "House",          align: "left",  fmt: (r) => r.house },
  { key: "scrapeMode",    label: "Scrape mode",    align: "left",  fmt: (r) => r.scrapeMode },
  { key: "liveSales",     label: "Live sales",     align: "right", fmt: (r) => r.liveSales.toLocaleString() },
  { key: "upcomingSales", label: "Upcoming",       align: "right", fmt: (r) => r.upcomingSales.toLocaleString() },
  { key: "totalLots",     label: "Lots",           align: "right", fmt: (r) => r.totalLots.toLocaleString() },
  { key: "soldLots",      label: "Sold",           align: "right", fmt: (r) => r.soldLots.toLocaleString() },
  { key: "soldRate",      label: "Sold %",         align: "right", fmt: (r) => fmtPct(r.soldRate) },
  // $ sold is rolling 90d here (vs 30d on dealers) — auction calendars
  // run at lower cadence so a 30-day window is usually empty for any
  // given house.
  { key: "soldUsd90d",    label: "$ sold (90d)",   align: "right", fmt: (r) => fmtMoney(r.soldUsd90d) },
  // Hammer ÷ low estimate. ~1.0 = estimates calibrated to where bidding
  // lands. <0.7 = systematically optimistic (Antiquorum runs here);
  // >1.3 = systematically conservative. Median across all sold lots
  // we have data for, so dominant houses dominate but the per-house
  // value still reads.
  { key: "estimateRatio", label: "Hammer/Low",     align: "right", fmt: (r) => r.estimateRatio ? r.estimateRatio.toFixed(2) : "—" },
  { key: "health",        label: "Health",         align: "center",fmt: (r) => <ChipDot kind={r.health} /> },
];

// Per-user watchlist limits + engagement — listed via
// list_user_limits RPC, cap edited via set_watchlist_cap_by_email.
// Both are admin-only on the SQL side. The table is sorted by
// hearts count by default (power users surface first); cap edits
// are inline via the form at the bottom of the section.
//
// Engagement columns (Views / Clicks / Shares) are 30-day rolling
// from raw listing_events — the rollup table doesn't carry user_id.
// Saved-search and Lists columns are lifetime (counts of current
// rows in saved_searches / collections).
const USER_COLUMNS = [
  { key: "email",         label: "Email",          align: "left",  fmt: (r) => r.email },
  { key: "hearts_count",  label: "♥",              align: "right", fmt: (r) => Number(r.hearts_count).toLocaleString() },
  { key: "hides_count",   label: "✕",              align: "right", fmt: (r) => Number(r.hides_count).toLocaleString() },
  { key: "lists_count",   label: "Lists",          align: "right", fmt: (r) => Number(r.lists_count).toLocaleString() },
  { key: "searches_count",label: "Searches",       align: "right", fmt: (r) => Number(r.searches_count).toLocaleString() },
  { key: "views_30d",     label: "Views (30d)",    align: "right", fmt: (r) => Number(r.views_30d).toLocaleString() },
  { key: "clicks_30d",    label: "Clicks (30d)",   align: "right", fmt: (r) => Number(r.clicks_30d).toLocaleString() },
  { key: "shares_30d",    label: "Shares (30d)",   align: "right", fmt: (r) => Number(r.shares_30d).toLocaleString() },
  { key: "top_brand",     label: "Top brand",      align: "left",  fmt: (r) => r.top_brand || "—" },
  { key: "watchlist_cap", label: "Cap",            align: "right", fmt: (r) => r.watchlist_cap.toLocaleString() },
  { key: "is_default_cap",label: "Default?",       align: "center",fmt: (r) => r.is_default_cap ? "—" : "override" },
  { key: "notes",         label: "Notes",          align: "left",  fmt: (r) => r.notes || "" },
];

export function AdminTab({ watchItems, hiddenItems }) {
  const [verification, setVerification] = useState(null);
  const [history, setHistory] = useState([]);
  const [listings, setListings] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [sort, setSort] = useState({ key: "earning", dir: "desc" });
  // Per-source engagement aggregates from listing_events_daily.
  // Empty Map until the RPC resolves; engagement columns render "—"
  // for sources without rolled-up events yet.
  const [engagement, setEngagement] = useState(new Map());
  // Auction calendar + lots, used for the per-house quality table
  // below the dealer source table. Both static JSON files served
  // alongside listings.json. Manual archive lots are merged into the
  // lots map so historical hammer prices contribute to the
  // estimate-ratio + sold-rate signals.
  const [auctions, setAuctions] = useState([]);
  const [auctionLots, setAuctionLots] = useState({});
  const [houseSort, setHouseSort] = useState({ key: "totalLots", dir: "desc" });
  // Per-user limits via list_user_limits RPC. setCapForm holds the
  // bound input values for the inline expansion form below the
  // table; setCapError is rendered in red after a failed RPC.
  const [userLimits, setUserLimits] = useState([]);
  const [userLimitsTick, setUserLimitsTick] = useState(0);
  const [capForm, setCapForm] = useState({ email: "", cap: "5000", note: "" });
  const [capError, setCapError] = useState("");
  const [capBusy, setCapBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/verification.json").then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/verification_history.json").then((r) => r.ok ? r.json() : { history: [] }).catch(() => ({ history: [] })),
      fetch("/listings.json").then((r) => r.ok ? r.json() : []).catch(() => []),
      fetch("/auctions.json").then((r) => r.ok ? r.json() : []).catch(() => []),
      fetch("/auction_lots.json").then((r) => r.ok ? r.json() : {}).catch(() => ({})),
      fetch("/manual_archive_lots.json").then((r) => r.ok ? r.json() : {}).catch(() => ({})),
    ]).then(([v, h, l, a, lots, archive]) => {
      if (cancelled) return;
      setVerification(v);
      setHistory((h && h.history) || []);
      setListings(l);
      setAuctions(Array.isArray(a) ? a : []);
      setAuctionLots({ ...(lots || {}), ...(archive || {}) });
    }).catch((e) => {
      if (!cancelled) setLoadError(String(e));
    });
    return () => { cancelled = true; };
  }, []);

  // Engagement fetch — RLS gates this RPC to admin emails (function
  // is security invoker; underlying tables enforce admin-only SELECT).
  // Non-admin browsers get an empty result without an error, which we
  // already handle by rendering "—" in the engagement columns.
  useEffect(() => {
    if (!supabase) return undefined;
    let cancelled = false;
    supabase.rpc("source_engagement_summary", { window_days: 30 })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return;  // silent for non-admin / unconfigured
        const next = new Map();
        for (const row of data || []) next.set(row.source || "", row);
        setEngagement(next);
      });
    return () => { cancelled = true; };
  }, []);

  // Per-user limits fetch — admin-only RPC. Re-runs whenever
  // userLimitsTick is bumped (set after a successful cap update so
  // the table reflects the change). Same silent-fail pattern as
  // engagement: non-admin callers get empty rows.
  useEffect(() => {
    if (!supabase) return undefined;
    let cancelled = false;
    supabase.rpc("list_user_limits")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return;
        setUserLimits(data || []);
      });
    return () => { cancelled = true; };
  }, [userLimitsTick]);

  const submitCapChange = async (e) => {
    e.preventDefault();
    setCapError("");
    if (!supabase) { setCapError("Supabase not configured"); return; }
    const email = capForm.email.trim();
    const cap = parseInt(capForm.cap, 10);
    if (!email) { setCapError("Email required"); return; }
    if (!Number.isFinite(cap) || cap < 0) { setCapError("Cap must be a positive integer"); return; }
    setCapBusy(true);
    const { error } = await supabase.rpc("set_watchlist_cap_by_email", {
      user_email: email,
      new_cap: cap,
      note: capForm.note.trim() || null,
    });
    setCapBusy(false);
    if (error) {
      setCapError(error.message || "Failed");
      return;
    }
    setCapForm({ email: "", cap: String(cap), note: "" });
    setUserLimitsTick((n) => n + 1);
  };

  const rows = useMemo(() => {
    if (!listings.length) return [];

    const today = new Date();
    const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const DAY_MS = 86400000;

    const bySource = new Map();
    for (const it of listings) {
      const s = it.source || "?";
      if (!bySource.has(s)) {
        bySource.set(s, {
          live: 0, prices: [], brands: new Map(),
          newRecent: 0, latestFirstSeen: "",
          addedUsd30d: 0, soldUsd30d: 0,
        });
      }
      const agg = bySource.get(s);
      if (!it.sold) agg.live += 1;
      if (it.priceUSD && !it.sold) agg.prices.push(it.priceUSD);
      const brand = it.brand || "Other";
      agg.brands.set(brand, (agg.brands.get(brand) || 0) + 1);
      const fs = it.firstSeen || "";
      if (fs > agg.latestFirstSeen) agg.latestFirstSeen = fs;
      if (fs) {
        const fsDate = new Date(fs);
        if (today - fsDate <= FOUR_WEEKS_MS) agg.newRecent += 1;
        // Throughput — $ added rolling 30d. Counts a listing once at
        // its firstSeen date regardless of current sold state, so a
        // dealer that lists + sells fast still gets credit for the
        // initial supply.
        if (today - fsDate <= THIRTY_DAYS_MS && it.priceUSD) {
          agg.addedUsd30d += it.priceUSD;
        }
      }
      // $ sold (30d) — value of inventory that converted in the last
      // 30 days. Falls back through the price hierarchy: priceUSD if
      // still set on a sold record, otherwise lastMeaningfulPrice
      // (which merge.py emits as the last non-zero priceHistory entry
      // — see CLAUDE.md "Backend-emitted display fields").
      if (it.sold) {
        const sa = it.soldAt || "";
        if (sa) {
          const sd = new Date(sa);
          if (today - sd <= THIRTY_DAYS_MS) {
            const v = it.priceUSD || it.lastMeaningfulPrice || 0;
            if (v) agg.soldUsd30d += v;
          }
        }
      }
    }

    const heartsBy = new Map();
    for (const it of (watchItems || [])) {
      const s = it.source || it.lastSource || "?";
      heartsBy.set(s, (heartsBy.get(s) || 0) + 1);
    }
    const hidesBy = new Map();
    for (const it of (hiddenItems || [])) {
      const s = it.source || it.lastSource || "?";
      hidesBy.set(s, (hidesBy.get(s) || 0) + 1);
    }

    const alertsBySource = new Map();
    for (const a of (verification?.alerts || [])) {
      alertsBySource.set(a.source, a);
    }

    const sources = new Set([...bySource.keys(), ...heartsBy.keys(), ...hidesBy.keys()]);
    const out = [];
    for (const src of sources) {
      const agg = bySource.get(src) || {
        live: 0, prices: [], brands: new Map(),
        newRecent: 0, latestFirstSeen: "",
        addedUsd30d: 0, soldUsd30d: 0,
      };
      const hearts = heartsBy.get(src) || 0;
      const hides = hidesBy.get(src) || 0;
      const everSeen = Math.max(agg.live, hearts + hides, 1);
      const heartRate = hearts / everSeen;
      const hideRate = hides / everSeen;
      const newPerWeek = agg.newRecent / 4;
      const daysStale = agg.latestFirstSeen
        ? Math.max(0, Math.floor((today - new Date(agg.latestFirstSeen)) / DAY_MS))
        : 999;
      const sortedPrices = agg.prices.slice().sort((a, b) => a - b);
      const median = sortedPrices.length ? sortedPrices[Math.floor(sortedPrices.length / 2)] : 0;
      const topBrandEntry = [...agg.brands.entries()].sort((a, b) => b[1] - a[1])[0];
      const topBrand = topBrandEntry ? topBrandEntry[0] : "";
      const topBrandPct = topBrandEntry && agg.live ? topBrandEntry[1] / agg.live : 0;
      const trend = history.slice(-14).map((h) => h.counts?.[src] || 0);
      const alert = alertsBySource.get(src);
      const health = !alert ? "ok" : (alert.level === "ERROR" ? "error" : "warn");
      const earning = earningChip(heartRate, hideRate, newPerWeek, daysStale, !alert);

      // Engagement (30-day rolling). Numbers come from the rollup
      // table via the source_engagement_summary RPC; rates are
      // normalised to views so a higher-traffic source doesn't auto-
      // win the chart.
      const eng = engagement.get(src) || {};
      const views30d = Number(eng.views || 0);
      const clicks30d = Number(eng.clicks || 0);
      const saves30d = Number(eng.saves || 0);
      const listAdds30d = Number(eng.list_adds || 0);
      const shares30d = Number(eng.shares || 0);
      const ctr = views30d ? clicks30d / views30d : 0;
      const savePer100v = views30d ? (saves30d / views30d) * 100 : 0;
      const listAddPer100v = views30d ? (listAdds30d / views30d) * 100 : 0;
      const sharePer100v = views30d ? (shares30d / views30d) * 100 : 0;

      out.push({
        source: src, live: agg.live, newPerWeek, daysStale, hearts, heartRate, hides, hideRate,
        avgPrice: median, topBrand, topBrandPct, trend, health, earning, alert,
        addedUsd30d: agg.addedUsd30d, soldUsd30d: agg.soldUsd30d,
        views30d, clicks30d, saves30d, listAdds30d, shares30d,
        ctr, savePer100v, listAddPer100v, sharePer100v,
      });
    }
    return out;
  }, [listings, history, verification, watchItems, hiddenItems, engagement]);

  const sortedRows = useMemo(() => {
    const r = rows.slice();
    const k = sort.key;
    const sign = sort.dir === "asc" ? 1 : -1;
    const earningOrder = { good: 0, meh: 1, bad: 2 };
    const healthOrder = { ok: 0, warn: 1, error: 2 };
    r.sort((a, b) => {
      if (k === "source" || k === "topBrand") {
        return sign * String(a[k] || "").localeCompare(String(b[k] || ""));
      }
      if (k === "earning") return sign * (earningOrder[a.earning] - earningOrder[b.earning]);
      if (k === "health") return sign * (healthOrder[a.health] - healthOrder[b.health]);
      if (k === "trend") {
        // trend is an array; sort by latest value
        const av = a.trend[a.trend.length - 1] || 0;
        const bv = b.trend[b.trend.length - 1] || 0;
        return sign * (av - bv);
      }
      return sign * ((a[k] || 0) - (b[k] || 0));
    });
    return r;
  }, [rows, sort]);

  // Per-house aggregates for the auction-house quality table.
  // Drawn from auctions.json (calendar status) + auction_lots.json
  // ∪ manual_archive_lots.json (lot detail). tracked_lots.json is
  // user-specific so it's intentionally excluded.
  const houseRows = useMemo(() => {
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
    const today = new Date();

    // Houses that have lot-level scrapers; everything else is
    // calendar-only per CLAUDE.md "Comprehensive auction-lot scraping".
    const SCRAPED_HOUSES = new Set(["Antiquorum", "Christie's", "Sotheby's", "Phillips"]);

    const byHouse = new Map();
    const ensure = (h) => {
      if (!byHouse.has(h)) {
        byHouse.set(h, {
          liveSales: 0, upcomingSales: 0,
          totalLots: 0, soldLots: 0, soldUsd90d: 0,
          ratios: [],
        });
      }
      return byHouse.get(h);
    };

    for (const sale of auctions) {
      const h = sale.house || "?";
      const agg = ensure(h);
      if (sale.status === "live") agg.liveSales += 1;
      else if (sale.status === "upcoming") agg.upcomingSales += 1;
    }
    for (const lot of Object.values(auctionLots)) {
      const h = lot.house || "?";
      const agg = ensure(h);
      agg.totalLots += 1;
      if (lot.sold_price_usd) {
        agg.soldLots += 1;
        const end = lot.auction_end ? new Date(lot.auction_end) : null;
        if (end && today - end <= NINETY_DAYS_MS) {
          agg.soldUsd90d += Number(lot.sold_price_usd) || 0;
        }
        if (lot.estimate_low_usd) {
          agg.ratios.push(Number(lot.sold_price_usd) / Number(lot.estimate_low_usd));
        }
      }
    }

    const houseAlerts = new Map();
    // Verification.json carries auction-house alerts in the same
    // alerts[] array as dealer alerts; the verify_auction_lots step
    // emits them with the house name in `source`.
    for (const a of (verification?.alerts || [])) {
      if (a.source && byHouse.has(a.source)) houseAlerts.set(a.source, a);
    }

    const out = [];
    for (const [house, agg] of byHouse) {
      const soldRate = agg.totalLots ? agg.soldLots / agg.totalLots : 0;
      const sortedRatios = agg.ratios.slice().sort((a, b) => a - b);
      const median = sortedRatios.length
        ? sortedRatios[Math.floor(sortedRatios.length / 2)]
        : 0;
      const alert = houseAlerts.get(house);
      const health = !alert ? "ok" : (alert.level === "ERROR" ? "error" : "warn");
      const scrapeMode = SCRAPED_HOUSES.has(house) ? "lot-level" : "calendar-only";
      out.push({
        house, scrapeMode,
        liveSales: agg.liveSales, upcomingSales: agg.upcomingSales,
        totalLots: agg.totalLots, soldLots: agg.soldLots, soldRate,
        soldUsd90d: agg.soldUsd90d,
        estimateRatio: median,
        health, alert,
      });
    }
    return out;
  }, [auctions, auctionLots, verification]);

  const sortedHouseRows = useMemo(() => {
    const r = houseRows.slice();
    const k = houseSort.key;
    const sign = houseSort.dir === "asc" ? 1 : -1;
    const healthOrder = { ok: 0, warn: 1, error: 2 };
    r.sort((a, b) => {
      if (k === "house" || k === "scrapeMode") {
        return sign * String(a[k] || "").localeCompare(String(b[k] || ""));
      }
      if (k === "health") return sign * (healthOrder[a.health] - healthOrder[b.health]);
      return sign * ((a[k] || 0) - (b[k] || 0));
    });
    return r;
  }, [houseRows, houseSort]);

  const onHouseSortClick = (key) => {
    setHouseSort((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      const isText = key === "house" || key === "scrapeMode";
      return { key, dir: isText ? "asc" : "desc" };
    });
  };

  const onSortClick = (key) => {
    setSort((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      // Default direction for numeric is desc (highest first); for text is asc.
      const isText = key === "source" || key === "topBrand";
      return { key, dir: isText ? "asc" : "desc" };
    });
  };

  const totals = useMemo(() => {
    const liveSum = rows.reduce((a, r) => a + r.live, 0);
    return { sources: rows.length, live: liveSum };
  }, [rows]);

  const alerts = verification?.alerts || [];

  const cellBase = {
    padding: "6px 10px",
    borderBottom: "0.5px solid var(--border)",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    whiteSpace: "nowrap",
  };
  const headerBase = {
    ...cellBase,
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text2)",
    background: "var(--surface)",
    cursor: "pointer",
    userSelect: "none",
    position: "sticky",
    top: 0,
    zIndex: 1,
  };

  return (
    <div style={{ padding: "16px 18px 60px" }}>
      <div style={{
        display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap",
        marginBottom: 14,
      }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text1)", margin: 0 }}>
          Source quality
        </h1>
        <span style={{ fontSize: 12, color: "var(--text2)" }}>
          {totals.sources} sources · {totals.live.toLocaleString()} live listings
        </span>
        {verification?.date && (
          <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto" }}>
            Last verification: {verification.date}
          </span>
        )}
      </div>

      {alerts.length > 0 && (
        <div style={{
          marginBottom: 16,
          padding: "10px 14px",
          borderRadius: 8,
          border: "0.5px solid var(--danger)",
          background: "rgba(192, 57, 43, 0.08)",
          fontSize: 13,
          color: "var(--text1)",
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            ⚠ {alerts.length} alert{alerts.length === 1 ? "" : "s"} from the last verification run
          </div>
          {alerts.map((a, i) => (
            <div key={i} style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
              [{a.level}] <strong>{a.source}</strong>: {a.note}
            </div>
          ))}
        </div>
      )}

      {loadError && (
        <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>
          Failed to load report data: {loadError}
        </div>
      )}

      {!listings.length && !loadError ? (
        <div style={{ color: "var(--text2)", fontSize: 13, padding: 20 }}>
          Loading…
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "0.5px solid var(--border)", borderRadius: 8 }}>
          <table style={{
            borderCollapse: "collapse",
            width: "100%",
            minWidth: 1100,
          }}>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => onSortClick(c.key)}
                    style={{ ...headerBase, textAlign: c.align }}
                    title="Click to sort"
                  >
                    {c.label}
                    {sort.key === c.key && (
                      <span style={{ marginLeft: 4, color: "var(--text1)" }}>
                        {sort.dir === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr key={r.source}>
                  {COLUMNS.map((c) => (
                    <td key={c.key} style={{ ...cellBase, textAlign: c.align, color: "var(--text1)" }}>
                      {c.fmt(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 11, color: "var(--text3)", lineHeight: 1.6 }}>
        <strong style={{ color: "var(--text2)" }}>Earning?</strong> rule:
        🟢 if heart-rate ≥ 5% or (new-per-week ≥ 5 and health OK).
        🔴 if (heart-rate &lt; 1% and hide-rate &gt; 5%) or stale &gt; 30 days.
        🟡 otherwise. Override manually — these are suggestions.
        <br />
        <strong style={{ color: "var(--text2)" }}>Caveats:</strong> hide counts cover only currently-active listings (the schema doesn't snapshot at hide time);
        heart/hide rates use max(live, hearts+hides) as the denominator (proxy for "ever seen") to avoid loading state.json. Both reasonable for v1.
        <br />
        <strong style={{ color: "var(--text2)" }}>Throughput</strong> ($ added / $ sold) is a 30-day rolling sum
        from listings.json. $ added counts a listing once at firstSeen,
        $ sold uses lastMeaningfulPrice if priceUSD is 0 on the sold
        record (the merge.py-emitted "last non-zero ask" field).
        <br />
        <strong style={{ color: "var(--text2)" }}>Engagement</strong> (Views / CTR / ♥/100v / +List/100v / Sh/100v) is a 30-day rolling
        window from the listing_events_daily rollup. Today's events
        appear after the next nightly rollup; trigger one early via
        <code style={{ marginLeft: 4, marginRight: 4, padding: "0 4px", background: "var(--surface)", borderRadius: 3 }}>select public.rollup_and_prune_listing_events();</code>
        in the SQL editor.
      </div>

      {/* ── Auction-house quality ──────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap",
        marginTop: 32, marginBottom: 14,
      }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text1)", margin: 0 }}>
          Auction house quality
        </h1>
        <span style={{ fontSize: 12, color: "var(--text2)" }}>
          {houseRows.length} houses · {houseRows.reduce((a, r) => a + r.totalLots, 0).toLocaleString()} lots tracked
        </span>
      </div>

      {houseRows.length === 0 ? (
        <div style={{ color: "var(--text2)", fontSize: 13, padding: 20 }}>
          Loading auction data…
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "0.5px solid var(--border)", borderRadius: 8 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
            <thead>
              <tr>
                {HOUSE_COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => onHouseSortClick(c.key)}
                    style={{ ...headerBase, textAlign: c.align }}
                    title="Click to sort"
                  >
                    {c.label}
                    {houseSort.key === c.key && (
                      <span style={{ marginLeft: 4, color: "var(--text1)" }}>
                        {houseSort.dir === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedHouseRows.map((r) => (
                <tr key={r.house}>
                  {HOUSE_COLUMNS.map((c) => (
                    <td key={c.key} style={{ ...cellBase, textAlign: c.align, color: "var(--text1)" }}>
                      {c.fmt(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 11, color: "var(--text3)", lineHeight: 1.6 }}>
        <strong style={{ color: "var(--text2)" }}>Scrape mode:</strong> "lot-level" houses (Antiquorum, Christie's,
        Sotheby's, Phillips) have working detail scrapers; "calendar-only" houses (Bonhams,
        Monaco Legend) only contribute upcoming-sale tiles, no per-lot data — the lots/sold
        columns will read 0 for them.
        <br />
        <strong style={{ color: "var(--text2)" }}>Hammer/Low</strong> is the median ratio of
        sold price to low estimate across all sold lots we have data for. ~1.0 means
        estimates are calibrated to where bidding lands; &lt;0.7 systematically optimistic;
        &gt;1.3 systematically conservative.
        <br />
        <strong style={{ color: "var(--text2)" }}>$ sold (90d)</strong> is rolling 90 days
        (vs 30 on dealers) — auction calendars run at lower cadence so a 30-day window
        is usually empty for any given house.
      </div>

      {/* ── User limits ───────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap",
        marginTop: 32, marginBottom: 14,
      }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text1)", margin: 0 }}>
          User limits
        </h1>
        <span style={{ fontSize: 12, color: "var(--text2)" }}>
          {userLimits.length} users with watchlist data ·
          {" "}{userLimits.filter((u) => !u.is_default_cap).length} with overrides
        </span>
      </div>

      {userLimits.length === 0 ? (
        <div style={{ color: "var(--text2)", fontSize: 13, padding: 20 }}>
          {supabase ? "No user data yet (or RPC denied for non-admins)." : "Supabase not configured."}
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "0.5px solid var(--border)", borderRadius: 8 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 800 }}>
            <thead>
              <tr>
                {USER_COLUMNS.map((c) => (
                  <th key={c.key} style={{ ...headerBase, textAlign: c.align, cursor: "default" }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {userLimits.map((r) => (
                <tr key={r.user_id}>
                  {USER_COLUMNS.map((c) => (
                    <td key={c.key} style={{ ...cellBase, textAlign: c.align, color: "var(--text1)" }}>
                      {c.fmt(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inline cap-edit form. Calls set_watchlist_cap_by_email RPC
          which is admin-only on the SQL side, so the same admin gate
          guards the form even if a non-admin saw it. */}
      <form onSubmit={submitCapChange} style={{
        marginTop: 16,
        padding: "12px 14px",
        border: "0.5px solid var(--border)",
        borderRadius: 8,
        display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end",
      }}>
        <div style={{ display: "flex", flexDirection: "column", flex: "2 1 240px", minWidth: 200 }}>
          <label style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>User email</label>
          <input
            type="email"
            value={capForm.email}
            onChange={(e) => setCapForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="user@example.com"
            style={{ ...cellBase, fontFamily: "inherit", fontSize: 13, padding: "6px 8px", border: "0.5px solid var(--border)", borderRadius: 6, background: "var(--bg)", color: "var(--text1)" }}
            required
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: "1 1 100px", minWidth: 90 }}>
          <label style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>New cap</label>
          <input
            type="number"
            min="0"
            max="100000"
            value={capForm.cap}
            onChange={(e) => setCapForm((f) => ({ ...f, cap: e.target.value }))}
            style={{ ...cellBase, fontFamily: "inherit", fontSize: 13, padding: "6px 8px", border: "0.5px solid var(--border)", borderRadius: 6, background: "var(--bg)", color: "var(--text1)" }}
            required
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: "3 1 240px", minWidth: 200 }}>
          <label style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>Note (optional)</label>
          <input
            type="text"
            value={capForm.note}
            onChange={(e) => setCapForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="why the override"
            style={{ ...cellBase, fontFamily: "inherit", fontSize: 13, padding: "6px 8px", border: "0.5px solid var(--border)", borderRadius: 6, background: "var(--bg)", color: "var(--text1)" }}
          />
        </div>
        <button
          type="submit"
          disabled={capBusy}
          style={{
            padding: "8px 14px",
            border: "0.5px solid var(--border)",
            borderRadius: 6,
            background: "var(--text1)",
            color: "var(--bg)",
            fontSize: 13, fontWeight: 500,
            cursor: capBusy ? "wait" : "pointer",
            opacity: capBusy ? 0.6 : 1,
          }}
        >
          {capBusy ? "Saving…" : "Set cap"}
        </button>
        {capError && (
          <div style={{ flex: "1 1 100%", color: "var(--danger)", fontSize: 12, marginTop: 4 }}>
            {capError}
          </div>
        )}
      </form>

      <div style={{ marginTop: 12, fontSize: 11, color: "var(--text3)", lineHeight: 1.6 }}>
        Default cap: <strong>2,500</strong> hearts per user. Soft warning fires at 80%
        of cap (2,000 by default). The DB enforces the cap via a BEFORE INSERT trigger
        on watchlist_items, so a malicious or buggy frontend can't bypass it.
        Lowering a user's cap below their current count doesn't remove existing items —
        they just can't add more until they un-favorite.
      </div>
    </div>
  );
}
