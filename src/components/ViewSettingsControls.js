import React from "react";

// Compact view-settings controls — currency / theme / columns. Lives
// outside SettingsModal so we can render the same fields in two
// in-flow surfaces (mobile filter tray + desktop account menu)
// without duplicating logic.
//
// User feedback 2026-05-09: the standalone Settings modal hid these
// behind one too many taps. Currency in particular is something you
// adjust while comparing prices — having to leave the filter you're
// using to swap currencies broke flow.
//
// All three values still write through useViewSettings (per-device,
// localStorage) and useUserSettings (currency, cross-device Supabase).
// This component is a pure render of those getters/setters.
//
// `compact` prop tightens vertical rhythm for the desktop account-
// menu surface; mobile filter-tray uses the default loose spacing
// (touch targets read better with breathing room).

const CURRENCIES = [
  { code: "USD", label: "USD", symbol: "$" },
  { code: "GBP", label: "GBP", symbol: "£" },
  { code: "EUR", label: "EUR", symbol: "€" },
];

const sectionLabel = (compact) => ({
  fontSize: 11, fontWeight: 600, color: "var(--text3)",
  textTransform: "uppercase", letterSpacing: "0.06em",
  marginTop: compact ? 10 : 14, marginBottom: 6,
});

const segmentBtn = (active, compact) => ({
  flex: "1 1 auto",
  minWidth: 44,
  padding: compact ? "7px 10px" : "10px 12px",
  borderRadius: 8,
  border: "0.5px solid var(--border)",
  background: active ? "var(--text1)" : "var(--card-bg)",
  color: active ? "var(--bg)" : "var(--text1)",
  cursor: "pointer", fontFamily: "inherit",
  fontSize: compact ? 12 : 13,
  fontWeight: active ? 600 : 500,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
});

export function ViewSettingsControls({
  primaryCurrency, setPrimaryCurrency,
  isMobile,
  dark, setDarkOverride,
  mobileCols, setMobileCols,
  desktopCols, setDesktopCols, desktopAutoCols,
  // `compact` tightens vertical spacing for the desktop dropdown
  // surface. Mobile filter tray uses default loose rhythm.
  compact = false,
}) {
  return (
    <div>
      <div style={sectionLabel(compact)}>Currency</div>
      <div style={{ display: "flex", gap: 6 }}>
        {CURRENCIES.map(c => {
          const active = primaryCurrency === c.code;
          return (
            <button key={c.code} onClick={() => setPrimaryCurrency(c.code)}
              style={segmentBtn(active, compact)}>
              <span>{c.symbol}</span>
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>

      <div style={sectionLabel(compact)}>Theme</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[["light", "Light"], ["dark", "Dark"]].map(([key, lbl]) => {
          const active = (key === "dark") === dark;
          return (
            <button key={key} onClick={() => setDarkOverride(key === "dark")}
              style={segmentBtn(active, compact)}>{lbl}</button>
          );
        })}
      </div>

      <div style={sectionLabel(compact)}>Columns</div>
      {isMobile ? (
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3].map(n => (
            <button key={n} onClick={() => setMobileCols(n)}
              style={segmentBtn(mobileCols === n, compact)}>{n}</button>
          ))}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["auto", 3, 4, 5, 6, 7].map(n => (
              <button key={n} onClick={() => setDesktopCols(n)}
                style={segmentBtn(desktopCols === n, compact)}>
                {n === "auto" ? "Auto" : n}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>
            Auto = {desktopAutoCols} columns at this width.
          </div>
        </>
      )}
    </div>
  );
}
