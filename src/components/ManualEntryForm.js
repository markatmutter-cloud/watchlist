import React, { useState, useEffect, useRef } from "react";
import { Modal, ModalNote, ModalError, ModalFoot, FieldLabel, Button, OverlayButton } from "../ui";
import { resizeImage } from "../resizeImage";

// Manual-entry form for Owned + Sold lists. PR #87 (2026-05-06).
//
// Mark's framing: Owned/Sold collections hold watches that are
// either (a) linked to a tracked-dealer listing (a future PR adds
// the archive picker) or (b) entered manually with a photo +
// brand/model/ref/material + price + comments. This component is
// the (b) flow.
//
// Photo handling:
//   - Optional. Mark explicitly wants the "add later" path for
//     users who don't have one to hand.
//   - Resized client-side via resizeImage() before upload (max
//     1600px on the longest edge, JPEG q0.85). Typical 5-10× cut.
//   - Uploaded to the watch-photos Supabase Storage bucket via the
//     uploadWatchPhoto hook callback. Public read URL is stored in
//     manual_image_url.
//
// Sold-list variant adds two fields (sold price + sold date). Same
// component, controlled by the `kind` prop ("owned" | "sold").
//
// Driven by an `open` boolean + `onClose` callback. The parent
// (CollectionsTab) owns the open state per-drill-in.
export function ManualEntryForm({
  open, onClose,
  kind,                 // "owned" | "sold"
  uploadWatchPhoto,     // (file) => { error, url }
  addManualItem,        // (collectionId, data) => { error, id }
  collectionId,
}) {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [reference, setReference] = useState("");
  const [material, setMaterial] = useState("");
  const [pricePaid, setPricePaid] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("USD");
  const [soldPrice, setSoldPrice] = useState("");
  const [soldDate, setSoldDate] = useState("");
  const [comments, setComments] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  // Reset state on each open so previous attempts don't bleed in.
  useEffect(() => {
    if (open) {
      setBrand("");
      setModel("");
      setReference("");
      setMaterial("");
      setPricePaid("");
      setPriceCurrency("USD");
      setSoldPrice("");
      setSoldDate("");
      setComments("");
      setSourceUrl("");
      setPhotoFile(null);
      setPhotoPreview(null);
      setBusy(false);
      setError("");
    }
  }, [open]);

  // Revoke object URL on unmount / new photo to avoid leaks.
  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  if (!open) return null;

  const canSave = brand.trim().length > 0 && !busy;

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    setError("");
    try {
      let imageUrl = null;
      if (photoFile) {
        const resized = await resizeImage(photoFile);
        const upload = await uploadWatchPhoto(resized);
        if (upload?.error) {
          setError(`Photo upload failed: ${upload.error}`);
          setBusy(false);
          return;
        }
        imageUrl = upload.url;
      }
      const res = await addManualItem(collectionId, {
        imageUrl,
        brand:        brand.trim(),
        model:        model.trim()     || null,
        reference:    reference.trim() || null,
        material:     material.trim()  || null,
        pricePaid:    pricePaid    !== "" ? Number(pricePaid)   : null,
        priceCurrency,
        soldPrice:    kind === "sold" && soldPrice !== "" ? Number(soldPrice) : null,
        soldDate:     kind === "sold" && soldDate          ? soldDate          : null,
        comments:     comments.trim() || null,
        sourceUrl:    sourceUrl.trim() || null,
      });
      if (res?.error) {
        setError(res.error);
        setBusy(false);
        return;
      }
      onClose();
    } catch (e) {
      setError(e.message || String(e));
      setBusy(false);
    }
  };

  return (
    <Modal title={kind === "sold" ? "Add a sold watch" : "Add a watch you own"} onClose={onClose} locked={busy} width={460}>
        <ModalNote>
          {kind === "sold"
            ? "Add a watch you've sold. Photo, sold price, and date are optional: you can leave any of them blank if you don't have them yet."
            : "Add a watch you own. Photo is optional; you can add one later. Brand is required; everything else fills in over time."}
        </ModalNote>

        {/* Photo */}
        <div style={{ marginBottom: 14 }}>
          <FieldLabel>Photo (optional)</FieldLabel>
          {photoPreview ? (
            <div style={{ position: "relative", marginBottom: 6 }}>
              <img src={photoPreview} alt="Preview"
                style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8 }} />
              <div style={{ position: "absolute", top: 6, right: 6 }}>
                <OverlayButton small onClick={clearPhoto} aria-label="Remove photo">×</OverlayButton>
              </div>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%", padding: "12px", borderRadius: 8,
                border: "1px dashed var(--border)", background: "var(--surface)",
                color: "var(--text2)", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13,
              }}>
              + Choose a photo
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*"
            onChange={handlePhoto} style={{ display: "none" }} />
        </div>

        {/* Required: brand. Optional: model / reference / material. */}
        <div style={{ marginBottom: 10 }}>
          <FieldLabel>Brand <span style={{ color: "var(--danger)" }}>*</span></FieldLabel>
          <input autoFocus value={brand}
            onChange={e => { setBrand(e.target.value); setError(""); }}
            placeholder="e.g. Rolex"
            className="ui-input" />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Model</FieldLabel>
            <input value={model} onChange={e => setModel(e.target.value)}
              placeholder="Submariner" className="ui-input" />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Reference</FieldLabel>
            <input value={reference} onChange={e => setReference(e.target.value)}
              placeholder="5513" className="ui-input" />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <FieldLabel>Material</FieldLabel>
          <input value={material} onChange={e => setMaterial(e.target.value)}
            placeholder="Steel · 18k yellow gold · etc." className="ui-input" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <FieldLabel>Link (optional)</FieldLabel>
          <input
            type="url"
            value={sourceUrl}
            onChange={e => setSourceUrl(e.target.value)}
            placeholder="https://example.com/listing · dealer / eBay / auction lot"
            className="ui-input" />
        </div>

        {/* Price paid */}
        <div style={{ display: "flex", gap: 8, marginBottom: kind === "sold" ? 10 : 14 }}>
          <div style={{ flex: 2 }}>
            <FieldLabel>Price paid</FieldLabel>
            <input type="number" inputMode="decimal" value={pricePaid}
              onChange={e => setPricePaid(e.target.value)}
              placeholder="0" className="ui-input" />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Currency</FieldLabel>
            <select value={priceCurrency}
              onChange={e => setPriceCurrency(e.target.value)}
              className="ui-input">
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

        {kind === "sold" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 2 }}>
              <FieldLabel>Sold price (optional)</FieldLabel>
              <input type="number" inputMode="decimal" value={soldPrice}
                onChange={e => setSoldPrice(e.target.value)}
                placeholder="0" className="ui-input" />
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel>Sold on</FieldLabel>
              <input type="date" value={soldDate}
                onChange={e => setSoldDate(e.target.value)}
                className="ui-input" />
            </div>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <FieldLabel>Notes</FieldLabel>
          <textarea value={comments} onChange={e => setComments(e.target.value)}
            placeholder="Provenance, condition, story, anything you want to remember…"
            rows={3}
            className="ui-input ui-input--area" />
        </div>

        <ModalError>{error}</ModalError>

        <ModalFoot>
          <Button small onClick={onClose} disabled={busy}>Cancel</Button>
          <Button small primary onClick={submit} disabled={!canSave}>{busy ? "Saving…" : "Save watch"}</Button>
        </ModalFoot>
    </Modal>
  );
}
