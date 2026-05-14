import React, { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Auction calendar — month-banded list of every auction-house sale
// in the emitted feed. Live + upcoming render in the top section;
// past auctions land under a collapsible Archive header. Mark spec
// 2026-05-10: full list (no "Show more" preview), and past auctions
// stay in the feed indefinitely (merge.py's 30-day prune dropped) so
// the Archive section corresponds 1:1 with the sold lots in the
// listings archive view.

function fmtMonthBand(key) {
  if (key === "tbd") return "Date TBD";
  const [y, m] = key.split("-");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11) return key;
  return `${months[idx]} ${y}`;
}

// Format an ISO date ("2026-04-29") as "Apr 29". Returns null for falsy.
function fmtShortDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

// Format a sale's date range. Single-day → "Apr 29". Multi-day →
// "Apr 29 – May 13". Falls back to raw dateLabel or "Date TBD".
function fmtSaleDateRange(a) {
  const start = fmtShortDate(a.dateStart);
  const end = fmtShortDate(a.dateEnd);
  if (start && end && end !== start) return `${start} – ${end}`;
  if (start) return start;
  return a.dateLabel || "Date TBD";
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

export function AuctionCalendar({ auctions = [], onReviewCatalog }) {
  // Archive expands on demand — past auctions accumulate forever and
  // the user typically wants the upcoming view first. localStorage
  // persists the toggle so re-opens remember the user's preference.
  const [archiveOpen, setArchiveOpen] = useState(() => {
    try { return localStorage.getItem("auctions_archive_open_v1") === "1"; }
    catch { return false; }
  });
  useEffect(() => {
    try {
      localStorage.setItem("auctions_archive_open_v1", archiveOpen ? "1" : "0");
    } catch {}
  }, [archiveOpen]);

  const { upcomingAuctions, pastAuctions } = useMemo(() => {
    const upcoming = [];
    const past = [];
    for (const a of auctions) {
      (a.status === "past" ? past : upcoming).push(a);
    }
    upcoming.sort((a, b) => {
      const da = a.dateStart || "9999";
      const db = b.dateStart || "9999";
      return da.localeCompare(db) || (a.house || "").localeCompare(b.house || "");
    });
    // Past: most-recently-ended first (descending by date).
    past.sort((a, b) => {
      const da = a.dateEnd || a.dateStart || "0000";
      const db = b.dateEnd || b.dateStart || "0000";
      return db.localeCompare(da) || (a.house || "").localeCompare(b.house || "");
    });
    return { upcomingAuctions: upcoming, pastAuctions: past };
  }, [auctions]);

  const groupByMonth = (arr) => {
    const buckets = new Map();
    for (const a of arr) {
      const key = a.dateStart ? a.dateStart.slice(0, 7) : "tbd";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(a);
    }
    const keys = [...buckets.keys()];
    return { buckets, keys };
  };

  const upcomingGroups = useMemo(() => {
    const { buckets, keys } = groupByMonth(upcomingAuctions);
    keys.sort((a, b) => {
      if (a === "tbd") return 1;
      if (b === "tbd") return -1;
      return a < b ? -1 : 1;
    });
    return keys.map(key => ({ key, label: fmtMonthBand(key), items: buckets.get(key) }));
  }, [upcomingAuctions]);

  // Archive: descending by month so the most recent month is on top.
  const pastGroups = useMemo(() => {
    const { buckets, keys } = groupByMonth(pastAuctions);
    keys.sort((a, b) => {
      if (a === "tbd") return 1;
      if (b === "tbd") return -1;
      return a < b ? 1 : -1;
    });
    return keys.map(key => ({ key, label: fmtMonthBand(key), items: buckets.get(key) }));
  }, [pastAuctions]);

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
          ? `${liveCount} live now · ${upcomingCount} upcoming · ${pastAuctions.length} archived`
          : `${upcomingCount} upcoming · ${pastAuctions.length} archived`}
      </div>

      {upcomingGroups.map((group, idx) => (
        <MonthBlock key={group.key} group={group} firstBlock={idx === 0} onReviewCatalog={onReviewCatalog} />
      ))}

      {/* Archive — past auctions, collapsed by default. The same
          auctions whose lots end up in the listings Sold archive. */}
      {pastAuctions.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button onClick={() => setArchiveOpen(o => !o)}
            style={{
              all: "unset", display: "flex", alignItems: "center", gap: 10,
              width: "100%", cursor: "pointer",
              padding: "14px 14px 12px",
              borderTop: "0.5px solid var(--border)",
              borderBottom: "0.5px solid var(--border)",
              background: "var(--surface)",
            }}>
            <span aria-hidden style={{
              display: "inline-block",
              fontSize: 12, color: "var(--text3)",
              transform: archiveOpen ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 120ms ease",
              flexShrink: 0,
            }}>▶</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>Archive</span>
            <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto" }}>
              {pastAuctions.length.toLocaleString()} past auctions
            </span>
          </button>
          {archiveOpen && pastGroups.map((group, idx) => (
            <MonthBlock key={group.key} group={group} firstBlock={idx === 0} archive onReviewCatalog={onReviewCatalog} />
          ))}
        </div>
      )}
    </div>
  );
}

// One month-banded section of the calendar. Lifted from the inline
// map in 2026-05-10's calendar/Archive split — same render shape
// reused for both upcoming and past sections.
function MonthBlock({ group, firstBlock, archive = false, onReviewCatalog }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: "flex", alignItems: "baseline", gap: 12,
        padding: firstBlock ? "14px 14px 12px" : "28px 14px 12px",
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
        {group.items.map(a => (
          <AuctionRow key={a.id} a={a} archive={archive}
            onReviewCatalog={onReviewCatalog} />
        ))}
      </div>
    </div>
  );
}

// Single calendar row + ⋯ menu (Mark spec 2026-05-14). Row click =
// open the auction house's external catalog page in a new tab
// (matches the pre-2026-05-14 anchor behaviour). The ⋯ menu adds:
//   • View auction page — same external link, surfaced as an
//     explicit menu item
//   • Review catalog — opens the screening overlay on the auction's
//     lots ("Tinder swipe" through every lot in the catalog)
// Menu portals to document.body so it isn't clipped by parent
// overflow / borders, same pattern as Card.js.
function AuctionRow({ a, archive, onReviewCatalog }) {
  const isLive   = a.status === "live";
  const isClosed = a.status === "past";
  const catalogAgeDays = a.catalogLiveAt
    ? Math.floor((Date.now() - new Date(a.catalogLiveAt).getTime()) / 86400000)
    : null;
  const catalogJustOpened = !isClosed && catalogAgeDays !== null && catalogAgeDays <= 7;

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const triggerRef = useRef(null);
  const portalRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocDown = (e) => {
      const inTrigger = triggerRef.current && triggerRef.current.contains(e.target);
      const inPortal  = portalRef.current && portalRef.current.contains(e.target);
      if (!inTrigger && !inPortal) setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const openExternal = () => {
    if (a.url) window.open(a.url, "_blank", "noopener,noreferrer");
  };
  const onRowClick = (e) => {
    // Ignore clicks that originated inside the ⋯ trigger / portal.
    if (e.target.closest && e.target.closest("[data-no-row-click]")) return;
    openExternal();
  };

  return (
    <div onClick={onRowClick}
      style={{
        display: "flex", alignItems: "stretch",
        borderRadius: 12, overflow: "hidden",
        border: "0.5px solid var(--border)", background: "var(--card-bg)",
        color: "inherit", fontFamily: "inherit", cursor: "pointer",
        transition: "border-color 120ms ease",
        opacity: archive ? 0.85 : 1,
        position: "relative",
      }}>
      <AuctionDateBlock a={a} />
      <div style={{ flex: 1, minWidth: 0, padding: "12px 14px",
                  display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
            {a.house}
          </span>
          {isLive && (
            <span style={{ fontSize: 10, fontWeight: 600, color: "#fff", background: "#c43", borderRadius: 8, padding: "2px 7px", letterSpacing: "0.06em" }}>LIVE</span>
          )}
          {isClosed && (
            <span style={{ fontSize: 10, fontWeight: 600, color: "#fff", background: "#666", borderRadius: 8, padding: "2px 7px", letterSpacing: "0.06em" }}>CLOSED</span>
          )}
          {catalogJustOpened && (
            <span style={{ fontSize: 10, fontWeight: 600, color: "#fff", background: "var(--brand)", borderRadius: 8, padding: "2px 7px", letterSpacing: "0.06em" }}>NEW CATALOG</span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.title}
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {fmtSaleDateRange(a)}
          {a.location ? ` · ${a.location}` : ""}
        </div>
      </div>
      <div data-no-row-click
        style={{ display: "flex", alignItems: "center", padding: "0 6px 0 6px", flexShrink: 0 }}>
        <button ref={triggerRef}
          data-no-row-click
          aria-label="More actions"
          onClick={(e) => {
            e.stopPropagation();
            if (!menuOpen && triggerRef.current) {
              const r = triggerRef.current.getBoundingClientRect();
              setMenuPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
            }
            setMenuOpen(o => !o);
          }}
          style={{
            width: 32, height: 32, borderRadius: "50%",
            border: "none", background: menuOpen ? "var(--surface)" : "transparent",
            color: "var(--text2)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, lineHeight: 1, padding: 0,
          }}>
          ⋯
        </button>
        {menuOpen && menuPos && createPortal(
          <div ref={portalRef}
            data-no-row-click
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: menuPos.top, right: menuPos.right,
              zIndex: 1000,
              maxWidth: `calc(100vw - ${menuPos.right + 16}px)`,
              background: "var(--bg)", border: "0.5px solid var(--border)",
              borderRadius: 8, padding: 4,
              whiteSpace: "nowrap",
              boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
            }}>
            <MenuItem label="View auction page" onClick={() => {
              setMenuOpen(false);
              openExternal();
            }} />
            {onReviewCatalog && !isClosed && (
              <MenuItem label="Review catalog" onClick={() => {
                setMenuOpen(false);
                onReviewCatalog(a);
              }} />
            )}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

function MenuItem({ label, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        all: "unset", display: "block",
        padding: "8px 12px", borderRadius: 6,
        cursor: "pointer", fontSize: 13,
        color: "var(--text1)", width: "100%",
        boxSizing: "border-box",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      {label}
    </button>
  );
}
