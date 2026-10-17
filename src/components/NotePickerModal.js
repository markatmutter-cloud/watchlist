import React, { useState } from "react";
import { Modal, Button, PickRow } from "../ui";

// Note picker — opens when Lumé's save_note action fires. Drops a note into an
// existing list OR a new one (single-select: tap a list → the note saves there
// → close). Mirrors CollectionPickerModal's styling + list filter/sort +
// create-flow, but writes a collection_blocks note instead of toggling item
// membership. `noteText` is the note to save; null = closed.
export function NotePickerModal({
  noteText, setNoteText,
  collections, itemsByCollection,
  createCollection, addNote,
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (noteText == null) return null;

  const close = () => {
    setNoteText(null);
    setCreating(false);
    setNewName("");
    setError("");
  };

  const countFor = (c) => (itemsByCollection?.[c.id] || []).length;
  // Same visibility/sort as the add-to-list picker: free-form lists only,
  // most-used first (Mark 2026-05-08).
  const visible = (collections || [])
    .filter((c) => !c.isSharedInbox && !c.isSystem && c.type !== "challenge")
    .sort((a, b) => {
      const cb = countFor(b), ca = countFor(a);
      if (cb !== ca) return cb - ca;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

  const saveTo = async (collectionId) => {
    setBusy(true);
    setError("");
    const res = await addNote(collectionId, noteText);
    setBusy(false);
    if (res?.error) {
      setError(typeof res.error === "string" ? res.error : "Couldn't save the note.");
      return;
    }
    close();
  };

  const submitNew = async () => {
    const trimmed = (newName || "").trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    const created = await createCollection(trimmed);
    if (created?.error) { setBusy(false); setError(created.error); return; }
    const res = await addNote(created.id, noteText);
    setBusy(false);
    if (res?.error) { setError("Couldn't save the note."); return; }
    close();
  };

  return (
    <Modal title="Save note to a list" onClose={close} width={420}>
        {/* The note being saved. */}
        <div style={{
          fontSize: 13, color: "var(--text1)", background: "var(--card-bg)",
          border: "0.5px solid var(--border)", borderRadius: 8, padding: "8px 10px",
          marginBottom: 14, lineHeight: 1.4, maxHeight: 90, overflowY: "auto", whiteSpace: "pre-wrap",
        }}>
          {noteText}
        </div>

        {visible.length === 0 && !creating && (
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12, lineHeight: 1.5 }}>
            No lists yet. Create one to save this note.
          </div>
        )}

        <div className="ui-pickrow-list">
          {visible.map((c) => {
            const count = countFor(c);
            return (
              <PickRow key={c.id} disabled={busy} title="Save the note to this list"
                meta={`${count} item${count === 1 ? "" : "s"}`}
                onClick={() => saveTo(c.id)}>
                {c.name}
              </PickRow>
            );
          })}
        </div>

        {error && <p className="ui-modal-error">{error}</p>}

        {creating ? (
          <div className="ui-pickbox">
            <input
              autoFocus
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") submitNew(); }}
              placeholder="New list name"
              autoCapitalize="words" autoCorrect="off" spellCheck={false}
              className="ui-input"
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button small onClick={() => { setCreating(false); setNewName(""); setError(""); }}>Cancel</Button>
              <Button small primary onClick={submitNew} disabled={busy || !newName.trim()}>Create + save</Button>
            </div>
          </div>
        ) : (
          <Button block small onClick={() => setCreating(true)}>+ Create new list</Button>
        )}
    </Modal>
  );
}
