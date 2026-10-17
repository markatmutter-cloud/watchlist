import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../supabase";
import { Card } from "./Card";
import { ChallengesView } from "./ChallengesView";
import { ManualEntryForm } from "./ManualEntryForm";
import { ListingPickerModal } from "./ListingPickerModal";
import { MarkAsSoldModal } from "./MarkAsSoldModal";
import { ManageListSheet } from "./ManageListSheet";
import { confirm } from "./ConfirmModal";
import { WatchDetailSheet } from "./WatchDetailSheet";
import { ListReviewMode } from "./ListReviewMode";
import { articleAsListing } from "./EditorialView";
import CardShell from "./CardShell";
import { DossierBlocks } from "./DossierBlocks";
import { fmtUSD, matchesSearch, imgSrc } from "../utils";
import { FONT_SERIF, cardGridStyle } from "../styles";
import { Pill, Button, Chip, SavedPill, SubTabs, JumpNav, SectionHead, OverlayMenu, MenuItem } from "../ui";
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

// Saved-articles virtual list (PR_Q, 2026-05-20). Aggregates every
// hearted editorial article (kind='article' entries in watchlist_items)
// into a synthetic row in Collections > Lists alongside Saved. Mark
// spec: "lists should have a favorite articles list which automatically
// saves hearted items." Same Approach-A pattern as the Saved row —
// data stays in watchlist_items, the surface is just a UI projection.
// No collection_items writes; this id is UI-only.
const SAVED_ARTICLES_COLLECTION_ID = "__saved_articles__";
// Saved-auctions virtual list (Auction Phase 3b, 2026-05-26). Hearted
// SALES, surfaced as a synthetic row in Lists; the drill-in lists them
// as image cards that deep-link to each sale's pre-filtered grid.
const SAVED_AUCTIONS_COLLECTION_ID = "__saved_auctions__";

// ── B-08 unified Watchlists landing ──────────────────────────────
// The Lists + Searches sub-tabs collapsed into ONE rich single-scroll
// screen (no sub-tabs), built in the ReferencePage visual language so
// landing here is "impactful like the 5512/13 page" rather than "a
// bunch of lines you click into" (Mark, 2026-05-27). The helpers +
// presentational leaf components below are pure/props-driven; ListsView
// composes them in its landing return.
const WL_SERIF = FONT_SERIF;

// imgUrl from a mixed item (list item / hearted listing / article).
const wlItemImg = (it) =>
  (it && (it.img || it.image || (it.listing_snapshot && it.listing_snapshot.img))) || "";

// Cover images for a list — promoted hero wins, else first item images.
function listCoverImages(c, items, n = 4) {
  if (c && c.coverImageUrl) return [c.coverImageUrl];
  const out = [];
  for (const it of (items || [])) {
    const src = wlItemImg(it);
    if (src && !out.includes(src)) out.push(src);
    if (out.length >= n) break;
  }
  return out;
}

// Flavour chips — "8 watches · 3 articles" from already-loaded items.
function listFlavour(items) {
  let watches = 0, articles = 0;
  for (const it of (items || [])) {
    if (it && it.kind === "article") articles++;
    else watches++;
  }
  const chips = [];
  if (watches) chips.push(`${watches} watch${watches === 1 ? "" : "es"}`);
  if (articles) chips.push(`${articles} article${articles === 1 ? "" : "s"}`);
  return chips;
}

// Recency signal for "recently touched first".
function listLastActivity(c, items) {
  let t = 0;
  const stamp = (s) => { const v = Date.parse(s || ""); if (!Number.isNaN(v) && v > t) t = v; };
  if (c) { stamp(c.updatedAt); stamp(c.createdAt); }
  for (const it of (items || [])) { stamp(it.savedAt); stamp(it.createdAt); stamp(it.created_at); }
  return t;
}

const wlIsSold = (it) => !!(it && (it.sold || it.soldDate || it.soldPrice != null));


// Section band — kicker eyebrow + optional serif title + top rule +
// generous gap, mirroring ReferencePage's Section chrome.
function WLBand({ id, kicker, title, isMobile, action, children }) {
  return (
    <section id={id} data-wl-section={id}
      style={{ scrollMarginTop: 70, marginTop: isMobile ? 28 : 40 }}>
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 12,
        borderTop: "0.5px solid var(--border)",
        paddingTop: isMobile ? 16 : 20, marginBottom: isMobile ? 12 : 16,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--brand-olive-text)",
            marginBottom: title ? 6 : 0,
          }}>{kicker}</div>
          {title && <h2 style={{
            fontFamily: WL_SERIF, fontWeight: 600,
            fontSize: isMobile ? 22 : 26, lineHeight: 1.1,
            letterSpacing: "-0.01em", color: "var(--text1)", margin: 0,
          }}>{title}</h2>}
        </div>
        {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

// Image tile with a graceful fallback — failed/blocked image URLs (some
// auction/Sotheby's shots genuinely don't load) degrade to a neutral
// placeholder instead of the browser's broken-image "?" (B-38). Mirrors
// the main Card's "image not available" behaviour at tile scale.
function WLImg({ src, alt = "", style, fit = "cover" }) {
  const [bad, setBad] = useState(!src);
  if (bad) {
    return (
      <div aria-hidden style={{
        ...style, background: "var(--surface)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <img src="/favicon-192.png" alt="" aria-hidden="true"
          style={{ width: "40%", maxWidth: 56, opacity: 0.5 }} />
      </div>
    );
  }
  return (
    <img src={imgSrc(src)} alt={alt} loading="lazy"
      onError={() => setBad(true)}
      style={{ ...style, objectFit: fit, display: "block" }} />
  );
}

// Cover collage that FILLS its parent box (parent owns the aspect ratio).
// 0-1 image fills; 2-4 form a tight grid. Empty → favicon placeholder.
function WLCover({ images }) {
  const imgs = (images || []).slice(0, 4);
  if (imgs.length <= 1) {
    return <WLImg src={imgs[0]} style={{ width: "100%", height: "100%" }} />;
  }
  return (
    <div style={{
      width: "100%", height: "100%", display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: imgs.length > 2 ? "1fr 1fr" : "1fr", gap: 1,
      background: "var(--surface)",
    }}>
      {imgs.map((src, i) => (
        <WLImg key={i} src={src} style={{ width: "100%", height: "100%" }} />
      ))}
    </div>
  );
}

// A list rendered like the EDITORIAL article cards (Mark's reference):
// borderless, floats on the page, 16/10 cover on top, uppercase kicker
// (the flavour), serif title. No box/border.
// Compact ⋯ menu for list management (rename / delete) — overlaid on a
// list card and inline in the drill-in header. Closes on click-outside +
// Escape; stopPropagation so it doesn't trigger the card's open handler.
const wlMenuItem = {
  display: "block", width: "100%", textAlign: "left", padding: "9px 13px",
  fontSize: 13, fontFamily: "inherit", border: "none", background: "transparent",
  color: "var(--text1)", cursor: "pointer", whiteSpace: "nowrap",
};
function WLCardMenu({ onRename, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const pick = (fn) => (e) => { e.stopPropagation(); e.preventDefault(); setOpen(false); if (fn) fn(); };
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button aria-label="List options"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(o => !o); }}
        style={{
          width: 28, height: 28, borderRadius: 999, cursor: "pointer",
          background: "var(--bg)", border: "0.5px solid var(--border)",
          color: "var(--text1)", fontSize: 15, lineHeight: 1, fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>⋯</button>
      {open && (
        <div style={{
          position: "absolute", top: 32, right: 0, minWidth: 132, zIndex: 30,
          background: "var(--bg)", border: "0.5px solid var(--border)",
          borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.14)", overflow: "hidden",
        }}>
          {onRename && <button onClick={pick(onRename)} style={wlMenuItem}>Rename</button>}
          {onDelete && <button onClick={pick(onDelete)} style={{ ...wlMenuItem, color: "#c0453d" }}>Delete</button>}
        </div>
      )}
    </div>
  );
}

function WLListCard({ name, images, chips, shared, isMobile, onOpen, onRename, onDelete }) {
  const kicker = [...(chips || []), shared ? "shared" : null].filter(Boolean).join(" · ");
  const onKey = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } };
  return (
    <div style={{ position: "relative" }}>
      <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={onKey} style={{
        display: "block", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
      }}>
        {/* Title BELOW the cover — matches the reference-guide + article cards
            so every card grid reads the same (Mark 2026-06-02; reverses the
            earlier title-on-top, which was the lone exception). */}
        <div style={{
          width: "100%", aspectRatio: "16 / 10", background: "var(--surface)",
          overflow: "hidden", borderRadius: 4, marginBottom: 10,
        }}>
          <WLCover images={images} />
        </div>
        {kicker && (
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.14em",
            textTransform: "uppercase", color: "var(--text3)", marginBottom: 4,
          }}>{kicker}</div>
        )}
        <div style={{
          fontFamily: WL_SERIF, fontSize: isMobile ? 20 : 19, fontWeight: 500,
          lineHeight: 1.22, color: "var(--text1)",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>{name}</div>
      </div>
      {(onRename || onDelete) && (
        <div style={{ position: "absolute", top: 8, right: 8 }}>
          <WLCardMenu onRename={onRename} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

// "+ Start a list" CTA rendered as a card so it sits in the grid.
function WLStartCard({ isMobile, onClick }) {
  return (
    <button onClick={onClick} style={{
      cursor: "pointer", fontFamily: "inherit",
      border: "0.5px dashed var(--text3)", borderRadius: 12,
      background: "transparent", color: "var(--text2)",
      minHeight: isMobile ? 240 : 264,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 6, padding: 16, textAlign: "center",
    }}>
      <span style={{ fontSize: 24, lineHeight: 1 }}>＋</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>Start a list</span>
      <span style={{ fontSize: 11.5, color: "var(--text3)", lineHeight: 1.4, maxWidth: 200 }}>
        Pick a watch or reference; pull in articles, comps, examples & notes.
      </span>
    </button>
  );
}

// Empty-list onboarding (Mark 2026-06-01): when you land in a fresh, own list,
// don't dead-end with "nothing here" — set the mental model (a list is a
// dossier: watches + writing + references + notes) and offer the four doors.
// Three route you to where you add those (heart / add-to-list lives there);
// notes happen in-place via DossierBlocks rendered below this.
function EmptyListOnboarding({ name, isMobile, goToTab }) {
  // The navigate-away adds (heart a watch / save an article elsewhere). The
  // in-place adds — note / reference guide / saved search — live as the matching
  // boxed rows in DossierBlocks below, so there's one consistent boxed set, no
  // duplication (Mark 2026-06-02).
  const rows = [
    { icon: "♡", label: "Add a watch", help: "Heart a listing on the Watches tab to file it here.", go: () => goToTab && goToTab("listings", "live") },
    { icon: "📰", label: "Add an article", help: "Save an article on the Collecting tab, and it lands in this list.", go: () => goToTab && goToTab("references", "editorial") },
  ];
  return (
    <div style={{ padding: isMobile ? "8px 0 4px" : "10px 0 6px" }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: "0.14em",
        textTransform: "uppercase", color: "var(--text3)", marginBottom: 6,
      }}>Your new list</div>
      <div style={{ fontFamily: WL_SERIF, fontSize: isMobile ? 22 : 24, fontWeight: 500, color: "var(--text1)", margin: "0 0 8px" }}>
        {name || "Untitled list"}
      </div>
      <div style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.55, maxWidth: 460, marginBottom: 18 }}>
        A list collects what you're tracking on one watch or idea: the watches, the
        writing, the references, and your own notes. Start with whatever you have.
      </div>
      <div style={{ border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden", maxWidth: 520 }}>
        {rows.map((r, i) => (
          <button key={r.label} onClick={r.go} style={{
            display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
            cursor: "pointer", fontFamily: "inherit", background: "transparent",
            border: "none", borderTop: i ? "0.5px solid var(--border)" : "none", padding: "13px 14px",
          }}>
            <span aria-hidden style={{
              flexShrink: 0, width: 34, height: 34, borderRadius: 999,
              background: "var(--brand-olive-tint-12)", color: "var(--brand-olive-ink)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
            }}>{r.icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>{r.label}</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--text3)", marginTop: 1 }}>{r.help}</span>
            </span>
            <span style={{ flexShrink: 0, color: "var(--text3)", fontSize: 16 }}>{r.inPlace ? "＋" : "›"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Responsive card grid wrapper for the list cards.
function WLCardGrid({ isMobile, children }) {
  // Shared standard-library card grid — list cards, reference guides and
  // article cards all render at one size (Mark 2026-06-02).
  return <div style={cardGridStyle({ isMobile })}>{children}</div>;
}

// (WLWatchboxVault retired 2026-06-01 — the Watchbox anchor card "looked out of
// place vs the list cards" (Mark); it's now a Watchbox action on the Lists
// SectionHead. Still reachable from the top-right account menu.)

// (WLSavedStrip retired — the Saved band now renders through the shared
// CardStrip + standard Card, so hearted cards are standard size and match
// the Home strips, per Mark.)

// A saved search rendered as a tap-to-run BAR (full-width row) → the
// pre-filtered Listings. (Preview tiles reverted per Mark; a richer
// search UI is a later idea.)
function WLSearchCard({ search, onRun, onEdit, onRemove }) {
  const priceBits = [];
  if (search.minPrice != null) priceBits.push(`$${Number(search.minPrice).toLocaleString()}`);
  if (search.maxPrice != null) priceBits.push(`$${Number(search.maxPrice).toLocaleString()}`);
  const meta = [search.query ? `"${search.query}"` : null,
    priceBits.length ? priceBits.join("–") : null,
    search.count != null ? `${search.count.toLocaleString()} for sale` : null,
  ].filter(Boolean).join(" · ");
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      border: "0.5px solid var(--border)", borderRadius: 10,
      padding: "11px 14px", background: "var(--bg)",
    }}>
      <button onClick={onRun} style={{
        flex: 1, minWidth: 0, textAlign: "left", cursor: "pointer",
        fontFamily: "inherit", border: "none", background: "transparent", padding: 0,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>{search.label}</div>
        {meta && <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta}</div>}
      </button>
      <span style={{ fontSize: 12.5, color: "var(--brand-olive-text)", fontWeight: 600, flexShrink: 0 }}>View →</span>
      {onEdit && <button onClick={onEdit} aria-label="Edit search" style={wlIconBtn}>✎</button>}
      {onRemove && <button onClick={onRemove} aria-label="Delete search" style={wlIconBtn}>🗑</button>}
    </div>
  );
}

// (WLSectionNav retired 2026-06-01 — the single-scroll landing's
// jump-to-section nav is replaced by the real Lists sub-tab strip in
// App.js. Scroll-spy lives on in HeartedView for the grouped quick-jump.)

const wlIconBtn = {
  flexShrink: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13,
  border: "0.5px solid var(--border)", borderRadius: 8, background: "transparent",
  color: "var(--text2)", padding: "4px 8px", lineHeight: 1,
};

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
  // Saved auctions (Phase 3b) — joined sale objects (saved-order),
  // openSale → pre-filtered grid, toggle → unsave.
  savedAuctions = [],
  onOpenSale,
  onToggleSaveAuction,
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
  // B-08 unified Watchlists landing — searches + Watchbox now render
  // as sections on the ListsView screen (the Searches sub-tab is gone).
  isMobile,
  goToWatchbox,
  savedSearchStats,
  searchEditor,
  setSearchEditor,
  startAddSearch,
  startEditSearch,
  cancelSearchEdit,
  commitSearch,
  removeSearch,
  runSearch,
  // Shared active-filters strip (chips + Clear all), rendered atop the
  // Hearted surface so Lists gets the same affordances as Watches (B-48).
  // After creating a list, drill into it (set by App.js). Consumed in ListsView.
  pendingOpenListId,
  clearPendingOpenList,
  // Tab nav for the empty-list onboarding (watch→Watches, article/guide→Collecting).
  goToTab,
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
      // Back-nav bug fix (Mark, 2026-05-28): the early-return on
      // mount-with-no-col left `isFirstColSync` true, so the very
      // first user drill-in did replaceState instead of pushState —
      // collapsing the Watchlists-landing entry, so swipe-back from
      // a list went all the way out to the previous tab (Listings).
      // Mark this run as "consumed" so the next real user change
      // pushes a fresh history entry.
      isFirstColSync.current = false;
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

  // Just-created list → switch to the Lists sub-tab so ListsView mounts and
  // reads pendingOpenListId to drill straight in (Mark 2026-06-01).
  useEffect(() => {
    if (pendingOpenListId && setCollectionsSubTab) {
      setCollectionsSubTab("lists");
    }
  }, [pendingOpenListId, setCollectionsSubTab]);

  if (!user) {
    return (
      <EmptyState
        size="tall"
        heading="Sign in to organize your watches"
        blurb="Owned watches, watches you've sold, your wishlist, custom lists, challenges, all in one place. Sync across every device."
        action={isAuthConfigured && (
          <Button primary inline onClick={signInWithGoogle}>Sign in</Button>
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
  } else if (subTab === "lists" || subTab === "searches" || subTab === "shared") {
    body = (
      <ListsView
        section={subTab}
        pendingOpenListId={pendingOpenListId}
        clearPendingOpenList={clearPendingOpenList}
        goToTab={goToTab}
        user={user}
        allListings={allListings}
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
        savedAuctions={savedAuctions}
        onOpenSale={onOpenSale}
        onToggleSaveAuction={onToggleSaveAuction}
        // B-08 unified landing: Watchbox hero anchor + searches section.
        isMobile={isMobile}
        goToWatchbox={goToWatchbox}
        savedSearchStats={savedSearchStats}
        searchEditor={searchEditor}
        setSearchEditor={setSearchEditor}
        startAddSearch={startAddSearch}
        startEditSearch={startEditSearch}
        cancelSearchEdit={cancelSearchEdit}
        commitSearch={commitSearch}
        removeSearch={removeSearch}
        runSearch={runSearch}
        setCollectionCover={collectionsApi?.setCollectionCover}
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
    // paddingTop bumped 4 → 16 on 2026-05-14 (Mark feedback) — sub-tab
    // strip + first content row were crowding each other after the
    // SubTabIntro retirement; the intro card used to provide implicit
    // vertical room. Keeps the segmented Collection/Archive/Plan
    // toggle below the sub-tab strip with breathing space.
    <div style={{ paddingTop: 16 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "0 0 14px",
        marginBottom: 8, flexWrap: "wrap",
      }}>
        {/* Segmented control — Collection / Archive / Plan.
            Restyled 2026-05-10 from inner-pill chips so the primary
            nav inside My Watches reads as a distinct block. Mark
            feedback: pills read as filter chips, not as the primary
            axis people are picking between. */}
        <SubTabs ariaLabel="Watchbox views" activeKey={toggle} onSelect={setToggle}
          tabs={[
            { key: "collection", label: `Collection · ${ownedItems.length}` },
            { key: "archive", label: `Archive · ${soldItems.length}` },
            { key: "plan", label: "Plan" },
          ]} />
        <div style={{ flex: 1 }} />
        {/* +Add CTAs scope to the active toggle. Plan view shows
            "+ From feed" pulling into Wants (shortlist), with a
            secondary "+ Add a watch" for manual entries. Collection
            and Archive show their existing add-flows. */}
        {toggle === "plan" && wishlist && (
          <>
            <Pill onClick={() => onAddManual("owned")}>+ Add a watch</Pill>
            <Pill primary onClick={onShortlistAddFromFeed}>+ From feed</Pill>
          </>
        )}
        {toggle !== "plan" && targetCollectionId && (
          <>
            <Pill onClick={() => onAddManual(targetKind)}>+ Add a watch</Pill>
            <Pill primary onClick={() => onAddFromFeed(targetCollectionId, `Add to ${targetName}`)}>+ From feed</Pill>
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
                <Pill onClick={() => onAddFromFeed(owned?.id, "Add to Collection")}>+ From feed</Pill>
                <Pill primary onClick={() => onAddManual("owned")}>+ Add a watch</Pill>
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
            heading="Nothing sold yet"
            blurb="When you part with a piece, mark it sold from My collection. It moves here with the date and what it went for."
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
          padding: "4px 4px 12px",
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {title}
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "var(--text1)", marginTop: 4, letterSpacing: "-0.2px" }}>
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
          <EmptyHardListSection text="Everything you own sits here by default. Flag a watch for sale and it moves down to Selling." />
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
        <SectionExplain text="Owned watches you've flagged for sale. Tap ↑ (red) to keep instead. The detail sheet has the assumed sell value field; set it so the proceeds total reads accurately." />
        {selling.length === 0 ? (
          <EmptyHardListSection text="Tap ↑ on a Keeping card to move it here when you're thinking about letting it go." />
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
          <EmptyHardListSection text="Plan not ready. Refresh to retry the auto-create." />
        ) : wishlistItems.length === 0 ? (
          <EmptyState
            icon="★"
            heading="Nothing on your wishlist"
            blurb="Build the hunt list: references you're chasing, dial variants you'd buy if one surfaced. Pick from a list below or + From feed."
            action={
              <Pill primary onClick={onShortlistAddFromFeed}>+ From feed</Pill>
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
              <Pill onClick={() => setExpanded(true)}>Show all {candidates.length}</Pill>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function PickerChip({ active, label, onClick }) {
  return <Chip on={active} onClick={onClick}>{label}</Chip>;
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
          <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
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
// ShareMenu retired 2026-05-14 — replaced by a single flat Share
// button that opens the unified Share modal (ManageListSheet) for
// owners or fires the native share sheet directly for non-owners.
// Mark feedback: the dropdown chevron was too subtle and the
// "Share this list" + "Manage collaborators" split confused users
// when both end up surfacing the same kind of link.

// ── Lists sub-tab ─────────────────────────────────────────────────
// Existing list-of-lists pattern. Hard system lists (Owned/Sold/
// Wishlist) are excluded — they live in My Collection and Wishlist
// sub-tabs now. Shared inbox + user-created lists + Hidden synthetic
// row are surfaced.
function ListsView({
  // Which section to show — the Lists tab is sub-tabbed now (2026-06-01):
  // "lists" (Watchbox vault + your lists) · "searches" · "shared". The
  // hearted "Saved" band moved to its own HeartedView sub-tab.
  section = "lists",
  pendingOpenListId,
  clearPendingOpenList,
  goToTab,
  user,
  allListings = [],
  cols, itemsByColl, hiddenItems,
  watchItems,
  watchlist, toggleHide,
  compact, gridStyle, primaryCurrency,
  handleShare, handleWish,
  openCollectionPicker, observeCard, onClickListing,
  startCreateCollection,
  setEditingCollection,
  deleteCollection,
  removeItemFromCollection,
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
  // Saved auctions (Phase 3b).
  savedAuctions = [],
  onOpenSale,
  onToggleSaveAuction,
  // B-08 unified landing — Watchbox hero + searches section + covers.
  isMobile,
  goToWatchbox,
  savedSearchStats = [],
  startAddSearch,
  startEditSearch,
  removeSearch,
  runSearch,
}) {
  // One-at-a-time recipient review mode (Mark spec 2026-05-11).
  // Triggered by the recipient banner's "Start review" CTA. Opens a
  // fullscreen overlay walking through items the current user hasn't
  // reacted to yet. Closed via Done / ESC / completing the queue.
  const [reviewModeOpen, setReviewModeOpen] = useState(false);
  // Hearted-only filter on the active drill-in (Mark spec 2026-05-22:
  // "when I'm in a list (like one of the auctions lists) I want to
  // filter them by hearted items"). Useful for narrowing 300-lot
  // auction catalogs to the user's saved subset. Local-state — resets
  // when the user backs out of the drill-in. Toggle pill lives in
  // the drill-in header. Skipped for Saved (it's all hearted) and
  // Hidden (the watchlist filter would empty it).
  const [heartedOnly, setHeartedOnly] = useState(false);
  // (savedTypeFilter + the landing section-nav scroll-spy retired
  // 2026-06-01 — hearted moved to its own HeartedView sub-tab and the
  // single-scroll section nav is replaced by the Lists sub-tab strip.)
  // Reset the toggle when switching between lists so a previous
  // session's filter doesn't carry over.
  useEffect(() => { setHeartedOnly(false); }, [selectedListId]);
  // Drill straight into a just-created list (App → CollectionsTab → here).
  useEffect(() => {
    if (pendingOpenListId) {
      setSelectedListId(pendingOpenListId);
      if (clearPendingOpenList) clearPendingOpenList();
    }
  }, [pendingOpenListId, setSelectedListId, clearPendingOpenList]);
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

  // Saved-articles synthetic row (PR_Q, 2026-05-20). Walks the
  // watchlist map for entries flagged kind='article' on the snapshot.
  // useWatchlist exposes `items` as a map where each value is the
  // full snapshot spread, so this is one filter pass — no extra
  // fetch needed. Hides the row entirely when the user has no
  // hearted articles yet (parallel to "Hidden" / "My reactions"
  // hiding when empty).
  const savedArticleItems = useMemo(() => {
    const out = [];
    for (const v of Object.values(watchlist || {})) {
      if (v && v.kind === "article") out.push(v);
    }
    // Newest-first by savedAt — matches the Saved row's implicit order.
    out.sort((a, b) => {
      const sa = a.savedAt || "";
      const sb = b.savedAt || "";
      return sb.localeCompare(sa);
    });
    return out;
  }, [watchlist]);
  const savedArticlesCount = savedArticleItems.length;
  const savedArticlesRow = (user && savedArticlesCount > 0) ? {
    id: SAVED_ARTICLES_COLLECTION_ID,
    name: "Saved articles",
    isSystem: true,
    isSavedArticles: true,
  } : null;

  // Saved-auctions synthetic row (Phase 3b). Hidden when empty, like
  // the other synthetic rows.
  const savedAuctionsCount = savedAuctions.length;
  const savedAuctionsRow = (user && savedAuctionsCount > 0) ? {
    id: SAVED_AUCTIONS_COLLECTION_ID,
    name: "Saved auctions",
    isSystem: true,
    isSavedAuctions: true,
  } : null;

  const selected = (() => {
    if (!selectedListId) return null;
    if (selectedListId === HIDDEN_COLLECTION_ID) return hiddenRow;
    if (selectedListId === SAVED_COLLECTION_ID) return savedRow;
    if (selectedListId === SAVED_ARTICLES_COLLECTION_ID) return savedArticlesRow;
    if (selectedListId === SAVED_AUCTIONS_COLLECTION_ID) return savedAuctionsRow;
    return cols.find(c => c.id === selectedListId) || null;
  })();

  if (selected) {
    // Saved-articles virtual list (PR_Q, 2026-05-20). Focused render
    // — hearted articles aren't dealer listings so they don't fit the
    // Card-based grid below. Reuses ArticleCard from EditorialView via
    // an article-shape projection from each watchlist snapshot.
    if (selected.id === SAVED_ARTICLES_COLLECTION_ID) {
      return (
        <SavedArticlesView
          items={savedArticleItems}
          isWide={isWide}
          isMobile={!isWide}
          gridStyle={gridStyle}
          watchlist={watchlist}
          handleWish={handleWish}
          openCollectionPicker={openCollectionPicker}
          handleShare={handleShare}
          onBack={() => setSelectedListId(null)}
        />
      );
    }

    // Saved-auctions virtual list (Phase 3b). Hearted SALES as image
    // cards; tapping one opens its pre-filtered grid (onOpenSale).
    if (selected.id === SAVED_AUCTIONS_COLLECTION_ID) {
      return (
        <SavedAuctionsView
          items={savedAuctions}
          isWide={isWide}
          gridStyle={gridStyle}
          onOpenSale={onOpenSale}
          onToggleSave={onToggleSaveAuction}
          onBack={() => setSelectedListId(null)}
        />
      );
    }

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
    // PR 2026-05-22: optional "hearted only" narrowing on top of the
    // shell filters. Skipped for Saved (already all-hearted by
    // definition) and Hidden (would empty the view). Toggle in the
    // drill-in header below.
    const heartedFilterActive = heartedOnly && !isSavedColl && !isHiddenColl;
    const heartedCount = isSavedColl || isHiddenColl
      ? rawItems.length
      : rawItems.reduce((acc, i) => acc + (watchlist[i.id] ? 1 : 0), 0);
    const filteredRaw = heartedFilterActive
      ? rawItems.filter(i => !!watchlist[i.id])
      : rawItems;
    const items = applyDrillInFilters(filteredRaw, filterValues);
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
    // isSharedList — any list with 2+ members, excluding the
    // synthetic Hidden/Saved rows AND the Shared-with-me inbox (the
    // inbox holds single-listing shares; recipient's options are
    // heart / add-to-list / share-onward, NOT react). Drives screening
    // availability + per-card ReactionStrip rendering. Mark spec
    // 2026-05-14: owners of shared lists also get screening + reactions;
    // the recipient banner stays recipient-only.
    const isSharedList = memberCount >= 2
      && !isHiddenColl
      && !isSavedColl
      && !selected.isSharedInbox;
    // Screening (the binary skip/heart swipe) is scoped to shared
    // lists. The auction auto-list path was retired 2026-05-26.
    const screensEnabled = isSharedList;
    const isRecipient = isSharedList && !isOwner;
    const ownerName = (selected?.userId && memberMap.get(selected.userId)) || "Someone";
    const myUserId = user?.id || null;
    // Share callback — routes through /share/list_<id> so preview bots get a
    // per-list OG card (name + count + first cover) instead of the generic
    // site hourglass (P-23, 2026-06-03). api/share.js redirects humans to the
    // same ?list=<id>&shared=1 surface as before; recipients land on
    // ListReceiver which fetches via the public `get_public_list` RPC.
    const triggerShare = async () => {
      const cover = (rawItems.find(i => i && i.img) || {}).img || "";
      const shareU = new URL(`${window.location.origin}/share/${encodeURIComponent(`list_${selected.id}`)}`);
      shareU.searchParams.set("t", selected.name || "A list");
      shareU.searchParams.set("n", String(rawItems.length));
      if (cover) shareU.searchParams.set("img", cover);
      const url = shareU.toString();
      const shareData = {
        title: `${selected.name} · Watchlist`,
        text: `${selected.name}: a list on Watchlist`,
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
    // Heart toggle for cards in the drill-in. Reactions retired
    // 2026-05-26 — the heart is now a plain watchlist toggle on every
    // list (shared lists no longer mirror it as a ❤️ reaction).
    const wrappedHandleWish = handleWish;

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
    const inlineScreeningActive = reviewModeOpen && screensEnabled && isWide;
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
        {/* In-list header → the shared SectionHead (P-18, 2026-06-03): the tinted title CARD
            truncated the list name on mobile ("JLC Wat…"). SectionHead gives the standard exit
            pill + full wrapping title + meta + action pills; the ⋯ menu rides the `trailing` slot. */}
        {!inlineScreeningActive && (
          <SectionHead
            onExit={() => setSelectedListId(null)}
            exitLabel="All lists"
            title={selected.name}
            // Count rule (Mark 2026-06-03): the drill-in's filter bar already
            // carries "N items" in its reserved slot — meta keeps only the
            // shared-by attribution, never a count under the title.
            meta={isRecipient && items.length > 0 ? `Shared by ${ownerName}` : null}
            actions={[
              ...(screensEnabled ? [{
                label: "Screen",
                ariaLabel: "Screen this list one watch at a time",
                onClick: () => { setReviewModeOpen(true); setScreeningResetTick(t => t + 1); },
              }] : []),
              ...(showActions ? [{
                label: shareCopied ? "Link copied" : "Share",
                onClick: isOwner ? () => setManageListOpen(true) : triggerShare,
              }] : []),
            ]}
            trailing={(isOwner && !selected.isSharedInbox && setEditingCollection) ? (
              <WLCardMenu
                onRename={() => setEditingCollection({ id: selected.id, name: selected.name })}
                onDelete={deleteCollection ? async () => {
                  if (await confirm({
                    title: "Delete list?",
                    message: `"${selected.name}" will be removed. Items inside aren't deleted from your watchlist; they're just unbundled from this list.`,
                    confirmLabel: "Delete", tone: "danger",
                  })) { await deleteCollection(selected.id); setSelectedListId(null); }
                } : undefined}
              />
            ) : null}
          />
        )}
        {reviewModeOpen && screensEnabled && (
          <ListReviewMode
            key={screeningResetTick}
            items={items}
            listId={selected.id}
            listName={selected.name}
            // Owner-self-review passes no ownerName; the recipient
            // flow surfaces "{ownerName}'s list" attribution.
            ownerName={isOwner ? null : ownerName}
            onClose={() => setReviewModeOpen(false)}
            primaryCurrency={primaryCurrency}
            watchlist={watchlist}
            handleWish={wrappedHandleWish}
            openCollectionPicker={openCollectionPicker}
            onShare={handleShare}
          />
        )}
        {/* On desktop, the screening surface replaces the drill-in
            body content area (Approach B per Mark 2026-05-13 — top
            wordmark + nav + filter row stay visible). Skip the grid
            entirely while inline-screening is active. On mobile the
            screening overlay portals to body, so the grid still
            renders underneath (covered visually). */}
        {(reviewModeOpen && screensEnabled && isWide) ? null : items.length === 0 ? (
          (isOwner && !isHiddenColl && !isSavedColl && !selected.isSharedInbox) ? (
            // Own, freshly-empty list → onboarding (cold-open + four doors)
            // with the notes block right below so notes are addable in-place.
            <>
              <EmptyListOnboarding
                name={selected.name}
                isMobile={isMobile}
                goToTab={goToTab}
              />
              <div id="list-notes" style={{ marginTop: 22 }}>
                <DossierBlocks
                  collectionId={selected.id}
                  user={user}
                  allListings={allListings}
                  canEdit={isOwner}
                  onClickListing={onClickListing}
                />
              </div>
            </>
          ) : (
            <EmptyState
              icon={isHiddenColl ? "👁" : isSavedColl ? "♡" : "📂"}
              heading={isHiddenColl ? "Nothing hidden"
                      : isSavedColl ? "No saved watches yet"
                      : "Nothing shared yet"}
              blurb={isHiddenColl
                ? "Listings you hide from the Available feed land here. Use the \"…\" menu on any card to unhide it."
                : isSavedColl
                  ? "Browse the Listings tab and tap the heart on any item, and it'll appear here with the price you saved at, even after the dealer takes the URL down."
                  : "Lists other collectors share with you appear here."}
            />
          )
        ) : (
          (() => {
            // Per-item card render. Reactions retired 2026-05-26 —
            // cards no longer carry a rating picker or aggregate
            // chips; the list view is a plain grid (no buckets).
            const renderItemCard = (item) => {
              const showChip = memberCount >= 2
                && !!item.whoAdded
                && item.whoAdded !== user?.id;
              const addedByName = showChip ? memberMap.get(item.whoAdded) : null;
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
            };

            // Bucketing only applies on shared lists (where reactions
            // exist) AND when the user hasn't opted to "Flat list" in
            // the Manage panel. Otherwise fall back to the plain grid.
            // Mark spec 2026-05-14: flat-list view toggle retired
            // with the panel — buckets are the only view now on
            // shared lists (solo lists fall through to the plain
            // grid below). Re-introduce a toggle here if the flat
            // view is ever asked for again.
            // Articles split (PR_R, 2026-05-20). Items with
            // snapshot.kind='article' get rendered in their own
            // section below the listings grid — Mark spec: articles
            // belong in a "different section" alongside listings/sold
            // within the same user-created list. Article rows fall
            // out of the bucketing flow (buckets are sentiment review,
            // which doesn't apply to articles).
            const articleItems = items.filter(i => i && i.kind === 'article');
            const listingItems = items.filter(i => !i || i.kind !== 'article');

            const renderArticlesSection = () => {
              if (articleItems.length === 0) return null;
              // Project the stored listing-shaped snapshot back to
              // article shape ArticleCard expects (same projection as
              // SavedArticlesView above).
              const asArticles = articleItems.map(snap => {
                const articleMeta = snap.article || {};
                return {
                  url: snap.url,
                  title: snap.title || snap.ref || "",
                  brand: snap.brand || "",
                  model: snap.model || null,
                  model_line: snap.model_line || null,
                  reference_no: snap.reference_no || null,
                  author: articleMeta.author || "",
                  published_at: articleMeta.published_at || "",
                  excerpt: articleMeta.excerpt || "",
                  image: snap.img || "",
                  _source: {
                    key: articleMeta.source_key || "",
                    label: articleMeta.source_label || "",
                    publication: articleMeta.source_label || "",
                  },
                  // Pass rowId through so the heart-toggle remove path
                  // can flow through removeItemFromCollection (handled
                  // via the heart toggle on ArticleCard which calls
                  // handleWish → toggleWatchlist; the collection_items
                  // row stays unless the user explicitly removes via
                  // the "..." menu's Remove. For PR_R we keep the
                  // existing remove path — heart un-toggle removes
                  // from watchlist_items but the article entry stays
                  // in the collection list. Future iteration could
                  // sync these.).
                  _rowId: snap.rowId,
                };
              });
              return (
                <div id="list-articles" style={{ marginTop: 24, scrollMarginTop: "calc(var(--sticky-top, 0px) + 56px)" }}>
                  <div style={{
                    display: "flex", alignItems: "baseline", gap: 8,
                    margin: "0 0 10px",
                  }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600,
                      color: "var(--text2)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}>Articles</div>
                    <div style={{ fontSize: 13, color: "var(--text3)" }}>
                      · {asArticles.length}
                    </div>
                  </div>
                  <div style={gridStyle}>
                    {/* S4: articles render via the shared CardShell (square)
                        so they line up with listing cards in the grid. */}
                    {asArticles.map(a => {
                      const asListing = articleAsListing(a);
                      const wished = !!(watchlist && asListing && watchlist[asListing.id]);
                      return (
                        <CardShell
                          key={a.url}
                          href={a.url}
                          aspect="square"
                          image={a.image ? { src: a.image, alt: "" } : null}
                          level2={<div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
                            {(a._source && a._source.label) || ""}
                          </div>}
                          level1={<div style={{ fontSize: 12, fontWeight: 500, color: "var(--text1)", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {a.title}
                          </div>}
                          heart={(asListing && handleWish) ? { wished, onToggle: () => handleWish(asListing) } : null}
                          menu={{
                            onAddToCollection: (openCollectionPicker && asListing) ? () => openCollectionPicker(asListing) : null,
                            onShare: (handleShare && asListing) ? () => handleShare(asListing) : null,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            };

            // Reactions retired 2026-05-26 — every list (shared
            // included) renders as a flat grid; the sentiment buckets
            // (To review / Loved / Liked / Passed) are gone.
            //
            // Section quick-nav (P-19, 2026-06-03): the same jump-pill
            // pattern as the reference-guide page, over the list's parts —
            // Notes (the dossier blocks) · Watches · Articles. Pills render
            // only when there's more than one section to jump between.
            // scrollMarginTop offsets by --sticky-top so anchors land clear
            // of the mobile chrome (same hook as ReferencePage).
            const hasDossier = !isHiddenColl && !isSavedColl && !selected.isSharedInbox;
            const NAV_SECTIONS = [
              hasDossier && { id: "list-notes", label: "Notes" },
              listingItems.length > 0 && { id: "list-items", label: "Watches" },
              articleItems.length > 0 && { id: "list-articles", label: "Articles" },
            ].filter(Boolean);
            const goToSection = (id) => {
              const el = document.getElementById(id);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            };
            const sectionAnchor = { scrollMarginTop: "calc(var(--sticky-top, 0px) + 56px)" };
            return (
              <>
                {NAV_SECTIONS.length > 1 && (
                  <JumpNav ariaLabel="Sections of this list"
                    items={NAV_SECTIONS.map((x) => ({ key: x.id, label: x.label }))}
                    onGo={goToSection} />
                )}
                {hasDossier && (
                  <div id="list-notes" style={sectionAnchor}>
                    <DossierBlocks
                      collectionId={selected.id}
                      user={user}
                      allListings={allListings}
                      canEdit={isOwner}
                      onClickListing={onClickListing}
                    />
                  </div>
                )}
                {/* Hearted filter — at the top of the listgrid, in the
                    standard `♡ Saved` filter-chip style (Mark 2026-05-28). */}
                {!isSavedColl && !isHiddenColl && heartedCount > 0 && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                    <SavedPill on={heartedOnly} what="saved items"
                      onClick={() => setHeartedOnly(v => !v)} />
                  </div>
                )}
                <div id="list-items" style={{ ...gridStyle, borderRadius: 10, overflow: "hidden", ...sectionAnchor }}>
                  {listingItems.map(renderItemCard)}
                </div>
                {renderArticlesSection()}
              </>
            );
          })()
        )}
        {/* ListManagePanel retired 2026-05-14 — its actions (Resume
            screening / Reset / View) are now first-class header
            buttons (Share / Review / Reset) plus the bucket-default-
            grid change makes the view toggle unnecessary. */}
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
  // The auction auto-list workflow was retired 2026-05-26; any
  // pre-existing type='auction' lists now fold into "My lists" until
  // the DB clean-slate removes them.
  const ownedUserLists = userCols.filter(c => c.userId && c.userId === myUserId);
  const ownedLists  = ownedUserLists;
  const collabLists = userCols.filter(c => c.userId && c.userId !== myUserId);
  // The owned group is special: even when empty we render its
  // header + "+ New list" CTA so the user can always discover the
  // create flow (Mark spec 2026-05-14, after SubTabIntro was
  // retired). Saved / Shared groups hide entirely when empty.
  const sharedRows = [
    ...(sharedInbox ? [sharedInbox] : []),
    ...collabLists,
  ];
  // ── B-08 unified landing — derived sets. (The savedRow / articles /
  // auctions *singular* synthetic rows above still feed the `selected`
  // drill-in resolver; only the old grouped-ListRow arrays are gone.) ──
  const ownedByRecency = [...ownedLists].sort(
    (a, b) => listLastActivity(b, itemsByColl[b.id]) - listLastActivity(a, itemsByColl[a.id])
  );
  // (The hearted "Saved" band moved to its own sub-tab — HeartedView —
  // on 2026-06-01. Saved articles/auctions remain reachable via their
  // drill-in resolver below; Phase 2 re-surfaces them as typed bookmark
  // sections. The section-nav scroll-spy retired with the single scroll.)
  // (wlHeaderBtn retired 2026-06-01 — section actions moved into the section head.)

  // (renderListRow + the ListRow row family retired in B-08 — the
  // landing now renders cover-image cards, not icon+text rows. Rename/
  // delete live on the drill-in's Manage button. The synthetic
  // savedRow/articles/auctions still drive the `selected` drill-in.)

  return (
    <div style={{ paddingTop: 0, paddingBottom: isMobile ? 220 : 160 }}>
      {/* LISTS — a sectioned page (Mark 2026-06-01): Watchbox vault anchor →
          Your lists → Shared with you → Saved sales. Shared + Sales are card
          sections here now (the separate "Shared" sub-tab + the Hearted "Sales"
          type were retired in favour of these). */}
      {section === "lists" && (
        <>
          {/* The sub-tab says "Lists", so this row carries no title (no page titles); the count
              rides its right edge, since there is no filter bar on this surface. */}
          <SectionHead
            count={`${ownedByRecency.length} ${ownedByRecency.length === 1 ? "list" : "lists"}`}
            actions={(user && goToWatchbox) ? [{
              label: "Watchbox", onClick: goToWatchbox,
              icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /><circle cx="12" cy="14.5" r="1.6" />
              </svg>,
            }] : []} />
          <div style={{ paddingTop: isMobile ? 16 : 20 }}>
            <WLCardGrid isMobile={isMobile}>
              {ownedByRecency.map(c => (
                <WLListCard key={c.id}
                  name={c.name}
                  images={listCoverImages(c, itemsByColl[c.id])}
                  chips={listFlavour(itemsByColl[c.id])}
                  shared={sharedListIds.has(c.id)}
                  isMobile={isMobile}
                  onOpen={() => setSelectedListId(c.id)}
                  onRename={setEditingCollection ? () => setEditingCollection({ id: c.id, name: c.name }) : undefined}
                  onDelete={deleteCollection ? async () => {
                    if (await confirm({
                      title: "Delete list?",
                      message: `"${c.name}" will be removed. Items inside aren't deleted from your watchlist; they're just unbundled from this list.`,
                      confirmLabel: "Delete", tone: "danger",
                    })) await deleteCollection(c.id);
                  } : undefined} />
              ))}
              <WLStartCard isMobile={isMobile} onClick={startCreateCollection} />
            </WLCardGrid>

          {/* SHARED WITH YOU — collaborator lists + the shared-listings inbox. */}
          {sharedRows.length > 0 && (
            <WLBand id="shared" kicker="Shared with you" isMobile={isMobile}>
              <WLCardGrid isMobile={isMobile}>
                {sharedRows.map(c => {
                  const isInbox = c.isSharedInbox;
                  const items = isInbox ? [] : (itemsByColl[c.id] || []);
                  return (
                    <WLListCard key={c.id}
                      name={isInbox ? "Shared listings" : c.name}
                      images={listCoverImages(c, items)}
                      chips={isInbox ? [] : listFlavour(items)}
                      shared
                      isMobile={isMobile}
                      onOpen={() => setSelectedListId(c.id)} />
                  );
                })}
              </WLCardGrid>
            </WLBand>
          )}

          {/* SAVED SALES — hearted auction catalogs, as cards (Mark: a section
              in Lists, not under Saved). Tap opens the sale's lots. */}
          {savedAuctions && savedAuctions.length > 0 && (
            <WLBand id="sales" kicker="Saved auctions" isMobile={isMobile}>
              <WLCardGrid isMobile={isMobile}>
                {savedAuctions.map(a => (
                  <WLListCard key={a.url}
                    name={a.title || a.name || a.house || "Auction"}
                    images={[a._heroImg].filter(Boolean)}
                    chips={[a.house, a.dateLabel].filter(Boolean)}
                    isMobile={isMobile}
                    onOpen={() => onOpenSale && onOpenSale(a)} />
                ))}
              </WLCardGrid>
            </WLBand>
          )}
          </div>
        </>
      )}

      {/* SEARCHES — saved searches, tap to re-run on Listings. */}
      {section === "searches" && (
        <>
          {/* The sub-tab says "Searches": no title, just the count and the add action. */}
          <SectionHead
            count={savedSearchStats ? `${savedSearchStats.length} saved` : null}
            actions={startAddSearch ? [{ label: "+ New search", onClick: startAddSearch }] : []} />
          <div style={{ paddingTop: isMobile ? 16 : 20 }}>
            {savedSearchStats && savedSearchStats.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {savedSearchStats.map(s => (
                  <WLSearchCard key={s.id} search={s}
                    onRun={() => runSearch && runSearch(s)}
                    onEdit={startEditSearch ? () => startEditSearch(s) : null}
                    onRemove={removeSearch ? async () => {
                      if (await confirm({
                        title: "Delete search?",
                        message: `"${s.label}" will be removed.`,
                        confirmLabel: "Delete", tone: "danger",
                      })) removeSearch(s.id);
                    } : null} />
                ))}
              </div>
            ) : (
              <EmptyState icon="🔍" heading="No saved searches yet" size="compact"
                blurb="Search Listings, then tap the heart by the search bar to save it. Saved searches re-run across every dealer, so you can jump straight back to them here." />
            )}
          </div>
        </>
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
        <OverlayMenu small label="More">
          {({ close }) => (
            <>
              {onClickDetail && (
                <MenuItem onClick={() => { close(); onClickDetail(); }}>Watch details</MenuItem>
              )}
              {onMarkSold && (
                <MenuItem onClick={() => { close(); onMarkSold(); }}>Mark sold</MenuItem>
              )}
              <MenuItem danger onClick={async () => {
                close();
                if (await confirm({
                  title: "Remove watch?",
                  message: "This watch will be removed from this list.",
                  confirmLabel: "Remove",
                  tone: "danger",
                })) await onRemove();
              }}>Remove</MenuItem>
            </>
          )}
        </OverlayMenu>
      </div>
    </div>
  );
}

// (Inline Lists-view SVG icon family retired in B-08 — the landing's
// cover-image cards don't use icon+text rows. Synthetic-row icons
// lived only in the removed renderListRow.)

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


// ─────────────────────────────────────────────────────────────────
// SavedArticlesView — drill-in for the Saved-articles synthetic row
// (PR_Q, 2026-05-20). Renders the user's hearted articles via the
// shared ArticleCard from EditorialView so the visual + heart logic
// stays identical to the source surface.
//
// Items here come from useWatchlist (each value spread from
// watchlist_items.listing_snapshot) filtered by kind === 'article'.
// We re-project them into the article shape ArticleCard expects so
// the same component can render both surfaces.
// ─────────────────────────────────────────────────────────────────

function SavedArticlesView({ items, isWide, gridStyle, watchlist, handleWish, openCollectionPicker, handleShare, onBack }) {
  // Convert a stored snapshot (article-as-listing shape) back into
  // the article shape ArticleCard renders. The stored fields live
  // both at the top level (ref, brand) and inside the `article`
  // sub-object (author, published_at, excerpt, source_label).
  const asArticles = items.map(snap => {
    const articleMeta = snap.article || {};
    return {
      url: snap.url,
      title: snap.title || snap.ref || "",
      brand: snap.brand || "",
      model: snap.model || null,
      model_line: snap.model_line || null,
      reference_no: snap.reference_no || null,
      author: articleMeta.author || "",
      published_at: articleMeta.published_at || "",
      excerpt: articleMeta.excerpt || "",
      image: snap.img || "",
      _source: {
        key: articleMeta.source_key || "",
        label: articleMeta.source_label || "",
        publication: articleMeta.source_label || "",
      },
    };
  });

  return (
    <div style={{ padding: isWide ? "0 24px 80px" : "0 14px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0 6px" }}>
        <Pill quiet onClick={onBack}>← Lists</Pill>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text1)", margin: 0 }}>
          Saved articles
        </h1>
        <span style={{ fontSize: 13, color: "var(--text3)" }}>· {asArticles.length}</span>
      </div>

      <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, marginBottom: 16 }}>
        Auto-populated from articles you've hearted on the Articles tab. Tap the heart
        on any card to remove it from this list.
      </div>

      {asArticles.length === 0 ? (
        <div style={{
          padding: 32, color: "var(--text2)", textAlign: "center",
          border: "0.5px dashed var(--border)", borderRadius: 8,
        }}>
          You haven't hearted any articles yet. Open the Articles tab and tap the heart on any article you'd like to save.
        </div>
      ) : (
        <div style={gridStyle}>
          {/* S4 (2026-05-24): saved articles render through the shared CardShell
              (square image, source kicker, title) so they LINE UP with the
              listing cards in the same grid — the magazine ArticleCard (16/10,
              serif) was stuffed into the dense grid and didn't match. Heart +
              menu wired via articleAsListing exactly as ArticleCard did. */}
          {asArticles.map(a => {
            const asListing = articleAsListing(a);
            const wished = !!(watchlist && asListing && watchlist[asListing.id]);
            return (
              <CardShell
                key={a.url}
                href={a.url}
                aspect="square"
                image={a.image ? { src: a.image, alt: "" } : null}
                level2={<div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
                  {(a._source && a._source.label) || ""}
                </div>}
                level1={<div style={{ fontSize: 12, fontWeight: 500, color: "var(--text1)", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {a.title}
                </div>}
                heart={(asListing && handleWish) ? { wished, onToggle: () => handleWish(asListing) } : null}
                menu={{
                  onAddToCollection: (openCollectionPicker && asListing) ? () => openCollectionPicker(asListing) : null,
                  onShare: (handleShare && asListing) ? () => handleShare(asListing) : null,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// SavedAuctionsView — drill-in for the Saved-auctions synthetic row
// (Auction Phase 3b, 2026-05-26). Hearted SALES as image-forward cards;
// tapping a card opens that sale's pre-filtered grid (onOpenSale routes
// to Auctions if upcoming/live, Sold if past). The heart un-saves.
function SavedAuctionsView({ items, isWide, gridStyle, onOpenSale, onToggleSave, onBack }) {
  return (
    <div style={{ padding: isWide ? "0 24px 80px" : "0 14px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0 6px" }}>
        <Pill quiet onClick={onBack}>← Lists</Pill>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text1)", margin: 0 }}>
          Saved auctions
        </h1>
        <span style={{ fontSize: 13, color: "var(--text3)" }}>· {items.length}</span>
      </div>

      <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, marginBottom: 16 }}>
        Sales you've hearted on the Auctions calendar. Tap one to open its lots; tap the heart to remove it.
      </div>

      {items.length === 0 ? (
        <div style={{
          padding: 32, color: "var(--text2)", textAlign: "center",
          border: "0.5px dashed var(--border)", borderRadius: 8,
        }}>
          You haven't saved any auctions yet. Open the Auctions calendar and tap the heart on a sale.
        </div>
      ) : (
        <div style={gridStyle}>
          {items.map(a => {
            const isClosed = a.status === "past";
            const isLive = a.status === "live";
            const dateLabel = a.dateLabel || "";
            return (
              <div key={a.url}
                onClick={() => onOpenSale && onOpenSale(a)}
                role="button"
                style={{
                  display: "flex", flexDirection: "column",
                  border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden",
                  background: "var(--card-bg)", cursor: onOpenSale ? "pointer" : "default",
                }}>
                <div style={{
                  position: "relative", aspectRatio: "1 / 1",
                  background: "var(--surface)", overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {a._heroImg ? (
                    <img src={imgSrc(a._heroImg)} alt="" loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.14em",
                                   textTransform: "uppercase", fontWeight: 600, textAlign: "center", padding: 8 }}>
                      {a.house || "Auction"}
                    </span>
                  )}
                  {(isLive || isClosed) && (
                    <span style={{
                      position: "absolute", top: 8, left: 8,
                      fontSize: 10, fontWeight: 600, color: "#fff",
                      background: isLive ? "#c43" : "#666",
                      borderRadius: 8, padding: "2px 8px", letterSpacing: "0.06em",
                    }}>{isLive ? "LIVE" : "CLOSED"}</span>
                  )}
                  {onToggleSave && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleSave(a.url); }}
                      aria-label="Remove this auction from saved"
                      title="Saved · tap to remove"
                      style={{
                        position: "absolute", top: 8, right: 8,
                        width: 30, height: 30, borderRadius: "50%",
                        border: "none", padding: 0, cursor: "pointer",
                        background: "rgba(217,38,38,0.92)", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        backdropFilter: "blur(6px)",
                      }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff" stroke="#fff"
                        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                    </button>
                  )}
                </div>
                <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                    {a.house}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", lineHeight: 1.3,
                                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {a.title}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text2)" }}>
                    {dateLabel}{a._lotCount ? `${dateLabel ? " · " : ""}${a._lotCount.toLocaleString()} lots` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
