import React from "react";

// Shared intro-banner used across Watchlist sub-tabs (Saved searches,
// Lists, Saved auctions) and the Cool Stuff landing. Originally a
// JSX-returning helper inside WatchlistTab; lifted out 2026-05-05 so
// Cool Stuff could share the exact same shell rather than re-derive
// a near-identical one.
//
// Defined as a regular component (real React.memo candidate, not a
// nested helper) so each parent render doesn't pay any unmount /
// remount cost. Pure: no internal state, no refs.
export function SubTabIntro({ title, blurb, actionLabel, onAction }) {
  return (
    <div style={{
      margin: "0 0 14px",
      padding: "12px 14px",
      borderRadius: 10,
      border: "0.5px solid var(--border)",
      background: "var(--surface)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>
          {title}
        </div>
        {actionLabel && onAction && (
          <button onClick={onAction} style={{
            fontSize: 13, fontWeight: 500,
            padding: "7px 14px", borderRadius: 8,
            border: "0.5px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text1)",
            cursor: "pointer", fontFamily: "inherit",
            flexShrink: 0, whiteSpace: "nowrap",
          }}>{actionLabel}</button>
        )}
      </div>
      {blurb && (
        <div style={{
          marginTop: 6,
          fontSize: 12, lineHeight: 1.5, color: "var(--text2)",
        }}>{blurb}</div>
      )}
    </div>
  );
}
