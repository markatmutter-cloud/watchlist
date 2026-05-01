import React from "react";
import { modalBackdrop, modalShell, modalCloseButton, modalTitleRow, modalTitle } from "../styles";

// Settings — cross-device user preferences (currency) plus per-device
// display chrome (theme, column count) and the About entry. Theme +
// columns moved here from the standalone "View" toolbar popover so the
// header stays compact (filter + avatar only).
//
// Per-device fields (theme, columns) write through useViewSettings to
// localStorage. Currency writes through useUserSettings to Supabase.
const CURRENCIES = [
  { code: "USD", label: "USD", symbol: "$" },
  { code: "GBP", label: "GBP", symbol: "£" },
  { code: "EUR", label: "EUR", symbol: "€" },
];

const sectionLabel = {
  fontSize: 11, fontWeight: 600, color: "var(--text3)",
  textTransform: "uppercase", letterSpacing: "0.06em",
  marginTop: 16, marginBottom: 8,
};

export function SettingsModal({
  open, onClose,
  primaryCurrency, setPrimaryCurrency,
  isMobile,
  dark, setDarkOverride,
  mobileCols, setMobileCols,
  desktopCols, setDesktopCols, desktopAutoCols,
  setAboutModalOpen,
}) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalShell, maxWidth: 420 }}>
        <div style={modalTitleRow}>
          <div style={modalTitle}>Settings</div>
          <button onClick={onClose} aria-label="Close" style={modalCloseButton}>×</button>
        </div>

        <div style={{ ...sectionLabel, marginTop: 6 }}>Primary currency</div>
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 12, lineHeight: 1.5 }}>
          Listings will show in this currency first, with the dealer's native price below.
          Synced across all your devices (you're welcome George Longfoot).
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CURRENCIES.map(c => {
            const active = primaryCurrency === c.code;
            return (
              <button key={c.code} onClick={() => setPrimaryCurrency(c.code)} style={{
                flex: "1 1 80px",
                padding: "10px 12px",
                borderRadius: 8,
                border: "0.5px solid var(--border)",
                background: active ? "var(--text1)" : "var(--card-bg)",
                color: active ? "var(--bg)" : "var(--text1)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13, fontWeight: active ? 600 : 500,
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 6,
              }}>
                <span style={{ fontSize: 14 }}>{c.symbol}</span>
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>

        <div style={sectionLabel}>Theme</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["light", "Light"], ["dark", "Dark"]].map(([key, lbl]) => {
            const active = (key === "dark") === dark;
            return (
              <button key={key} onClick={() => setDarkOverride(key === "dark")} style={{
                flex: 1, padding: "10px 12px", borderRadius: 8,
                border: "0.5px solid var(--border)",
                background: active ? "var(--text1)" : "var(--card-bg)",
                color: active ? "var(--bg)" : "var(--text1)",
                cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: active ? 600 : 500,
              }}>{lbl}</button>
            );
          })}
        </div>

        <div style={sectionLabel}>Columns</div>
        {isMobile ? (
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3].map(n => (
              <button key={n} onClick={() => setMobileCols(n)} style={{
                flex: 1, padding: "10px 12px", borderRadius: 8,
                border: "0.5px solid var(--border)",
                background: mobileCols === n ? "var(--text1)" : "var(--card-bg)",
                color: mobileCols === n ? "var(--bg)" : "var(--text1)",
                cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: mobileCols === n ? 600 : 500,
              }}>{n}</button>
            ))}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {["auto", 3, 4, 5, 6, 7].map(n => (
                <button key={n} onClick={() => setDesktopCols(n)} style={{
                  flex: "1 1 auto", minWidth: 44, padding: "10px 12px", borderRadius: 8,
                  border: "0.5px solid var(--border)",
                  background: desktopCols === n ? "var(--text1)" : "var(--card-bg)",
                  color: desktopCols === n ? "var(--bg)" : "var(--text1)",
                  cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: desktopCols === n ? 600 : 500,
                }}>{n === "auto" ? "Auto" : n}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>
              Auto = {desktopAutoCols} columns at this width.
            </div>
          </>
        )}

        <div style={{ height: "0.5px", background: "var(--border)", margin: "20px 0 0" }} />
        <button onClick={() => { onClose(); setAboutModalOpen(true); }} style={{
          width: "100%", textAlign: "left",
          padding: "12px 0", border: "none", background: "transparent",
          color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
          fontSize: 13,
        }}>About & Contact</button>
      </div>
    </div>
  );
}
