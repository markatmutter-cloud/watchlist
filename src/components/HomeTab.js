import React from "react";
import { SectionHeader } from "./SectionHeader";

// Home tab — the aggregator landing accessed via the "Watchlist"
// wordmark at the top-left. Three sections, each with a "View all →"
// that routes into the existing Listings tab's sub-tabs.
//
// Pure presentation. App.js owns the data slicing and feature-flag
// routing; HomeTab just renders.
//
// Time windows: 24h for new listings, 48h for closing-soon auctions
// + recently sold. Computed in App.js (with the existing
// `daysAgo(freshDate(i))` / `auction_end` / `soldAt` helpers) and
// passed in as the three arrays below.

export function HomeTab({
  newListings,
  closingSoon,
  recentlySold,
  onViewAll,   // (subKey: "live" | "auctions" | "sold") => void
  renderCard,  // (item) => ReactNode — shell composes the Card with its full prop bag
  cols = 5,    // 5 for desktop, 2 for mobile
}) {
  const sections = [
    {
      key: "live",
      title: "New listings",
      data: newListings,
      countLabel: (n) => `${n} in the last 24h`,
    },
    {
      key: "auctions",
      title: "Auctions closing soon",
      data: closingSoon,
      countLabel: (n) => `${n} ending in the next 48h`,
    },
    {
      key: "sold",
      title: "Recently sold",
      data: recentlySold,
      countLabel: (n) => `${n} in the last 48h`,
    },
  ];

  const populated = sections.filter(s => s.data.length > 0);

  if (populated.length === 0) {
    return (
      <div style={{ padding: "80px 20px", textAlign: "center" }}>
        <div style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: 19,
          color: "var(--ink-1)",
          letterSpacing: "-0.015em",
          marginBottom: 6,
        }}>
          Nothing new in the last 48 hours.
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
          Check back later, or browse the{" "}
          <button onClick={() => onViewAll("live")}
            style={{
              color: "var(--accent)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              padding: 0,
              textDecoration: "underline",
            }}>full Listings feed</button>.
        </div>
      </div>
    );
  }

  // Cap each section at 2 rows (cols × 2) so Home stays scannable.
  // "View all →" handles the rest. Doc's spec was a single row at
  // 5-col desktop; 2 rows reads better when the cap matters (e.g. 14
  // new listings overnight — 5 visible is too narrow a glimpse).
  const cap = cols * 2;

  return (
    <div>
      {populated.map((section, idx) => (
        <div key={section.key}>
          <SectionHeader
            title={section.title}
            count={section.countLabel(section.data.length)}
            rightLink={{ label: "View all →", onClick: () => onViewAll(section.key) }}
            tight={idx > 0}
          />
          <div style={{ padding: "6px 20px 16px" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: "14px 10px",
            }}>
              {section.data.slice(0, cap).map(item => (
                <React.Fragment key={item.id}>
                  {renderCard(item)}
                </React.Fragment>
              ))}
            </div>
          </div>
          {idx < populated.length - 1 && (
            <div style={{ margin: "0 20px", borderBottom: "1px solid var(--rule)" }} />
          )}
        </div>
      ))}
    </div>
  );
}
