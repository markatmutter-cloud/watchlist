import React, { useState } from "react";

// User-limit banner. Surfaces the cap state to the user so they can
// react before (or after) hitting the wall:
//   - Soft warn (count >= 80% of cap): blue banner, "heads up".
//   - Hard cap (count >= cap): red banner, "email Mark to expand".
// Renders nothing below the soft-warn threshold to avoid clutter
// for normal users.
//
// Self-contained — no hooks beyond a single dismissable boolean —
// so mounting unconditionally from App.js doesn't add to its
// already-fragile hook count (CLAUDE.md "Things to never do").

const ADMIN_EMAIL_DEFAULT = "mark@the-watch-list.app";

export function UserLimitBanner({ count, cap, isAtSoftWarn, isAtHardCap }) {
  const [dismissed, setDismissed] = useState(false);
  if (!cap) return null;
  if (!isAtSoftWarn && !isAtHardCap) return null;
  // Hard cap can't be dismissed — the user genuinely can't add more
  // until they un-favorite or get an expansion. Soft warn can.
  if (dismissed && !isAtHardCap) return null;

  const tone = isAtHardCap ? "hard" : "soft";
  const palette = tone === "hard"
    ? { bg: "rgba(192, 57, 43, 0.10)", border: "#c0392b", text: "#7d1f17" }
    : { bg: "rgba(31, 90, 159, 0.08)", border: "#1f5a9f", text: "#1f5a9f" };

  const adminEmail = (typeof window !== "undefined" && window.__WATCHLIST_ADMIN_EMAIL__)
    || ADMIN_EMAIL_DEFAULT;
  const mailto = `mailto:${adminEmail}?subject=${encodeURIComponent("Watchlist: request more capacity")}&body=${encodeURIComponent(
    `Hi Mark,\n\nI've reached my Watchlist limit (${count} / ${cap}). Could you expand my cap?\n\nThanks.`
  )}`;

  return (
    <div role="status" style={{
      position: "fixed",
      // Sit above the mobile bottom-tab bar (which is ~64px) and
      // above the desktop content. z-index high enough to overlay
      // dropdowns + filter rail without competing with modals.
      bottom: 80, left: "50%", transform: "translateX(-50%)",
      maxWidth: 480, width: "calc(100% - 24px)",
      zIndex: 9000,
      borderRadius: 8,
      background: palette.bg,
      border: `0.5px solid ${palette.border}`,
      color: palette.text,
      padding: "10px 14px",
      fontSize: 13,
      lineHeight: 1.45,
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
      boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
    }}>
      <div style={{ flex: 1 }}>
        {tone === "hard" ? (
          <>
            <strong style={{ fontWeight: 600 }}>You've hit your Watchlist limit ({count} / {cap}).</strong>
            <br />
            Un-favorite something to make room, or{" "}
            <a href={mailto} style={{ color: palette.border, textDecoration: "underline" }}>
              email Mark to request an expansion
            </a>.
          </>
        ) : (
          <>
            <strong style={{ fontWeight: 600 }}>Heads up — you've saved {count} of {cap} watches.</strong>
            {" "}When you hit {cap} the heart button will be blocked until you un-favorite or get an expansion.
          </>
        )}
      </div>
      {!isAtHardCap && (
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{
            background: "transparent", border: "none",
            color: palette.text, cursor: "pointer",
            fontSize: 18, lineHeight: 1, padding: 0, marginLeft: 4,
          }}
        >×</button>
      )}
    </div>
  );
}
