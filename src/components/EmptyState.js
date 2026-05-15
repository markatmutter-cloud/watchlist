import React from "react";

// Standard empty-state / signed-out gate surface. Icon (or emoji) +
// heading + blurb + optional action node. Promoted 2026-05-08 from
// ~9 inline copies across WatchlistTab / CollectionsTab / ChallengesView
// that all used the same fontSize/padding shape with minor variations.
//
// Size variants control the vertical padding (the call sites tend to
// vary it based on whether the empty-state is a top-level signed-out
// gate vs. an in-tab empty placeholder):
//   - "compact"  — 32px vertical (in-tab emptiness, e.g. "Nothing in Sold yet")
//   - "default"  — 48px vertical (most empty-states)
//   - "tall"     — 60px vertical (top-level signed-out gates)
//
// `action` accepts any JSX node — typically a sign-in button or a
// "+ From feed" CTA. Margin between blurb and action is handled here so
// callers don't need to set marginBottom on the blurb manually.
export function EmptyState({ icon, heading, blurb, action, size = "default" }) {
  const verticalPad = size === "compact" ? 32 : size === "tall" ? 60 : 48;
  return (
    <div style={{ padding: `${verticalPad}px 20px`, textAlign: "center" }}>
      {icon != null && (
        <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      )}
      {heading && (
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: "var(--text1)" }}>
          {heading}
        </div>
      )}
      {blurb && (
        <div style={{
          fontSize: 12, color: "var(--text2)", lineHeight: 1.5,
          maxWidth: 360, margin: action ? "0 auto 18px" : "0 auto",
        }}>
          {blurb}
        </div>
      )}
      {action}
    </div>
  );
}
