import React, { useMemo, useState, useEffect } from "react";

// Auction calendar — month-banded list of upcoming + recently-closed
// auction-house sales. Lifted out of AuctionsTab.js on 2026-04-30
// when the Auctions main tab was retired and the calendar moved
// under Watchlist as a sub-tab. Self-contained: takes the auctions
// array as a prop and manages its own collapsed/expanded state via
// localStorage.

const CALENDAR_PREVIEW_COUNT = 5;

function fmtMonthBand(key) {
  if (key === "tbd") return "Date TBD";
  const [y, m] = key.split("-");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11) return key;
  return `${months[idx]} ${y}`;
}

function AuctionDateBlock({ a }) {
  if (!a.dateStart) {
    return (
      <div style={{
        width: 56, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em",
        borderRight: "0.5px solid var(--border)",
      }}>TBD</div>
    );
  }
  const d = new Date(a.dateStart);
  const day = d.getUTCDate();
  const monthAbbrev = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()];
  return (
    <div style={{
      width: 56, flexShrink: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "6px 0", borderRight: "0.5px solid var(--border)",
    }}>
      <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1, color: "var(--text1)" }}>{day}</div>
      <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4, fontWeight: 600 }}>
        {monthAbbrev}
      </div>
    </div>
  );
}

export function AuctionCalendar({ auctions = [] }) {
  const [calendarExpanded, setCalendarExpanded] = useState(() => {
    try { return localStorage.getItem("auctions_calendar_expanded_v1") === "1"; }
    catch { return false; }
  });
  useEffect(() => {
    try {
      localStorage.setItem("auctions_calendar_expanded_v1", calendarExpanded ? "1" : "0");
    } catch {}
  }, [calendarExpanded]);

  const sortedAuctions = useMemo(() => {
    const arr = auctions.slice();
    arr.sort((a, b) => {
      const da = a.dateStart || "9999";
      const db = b.dateStart || "9999";
      return da.localeCompare(db) || (a.house || "").localeCompare(b.house || "");
    });
    return arr;
  }, [auctions]);

  const visibleAuctions = useMemo(() => {
    if (calendarExpanded || sortedAuctions.length <= CALENDAR_PREVIEW_COUNT) {
      return sortedAuctions;
    }
    return sortedAuctions.slice(0, CALENDAR_PREVIEW_COUNT);
  }, [sortedAuctions, calendarExpanded]);

  const auctionGroups = useMemo(() => {
    const buckets = new Map();
    for (const a of visibleAuctions) {
      const key = a.dateStart ? a.dateStart.slice(0, 7) : "tbd";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(a);
    }
    const keys = [...buckets.keys()].sort((a, b) => {
      if (a === "tbd") return 1;
      if (b === "tbd") return -1;
      return a < b ? -1 : 1;
    });
    return keys.map(key => {
      const items = buckets.get(key);
      let label = "Date TBD";
      if (key !== "tbd") {
        const [y, m] = key.split("-").map(Number);
        label = new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
      }
      return { key, label, items };
    });
  }, [visibleAuctions]);

  const hiddenAuctionCount = sortedAuctions.length - visibleAuctions.length;
  const liveCount = auctions.filter(a => a.status === "live").length;
  const upcomingCount = auctions.filter(a => a.status === "upcoming").length;

  if (auctions.length === 0) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🔨</div>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, color: "var(--text1)" }}>No auctions on the calendar yet</div>
        <div style={{ fontSize: 12, color: "var(--text2)", maxWidth: 340, margin: "0 auto", lineHeight: 1.5 }}>
          Currently pulling from Antiquorum, Monaco Legend, Phillips, Bonhams, Christie's, and Sotheby's.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 18 }}>
        {liveCount > 0
          ? `${liveCount} live now · ${upcomingCount} upcoming`
          : `${auctions.length} upcoming`}
      </div>

      {auctionGroups.map((group, idx) => (
        <div key={group.key} style={{ marginBottom: 28 }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 12,
            padding: idx === 0 ? "14px 14px 12px" : "24px 14px 12px",
            borderBottom: "0.5px solid var(--border)",
            marginBottom: 4,
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
              {fmtMonthBand(group.key)}
            </span>
            <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto" }}>
              {group.items.length.toLocaleString()}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {group.items.map(a => {
              const isLive   = a.status === "live";
              const isClosed = a.status === "past";
              const catalogAgeDays = a.catalogLiveAt
                ? Math.floor((Date.now() - new Date(a.catalogLiveAt).getTime()) / 86400000)
                : null;
              const catalogJustOpened = !isClosed && catalogAgeDays !== null && catalogAgeDays <= 7;
              return (
                <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
                   style={{ display: "flex", alignItems: "stretch",
                           borderRadius: 12, overflow: "hidden",
                           border: "0.5px solid var(--border)", background: "var(--card-bg)",
                           textDecoration: "none", color: "inherit", fontFamily: "inherit",
                           transition: "border-color 120ms ease",
                         }}>
                  <AuctionDateBlock a={a} />
                  <div style={{ flex: 1, minWidth: 0, padding: "12px 14px",
                              display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                        {a.house}
                      </span>
                      {isLive && (
                        <span style={{ fontSize: 9, fontWeight: 600, color: "#fff", background: "#c43", borderRadius: 3, padding: "1px 6px", letterSpacing: "0.06em" }}>LIVE</span>
                      )}
                      {isClosed && (
                        <span style={{ fontSize: 9, fontWeight: 600, color: "#fff", background: "#666", borderRadius: 3, padding: "1px 6px", letterSpacing: "0.06em" }}>CLOSED</span>
                      )}
                      {catalogJustOpened && (
                        <span style={{ fontSize: 9, fontWeight: 600, color: "#fff", background: "#185FA5", borderRadius: 3, padding: "1px 6px", letterSpacing: "0.06em" }}>NEW CATALOG</span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text2)",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.dateLabel || a.dateStart || "Date TBD"}
                      {a.location ? ` · ${a.location}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", padding: "0 14px", color: "var(--text3)", flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      ))}

      {(hiddenAuctionCount > 0 || calendarExpanded) && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8, marginBottom: 4 }}>
          <button onClick={() => setCalendarExpanded(e => !e)} style={{
            border: "0.5px solid var(--border)", background: "transparent",
            color: "var(--text2)", padding: "8px 16px", borderRadius: 8,
            cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 500,
          }}>
            {calendarExpanded
              ? `Show fewer · next ${CALENDAR_PREVIEW_COUNT} only`
              : `Show all auctions · ${hiddenAuctionCount} more`}
          </button>
        </div>
      )}
    </div>
  );
}
