import React, { useState, useEffect, useRef } from "react";
import { Card } from "./Card";
import { ListRow } from "./ListRow";
import { SubTabIntro } from "./SubTabIntro";
import { ChallengesView } from "./ChallengesView";
import { ManualEntryForm } from "./ManualEntryForm";
import { ListingPickerModal } from "./ListingPickerModal";
import { MarkAsSoldModal } from "./MarkAsSoldModal";
import { ManageListSheet } from "./ManageListSheet";
import { fmtUSD } from "../utils";
import { innerToggleButton, actionButton, signInButton } from "../styles";
import { EmptyState } from "./EmptyState";
import { Section } from "./Section";

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
  setEditingCollection,
  openCollectionPicker,
  startCreateCollection,
  observeCard,
  onClickListing,
  pendingChallengeDrillId,
  clearPendingChallengeDrill,
  collectionsSubTab,
  setCollectionsSubTab,
  tabResetTick,
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
  // List Sharing v2 / slice 2 — Manage list sheet state.
  const [manageListOpen, setManageListOpen] = useState(false);

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
  // (Hotfix 2026-05-07: was `props.tabResetTick`, but the component
  // destructures props at the top so `props` doesn't exist as a
  // variable — production white-screened with "props is not
  // defined". `tabResetTick` is now in the destructure list above.)
  useEffect(() => {
    if (tabResetTick && tabResetTick > 0) setSelectedListId(null);
    // eslint-disable-next-line
  }, [tabResetTick]);

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
      <EmptyState
        size="tall"
        heading="Sign in to organize your watches"
        blurb="Owned watches, watches you've sold, your wishlist, custom lists, challenges — all in one place. Sync across every device."
        action={isAuthConfigured && (
          <button onClick={signInWithGoogle} style={signInButton}>Sign in</button>
        )}
      />
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
  // Bundle 2A.2b 5→4 (2026-05-08): Shortlist consolidated into My
  // watches. Both "my-collection" and "wishlist" subTabs route to
  // MyCollectionView; the Owned/Sold/All/Shortlist toggle inside
  // determines which body renders. Routing "wishlist" here keeps
  // backward-compat URLs (?sub=wishlist) and stale localStorage
  // values working — the toggle initialises in shortlist mode
  // automatically via currentWatchTopTab.
  let body;
  if (subTab === "my-collection" || subTab === "wishlist") {
    body = (
      <MyCollectionView
        owned={hardOwned}
        sold={hardSold}
        ownedItems={hardOwned ? (itemsByColl[hardOwned.id] || []) : []}
        soldItems={hardSold   ? (itemsByColl[hardSold.id]   || []) : []}
        wishlist={hardWishlist}
        wishlistItems={hardWishlist ? (itemsByColl[hardWishlist.id] || []) : []}
        onShortlistAddFromFeed={() => hardWishlist && openPicker(hardWishlist.id, "Add to Shortlist")}
        onShortlistReorder={(orderedIds) => hardWishlist && collectionsApi.reorderItems(hardWishlist.id, orderedIds)}
        onShortlistRemove={(item) => hardWishlist && collectionsApi.removeItemFromCollection(hardWishlist.id, item.id)}
        currentWatchTopTab={subTab}
        setWatchTopTab={setCollectionsSubTab}
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
  } else if (subTab === "lists") {
    body = (
      <ListsView
        user={user}
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
        setManageListOpen={setManageListOpen}
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
        onConfirm={(opts) => collectionsApi?.markItemAsSold(soldTarget.rowId, opts)}
      />
      {/* List Sharing v2 / slice 2 — Manage list sheet. Renders only
          when manageListOpen is true; opened from the list drill-in
          "Manage" button. The sheet itself fetches the collaborator
          roster on open via collectionsApi.listCollaborators. */}
      <ManageListSheet
        open={manageListOpen}
        onClose={() => setManageListOpen(false)}
        user={user}
        collection={selectedListId
          ? cols.find(c => c.id === selectedListId) || null
          : null}
        inviteCollaborator={collectionsApi?.inviteCollaborator}
        revokeCollaborator={collectionsApi?.revokeCollaborator}
        listCollaborators={collectionsApi?.listCollaborators}
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
  // Bundle 2A.2b 5→4 (2026-05-08) — Shortlist consolidated into
  // My watches as a fourth toggle option. The wishlist collection
  // + items + reorder/remove handlers thread through here so the
  // Shortlist view renders inside this component.
  wishlist, wishlistItems, onShortlistAddFromFeed, onShortlistReorder, onShortlistRemove,
  // Active sub-tab (watchTopTab) — used to derive the toggle's
  // initial active state. When watchTopTab="wishlist" we show the
  // Shortlist view; otherwise the Owned/Sold/All cluster.
  currentWatchTopTab, setWatchTopTab,
  watchlist, compact, gridStyle, primaryCurrency,
  handleShare, handleWish, observeCard, onClickListing,
  openCollectionPicker,
  onAddManual, onAddFromFeed, onMarkSold, onRemoveItem,
}) {
  // Toggle state. "shortlist" is driven by watchTopTab="wishlist"
  // (so URL syncs); "owned" / "sold" / "all" are local state.
  const [localToggle, setLocalToggle] = useState("owned");
  const isShortlist = currentWatchTopTab === "wishlist";
  const toggle = isShortlist ? "shortlist" : localToggle;
  const setToggle = (next) => {
    if (next === "shortlist") {
      if (typeof setWatchTopTab === "function") setWatchTopTab("wishlist");
    } else {
      // Coming back from shortlist into owned/sold/all — bounce
      // watchTopTab to my-collection so the URL syncs to the
      // owned/sold view.
      if (isShortlist && typeof setWatchTopTab === "function") {
        setWatchTopTab("my-collection");
      }
      setLocalToggle(next);
    }
  };
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
        {/* Toggle pills — Owned / Sold / All / Shortlist
            (Bundle 2A.2b 5→4: Shortlist folded into this toggle so
            the strip drops the standalone Shortlist sub-tab.) */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[
            ["owned",     `Owned (${ownedItems.length})`],
            ["sold",      `Sold (${soldItems.length})`],
            ["all",       `All (${ownedItems.length + soldItems.length})`],
            ["shortlist", `Shortlist (${(wishlistItems || []).length})`],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setToggle(key)}
              style={innerToggleButton(toggle === key)}>{label}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {/* +Add CTAs: Owned/Sold target the corresponding hard list;
            Shortlist targets the wishlist collection via the
            shortlist add-from-feed handler. "All" shows no +Add (the
            user picks Owned or Sold first). */}
        {toggle === "shortlist" && wishlist && (
          <button onClick={onShortlistAddFromFeed} style={actionButton({ variant: "primary" })}>+ From feed</button>
        )}
        {toggle !== "shortlist" && targetCollectionId && (
          <>
            {/* Mark feedback 2026-05-07: From feed is the more
                common path and should be the highlighted primary
                button; Add a watch is the secondary fallback for
                manual entry of pieces not in the feed. */}
            <button onClick={() => onAddManual(targetKind)} style={actionButton()}>+ Add a watch</button>
            <button onClick={() => onAddFromFeed(targetCollectionId, `Add to ${targetName}`)}
              style={actionButton({ variant: "primary" })}>+ From feed</button>
          </>
        )}
      </div>

      {/* Body — Shortlist mode renders the ranked list; Owned/Sold/All
          modes render the Section-grouped grids. Empty-states are
          per-mode so an empty Sold list doesn't hide a non-empty
          Shortlist (and vice versa). */}
      {toggle === "shortlist" ? (
        !wishlist ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text2)", fontSize: 13 }}>
            Shortlist not yet ready — refresh to retry the auto-create.
          </div>
        ) : (wishlistItems || []).length === 0 ? (
          <EmptyState
            icon="★"
            heading="Shortlist is empty"
            blurb="Pin a representative example — live or recently-sold from the feed — for each reference you'd like to add to your collection. Force-rank with the up/down buttons. The Shortlist is the deck you scenario-plan against your owned set."
            action={
              <button onClick={onShortlistAddFromFeed} style={actionButton({ variant: "primary" })}>+ From feed</button>
            }
          />
        ) : (
          <WishlistRankedList
            items={wishlistItems}
            onReorder={onShortlistReorder}
            onRemove={onShortlistRemove}
          />
        )
      ) : ownedItems.length === 0 && soldItems.length === 0 ? (
        <EmptyState
          icon="🕰"
          heading="Build your collection"
          blurb="Add watches you currently own and watches you've sold. Pick from the feed for anything bought via a tracked dealer, or enter manually with a photo for off-platform watches."
          action={
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => onAddFromFeed(owned?.id, "Add to Owned")} style={actionButton()}>+ From feed</button>
              <button onClick={() => onAddManual("owned")} style={actionButton({ variant: "primary" })}>+ Add a watch</button>
            </div>
          }
        />
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

// ── Shortlist ranked-list view ───────────────────────────────────
// Standalone WishlistView wrapper retired in Bundle 2A.2b 5→4
// (2026-05-08) — Shortlist now renders inside MyCollectionView's
// toggle. The WishlistRankedList primitive below is reused there
// directly. The empty-state + "Shortlist not ready" branch logic
// moved up into MyCollectionView.
function WishlistRankedList({ items, onReorder, onRemove }) {
  if (items.length === 0) return null;
  const move = (idx, direction) => {
    const target = idx + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    onReorder(next.map(it => it.rowId));
  };
  // Mark feedback 2026-05-08: "Increase the card size on the
  // shortlist feature." Bumped image 56→128, padding 10/12 → 14/14,
  // title 14→15, meta 12→13, rank# 28w/16 → 36w/22 so the rows feel
  // like cards rather than dense list rows.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item, idx) => {
        const title = item.title
          || [item.brand, item.model].filter(Boolean).join(" ").trim()
          || "Untitled";
        const ref = item.ref ? `Ref ${item.ref}` : null;
        const priceText = item.price != null
          ? `${item.currency || ""} ${Number(item.price).toLocaleString()}`.trim()
          : null;
        return (
          <div key={item.id} style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "14px 14px", borderRadius: 12,
            border: "0.5px solid var(--border)", background: "var(--card-bg)",
          }}>
            <div style={{
              flexShrink: 0, width: 36, fontSize: 22, fontWeight: 700,
              color: "var(--text2)", textAlign: "center",
            }}>{idx + 1}</div>
            <div style={{
              flexShrink: 0, width: 128, height: 128, borderRadius: 10,
              background: "var(--surface)", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {item.img ? (
                <img src={item.img} alt="" loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 36, color: "var(--text3)" }}>⌚</span>
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 15, fontWeight: 600, color: "var(--text1)",
                overflow: "hidden", textOverflow: "ellipsis",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                marginBottom: 4,
              }}>{title}</div>
              {ref && (
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 2 }}>{ref}</div>
              )}
              {item.material && (
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 2 }}>{item.material}</div>
              )}
              {priceText && (
                <div style={{ fontSize: 14, color: "var(--text1)", fontWeight: 500, marginTop: 4 }}>{priceText}</div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
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
                color: "var(--text3)", padding: 8,
                cursor: "pointer", fontFamily: "inherit", fontSize: 20,
                display: "flex", alignItems: "center",
              }}>×</button>
          </div>
        );
      })}
    </div>
  );
}

const rankBtnStyle = (disabled) => ({
  width: 32, height: 28,
  border: "0.5px solid var(--border)",
  background: "var(--surface)",
  color: disabled ? "var(--text3)" : "var(--text1)",
  cursor: disabled ? "default" : "pointer",
  fontFamily: "inherit", fontSize: 14,
  borderRadius: 6,
  display: "flex", alignItems: "center", justifyContent: "center",
  opacity: disabled ? 0.5 : 1,
});

// ── Lists sub-tab ─────────────────────────────────────────────────
// Existing list-of-lists pattern. Hard system lists (Owned/Sold/
// Wishlist) are excluded — they live in My Collection and Wishlist
// sub-tabs now. Shared inbox + user-created lists + Hidden synthetic
// row are surfaced.
function ListsView({
  user,
  cols, itemsByColl, hiddenItems,
  watchlist, toggleHide,
  compact, gridStyle, primaryCurrency,
  handleShare, handleWish,
  openCollectionPicker, observeCard, onClickListing,
  startCreateCollection, setEditingCollection,
  deleteCollection, removeItemFromCollection,
  selectedListId, setSelectedListId,
  setManageListOpen,
}) {
  const sharedInbox = cols.find(c => c.isSharedInbox) || null;
  const userCols = cols.filter(c =>
    !c.isSharedInbox && !c.isSystem && c.type !== "challenge"
  );
  // Hidden synthetic row retired 2026-05-07 (Mark feedback): user-
  // facing Hide affordance was already removed in Bundle 2A.1
  // (admin-only); admin hides drop globally for everyone via the
  // `admin_hidden_listings` table; surfacing a per-user Hidden row
  // alongside Lists no longer adds value. Existing hidden_listings
  // rows in the DB are preserved (this is a UI-only change) — Mark
  // can drop them via the SQL editor when ready.
  const hiddenRow = null;

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
            color: "var(--brand)", fontFamily: "inherit", fontSize: 13, padding: 0,
          }}>← All lists</button>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
            {selected.name}
          </span>
          <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto" }}>
            {items.length}
          </span>
          {!selected.isSharedInbox && !isHiddenColl && (() => {
            // Owner-only actions vs collaborator-visible actions.
            // List Sharing v2 / slice 1: SELECT RLS now includes
            // accepted collaborators, so a "selected" list might not
            // be owned by the current user. Gate Manage / Rename /
            // Delete to the owner; collaborators only see Share.
            // Hotfix 2026-05-07: previously compared against
            // `selected.user_id` but the JS-side mapper exposes the
            // owner's id as `userId` (camelCase). Without `user`
            // also threaded into ListsView's destructure, this
            // referenced an undefined `user` and white-screened
            // every list view. Both fixed in the same hotfix.
            const isOwner = !!(user?.id && selected?.userId && user.id === selected.userId);
            return (
            <>
              {/* Share — copies a `?list=<id>&shared=1` link via the
                  Web Share API (or clipboard fallback). Recipients
                  land on ListReceiver which fetches via the public
                  `get_public_list` RPC. List Sharing v1, 2026-05-07. */}
              <button onClick={async () => {
                  const url = `${window.location.origin}/?list=${encodeURIComponent(selected.id)}&shared=1`;
                  const shareData = {
                    title: `${selected.name} — Watchlist`,
                    text: `${selected.name} — a list on Watchlist`,
                    url,
                  };
                  try {
                    if (navigator.share) {
                      await navigator.share(shareData);
                    } else if (navigator.clipboard) {
                      await navigator.clipboard.writeText(url);
                      window.alert("Link copied. Paste it anywhere to share this list.");
                    }
                  } catch (e) {
                    if (e?.name !== "AbortError") {
                      try { await navigator.clipboard?.writeText(url); window.alert("Link copied."); }
                      catch { window.prompt("Copy this link to share:", url); }
                    }
                  }
                }}
                title="Share this list"
                style={actionButton({ variant: "primary" })}>Share</button>
              {/* Manage / Rename / Delete are owner-only. Collaborators
                  see the list + Share button only. */}
              {isOwner && (
                <>
                  <button onClick={() => setManageListOpen(true)}
                    title="Manage collaborators"
                    style={actionButton()}>Manage</button>
                  <button onClick={() => setEditingCollection({ id: selected.id, name: selected.name })}
                    title="Rename list"
                    style={actionButton()}>Rename</button>
                  <button onClick={async () => {
                      if (!window.confirm(`Delete "${selected.name}"? Items inside aren't deleted from your watchlist; they're just unbundled from this list.`)) return;
                      await deleteCollection(selected.id);
                      setSelectedListId(null);
                    }}
                    style={actionButton({ variant: "danger" })}>Delete</button>
                </>
              )}
            </>
            );
          })()}
        </div>
        {items.length === 0 ? (
          <EmptyState
            icon={isHiddenColl ? "👁" : "📂"}
            heading={isHiddenColl ? "Nothing hidden" : "Empty list"}
            blurb={isHiddenColl
              ? "Listings you hide from the Available feed land here. Use the \"…\" menu on any card to unhide it."
              : "Add watches via the \"…\" menu on any listing card → \"Add to list…\"."}
          />
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
        <EmptyState
          icon="📂"
          heading="No lists yet"
          blurb={<>You haven't created any lists. Tap <strong style={{ color: "var(--text1)" }}>+ New list</strong> above to start one.</>}
        />
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
// Section was extracted to ./Section.js on 2026-05-08 so other tabs
// can reuse the sub-section grouping. Imported at the top.

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
            }} style={menuItemStyle("var(--danger)")}>Remove</button>
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
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
);

const folderIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const eyeOffIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.06 10.06 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
