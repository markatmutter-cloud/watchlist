import React, { useState, useEffect } from "react";
import { modalBackdrop, modalShell, modalCloseButton, modalTitleRow, modalTitle, inputBase, actionButton } from "../styles";

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
  user,
  displayName, setDisplayName,
  primaryCurrency, setPrimaryCurrency,
  isMobile,
  dark, setDarkOverride,
  mobileCols, setMobileCols,
  desktopCols, setDesktopCols, desktopAutoCols,
  setAboutModalOpen,
}) {
  // Local edit state for the display name. We don't write on every
  // keystroke — that would spam Supabase. Save on blur or on tap of
  // the Save button. Keeps the field reactive to upstream changes
  // (a fresh sign-in or a parallel session edit).
  const [nameDraft, setNameDraft] = useState(displayName || "");
  const [nameStatus, setNameStatus] = useState("");
  useEffect(() => { setNameDraft(displayName || ""); }, [displayName]);

  if (!open) return null;

  const persistName = async () => {
    const trimmed = (nameDraft || "").trim();
    if (!trimmed || trimmed === displayName) {
      setNameDraft(displayName || "");
      return;
    }
    setNameStatus("Saving…");
    const res = await setDisplayName(trimmed);
    setNameStatus(res?.error ? `Error: ${res.error}` : "Saved");
    setTimeout(() => setNameStatus(""), 1800);
  };

  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalShell, maxWidth: 420 }}>
        <div style={modalTitleRow}>
          <div style={modalTitle}>Settings</div>
          <button onClick={onClose} aria-label="Close" style={modalCloseButton}>×</button>
        </div>

        {/* Display name — only render for signed-in users. Used on
            shared lists (the who_added chip) and on reactions /
            journal entries. Defaults to your Google name; override
            here if you'd like a different one. */}
        {user && setDisplayName && (
          <>
            <div style={{ ...sectionLabel, marginTop: 6 }}>Display name</div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 8, lineHeight: 1.5 }}>
              How you appear to people you share lists with — on attribution chips and journal entries.
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onBlur={persistName}
                onKeyDown={e => { if (e.key === "Enter") { e.target.blur(); } }}
                maxLength={60}
                placeholder="Your name"
                style={{ ...inputBase, fontSize: 14, flex: 1 }} />
              <button onClick={persistName} disabled={(nameDraft || "").trim() === (displayName || "").trim()}
                style={{
                  ...actionButton({ variant: "primary" }),
                  opacity: (nameDraft || "").trim() === (displayName || "").trim() ? 0.4 : 1,
                }}>Save</button>
            </div>
            {nameStatus && (
              <div style={{ fontSize: 11, color: nameStatus.startsWith("Error") ? "var(--danger)" : "var(--text3)", marginTop: 4 }}>
                {nameStatus}
              </div>
            )}
          </>
        )}

        <div style={sectionLabel}>Primary currency</div>
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
        }}>About Watchlist</button>
      </div>
    </div>
  );
}
