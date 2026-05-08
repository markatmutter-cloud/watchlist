import React, { useState, useEffect, useRef } from "react";
import { modalBackdrop, modalShell, modalCloseButton, modalTitleRow, modalTitle } from "../styles";
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
  inp,
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
    <div onClick={busy ? undefined : onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()}
           style={{ ...modalShell, maxWidth: 460, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={modalTitleRow}>
          <div style={modalTitle}>
            {kind === "sold" ? "Add a sold watch" : "Add a watch you own"}
          </div>
          <button onClick={onClose} aria-label="Close" style={modalCloseButton}
                  disabled={busy}>×</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 12, lineHeight: 1.5 }}>
          {kind === "sold"
            ? "Add a watch you've sold. Photo, sold price, and date are optional — you can leave any of them blank if you don't have them yet."
            : "Add a watch you own. Photo is optional — you can add one later. Brand is required; everything else fills in over time."}
        </div>

        {/* Photo */}
        <div style={{ marginBottom: 14 }}>
          <Label>Photo (optional)</Label>
          {photoPreview ? (
            <div style={{ position: "relative", marginBottom: 6 }}>
              <img src={photoPreview} alt="Preview"
                style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8 }} />
              <button onClick={clearPhoto}
                style={{
                  position: "absolute", top: 6, right: 6,
                  border: "none", background: "rgba(0,0,0,0.6)", color: "#fff",
                  width: 24, height: 24, borderRadius: "50%",
                  cursor: "pointer", fontSize: 14, fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>×</button>
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
          <Label>Brand <span style={{ color: "var(--danger)" }}>*</span></Label>
          <input autoFocus value={brand}
            onChange={e => { setBrand(e.target.value); setError(""); }}
            placeholder="e.g. Rolex"
            style={{ ...inp, fontSize: 14 }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <Label>Model</Label>
            <input value={model} onChange={e => setModel(e.target.value)}
              placeholder="Submariner" style={{ ...inp, fontSize: 14 }} />
          </div>
          <div style={{ flex: 1 }}>
            <Label>Reference</Label>
            <input value={reference} onChange={e => setReference(e.target.value)}
              placeholder="5513" style={{ ...inp, fontSize: 14 }} />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <Label>Material</Label>
          <input value={material} onChange={e => setMaterial(e.target.value)}
            placeholder="Steel · 18k yellow gold · etc." style={{ ...inp, fontSize: 14 }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <Label>Link (optional)</Label>
          <input
            type="url"
            value={sourceUrl}
            onChange={e => setSourceUrl(e.target.value)}
            placeholder="https://example.com/listing — dealer / eBay / auction lot"
            style={{ ...inp, fontSize: 14 }} />
        </div>

        {/* Price paid */}
        <div style={{ display: "flex", gap: 8, marginBottom: kind === "sold" ? 10 : 14 }}>
          <div style={{ flex: 2 }}>
            <Label>Price paid</Label>
            <input type="number" inputMode="decimal" value={pricePaid}
              onChange={e => setPricePaid(e.target.value)}
              placeholder="0" style={{ ...inp, fontSize: 14 }} />
          </div>
          <div style={{ flex: 1 }}>
            <Label>Currency</Label>
            <select value={priceCurrency}
              onChange={e => setPriceCurrency(e.target.value)}
              style={{ ...inp, fontSize: 14 }}>
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
              <Label>Sold price (optional)</Label>
              <input type="number" inputMode="decimal" value={soldPrice}
                onChange={e => setSoldPrice(e.target.value)}
                placeholder="0" style={{ ...inp, fontSize: 14 }} />
            </div>
            <div style={{ flex: 1 }}>
              <Label>Sold on</Label>
              <input type="date" value={soldDate}
                onChange={e => setSoldDate(e.target.value)}
                style={{ ...inp, fontSize: 14 }} />
            </div>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <Label>Notes</Label>
          <textarea value={comments} onChange={e => setComments(e.target.value)}
            placeholder="Provenance, condition, story, anything you want to remember…"
            rows={3}
            style={{ ...inp, fontSize: 14, fontFamily: "inherit", resize: "vertical" }} />
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
          <button onClick={submit} disabled={!canSave} style={{
            border: "none", background: "var(--brand)", color: "#fff",
            padding: "8px 14px", borderRadius: 8,
            cursor: canSave ? "pointer" : "not-allowed",
            fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            opacity: canSave ? 1 : 0.5,
          }}>{busy ? "Saving…" : "Save watch"}</button>
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
