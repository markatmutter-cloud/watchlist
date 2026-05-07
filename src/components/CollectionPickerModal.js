import React, { useState } from "react";
import { modalBackdrop, modalShell, modalCloseButton, modalTitleRow, modalTitle } from "../styles";

// Picker that opens when a user taps "Add to list..." in any Card's
// "..." menu. Shows existing user-created lists (the shared-inbox is
// hidden — items land there only via the share-receive flow).
//
// 2026-05-07 multi-select redesign (Mark feedback): tap a row to
// toggle the listing in / out of that list. Modal stays open so the
// user can adjust multiple memberships in one pass. "Done" button
// dismisses. "+ Create new list" inlines a name input that creates
// and adds in one go (still single-shot since the user just made it).
//
// `target` is the listing being toggled; null = closed.
export function CollectionPickerModal({
  target, setTarget,
  collections, itemsByCollection,
  addItemToCollection, removeItemFromCollection, createCollection,
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

  // Toggle membership: add if not in the list, remove if already in.
  // Modal stays open after each toggle so the user can adjust
  // multiple lists in one pass before tapping Done.
  const toggleIn = async (collectionId, alreadyHere) => {
    setBusy(true);
    setError("");
    let res;
    if (alreadyHere) {
      // Remove uses the listing id; supabase.js resolves to rowId
      // via the local cache.
      res = removeItemFromCollection
        ? await removeItemFromCollection(collectionId, target.id)
        : { error: "remove handler missing" };
    } else {
      res = await addItemToCollection(collectionId, target);
    }
    setBusy(false);
    if (res?.error) setError(res.error);
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
                onClick={() => toggleIn(c.id, alreadyHere)}
                disabled={busy}
                title={alreadyHere ? "Tap to remove from this list" : "Tap to add to this list"}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", borderRadius: 10,
                  border: alreadyHere ? "1px solid #185FA5" : "0.5px solid var(--border)",
                  background: alreadyHere ? "rgba(24,95,165,0.08)" : "var(--card-bg)",
                  color: "var(--text1)",
                  cursor: busy ? "wait" : "pointer",
                  fontFamily: "inherit", fontSize: 14, textAlign: "left",
                  width: "100%",
                }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Checkbox-style indicator — filled when included,
                      outline when not. Tap toggles. */}
                  <span style={{
                    width: 18, height: 18, borderRadius: 4,
                    border: alreadyHere ? "none" : "1.5px solid var(--text3)",
                    background: alreadyHere ? "#185FA5" : "transparent",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {alreadyHere && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </span>
                  <span style={{ fontWeight: alreadyHere ? 600 : 500 }}>{c.name}</span>
                </span>
                <span style={{ fontSize: 12, color: "var(--text3)" }}>
                  {`${count} item${count === 1 ? "" : "s"}`}
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

        {/* Done footer — dismisses the modal after the user has
            toggled list memberships. (The modal stays open after each
            toggle so multiple lists can be adjusted in one pass.) */}
        <div style={{
          display: "flex", justifyContent: "flex-end",
          marginTop: 14,
          paddingTop: 14,
          borderTop: "0.5px solid var(--border)",
        }}>
          <button onClick={close} disabled={busy} style={{
            border: "none", background: "#185FA5", color: "#fff",
            padding: "10px 22px", borderRadius: 10, cursor: "pointer",
            fontFamily: "inherit", fontSize: 14, fontWeight: 500,
          }}>Done</button>
        </div>
      </div>
    </div>
  );
}
