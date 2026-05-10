import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Card } from "./Card";
import { ListRow } from "./ListRow";
import { SubTabIntro } from "./SubTabIntro";
import { ChallengesView } from "./ChallengesView";
import { ManualEntryForm } from "./ManualEntryForm";
import { ListingPickerModal } from "./ListingPickerModal";
import { MarkAsSoldModal } from "./MarkAsSoldModal";
import { ManageListSheet } from "./ManageListSheet";
import { WatchDetailSheet } from "./WatchDetailSheet";
import { fmtUSD, matchesSearch } from "../utils";
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
        filterValues={filterValues}
        fetchListMembers={collectionsApi?.fetchListMembers}
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
  wishlist, wishlistItems, onShortlistAddFromFeed, onShortlistReorder, onShortlistRemove,
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
    <div>
      <SubTabIntro
        title="My watches — Collection · Archive · Plan"
        blurb={<>Track what you own (Collection), what you've sold (Archive) and what's next (Plan). Tap any watch for the detail sheet — buy / sell breakdown, P&amp;L, your thoughts, and a dated journal.</>}
        expandable
        defaultExpanded={myWatchesTotal === 0}
      />
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 14px 12px",
        borderBottom: "0.5px solid var(--border)",
        marginBottom: 12, flexWrap: "wrap",
      }}>
        {/* Toggle pills — Collection / Archive / Plan
            (2026-05-09 watch-management restructure). */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[
            ["collection", `Collection (${ownedItems.length})`],
            ["archive",    `Archive (${soldItems.length})`],
            ["plan",       `Plan`],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setToggle(key)}
              style={innerToggleButton(toggle === key)}>{label}</button>
          ))}
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
          handleShare={handleShare}
          handleWish={handleWish}
          observeCard={observeCard}
          onClickListing={onClickListing}
          openCollectionPicker={openCollectionPicker}
          onShortlistAddFromFeed={onShortlistAddFromFeed}
          onShortlistReorder={onShortlistReorder}
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
          <Section
            label={`Collection · ${ownedItems.length}${ownedTotal > 0 ? ` · ${fmtUSD(ownedTotal)} total` : ""}`}
            show={false}
          >
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
          </Section>
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
          <Section
            label={`Archive · ${soldItems.length}${soldTotal > 0 ? ` · ${fmtUSD(soldTotal)} total` : ""}`}
            show={false}
          >
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
          </Section>
        )
      )}
    </div>
  );
}

// ── Shortlist ranked-list view ───────────────────────────────────
// Plan view (2026-05-09 — watch-management v1).
//
// Three vertically-stacked sections (mobile) / three columns (desktop)
// with running totals at the top:
//   - Keeping: owned items NOT flagged for sale
//   - Selling: owned items WITH flagged_for_sale=true
//   - Wants:   wishlist items (the planned-purchase pool)
//
// Plus running totals at the top:
//   Owned    = sum of assumed_sell_value (or savedPrice fallback) for
//              keeping items
//   Selling  = sum of assumed_sell_value (or savedPrice fallback) for
//              flagged items
//   Wants    = sum of savedPrice across wishlist items
//   Net cash = Selling − Wants  (cash impact if all moves happen)
//   Future   = Owned + Wants    (collection value after moves)
//
// Movement (tap-actions, not drag-and-drop — drag is fragile on
// mobile and the action set is small enough to afford menu items):
//   Keeping → Selling: card "..." menu has "Flag for sale"
//   Selling → Keeping: card "..." menu has "Keep instead"
//   Wants   → Removed:  card "..." menu has "Remove"
//   Wants   → Owned:    "Mark as bought" (TODO — phase 5 with picker)
//
// The pool below the columns (Phase 5) will surface candidates from
// Saved + Lists for adding into Wants. Stub for now.

function PlanView({
  ownedItems, ownedTotal,
  wishlist, wishlistItems, wantsTotal,
  compact, gridStyle, primaryCurrency,
  watchlist, handleShare, handleWish, observeCard, onClickListing,
  openCollectionPicker,
  onShortlistAddFromFeed,
  onShortlistReorder,
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
        padding: "0 12px 16px",
      }}>
        {colHeader("Keeping", keepingValue, `${keeping.length} watch${keeping.length === 1 ? "" : "es"}`)}
        {colHeader("Selling", sellingValue,
          `${selling.length} flagged · proceeds`,
          selling.length > 0 ? "var(--accent-positive)" : undefined)}
        {colHeader("Wants", wantsTotal,
          `${wishlistItems.length} candidate${wishlistItems.length === 1 ? "" : "s"} · cost`,
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

      {/* Three vertical sections (or three columns on a wide viewport
          via the grid below). Mobile stacks naturally because each
          section is a block element. */}
      {/* Keeping */}
      <Section
        label={`Keeping · ${keeping.length}${keepingValue > 0 ? ` · ${fmtUSD(keepingValue)} total` : ""}`}
        show={true}
      >
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
          />
        )}
      </Section>

      {/* Selling */}
      <Section
        label={`Selling · ${selling.length}${sellingValue > 0 ? ` · ${fmtUSD(sellingValue)} expected` : ""}`}
        show={true}
      >
        {selling.length === 0 ? (
          <EmptyHardListSection text="Nothing flagged for sale yet. On any owned watch, open the detail sheet → Flag for sale." />
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
          />
        )}
      </Section>

      {/* Wants */}
      <Section
        label={`Wants · ${wishlistItems.length}${wantsTotal > 0 ? ` · ${fmtUSD(wantsTotal)} total` : ""}`}
        show={true}
      >
        {!wishlist ? (
          <EmptyHardListSection text="Plan not ready — refresh to retry the auto-create." />
        ) : wishlistItems.length === 0 ? (
          <EmptyState
            icon="★"
            heading="No wants yet"
            blurb="Add the watches you'd like to acquire next. Tap any saved watch in the Pool below, or pick from the feed."
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
        )}
      </Section>

      {/* Pool — your saved watches, ready to promote into Wants
          (Phase 5, 2026-05-09 — Mark spec "drink from list below").
          Sourced from watchlist_items (hearts) MINUS anything
          already in Wants. Tap a card to move it into Wants.
          Hidden when the user has no hearts at all. */}
      <PoolSection
        wishlist={wishlist}
        wishlistItems={wishlistItems}
        watchlist={watchlist}
        compact={compact}
        primaryCurrency={primaryCurrency}
        addItemToWants={addItemToWants}
        handleShare={handleShare}
        observeCard={observeCard}
        onClickListing={onClickListing}
      />
    </div>
  );
}

// Phase 5 pool — surfaces hearted items not yet in Wants. Tap-to-add
// (mobile-friendly; drag-and-drop deferred). Capped at 24 visible
// candidates with an "Show all" toggle so the page doesn't grow
// unbounded for users with many hearts.
function PoolSection({
  wishlist, wishlistItems, watchlist, compact, primaryCurrency,
  addItemToWants, handleShare, observeCard, onClickListing,
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [busyIds, setBusyIds] = React.useState(() => new Set());
  if (!wishlist) return null;
  const watchlistObj = watchlist || {};
  const inWants = new Set((wishlistItems || []).map(it => it.id));
  const candidates = Object.values(watchlistObj)
    .filter(it => !inWants.has(it.id))
    .sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
  if (candidates.length === 0) return null;
  const SHOW = expanded ? candidates.length : Math.min(24, candidates.length);
  const visible = candidates.slice(0, SHOW);
  const onAdd = async (item) => {
    if (!addItemToWants || busyIds.has(item.id)) return;
    setBusyIds(prev => { const n = new Set(prev); n.add(item.id); return n; });
    await addItemToWants(item);
    // Don't clear busy — the optimistic local update will move the
    // item out of `candidates` (now in inWants) so it disappears
    // from the pool grid; no need to re-enable.
  };
  return (
    <Section
      label={`Pool · ${candidates.length} hearted watch${candidates.length === 1 ? "" : "es"} ready to promote`}
      show={true}
    >
      <div style={{
        fontSize: 11, color: "var(--text3)", marginBottom: 8, padding: "0 4px",
      }}>
        Tap any card to move it up into Wants.
      </div>
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
    </Section>
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
                <img src="/favicon-192.png" alt="" aria-hidden="true"
                  style={{ width: "55%", maxWidth: 72, opacity: 0.5 }} />
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
  watchItems,
  watchlist, toggleHide,
  compact, gridStyle, primaryCurrency,
  handleShare, handleWish,
  openCollectionPicker, observeCard, onClickListing,
  startCreateCollection, setEditingCollection,
  deleteCollection, removeItemFromCollection,
  selectedListId, setSelectedListId,
  setManageListOpen,
  // Filter row values from App.js. Same shape useFilters exposes.
  // Applied to drilled-in items via applyDrillInFilters below.
  filterValues,
  // (Slice 4) — fetch members for the active drill-in so the
  // who_added chip can resolve user_id → display_name.
  fetchListMembers,
}) {
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
    // Saved virtual list (2026-05-09 — Mark report): exclude tracked-
    // lot projection placeholders. watchItems pushes a "Fetching…"
    // placeholder for every URL in trackedLotUrls that the scraper
    // hasn't populated yet — it shows up in the Saved view as a
    // ghost card the user can't identify or un-heart. Real hearts
    // on auction lots / tracked URLs flow through watchlist_items
    // (Phase B2) and don't have `_isTrackedLot` set, so this filter
    // only strips projection-only placeholders.
    const rawItems = isHiddenColl ? hiddenItems
                : isSavedColl  ? (watchItems || []).filter(i => !i._isTrackedLot)
                : (itemsByColl[selected.id] || []);
    // Apply the shell filter row (date/price sort, $ min-max,
    // source, brand, search) to the drilled-in items so the filter
    // pills above the grid actually narrow the visible set.
    // 2026-05-09 IA pass.
    const items = applyDrillInFilters(rawItems, filterValues);
    return (
      <div style={{ paddingTop: 4 }}>
        {/* Drill-in header — restructured 2026-05-09 (Mark report:
            mobile clipped Share/Manage/Rename/Delete off the right
            edge). Title row stays single-line; action row wraps so
            buttons stack rather than clip on narrow viewports. */}
        <div style={{
          display: "flex", alignItems: "baseline", gap: 12,
          padding: "14px 14px 8px",
        }}>
          <button onClick={() => setSelectedListId(null)} style={{
            border: "none", background: "transparent", cursor: "pointer",
            color: "var(--brand)", fontFamily: "inherit", fontSize: 13, padding: 0,
            flexShrink: 0,
          }}>← All lists</button>
          <span style={{
            fontSize: 14, fontWeight: 600, color: "var(--text1)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {selected.name}
          </span>
          <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto", flexShrink: 0 }}>
            {items.length}
          </span>
        </div>
        {/* Inline clarifier on what "Date" means inside a list
            drill-in (Mark feedback 2026-05-09): the date axis here
            is when items were added to THIS list, not when they
            first appeared on the dealer site. Small + secondary so
            it sits as a quiet caption rather than competing with
            the title. */}
        {!isSavedColl && !isHiddenColl && (
          <div style={{
            padding: "0 14px 6px",
            fontSize: 11, color: "var(--text3)", lineHeight: 1.4,
          }}>
            Date sort uses when items were added to this list.
          </div>
        )}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6,
          padding: "0 14px 12px",
          borderBottom: "0.5px solid var(--border)",
          marginBottom: 12,
        }}>
          {!selected.isSharedInbox && !isHiddenColl && !isSavedColl && (() => {
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
          <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
            {items.map(item => {
              // Slice 4: only show the attribution chip on shared
              // (multi-member) lists. On single-owner lists every
              // item was added by the owner and the chip is just
              // visual noise.
              const showChip = memberCount >= 2 && !!item.whoAdded;
              const addedByName = showChip ? memberMap.get(item.whoAdded) : null;
              return (
                <div key={item.id} style={{ display: "flex", flexDirection: "column" }}>
                  <Card
                    item={isSavedColl ? {
                      ...item,
                      price: item.savedPrice,
                      currency: item.savedCurrency || "USD",
                      priceUSD: item.savedPriceUSD || item.savedPrice,
                      sold: item._isSold,
                    } : item}
                    wished={isSavedColl ? true : !!watchlist[item.id]}
                    onWish={handleWish}
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
                  />
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
            })}
          </div>
        )}
      </div>
    );
  }

  // Permanent system rows render at the top — Saved (hearts) +
  // Shared with me (sharedInbox). Both can't be deleted; both
  // surface ahead of user-created lists.
  const visibleCols = [
    ...(savedRow ? [savedRow] : []),
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
        expandable
        defaultExpanded={visibleCols.length === 0}
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
            const isSavedRowItem  = c.id === SAVED_COLLECTION_ID;
            const count = isSavedRowItem
              ? (watchItems || []).length
              : isHiddenRowItem
                ? hiddenItems.length
                : (itemsByColl[c.id] || []).length;
            const icon = isSavedRowItem ? heartIcon
                       : isInbox        ? inboxIcon
                       : isHiddenRowItem ? eyeOffIcon
                       : folderIcon;
            const subtitle = isSavedRowItem
              ? `${count} hearted watch${count === 1 ? "" : "es"}`
              : isInbox
                ? `${count} listing${count === 1 ? "" : "s"} shared with you`
                : isHiddenRowItem
                  ? `${count} listing${count === 1 ? "" : "s"} hidden from feed`
                  : `${count} watch${count === 1 ? "" : "es"}`;
            // Inline edit / delete actions on user-list rows (Mark
            // request 2026-05-09 — match the Challenges card pattern
            // so Rename + Delete don't require drilling in first).
            // Hidden on virtual rows (Saved / Hidden), shared inbox,
            // and shared-with-me collaborator lists (non-owners can't
            // mutate). System lists (Owned/Sold/Wishlist) are
            // excluded from userCols already.
            const isOwner = !!(user?.id && c?.userId && user.id === c.userId);
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
            return (
              <ListRow
                key={c.id}
                icon={icon}
                title={c.name}
                subtitle={subtitle}
                onClick={() => setSelectedListId(c.id)}
                actions={actions.length > 0 ? actions : undefined}
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
  // Watch management v1 (2026-05-09): when set, cards expose a
  // "Watch details" menu entry that opens the WatchDetailSheet
  // for that item. Manual entries surface a tap-to-open on the
  // card itself in addition to the menu entry.
  onClickDetail,
}) {
  return (
    <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
      {items.map(item => {
        const markSoldHandler = onMarkSold
          ? () => onMarkSold(item.rowId, item)
          : null;
        const detailHandler = onClickDetail ? () => onClickDetail(item) : null;
        const cardExtraMenuItems = [];
        if (detailHandler) cardExtraMenuItems.push({ label: "Watch details", onClick: detailHandler });
        if (markSoldHandler) cardExtraMenuItems.push({ label: "Mark sold", onClick: () => markSoldHandler() });
        return item.isManual ? (
          <ManualItemCard
            key={item.id}
            item={item}
            onRemove={() => onRemoveItem(collectionId, item)}
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
            onHide={() => onRemoveItem(collectionId, item)}
            hideLabel={hideLabel}
            onAddToCollection={openCollectionPicker}
            primaryCurrency={primaryCurrency}
            onShare={handleShare}
            onView={observeCard}
            onClickListing={onClickListing}
            extraMenuItems={cardExtraMenuItems.length > 0 ? cardExtraMenuItems : undefined}
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
