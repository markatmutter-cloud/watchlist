import React, { useState, useEffect } from "react";
import { Modal, ModalNote, ModalError, ModalFoot, FieldLabel, Button } from "../ui";

// MarkAsSoldModal — captures sold price + sold date when the user
// moves a watch from Owned to Sold. PR #88, 2026-05-06.
//
// Mark's framing: when a watch is sold, the user wants to capture
// what it sold for + when, freezing that data for the journey view.
// Both fields are optional — Mark already accepted that pattern in
// ManualEntryForm (#87) for users who don't have the info to hand.
//
// Driven by `open` + `onClose`. The parent (CollectionsTab) owns
// the open state per-item.
export function MarkAsSoldModal({
  open, onClose,
  item,                 // the item being sold (for display only)
  onConfirm,            // ({ soldPrice, soldDate, currency }) => Promise<{ error?: string }>
}) {
  const [soldPrice, setSoldPrice] = useState("");
  const [soldDate, setSoldDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Reset on each open. Default the date to today + carry the
  // item's existing currency if there is one.
  useEffect(() => {
    if (open) {
      setSoldPrice("");
      setSoldDate(new Date().toISOString().slice(0, 10));
      setCurrency(item?.currency || "USD");
      setBusy(false);
      setError("");
    }
  }, [open, item?.currency]);

  if (!open) return null;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await onConfirm({
      soldPrice: soldPrice !== "" ? Number(soldPrice) : null,
      soldDate:  soldDate || null,
      currency,
    });
    setBusy(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    onClose();
  };

  const title = item?.title
    || [item?.brand, item?.model].filter(Boolean).join(" ").trim()
    || "this watch";

  return (
    <Modal title="Mark as sold" onClose={onClose} locked={busy} width={380}>
      <ModalNote>
        Move <strong style={{ color: "var(--text1)" }}>{title}</strong> from Owned to Sold. Both fields are optional; leave blank if you don't have the details.
      </ModalNote>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 2 }}>
          <FieldLabel>Sold price</FieldLabel>
          <input type="number" inputMode="decimal" autoFocus className="ui-input"
            value={soldPrice}
            onChange={e => { setSoldPrice(e.target.value); setError(""); }}
            placeholder="0" />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel>Currency</FieldLabel>
          <select value={currency} onChange={e => setCurrency(e.target.value)} className="ui-input">
            <option>USD</option>
            <option>GBP</option>
            <option>EUR</option>
            <option>CHF</option>
            <option>JPY</option>
            <option>AUD</option>
            <option>CAD</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <FieldLabel>Sold on</FieldLabel>
        <input type="date" value={soldDate} className="ui-input"
          onChange={e => setSoldDate(e.target.value)} />
      </div>
      <ModalError>{error}</ModalError>
      <ModalFoot>
        <Button small onClick={onClose} disabled={busy}>Cancel</Button>
        <Button small primary onClick={submit} disabled={busy}>{busy ? "Moving…" : "Move to Sold"}</Button>
      </ModalFoot>
    </Modal>
  );
}
