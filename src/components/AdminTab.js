import React, { useEffect, useMemo, useState } from "react";

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
    bad:  { color: "#c0392b", glyph: "●", label: "Prune candidate" },
    ok:   { color: "#1f9d4f", glyph: "✓", label: "Healthy" },
    warn: { color: "#c9a227", glyph: "⚠", label: "Warning" },
    error:{ color: "#c0392b", glyph: "✗", label: "Error" },
  };
  const c = map[kind] || map.meh;
  return (
    <span title={c.label} style={{ color: c.color, fontWeight: 600 }}>{c.glyph}</span>
  );
}

const COLUMNS = [
  { key: "source",      label: "Source",      align: "left",  fmt: (r) => r.source },
  { key: "live",        label: "Live",        align: "right", fmt: (r) => r.live.toLocaleString() },
  { key: "newPerWeek",  label: "New/wk",      align: "right", fmt: (r) => r.newPerWeek.toFixed(1) },
  { key: "trend",       label: "Trend (14d)", align: "left",  fmt: (r) => <Sparkline values={r.trend} /> },
  { key: "daysStale",   label: "Stale",       align: "right", fmt: (r) => r.daysStale >= 999 ? "—" : `${r.daysStale}d` },
  { key: "hearts",      label: "♥",           align: "right", fmt: (r) => r.hearts.toLocaleString() },
  { key: "heartRate",   label: "♥ %",         align: "right", fmt: (r) => r.heartRate ? `${(r.heartRate*100).toFixed(1)}%` : "—" },
  { key: "hides",       label: "✕",           align: "right", fmt: (r) => r.hides.toLocaleString() },
  { key: "hideRate",    label: "✕ %",         align: "right", fmt: (r) => r.hideRate ? `${(r.hideRate*100).toFixed(1)}%` : "—" },
  { key: "avgPrice",    label: "Avg $",       align: "right", fmt: (r) => r.avgPrice ? `$${(r.avgPrice/1000).toFixed(1)}K` : "—" },
  { key: "topBrand",    label: "Top brand",   align: "left",  fmt: (r) => r.topBrand ? `${r.topBrand} ${(r.topBrandPct*100).toFixed(0)}%` : "—" },
  { key: "health",      label: "Health",      align: "center",fmt: (r) => <ChipDot kind={r.health} /> },
  { key: "earning",     label: "Earning?",    align: "center",fmt: (r) => <ChipDot kind={r.earning} /> },
];

export function AdminTab({ watchItems, hiddenItems }) {
  const [verification, setVerification] = useState(null);
  const [history, setHistory] = useState([]);
  const [listings, setListings] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [sort, setSort] = useState({ key: "earning", dir: "desc" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/verification.json").then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/verification_history.json").then((r) => r.ok ? r.json() : { history: [] }).catch(() => ({ history: [] })),
      fetch("/listings.json").then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([v, h, l]) => {
      if (cancelled) return;
      setVerification(v);
      setHistory((h && h.history) || []);
      setListings(l);
    }).catch((e) => {
      if (!cancelled) setLoadError(String(e));
    });
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => {
    if (!listings.length) return [];

    const today = new Date();
    const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;
    const DAY_MS = 86400000;

    const bySource = new Map();
    for (const it of listings) {
      const s = it.source || "?";
      if (!bySource.has(s)) {
        bySource.set(s, { live: 0, prices: [], brands: new Map(), newRecent: 0, latestFirstSeen: "" });
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
      const agg = bySource.get(src) || { live: 0, prices: [], brands: new Map(), newRecent: 0, latestFirstSeen: "" };
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

      out.push({
        source: src, live: agg.live, newPerWeek, daysStale, hearts, heartRate, hides, hideRate,
        avgPrice: median, topBrand, topBrandPct, trend, health, earning, alert,
      });
    }
    return out;
  }, [listings, history, verification, watchItems, hiddenItems]);

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
          border: "0.5px solid #c0392b",
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
        <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>
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
      </div>
    </div>
  );
}
