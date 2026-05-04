import React, { useState } from "react";
import { modalBackdrop, modalShell, modalCloseButton, modalTitleRow, modalTitle } from "../styles";

// Picker that opens when a user taps "Add to collection…" in any
// Card's "..." menu. Shows existing user-created collections (the
// shared-inbox is hidden from the picker — items land there only via
// the share-receive flow). Tap a row → addItemToCollection +
// dismiss. "+ New collection" inlines a name input that creates and
// adds in one go.
//
// `target` is the listing being added; null = closed.
export function CollectionPickerModal({
  target, setTarget,
  collections, itemsByCollection,
  addItemToCollection, createCollection,
  inp,
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]   = useState("");
  const [error, setError]       = useState("");
  const [busy, setBusy]         = useState(false);

  if (!target) return null;

  const close = () => {
    setTarget(null);
    setCreating(false);
    setNewName("");
    setError("");
  };

  // Hide the shared-inbox from the picker — manual adds shouldn't
  // touch it. Sort by recency (newest first) so freshly-created
  // collections sit at the top, matching what the user just made.
  const visible = (collections || [])
    .filter(c => !c.isSharedInbox)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const addTo = async (collectionId) => {
    setBusy(true);
    const res = await addItemToCollection(collectionId, target);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    close();
  };

  const submitNew = async () => {
    const trimmed = (newName || "").trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    const created = await createCollection(trimmed);
    if (created?.error) { setBusy(false); setError(created.error); return; }
    const added = await addItemToCollection(created.id, target);
    setBusy(false);
    if (added?.error) { setError(added.error); return; }
    close();
  };

  return (
    <div onClick={close} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{
        ...modalShell, maxWidth: 420, maxHeight: "75vh", overflowY: "auto",
      }}>
        <div style={modalTitleRow}>
          <div style={modalTitle}>Add to list</div>
          <button onClick={close} aria-label="Close" style={modalCloseButton}>×</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 14,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {target.brand} · {target.ref || target.title || target.id}
        </div>

        {visible.length === 0 && !creating && (
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12, lineHeight: 1.5 }}>
            No lists yet. Create one to get started.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {visible.map(c => {
            const count = (itemsByCollection?.[c.id] || []).length;
            const alreadyHere = (itemsByCollection?.[c.id] || []).some(it => it.id === target.id);
            return (
              <button
                key={c.id}
                onClick={() => !alreadyHere && addTo(c.id)}
                disabled={busy || alreadyHere}
                title={alreadyHere ? "Already in this list" : ""}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", borderRadius: 10,
                  border: "0.5px solid var(--border)",
                  background: alreadyHere ? "var(--surface)" : "var(--card-bg)",
                  color: alreadyHere ? "var(--text3)" : "var(--text1)",
                  cursor: alreadyHere ? "default" : (busy ? "wait" : "pointer"),
                  fontFamily: "inherit", fontSize: 14, textAlign: "left",
                  width: "100%",
                  opacity: alreadyHere ? 0.7 : 1,
                }}>
                <span style={{ fontWeight: 500 }}>{c.name}</span>
                <span style={{ fontSize: 12, color: "var(--text3)" }}>
                  {alreadyHere ? "already added" : `${count} item${count === 1 ? "" : "s"}`}
                </span>
              </button>
            );
          })}
        </div>

        {error && <div style={{ fontSize: 12, color: "#c0392b", marginBottom: 8 }}>{error}</div>}

        {creating ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8,
                        padding: 12, borderRadius: 10,
                        border: "0.5px solid var(--border)", background: "var(--card-bg)" }}>
            <input
              autoFocus
              value={newName}
              onChange={e => { setNewName(e.target.value); setError(""); }}
              onKeyDown={e => { if (e.key === "Enter") submitNew(); }}
              placeholder="New list name"
              autoCapitalize="words" autoCorrect="off" spellCheck={false}
              style={{ ...inp, fontSize: 14 }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setCreating(false); setNewName(""); setError(""); }} style={{
                border: "0.5px solid var(--border)", background: "transparent", color: "var(--text2)",
                padding: "6px 12px", borderRadius: 6, cursor: "pointer",
                fontFamily: "inherit", fontSize: 13,
              }}>Cancel</button>
              <button onClick={submitNew} disabled={busy || !newName.trim()} style={{
                border: "none", background: "#185FA5", color: "#fff",
                padding: "6px 12px", borderRadius: 6, cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 500,
                opacity: (!newName.trim() || busy) ? 0.5 : 1,
              }}>Create + add</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCreating(true)} style={{
            width: "100%", textAlign: "left",
            padding: "12px 14px", borderRadius: 10,
            border: "0.5px dashed var(--border)", background: "transparent",
            color: "#185FA5", cursor: "pointer",
            fontFamily: "inherit", fontSize: 14, fontWeight: 500,
          }}>+ Create new list</button>
        )}
      </div>
    </div>
  );
}
