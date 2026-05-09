import React, { useState, useEffect } from "react";

// Shared intro-banner used across Watchlist sub-tabs (Lists, Saved
// searches, My Watches, Challenges) and the Cool Stuff landing.
// Originally a JSX-returning helper inside WatchlistTab; lifted out
// 2026-05-05 so other surfaces could share the exact same shell.
//
// 2026-05-09 — added expand/collapse so the same intro can sit on
// every sub-tab without making the page jump up and down. Default
// behaviour: collapsed when the sub-tab has content, expanded when
// empty (so first-time users see the explainer; returning users get
// a tight title row they can re-expand). Mark spec.
export function SubTabIntro({
  title, blurb, actionLabel, onAction,
  // When true, the blurb hides behind a chevron toggle. Caller
  // typically passes `expandable` always true and uses
  // `defaultExpanded` to control initial state per sub-tab.
  expandable = false,
  defaultExpanded = true,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  // Re-sync when `defaultExpanded` flips (e.g. content arrives /
  // disappears under us) so the user gets the right initial state
  // for the new sub-tab.
  useEffect(() => { setExpanded(defaultExpanded); }, [defaultExpanded]);
  const showBlurb = !expandable || expanded;
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
        <button
          onClick={expandable ? () => setExpanded(e => !e) : undefined}
          disabled={!expandable}
          style={{
            all: "unset",
            display: "flex", alignItems: "center", gap: 8,
            cursor: expandable ? "pointer" : "default",
            flex: 1, minWidth: 0,
          }}>
          {expandable && (
            <span aria-hidden style={{
              display: "inline-block",
              fontSize: 11, color: "var(--text3)",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 120ms ease",
              flexShrink: 0,
            }}>▶</span>
          )}
          <span style={{
            fontSize: 13, fontWeight: 600, color: "var(--text1)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{title}</span>
        </button>
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
      {showBlurb && blurb && (
        <div style={{
          marginTop: 6,
          fontSize: 12, lineHeight: 1.5, color: "var(--text2)",
        }}>{blurb}</div>
      )}
    </div>
  );
}
