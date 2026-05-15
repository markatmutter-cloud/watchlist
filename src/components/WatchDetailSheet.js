import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { fmtUSD } from "../utils";
import { resizeImage } from "../resizeImage";
import { modalBackdrop, modalShell, modalCloseButton, modalTitleRow, modalTitle, inputBase, actionButton } from "../styles";

// Per-watch detail sheet for the My Watches surface (2026-05-09 —
// watch-management v1).
//
// Surfaces: identifying info, photo, the two free-form text fields
// (Description + Thoughts), buy/sell breakdown (when populated),
// computed P&L, datestamped journal (append-only), and actions:
// Mark as sold · Flag for sale · Remove.
//
// Mobile = full-screen sheet (modalShell extends to ~100vh). Desktop
// = side panel (modalShell width clamped to 520px). Same component
// renders both — the only branch is on `isMobile`.
//
// Read-only initial render; double-tap (or pencil button) on any
// editable region opens an inline form. The `updateWatchDetails`
// patcher mutates one field at a time; optimistic local update
// happens at the useCollections layer.

export function WatchDetailSheet({
  open, onClose,
  item,
  isMobile,
  // Mutators threaded from collectionsApi.
  updateWatchDetails,    // (rowId, patch) => { error }
  toggleFlagForSale,     // (rowId, next) => { error }
  removeItemFromCollection, // (collectionId, rowId) — for the Remove action
  markItemAsSold,        // (rowId, opts) — opens MarkAsSoldModal upstream
  collectionId,          // owning collection id (passed through for remove)
  // Photo upload (manual entries only — listing-backed rows have an
  // image owned by the dealer's CDN). Resizes client-side then
  // uploads to the watch-photos bucket; updateWatchDetails persists
  // the resulting public URL on manual_image_url.
  uploadWatchPhoto,      // (file) => { error, url }
  // Comment journal.
  fetchComments,         // (rowId) => { rows }
  postComment,           // (rowId, body) => { row, error }
  deleteComment,         // (commentId) => { error }
  user,                  // signed-in user (for self-author detection)
}) {
  const rowId = item?.rowId;

  // Edit state — one field active at a time. Local form state holds
  // the in-progress value; on save, calls updateWatchDetails and
  // clears editing.
  const [editingField, setEditingField] = useState(null);
  const [draft, setDraft] = useState("");

  // Comments. Loaded on open + on rowId change. Local prepend on
  // successful post so the journal feels snappy.
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

  // Photo upload state. Only relevant for manual entries (img is
  // ours to control); listing-backed rows skip the upload affordance.
  const fileInputRef = useRef(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    if (!open || !rowId || !fetchComments) {
      setComments([]);
      return undefined;
    }
    let cancelled = false;
    fetchComments(rowId).then(({ rows }) => {
      if (cancelled) return;
      setComments(rows || []);
    });
    return () => { cancelled = true; };
  }, [open, rowId, fetchComments]);

  // Reset editing state when the sheet closes / opens.
  useEffect(() => {
    if (!open) {
      setEditingField(null);
      setDraft("");
      setCommentBody("");
    }
  }, [open]);

  const beginEdit = useCallback((field, current) => {
    setEditingField(field);
    setDraft(current || "");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingField || !rowId) return;
    let value = draft;
    if (editingField === "assumedSellValue") {
      const n = parseFloat(draft);
      value = Number.isFinite(n) ? n : null;
    }
    await updateWatchDetails(rowId, { [editingField]: value });
    setEditingField(null);
    setDraft("");
  }, [editingField, draft, rowId, updateWatchDetails]);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setDraft("");
  }, []);

  const onPostComment = useCallback(async () => {
    if (!rowId || !commentBody.trim()) return;
    setCommentBusy(true);
    const res = await postComment(rowId, commentBody);
    setCommentBusy(false);
    if (!res?.error && res?.row) {
      setComments(prev => [res.row, ...prev]);
      setCommentBody("");
    }
  }, [rowId, commentBody, postComment]);

  const onDeleteComment = useCallback(async (commentId) => {
    if (!window.confirm("Delete this journal entry?")) return;
    const res = await deleteComment(commentId);
    if (!res?.error) {
      setComments(prev => prev.filter(c => c.id !== commentId));
    }
  }, [deleteComment]);

  const onPhotoChosen = useCallback(async (e) => {
    const file = e.target?.files?.[0];
    if (!file || !rowId || !uploadWatchPhoto) return;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      const resized = await resizeImage(file);
      const up = await uploadWatchPhoto(resized);
      if (up?.error) {
        setPhotoError(up.error);
        return;
      }
      const res = await updateWatchDetails(rowId, { manualImageUrl: up.url });
      if (res?.error) setPhotoError(res.error);
    } catch (err) {
      setPhotoError(err?.message || String(err));
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [rowId, uploadWatchPhoto, updateWatchDetails]);

  if (!open || !item) return null;

  // P&L computation. Uses the breakdown if populated, falls back to
  // headline manual_price_paid + manual_sold_price for the flat case.
  const buyAllInUsd = item.manualBuyAllInUsd
    || (item.manualBuyHammer != null
        ? Number(item.manualBuyHammer || 0) + Number(item.manualBuyPremium || 0)
          + Number(item.manualBuyShipping || 0) + Number(item.manualBuyTax || 0)
          + Number(item.manualBuyOther || 0)
        : null)
    || item.savedPrice || item.price || 0;
  const sellNetUsd = item.manualSellNetUsd
    || (item.soldPrice != null
        ? Number(item.soldPrice) - Number(item.manualSellPlatformFee || 0)
          - Number(item.manualSellShippingOut || 0)
          - Number(item.manualSellOther || 0)
        : null);
  const pnl = (sellNetUsd != null && buyAllInUsd != null)
    ? sellNetUsd - buyAllInUsd
    : null;
  const holdDays = (item.savedAt && item.soldDate)
    ? Math.round((new Date(item.soldDate) - new Date(item.savedAt)) / 86400000)
    : null;

  const title = [item.brand || item.manualBrand, item.model || item.manualModel]
    .filter(Boolean).join(" ").trim() || "Untitled";

  // Density pass (Mark feedback 2026-05-15 #9): tighter section
  // labels + field padding so the form fits more in one viewport.
  // Was marginTop 18 / padding 8x10 / lineHeight 1.5.
  const sectionLabel = {
    fontSize: 11, fontWeight: 600, color: "var(--text3)",
    textTransform: "uppercase", letterSpacing: "0.06em",
    marginTop: 12, marginBottom: 5,
  };
  const fieldLine = (children, onClick) => (
    <button onClick={onClick} style={{
      display: "block", width: "100%", textAlign: "left",
      padding: "7px 10px", borderRadius: 8,
      background: "var(--card-bg)",
      border: "0.5px solid var(--border)",
      fontFamily: "inherit", fontSize: 13, color: "var(--text1)",
      cursor: onClick ? "pointer" : "default", lineHeight: 1.4,
    }}>{children}</button>
  );

  // Sheet sizing — mobile = full screen (no rounded corners on
  // bottom), desktop = right-side panel. modalBackdrop handles
  // overlay; modalShell is overridden inline.
  //
  // Mark feedback 2026-05-15 (#9 / IMG_6520): "the card doesn't fit
  // the screen" — long form (7 sections), no obvious dismiss
  // affordance once you scroll past the top. Two changes:
  //   1. Sticky header (title + close ×) anchored to the top so the
  //      escape hatch is always reachable.
  //   2. Density pass on photo block, section labels, field padding
  //      so the form fits more in one viewport before scrolling.
  // The safe-area-inset-top now lives on the sticky header (was on
  // the shell) so the sticky surface sits below the iOS status bar.
  const sheetStyle = isMobile ? {
    ...modalShell,
    maxWidth: "100%", width: "100%",
    maxHeight: "100vh", height: "100vh",
    margin: 0, borderRadius: 0,
    overflowY: "auto",
    padding: 0,
  } : {
    ...modalShell,
    maxWidth: 540, width: "92vw",
    maxHeight: "90vh", overflowY: "auto",
    padding: 0,
  };
  // Sticky header — wraps the title row + close button. Pulled flush
  // to the shell edges so the bg band + bottom border read as a real
  // header, not a contained pill.
  const stickyHeaderStyle = {
    position: "sticky", top: 0, zIndex: 2,
    background: "var(--bg)",
    borderBottom: "0.5px solid var(--border)",
    padding: isMobile
      ? "max(14px, calc(env(safe-area-inset-top, 0px) + 12px)) 22px 12px"
      : "16px 22px 12px",
  };
  // Body wrapper — restores the modalShell padding (22) that we
  // dropped from sheetStyle so the sticky header could span edge to
  // edge.
  const bodyStyle = { padding: "12px 22px 22px" };

  // Portal to document.body so the sheet shares a stacking context
  // with other body-level overlays (Screening mode) and z-indexes
  // resolve cleanly. Without this, ancestor stacking contexts in
  // CollectionsTab could trap the sheet beneath the screening
  // overlay even when its zIndex is higher.
  if (typeof document === "undefined") return null;
  return createPortal((
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={sheetStyle}>
        <div style={stickyHeaderStyle}>
          <div style={{ ...modalTitleRow, marginBottom: 0 }}>
            <div style={modalTitle}>{title}</div>
            <button onClick={onClose} aria-label="Close" style={modalCloseButton}>×</button>
          </div>
        </div>
        <div style={bodyStyle}>

        {/* Photo + identifying info. Manual entries get an upload
            affordance — tap the photo (or the empty placeholder) to
            replace it. Listing-backed rows skip the affordance: the
            image is owned by the dealer's CDN. */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{
            width: 96, height: 96, borderRadius: 10,
            background: "var(--surface)", overflow: "hidden", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
            cursor: item.isManual && uploadWatchPhoto ? "pointer" : "default",
          }}
          onClick={() => {
            if (!item.isManual || !uploadWatchPhoto || photoBusy) return;
            fileInputRef.current?.click();
          }}
          title={item.isManual && uploadWatchPhoto ? "Tap to upload a photo" : undefined}>
            {item.img ? (
              <img src={item.img} alt={title}
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <img src="/favicon-192.png" alt="" aria-hidden="true"
                style={{ width: "55%", maxWidth: 70, opacity: 0.55 }} />
            )}
            {item.isManual && uploadWatchPhoto && (
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                background: "rgba(0,0,0,0.55)", color: "#fff",
                padding: "3px 6px", fontSize: 10, textAlign: "center",
                fontWeight: 500, letterSpacing: "0.04em",
              }}>{photoBusy ? "Uploading…" : (item.img ? "Tap to replace" : "Tap to upload")}</div>
            )}
          </div>
          {item.isManual && uploadWatchPhoto && (
            <input ref={fileInputRef} type="file" accept="image/*"
              onChange={onPhotoChosen}
              style={{ display: "none" }} />
          )}
          <div style={{ minWidth: 0, flex: 1, fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
            {(item.ref || item.manualReference) && (
              <div>Ref <strong style={{ color: "var(--text1)" }}>{item.ref || item.manualReference}</strong></div>
            )}
            {(item.material || item.manualMaterial) && (
              <div>Material: {item.material || item.manualMaterial}</div>
            )}
            {item.savedAt && (
              <div>Acquired: {new Date(item.savedAt).toLocaleDateString()}</div>
            )}
            {item.soldDate && (
              <div>Sold: {new Date(item.soldDate).toLocaleDateString()}</div>
            )}
            {item.url && (
              <div style={{ marginTop: 4 }}>
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  style={{ color: "var(--brand)", fontSize: 12, textDecoration: "underline" }}>
                  View original listing ↗
                </a>
              </div>
            )}
          </div>
        </div>
        {photoError && (
          <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 6 }}>{photoError}</div>
        )}

        {/* Listing URL (manual entries only — listing-backed rows
            already carry item.url from the dealer/auction-house feed
            and surface it as the "View original listing ↗" link
            above). Lets users add a link to a watch they entered
            manually but came from a real listing — Mark's 1675 from
            Menta, etc. */}
        {item.isManual && (
          <>
            <div style={sectionLabel}>Listing link</div>
            {editingField === "manualSourceUrl" ? (
              <EditField draft={draft} setDraft={setDraft}
                placeholder="https://example.com/listing"
                inputMode="url"
                onSave={saveEdit} onCancel={cancelEdit} />
            ) : (
              fieldLine(
                item.manualSourceUrl || item.sourceUrl || item.url || (
                  <span style={{ color: "var(--text3)", fontStyle: "italic" }}>
                    Tap to add the dealer / auction / eBay link…
                  </span>
                ),
                () => beginEdit("manualSourceUrl", item.manualSourceUrl || item.sourceUrl || item.url || "")
              )
            )}
          </>
        )}

        {/* Description */}
        <div style={sectionLabel}>Description</div>
        {editingField === "manualDescription" ? (
          <EditField draft={draft} setDraft={setDraft} multiline
            placeholder="What is this watch? Specs, story of the reference, why it's notable…"
            onSave={saveEdit} onCancel={cancelEdit} />
        ) : (
          fieldLine(
            item.manualDescription || (
              <span style={{ color: "var(--text3)", fontStyle: "italic" }}>
                Tap to describe this watch (specs, story, what's notable)…
              </span>
            ),
            () => beginEdit("manualDescription", item.manualDescription)
          )
        )}

        {/* Thoughts — the reflection layer */}
        <div style={sectionLabel}>Thoughts</div>
        {editingField === "manualThoughts" ? (
          <EditField draft={draft} setDraft={setDraft} multiline
            placeholder="Why did you buy it? What do you like? Living up to expectations? How does it fit your collecting purpose?"
            onSave={saveEdit} onCancel={cancelEdit} />
        ) : (
          fieldLine(
            item.manualThoughts || (
              <span style={{ color: "var(--text3)", fontStyle: "italic" }}>
                Tap to add your thoughts — why bought, what you like,
                expectations, fit with your collecting purpose…
              </span>
            ),
            () => beginEdit("manualThoughts", item.manualThoughts)
          )
        )}

        {/* Plan section — for-sale flag + assumed value */}
        <div style={sectionLabel}>Plan</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <button onClick={() => toggleFlagForSale(rowId, !item.flaggedForSale)}
            style={actionButton({ variant: item.flaggedForSale ? "danger" : undefined })}>
            {item.flaggedForSale ? "Flagged for sale ✓" : "Flag for sale"}
          </button>
          {markItemAsSold && !item.soldPrice && (
            <button onClick={() => markItemAsSold(rowId, item)}
              style={actionButton()}>Mark as sold</button>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>Assumed sell value (USD)</div>
        {editingField === "assumedSellValue" ? (
          <EditField draft={draft} setDraft={setDraft}
            placeholder="e.g. 12000"
            inputMode="numeric"
            onSave={saveEdit} onCancel={cancelEdit} />
        ) : (
          fieldLine(
            item.assumedSellValue != null
              ? fmtUSD(item.assumedSellValue)
              : <span style={{ color: "var(--text3)", fontStyle: "italic" }}>Tap to estimate…</span>,
            () => beginEdit("assumedSellValue", item.assumedSellValue != null ? String(item.assumedSellValue) : "")
          )
        )}

        {/* Buy / sell breakdown — read-only display only when at least
            one breakdown field is present; the (existing) manual-entry
            form still owns the edit path for these. */}
        {(buyAllInUsd > 0 || item.soldPrice) && (
          <>
            <div style={sectionLabel}>P&amp;L</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13, color: "var(--text2)" }}>
              {buyAllInUsd > 0 && <div>Buy all-in: <strong style={{ color: "var(--text1)" }}>{fmtUSD(buyAllInUsd)}</strong></div>}
              {sellNetUsd != null && <div>Sell net: <strong style={{ color: "var(--text1)" }}>{fmtUSD(sellNetUsd)}</strong></div>}
              {pnl != null && (
                <div>
                  P&amp;L: <strong style={{ color: pnl >= 0 ? "var(--accent-positive)" : "var(--danger)" }}>
                    {pnl >= 0 ? "+" : ""}{fmtUSD(pnl)}
                  </strong>
                </div>
              )}
              {holdDays != null && holdDays >= 0 && <div>Held: {holdDays}d</div>}
            </div>
          </>
        )}

        {/* Journal — datestamped append-only comments. Realtime lets
            collaborators on shared lists see each other's entries
            live. */}
        <div style={sectionLabel}>Journal</div>
        <div style={{ marginBottom: 8 }}>
          <textarea value={commentBody}
            onChange={e => setCommentBody(e.target.value)}
            placeholder="Add a dated note — your thinking on this watch right now…"
            rows={2}
            style={{ ...inputBase, width: "100%", resize: "vertical", fontSize: 13, fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 6, justifyContent: "flex-end" }}>
            <button onClick={onPostComment} disabled={commentBusy || !commentBody.trim()}
              style={{ ...actionButton({ variant: "primary" }),
                       opacity: (commentBusy || !commentBody.trim()) ? 0.5 : 1 }}>
              {commentBusy ? "Saving…" : "Add note"}
            </button>
          </div>
        </div>
        {comments.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text3)", padding: "8px 0" }}>
            No journal entries yet. Add one above.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {comments.map(c => (
              <div key={c.id} style={{
                padding: "10px 12px", borderRadius: 8,
                border: "0.5px solid var(--border)", background: "var(--card-bg)",
              }}>
                <div style={{
                  fontSize: 11, color: "var(--text3)", marginBottom: 4,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span>{new Date(c.created_at).toLocaleString()}</span>
                  {user?.id === c.user_id && (
                    <button onClick={() => onDeleteComment(c.id)}
                      style={{
                        border: "none", background: "transparent",
                        color: "var(--text3)", cursor: "pointer",
                        fontFamily: "inherit", fontSize: 11, padding: 0,
                      }}>delete</button>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "var(--text1)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {c.body}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Remove from collection */}
        {removeItemFromCollection && collectionId && (
          <>
            <div style={{ height: "0.5px", background: "var(--border)", margin: "20px 0 12px" }} />
            <button onClick={async () => {
              if (!window.confirm("Remove this watch from your collection? The watch's journal entries will also be deleted.")) return;
              await removeItemFromCollection(collectionId, item.id);
              onClose();
            }}
              style={{ ...actionButton({ variant: "danger" }), width: "100%" }}>
              Remove from collection
            </button>
          </>
        )}
        </div>
      </div>
    </div>
  ), document.body);
}

function EditField({ draft, setDraft, multiline, placeholder, inputMode, onSave, onCancel }) {
  const Tag = multiline ? "textarea" : "input";
  return (
    <div>
      <Tag
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder={placeholder}
        autoFocus
        rows={multiline ? 4 : undefined}
        inputMode={inputMode}
        style={{
          ...inputBase, width: "100%",
          fontSize: 13, fontFamily: "inherit",
          resize: multiline ? "vertical" : undefined,
        }} />
      <div style={{ display: "flex", gap: 8, marginTop: 6, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={actionButton()}>Cancel</button>
        <button onClick={onSave} style={actionButton({ variant: "primary" })}>Save</button>
      </div>
    </div>
  );
}
