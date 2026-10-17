import React from "react";
import { Modal, ModalNote, ModalFoot, Input, Button } from "../ui";

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
}) {
  if (!open) return null;
  const labelOk = (searchEditor.label || "").trim().length > 0;
  const queryOk = (searchEditor.query || "").trim().length > 0;
  const canSave = labelOk && queryOk;
  return (
    <Modal title="Add search" onClose={onClose} width={440}>
      <ModalNote>
        Save a name and the search terms. Run it later from
        Saved → Searches with one tap.
      </ModalNote>
      <Input
        autoFocus
        value={searchEditor.label}
        onChange={e => setSearchEditor(ed => ({ ...ed, label: e.target.value }))}
        placeholder="Name (e.g. Speedmaster Pro)"
      />
      <Input
        value={searchEditor.query}
        onChange={e => setSearchEditor(ed => ({ ...ed, query: e.target.value }))}
        onKeyDown={e => { if (e.key === "Enter" && canSave) commitSearch(); }}
        placeholder="Search terms (e.g. 145.022)"
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
      />
      {/* Optional price guard. Both fields nullable; leaving them empty saves a search with no $
          filter (Mark 2026-05-08: the modal used to have no way to save "Speedmaster pro under $5k"). */}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Input type="number" min="0" inputMode="numeric"
          value={searchEditor.minPrice ?? ""}
          onChange={e => setSearchEditor(ed => ({ ...ed, minPrice: e.target.value }))}
          placeholder="$ Min" />
        <Input type="number" min="0" inputMode="numeric"
          value={searchEditor.maxPrice ?? ""}
          onChange={e => setSearchEditor(ed => ({ ...ed, maxPrice: e.target.value }))}
          placeholder="$ Max" />
      </div>
      <ModalFoot>
        <Button small onClick={onClose}>Cancel</Button>
        <Button small primary onClick={commitSearch} disabled={!canSave}>Save</Button>
      </ModalFoot>
    </Modal>
  );
}
