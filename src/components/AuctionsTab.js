import React, { useMemo } from "react";

// Pretty month-band heading: turn "2026-05" into "May 2026". Falls
// through gracefully on the synthetic "tbd" key.
function fmtMonthBand(key) {
  if (key === "tbd") return "Date TBD";
  const [y, m] = key.split("-");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11) return key;
  return `${months[idx]} ${y}`;
}

// Compact date block on the left side of each auction card. Renders the
// start day large with the month abbreviation under it (calendar
// affordance). For "Date TBD" entries shows a small placeholder.
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

export function AuctionsTab({ auctions }) {
  const auctionGroups = useMemo(() => {
    const buckets = new Map();
    for (const a of auctions) {
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
      const items = buckets.get(key).slice().sort((a, b) =>
        (a.dateStart || "").localeCompare(b.dateStart || "") ||
        a.house.localeCompare(b.house)
      );
      let label = "Date TBD";
      if (key !== "tbd") {
        const [y, m] = key.split("-").map(Number);
        label = new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
      }
      return { key, label, items };
    });
  }, [auctions]);

  if (auctions.length === 0) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🔨</div>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No auctions on the calendar yet</div>
        <div style={{ fontSize: 12, color: "var(--text2)", maxWidth: 340, margin: "0 auto", lineHeight: 1.5 }}>
          Currently pulling from Antiquorum, Monaco Legend, Phillips, and Bonhams. Christie's, Sotheby's, Loupe This and Watches of Knightsbridge are on the roadmap.
        </div>
      </div>
    );
  }

  const liveCount = auctions.filter(a => a.status === "live").length;
  const upcomingCount = auctions.filter(a => a.status === "upcoming").length;

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 18 }}>
        {liveCount > 0
          ? `${liveCount} live now · ${upcomingCount} upcoming`
          : `${auctions.length} upcoming`}
      </div>

      {auctionGroups.map(group => (
        <div key={group.key} style={{ marginBottom: 28 }}>
          {/* Month band — sentence case, tier-1 weight to read like a
              section heading rather than a chip. */}
          <div style={{
            display: "flex", alignItems: "baseline", gap: 12,
            padding: "0 4px 10px", marginBottom: 10,
            borderBottom: "0.5px solid var(--border)",
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
              {fmtMonthBand(group.key)}
            </span>
            <span style={{ fontSize: 11, color: "var(--text3)", marginLeft: "auto" }}>
              {group.items.length}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {group.items.map(a => {
              const isLive = a.status === "live";
              const catalogAgeDays = a.catalogLiveAt
                ? Math.floor((Date.now() - new Date(a.catalogLiveAt).getTime()) / 86400000)
                : null;
              const catalogJustOpened = catalogAgeDays !== null && catalogAgeDays <= 7;
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

      <div style={{ marginTop: 24, padding: "14px 16px", borderRadius: 12, border: "0.5px dashed var(--border)" }}>
        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--text1)" }}>Coming in future updates:</strong> Christie's, Sotheby's, Watches of Knightsbridge auctions, Loupe This. Lot-level catalogue browsing and watched-lot price tracking are also on the list.
        </div>
      </div>
    </div>
  );
}
