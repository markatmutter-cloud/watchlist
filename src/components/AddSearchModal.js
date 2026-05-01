import React from "react";
import { modalBackdrop, modalShell, modalCloseButton, modalTitleRow, modalTitle } from "../styles";

// Add-search modal — paste flow for a saved search. Mirrors
// TrackNewItemModal's UX so both "+ Track new item" and "+ Add search"
// triggers in the watch sub-tab strip behave identically (per Mark
// 2026-04-30). Edits to existing searches still happen in the inline
// editor inside WatchlistTab — this modal is only for the "new"
// case (when searchEditor.id === "new").
export function AddSearchModal({
  open, onClose,
  searchEditor, setSearchEditor,
  commitSearch,
  inp,
}) {
  if (!open) return null;
  const labelOk = (searchEditor.label || "").trim().length > 0;
  const queryOk = (searchEditor.query || "").trim().length > 0;
  const canSave = labelOk && queryOk;
  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{
        ...modalShell, maxWidth: 440,
      }}>
        <div style={modalTitleRow}>
          <div style={modalTitle}>Add search</div>
          <button onClick={onClose} aria-label="Close" style={modalCloseButton}>×</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 14, lineHeight: 1.5 }}>
          Save a name and the search terms. Run it later from
          Watchlist → Searches with one tap.
        </div>
        <input
          autoFocus
          value={searchEditor.label}
          onChange={e => setSearchEditor(ed => ({ ...ed, label: e.target.value }))}
          placeholder="Name (e.g. Speedmaster Pro)"
          style={{ ...inp, fontSize: 14, marginBottom: 8 }}
        />
        <input
          value={searchEditor.query}
          onChange={e => setSearchEditor(ed => ({ ...ed, query: e.target.value }))}
          onKeyDown={e => { if (e.key === "Enter" && canSave) commitSearch(); }}
          placeholder="Search terms (e.g. 145.022)"
          autoCapitalize="off" autoCorrect="off" spellCheck={false}
          style={{ ...inp, fontSize: 14, marginBottom: 14 }}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            border: "0.5px solid var(--border)", background: "transparent",
            color: "var(--text2)", padding: "8px 16px", borderRadius: 8,
            cursor: "pointer", fontFamily: "inherit", fontSize: 13,
          }}>Cancel</button>
          <button onClick={commitSearch} disabled={!canSave} style={{
            border: "none", background: "#185FA5", color: "#fff",
            padding: "8px 16px", borderRadius: 8, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            opacity: canSave ? 1 : 0.5,
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}
