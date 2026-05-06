import React, { useState, useEffect } from "react";
import { Card } from "./Card";
import { ListRow } from "./ListRow";
import { SubTabIntro } from "./SubTabIntro";
import { ChallengesView } from "./ChallengesView";
import { ManualEntryForm } from "./ManualEntryForm";
import { ListingPickerModal } from "./ListingPickerModal";
import { MarkAsSoldModal } from "./MarkAsSoldModal";
import { fmtUSD } from "../utils";

// Top-level Collections tab — landed 2026-05-06 (PR #86) when Mark
// chose Option A from the Collections plan: a new tab rather than
// Watchlist sub-tabs. Holds:
//   - Three hard system lists (Owned / Sold / Wishlist) pinned at
//     the top with prominent treatment (these can't be deleted; they
//     auto-create per user via useCollections).
//   - Shared-with-me inbox (when present).
//   - User-created lists (formerly Watchlist > Lists).
//   - Synthetic "Hidden" row when the user has any hidden listings.
//   - Watch Challenges (formerly Cool Stuff > Watch Challenges).
//
// Drill-ins:
//   - hard list / regular list / shared-inbox / Hidden → Card grid.
//   - challenges row → ChallengesView (which owns its own drill-in
//     into ChallengeFlow).
//
// Selection state is component-local + URL-synced via `?col=<uuid>`
// (or sentinel ids `__hidden__` / `__challenges__`). Same pattern
// the Watchlist > Lists sub-tab used pre-restructure, lifted here.

const HIDDEN_COLLECTION_ID    = "__hidden__";
const CHALLENGES_COLLECTION_ID = "__challenges__";

export function CollectionsTab({
  user,
  isAuthConfigured,
  signInWithGoogle,
  collectionsApi,
  hiddenItems,
  toggleHide,
  watchlist,
  watchItems,            // user's hearted items (snapshots) — for the picker's Favorites source
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
  // App.js owns these for the cross-receiver "Take this challenge"
  // → drill-in flow (was wired through ReferencesTab pre-restructure;
  // now lives here since challenges moved into Collections).
  pendingChallengeDrillId,
  clearPendingChallengeDrill,
}) {
  // Manual-entry modal state — open while the user is filling in
  // brand/model/photo for an Owned or Sold drill-in row. Closed
  // by default; opened via the "+ Add a watch" CTA.
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  // Listing-picker modal state — open while the user is choosing
  // a listing from Favorites / Lists / paste-link. PR #88.
  const [pickerOpen, setPickerOpen] = useState(false);
  // Mark-as-sold modal state — { rowId, item } when open, null when
  // closed. The wrapped item drives the modal's display copy.
  const [soldTarget, setSoldTarget] = useState(null);
  // Drill-in selection. null = list view; uuid OR sentinel = drilled.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("col") || null;
  });
  // URL sync for the drill-in id. Skipped during share-receive flows
  // (the share controller owns the URL until it acts).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("shared") === "1") return;
    if (selectedId) params.set("col", selectedId);
    else            params.delete("col");
    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    if (newUrl !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState({}, "", newUrl);
    }
  }, [selectedId]);

  // Take-this-challenge → drill straight into the challenges surface
  // with the new draft pre-selected. App.js sets pendingChallengeDrillId
  // after the receive flow creates the challenge; ChallengesView's
  // own effect (separate from this) handles the inner drill via the
  // same prop forwarded below. We only need to surface the
  // challenges row.
  useEffect(() => {
    if (pendingChallengeDrillId) setSelectedId(CHALLENGES_COLLECTION_ID);
  }, [pendingChallengeDrillId]);

  if (!user) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Sign in to use Collections</div>
        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 360, margin: "0 auto 18px" }}>
          Owned watches, watches you've sold, your wishlist, and any custom lists you build — all in one place. Sync across every device.
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
  // Pre-sort: hard lists in fixed order (Owned, Sold, Wishlist), then
  // the shared-inbox row, then user-created lists, then the Hidden
  // synthetic, then the Challenges entry.
  const hardOwned    = cols.find(c => c.type === "owned"    && c.isSystem) || null;
  const hardSold     = cols.find(c => c.type === "sold"     && c.isSystem) || null;
  const hardWishlist = cols.find(c => c.type === "wishlist" && c.isSystem) || null;
  const sharedInbox  = cols.find(c => c.isSharedInbox) || null;
  const userCols     = cols.filter(c =>
    !c.isSharedInbox && !c.isSystem && c.type !== "challenge"
  );
  const hiddenRow = (hiddenItems && hiddenItems.length > 0) ? {
    id: HIDDEN_COLLECTION_ID, name: "Hidden", isHidden: true,
  } : null;

  // Drill-in routing.
  const selected = (() => {
    if (!selectedId) return null;
    if (selectedId === HIDDEN_COLLECTION_ID)     return hiddenRow;
    if (selectedId === CHALLENGES_COLLECTION_ID) return { id: CHALLENGES_COLLECTION_ID, isChallenges: true };
    return cols.find(c => c.id === selectedId) || null;
  })();

  if (selected?.isChallenges) {
    return (
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
        onBack={() => setSelectedId(null)}
      />
    );
  }

  if (selected) {
    const isHiddenColl = selected.id === HIDDEN_COLLECTION_ID;
    const isHardSystem = !!selected.isSystem;
    // Manual-entry CTA shows on Owned + Sold (not Wishlist — Mark
    // 2026-05-06: "wishlist should be from feed" only).
    const acceptsManualEntry = selected.type === "owned" || selected.type === "sold";
    // Listing-picker CTA on hard lists (Owned + Sold + Wishlist).
    // For Wishlist this is the ONLY add path (no manual entries
    // by spec); for Owned/Sold it's an alternative to manual entry
    // when the user bought from a tracked dealer.
    const acceptsListingPicker = selected.type === "owned" || selected.type === "sold" || selected.type === "wishlist";
    // Mark-as-sold action only on Owned drill-in. Wraps the row id
    // + a display item so the modal can render contextual copy.
    const ownedShowsSoldAction = selected.type === "owned";
    const items = isHiddenColl ? hiddenItems : (itemsByColl[selected.id] || []);
    return (
      <div style={{ paddingTop: 4 }}>
        <div style={{
          display: "flex", alignItems: "baseline", gap: 12,
          padding: "14px 14px 12px",
          borderBottom: "0.5px solid var(--border)",
          marginBottom: 12,
        }}>
          <button onClick={() => setSelectedId(null)} style={{
            border: "none", background: "transparent", cursor: "pointer",
            color: "#185FA5", fontFamily: "inherit", fontSize: 13, padding: 0,
          }}>← All collections</button>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
            {selected.name}
          </span>
          <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto" }}>
            {items.length}
          </span>
          {/* +Pick from feed — Owned/Sold/Wishlist (uses
              ListingPickerModal). PR #88. */}
          {acceptsListingPicker && (
            <button onClick={() => setPickerOpen(true)}
              style={{
                border: "0.5px solid var(--border)", background: "transparent",
                color: "var(--text2)", padding: "4px 10px", borderRadius: 6,
                cursor: "pointer", fontFamily: "inherit", fontSize: 12,
              }}>+ From feed</button>
          )}
          {/* +Add a watch — manual entry on Owned/Sold (PR #87). */}
          {acceptsManualEntry && (
            <button onClick={() => setManualEntryOpen(true)}
              style={{
                border: "none", background: "#185FA5", color: "#fff",
                padding: "4px 10px", borderRadius: 6,
                cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 500,
              }}>+ Add a watch</button>
          )}
          {/* Rename + Delete hidden for hard system lists, the
              shared-inbox, and the synthetic Hidden row. Hard lists
              are non-deletable by design (defense-in-depth via DB
              trigger); shared-inbox is perma; Hidden is a synthetic
              view, no row to rename. */}
          {!selected.isSharedInbox && !isHiddenColl && !isHardSystem && (
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
                  await collectionsApi.deleteCollection(selected.id);
                  setSelectedId(null);
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
            <div style={{ fontSize: 32, marginBottom: 12 }}>{isHiddenColl ? "👁" : isHardSystem ? hardListEmptyIcon(selected.type) : "📂"}</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: "var(--text1)" }}>
              {isHiddenColl ? "Nothing hidden" : isHardSystem ? hardListEmptyTitle(selected.type) : "Empty list"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 340, margin: "0 auto 16px" }}>
              {isHiddenColl
                ? "Listings you hide from the Available feed land here. Use the \"…\" menu on any card to unhide it."
                : isHardSystem
                  ? hardListEmptyBlurb(selected.type)
                  : "Add watches via the \"…\" menu on any listing card → \"Add to list…\"."}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {acceptsListingPicker && (
                <button onClick={() => setPickerOpen(true)}
                  style={{
                    border: "0.5px solid var(--border)", background: "transparent",
                    color: "var(--text2)", padding: "8px 16px", borderRadius: 8,
                    cursor: "pointer", fontFamily: "inherit", fontSize: 13,
                  }}>+ From feed</button>
              )}
              {acceptsManualEntry && (
                <button onClick={() => setManualEntryOpen(true)}
                  style={{
                    border: "none", background: "#185FA5", color: "#fff",
                    padding: "8px 16px", borderRadius: 8,
                    cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500,
                  }}>+ Add a watch</button>
              )}
            </div>
          </div>
        ) : selected.type === "wishlist" ? (
          // Wishlist drill-in renders as a ranked list (not a grid)
          // since rank ordering is the point. PR #89, 2026-05-06 —
          // Mark's "force ranking" applies to wishlist only. Each
          // row carries ↑/↓ controls; tap reorders by swapping
          // positions with the adjacent item via reorderItems.
          <WishlistRankedList
            items={items}
            collectionId={selected.id}
            onReorder={(orderedIds) => collectionsApi.reorderItems(selected.id, orderedIds)}
            onRemove={(item) => collectionsApi.removeItemFromCollection(selected.id, item.id)}
          />
        ) : (
          <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
            {items.map(item => {
              // Build menu actions per surface. Owned drill-in
              // gets a "Mark as sold" entry that opens the modal.
              const onMarkSold = ownedShowsSoldAction
                ? () => setSoldTarget({ rowId: item.rowId, item })
                : null;
              return item.isManual ? (
                <ManualItemCard
                  key={item.id}
                  item={item}
                  onRemove={() => collectionsApi.removeItemFromCollection(selected.id, item.id)}
                  onMarkSold={onMarkSold}
                />
              ) : (
                <Card
                  key={item.id}
                  item={item}
                  wished={!!watchlist[item.id]}
                  onWish={handleWish}
                  compact={compact}
                  onHide={isHiddenColl
                    ? toggleHide
                    : () => collectionsApi.removeItemFromCollection(selected.id, item.id)}
                  hideLabel={isHiddenColl ? undefined : "Remove from list"}
                  isHidden={isHiddenColl}
                  onAddToCollection={openCollectionPicker}
                  primaryCurrency={primaryCurrency}
                  onShare={handleShare}
                  onView={observeCard}
                  onClickListing={onClickListing}
                  extraMenuItems={onMarkSold ? [{ label: "Mark sold", onClick: () => onMarkSold() }] : undefined}
                />
              );
            })}
          </div>
        )}
        <ManualEntryForm
          open={manualEntryOpen}
          onClose={() => setManualEntryOpen(false)}
          kind={selected.type}
          inp={inp}
          uploadWatchPhoto={collectionsApi.uploadWatchPhoto}
          addManualItem={collectionsApi.addManualItem}
          collectionId={selected.id}
        />
        <ListingPickerModal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          title={`Add to ${selected.name}`}
          watchItems={watchItems}
          collections={collectionsApi.collections}
          itemsByCollection={collectionsApi.itemsByCollection}
          allListings={allListings}
          primaryCurrency={primaryCurrency}
          onPick={(listing) => collectionsApi.addItemToCollection(selected.id, listing)}
        />
        <MarkAsSoldModal
          open={!!soldTarget}
          onClose={() => setSoldTarget(null)}
          item={soldTarget?.item}
          inp={inp}
          onConfirm={(opts) => collectionsApi.markItemAsSold(soldTarget.rowId, opts)}
        />
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────
  // Hard lists at the top with prominent treatment, then a thin
  // divider, then everything else as standard ListRows.
  const challengeCount = cols.filter(c => c.type === "challenge").length;

  return (
    <div style={{ paddingTop: 4 }}>
      <SubTabIntro
        title="Your collections in one place"
        blurb={<>Owned, Sold, and Wishlist are pinned for you. Add a custom list — reference threads, dealer comps, "Vintage divers" — anytime via <strong style={{ color: "var(--text1)" }}>+ New list</strong>.</>}
        actionLabel="+ New list"
        onAction={startCreateCollection}
      />

      {/* Hard lists — pinned at top, prominent treatment. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {hardOwned    && <HardListRow kind="owned"    coll={hardOwned}    items={itemsByColl[hardOwned.id]    || []} onClick={() => setSelectedId(hardOwned.id)} />}
        {hardWishlist && <HardListRow kind="wishlist" coll={hardWishlist} items={itemsByColl[hardWishlist.id] || []} onClick={() => setSelectedId(hardWishlist.id)} />}
        {hardSold     && <HardListRow kind="sold"     coll={hardSold}     items={itemsByColl[hardSold.id]     || []} onClick={() => setSelectedId(hardSold.id)} />}
      </div>

      {/* Other lists — shared inbox, user lists, Hidden, Challenges. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sharedInbox && (
          <ListRow
            key={sharedInbox.id}
            icon={inboxIcon}
            title={sharedInbox.name}
            subtitle={(() => {
              const n = (itemsByColl[sharedInbox.id] || []).length;
              return `${n} listing${n === 1 ? "" : "s"} shared with you`;
            })()}
            onClick={() => setSelectedId(sharedInbox.id)}
          />
        )}
        {userCols.map(c => {
          const n = (itemsByColl[c.id] || []).length;
          return (
            <ListRow
              key={c.id}
              icon={folderIcon}
              title={c.name}
              subtitle={`${n} watch${n === 1 ? "" : "es"}`}
              onClick={() => setSelectedId(c.id)}
            />
          );
        })}
        {hiddenRow && (
          <ListRow
            key={hiddenRow.id}
            icon={eyeOffIcon}
            title={hiddenRow.name}
            subtitle={`${hiddenItems.length} listing${hiddenItems.length === 1 ? "" : "s"} hidden from feed`}
            onClick={() => setSelectedId(hiddenRow.id)}
          />
        )}
        {/* Challenges entry — drills into ChallengesView (which keeps
            its own list + create + drill-in). One row keeps the
            Collections tab's structure consistent (everything is a
            collection-shaped row). */}
        <ListRow
          key={CHALLENGES_COLLECTION_ID}
          icon={targetIcon}
          title="Watch Challenges"
          subtitle={challengeCount === 0
            ? "Constrained-set thought experiments — pick N watches under a budget"
            : `${challengeCount} challenge${challengeCount === 1 ? "" : "s"}`}
          onClick={() => setSelectedId(CHALLENGES_COLLECTION_ID)}
        />
      </div>
    </div>
  );
}

// ── HardListRow ──────────────────────────────────────────────────
// Bigger card variant for the three pinned hard lists. Header (icon
// + name + count + chevron) + a thin image strip sampling the first
// few items so the row feels like a collection card rather than a
// nav row. Empty state still reads cleanly.
function HardListRow({ kind, coll, items, onClick }) {
  const accent = HARD_LIST_ACCENTS[kind];
  const tint   = HARD_LIST_TINTS[kind];
  const previews = items.slice(0, 6);
  const totalUSD = items.reduce((s, it) => s + (Number(it.savedPriceUSD) || Number(it.priceUSD) || 0), 0);
  const subtitle = items.length === 0
    ? hardListEmptySubtitle(kind)
    : (totalUSD > 0
        ? `${items.length} watch${items.length === 1 ? "" : "es"} · ${fmtUSD(totalUSD)} total`
        : `${items.length} watch${items.length === 1 ? "" : "es"}`);
  return (
    <button onClick={onClick} aria-label={`Open ${coll.name}`} style={{
      display: "block", width: "100%", padding: 0,
      border: "0.5px solid var(--border)", borderRadius: 12,
      background: "var(--card-bg)", color: "var(--text1)",
      cursor: "pointer", fontFamily: "inherit", textAlign: "left",
      overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", gap: 12 }}>
        <div style={{
          flexShrink: 0,
          width: 40, height: 40, borderRadius: "50%",
          background: tint,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {hardListGlyph(kind, accent)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>
            {coll.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--text2)" }}>{subtitle}</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </div>
      {previews.length > 0 && (
        // Fixed-size thumbnail strip so a hard list with 1 watch
        // doesn't render a full-width square preview on desktop.
        // Mark's report 2026-05-06: Owned with one item rendered a
        // ~1900px-tall image. Each thumb caps at 64px on a side.
        <div style={{
          display: "flex", gap: 4, padding: "0 16px 14px",
          overflow: "hidden",
        }}>
          {previews.map(it => (
            <div key={it.id || it.rowId} style={{
              flexShrink: 0,
              width: 64, height: 64, borderRadius: 6,
              background: "var(--surface)", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {it.img ? (
                <img src={it.img} alt="" loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 14, color: "var(--text3)" }}>⌚</span>
              )}
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

const HARD_LIST_ACCENTS = {
  owned:    "#185FA5",
  sold:     "#7d8a93",
  wishlist: "#a35e15",
};
const HARD_LIST_TINTS = {
  owned:    "rgba(24,95,165,0.10)",
  sold:     "rgba(125,138,147,0.12)",
  wishlist: "rgba(163,94,21,0.10)",
};

function hardListGlyph(kind, accent) {
  if (kind === "owned") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <polyline points="9 12 11 14 15 10"/>
      </svg>
    );
  }
  if (kind === "sold") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    );
  }
  // wishlist
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4.5L6 21l1.5-7.5L2 9h7z"/>
    </svg>
  );
}

function hardListEmptyIcon(kind) {
  return kind === "owned" ? "🕰" : kind === "sold" ? "📦" : "★";
}
function hardListEmptyTitle(kind) {
  return kind === "owned" ? "No watches yet" : kind === "sold" ? "Nothing sold yet" : "Wishlist is empty";
}
function hardListEmptyBlurb(kind) {
  if (kind === "owned")    return "Add watches you own — manual entry coming soon, or pick from the archive if you bought from a tracked dealer.";
  if (kind === "sold")     return "Watches you've sold land here, freezing the price + date. Move from Owned via the \"…\" menu (coming soon).";
  return "Watches you'd like to acquire. Pin the best representative listing per reference. Ranking comes in a follow-up.";
}
function hardListEmptySubtitle(kind) {
  if (kind === "owned")    return "Watches you currently own";
  if (kind === "sold")     return "Watches you've sold — your collecting history";
  return "Watches you'd like to acquire";
}

// Inline SVG glyphs reused from WatchlistTab's pre-restructure
// implementation. Stroke #185FA5 to match the existing Lists row
// pattern that's now in ListRow.
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

const targetIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

// ── ManualItemCard ────────────────────────────────────────────────
// Manual entries don't have a dealer URL, so the standard Card's
// heart / share / "view on dealer" affordances don't apply. This is
// a slim card matching the Card grid's column width (gridStyle's
// auto-fill) but with only: photo + brand+model + meta line +
// remove menu. Edit affordances (rename / change photo / update
// price) come in PR #88 alongside the Owned→Sold transition flow.
// ── WishlistRankedList ────────────────────────────────────────────
// Vertical ranked list for the Wishlist drill-in. Each row shows
// rank number + photo + name + meta + ↑/↓ controls. ↑/↓ swap the
// row with the adjacent neighbor and persist via reorderItems
// (PR #89, 2026-05-06).
//
// Tap-based controls (not drag-drop) — same model Mark settled on
// for challenges in PR #75: works on every device with no touch-
// gesture flakiness. Optimistic local updates in the hook make
// the swap feel instant.
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
              if (window.confirm(`Remove "${title}" from Wishlist?`)) {
                await onRemove(item);
              }
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

function ManualItemCard({ item, onRemove, onMarkSold }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const title = item.title || [item.brand, item.model].filter(Boolean).join(" ").trim() || "Untitled";
  // Meta line composes ref / material / price as available.
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
        {meta && (
          <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 2 }}>{meta}</div>
        )}
        {priceLine && (
          <div style={{ fontSize: 11, color: "var(--text2)" }}>Paid {priceLine}</div>
        )}
        {soldLine && (
          <div style={{ fontSize: 11, color: "var(--text2)" }}>{soldLine}</div>
        )}
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
                style={{
                  width: "100%", border: "none", background: "transparent",
                  padding: "10px 12px", textAlign: "left",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13,
                  color: "var(--text1)",
                }}>Mark sold</button>
            )}
            <button onClick={async () => {
              setMenuOpen(false);
              if (window.confirm("Remove this watch from the list?")) {
                await onRemove();
              }
            }} style={{
              width: "100%", border: "none", background: "transparent",
              padding: "10px 12px", textAlign: "left",
              cursor: "pointer", fontFamily: "inherit", fontSize: 13,
              color: "#c0392b",
            }}>Remove</button>
          </div>
        )}
      </div>
    </div>
  );
}
