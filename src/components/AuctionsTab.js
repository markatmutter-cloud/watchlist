import React, { useMemo, useState, useEffect } from "react";
import { imgSrc } from "../utils";

// ── PURE HELPERS ─────────────────────────────────────────────────────────

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

// Friendly relative-time label like "3 days left" / "6 hours left" /
// "ended 2 days ago". Used by tracked-lot cards.
function fmtCountdown(endIso) {
  if (!endIso) return "";
  const ms = new Date(endIso).getTime() - Date.now();
  const past = ms < 0;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const mins = Math.floor((abs % 3600000) / 60000);
  let label;
  if (days >= 1) label = `${days} day${days === 1 ? "" : "s"}`;
  else if (hours >= 1) label = `${hours} hour${hours === 1 ? "" : "s"}`;
  else label = `${mins} min${mins === 1 ? "" : "s"}`;
  return past ? `ended ${label} ago` : `${label} left`;
}

function fmtLotPrice(val, currency) {
  if (val === null || val === undefined || val === "") return null;
  const n = typeof val === "number" ? val : parseFloat(val);
  if (Number.isNaN(n)) return null;
  return `${currency || ""} ${Math.round(n).toLocaleString()}`.trim();
}

function lotIsPast(lot) {
  if (lot.sold_price !== null && lot.sold_price !== undefined && lot.sold_price !== "") return true;
  if (!lot.auction_end) return false;
  return new Date(lot.auction_end).getTime() < Date.now();
}

// Compact date block on the left side of each auction card.
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

// ── MAIN COMPONENT ───────────────────────────────────────────────────────

export function AuctionsTab(props) {
  const {
    auctions,
    // Tracked-lots — moved here from the Watchlist tab.
    user, signInWithGoogle, isAuthConfigured,
    trackedLots = [], addTrackedLot, removeTrackedLot,
    statusMode, compact, gridStyle, inp,
  } = props;

  // ── SUB-TAB ────────────────────────────────────────────────────────────
  // Two sections live under Auctions: the user's tracked lots and the
  // calendar of upcoming sales. Tracked lots is the default — it's
  // personal data and the more frequent destination once a user has
  // started following lots.
  const [auctionSubtab, setAuctionSubtab] = useState(() => {
    try { return localStorage.getItem("auctions_subtab_v1") || "tracked"; }
    catch { return "tracked"; }
  });
  useEffect(() => {
    try { localStorage.setItem("auctions_subtab_v1", auctionSubtab); } catch {}
  }, [auctionSubtab]);

  // ── AUCTION CALENDAR ───────────────────────────────────────────────────
  // Collapsed by default to keep the page scannable; expand reveals
  // every upcoming sale grouped by month. Persisted across visits so
  // Mark's preference (collapsed vs expanded) sticks.
  const CALENDAR_PREVIEW_COUNT = 5;
  const [calendarExpanded, setCalendarExpanded] = useState(() => {
    try { return localStorage.getItem("auctions_calendar_expanded_v1") === "1"; }
    catch { return false; }
  });
  useEffect(() => {
    try {
      localStorage.setItem("auctions_calendar_expanded_v1", calendarExpanded ? "1" : "0");
    } catch {}
  }, [calendarExpanded]);

  // Date-sorted flat list of all upcoming auctions. Used to slice the
  // first N for the collapsed preview.
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
      const items = buckets.get(key);   // already date-sorted from sortedAuctions
      let label = "Date TBD";
      if (key !== "tbd") {
        const [y, m] = key.split("-").map(Number);
        label = new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
      }
      return { key, label, items };
    });
  }, [visibleAuctions]);

  const hiddenAuctionCount = sortedAuctions.length - visibleAuctions.length;

  // ── TRACKED LOTS ───────────────────────────────────────────────────────
  const [addLotOpen, setAddLotOpen] = useState(false);
  const [lotInputUrl, setLotInputUrl] = useState("");
  const [lotInputBusy, setLotInputBusy] = useState(false);
  const [lotInputError, setLotInputError] = useState("");

  const submitTrackedLot = async () => {
    if (!lotInputUrl.trim() || !addTrackedLot) return;
    setLotInputBusy(true);
    setLotInputError("");
    const { error } = await addTrackedLot(lotInputUrl);
    setLotInputBusy(false);
    if (error) setLotInputError(error);
    else { setLotInputUrl(""); setAddLotOpen(false); }
  };

  const trackedLotsUpcoming = useMemo(
    () => trackedLots.filter(l => !lotIsPast(l)), [trackedLots]
  );
  const trackedLotsPast = useMemo(
    () => trackedLots.filter(l => lotIsPast(l)), [trackedLots]
  );

  // Status filter (live=upcoming, sold=past, all=both) drives which lots
  // show. Mirrors the global statusMode pill.
  const lotsView =
    statusMode === "sold" ? trackedLotsPast :
    statusMode === "all"  ? [...trackedLotsUpcoming, ...trackedLotsPast] :
                            trackedLotsUpcoming;

  const renderLotCard = (lot) => {
    const isPending = !!lot._pending;
    const isPast = !isPending && lotIsPast(lot);
    const sold = !isPending && lot.sold_price !== null && lot.sold_price !== undefined && lot.sold_price !== "";
    const currentBid = lot.current_bid;
    const showUsd = lot.currency && lot.currency.toUpperCase() !== "USD";

    const primaryNative = isPending ? "—"
      : sold ? fmtLotPrice(lot.sold_price, lot.currency)
      : (currentBid !== null && currentBid !== undefined && currentBid !== ""
          ? fmtLotPrice(currentBid, lot.currency)
          : (lot.starting_price !== null && lot.starting_price !== undefined
              ? fmtLotPrice(lot.starting_price, lot.currency)
              : "—"));
    const primaryLabel = isPending ? "Pending"
      : sold ? "HAMMER"
      : "CURRENT";
    const primaryUsd = !isPending && showUsd && (
      sold ? lot.sold_price_usd
        : (currentBid !== null && currentBid !== undefined && currentBid !== ""
           ? lot.current_bid_usd
           : lot.starting_price_usd)
    );
    const estimateLow = fmtLotPrice(lot.estimate_low, lot.currency);
    const estimateHigh = fmtLotPrice(lot.estimate_high, lot.currency);
    const estimateLine = (estimateLow && estimateHigh) ? `Est. ${estimateLow}–${estimateHigh}` : null;

    const countdownLabel = lot.auction_end ? fmtCountdown(lot.auction_end) : null;
    const countdownColor = isPast ? "rgba(0,0,0,0.55)" : "rgba(24,95,165,0.92)";

    return (
      <div key={lot.url} style={{
        background: "var(--card-bg)", display: "flex", flexDirection: "column",
        position: "relative", minWidth: 0, overflow: "hidden",
      }}>
        <a href={lot.url} target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column" }}>
          <div style={{ position: "relative", paddingTop: "100%", overflow: "hidden", background: "var(--surface)" }}>
            {lot.image && (
              <img src={imgSrc(lot.image)} alt={lot.title || ""}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                loading="lazy" />
            )}
            {sold ? (
              <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.06em" }}>SOLD</div>
            ) : countdownLabel ? (
              <div style={{ position: "absolute", top: 6, left: 6, background: countdownColor, color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.04em", fontWeight: 600 }}>
                {isPast ? "ENDED" : countdownLabel.toUpperCase()}
              </div>
            ) : isPending ? (
              <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.06em" }}>PENDING</div>
            ) : null}
          </div>
          <div style={{ padding: compact ? "5px 7px 8px" : "7px 9px 10px" }}>
            <div style={{ fontSize: compact ? 8 : 9, color: "var(--text3)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {lot.house || "—"}{lot.lot_number ? ` · Lot ${lot.lot_number}` : ""}
            </div>
            <div style={{ fontSize: compact ? 10 : 12, fontWeight: 500, lineHeight: 1.3, marginBottom: 4, color: "var(--text1)",
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: compact ? 26 : 32 }}>
              {lot.title || (isPending ? "Fetching…" : "—")}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 8, color: "var(--text3)", letterSpacing: "0.05em", fontWeight: 600 }}>{primaryLabel}</span>
              <span style={{ fontSize: compact ? 11 : 13, fontWeight: 500, color: sold ? "#1b8f3a" : "var(--text1)" }}>{primaryNative}</span>
            </div>
            <div style={{ fontSize: 9, color: "var(--text3)", minHeight: 12 }}>
              {primaryUsd ? `~$${Math.round(primaryUsd).toLocaleString()}` : (estimateLine || " ")}
            </div>
          </div>
        </a>
        <button onClick={() => removeTrackedLot && removeTrackedLot(lot.url)} aria-label="Stop tracking" title="Stop tracking"
          style={{
            position: "absolute", top: 6, right: 6,
            width: 22, height: 22, borderRadius: "50%",
            background: "rgba(255,255,255,0.92)", border: "none", cursor: "pointer",
            color: "#444", fontSize: 14, lineHeight: 1, padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
          }}>×</button>
      </div>
    );
  };

  // ── RENDER ─────────────────────────────────────────────────────────────

  // Tracked-lots section JSX. Standalone now — lives under its own
  // sub-tab, so the previous top-border/padding (which separated it
  // from the calendar above) is gone.
  const trackedLotsJSX = (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
            Tracked lots
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
            {!user ? "Sign in to track lots from Antiquorum, Christie's, Sotheby's, Monaco Legend, and Phillips"
              : trackedLots.length === 0 ? "Paste a lot URL to follow it through to hammer"
              : statusMode === "sold" ? `${trackedLotsPast.length} past`
              : statusMode === "all"  ? `${trackedLotsUpcoming.length} upcoming · ${trackedLotsPast.length} past`
              :                          `${trackedLotsUpcoming.length} upcoming`}
          </div>
        </div>
        {user && (
          <button onClick={() => { setAddLotOpen(o => !o); setLotInputError(""); }} style={{
            border: "0.5px solid var(--border)", background: addLotOpen ? "var(--text1)" : "var(--card-bg)",
            color: addLotOpen ? "var(--bg)" : "var(--text1)",
            padding: "5px 12px", borderRadius: 8, cursor: "pointer",
            fontFamily: "inherit", fontSize: 12,
          }}>{addLotOpen ? "Cancel" : "+ Track lot"}</button>
        )}
        {!user && isAuthConfigured && (
          <button onClick={signInWithGoogle} style={{
            border: "0.5px solid var(--border)", background: "var(--card-bg)", color: "var(--text1)",
            padding: "5px 12px", borderRadius: 8, cursor: "pointer",
            fontFamily: "inherit", fontSize: 12, fontWeight: 500,
          }}>Sign in</button>
        )}
      </div>

      {addLotOpen && (
        <div style={{
          border: "0.5px solid var(--border)", borderRadius: 12,
          background: "var(--card-bg)", padding: 10, marginBottom: 14,
        }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              autoFocus
              value={lotInputUrl}
              onChange={e => { setLotInputUrl(e.target.value); setLotInputError(""); }}
              onKeyDown={e => { if (e.key === "Enter") submitTrackedLot(); }}
              placeholder="Paste an Antiquorum, Christie's, Sotheby's, Monaco Legend, or Phillips lot URL…"
              style={{ ...inp, flex: 1, fontSize: 13 }}
            />
            <button onClick={submitTrackedLot} disabled={lotInputBusy || !lotInputUrl.trim()} style={{
              border: "none", background: "#185FA5", color: "#fff",
              padding: "8px 14px", borderRadius: 6, cursor: "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: 500,
              opacity: (lotInputBusy || !lotInputUrl.trim()) ? 0.5 : 1,
            }}>{lotInputBusy ? "Adding…" : "Track"}</button>
          </div>
          {lotInputError && (
            <div style={{ fontSize: 11, color: "#c0392b", marginTop: 6 }}>{lotInputError}</div>
          )}
          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 6 }}>
            Antiquorum (<span style={{ fontFamily: "monospace" }}>live.antiquorum.swiss/lots/view/…</span> or <span style={{ fontFamily: "monospace" }}>catalog.antiquorum.swiss/en/lots/…</span>),
            Christie's (<span style={{ fontFamily: "monospace" }}>christies.com/…/lot/lot-NNN</span>),
            Sotheby's (<span style={{ fontFamily: "monospace" }}>sothebys.com/en/buy/auction/YYYY/…</span>),
            Monaco Legend (<span style={{ fontFamily: "monospace" }}>monacolegendauctions.com/auction/&lt;slug&gt;/lot-NNN</span>),
            or Phillips (<span style={{ fontFamily: "monospace" }}>phillips.com/detail/&lt;brand&gt;/&lt;id&gt;</span>).
          </div>
        </div>
      )}

      {user && trackedLots.length > 0 && (
        <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
          {lotsView.map(renderLotCard)}
          {lotsView.length === 0 && (
            <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
              {statusMode === "sold" ? "No past lots yet."
                : statusMode === "all" ? "No tracked lots yet."
                : "No upcoming lots."}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const liveCount = auctions.filter(a => a.status === "live").length;
  const upcomingCount = auctions.filter(a => a.status === "upcoming").length;

  // Calendar section JSX. Empty-state replaces the body when there are
  // no auctions yet — the sub-tab strip stays visible so users can still
  // jump to Tracked lots.
  const calendarSectionJSX = auctions.length === 0 ? (
    <div style={{ padding: "60px 0", textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>🔨</div>
      <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No auctions on the calendar yet</div>
      <div style={{ fontSize: 12, color: "var(--text2)", maxWidth: 340, margin: "0 auto", lineHeight: 1.5 }}>
        Currently pulling from Antiquorum, Monaco Legend, Phillips, Bonhams, Christie's, and Sotheby's.
      </div>
    </div>
  ) : (
    <div>
      <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 18 }}>
        {liveCount > 0
          ? `${liveCount} live now · ${upcomingCount} upcoming`
          : `${auctions.length} upcoming`}
      </div>

      {auctionGroups.map(group => (
        <div key={group.key} style={{ marginBottom: 28 }}>
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
              const isLive   = a.status === "live";
              const isClosed = a.status === "past";
              const catalogAgeDays = a.catalogLiveAt
                ? Math.floor((Date.now() - new Date(a.catalogLiveAt).getTime()) / 86400000)
                : null;
              // Don't show NEW CATALOG on closed auctions — the chip
              // is irrelevant once bidding has ended.
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

  return (
    <div>
      {/* Sub-tabs: Tracked lots (default) + Calendar. Mirrors the
          Watchlist tab's Listings/Searches sub-tab pattern. */}
      <div style={{
        display: "flex", marginBottom: 14,
        paddingBottom: 4,
        borderBottom: "0.5px solid var(--border)",
      }}>
        {[
          ["tracked",  `Tracked lots${trackedLots.length > 0 ? ` · ${trackedLots.length}` : ""}`],
          ["calendar", `Calendar${auctions.length > 0 ? ` · ${auctions.length}` : ""}`],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setAuctionSubtab(key)} style={{
            padding: "6px 0", marginRight: 18, border: "none", cursor: "pointer",
            background: "transparent", fontFamily: "inherit", fontSize: 14,
            color: auctionSubtab === key ? "var(--text1)" : "var(--text3)",
            fontWeight: auctionSubtab === key ? 600 : 400,
            borderBottom: auctionSubtab === key ? "2px solid var(--text1)" : "2px solid transparent",
          }}>{label}</button>
        ))}
      </div>

      {auctionSubtab === "tracked" ? trackedLotsJSX : calendarSectionJSX}
    </div>
  );
}
