import React, { useState, useMemo, useEffect } from "react";
import { modalBackdrop, modalShell, modalCloseButton, modalTitleRow, modalTitle } from "../styles";
import { fmtUSD, imgSrc, shortHash } from "../utils";
import { EmptyState } from "./EmptyState";

// ListingPickerModal — pick a listing from the user's hearted items,
// any of their lists, or the global feed (search + paste-link). Used
// to populate Owned / Sold / Wishlist with watches the user found in
// the regular feed (vs ManualEntryForm, which is for off-platform
// watches).
//
// PR #88, 2026-05-06. Adapted from the challenge picker
// (ChallengeFlow.js PickingStage) — same shape (chip group + tile
// grid + search) but standalone modal so other surfaces can reuse it
// without lifting state into a parent.
//
// Mark's framing for Owned/Sold: "use a sold listing in our archive
// if you were the one to buy that watch." So: the picker doesn't
// filter by status; live and sold are both pickable. The drill-in
// chooses what to do with whichever one the user picks.
//
// Data sources:
//   - "Favorites"     → watchItems (the user's hearted set)
//   - each user list  → itemsByCollection[<id>]
//   - "All listings"  → allListings (the global feed) + paste link
// Search input always filters whichever set is active.

export function ListingPickerModal({
  open, onClose,
  title,                    // header label (e.g. "Add to Owned")
  onPick,                   // (listing) => Promise<{ error?: string }>
  watchItems,               // user's hearted items (from watchlist)
  collections,              // collectionsApi.collections
  itemsByCollection,        // collectionsApi.itemsByCollection
  allListings,              // global feed (items array)
  primaryCurrency,
}) {
  // Active source — "favorites" / "all" / a collection uuid.
  const [source, setSource] = useState("favorites");
  const [search, setSearch] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [busy, setBusy] = useState(false);

  // Reset on each open so a previous attempt doesn't bleed.
  useEffect(() => {
    if (open) {
      setSource("favorites");
      setSearch("");
      setPasteUrl("");
      setPasteError("");
      setBusy(false);
    }
  }, [open]);

  // User's lists (excluding the shared inbox + hard system + challenges).
  // Hard system lists ARE valid pick sources from a UI perspective
  // (you might want to mirror an Owned watch into a custom list later)
  // — but listing them as picker SOURCES would be confusing since
  // they auto-create. Keep the picker focused on user intent.
  const userLists = useMemo(() => (collections || []).filter(c =>
    !c.isSharedInbox && !c.isSystem && c.type !== "challenge"
  ), [collections]);

  // Resolve the candidate set for the active source.
  const candidates = useMemo(() => {
    let pool;
    if (source === "favorites") {
      pool = watchItems || [];
    } else if (source === "all") {
      pool = allListings || [];
    } else {
      pool = itemsByCollection?.[source] || [];
    }
    if (!search.trim()) return pool;
    const q = search.trim().toLowerCase();
    return pool.filter(it => {
      const hay = [it.brand, it.model, it.title, it.ref].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [source, search, watchItems, allListings, itemsByCollection]);

  if (!open) return null;

  const handlePick = async (listing) => {
    if (busy) return;
    setBusy(true);
    const res = await onPick(listing);
    setBusy(false);
    if (res?.error) {
      setPasteError(res.error);
      return;
    }
    onClose();
  };

  const handlePaste = async () => {
    setPasteError("");
    if (busy) return;
    const url = pasteUrl.trim();
    if (!url) { setPasteError("Paste a listing URL"); return; }
    // Resolve the URL against the global feed by stable shortHash id.
    // Same lookup the share-receive flow uses — listings.json is the
    // source of truth for "what the user might be referring to."
    const id = shortHash(url);
    const found = (allListings || []).find(it => it.id === id);
    if (!found) {
      setPasteError("That URL isn't in the current feed. Use Manual entry instead.");
      return;
    }
    await handlePick(found);
  };

  return (
    <div onClick={busy ? undefined : onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()}
           style={{ ...modalShell, maxWidth: 640, maxHeight: "92vh",
                    display: "flex", flexDirection: "column" }}>
        <div style={modalTitleRow}>
          <div style={modalTitle}>{title || "Pick a listing"}</div>
          <button onClick={onClose} aria-label="Close" style={modalCloseButton}
                  disabled={busy}>×</button>
        </div>

        {/* Source chips. Wrap to multiple lines instead of horizontal-
            scroll: the prior overflowX:auto setup caused the chip row
            to be vertically clipped by the modal flex layout (Mark's
            report 2026-05-06 — chips appeared cut off at the top with
            many user lists). flexShrink:0 + flexWrap is the
            clip-proof shape. */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6,
          marginBottom: 12, flexShrink: 0,
        }}>
          <Chip active={source === "favorites"} label="♥ Favorites" onClick={() => setSource("favorites")} />
          <Chip active={source === "all"}       label="All listings" onClick={() => setSource("all")} />
          {userLists.map(c => (
            <Chip key={c.id} active={source === c.id} label={c.name} onClick={() => setSource(c.id)} />
          ))}
          <Chip active={source === "paste"} label="Paste link" onClick={() => setSource("paste")} />
        </div>

        {source === "paste" ? (
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 12, color: "var(--text2)", margin: "0 0 6px", lineHeight: 1.4 }}>
              Paste a dealer URL from the feed (live or sold). The picker resolves it against listings.json — for off-platform watches use Manual entry.
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={pasteUrl}
                onChange={e => { setPasteUrl(e.target.value); setPasteError(""); }}
                placeholder="https://…"
                style={{
                  flex: 1, fontSize: 13, fontFamily: "inherit",
                  padding: "8px 10px", borderRadius: 8,
                  border: "0.5px solid var(--border)",
                  background: "var(--surface)", color: "var(--text1)",
                  outline: "none",
                }} />
              <button onClick={handlePaste} disabled={busy || !pasteUrl.trim()}
                style={{
                  border: "none", background: "var(--brand)", color: "#fff",
                  padding: "8px 14px", borderRadius: 8,
                  cursor: pasteUrl.trim() ? "pointer" : "not-allowed",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 500,
                  opacity: pasteUrl.trim() ? 1 : 0.5,
                }}>Add</button>
            </div>
            {pasteError && (
              <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>{pasteError}</div>
            )}
          </div>
        ) : (
          <>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search this set…"
              style={{
                fontSize: 13, fontFamily: "inherit",
                padding: "8px 10px", borderRadius: 8,
                border: "0.5px solid var(--border)",
                background: "var(--surface)", color: "var(--text1)",
                marginBottom: 8, outline: "none",
              }} />
            {pasteError && (
              <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 6 }}>{pasteError}</div>
            )}
            <div style={{ flex: 1, overflowY: "auto", margin: "0 -4px" }}>
              {candidates.length === 0 ? (
                <EmptyState
                  size="compact"
                  heading={source === "favorites"
                    ? "Nothing saved matches"
                    : source === "all"
                      ? "No listings match"
                      : "This list is empty"}
                  blurb={source === "favorites"
                    ? "Try a different search, or heart more watches in the Listings tab."
                    : source === "all"
                      ? "Try a different search term, or paste a listing URL above."
                      : "Add a watch to this list and you can pick it from here."}
                />
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                  gap: 6, padding: "0 4px 8px",
                }}>
                  {candidates.slice(0, 200).map(item => (
                    <Tile key={item.id || item.url} item={item} onTap={() => handlePick(item)}
                      primaryCurrency={primaryCurrency} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Chip({ active, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0,
      padding: "4px 12px", borderRadius: 999,
      border: "0.5px solid var(--border)",
      background: active ? "var(--text1)" : "transparent",
      color: active ? "var(--bg)" : "var(--text1)",
      cursor: "pointer", fontFamily: "inherit", fontSize: 12,
      whiteSpace: "nowrap",
    }}>{label}</button>
  );
}

function Tile({ item, onTap }) {
  return (
    <button onClick={onTap}
      title={`Add: ${item.brand || ""}${item.ref ? ` ${item.ref}` : ""}`}
      style={{
        display: "flex", flexDirection: "column",
        background: "var(--card-bg)",
        border: "0.5px solid var(--border)", borderRadius: 6,
        padding: 0, overflow: "hidden",
        cursor: "pointer", fontFamily: "inherit", textAlign: "left",
      }}>
      <div style={{
        aspectRatio: "1", background: "var(--bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {item.img ? (
          <img src={imgSrc(item.img)} alt="" loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <img src="/favicon-192.png" alt="" aria-hidden="true"
            style={{ width: "50%", maxWidth: 36, opacity: 0.5 }} />
        )}
      </div>
      <div style={{ padding: "4px 6px" }}>
        <p style={{
          fontSize: 11, fontWeight: 500, margin: "0 0 1px", color: "var(--text1)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          lineHeight: 1.25,
        }}>
          {item.brand}{item.ref ? ` ${item.ref}` : ""}
        </p>
        <p style={{
          fontSize: 11, color: "var(--text2)", margin: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {fmtUSD(item.savedPriceUSD || item.priceUSD || item.price || 0)}
        </p>
      </div>
    </button>
  );
}
