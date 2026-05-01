import React from "react";
import { modalBackdrop, modalShell, modalCloseButton, modalTitleRow, modalTitle } from "../styles";

// Save-search prompt — appears when the user taps the heart in the
// search bar. Asks for an optional friendly label before persisting
// to Supabase. Lifted out of App.js on 2026-04-30 (was an inline JSX
// const). Submit/cancel handlers and label state owned by parent.
export function FavSearchModal({
  open, setOpen,
  search,
  label, setLabel,
  error, setError,
  submit,
  inp,
}) {
  if (!open) return null;
  return (
    <div onClick={() => setOpen(false)} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{
        ...modalShell, maxWidth: 380,
      }}>
        <div style={modalTitleRow}>
          <div style={modalTitle}>Save search</div>
          <button onClick={() => setOpen(false)} aria-label="Close" style={modalCloseButton}>×</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10 }}>
          Saving "<b>{search}</b>" — find it again from Watchlist → Searches.
        </div>
        <input
          autoFocus
          value={label}
          onChange={e => { setLabel(e.target.value); setError(""); }}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          placeholder="Name (e.g. Speedmaster pro)"
          style={{ ...inp, fontSize: 14, marginBottom: 8 }}
        />
        {error && (
          <div style={{ fontSize: 12, color: "#c0392b", marginBottom: 8 }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => setOpen(false)} style={{
            border: "0.5px solid var(--border)", background: "transparent", color: "var(--text2)",
            padding: "8px 14px", borderRadius: 8, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13,
          }}>Cancel</button>
          <button onClick={submit} disabled={!label.trim()} style={{
            border: "none", background: "#185FA5", color: "#fff",
            padding: "8px 14px", borderRadius: 8, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            opacity: label.trim() ? 1 : 0.5,
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}
