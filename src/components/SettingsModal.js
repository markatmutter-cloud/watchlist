import React from "react";
import { modalBackdrop, modalShell, modalCloseButton, modalTitleRow, modalTitle } from "../styles";

// Settings — cross-device user preferences (vs theme/columns which
// live in localStorage and are per-device). v1 surface is just the
// primary display currency; future fields (default sort, notification
// opt-ins, ...) land here too as the user_settings table grows.
//
// Open/close controlled by parent (App.js). Currency change writes
// optimistically through useUserSettings — UI flips immediately,
// DB write happens in the background.
const CURRENCIES = [
  { code: "USD", label: "USD", symbol: "$" },
  { code: "GBP", label: "GBP", symbol: "£" },
  { code: "EUR", label: "EUR", symbol: "€" },
];

export function SettingsModal({ open, onClose, primaryCurrency, setPrimaryCurrency }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalShell, maxWidth: 420 }}>
        <div style={modalTitleRow}>
          <div style={modalTitle}>Settings</div>
          <button onClick={onClose} aria-label="Close" style={modalCloseButton}>×</button>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      marginTop: 6, marginBottom: 8 }}>
          Primary currency
        </div>
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
      </div>
    </div>
  );
}
