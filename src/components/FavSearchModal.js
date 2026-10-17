import React from "react";
import { Modal, ModalNote, ModalError, ModalFoot, Input, Button } from "../ui";

// Save-search prompt — appears when the user taps the heart in the
// search bar. Asks for an optional friendly label before persisting
// to Supabase. Lifted out of App.js on 2026-04-30 (was an inline JSX
// const). Submit/cancel handlers and label state owned by parent.
export function FavSearchModal({
  open, setOpen,
  search,
  // 2026-05-08 — captured at openPrompt time by App.js, surfaced here
  // so the user knows the heart persists the active price guard
  // alongside the query. Either / both null = no $ filter saved.
  minPriceText, maxPriceText,
  label, setLabel,
  error, setError,
  submit,
}) {
  if (!open) return null;
  const hasMin = (minPriceText || "").trim() !== "";
  const hasMax = (maxPriceText || "").trim() !== "";
  const priceBand = (hasMin || hasMax)
    ? ` · $${hasMin ? Number(minPriceText).toLocaleString() : ""}–${hasMax ? "$" + Number(maxPriceText).toLocaleString() : ""}`
    : "";
  return (
    <Modal title="Save search" onClose={() => setOpen(false)} width={380}>
      <ModalNote>
        Saving "<b>{search}</b>"{priceBand}. Find it again from Saved → Searches.
      </ModalNote>
      <Input
        autoFocus
        value={label}
        onChange={e => { setLabel(e.target.value); setError(""); }}
        onKeyDown={e => { if (e.key === "Enter") submit(); }}
        placeholder="Name (e.g. Speedmaster pro)"
      />
      <ModalError>{error}</ModalError>
      <ModalFoot>
        <Button small onClick={() => setOpen(false)}>Cancel</Button>
        <Button small primary onClick={submit} disabled={!label.trim()}>Save</Button>
      </ModalFoot>
    </Modal>
  );
}
