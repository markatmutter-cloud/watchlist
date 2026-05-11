import React from "react";

// Home tab — aggregator landing accessed via the "Watchlist" wordmark.
// Three activity-grouped sections; each has a "View all →" that routes
// into the existing Listings tab's sub-tabs (live / auctions / sold).
//
// Pure presentation. App.js owns the data slicing and feature-flag
// routing; HomeTab just renders the arrays it's handed.
//
// Section headers use the same system sans as the rest of the app
// — sizing + weight set them apart from body text without changing
// the font family.

function SectionHead({ title, count, onViewAll }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      padding: "22px 20px 8px",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "var(--text1)",
        }}>{title}</span>
        {count != null && (
          <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 500 }}>
            {count}
          </span>
        )}
      </div>
      <button onClick={onViewAll}
        style={{
          fontSize: 11,
          color: "var(--text2)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontWeight: 500,
          fontFamily: "inherit",
          padding: 0,
        }}>View all →</button>
    </div>
  );
}

export function HomeTab({
  newListings,
  closingSoon,
  recentlySold,
  onViewAll,
  renderCard,
  cols = 5,
}) {
  const sections = [
    { key: "live",     title: "New listings",          data: newListings,   sub: "in the last 24h" },
    { key: "auctions", title: "Auctions closing soon", data: closingSoon,   sub: "ending in the next 48h" },
    { key: "sold",     title: "Recently sold",         data: recentlySold,  sub: "in the last 48h" },
  ];

  const populated = sections.filter(s => s.data.length > 0);

  if (populated.length === 0) {
    return (
      <div style={{ padding: "80px 20px", textAlign: "center" }}>
        <div style={{
          fontSize: 17,
          fontWeight: 600,
          color: "var(--text1)",
          letterSpacing: "-0.01em",
          marginBottom: 6,
        }}>
          Nothing new in the last 48 hours.
        </div>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>
          Check back later, or browse the{" "}
          <button onClick={() => onViewAll("live")}
            style={{
              color: "var(--brand)",
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

  // Cap each section to 2 rows so Home stays scannable. "View all →"
  // owns the rest.
  const cap = Math.max(cols * 2, 4);

  return (
    <div>
      {populated.map((section, idx) => (
        <div key={section.key}>
          <SectionHead
            title={section.title}
            count={`${section.data.length} ${section.sub}`}
            onViewAll={() => onViewAll(section.key)}
          />
          <div style={{ padding: "4px 20px 18px" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
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
            <div style={{ margin: "0 20px", borderBottom: "0.5px solid var(--border)" }} />
          )}
        </div>
      ))}
    </div>
  );
}
