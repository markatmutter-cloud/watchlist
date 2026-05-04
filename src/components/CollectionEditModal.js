import React, { useState, useEffect } from "react";
import { modalBackdrop, modalShell, modalCloseButton, modalTitleRow, modalTitle } from "../styles";

// Create-or-rename modal for collections. Single name field; reuses
// the same component for both flows because they share UI exactly.
//
// Driven by a parent-owned `editing` state object:
//   - `null`        → modal closed
//   - { id: 'new', name: '' }       → create flow (Save dispatches createCollection)
//   - { id: '<uuid>', name: 'Foo' } → rename flow (Save dispatches renameCollection)
//
// Both dispatchers come from useCollections via props.
export function CollectionEditModal({ editing, setEditing, createCollection, renameCollection, inp }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Sync local input with the editing target. Reset error/busy on
  // each open so a previous failure doesn't bleed into the next try.
  useEffect(() => {
    if (editing) {
      setName(editing.name || "");
      setError("");
      setBusy(false);
    }
  }, [editing]);

  if (!editing) return null;

  const isNew = editing.id === "new";
  const trimmed = (name || "").trim();
  const canSave = trimmed.length > 0 && !busy;

  const close = () => setEditing(null);

  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    const res = isNew
      ? await createCollection(trimmed)
      : await renameCollection(editing.id, trimmed);
    setBusy(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setEditing(null);
  };

  return (
    <div onClick={close} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalShell, maxWidth: 380 }}>
        <div style={modalTitleRow}>
          <div style={modalTitle}>{isNew ? "New list" : "Rename list"}</div>
          <button onClick={close} aria-label="Close" style={modalCloseButton}>×</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10 }}>
          {isNew
            ? "Group watches by reference, theme, or research thread — \"Rolex 5513s\", \"Vintage divers\", \"Reference comps\"."
            : "Renaming doesn't move any items."}
        </div>
        <input
          autoFocus
          value={name}
          onChange={e => { setName(e.target.value); setError(""); }}
          onKeyDown={e => { if (e.key === "Enter" && canSave) submit(); }}
          placeholder="List name"
          autoCapitalize="words" autoCorrect="off" spellCheck={false}
          style={{ ...inp, fontSize: 14, marginBottom: 8 }}
        />
        {error && <div style={{ fontSize: 12, color: "#c0392b", marginBottom: 8 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={close} style={{
            border: "0.5px solid var(--border)", background: "transparent", color: "var(--text2)",
            padding: "8px 14px", borderRadius: 8, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13,
          }}>Cancel</button>
          <button onClick={submit} disabled={!canSave} style={{
            border: "none", background: "#185FA5", color: "#fff",
            padding: "8px 14px", borderRadius: 8, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            opacity: canSave ? 1 : 0.5,
          }}>{busy ? "Saving…" : isNew ? "Create" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
