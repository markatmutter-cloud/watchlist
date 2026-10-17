import React, { useState } from "react";
import { Modal, Button, PickRow } from "../ui";

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
  // touch it. Sort by item count (most watches first), then by
  // recency for tiebreaker (Mark feedback 2026-05-08: "change the
  // order of the lists to most watches first" — most-used lists
  // should be at the top so frequent destinations are reached
  // without scrolling).
  const countFor = (c) => (itemsByCollection?.[c.id] || []).length;
  // Hide shared inbox + hard system lists (Owned / Sold / Wishlist)
  // from the picker (2026-05-09 — Mark feedback). Those collections
  // are managed via the My Watches surface (picker / URL import /
  // mark-as-sold), not through the generic Add-to-list flow which
  // is for free-form user lists. Challenge collections also hidden
  // — they have their own purpose-built picker.
  const visible = (collections || [])
    .filter(c => !c.isSharedInbox && !c.isSystem && c.type !== "challenge")
    .sort((a, b) => {
      const cb = countFor(b), ca = countFor(a);
      if (cb !== ca) return cb - ca;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

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

  // Done lives in the pinned head (Mark 2026-06-02): with a long list it used to sit below the
  // fold. Done == close (toggles are live, so there is no separate commit), which also retires
  // the redundant x.
  return (
    <Modal title="Add to list" onClose={close} locked={busy} width={420} sheet
           headAction={<Button small primary onClick={close} disabled={busy}>Done</Button>}>
      <p className="ui-modal-note" style={{ marginTop: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {target.brand} · {target.ref || target.title || target.id}
      </p>

        {visible.length === 0 && !creating && (
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12, lineHeight: 1.5 }}>
            No lists yet. Create one to get started.
          </div>
        )}

        <div className="ui-pickrow-list">
          {visible.map(c => {
            const count = (itemsByCollection?.[c.id] || []).length;
            const alreadyHere = (itemsByCollection?.[c.id] || []).some(it => it.id === target.id);
            return (
              <PickRow key={c.id} checked={alreadyHere} disabled={busy}
                title={alreadyHere ? "Tap to remove from this list" : "Tap to add to this list"}
                meta={`${count} item${count === 1 ? "" : "s"}`}
                onClick={() => toggleIn(c.id, alreadyHere)}>
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
              onChange={e => { setNewName(e.target.value); setError(""); }}
              onKeyDown={e => { if (e.key === "Enter") submitNew(); }}
              placeholder="New list name"
              autoCapitalize="words" autoCorrect="off" spellCheck={false}
              className="ui-input"
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button small onClick={() => { setCreating(false); setNewName(""); setError(""); }}>Cancel</Button>
              <Button small primary onClick={submitNew} disabled={busy || !newName.trim()}>Create + add</Button>
            </div>
          </div>
        ) : (
          <Button block small onClick={() => setCreating(true)}>+ Create new list</Button>
        )}
    </Modal>
  );
}
