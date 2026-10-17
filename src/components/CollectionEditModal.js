import React, { useState, useEffect } from "react";
import { Modal, ModalNote, ModalError, ModalFoot, Input, Button } from "../ui";

// Create-or-rename modal for collections. Single name field; reuses
// the same component for both flows because they share UI exactly.
//
// Driven by a parent-owned `editing` state object:
//   - `null`        → modal closed
//   - { id: 'new', name: '' }       → create flow (Save dispatches createCollection)
//   - { id: '<uuid>', name: 'Foo' } → rename flow (Save dispatches renameCollection)
//
// Both dispatchers come from useCollections via props.
export function CollectionEditModal({ editing, setEditing, createCollection, renameCollection, onCreated }) {
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
    // Land the user INSIDE the new list, ready to add (Mark 2026-06-01).
    if (isNew && res?.id && onCreated) onCreated(res.id);
  };

  return (
    <Modal title={isNew ? "New list" : "Rename list"} onClose={close} width={380}>
      <ModalNote>
        {isNew
          ? "Group watches by reference, theme, or research thread: \"Rolex 5513s\", \"Vintage divers\", \"Reference comps\"."
          : "Renaming doesn't move any items."}
      </ModalNote>
      <Input
        autoFocus
        value={name}
        onChange={e => { setName(e.target.value); setError(""); }}
        onKeyDown={e => { if (e.key === "Enter" && canSave) submit(); }}
        placeholder="List name"
        autoCapitalize="words" autoCorrect="off" spellCheck={false}
      />
      <ModalError>{error}</ModalError>
      <ModalFoot>
        <Button small onClick={close}>Cancel</Button>
        <Button small primary onClick={submit} disabled={!canSave}>{busy ? "Saving…" : isNew ? "Create" : "Save"}</Button>
      </ModalFoot>
    </Modal>
  );
}
