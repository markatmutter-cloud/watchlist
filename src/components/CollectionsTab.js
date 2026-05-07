import React, { useState, useEffect, useRef } from "react";
import { Card } from "./Card";
import { ListRow } from "./ListRow";
import { SubTabIntro } from "./SubTabIntro";
import { ChallengesView } from "./ChallengesView";
import { ManualEntryForm } from "./ManualEntryForm";
import { ListingPickerModal } from "./ListingPickerModal";
import { MarkAsSoldModal } from "./MarkAsSoldModal";
import { fmtUSD } from "../utils";

// Top-level Collections tab — restructured 2026-05-06 (PR #99) into
// four sub-tabs per Mark's plan:
//
//   my-collection — Owned + Sold combined view with a toggle.
//                   Single grid of items + +Add controls. No
//                   drill-in.
//   wishlist      — standalone Wishlist ranked list (no list-of-list
//                   wrapper).
//   lists         — user-created lists + shared inbox + Hidden
//                   synthetic row. Drilling into a row shows that
//                   list's items as a Card grid.
//   challenges    — Watch Challenges (delegates to ChallengesView).
//
// Sub-tab dispatch is driven by `collectionsSubTab` from App.js.
// `?col=<uuid>` URL param is now used only in the Lists sub-tab —
// other sub-tabs don't have a drill-in concept.

const HIDDEN_COLLECTION_ID = "__hidden__";

export function CollectionsTab({
  user,
  isAuthConfigured,
  signInWithGoogle,
  collectionsApi,
  hiddenItems,
  toggleHide,
  watchlist,
  watchItems,
  hidden,
  allListings,
  primaryCurrency,
  handleShare,
  handleWish,
  compact,
  gridStyle,
  inp,
  setEditingCollection,
  openCollectionPicker,
  startCreateCollection,
  observeCard,
  onClickListing,
  pendingChallengeDrillId,
  clearPendingChallengeDrill,
  collectionsSubTab,
  setCollectionsSubTab,
}) {
  // Sub-tab routing: the parent owns the state but if for some reason
  // it isn't passed (smoke tests, signed-out flows), fall back to a
  // sensible default so nothing crashes.
  const subTab = collectionsSubTab || "my-collection";

  // Modal states are shared across sub-tabs so the same picker /
  // manual-entry / mark-sold modals can be opened from any view.
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualEntryKind, setManualEntryKind] = useState("owned");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCollectionId, setPickerCollectionId] = useState(null);
  const [pickerTitle, setPickerTitle] = useState("Add to collection");
  const [soldTarget, setSoldTarget] = useState(null);

  // Lists sub-tab drill-in selection — moved here from the top-level
  // CollectionsTab pre-restructure. URL-synced via `?col=`. Only
  // active when subTab === "lists"; cleared on sub-tab change so a
  // stale id doesn't surface a deleted collection on return.
  const [selectedListId, setSelectedListId] = useState(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("col") || null;
  });
  useEffect(() => {
    if (subTab !== "lists") setSelectedListId(null);
  }, [subTab]);

  // Tab re-tap → return to the Lists landing. App.js bumps
  // `tabResetTick` whenever the user clicks the active main tab pill;
  // when we're on a collections-style sub-tab, we clear the drill-in
  // id so the user lands back on the list-of-lists view.
  useEffect(() => {
    if (props.tabResetTick && props.tabResetTick > 0) setSelectedListId(null);
    // eslint-disable-next-line
  }, [props.tabResetTick]);

  // URL-sync drill-in id (Lists sub-tab only). Same pattern as
  // App.js's nav sync — pushState on real drill-in/out, replaceState
  // on first mount + popstate-driven re-derivation. Browser back
  // walks out of the drill-in instead of leaving the site.
  const isFirstColSync = useRef(true);
  const prevColRef = useRef(selectedListId);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("shared") === "1") return;
    if (selectedListId && subTab === "lists") params.set("col", selectedListId);
    else                                       params.delete("col");
    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
    if (newUrl === currentUrl) {
      prevColRef.current = selectedListId;
      return;
    }
    const colChanged = prevColRef.current !== selectedListId;
    if (isFirstColSync.current || !colChanged) {
      window.history.replaceState({}, "", newUrl);
    } else {
      window.history.pushState({}, "", newUrl);
    }
    isFirstColSync.current = false;
    prevColRef.current = selectedListId;
  }, [selectedListId, subTab]);

  // popstate handler for the Lists drill-in.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("shared") === "1") return;
      const col = params.get("col") || null;
      setSelectedListId(col);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Take-this-challenge → drill straight into the challenges
  // surface. App.js sets pendingChallengeDrillId after the receive
  // flow creates the challenge; switch to the challenges sub-tab so
  // ChallengesView mounts and reads the prop.
  useEffect(() => {
    if (pendingChallengeDrillId && setCollectionsSubTab) {
      setCollectionsSubTab("challenges");
    }
  }, [pendingChallengeDrillId, setCollectionsSubTab]);

  if (!user) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Sign in to use Collections</div>
        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 360, margin: "0 auto 18px" }}>
          Owned watches, watches you've sold, your wishlist, custom lists, challenges — all in one place. Sync across every device.
        </div>
        {isAuthConfigured && (
          <button onClick={signInWithGoogle} style={{
            padding: "8px 16px", borderRadius: 8, border: "0.5px solid var(--border)",
            background: "var(--card-bg)", color: "var(--text1)", cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 500,
          }}>Sign in with Google</button>
        )}
      </div>
    );
  }

  const cols = collectionsApi?.collections || [];
  const itemsByColl = collectionsApi?.itemsByCollection || {};

  const hardOwned    = cols.find(c => c.type === "owned"    && c.isSystem) || null;
  const hardSold     = cols.find(c => c.type === "sold"     && c.isSystem) || null;
  const hardWishlist = cols.find(c => c.type === "wishlist" && c.isSystem) || null;

  const openManualEntry = (kind) => {
    setManualEntryKind(kind);
    setManualEntryOpen(true);
  };
  const openPicker = (cid, title) => {
    setPickerCollectionId(cid);
    setPickerTitle(title || "Add to collection");
    setPickerOpen(true);
  };

  // ── Sub-tab dispatch ──────────────────────────────────────────
  let body;
  if (subTab === "my-collection") {
    body = (
      <MyCollectionView
        owned={hardOwned}
        sold={hardSold}
        ownedItems={hardOwned ? (itemsByColl[hardOwned.id] || []) : []}
        soldItems={hardSold   ? (itemsByColl[hardSold.id]   || []) : []}
        watchlist={watchlist}
        compact={compact}
        gridStyle={gridStyle}
        primaryCurrency={primaryCurrency}
        handleShare={handleShare}
        handleWish={handleWish}
        observeCard={observeCard}
        onClickListing={onClickListing}
        openCollectionPicker={openCollectionPicker}
        onAddManual={openManualEntry}
        onAddFromFeed={(cid, title) => openPicker(cid, title)}
        onMarkSold={(rowId, item) => setSoldTarget({ rowId, item })}
        onRemoveItem={(cid, item) => collectionsApi.removeItemFromCollection(cid, item.id)}
      />
    );
  } else if (subTab === "wishlist") {
    body = (
      <WishlistView
        wishlist={hardWishlist}
        wishlistItems={hardWishlist ? (itemsByColl[hardWishlist.id] || []) : []}
        onAddFromFeed={() => hardWishlist && openPicker(hardWishlist.id, "Add to Shortlist")}
        onReorder={(orderedIds) => hardWishlist && collectionsApi.reorderItems(hardWishlist.id, orderedIds)}
        onRemove={(item) => hardWishlist && collectionsApi.removeItemFromCollection(hardWishlist.id, item.id)}
      />
    );
  } else if (subTab === "lists") {
    body = (
      <ListsView
        cols={cols}
        itemsByColl={itemsByColl}
        hiddenItems={hiddenItems}
        watchlist={watchlist}
        toggleHide={toggleHide}
        compact={compact}
        gridStyle={gridStyle}
        primaryCurrency={primaryCurrency}
        handleShare={handleShare}
        handleWish={handleWish}
        openCollectionPicker={openCollectionPicker}
        observeCard={observeCard}
        onClickListing={onClickListing}
        startCreateCollection={startCreateCollection}
        setEditingCollection={setEditingCollection}
        deleteCollection={collectionsApi?.deleteCollection}
        removeItemFromCollection={collectionsApi?.removeItemFromCollection}
        selectedListId={selectedListId}
        setSelectedListId={setSelectedListId}
      />
    );
  } else if (subTab === "challenges") {
    body = (
      <ChallengesView
        user={user}
        isAuthConfigured={isAuthConfigured}
        signInWithGoogle={signInWithGoogle}
        collectionsApi={collectionsApi}
        allListings={allListings}
        watchlist={watchlist}
        hidden={hidden}
        primaryCurrency={primaryCurrency}
        handleShare={handleShare}
        pendingChallengeDrillId={pendingChallengeDrillId}
        clearPendingChallengeDrill={clearPendingChallengeDrill}
      />
    );
  }

  return (
    <div style={{ paddingTop: 4 }}>
      {body}
      <ManualEntryForm
        open={manualEntryOpen}
        onClose={() => setManualEntryOpen(false)}
        kind={manualEntryKind}
        inp={inp}
        uploadWatchPhoto={collectionsApi?.uploadWatchPhoto}
        addManualItem={collectionsApi?.addManualItem}
        collectionId={
          manualEntryKind === "sold" ? hardSold?.id : hardOwned?.id
        }
      />
      <ListingPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={pickerTitle}
        watchItems={watchItems}
        collections={cols}
        itemsByCollection={itemsByColl}
        allListings={allListings}
        primaryCurrency={primaryCurrency}
        onPick={(listing) => collectionsApi?.addItemToCollection(pickerCollectionId, listing)}
      />
      <MarkAsSoldModal
        open={!!soldTarget}
        onClose={() => setSoldTarget(null)}
        item={soldTarget?.item}
        inp={inp}
        onConfirm={(opts) => collectionsApi?.markItemAsSold(soldTarget.rowId, opts)}
      />
    </div>
  );
}

// ── My watches sub-tab (UI label — internal `my-collection`) ─────
// Owned + Sold combined into one grid with a three-state toggle
// (Owned / Sold / All). The toggle drives both the visible items
// AND the +Add CTAs (so + From feed and + Add a watch target the
// active list). When toggle = "all", the grid shows owned items
// first, then sold items, with a divider; +Add CTAs target Owned
// (sensible default — "all" is a viewing mode, not an adding mode).
function MyCollectionView({
  owned, sold,
  ownedItems, soldItems,
  watchlist, compact, gridStyle, primaryCurrency,
  handleShare, handleWish, observeCard, onClickListing,
  openCollectionPicker,
  onAddManual, onAddFromFeed, onMarkSold, onRemoveItem,
}) {
  const [toggle, setToggle] = useState("owned"); // "owned" | "sold" | "all"
  const targetCollectionId = toggle === "sold" ? sold?.id : owned?.id;
  const targetKind = toggle === "sold" ? "sold" : "owned";
  const targetName = toggle === "sold" ? "Sold" : "Owned";

  const ownedTotal = ownedItems.reduce(
    (s, it) => s + (Number(it.savedPriceUSD) || Number(it.price) || 0), 0);
  const soldTotal = soldItems.reduce(
    (s, it) => s + (Number(it.soldPrice) || Number(it.savedPriceUSD) || Number(it.price) || 0), 0);

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 14px 12px",
        borderBottom: "0.5px solid var(--border)",
        marginBottom: 12, flexWrap: "wrap",
      }}>
        {/* Toggle pills — Owned / Sold / All */}
        <div style={{ display: "flex", gap: 4 }}>
          {[
            ["owned", `Owned (${ownedItems.length})`],
            ["sold",  `Sold (${soldItems.length})`],
            ["all",   `All (${ownedItems.length + soldItems.length})`],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setToggle(key)}
              style={{
                padding: "5px 12px", borderRadius: 999,
                border: "0.5px solid var(--border)",
                background: toggle === key ? "var(--text1)" : "transparent",
                color: toggle === key ? "var(--bg)" : "var(--text2)",
                cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                fontWeight: toggle === key ? 600 : 500,
              }}>{label}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {targetCollectionId && (
          <>
            <button onClick={() => onAddFromFeed(targetCollectionId, `Add to ${targetName}`)}
              style={{
                border: "0.5px solid var(--border)", background: "transparent",
                color: "var(--text2)", padding: "4px 10px", borderRadius: 6,
                cursor: "pointer", fontFamily: "inherit", fontSize: 12,
              }}>+ From feed</button>
            <button onClick={() => onAddManual(targetKind)}
              style={{
                border: "none", background: "#185FA5", color: "#fff",
                padding: "4px 10px", borderRadius: 6,
                cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 500,
              }}>+ Add a watch</button>
          </>
        )}
      </div>

      {/* Empty state */}
      {ownedItems.length === 0 && soldItems.length === 0 ? (
        <div style={{ padding: "48px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🕰</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: "var(--text1)" }}>
            Build your collection
          </div>
          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 380, margin: "0 auto 16px" }}>
            Add watches you currently own and watches you've sold. Pick from the feed for anything bought via a tracked dealer, or enter manually with a photo for off-platform watches.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => onAddFromFeed(owned?.id, "Add to Owned")}
              style={{
                border: "0.5px solid var(--border)", background: "transparent",
                color: "var(--text2)", padding: "8px 16px", borderRadius: 8,
                cursor: "pointer", fontFamily: "inherit", fontSize: 13,
              }}>+ From feed</button>
            <button onClick={() => onAddManual("owned")}
              style={{
                border: "none", background: "#185FA5", color: "#fff",
                padding: "8px 16px", borderRadius: 8,
                cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500,
              }}>+ Add a watch</button>
          </div>
        </div>
      ) : (
        <>
          {(toggle === "owned" || toggle === "all") && (
            <Section
              label={`Owned · ${ownedItems.length}${ownedTotal > 0 ? ` · ${fmtUSD(ownedTotal)} total` : ""}`}
              show={toggle === "all"}
            >
              {ownedItems.length === 0 ? (
                <EmptyHardListSection text="No watches in Owned yet." />
              ) : (
                <CollectionGrid
                  items={ownedItems}
                  collectionId={owned?.id}
                  watchlist={watchlist}
                  compact={compact}
                  gridStyle={gridStyle}
                  primaryCurrency={primaryCurrency}
                  handleShare={handleShare}
                  handleWish={handleWish}
                  observeCard={observeCard}
                  onClickListing={onClickListing}
                  openCollectionPicker={openCollectionPicker}
                  hideLabel="Remove from list"
                  onMarkSold={onMarkSold}
                  onRemoveItem={onRemoveItem}
                />
              )}
            </Section>
          )}
          {(toggle === "sold" || toggle === "all") && (
            <Section
              label={`Sold · ${soldItems.length}${soldTotal > 0 ? ` · ${fmtUSD(soldTotal)} total` : ""}`}
              show={toggle === "all"}
            >
              {soldItems.length === 0 ? (
                <EmptyHardListSection text="No watches in Sold yet." />
              ) : (
                <CollectionGrid
                  items={soldItems}
                  collectionId={sold?.id}
                  watchlist={watchlist}
                  compact={compact}
                  gridStyle={gridStyle}
                  primaryCurrency={primaryCurrency}
                  handleShare={handleShare}
                  handleWish={handleWish}
                  observeCard={observeCard}
                  onClickListing={onClickListing}
                  openCollectionPicker={openCollectionPicker}
                  hideLabel="Remove from list"
                  onRemoveItem={onRemoveItem}
                />
              )}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

// ── Wishlist sub-tab ─────────────────────────────────────────────
function WishlistView({ wishlist, wishlistItems, onAddFromFeed, onReorder, onRemove }) {
  if (!wishlist) {
    return (
      <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text2)", fontSize: 13 }}>
        Shortlist not yet ready — refresh to retry the auto-create.
      </div>
    );
  }
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 14px 12px",
        borderBottom: "0.5px solid var(--border)",
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
          Shortlist
        </span>
        <span style={{ fontSize: 12, color: "var(--text3)" }}>
          {wishlistItems.length} watch{wishlistItems.length === 1 ? "" : "es"}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={onAddFromFeed}
          style={{
            border: "none", background: "#185FA5", color: "#fff",
            padding: "4px 10px", borderRadius: 6,
            cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 500,
          }}>+ From feed</button>
      </div>
      {wishlistItems.length === 0 ? (
        <div style={{ padding: "48px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>★</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: "var(--text1)" }}>
            Shortlist is empty
          </div>
          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 360, margin: "0 auto 16px" }}>
            Pin a representative example — live or recently-sold from the feed — for each reference you'd like to add to your collection. Force-rank with the up/down buttons. The Shortlist is the deck you scenario-plan against your owned set.
          </div>
        </div>
      ) : (
        <WishlistRankedList
          items={wishlistItems}
          onReorder={onReorder}
          onRemove={onRemove}
        />
      )}
    </div>
  );
}

function WishlistRankedList({ items, onReorder, onRemove }) {
  if (items.length === 0) return null;
  const move = (idx, direction) => {
    const target = idx + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    onReorder(next.map(it => it.rowId));
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item, idx) => {
        const title = item.title
          || [item.brand, item.model].filter(Boolean).join(" ").trim()
          || "Untitled";
        const meta = [
          item.ref && `Ref ${item.ref}`,
          item.material,
          item.price != null && `${item.currency || ""} ${Number(item.price).toLocaleString()}`.trim(),
        ].filter(Boolean).join(" · ");
        return (
          <div key={item.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 12px", borderRadius: 10,
            border: "0.5px solid var(--border)", background: "var(--card-bg)",
          }}>
            <div style={{
              flexShrink: 0, width: 28, fontSize: 16, fontWeight: 600,
              color: "var(--text2)", textAlign: "center",
            }}>{idx + 1}</div>
            <div style={{
              flexShrink: 0, width: 56, height: 56, borderRadius: 6,
              background: "var(--surface)", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {item.img ? (
                <img src={item.img} alt="" loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 18, color: "var(--text3)" }}>⌚</span>
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 14, fontWeight: 500, color: "var(--text1)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{title}</div>
              {meta && (
                <div style={{
                  fontSize: 12, color: "var(--text2)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{meta}</div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
              <button onClick={() => move(idx, -1)} disabled={idx === 0}
                aria-label="Move up" title="Move up"
                style={rankBtnStyle(idx === 0)}>↑</button>
              <button onClick={() => move(idx, +1)} disabled={idx === items.length - 1}
                aria-label="Move down" title="Move down"
                style={rankBtnStyle(idx === items.length - 1)}>↓</button>
            </div>
            <button onClick={async () => {
              if (window.confirm(`Remove "${title}" from Shortlist?`)) await onRemove(item);
            }} aria-label="Remove" title="Remove"
              style={{
                flexShrink: 0,
                border: "none", background: "transparent",
                color: "var(--text3)", padding: 4,
                cursor: "pointer", fontFamily: "inherit", fontSize: 16,
                display: "flex", alignItems: "center",
              }}>×</button>
          </div>
        );
      })}
    </div>
  );
}

const rankBtnStyle = (disabled) => ({
  width: 24, height: 22,
  border: "0.5px solid var(--border)",
  background: "var(--surface)",
  color: disabled ? "var(--text3)" : "var(--text1)",
  cursor: disabled ? "default" : "pointer",
  fontFamily: "inherit", fontSize: 12,
  borderRadius: 4,
  display: "flex", alignItems: "center", justifyContent: "center",
  opacity: disabled ? 0.5 : 1,
});

// ── Lists sub-tab ─────────────────────────────────────────────────
// Existing list-of-lists pattern. Hard system lists (Owned/Sold/
// Wishlist) are excluded — they live in My Collection and Wishlist
// sub-tabs now. Shared inbox + user-created lists + Hidden synthetic
// row are surfaced.
function ListsView({
  cols, itemsByColl, hiddenItems,
  watchlist, toggleHide,
  compact, gridStyle, primaryCurrency,
  handleShare, handleWish,
  openCollectionPicker, observeCard, onClickListing,
  startCreateCollection, setEditingCollection,
  deleteCollection, removeItemFromCollection,
  selectedListId, setSelectedListId,
}) {
  const sharedInbox = cols.find(c => c.isSharedInbox) || null;
  const userCols = cols.filter(c =>
    !c.isSharedInbox && !c.isSystem && c.type !== "challenge"
  );
  const hiddenRow = (hiddenItems && hiddenItems.length > 0) ? {
    id: HIDDEN_COLLECTION_ID, name: "Hidden", isHidden: true,
  } : null;

  const selected = (() => {
    if (!selectedListId) return null;
    if (selectedListId === HIDDEN_COLLECTION_ID) return hiddenRow;
    return cols.find(c => c.id === selectedListId) || null;
  })();

  if (selected) {
    const isHiddenColl = selected.id === HIDDEN_COLLECTION_ID;
    const items = isHiddenColl ? hiddenItems : (itemsByColl[selected.id] || []);
    return (
      <div style={{ paddingTop: 4 }}>
        <div style={{
          display: "flex", alignItems: "baseline", gap: 12,
          padding: "14px 14px 12px",
          borderBottom: "0.5px solid var(--border)",
          marginBottom: 12,
        }}>
          <button onClick={() => setSelectedListId(null)} style={{
            border: "none", background: "transparent", cursor: "pointer",
            color: "#185FA5", fontFamily: "inherit", fontSize: 13, padding: 0,
          }}>← All lists</button>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
            {selected.name}
          </span>
          <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto" }}>
            {items.length}
          </span>
          {!selected.isSharedInbox && !isHiddenColl && (
            <>
              <button onClick={() => setEditingCollection({ id: selected.id, name: selected.name })}
                title="Rename list"
                style={{
                  border: "0.5px solid var(--border)", background: "transparent",
                  color: "var(--text2)", padding: "4px 10px", borderRadius: 6,
                  cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                }}>Rename</button>
              <button onClick={async () => {
                  if (!window.confirm(`Delete "${selected.name}"? Items inside aren't deleted from your watchlist; they're just unbundled from this list.`)) return;
                  await deleteCollection(selected.id);
                  setSelectedListId(null);
                }}
                style={{
                  border: "0.5px solid var(--border)", background: "transparent",
                  color: "#c0392b", padding: "4px 10px", borderRadius: 6,
                  cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                }}>Delete</button>
            </>
          )}
        </div>
        {items.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{isHiddenColl ? "👁" : "📂"}</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: "var(--text1)" }}>
              {isHiddenColl ? "Nothing hidden" : "Empty list"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 340, margin: "0 auto" }}>
              {isHiddenColl
                ? "Listings you hide from the Available feed land here. Use the \"…\" menu on any card to unhide it."
                : "Add watches via the \"…\" menu on any listing card → \"Add to list…\"."}
            </div>
          </div>
        ) : (
          <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
            {items.map(item => (
              <Card
                key={item.id}
                item={item}
                wished={!!watchlist[item.id]}
                onWish={handleWish}
                compact={compact}
                onHide={isHiddenColl
                  ? toggleHide
                  : () => removeItemFromCollection(selected.id, item.id)}
                hideLabel={isHiddenColl ? undefined : "Remove from list"}
                isHidden={isHiddenColl}
                onAddToCollection={openCollectionPicker}
                primaryCurrency={primaryCurrency}
                onShare={handleShare}
                onView={observeCard}
                onClickListing={onClickListing}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const visibleCols = [
    ...(sharedInbox ? [sharedInbox] : []),
    ...userCols,
    ...(hiddenRow ? [hiddenRow] : []),
  ];

  return (
    <div style={{ paddingTop: 4 }}>
      <SubTabIntro
        title="Lists group watches your way"
        blurb={<>Reference threads, dealer comps, "Rolex 5513s", "Vintage divers" — whatever cut helps you think. Add via the <strong style={{ color: "var(--text1)" }}>…</strong> menu on any card → <em>Add to list…</em>.</>}
        actionLabel="+ New list"
        onAction={startCreateCollection}
      />
      {visibleCols.length === 0 ? (
        <div style={{ padding: "32px 20px 48px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: "var(--text1)" }}>
            No lists yet
          </div>
          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 340, margin: "0 auto" }}>
            You haven't created any lists. Tap <strong style={{ color: "var(--text1)" }}>+ New list</strong> above to start one.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visibleCols.map(c => {
            const isInbox = c.isSharedInbox;
            const isHiddenRowItem = c.id === HIDDEN_COLLECTION_ID;
            const count = isHiddenRowItem
              ? hiddenItems.length
              : (itemsByColl[c.id] || []).length;
            const icon = isInbox ? inboxIcon : isHiddenRowItem ? eyeOffIcon : folderIcon;
            const subtitle = isInbox
              ? `${count} listing${count === 1 ? "" : "s"} shared with you`
              : isHiddenRowItem
                ? `${count} listing${count === 1 ? "" : "s"} hidden from feed`
                : `${count} watch${count === 1 ? "" : "es"}`;
            return (
              <ListRow
                key={c.id}
                icon={icon}
                title={c.name}
                subtitle={subtitle}
                onClick={() => setSelectedListId(c.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function Section({ label, show, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {show && (
        <div style={{
          display: "flex", alignItems: "baseline", gap: 12,
          padding: "10px 14px",
          borderBottom: "0.5px solid var(--border)",
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>{label}</span>
        </div>
      )}
      {children}
    </div>
  );
}

function EmptyHardListSection({ text }) {
  return (
    <div style={{
      padding: "32px 20px", textAlign: "center",
      fontSize: 12, color: "var(--text3)",
    }}>{text}</div>
  );
}

// CollectionGrid: shared grid render for hard-list items. Renders
// manual entries via ManualItemCard, listing-backed entries via Card
// with an optional Mark-sold action.
function CollectionGrid({
  items, collectionId, watchlist,
  compact, gridStyle, primaryCurrency,
  handleShare, handleWish, observeCard, onClickListing,
  openCollectionPicker,
  hideLabel,
  onMarkSold,
  onRemoveItem,
}) {
  return (
    <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
      {items.map(item => {
        const markSoldHandler = onMarkSold
          ? () => onMarkSold(item.rowId, item)
          : null;
        return item.isManual ? (
          <ManualItemCard
            key={item.id}
            item={item}
            onRemove={() => onRemoveItem(collectionId, item)}
            onMarkSold={markSoldHandler}
          />
        ) : (
          <Card
            key={item.id}
            item={item}
            wished={!!watchlist[item.id]}
            onWish={handleWish}
            compact={compact}
            onHide={() => onRemoveItem(collectionId, item)}
            hideLabel={hideLabel}
            onAddToCollection={openCollectionPicker}
            primaryCurrency={primaryCurrency}
            onShare={handleShare}
            onView={observeCard}
            onClickListing={onClickListing}
            extraMenuItems={markSoldHandler ? [{ label: "Mark sold", onClick: () => markSoldHandler() }] : undefined}
          />
        );
      })}
    </div>
  );
}

function ManualItemCard({ item, onRemove, onMarkSold }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const title = item.title || [item.brand, item.model].filter(Boolean).join(" ").trim() || "Untitled";
  const metaParts = [];
  if (item.ref) metaParts.push(`Ref ${item.ref}`);
  if (item.material) metaParts.push(item.material);
  const meta = metaParts.join(" · ");
  const priceLine = item.price != null
    ? `${item.currency || ""} ${Number(item.price).toLocaleString()}`.trim()
    : null;
  const soldLine = item.soldPrice != null
    ? `Sold ${item.currency || ""} ${Number(item.soldPrice).toLocaleString()}${item.soldDate ? ` · ${item.soldDate}` : ""}`.trim()
    : null;
  return (
    <div style={{
      position: "relative",
      border: "0.5px solid var(--border)", borderRadius: 10,
      background: "var(--card-bg)", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        aspectRatio: "1 / 1", background: "var(--surface)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {item.img ? (
          <img src={item.img} alt={title} loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 36, color: "var(--text3)" }}>⌚</span>
        )}
      </div>
      <div style={{ padding: "10px 12px 12px", flex: 1 }}>
        <div style={{
          fontSize: 13, fontWeight: 500, color: "var(--text1)",
          marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{title}</div>
        {meta && <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 2 }}>{meta}</div>}
        {priceLine && <div style={{ fontSize: 11, color: "var(--text2)" }}>Paid {priceLine}</div>}
        {soldLine && <div style={{ fontSize: 11, color: "var(--text2)" }}>{soldLine}</div>}
        {item.comments && (
          <div style={{
            fontSize: 11, color: "var(--text3)", marginTop: 6,
            lineHeight: 1.4, fontStyle: "italic",
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}>{item.comments}</div>
        )}
      </div>
      <div style={{ position: "absolute", top: 6, right: 6 }}>
        <button onClick={() => setMenuOpen(o => !o)}
          aria-label="More" style={{
            border: "none", background: "rgba(0,0,0,0.5)",
            color: "#fff", width: 26, height: 26, borderRadius: "50%",
            cursor: "pointer", fontSize: 14, fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>⋯</button>
        {menuOpen && (
          <div style={{
            position: "absolute", top: 30, right: 0,
            background: "var(--card-bg)",
            border: "0.5px solid var(--border)", borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            minWidth: 140, zIndex: 10,
          }}>
            {onMarkSold && (
              <button onClick={() => { setMenuOpen(false); onMarkSold(); }}
                style={menuItemStyle("var(--text1)")}>Mark sold</button>
            )}
            <button onClick={async () => {
              setMenuOpen(false);
              if (window.confirm("Remove this watch from the list?")) await onRemove();
            }} style={menuItemStyle("#c0392b")}>Remove</button>
          </div>
        )}
      </div>
    </div>
  );
}

const menuItemStyle = (color) => ({
  width: "100%", border: "none", background: "transparent",
  padding: "10px 12px", textAlign: "left",
  cursor: "pointer", fontFamily: "inherit", fontSize: 13,
  color,
});

// ── Inline icons (SVG) ──────────────────────────────────────────
const inboxIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
);

const folderIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const eyeOffIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.06 10.06 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
