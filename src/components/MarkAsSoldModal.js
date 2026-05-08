import React, { useState, useEffect } from "react";
import { modalBackdrop, modalShell, modalCloseButton, modalTitleRow, modalTitle, inputBase } from "../styles";

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
    <div onClick={busy ? undefined : onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()}
           style={{ ...modalShell, maxWidth: 380 }}>
        <div style={modalTitleRow}>
          <div style={modalTitle}>Mark as sold</div>
          <button onClick={onClose} aria-label="Close" style={modalCloseButton}
                  disabled={busy}>×</button>
        </div>
        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12, lineHeight: 1.5 }}>
          Move <strong style={{ color: "var(--text1)" }}>{title}</strong> from Owned to Sold. Both fields are optional — leave blank if you don't have the details.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 2 }}>
            <Label>Sold price</Label>
            <input type="number" inputMode="decimal" autoFocus
              value={soldPrice}
              onChange={e => { setSoldPrice(e.target.value); setError(""); }}
              placeholder="0" style={{ ...inputBase, fontSize: 14 }} />
          </div>
          <div style={{ flex: 1 }}>
            <Label>Currency</Label>
            <select value={currency} onChange={e => setCurrency(e.target.value)}
              style={{ ...inputBase, fontSize: 14 }}>
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
          <Label>Sold on</Label>
          <input type="date" value={soldDate}
            onChange={e => setSoldDate(e.target.value)}
            style={{ ...inputBase, fontSize: 14 }} />
        </div>
        {error && (
          <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 10 }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={busy} style={{
            border: "0.5px solid var(--border)", background: "transparent",
            color: "var(--text2)", padding: "8px 14px", borderRadius: 8,
            cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 13,
          }}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{
            border: "none", background: "var(--brand)", color: "#fff",
            padding: "8px 14px", borderRadius: 8,
            cursor: busy ? "not-allowed" : "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            opacity: busy ? 0.6 : 1,
          }}>{busy ? "Moving…" : "Move to Sold"}</button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: "var(--text3)",
      textTransform: "uppercase", letterSpacing: "0.04em",
      marginBottom: 4,
    }}>{children}</div>
  );
}
