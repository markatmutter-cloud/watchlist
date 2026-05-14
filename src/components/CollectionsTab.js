import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabase";
import { Card } from "./Card";
import { ListRow } from "./ListRow";
import { SubTabIntro } from "./SubTabIntro";
import { ChallengesView } from "./ChallengesView";
import { ManualEntryForm } from "./ManualEntryForm";
import { ListingPickerModal } from "./ListingPickerModal";
import { MarkAsSoldModal } from "./MarkAsSoldModal";
import { ManageListSheet } from "./ManageListSheet";
import { WatchDetailSheet } from "./WatchDetailSheet";
import { ListReviewMode } from "./ListReviewMode";
import { fmtUSD, matchesSearch } from "../utils";
import { actionButton, signInButton } from "../styles";
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
// Saved virtual list (2026-05-08 IA pass). Shows the user's
// hearted watchlist_items as a permanent, non-deletable list at
// the top of Watchlists > Lists. Same synthetic-row pattern as
// the (now-retired) Hidden virtual list — data stays in
// watchlist_items, the surface is just a synthetic collection
// row. Don't add `__saved__` to any collection_items writes;
// it's UI-only.
const SAVED_COLLECTION_ID = "__saved__";

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
  // Filter row values (2026-05-09) for drill-in filtering. Passed
  // wholesale to ListsView so the same source/brand/price/sort
  // controls in the shell drive the visible items inside a list.
  filterValues,
  // App.js mirror — call with the current drill-in id (or null) so
  // the shell can render the filter row when we're drilled in.
  onDrillInChange,
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
  // Watch management v1 (2026-05-09) — WatchDetailSheet state.
  // Stores rowId rather than the item snapshot so an in-sheet edit
  // (image upload, listing-link, description, etc.) re-derives the
  // item from itemsByCollection and re-renders without a close-reopen.
  const [detailRowId, setDetailRowId] = useState(null);

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

  // Mirror drill-in id up to App.js so the shell can show the filter
  // row when we're inside a list. Reports the active drill-in only
  // when on the Lists sub-tab; null otherwise.
  useEffect(() => {
    if (typeof onDrillInChange !== "function") return;
    onDrillInChange(subTab === "lists" ? selectedListId : null);
  }, [subTab, selectedListId, onDrillInChange]);

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

  // Re-derive the active detail-sheet item from live itemsByCollection
  // so in-sheet edits (image upload, listing-link, description, etc.)
  // refresh the sheet immediately. Lookup by rowId; fall back to null
  // when the row has been removed (sheet's open flag goes false).
  const detailItem = detailRowId
    ? Object.values(itemsByColl).flat().find(it => it.rowId === detailRowId) || null
    : null;

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
        collections={cols}
        itemsByCollection={itemsByColl}
        toggleFlagForSale={collectionsApi?.toggleFlagForSale}
        onShortlistAddFromFeed={() => hardWishlist && openPicker(hardWishlist.id, "Add to Shortlist")}
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
        onClickDetail={(item) => setDetailRowId(item.rowId)}
        addItemToWants={(item) => hardWishlist
          ? collectionsApi.addItemToCollection(hardWishlist.id, item)
          : Promise.resolve({ error: 'no wishlist' })}
      />
    );
  } else if (subTab === "lists") {
    body = (
      <ListsView
        user={user}
        cols={cols}
        itemsByColl={itemsByColl}
        hiddenItems={hiddenItems}
        watchItems={watchItems}
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
        setDetailRowId={setDetailRowId}
        filterValues={filterValues}
        fetchListMembers={collectionsApi?.fetchListMembers}
        fetchReactions={collectionsApi?.fetchReactions}
        toggleReaction={collectionsApi?.toggleReaction}
        fetchReactionCounts={collectionsApi?.fetchReactionCounts}
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
    // No paddingTop here — each inner view (ListsView / MyWatchesView /
    // ChallengesView) already adds `paddingTop: 4` so the SubTabIntro
    // banner lines up with the Searches sub-tab in WatchlistTab. Adding
    // 4px here too made these three sub-tabs sit 4px lower than Searches
    // (Mark feedback 2026-05-11).
    <div>
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
      {/* Watch management v1 (2026-05-09) — per-watch detail sheet.
          Opens when a card is clicked in My Watches. Carries the
          full collection_items shape; the sheet itself reads the
          read-only fields + offers Edit Description / Edit Thoughts /
          Flag for sale / Mark sold / Remove + Journal. */}
      <WatchDetailSheet
        open={!!detailItem}
        item={detailItem}
        onClose={() => setDetailRowId(null)}
        isMobile={typeof window !== "undefined" && window.innerWidth < 768}
        updateWatchDetails={collectionsApi?.updateWatchDetails}
        uploadWatchPhoto={collectionsApi?.uploadWatchPhoto}
        toggleFlagForSale={collectionsApi?.toggleFlagForSale}
        removeItemFromCollection={collectionsApi?.removeItemFromCollection}
        markItemAsSold={detailItem ? (rowId, item) => {
          setSoldTarget({ rowId, item });
          setDetailRowId(null);
        } : undefined}
        collectionId={detailItem?.isManual
          ? (detailItem?.soldDate ? hardSold?.id : hardOwned?.id)
          : null}
        fetchComments={collectionsApi?.fetchComments}
        postComment={collectionsApi?.postComment}
        deleteComment={collectionsApi?.deleteComment}
        user={user}
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
  wishlist, wishlistItems, onShortlistAddFromFeed, onShortlistRemove,
  // 2026-05-10 plan rebuild: the Shortlist picker draws from
  // Favorites + every user list, not just hearts. Need the live
  // collections + per-collection items maps to populate the chips.
  collections, itemsByCollection,
  // 2026-05-10: ↑-flag-for-sale gesture on Keeping/Selling cards.
  toggleFlagForSale,
  // Active sub-tab (watchTopTab) — used to derive the toggle's
  // initial active state. The "wishlist" URL value maps to the new
  // "plan" toggle (Plan view contains Wants which is wishlistItems).
  currentWatchTopTab, setWatchTopTab,
  watchlist, compact, gridStyle, primaryCurrency,
  handleShare, handleWish, observeCard, onClickListing,
  openCollectionPicker,
  onAddManual, onAddFromFeed, onMarkSold, onRemoveItem,
  onClickDetail,
  addItemToWants,
}) {
  // Watch-management v1 (2026-05-09 — Mark spec). Toggle restructured
  // from `Owned / Sold / All / Shortlist` (which conflated three
  // distinct user jobs) into `Collection / Archive / Plan`:
  //   - Collection: what I have now (was Owned)
  //   - Archive:    what I've owned in the past (was Sold)
  //   - Plan:       what's next — Keeping vs Selling vs Wants
  // The legacy "All" combined view is gone; the legacy "Shortlist"
  // surface folds into Plan > Wants.
  //
  // URL backward-compat: `?sub=wishlist` still routes to Plan (the
  // old shortlist URL keeps working). New users land on Collection.
  const [localToggle, setLocalToggle] = useState("collection");
  const isPlanRouting = currentWatchTopTab === "wishlist";
  const toggle = isPlanRouting ? "plan" : localToggle;
  const setToggle = (next) => {
    if (next === "plan") {
      if (typeof setWatchTopTab === "function") setWatchTopTab("wishlist");
    } else {
      if (isPlanRouting && typeof setWatchTopTab === "function") {
        setWatchTopTab("my-collection");
      }
      setLocalToggle(next);
    }
  };
  const targetCollectionId = toggle === "archive" ? sold?.id : owned?.id;
  const targetKind = toggle === "archive" ? "sold" : "owned";
  const targetName = toggle === "archive" ? "Archive" : "Collection";

  const ownedTotal = ownedItems.reduce(
    (s, it) => s + (Number(it.savedPriceUSD) || Number(it.price) || 0), 0);
  const soldTotal = soldItems.reduce(
    (s, it) => s + (Number(it.soldPrice) || Number(it.savedPriceUSD) || Number(it.price) || 0), 0);
  const wantsTotal = (wishlistItems || []).reduce(
    (s, it) => s + (Number(it.savedPriceUSD) || Number(it.price) || 0), 0);

  // Total count drives the SubTabIntro's expand state — empty
  // user gets the explainer; non-empty user gets a compact
  // collapsed title row.
  const myWatchesTotal = ownedItems.length + soldItems.length + (wishlistItems || []).length;
  return (
    // paddingTop:4 added 2026-05-11 to match the other Saved sub-tabs
    // (Lists, Challenges, etc.) that use the same outer wrapper.
    // Was a bare <div> here — made My Watches' SubTabIntro sit 4px
    // higher than the others. Mark feedback: "the expanding
    // descriptors on the watchlist subtabs" don't line up.
    <div style={{ paddingTop: 4 }}>
      <SubTabIntro
        title="My Watches"
        blurb={<>
          Three views over your collection. <strong>Collection</strong> is what
          you own today. <strong>Archive</strong> is what you've sold.
          <strong> Plan</strong> is what you're thinking about next — the
          watches you'd sell, the watches you'd buy, and the cash impact if
          you make those moves.
          <br/>
          Add a watch with <strong>+ Add a watch</strong> (off-platform — upload
          a photo) or <strong>+ From feed</strong> (pull in a tracked dealer
          listing). Tap any tile for the detail sheet — your thoughts,
          buy/sell numbers, P&amp;L, and a dated journal.
        </>}
        expandable
        defaultExpanded={myWatchesTotal === 0}
      />
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "8px 0 14px",
        marginBottom: 8, flexWrap: "wrap",
      }}>
        {/* Segmented control — Collection / Archive / Plan.
            Restyled 2026-05-10 from inner-pill chips so the primary
            nav inside My Watches reads as a distinct block. Mark
            feedback: pills read as filter chips, not as the primary
            axis people are picking between. */}
        <div style={{
          display: "inline-flex",
          background: "var(--surface)",
          border: "0.5px solid var(--border)",
          borderRadius: 10,
          padding: 3,
          flexShrink: 0,
        }}>
          {[
            ["collection", "Collection", ownedItems.length],
            ["archive",    "Archive",    soldItems.length],
            ["plan",       "Plan",       null],
          ].map(([key, label, count]) => {
            const active = toggle === key;
            return (
              <button key={key} onClick={() => setToggle(key)}
                style={{
                  border: "none",
                  background: active ? "var(--bg)" : "transparent",
                  color: active ? "var(--text1)" : "var(--text2)",
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontFamily: "inherit", fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                <span>{label}</span>
                {count != null && (
                  <span style={{
                    fontSize: 11, fontWeight: 500,
                    color: "var(--text3)",
                    background: active ? "var(--surface)" : "transparent",
                    padding: "1px 6px", borderRadius: 999,
                    minWidth: 18, textAlign: "center",
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        {/* +Add CTAs scope to the active toggle. Plan view shows
            "+ From feed" pulling into Wants (shortlist), with a
            secondary "+ Add a watch" for manual entries. Collection
            and Archive show their existing add-flows. */}
        {toggle === "plan" && wishlist && (
          <>
            <button onClick={() => onAddManual("owned")} style={actionButton()}>+ Add a watch</button>
            <button onClick={onShortlistAddFromFeed} style={actionButton({ variant: "primary" })}>+ From feed</button>
          </>
        )}
        {toggle !== "plan" && targetCollectionId && (
          <>
            <button onClick={() => onAddManual(targetKind)} style={actionButton()}>+ Add a watch</button>
            <button onClick={() => onAddFromFeed(targetCollectionId, `Add to ${targetName}`)}
              style={actionButton({ variant: "primary" })}>+ From feed</button>
          </>
        )}
      </div>

      {/* Body — three branches matching the toggle. */}
      {toggle === "plan" ? (
        <PlanView
          ownedItems={ownedItems}
          ownedTotal={ownedTotal}
          wishlist={wishlist}
          wishlistItems={wishlistItems || []}
          wantsTotal={wantsTotal}
          compact={compact}
          gridStyle={gridStyle}
          primaryCurrency={primaryCurrency}
          watchlist={watchlist}
          collections={collections}
          itemsByCollection={itemsByCollection}
          toggleFlagForSale={toggleFlagForSale}
          handleShare={handleShare}
          handleWish={handleWish}
          observeCard={observeCard}
          onClickListing={onClickListing}
          openCollectionPicker={openCollectionPicker}
          onShortlistAddFromFeed={onShortlistAddFromFeed}
          onShortlistRemove={onShortlistRemove}
          onMarkSold={onMarkSold}
          onRemoveItem={onRemoveItem}
          onClickDetail={onClickDetail}
          addItemToWants={addItemToWants}
        />
      ) : toggle === "collection" ? (
        ownedItems.length === 0 ? (
          <EmptyState
            icon="🕰"
            heading="Your collection"
            blurb="Add watches you currently own. Pick from the feed for anything bought via a tracked dealer, or enter manually with a photo for off-platform watches."
            action={
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => onAddFromFeed(owned?.id, "Add to Collection")} style={actionButton()}>+ From feed</button>
                <button onClick={() => onAddManual("owned")} style={actionButton({ variant: "primary" })}>+ Add a watch</button>
              </div>
            }
          />
        ) : (
          <>
            <CollectionSummary
              label="Collection"
              count={ownedItems.length}
              totalUSD={ownedTotal}
            />
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
              hideLabel="Remove from collection"
              onMarkSold={onMarkSold}
              onRemoveItem={onRemoveItem}
              onClickDetail={onClickDetail}
            />
          </>
        )
      ) : (
        // Archive
        soldItems.length === 0 ? (
          <EmptyState
            icon="📁"
            heading="No archive yet"
            blurb="Watches you've owned and sold land here. Mark a watch in your Collection as sold to start your archive."
          />
        ) : (
          <>
            <CollectionSummary
              label="Archive"
              count={soldItems.length}
              totalUSD={soldTotal}
            />
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
              hideLabel="Remove from archive"
              onRemoveItem={onRemoveItem}
              onClickDetail={onClickDetail}
            />
          </>
        )
      )}
    </div>
  );
}

// Stat-card row above Collection / Archive grids. Mark spec
// 2026-05-10: surface total value front-and-centre, not buried in
// a Section label. Same shape as the PlanView running totals.
// Average-price card dropped 2026-05-12 (Mark): low signal next to
// count + total.
function CollectionSummary({ label, count, totalUSD }) {
  const cards = [
    [`${label} count`, `${count}`, count === 1 ? "watch" : "watches"],
    [`Total value`, fmtUSD(totalUSD || 0), label === "Archive" ? "lifetime sold value" : "estimated portfolio value"],
  ];
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
      gap: 8,
      padding: "0 0 16px",
    }}>
      {cards.map(([title, value, hint]) => (
        <div key={title} style={{
          padding: "10px 12px",
          borderRadius: 10,
          background: "var(--surface)",
          border: "0.5px solid var(--border)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {title}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text1)", marginTop: 2 }}>
            {value}
          </div>
          {hint && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{hint}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Plan view ────────────────────────────────────────────────────
// Watch management v1 (2026-05-09); rebuilt 2026-05-10 from Mark's
// user-test feedback. Three vertically-stacked sections + a
// "Select from your lists" picker below:
//
//   - Keeping:   owned items NOT flagged for sale
//   - Selling:   owned items WITH flagged_for_sale=true
//   - Shortlist: wishlist items (was "Wants" — Mark renamed
//                2026-05-10 because shortlist reads more naturally)
//   - Picker:    chip group across Favorites + every user list,
//                tap a tile to add it to the Shortlist
//
// Running totals at the top:
//   Keeping  = assumed_sell_value (or savedPrice fallback) for keeping
//   Selling  = assumed_sell_value (or savedPrice fallback) for flagged
//   Shortlist = savedPrice across wishlist items
//   Net cash = Selling − Shortlist  (cash impact if all moves happen)
//   Future   = Keeping + Shortlist  (collection value after moves)
//
// Movement gestures:
//   Keeping → Selling: ↑ overlay button on each card (one tap), or
//                      detail-sheet → Flag for sale
//   Selling → Keeping: ↑ overlay (active red) tap, or detail sheet
//   Shortlist → Owned: planned future — needs a "Mark as bought"
//                      flow that promotes the row to Keeping
//   Shortlist → Removed: card ⋯ menu has "Remove from shortlist"
//
// The picker below the sections sources from Favorites + each
// user list (not just hearts — Mark spec). Tap → addItemToWants.

function PlanView({
  ownedItems, ownedTotal,
  wishlist, wishlistItems, wantsTotal,
  compact, gridStyle, primaryCurrency,
  watchlist, handleShare, handleWish, observeCard, onClickListing,
  openCollectionPicker,
  collections, itemsByCollection,
  toggleFlagForSale,
  onShortlistAddFromFeed,
  onShortlistRemove,
  onMarkSold,
  onRemoveItem,
  onClickDetail,
  addItemToWants,
}) {
  // Split owned by flag.
  const keeping = ownedItems.filter(it => !it.flaggedForSale);
  const selling = ownedItems.filter(it => !!it.flaggedForSale);

  const valueOf = (it) => Number(it.assumedSellValue)
    || Number(it.savedPriceUSD) || Number(it.priceUSD)
    || Number(it.savedPrice) || Number(it.price) || 0;
  const keepingValue = keeping.reduce((s, it) => s + valueOf(it), 0);
  const sellingValue = selling.reduce((s, it) => s + valueOf(it), 0);
  // wantsTotal already computed upstream from wishlistItems' savedPrice.
  const netCash = sellingValue - wantsTotal;
  const futureValue = keepingValue + wantsTotal;

  const colHeader = (label, value, hint, color) => (
    <div style={{
      padding: "10px 12px",
      borderRadius: 10,
      background: "var(--surface)",
      border: "0.5px solid var(--border)",
      marginBottom: 10,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color || "var(--text1)", marginTop: 2 }}>
        {fmtUSD(value || 0)}
      </div>
      {hint && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{hint}</div>}
    </div>
  );

  const sectionGridStyle = {
    ...gridStyle,
    // Plan columns are narrower than the regular grid; force a tighter
    // min-width so the cards don't blow out the column.
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    borderRadius: 10, overflow: "hidden",
  };

  return (
    <div style={{ paddingTop: 4 }}>
      {/* Summary row: 3 totals + net cash + future value */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 8,
        padding: "0 0 16px",
      }}>
        {colHeader("Keeping", keepingValue, `${keeping.length} watch${keeping.length === 1 ? "" : "es"}`)}
        {colHeader("Selling", sellingValue,
          `${selling.length} flagged · proceeds`,
          selling.length > 0 ? "var(--accent-positive)" : undefined)}
        {colHeader("Shortlist", wantsTotal,
          `${wishlistItems.length} watch${wishlistItems.length === 1 ? "" : "es"} · cost`,
          wishlistItems.length > 0 ? "var(--danger)" : undefined)}
        {colHeader(
          "Net cash impact",
          netCash,
          netCash >= 0 ? "if you do the moves, you'd gain cash" : "if you do the moves, you'd spend cash",
          netCash >= 0 ? "var(--accent-positive)" : "var(--danger)"
        )}
        {colHeader("Future collection value", futureValue,
          "what your collection would be worth after the moves")}
      </div>

      {/* Keeping */}
      <Section
        label={`Keeping · ${keeping.length}${keepingValue > 0 ? ` · ${fmtUSD(keepingValue)} total` : ""}`}
        show={true}
      >
        <SectionExplain text="Watches currently in your collection. Tap ↑ on a card to flag it for sale; the card slides down into Selling and stops counting toward Keeping value." />
        {keeping.length === 0 ? (
          <EmptyHardListSection text="No watches in Keeping. Anything you flag for sale moves to the Selling section." />
        ) : (
          <CollectionGrid
            items={keeping}
            collectionId={null /* mixed */ }
            watchlist={watchlist}
            compact={compact}
            gridStyle={sectionGridStyle}
            primaryCurrency={primaryCurrency}
            handleShare={handleShare}
            handleWish={handleWish}
            observeCard={observeCard}
            onClickListing={onClickListing}
            openCollectionPicker={openCollectionPicker}
            hideLabel="Remove from collection"
            onMarkSold={onMarkSold}
            onRemoveItem={onRemoveItem}
            onClickDetail={onClickDetail}
            quickActionFor={toggleFlagForSale ? () => ({
              icon: "↑", label: "Flag for sale",
              active: false,
              onClick: (it) => toggleFlagForSale(it.rowId, true),
            }) : undefined}
          />
        )}
      </Section>

      {/* Selling */}
      <Section
        label={`Selling · ${selling.length}${sellingValue > 0 ? ` · ${fmtUSD(sellingValue)} expected` : ""}`}
        show={true}
      >
        <SectionExplain text="Owned watches you've flagged for sale. Tap ↑ (red) to keep instead. The detail sheet has the assumed sell value field — set it so the proceeds total reads accurately." />
        {selling.length === 0 ? (
          <EmptyHardListSection text="Nothing flagged for sale yet. Tap ↑ on any Keeping card or open the detail sheet → Flag for sale." />
        ) : (
          <CollectionGrid
            items={selling}
            collectionId={null}
            watchlist={watchlist}
            compact={compact}
            gridStyle={sectionGridStyle}
            primaryCurrency={primaryCurrency}
            handleShare={handleShare}
            handleWish={handleWish}
            observeCard={observeCard}
            onClickListing={onClickListing}
            openCollectionPicker={openCollectionPicker}
            hideLabel="Remove from collection"
            onMarkSold={onMarkSold}
            onRemoveItem={onRemoveItem}
            onClickDetail={onClickDetail}
            quickActionFor={toggleFlagForSale ? () => ({
              icon: "↓", label: "Keep instead",
              active: true,
              onClick: (it) => toggleFlagForSale(it.rowId, false),
            }) : undefined}
          />
        )}
      </Section>

      {/* Shortlist (was "Wants" pre-2026-05-10) */}
      <Section
        label={`Shortlist · ${wishlistItems.length}${wantsTotal > 0 ? ` · ${fmtUSD(wantsTotal)} total` : ""}`}
        show={true}
      >
        <SectionExplain text="Watches you're considering buying next. Pick from your lists below, or use + From feed for the global feed." />
        {!wishlist ? (
          <EmptyHardListSection text="Plan not ready — refresh to retry the auto-create." />
        ) : wishlistItems.length === 0 ? (
          <EmptyState
            icon="★"
            heading="Empty shortlist"
            blurb="Pick a watch from one of your lists below, or tap + From feed to browse the global feed."
            action={
              <button onClick={onShortlistAddFromFeed} style={actionButton({ variant: "primary" })}>+ From feed</button>
            }
          />
        ) : (
          <CollectionGrid
            items={wishlistItems}
            collectionId={wishlist?.id}
            watchlist={watchlist}
            compact={compact}
            gridStyle={sectionGridStyle}
            primaryCurrency={primaryCurrency}
            handleShare={handleShare}
            handleWish={handleWish}
            observeCard={observeCard}
            onClickListing={onClickListing}
            openCollectionPicker={openCollectionPicker}
            hideLabel="Remove from shortlist"
            onClickDetail={onClickDetail}
            onRemoveOverride={(item) => onShortlistRemove(item)}
          />
        )}
      </Section>

      {/* Picker — replaces the old "Pool" (2026-05-10 Mark spec).
          Source chips for Favorites + every user list, not just
          hearts. Tap a tile → adds to the Shortlist. */}
      <ShortlistPickerSection
        wishlist={wishlist}
        wishlistItems={wishlistItems}
        watchlist={watchlist}
        collections={collections}
        itemsByCollection={itemsByCollection}
        compact={compact}
        primaryCurrency={primaryCurrency}
        addItemToWants={addItemToWants}
      />
    </div>
  );
}

function SectionExplain({ text }) {
  return (
    <div style={{
      fontSize: 11, color: "var(--text3)",
      padding: "0 4px 8px", lineHeight: 1.5,
    }}>{text}</div>
  );
}

// Shortlist picker — Mark spec 2026-05-10 (replaces the
// hearts-only "Pool"). Surfaces chips for Favorites + each
// user list; the active chip's items render as a tile grid
// below. Tap any tile to promote it into the Shortlist.
function ShortlistPickerSection({
  wishlist, wishlistItems, watchlist,
  collections, itemsByCollection,
  compact, primaryCurrency,
  addItemToWants,
}) {
  const [source, setSource] = React.useState("favorites");
  const [expanded, setExpanded] = React.useState(false);
  const [busyIds, setBusyIds] = React.useState(() => new Set());
  if (!wishlist) return null;

  const inWants = new Set((wishlistItems || []).map(it => it.id));

  // User lists eligible to source from. Match ListingPickerModal's
  // rule — exclude shared inbox, hard system lists, and challenges.
  // The shortlist itself is a system list so it's filtered out.
  const userLists = (collections || []).filter(c =>
    !c.isSharedInbox && !c.isSystem && c.type !== "challenge"
  );

  // Resolve candidate items for the active source.
  let candidates;
  if (source === "favorites") {
    candidates = Object.values(watchlist || {});
  } else {
    candidates = itemsByCollection?.[source] || [];
  }
  candidates = candidates
    .filter(it => it && it.id && !inWants.has(it.id))
    .sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));

  const SHOW = expanded ? candidates.length : Math.min(24, candidates.length);
  const visible = candidates.slice(0, SHOW);

  const onAdd = async (item) => {
    if (!addItemToWants || busyIds.has(item.id)) return;
    setBusyIds(prev => { const n = new Set(prev); n.add(item.id); return n; });
    await addItemToWants(item);
    // Optimistic update upstream removes the item from the source
    // (favorites case is special — adding to Shortlist doesn't
    // un-heart, so the item stays visible until inWants picks it
    // up on next render. That's fine, busy stays set and re-tap
    // is a no-op.)
  };

  return (
    <Section
      label="Select from your lists"
      show={true}
    >
      <SectionExplain text="Pick a watch from your hearted set or any of your lists. Tapping a tile copies it into your Shortlist (it stays where it was too)." />
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 6,
        marginBottom: 10, padding: "0 4px",
      }}>
        <PickerChip active={source === "favorites"} label="♥ Favorites"
          onClick={() => { setSource("favorites"); setExpanded(false); }} />
        {userLists.map(c => (
          <PickerChip key={c.id} active={source === c.id} label={c.name}
            onClick={() => { setSource(c.id); setExpanded(false); }} />
        ))}
      </div>
      {candidates.length === 0 ? (
        <EmptyState
          size="compact"
          heading={source === "favorites" ? "Nothing saved yet" : "This list is empty"}
          blurb={source === "favorites"
            ? "Heart a watch in the Listings tab and it'll show up here, ready to drop into the shortlist."
            : "Add a watch to this list and you'll be able to pick it from here next time."}
        />
      ) : (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 8,
          }}>
            {visible.map(item => (
              <PoolCard
                key={item.id}
                item={item}
                busy={busyIds.has(item.id)}
                onAdd={() => onAdd(item)}
                primaryCurrency={primaryCurrency}
              />
            ))}
          </div>
          {candidates.length > SHOW && !expanded && (
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button onClick={() => setExpanded(true)} style={actionButton()}>
                Show all {candidates.length}
              </button>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function PickerChip({ active, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0,
      padding: "5px 11px", borderRadius: 999,
      border: "0.5px solid var(--border)",
      background: active ? "var(--text1)" : "transparent",
      color: active ? "var(--bg)" : "var(--text1)",
      cursor: "pointer", fontFamily: "inherit", fontSize: 12,
      whiteSpace: "nowrap",
    }}>{label}</button>
  );
}

function PoolCard({ item, busy, onAdd, primaryCurrency }) {
  const title = item.title
    || [item.brand, item.model].filter(Boolean).join(" ").trim()
    || (item.ref || "Untitled");
  const priceLine = item.savedPriceUSD || item.priceUSD
    ? fmtUSD(item.savedPriceUSD || item.priceUSD) : null;
  return (
    <button onClick={onAdd} disabled={busy}
      style={{
        all: "unset", display: "flex", flexDirection: "column",
        cursor: busy ? "wait" : "pointer",
        border: "0.5px solid var(--border)", borderRadius: 10,
        background: "var(--card-bg)", overflow: "hidden",
        opacity: busy ? 0.5 : 1,
        position: "relative",
      }}>
      <div style={{
        aspectRatio: "1 / 1", background: "var(--surface)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {item.img ? (
          <img src={item.img} alt={title} loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <img src="/favicon-192.png" alt="" aria-hidden="true"
            style={{ width: "44%", maxWidth: 56, opacity: 0.5 }} />
        )}
      </div>
      <div style={{ padding: "8px 10px 10px", flex: 1, width: "100%", textAlign: "left" }}>
        {item.source && (
          <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
            {item.source}
          </div>
        )}
        <div style={{
          fontSize: 12, fontWeight: 500, color: "var(--text1)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          marginBottom: 2,
        }}>{title}</div>
        {priceLine && (
          <div style={{ fontSize: 11, color: "var(--text2)" }}>{priceLine}</div>
        )}
      </div>
      <div style={{
        position: "absolute", top: 6, right: 6,
        background: "rgba(0,0,0,0.55)", color: "#fff",
        width: 22, height: 22, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 600,
      }}>↑</div>
    </button>
  );
}


// Per-list view-mode preferences (flat vs buckets) retired
// 2026-05-14 with the Review panel — buckets are the only view now
// on shared lists. The DEFAULT_LIST_VIEW_STATE / load / save helpers
// here were the last consumers; removed in the same pass. Stale
// `dial_list_view_state_<listId>` localStorage entries become dead
// data (harmless).

// Default bucket density (Mark spec 2026-05-14): Lists buckets
// render in GRID mode by default, with a "Linear view" toggle for
// users who prefer the horizontal slider per-bucket. Inverts the
// previous slider-default behaviour — Mark's reasoning: when you're
// drilled INTO a specific list, you want to see everything in that
// list at a glance; the slider was hiding most of each bucket
// behind a scroll affordance. The Home page strips stay
// slider-only by nature — they're discovery surfaces with a
// "View all" handoff to the dedicated tab.
//
// BUCKET_TOGGLE_MIN — past this count the Linear/Grid toggle is
// exposed in the bucket header. Below it, slider vs grid look
// nearly identical so the toggle is hidden as noise.
const BUCKET_TOGGLE_MIN = 6;

const BUCKET_LABEL = {
  toReview: "To review",
  loved: "Loved",
  liked: "Liked",
  passed: "Passed",
};

// ShareMenu retired 2026-05-14 — replaced by a single flat Share
// button that opens the unified Share modal (ManageListSheet) for
// owners or fires the native share sheet directly for non-owners.
// Mark feedback: the dropdown chevron was too subtle and the
// "Share this list" + "Manage collaborators" split confused users
// when both end up surfacing the same kind of link.

// One bucket section in the Lists drill-in. Header mirrors the
// Listings tab's date-divider banner — same surface band, label
// weight, and right-aligned count — so the two surfaces read as
// the same primitive when scanning. The density toggle hangs off
// the right of the count on buckets that pass the size threshold.
function BucketSection({
  label, count,
  isGrid, showDensitySwitch, onToggleDensity,
  gridStyle, items, renderItem, isMobile,
}) {
  return (
    <section>
      <div style={{
        // 2026-05-14: match the Listings tab date-divider banner so
        // bucket headers and date dividers read as the same primitive
        // when scanning. Surface background + baseline alignment +
        // count pushed to far right (above the density toggle).
        gridColumn: "1/-1",
        display: "flex", alignItems: "baseline", gap: 12,
        padding: "14px 14px 12px",
        borderBottom: "0.5px solid var(--border)",
        background: "var(--surface)",
        marginBottom: 4,
      }}>
        <span style={{
          fontSize: 14, fontWeight: 600,
          color: "var(--text1)",
        }}>
          {label}
        </span>
        <span style={{
          fontSize: 12, color: "var(--text3)",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 400,
          marginLeft: "auto",
        }}>
          {count}
        </span>
        {showDensitySwitch && (
          <button
            onClick={onToggleDensity}
            aria-label={isGrid ? "Switch to linear view" : "Switch to grid view"}
            style={{
              // Match the Home "View all" pill (HomeTab.js) — Mark
              // feedback 2026-05-14: the bucket toggle had grown
              // too heavy after the produced-CTA pass and clashed
              // with Home's lighter pills. Same hairline outline +
              // weight + tracking + radius 999.
              flexShrink: 0, cursor: "pointer", fontFamily: "inherit",
              fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
              padding: "6px 12px", borderRadius: 999,
              border: "0.5px solid var(--text2)",
              background: "transparent",
              color: "var(--text2)",
              display: "inline-flex", alignItems: "center", gap: 6,
              lineHeight: 1,
            }}>
            {isGrid ? (
              <>
                {/* Linear / row icon — three horizontal bars. */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" aria-hidden="true">
                  <line x1="4" y1="7" x2="20" y2="7"/>
                  <line x1="4" y1="12" x2="20" y2="12"/>
                  <line x1="4" y1="17" x2="20" y2="17"/>
                </svg>
                Linear view
              </>
            ) : (
              <>
                {/* Grid icon — 2x2 squares. */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinejoin="round" aria-hidden="true">
                  <rect x="3.5" y="3.5" width="7" height="7"/>
                  <rect x="13.5" y="3.5" width="7" height="7"/>
                  <rect x="3.5" y="13.5" width="7" height="7"/>
                  <rect x="13.5" y="13.5" width="7" height="7"/>
                </svg>
                Grid view
              </>
            )}
          </button>
        )}
      </div>
      {isGrid ? (
        <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
          {items.map(renderItem)}
        </div>
      ) : (
        // Tile sizing matches the Home page strips (HomeTab.js) —
        // Mark spec 2026-05-14: Linear view should read at the same
        // scale as Home, ~7 tiles visible on a typical desktop
        // viewport instead of the wider ~4-tile pattern that was
        // here before. Mobile: 44% flex-basis / 180px cap. Desktop:
        // fixed 210px so the slider feels intentional at any width.
        <div
          style={{
            display: "flex",
            gap: 1,
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            padding: "0 14px 8px",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {items.map((it) => (
            <div key={it.id} style={isMobile ? {
              flex: "0 0 44%", maxWidth: 180,
              scrollSnapAlign: "start",
              background: "var(--card-bg)",
            } : {
              flex: "0 0 210px",
              scrollSnapAlign: "start",
              background: "var(--card-bg)",
            }}>
              {renderItem(it)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Lists sub-tab ─────────────────────────────────────────────────
// Existing list-of-lists pattern. Hard system lists (Owned/Sold/
// Wishlist) are excluded — they live in My Collection and Wishlist
// sub-tabs now. Shared inbox + user-created lists + Hidden synthetic
// row are surfaced.
function ListsView({
  user,
  cols, itemsByColl, hiddenItems,
  watchItems,
  watchlist, toggleHide,
  compact, gridStyle, primaryCurrency,
  handleShare, handleWish,
  openCollectionPicker, observeCard, onClickListing,
  startCreateCollection, setEditingCollection,
  deleteCollection, removeItemFromCollection,
  selectedListId, setSelectedListId,
  setManageListOpen,
  // Watch-detail sheet trigger from inside the drill-in (tap card
  // in screening mode opens the detail sheet). Lives in
  // CollectionsTab state; threaded through so the screening
  // overlay can fire it.
  setDetailRowId,
  // Filter row values from App.js. Same shape useFilters exposes.
  // Applied to drilled-in items via applyDrillInFilters below.
  filterValues,
  // (Slice 4) — fetch members for the active drill-in so the
  // who_added chip can resolve user_id → display_name.
  fetchListMembers,
  // Reactions on shared list items (2026-05-10).
  fetchReactions,
  toggleReaction,
  fetchReactionCounts,
}) {
  // One-at-a-time recipient review mode (Mark spec 2026-05-11).
  // Triggered by the recipient banner's "Start review" CTA. Opens a
  // fullscreen overlay walking through items the current user hasn't
  // reacted to yet. Closed via Done / ESC / completing the queue.
  const [reviewModeOpen, setReviewModeOpen] = useState(false);
  // Screening v1.2 (2026-05-13). isWide drives inline-on-desktop
  // (vs fullscreen portal on mobile) for the screening surface.
  // screeningResetTick is incremented when the user resets their
  // reactions mid-screen — used as a React key on ListReviewMode so
  // the component remounts with a fresh queue snapshot.
  const [isWide, setIsWide] = useState(() =>
    typeof window !== "undefined" && window.innerWidth >= 900
  );
  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [screeningResetTick, setScreeningResetTick] = useState(0);
  // Whether the next screening pass walks ALL items or just unreacted
  // ones (Mark spec 2026-05-14 re-screen fix). Set true when the
  // user taps Review on a fully-reacted list; otherwise resume.
  const [screenAllMode, setScreenAllMode] = useState(false);
  // Per-bucket density override (in-memory only). `expanded` flips a
  // bucket from slider → grid even when its count is ≤ threshold; the
  // opposite (force-slider when >threshold) is also stored here. Reset
  // on list change since "Liked is expanded" only makes sense in
  // context of the active list.
  const [bucketDensityOverride, setBucketDensityOverride] = useState({});
  useEffect(() => { setBucketDensityOverride({}); }, [selectedListId]);
  // Membership map for the active drill-in. Populated on drill-in
  // (best-effort — non-members get an empty array, which means no
  // chips). Used to resolve `whoAdded` user_id → display name.
  const [memberMap, setMemberMap] = useState(() => new Map());
  const [memberCount, setMemberCount] = useState(0);
  useEffect(() => {
    if (!selectedListId
        || selectedListId === HIDDEN_COLLECTION_ID
        || selectedListId === SAVED_COLLECTION_ID
        || !fetchListMembers) {
      setMemberMap(new Map());
      setMemberCount(0);
      return undefined;
    }
    let cancelled = false;
    fetchListMembers(selectedListId).then(({ members }) => {
      if (cancelled) return;
      const m = new Map();
      for (const row of (members || [])) {
        m.set(row.user_id, row.user_name || row.user_email || "Member");
      }
      setMemberMap(m);
      setMemberCount(m.size);
    });
    return () => { cancelled = true; };
  }, [selectedListId, fetchListMembers]);

  // Reactions for the active drill-in (2026-05-10). Loaded only on
  // shared lists (memberCount >= 2) since solo lists don't need
  // them. Realtime subscription pushes co-collaborator reactions
  // live so the wife/whoever sees Mark's tap immediately.
  //
  // 2026-05-10 hardening: subscription set up + teardown wrapped in
  // try/catch so a transient supabase-realtime issue (stale token,
  // websocket failure, etc.) doesn't crash the drill-in. Any error
  // logs to console; the user gets a non-realtime view of reactions
  // and can still toggle their own (toggleReaction does its own
  // round-trip + setReactionsByItem updates locally on the next
  // refetch).
  const [reactionsByItem, setReactionsByItem] = useState(() => new Map());
  useEffect(() => {
    if (!selectedListId
        || selectedListId === HIDDEN_COLLECTION_ID
        || selectedListId === SAVED_COLLECTION_ID
        || !fetchReactions
        || memberCount < 2) {
      setReactionsByItem(new Map());
      return undefined;
    }
    let cancelled = false;
    const reload = async () => {
      try {
        const { rows } = await fetchReactions(selectedListId);
        if (cancelled) return;
        const map = new Map();
        for (const r of (rows || [])) {
          if (!r || !r.collection_item_id) continue;
          if (!map.has(r.collection_item_id)) map.set(r.collection_item_id, []);
          map.get(r.collection_item_id).push(r);
        }
        setReactionsByItem(map);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("reactions reload failed", e);
      }
    };
    reload();
    // Realtime subscription on collection_item_reactions. We can't
    // filter server-side by collection_id (the table joins to
    // collection_items for that), so we listen to all changes and
    // refetch — the RPC's RLS gates membership so we only see our
    // own collections' reactions anyway. Wrap the channel build in
    // try/catch so a setup error never crashes the render.
    let channel = null;
    try {
      if (supabase && typeof supabase.channel === "function") {
        channel = supabase
          .channel(`reactions-${selectedListId}`)
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'collection_item_reactions' },
            () => reload())
          .subscribe();
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("reactions realtime subscribe failed", e);
      channel = null;
    }
    return () => {
      cancelled = true;
      if (channel && supabase && typeof supabase.removeChannel === "function") {
        try { supabase.removeChannel(channel); }
        catch (e) { /* swallow — cleanup shouldn't crash */ }
      }
    };
  }, [selectedListId, fetchReactions, memberCount]);

  const onToggleReaction = React.useCallback(async (itemId, emoji) => {
    if (!toggleReaction) return;
    await toggleReaction(itemId, emoji);
    // Realtime will refetch; no optimistic update needed.
  }, [toggleReaction]);

  const sharedInbox = cols.find(c => c.isSharedInbox) || null;
  const userCols = cols.filter(c =>
    !c.isSharedInbox && !c.isSystem && c.type !== "challenge"
  );

  // 2026-05-10 — per-list count of reactions by other people.
  // Surfaces on the list row as a small chip so a glance at the
  // Lists view tells you which lists have new collaborator activity
  // ("how do I know Jackie reacted?"). Excludes the user's own
  // reactions server-side; RLS gates membership.
  const [otherReactionCounts, setOtherReactionCounts] = useState(() => new Map());
  useEffect(() => {
    if (!user || !fetchReactionCounts) {
      setOtherReactionCounts(new Map());
      return undefined;
    }
    let cancelled = false;
    fetchReactionCounts().then(({ counts }) => {
      if (cancelled) return;
      setOtherReactionCounts(counts || new Map());
    });
    return () => { cancelled = true; };
  }, [user?.id, fetchReactionCounts, selectedListId]);
  // selectedListId in deps so closing a drill-in (which is when the
  // viewer just saw the latest reactions) re-fetches counts. The
  // count surfaces "since I last looked" implicitly because every
  // list-view return refreshes the count.

  // 2026-05-10 — Mark spec: list rows with at least one accepted
  // collaborator render with a two-person icon (and a "· shared"
  // suffix on the subtitle). Owner-side query returns rows where
  // the user owns the list; collaborator-side returns the user's
  // own accepted row. RLS on collection_collaborators handles both
  // cases — sharedListIds contains the collection ids that should
  // render the people icon.
  const [sharedListIds, setSharedListIds] = useState(() => new Set());
  // Ephemeral share-link copied toast — replaces the old window.alert
  // on share button presses. Auto-clears after 2s.
  const [shareCopied, setShareCopied] = useState(false);
  useEffect(() => {
    if (!shareCopied) return undefined;
    const t = setTimeout(() => setShareCopied(false), 2000);
    return () => clearTimeout(t);
  }, [shareCopied]);
  useEffect(() => {
    if (!user || !supabase || userCols.length === 0) {
      setSharedListIds(new Set());
      return undefined;
    }
    let cancelled = false;
    supabase.from('collection_collaborators')
      .select('collection_id')
      .eq('status', 'accepted')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('shared-list ids load failed', error);
          return;
        }
        setSharedListIds(new Set((data || []).map(r => r.collection_id)));
      });
    return () => { cancelled = true; };
  // userCols.length is the cheap signal that a list was added/removed.
  // eslint-disable-next-line
  }, [user?.id, userCols.length]);

  // Hidden synthetic row retired 2026-05-07 (Mark feedback): user-
  // facing Hide affordance was already removed in Bundle 2A.1
  // (admin-only); admin hides drop globally for everyone via the
  // `admin_hidden_listings` table; surfacing a per-user Hidden row
  // alongside Lists no longer adds value. Existing hidden_listings
  // rows in the DB are preserved (this is a UI-only change) — Mark
  // can drop them via the SQL editor when ready.
  const hiddenRow = null;

  // Saved virtual row (2026-05-08 IA pass). Permanent, non-
  // deletable, sits at the top of the lists ahead of Shared with
  // me + user lists. Backed by watchlist_items (via watchItems
  // prop) — same Approach A pattern as the old Hidden virtual
  // row. Drilling in renders the user's hearted listings as a
  // Card grid.
  const savedRow = user ? {
    id: SAVED_COLLECTION_ID,
    name: "Saved",
    isSystem: true,
    isSaved: true,
  } : null;

  const selected = (() => {
    if (!selectedListId) return null;
    if (selectedListId === HIDDEN_COLLECTION_ID) return hiddenRow;
    if (selectedListId === SAVED_COLLECTION_ID) return savedRow;
    return cols.find(c => c.id === selectedListId) || null;
  })();

  if (selected) {
    const isHiddenColl = selected.id === HIDDEN_COLLECTION_ID;
    const isSavedColl  = selected.id === SAVED_COLLECTION_ID;
    // Saved virtual list: show every hearted item (dealer + auction).
    // Filter by membership in the user's watchlist map — that's the
    // source of truth. Mark report 2026-05-11: previously used
    // `!_isTrackedLot` which excluded hearted auction lots because
    // the auctionLotItems projection sets that flag on every lot,
    // and the flag survives into the listing_snapshot stored in
    // watchlist_items. Using watchlist[id] avoids the conflation —
    // tracked-but-not-hearted lots (placeholders, untracked-by-paste)
    // aren't in watchlist, so they're correctly excluded.
    const rawItems = isHiddenColl ? hiddenItems
                : isSavedColl  ? (watchItems || []).filter(i => !!watchlist[i.id])
                : (itemsByColl[selected.id] || []);
    // Apply the shell filter row (date/price sort, $ min-max,
    // source, brand, search) to the drilled-in items so the filter
    // pills above the grid actually narrow the visible set.
    // 2026-05-09 IA pass.
    const items = applyDrillInFilters(rawItems, filterValues);
    // Owner-only actions vs collaborator-visible actions. List Sharing
    // v2 / slice 1: SELECT RLS now includes accepted collaborators, so
    // a "selected" list might not be owned by the current user. Gate
    // Manage / Rename / Delete to the owner; collaborators only see
    // Share.
    const isOwner = !!(user?.id && selected?.userId && user.id === selected.userId);
    const showActions = !selected.isSharedInbox && !isHiddenColl && !isSavedColl;
    // Recipient context (Mark feedback 2026-05-11): when the viewing
    // user is a collaborator on someone else's shared list, frame the
    // page as a "you've been asked for your take" surface rather than
    // a clone of the owner's view. Drives a banner above the cards and
    // a "To review" bucket pinned to the top.
    const isSharedList = memberCount >= 2;
    const isRecipient = isSharedList && !isOwner && !isHiddenColl && !isSavedColl;
    const ownerName = (selected?.userId && memberMap.get(selected.userId)) || "Someone";
    const myUserId = user?.id || null;
    const itemHasMyReaction = (item) => {
      if (!myUserId) return false;
      const rs = reactionsByItem.get(item.rowId) || [];
      return rs.some(r => r.user_id === myUserId);
    };
    const myReactedCount = isRecipient
      ? items.reduce((acc, i) => acc + (itemHasMyReaction(i) ? 1 : 0), 0)
      : 0;
    // Share callback — copies a `?list=<id>&shared=1` link via the Web
    // Share API (or clipboard fallback). Recipients land on
    // ListReceiver which fetches via the public `get_public_list` RPC.
    const triggerShare = async () => {
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
          setShareCopied(true);
        }
      } catch (e) {
        if (e?.name !== "AbortError") {
          try { await navigator.clipboard?.writeText(url); setShareCopied(true); }
          catch { window.prompt("Copy this link to share:", url); }
        }
      }
    };
    // My reactions on this list — used by the Manage panel's
    // "Reset my reactions" action. Mark spec 2026-05-14: Reset
    // **must not touch hearts**. Hearts (watchlist_items) are an
    // explicit "save this watch" signal that should never be wiped
    // by a list-level reset; the ❤️/🔥 rows in
    // collection_item_reactions exist (post-Slice-B) only as the
    // shared-list mirror of those hearts. Filter them out here so
    // every reset path (panel, ListReviewMode) sees only the Yes
    // (👍) / Pass (❌) verdicts.
    const myReactionsOnList = [];
    if (myUserId && reactionsByItem && isSharedList) {
      for (const [itemId, rs] of reactionsByItem.entries()) {
        for (const r of rs) {
          if (r.user_id !== myUserId) continue;
          if (r.emoji === "❤️" || r.emoji === "🔥") continue;
          myReactionsOnList.push({ itemId, emoji: r.emoji });
        }
      }
    }
    // Heart-on-shared-list also writes a ❤️ reaction (Mark spec
    // 2026-05-14 Slice B). On solo lists the heart stays private —
    // only watchlist_items moves — so this wrapper is a no-op there.
    // On shared lists the action stays "tap the heart once" from the
    // user's perspective; under the hood we sync the love-reaction
    // so other members see your hearts in the aggregate strip.
    //
    // Idempotent: reads the current reaction state before deciding
    // whether to insert or delete the ❤️ row, so out-of-sync legacy
    // data (a heart already in watchlist but no ❤️ reaction yet, or
    // vice versa) converges on the next toggle rather than getting
    // stuck. Both legacy emojis (❤️ and 🔥) are treated as "love"
    // when deciding what to clear.
    const wrappedHandleWish = (item) => {
      // Fire the underlying watchlist toggle first — this is what
      // the user sees as the primary effect. Errors from reaction
      // sync below don't block it.
      handleWish(item);
      if (!isSharedList || !item?.rowId || !myUserId || !onToggleReaction) return;
      const wasWished = !!watchlist[item.id];
      const willBeWished = !wasWished;
      const mine = (reactionsByItem.get(item.rowId) || [])
        .filter(r => r.user_id === myUserId
                  && (r.emoji === "❤️" || r.emoji === "🔥"));
      if (willBeWished && mine.length === 0) {
        // Heart was off → now on. Add a ❤️ reaction.
        Promise.resolve(onToggleReaction(item.rowId, "❤️")).catch(() => {});
      } else if (!willBeWished && mine.length > 0) {
        // Heart was on → now off. Remove every legacy love-reaction
        // row from this user (covers both ❤️ and 🔥 from old picker).
        for (const r of mine) {
          Promise.resolve(onToggleReaction(item.rowId, r.emoji)).catch(() => {});
        }
      }
    };

    // 2026-05-14: the inline overflow menu retired in favour of the
    // sectioned Manage panel (back link · title · ⋯ Manage). Every
    // action that used to live in the overflow now hangs off the
    // panel via props below: Reset / Manage collaborators / Rename
    // / Delete / Share / Screening trigger.
    //
    // Screening v1.3 (2026-05-13): on desktop with screening active,
    // hide the drill-in header (back link + list title + share + ⋯)
    // AND the recipient banner. Reasons (Mark feedback): the
    // screening overlay carries its own list-name header and Exit
    // link, the banner's "Review one at a time" CTA is redundant
    // once we're in screening, and the chrome was pushing the
    // interaction space below the fold. Mobile keeps the chrome
    // since screening portals over it anyway.
    const inlineScreeningActive = reviewModeOpen && isRecipient && isWide;
    return (
      <div style={{ paddingTop: 4 }}>
        {/* Drill-in header — single row layout (Mark feedback
            2026-05-13 "condense the discovery from its own line —
            maybe in line with the list name / all lists link"). Back
            link + title + discovery caption (recipient only) + Share +
            ⋯, all on one row. The recipient banner that previously
            occupied its own row is gone — the discovery caption + a
            small "Review →" CTA carry the same information inline.
            Hidden entirely when inline-screening on desktop. */}
        {!inlineScreeningActive && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            padding: "14px 14px 12px",
            borderBottom: "0.5px solid var(--border)",
            marginBottom: 12,
          }}>
            <button onClick={() => setSelectedListId(null)} style={{
              border: "none", background: "transparent", cursor: "pointer",
              color: "var(--brand)", fontFamily: "inherit", fontSize: 13, padding: 0,
              flexShrink: 0,
            }}>← All lists</button>
            <span style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
              fontSize: 18, fontWeight: 600,
              color: "var(--text1)",
              letterSpacing: "-0.01em",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              minWidth: 0,
            }}>
              {selected.name}
            </span>
            {/* Review + Reset cluster — Mark spec 2026-05-14: pair
                lives next to the list name (not at the far right
                with Share) so the relationship between them reads
                visually. "Reset ratings" spells out what Reset
                clears so the action isn't ambiguous next to other
                affordances. Share moves to the right edge by itself. */}
            {(isRecipient || myReactionsOnList.length > 0) && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                flexShrink: 0,
              }}>
                {isRecipient && (
                  <button
                    onClick={() => {
                      setScreenAllMode(myReactedCount >= items.length && items.length > 0);
                      setReviewModeOpen(true);
                      setScreeningResetTick(t => t + 1);
                    }}
                    title={myReactedCount >= items.length && items.length > 0
                      ? "Re-screen this list"
                      : "Walk through unreacted items one at a time"}
                    style={{
                      ...actionButton({ variant: "subtle" }),
                      flexShrink: 0,
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.6"
                      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    Review
                  </button>
                )}
                {myReactionsOnList.length > 0 && (
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Clear all ${myReactionsOnList.length} of your Yes / Pass ratings on this list? (Your hearts stay where they are.)`)) return;
                      await Promise.all(myReactionsOnList.map(({ itemId, emoji }) =>
                        onToggleReaction(itemId, emoji)));
                    }}
                    title={`Reset your ${myReactionsOnList.length} Yes / Pass ratings`}
                    style={{
                      ...actionButton({ variant: "subtle" }),
                      flexShrink: 0,
                      color: "var(--danger, #c0392b)",
                    }}>
                    Reset ratings
                  </button>
                )}
              </div>
            )}
            {isRecipient && items.length > 0 && myReactedCount < items.length && (
              <>
                <span style={{ color: "var(--text3)", fontSize: 13, flexShrink: 0 }}>·</span>
                <span style={{
                  fontSize: 12, color: "var(--text2)",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  minWidth: 0,
                }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <strong style={{ color: "var(--text1)", fontWeight: 500 }}>{ownerName}</strong> shared · {myReactedCount}/{items.length} reacted
                  </span>
                </span>
              </>
            )}
            <div style={{ flex: 1 }} />
            {shareCopied && (
              <span style={{
                fontSize: 12, color: "var(--brand)", fontWeight: 500,
                flexShrink: 0,
              }}>
                Link copied
              </span>
            )}
            {/* Share sits alone on the right — distribution action,
                separate from the "act on your reactions" pair above. */}
            {showActions && (
              <button onClick={isOwner ? () => setManageListOpen(true) : triggerShare}
                title="Share this list"
                style={{ ...actionButton({ variant: "primary" }), flexShrink: 0 }}>
                Share
              </button>
            )}
          </div>
        )}
        {reviewModeOpen && isRecipient && (
          <ListReviewMode
            key={screeningResetTick}
            items={items}
            listId={selected.id}
            listName={selected.name}
            ownerName={ownerName}
            currentUserId={user?.id || null}
            reactionsByItem={reactionsByItem}
            onToggleReaction={onToggleReaction}
            onClose={() => { setReviewModeOpen(false); setScreenAllMode(false); }}
            primaryCurrency={primaryCurrency}
            watchlist={watchlist}
            handleWish={wrappedHandleWish}
            openCollectionPicker={openCollectionPicker}
            onShare={handleShare}
            onOpenDetail={(item) => setDetailRowId(item.rowId)}
            screenAll={screenAllMode}
            onReset={async () => {
              if (!myUserId || !reactionsByItem || myReactionsOnList.length === 0) return;
              await Promise.all(myReactionsOnList.map(({ itemId, emoji }) =>
                onToggleReaction(itemId, emoji)));
              setScreeningResetTick(t => t + 1);
            }}
          />
        )}
        {/* On desktop, the screening surface replaces the drill-in
            body content area (Approach B per Mark 2026-05-13 — top
            wordmark + nav + filter row stay visible). Skip the grid
            entirely while inline-screening is active. On mobile the
            screening overlay portals to body, so the grid still
            renders underneath (covered visually). */}
        {(reviewModeOpen && isRecipient && isWide) ? null : items.length === 0 ? (
          <EmptyState
            icon={isHiddenColl ? "👁" : isSavedColl ? "♡" : "📂"}
            heading={isHiddenColl ? "Nothing hidden"
                    : isSavedColl ? "No saved watches yet"
                    : "Empty list"}
            blurb={isHiddenColl
              ? "Listings you hide from the Available feed land here. Use the \"…\" menu on any card to unhide it."
              : isSavedColl
                ? "Browse the Listings tab and tap the heart on any item — it'll appear here with the price you saved at, even after the dealer takes the URL down."
                : "Add watches via the \"…\" menu on any listing card → \"Add to list…\"."}
          />
        ) : (
          (() => {
            // Per-item card render — shared between flat and bucketed
            // paths so reactions / attribution / Card wiring stay in
            // one place. Mark spec 2026-05-14: bucket the list view by
            // each user's own reactions (To review / Loved / Liked /
            // Passed) and let the user collapse / re-density each
            // section. Solo lists and Flat-list view fall through to
            // the plain grid.
            const renderItemCard = (item) => {
              const showChip = memberCount >= 2
                && !!item.whoAdded
                && item.whoAdded !== user?.id;
              const addedByName = showChip ? memberMap.get(item.whoAdded) : null;
              const itemReactions = reactionsByItem.get(item.rowId) || [];
              return (
                <div key={item.id} style={{
                  display: "flex", flexDirection: "column",
                  background: "var(--card-bg)",
                }}>
                  <Card
                    item={isSavedColl ? {
                      ...item,
                      price: item.savedPrice,
                      currency: item.savedCurrency || "USD",
                      priceUSD: item.savedPriceUSD || item.savedPrice,
                      sold: item._isSold,
                    } : item}
                    wished={!!watchlist[item.id]}
                    onWish={wrappedHandleWish}
                    compact={compact}
                    onHide={isHiddenColl
                      ? toggleHide
                      : isSavedColl
                        ? undefined
                        : () => removeItemFromCollection(selected.id, item.id)}
                    hideLabel={isHiddenColl ? undefined : "Remove from list"}
                    isHidden={isHiddenColl}
                    onAddToCollection={openCollectionPicker}
                    primaryCurrency={primaryCurrency}
                    onShare={handleShare}
                    onView={observeCard}
                    onClickListing={onClickListing}
                    myRating={isSharedList && item.rowId
                      ? (() => {
                          const mine = (itemReactions || []).find(r => r.user_id === user?.id);
                          return mine?.emoji || null;
                        })()
                      : null}
                    onRate={isSharedList && item.rowId
                      ? (emoji) => onToggleReaction(item.rowId, emoji)
                      : undefined}
                  />
                  {isSharedList && item.rowId && (
                    <ReactionAggregateChips reactions={itemReactions} />
                  )}
                  {addedByName && (
                    <div style={{
                      padding: "4px 10px 8px",
                      fontSize: 11, color: "var(--text3)",
                      letterSpacing: "0.02em",
                    }}>
                      Added by <strong style={{ color: "var(--text2)" }}>{addedByName}</strong>
                    </div>
                  )}
                </div>
              );
            };

            // Bucketing only applies on shared lists (where reactions
            // exist) AND when the user hasn't opted to "Flat list" in
            // the Manage panel. Otherwise fall back to the plain grid.
            // Mark spec 2026-05-14: flat-list view toggle retired
            // with the panel — buckets are the only view now on
            // shared lists (solo lists fall through to the plain
            // grid below). Re-introduce a toggle here if the flat
            // view is ever asked for again.
            const useBuckets = isSharedList;
            if (!useBuckets) {
              return (
                <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
                  {items.map(renderItemCard)}
                </div>
              );
            }

            // Classify by the current user's reaction. Loved (❤️/🔥)
            // beats Liked (👍) beats Passed (❌); legacy emojis still
            // bucket sensibly (🔥 → loved, 🤔 → toReview by default
            // since it doesn't match any of the active sets).
            const myUid = user?.id || null;
            const myReactionFor = (item) => {
              if (!myUid) return null;
              const rs = reactionsByItem.get(item.rowId) || [];
              let love = false, like = false, pass = false;
              for (const r of rs) {
                if (r.user_id !== myUid) continue;
                if (r.emoji === "❤️" || r.emoji === "🔥") love = true;
                else if (r.emoji === "👍") like = true;
                else if (r.emoji === "❌") pass = true;
              }
              if (love) return "loved";
              if (like) return "liked";
              if (pass) return "passed";
              return null;
            };
            const buckets = { toReview: [], loved: [], liked: [], passed: [] };
            for (const it of items) {
              const r = myReactionFor(it);
              if (r) buckets[r].push(it);
              else buckets.toReview.push(it);
            }
            const order = ["toReview", "loved", "liked", "passed"];
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {order.map((key) => {
                  const bucketItems = buckets[key];
                  if (bucketItems.length === 0) return null;
                  const override = bucketDensityOverride[key];
                  // Default = grid; user can opt into linear via the
                  // header toggle. Override wins over the default.
                  const isGrid = override !== "slider";
                  return (
                    <BucketSection
                      key={key}
                      label={BUCKET_LABEL[key]}
                      count={bucketItems.length}
                      isGrid={isGrid}
                      showDensitySwitch={bucketItems.length > BUCKET_TOGGLE_MIN}
                      onToggleDensity={() =>
                        setBucketDensityOverride((prev) => ({
                          ...prev,
                          [key]: isGrid ? "slider" : "grid",
                        }))
                      }
                      gridStyle={gridStyle}
                      items={bucketItems}
                      renderItem={renderItemCard}
                      isMobile={!isWide}
                    />
                  );
                })}
              </div>
            );
          })()
        )}
        {/* ListManagePanel retired 2026-05-14 — its actions (Resume
            screening / Reset / View) are now first-class header
            buttons (Share / Review / Reset) plus the bucket-default-
            grid change makes the view toggle unnecessary. The
            ./ListManagePanel.js component file stays in case a
            future surface wants it. */}
      </div>
    );
  }

  // Grouped lists view (Mark spec 2026-05-14). Three labelled
  // sections instead of one long list:
  //   Saved      — virtual hearts row (single entry)
  //   My lists   — user-created lists where the current user is
  //                owner
  //   Shared with me — the single-listings inbox + collaborator
  //                lists where the owner is someone else
  // Empty groups don't render their header. Eyebrow style on the
  // headers matches the bucket headers in a drill-in for visual
  // consistency.
  const myUserId = user?.id || null;
  const ownedLists = userCols.filter(c => c.userId && c.userId === myUserId);
  const collabLists = userCols.filter(c => c.userId && c.userId !== myUserId);
  // The owned group is special: even when empty we render its
  // header + "+ New list" CTA so the user can always discover the
  // create flow (Mark spec 2026-05-14, after SubTabIntro was
  // retired). Saved + Shared groups hide entirely when empty.
  const sharedRows = [
    ...(sharedInbox ? [sharedInbox] : []),
    ...collabLists,
  ];
  const groups = [
    { key: "saved",  title: "Saved",          rows: savedRow ? [savedRow] : [], hideIfEmpty: true },
    { key: "owned",  title: "My lists",       rows: ownedLists,                 hideIfEmpty: false },
    { key: "shared", title: "Shared with me", rows: sharedRows,                 hideIfEmpty: true },
  ].filter(g => !g.hideIfEmpty || g.rows.length > 0);
  const totalRows = (savedRow ? 1 : 0) + ownedLists.length + sharedRows.length;

  // Per-row renderer — shared across all three groups so the row
  // styling stays in one place. Closes over the local state of
  // ListsView (watchItems / hiddenItems / itemsByColl / etc.).
  const renderListRow = (c) => {
    const isInbox = c.isSharedInbox;
    const isHiddenRowItem = c.id === HIDDEN_COLLECTION_ID;
    const isSavedRowItem  = c.id === SAVED_COLLECTION_ID;
    const count = isSavedRowItem
      ? (watchItems || []).length
      : isHiddenRowItem
        ? hiddenItems.length
        : (itemsByColl[c.id] || []).length;
    const isShared = sharedListIds.has(c.id);
    const icon = isSavedRowItem ? heartIcon
               : isInbox        ? inboxIcon
               : isHiddenRowItem ? eyeOffIcon
               : isShared      ? usersIcon
               : folderIcon;
    const subtitle = isSavedRowItem
      ? `${count} hearted watch${count === 1 ? "" : "es"}`
      : isInbox
        ? `${count} listing${count === 1 ? "" : "s"} shared with you`
        : isHiddenRowItem
          ? `${count} listing${count === 1 ? "" : "s"} hidden from feed`
          : `${count} watch${count === 1 ? "" : "es"}${isShared ? " · shared" : ""}`;
    const isOwner = !!(myUserId && c?.userId && myUserId === c.userId);
    const isSyntheticOrInbox = isInbox || isHiddenRowItem || isSavedRowItem;
    const actions = [];
    if (!isSyntheticOrInbox && isOwner && setEditingCollection) {
      actions.push({
        ariaLabel: `Rename ${c.name}`,
        title: "Rename list",
        icon: pencilIcon,
        onClick: () => setEditingCollection({ id: c.id, name: c.name }),
      });
    }
    if (!isSyntheticOrInbox && isOwner && deleteCollection) {
      actions.push({
        ariaLabel: `Delete ${c.name}`,
        title: "Delete list",
        icon: trashIcon,
        onClick: async () => {
          if (!window.confirm(`Delete "${c.name}"? Items inside aren't deleted from your watchlist; they're just unbundled from this list.`)) return;
          await deleteCollection(c.id);
        },
      });
    }
    const otherCount = otherReactionCounts.get(c.id) || 0;
    // Inbox row sits inside the "Shared with me" group whose header
    // already says that — rename the row's display title to
    // "Listings" so the two don't echo. Other rows use c.name.
    const displayName = isInbox ? "Listings" : c.name;
    const titleNode = otherCount > 0 ? (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span>{displayName}</span>
        <span title={`${otherCount} reaction${otherCount === 1 ? "" : "s"} from collaborators`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 999,
            background: "var(--brand-tint-12)",
            color: "var(--brand)",
            fontSize: 11, fontWeight: 600, lineHeight: 1.3,
          }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
          </svg>
          {otherCount}
        </span>
      </span>
    ) : displayName;
    return (
      <ListRow
        key={c.id}
        icon={icon}
        title={titleNode}
        subtitle={subtitle}
        onClick={() => setSelectedListId(c.id)}
        actions={actions.length > 0 ? actions : undefined}
      />
    );
  };

  // Empty-state CTA shape — reused from the Searches view so the
  // "no entries yet" pattern reads identical across sub-tabs.
  const ctaButtonStyle = {
    cursor: "pointer", fontFamily: "inherit",
    fontSize: 13, fontWeight: 600, letterSpacing: "0.04em",
    padding: "8px 16px", borderRadius: 999,
    border: "0.5px solid var(--text2)",
    background: "transparent",
    color: "var(--text2)",
    display: "inline-flex", alignItems: "center", gap: 4,
  };
  // Inline "+ New" CTA on the My Lists group header (replaces the
  // SubTabIntro action button retired 2026-05-14).
  const inlineNewListStyle = {
    flexShrink: 0, cursor: "pointer", fontFamily: "inherit",
    fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
    padding: "6px 12px", borderRadius: 999,
    border: "0.5px solid var(--text2)",
    background: "transparent",
    color: "var(--text2)",
    display: "inline-flex", alignItems: "center", gap: 4,
    lineHeight: 1,
  };

  return (
    <div style={{ paddingTop: 4 }}>
      {/* 2026-05-14 (Mark spec): SubTabIntro retired — the grouped
          eyebrow headers + the inline + New CTA carry the same
          affordances without the duplicate guidance card. Empty
          state below carries the onboarding text for first-time
          users. */}
      {totalRows === 0 ? (
        <EmptyState
          icon="📂"
          heading="No lists yet"
          blurb="Group watches the way you think about them — by reference, era, occasion, anything. Lists are private by default; share to invite a collaborator."
          action={
            <button onClick={startCreateCollection} style={ctaButtonStyle}>
              + New list
            </button>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groups.map(g => (
            <section key={g.key}>
              <div style={{
                display: "flex", alignItems: "center",
                padding: "0 4px 6px",
                gap: 12,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  color: "var(--text3)",
                }}>
                  {g.title}
                </span>
                <div style={{ flex: 1 }} />
                {g.key === "owned" && (
                  <button onClick={startCreateCollection}
                    style={inlineNewListStyle}>
                    + New list
                  </button>
                )}
              </div>
              {g.rows.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {g.rows.map(renderListRow)}
                </div>
              ) : g.key === "owned" ? (
                <div style={{
                  fontSize: 12, color: "var(--text3)",
                  padding: "8px 4px 4px",
                  fontStyle: "italic",
                }}>
                  Create your first list to start grouping watches.
                </div>
              ) : null}
            </section>
          ))}
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
  // Watch management v1 (2026-05-09): when set, cards expose a
  // "Watch details" menu entry that opens the WatchDetailSheet
  // for that item. Manual entries surface a tap-to-open on the
  // card itself in addition to the menu entry.
  onClickDetail,
  // Optional per-item quick-action factory (2026-05-10). Returns
  // { icon, label, onClick, active } | null. Renders as a small
  // top-left overlay button on each card. Used by Plan > Keeping
  // for the ↑-flag-for-sale gesture.
  quickActionFor,
  // Override remove handler for shortlist-shaped surfaces where
  // the row uses a wishlist-specific mutator instead of the
  // generic removeItemFromCollection. Falls back to onRemoveItem.
  onRemoveOverride,
}) {
  return (
    <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
      {items.map(item => {
        const markSoldHandler = onMarkSold
          ? () => onMarkSold(item.rowId, item)
          : null;
        const detailHandler = onClickDetail ? () => onClickDetail(item) : null;
        const removeHandler = onRemoveOverride
          ? () => onRemoveOverride(item)
          : (onRemoveItem ? () => onRemoveItem(collectionId, item) : null);
        const cardExtraMenuItems = [];
        if (detailHandler) cardExtraMenuItems.push({ label: "Watch details", onClick: detailHandler });
        if (markSoldHandler) cardExtraMenuItems.push({ label: "Mark sold", onClick: () => markSoldHandler() });
        const qa = quickActionFor ? quickActionFor(item) : null;
        return item.isManual ? (
          <ManualItemCard
            key={item.id}
            item={item}
            onRemove={removeHandler || (() => {})}
            onMarkSold={markSoldHandler}
            onClickDetail={detailHandler}
          />
        ) : (
          <Card
            key={item.id}
            item={item}
            wished={!!watchlist[item.id]}
            onWish={handleWish}
            compact={compact}
            onHide={removeHandler || undefined}
            hideLabel={hideLabel}
            onAddToCollection={openCollectionPicker}
            primaryCurrency={primaryCurrency}
            onShare={handleShare}
            onView={observeCard}
            onClickListing={onClickListing}
            extraMenuItems={cardExtraMenuItems.length > 0 ? cardExtraMenuItems : undefined}
            quickAction={qa || undefined}
          />
        );
      })}
    </div>
  );
}

function ManualItemCard({ item, onRemove, onMarkSold, onClickDetail }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  // Portal-anchored coords. The menu used to be absolutely positioned
  // inside the card, which clipped via overflow:hidden when the menu
  // was wider than the card. Mark report 2026-05-10.
  const [menuPos, setMenuPos] = React.useState(null);
  // Click-outside + Escape dismiss for the ⋯ menu (2026-05-09 — was
  // missing; menu stayed open until tapped again, with no obvious
  // affordance to close. Mark report: couldn't easily reach Remove.)
  const triggerRef = React.useRef(null);
  const portalRef = React.useRef(null);
  React.useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      const inTrigger = triggerRef.current && triggerRef.current.contains(e.target);
      const inPortal  = portalRef.current && portalRef.current.contains(e.target);
      if (!inTrigger && !inPortal) setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
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
      {/* Image + body wrapped in a click target when onClickDetail is
          provided (My Watches surface). The ⋯ menu uses
          stopPropagation to keep its own click contained. */}
      <button
        type="button"
        onClick={onClickDetail || undefined}
        disabled={!onClickDetail}
        style={{
          all: "unset", display: "flex", flexDirection: "column",
          cursor: onClickDetail ? "pointer" : "default",
        }}>
        <div style={{
          aspectRatio: "1 / 1", background: "var(--surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {item.img ? (
            <img src={item.img} alt={title} loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <img src="/favicon-192.png" alt="" aria-hidden="true"
              style={{ width: "44%", maxWidth: 72, opacity: 0.5 }} />
          )}
        </div>
        <div style={{ padding: "10px 12px 12px", flex: 1, width: "100%", textAlign: "left" }}>
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
      </button>
      <div style={{ position: "absolute", top: 6, right: 6 }}>
        <button ref={triggerRef}
          onClick={() => {
            if (!menuOpen && triggerRef.current) {
              const r = triggerRef.current.getBoundingClientRect();
              setMenuPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
            }
            setMenuOpen(o => !o);
          }}
          aria-label="More" style={{
            border: "none", background: "rgba(0,0,0,0.5)",
            color: "#fff", width: 26, height: 26, borderRadius: "50%",
            cursor: "pointer", fontSize: 14, fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>⋯</button>
        {menuOpen && menuPos && createPortal(
          <div ref={portalRef} style={{
            position: "fixed",
            top: menuPos.top, right: menuPos.right,
            zIndex: 1000,
            maxWidth: `calc(100vw - ${menuPos.right + 16}px)`,
            background: "var(--card-bg)",
            border: "0.5px solid var(--border)", borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            minWidth: 140,
          }}>
            {onClickDetail && (
              <button onClick={() => { setMenuOpen(false); onClickDetail(); }}
                style={menuItemStyle("var(--text1)")}>Watch details</button>
            )}
            {onMarkSold && (
              <button onClick={() => { setMenuOpen(false); onMarkSold(); }}
                style={menuItemStyle("var(--text1)")}>Mark sold</button>
            )}
            <button onClick={async () => {
              setMenuOpen(false);
              if (window.confirm("Remove this watch from the list?")) await onRemove();
            }} style={menuItemStyle("var(--danger)")}>Remove</button>
          </div>,
          document.body
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

// Two-people icon for lists shared with at least one accepted
// collaborator. 2026-05-10 Mark spec.
const usersIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
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

const heartIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--brand)" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

// Inline-action icons for ListRow row-level edit/delete (2026-05-09).
// Sized 14×14 to match ChallengesView's pattern.
const pencilIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
  </svg>
);
const trashIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/>
    <path d="M14 11v6"/>
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
  </svg>
);

// ── Reactions strip (2026-05-10) ─────────────────────────────────
//
// Small row of emoji-reaction chips below shared-list cards.
// Mark spec: he and his wife can "vote" on watches in their shared
// lists with a small set of emojis. Renders only on lists with 2+
// members (memberCount in ListsView gates this).
//
// Aggregates reactions by emoji → count + tooltip listing reactor
// names. The current user's reaction shows with a filled / brand-
// coloured chip; tap toggles it on/off. The "+" button reveals a
// preset emoji picker.
//
// Realtime publication broadcasts inserts/deletes so the other
// member sees the chip update without a refresh (ListsView's
// effect refetches on every event).

// Screening-palette glyphs — shared across the reaction surfaces so
// the aggregate strip + the in-menu picker + the bucket headers all
// read as one visual system. Stroke colour comes from the parent.
const REACTION_GLYPH = {
  "❤️": (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"
      stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  "👍": (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  ),
  "❌": (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  ),
};
const REACTION_COLOR = {
  "❤️": "#e0322b",
  "👍": "var(--brand)",
  "❌": "var(--text3)",
};

// Aggregate count chips below each card on shared lists (Mark spec
// 2026-05-14, Slice A). iMessage / Teams-style "who reacted" cluster
// — ❤ 3 · 👍 5 · ✕ 1, only buckets with non-zero counts. Read-only
// in Slice A; Slice C will wire the tap-to-see-who attribution sheet
// off this same chip cluster.
//
// Legacy emoji rollup: 🔥 → ❤️ (intensifier on love), 🤔 → ignored
// (those were retired from the picker in 2026-05-11). Same set as
// the bucket classifier.
function ReactionAggregateChips({ reactions }) {
  const counts = { "❤️": 0, "👍": 0, "❌": 0 };
  for (const r of (reactions || [])) {
    if (r.emoji === "❤️" || r.emoji === "🔥") counts["❤️"] += 1;
    else if (r.emoji === "👍") counts["👍"] += 1;
    else if (r.emoji === "❌") counts["❌"] += 1;
  }
  const total = counts["❤️"] + counts["👍"] + counts["❌"];
  if (total === 0) return null;
  const order = ["❤️", "👍", "❌"];
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 6,
      padding: "6px 10px 8px",
      alignItems: "center",
    }}>
      {order.filter(k => counts[k] > 0).map(k => (
        <span key={k} style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "3px 8px", borderRadius: 999,
          border: "0.5px solid var(--border)",
          background: "var(--surface)",
          color: REACTION_COLOR[k],
          fontSize: 11, fontWeight: 500,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.4,
        }}>
          {REACTION_GLYPH[k](12)}
          <span style={{ color: "var(--text2)" }}>{counts[k]}</span>
        </span>
      ))}
    </div>
  );
}

// 2026-05-14 Slice A: the old `ReactionStrip` (thumbs-up button +
// chip picker rendered under each card) was retired. The rating
// input moved into the Card's ⋯ menu (Card.js `onRate` / `myRating`
// props), and the read-only count cluster lives in
// `ReactionAggregateChips` above. Card.js inlines the two-emoji
// picker (👍 / ❌) directly.

// ── Drill-in filter helper (2026-05-09) ─────────────────────────
//
// Applies the shell filter-row values (filterSources, filterBrands,
// minPrice, maxPrice, search, sort) to a drilled-in list's items
// so the filter pills above the grid actually narrow the visible
// set. Mirrors App.js's allFiltered / watchView predicates but
// scoped to whatever the user's currently looking at inside a
// list — Saved virtual list, a user list, or a shared list.
//
// Source/brand: simple equality on the snapshot fields. Brand uses
// `(item.brand || "Other")` rather than App.js's count-aware
// displayBrand because we don't have brandCounts here; close
// enough for in-list narrowing.
//
// Price: prefers savedPriceUSD/savedPrice (watchlist_items shape)
// and falls back to priceUSD/price (collection_items / live
// snapshots). manualPricePaid is also checked so manual entries
// participate in the band when relevant.
//
// Sort: Date↓ default = savedAt desc; Date↑ flips. Price asc/desc
// works on the same numeric field as the band check.

function applyDrillInFilters(items, fv) {
  if (!fv) return items;
  let out = items.slice();
  const { filterSources, filterBrands, minPrice, maxPrice, search, sort } = fv;
  if (filterSources && filterSources.length > 0) {
    out = out.filter(i => filterSources.includes(i.source));
  }
  if (filterBrands && filterBrands.length > 0) {
    out = out.filter(i => filterBrands.includes(i.brand || "Other"));
  }
  const priceOf = (i) => i.savedPriceUSD || i.savedPrice
                       || i.priceUSD || i.price
                       || i.manualPricePaid || 0;
  if (minPrice && minPrice > 0) {
    out = out.filter(i => priceOf(i) >= minPrice);
  }
  // GLOBAL_MAX in App.js is Infinity; here a missing maxPrice means
  // "no upper bound", so only filter when it's a real finite cap.
  if (maxPrice && Number.isFinite(maxPrice) && maxPrice < 1e12) {
    out = out.filter(i => priceOf(i) <= maxPrice);
  }
  const q = (search || "").trim();
  if (q) out = out.filter(i => matchesSearch(i, q));

  if (sort === "price-asc") {
    out.sort((a, b) => priceOf(a) - priceOf(b));
  } else if (sort === "price-desc") {
    out.sort((a, b) => priceOf(b) - priceOf(a));
  } else if (sort === "date-asc") {
    const date = (i) => i.savedAt || i.firstSeen || "";
    out.sort((a, b) => (date(a) > date(b) ? 1 : date(a) < date(b) ? -1 : 0));
  } else {
    // default: date desc (newest savedAt first)
    const date = (i) => i.savedAt || i.firstSeen || "";
    out.sort((a, b) => (date(a) < date(b) ? 1 : date(a) > date(b) ? -1 : 0));
  }
  return out;
}
