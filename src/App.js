import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAuth, useWatchlist, useHidden, useAdminHidden, useSearches, useTrackedLots, useCollections, useUserSettings, importLocalData, isAuthConfigured } from "./supabase";
import { useEventTelemetry } from "./hooks/useEventTelemetry";
import { useUserLimit } from "./hooks/useUserLimit";
import { UserLimitBanner } from "./components/UserLimitBanner";
import {
  GLOBAL_MAX,
  daysAgo, freshDate,
  ageBucketFromDate, canonicalizeBrand, detectAuctionLotBrand,
  shortHash,
  matchesSearch,
  FORCE_OTHER_BRANDS, SUPPRESS_AT_SOLD_BRANDS,
  buildFeedbackMailto, captureFeedbackContext,
} from "./utils";
import { useWidth, useSystemDark } from "./hooks";
import { useTrackModal } from "./hooks/useTrackModal";
import { useFavSearchModal } from "./hooks/useFavSearchModal";
import { useViewSettings } from "./hooks/useViewSettings";
import { useFilters } from "./hooks/useFilters";
import { Card } from "./components/Card";
// AuctionsTab retired 2026-04-30 — Tracked lots merged into Watchlist
// Listings; calendar moved to Watchlist > Auction Calendar sub-tab via
// the new AuctionCalendar component (AuctionsTab.js deleted 2026-04-30).
import { ReferencesTab } from "./components/ReferencesTab";
import { CollectionsTab } from "./components/CollectionsTab";
import { TrackNewItemModal } from "./components/TrackNewItemModal";
import { FavSearchModal } from "./components/FavSearchModal";
import { AddSearchModal } from "./components/AddSearchModal";
import { CollectionEditModal } from "./components/CollectionEditModal";
import { CollectionPickerModal } from "./components/CollectionPickerModal";
import { SettingsModal } from "./components/SettingsModal";
import { ShareReceiver } from "./components/ShareReceiver";
import { ChallengeReceiver } from "./components/ChallengeReceiver";
import { ListReceiver } from "./components/ListReceiver";
import { AuctionCalendar } from "./components/AuctionCalendar";
import { LotMigrationBanner } from "./components/LotMigrationBanner";
import { WatchlistTab } from "./components/WatchlistTab";
import { AdminTab } from "./components/AdminTab";
import { MobileShell } from "./components/MobileShell";
import { DesktopShell } from "./components/DesktopShell";
import { tabPill, innerToggleButton } from "./styles";

const LISTINGS_URL = "https://raw.githubusercontent.com/markatmutter-cloud/watchlist/main/public/listings.json";
const AUCTIONS_URL = "https://raw.githubusercontent.com/markatmutter-cloud/watchlist/main/public/auctions.json";
const TRACKED_LOTS_URL = "https://raw.githubusercontent.com/markatmutter-cloud/watchlist/main/public/tracked_lots.json";
// Comprehensive auction-lot scrape — populated by auction_lots_scraper.py
// (Antiquorum + Christie's + Sotheby's + Phillips). Same shape as
// tracked_lots.json (URL-keyed lot detail dicts) so the App.js
// projection treats them identically.
const AUCTION_LOTS_URL = "https://raw.githubusercontent.com/markatmutter-cloud/watchlist/main/public/auction_lots.json";
// Manually-captured historical-auction lots (Phase D, 2026-05-05).
// Static, immutable: the manual_archive_scraper writes this once per
// added sale and the result never changes (archive sales don't update
// post-hoc). Loaded alongside auction_lots.json and merged by URL key.
const MANUAL_ARCHIVE_LOTS_URL = "https://raw.githubusercontent.com/markatmutter-cloud/watchlist/main/public/manual_archive_lots.json";
const PAGE_SIZE = 48;
// Legacy localStorage keys — kept only for the one-shot import on first
// sign-in (see importLocalData + the banner in the Watchlist tab). Active
// reads/writes now go through Supabase via the hooks in ./supabase.js.
const LEGACY_WATCHLIST_KEY = "dial_watchlist_v2";
const LEGACY_HIDDEN_KEY    = "dial_hidden_v1";

// "Ending soonest" comparator. Tiers items so urgency wins over raw
// date order:
//   tier 0 — currently live (auction_start <= now < auction_end)
//   tier 1 — upcoming auction (auction_end > now), sorted by end asc
//   tier 2 — ended auction (auction_end <= now), sorted by end desc
//             (most-recently-ended first, since they're past)
//   tier 3 — non-auction items (no auction_end)
// Used by both the Watchlist watchItems sort and the Available
// allFiltered sort so a saved "Ending soonest" preference applies
// everywhere the sort selector reaches.
function endingSoonComparator(a, b) {
  const now = Date.now();
  const tier = (it) => {
    const end = it.auction_end ? new Date(it.auction_end).getTime() : NaN;
    if (Number.isNaN(end)) return 3;
    if (end <= now) return 2;
    if (it.auction_start) {
      const start = new Date(it.auction_start).getTime();
      if (!Number.isNaN(start) && start <= now) return 0;
    }
    return 1;
  };
  const ta = tier(a), tb = tier(b);
  if (ta !== tb) return ta - tb;
  // Within tier: live + upcoming sort soonest-end first; ended sorts
  // most-recent-end first; non-auction is unordered (stable).
  if (ta === 3) return 0;
  const ae = a.auction_end || "";
  const be = b.auction_end || "";
  const dateCmp = ta === 2 ? be.localeCompare(ae) : ae.localeCompare(be);
  if (dateCmp !== 0) return dateCmp;
  // Mark feedback 2026-05-07: within the same auction (same
  // auction_end), order by lot_number ascending so the feed reads
  // as catalog order — i.e. how the user would see the lots on the
  // auction house's own site. Christie's May 9 lots stay grouped
  // together AND in catalog order, then Phillips May 11, etc.
  // Falls back to stable when both lot_numbers are missing.
  const la = parseInt(a.lot_number || "0", 10) || 0;
  const lb = parseInt(b.lot_number || "0", 10) || 0;
  if (la !== lb) return la - lb;
  return 0;
}

export default function Watchlist() {
  const screenWidth = useWidth();
  const sysDark = useSystemDark();
  const isMobile = screenWidth < 640;
  // Per-device display chrome (theme override, column counts, view-menu
  // open flag). Lives in useViewSettings so localStorage persistence +
  // option validation stay co-located with the state itself.
  const {
    darkOverride, setDarkOverride,
    mobileCols, setMobileCols,
    desktopCols, setDesktopCols,
  } = useViewSettings();
  // Auth. `user` is null when signed out; non-null with `.email` etc. when
  // signed in via Google. `ready` gates UI from flickering "Sign in" for a
  // returning user while we check the session. `showUserMenu` toggles the
  // small dropdown over the user badge.
  const { user, ready: authReady, signInWithGoogle, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const dark = darkOverride !== null ? darkOverride : sysDark;

  // (Desktop sidebar + drag-resize machinery retired with the
  // April '26 filter consolidation — useState pairs, refs, and
  // onDragStart handler all removed alongside sidebarFilterPanelJSX.)
  // All filter-row state lives in useFilters — search/sources/brands/
  // refs/auctions-only/sort/price/status/expansion-toggles/popover.
  // Destructured into the existing names so the rest of App.js doesn't
  // need to know the state moved.
  const {
    filterSources, setFilterSources,
    filterBrands,  setFilterBrands,
    filterRefs,    setFilterRefs,
    toggleSource, toggleBrand,
    sort, setSort,
    search, setSearch,
    minPriceText, setMinPriceText,
    maxPriceText, setMaxPriceText,
    minPrice, maxPrice,
    newDays, setNewDays,
    statusMode, setStatusMode,
    brandsExpanded,  setBrandsExpanded,
    sourcesExpanded, setSourcesExpanded,
    refsExpanded,    setRefsExpanded,
    activeFilterPop, setActiveFilterPop,
    filterPopRef,
    filterHearted, setFilterHearted,
    hasFilters, resetFilters,
  } = useFilters();
  // Desktop column count: user override wins; otherwise the fluid default
  // based on viewport width with a sensible minimum.
  const desktopAutoCols = Math.max(3, Math.round(screenWidth / 240));
  const cols = isMobile
    ? mobileCols
    : (desktopCols === "auto" ? desktopAutoCols : desktopCols);
  const compact = cols >= 4;

  const [items, setItems] = useState([]);
  const [auctions, setAuctions] = useState([]);
  // Scraped state for tracked auction lots, keyed by URL. The user's own
  // tracked URLs come from Supabase (useTrackedLots); we join those URLs
  // against this object to render lot cards. The comprehensive scrape
  // (auctionLotsState below) shares the same shape; we merge the two
  // by URL when projecting into the feed so a URL appearing in both
  // surfaces (e.g. a user-tracked Antiquorum lot that's also in the
  // auction_lots.json sweep) renders once.
  const [trackedLotsState, setTrackedLotsState] = useState({});
  // Comprehensive auction-lot scrape (Antiquorum + Christie's +
  // Sotheby's + Phillips). Populated by auction_lots_scraper.py on
  // a daily cron. Public — every visitor sees the same set; user-
  // hearting is layered on top via watchlist_items.
  const [auctionLotsState, setAuctionLotsState] = useState({});
  const [manualArchiveLotsState, setManualArchiveLotsState] = useState({});
  // Sub-tab inside Watchlist > Auction lots: upcoming vs past.
  // Sub-tab on the Watchlist tab. Three values: "listings" (dealer
  // items you've hearted) or "searches" (saved searches editor). The
  // "lots" sub-tab moved to the Auctions tab — keep its localStorage
  // value valid by mapping any old "lots" preference back to "listings".
  // Lives here (not inside WatchlistTab) because the surrounding chrome
  // — sidebar, filter bar, mobile drawer — gates on it too. Persisted
  // across visits.
  // Watchlist sub-tab. URL takes precedence over localStorage so a
  // refresh on `?tab=watchlist&sub=collections` lands you back where
  // you were. Otherwise fall back to the persisted preference; final
  // fallback is "listings" (Favorites).
  // Watchlist sub-tab values. Restructured 2026-05-04 to mirror
  // Listings: separate sub-tabs for live saved listings, live saved
  // auctions, and saved-that-sold. "challenges" moved to the
  // References tab on 2026-05-04; "collections" (Lists) moved to a
  // top-level Collections tab on 2026-05-06. "calendar" already
  // retired earlier on 2026-05-04. Stale localStorage / URL values
  // silently map to "listings" so bookmarked / persisted preferences
  // don't land on a missing sub-tab.
  // SUB_VALUES split into two style groups by which Tab component
  // owns the render. Bundle 2A.2 (2026-05-07) collapsed the standalone
  // top-level Collections tab into Saved (was Watchlist) — what used
  // to be `?tab=collections&sub=X` is now `?tab=watchlist&sub=X` with
  // the same sub-tab key. The render dispatch downstream (in shellProps)
  // picks WatchlistTab for the watchlist-style subs and CollectionsTab
  // for the collections-style subs.
  const SUB_VALUES_WATCHLIST = ["listings", "auctions", "sold", "searches"];
  const SUB_VALUES_COLLECTIONS = ["my-collection", "wishlist", "lists", "challenges"];
  const SUB_VALUES = [...SUB_VALUES_WATCHLIST, ...SUB_VALUES_COLLECTIONS];
  // Bundle 2A.2b (2026-05-08) — the three hearted sub-tabs
  // (listings/auctions/sold) collapse under a single "Saved" pill in
  // the strip, with an internal Listings/Auctions/Sold toggle below.
  // Sub-tab values themselves stay unchanged — backward compat for
  // existing share URLs + localStorage prefs.
  const SAVED_HEARTED_SUBS = ["listings", "auctions", "sold"];
  const [watchTopTab, setWatchTopTab] = useState(() => {
    const normalize = (v) => (v === "calendar") ? "listings" : v;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab");
      const sub = normalize(params.get("sub"));
      // Honour ?sub on tab=watchlist (default) AND tab=collections
      // (legacy URL — Bundle 2A.2 redirect target).
      if (t === "watchlist" || t === "collections" || !t) {
        if (SUB_VALUES.includes(sub)) return sub;
      }
    }
    try {
      // Prefer the unified `dial_watch_top_tab` key; only fall back to
      // the legacy `dial_collections_sub_tab` if the unified key is
      // missing (true first-time-after-collapse migration). Without
      // this preference order, a user who navigates from Lists →
      // Saved listings within a session and refreshes would get
      // bounced back to Lists by the legacy read.
      const v = normalize(localStorage.getItem("dial_watch_top_tab"));
      // 2026-05-08 IA pass: hearted sub-tabs (listings/auctions/sold)
      // are no longer pills in the strip. A user whose localStorage
      // still holds one would land on a hidden surface with no
      // navigation back. Coerce stale localStorage of those values
      // to the new default "lists". URL params still win — old
      // shared `?sub=listings` links still render the hearted grid
      // for back-compat.
      if (SUB_VALUES.includes(v) && !["listings", "auctions", "sold"].includes(v)) return v;
      const collectionsLegacy = normalize(localStorage.getItem("dial_collections_sub_tab"));
      if (SUB_VALUES_COLLECTIONS.includes(collectionsLegacy)) return collectionsLegacy;
      // Default landing changed 2026-05-08: "lists" is the first
      // pill in the new Watchlists strip.
      return "lists";
    } catch { return "lists"; }
  });
  useEffect(() => {
    try { localStorage.setItem("dial_watch_top_tab", watchTopTab); } catch {}
    // Reset scroll on sub-tab change so switching from a long Listings
    // grid to the shorter Searches list doesn't leave the user mid-page.
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
    const desktopMain = document.querySelector("[data-desktop-main]");
    if (desktopMain) desktopMain.scrollTop = 0;
  }, [watchTopTab]);

  // Track which hearted sub the user was last on (Bundle 2A.2b). When
  // they tap the unified "Saved" pill from another sub-tab, restore
  // the last hearted view rather than always defaulting to
  // Listings. Stored as a ref since we don't need re-renders on
  // change.
  const lastHeartedSubRef = useRef(
    SAVED_HEARTED_SUBS.includes(watchTopTab) ? watchTopTab : "listings"
  );
  useEffect(() => {
    if (SAVED_HEARTED_SUBS.includes(watchTopTab)) {
      lastHeartedSubRef.current = watchTopTab;
    }
    // eslint-disable-next-line
  }, [watchTopTab]);

  // (Saved-view staleness snapshot moved to AFTER `tab` is declared
  // — referencing `tab` from a useEffect deps array up here triggered
  // a TDZ "Cannot access before initialization" crash on first render
  // because const declarations execute top-to-bottom and `tab` was
  // declared further down. Lesson for future-me: when adding a new
  // useEffect that references existing state, place it AFTER all the
  // states it touches.)

  // Listings tab sub-tabs (2026-05-04 restructure). Four values:
  //   "live"     — currently-active dealer listings (default)
  //   "auctions" — currently-active auction lots
  //   "sold"     — sold dealer items + sold auction lots
  //   "calendar" — month-banded list of upcoming auction-house sales
  // URL sync uses the same `?sub=` param the Watchlist tab uses, but
  // the valid values depend on the active main tab. Persisted under
  // its own localStorage key so switching between Listings and
  // Watchlist doesn't reset the user's sub-tab choice on either side.
  const LISTINGS_SUB_VALUES = ["live", "auctions", "sold", "calendar"];
  const [listingsSubTab, setListingsSubTab] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab");
      const sub = params.get("sub");
      // Only honour the URL sub on a listings deep link.
      if ((t === "listings" || !t) && LISTINGS_SUB_VALUES.includes(sub)) {
        return sub;
      }
    }
    try {
      const v = localStorage.getItem("dial_listings_sub_tab");
      return LISTINGS_SUB_VALUES.includes(v) ? v : "live";
    } catch { return "live"; }
  });
  useEffect(() => {
    try { localStorage.setItem("dial_listings_sub_tab", listingsSubTab); } catch {}
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
    const desktopMain = document.querySelector("[data-desktop-main]");
    if (desktopMain) desktopMain.scrollTop = 0;
  }, [listingsSubTab]);
  // Bundle 2A.2 (2026-05-07) — the standalone `collectionsSubTab`
  // state was dropped. Its sub-tab values (my-collection / wishlist /
  // lists / challenges) are now part of `watchTopTab` (see SUB_VALUES
  // above). When `watchTopTab` is one of those values the render
  // dispatch in shellProps shows CollectionsTab content; otherwise
  // it shows WatchlistTab content. CollectionsTab still expects
  // its own `collectionsSubTab` / `setCollectionsSubTab` props —
  // App.js threads `watchTopTab` / `setWatchTopTab` through under
  // those names so the component stays unchanged.
  // localStorage `dial_collections_sub_tab` reads still work as a
  // legacy read in the watchTopTab init above; writes now go to
  // `dial_watch_top_tab`.
  const COLLECTIONS_SUB_VALUES = SUB_VALUES_COLLECTIONS;
  const collectionsSubTab = watchTopTab;
  const setCollectionsSubTab = setWatchTopTab;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Main tab. Same URL-first init as watchTopTab — refresh on
  // `?tab=watchlist` lands on Watchlist, etc. The "admin" value is
  // only reachable for users whose email is in REACT_APP_ADMIN_EMAILS;
  // a non-admin hitting `?tab=admin` silently falls back to listings
  // (the admin gate fires below in a useEffect once user resolves —
  // doing it here would break for users who haven't auth-loaded yet).
  // Bundle 2A.2 (2026-05-07) collapsed the standalone `collections`
  // top-level tab into Saved (internal `watchlist`). Old URLs using
  // `?tab=collections` redirect to `?tab=watchlist` with the same
  // sub-tab key (the sub-tab values were already preserved when
  // SUB_VALUES_COLLECTIONS was folded into watchTopTab above).
  const TAB_VALUES = ["listings", "watchlist", "references", "admin"];
  // URL-key translation. Naming alignment 2026-05-08 (Mark feedback:
  // "?sub=sold&tab=watchlist" reads as ugly internal state in the
  // address bar). The URL now uses `saved` / `learn` as the
  // canonical externally-visible keys; internals keep `watchlist` /
  // `references` per the documented divergence (renaming the state
  // var + 80+ call sites was the bigger refactor we explicitly chose
  // not to take). URL parse accepts BOTH old + new; URL write below
  // emits the new keys so address bars + share links read cleanly.
  const URL_TAB_TO_INTERNAL = { saved: "watchlist", learn: "references", collections: "watchlist" };
  const INTERNAL_TAB_TO_URL = { watchlist: "saved", references: "learn" };
  const [tab, setTab] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab");
      // External → internal redirect: ?tab=saved / ?tab=learn /
      // ?tab=collections (legacy) all map to internal values.
      if (URL_TAB_TO_INTERNAL[t]) return URL_TAB_TO_INTERNAL[t];
      if (TAB_VALUES.includes(t)) return t;
    }
    return "listings";
  });

  // Saved-view staleness snapshot. Mark feedback 2026-05-07: when a
  // user un-hearts a card by accident on Saved listings/auctions/sold,
  // the card vanishes immediately — no recovery without reloading.
  // Fix: snapshot the watchlist contents whenever the user enters or
  // switches between saved sub-tabs, then merge the snapshot with
  // the live watchlist so un-hearted items stay visible until the
  // next sub-tab change / refresh. Currently-hearted items always
  // render off the live watchlist (so price / lastSeen updates flow
  // through); only un-hearted items lean on the snapshot.
  //
  // Placement note: this useEffect references `tab` (declared just
  // above). The earlier placement above the `tab` useState crashed
  // with a TDZ "Cannot access before initialization" — const
  // bindings execute top-to-bottom and the deps array is constructed
  // synchronously when useEffect is called.
  const [savedItemsSnapshot, setSavedItemsSnapshot] = useState({});
  useEffect(() => {
    const onSavedView = tab === "watchlist" &&
      (watchTopTab === "listings" || watchTopTab === "auctions" || watchTopTab === "sold");
    if (onSavedView) {
      // Intentionally NOT depending on watchlist — the whole point is
      // for the snapshot to lag updates so un-hearts stay visible.
      setSavedItemsSnapshot({ ...watchlist });
    } else if (Object.keys(savedItemsSnapshot).length > 0) {
      // Clear when leaving so re-entry rebuilds fresh.
      setSavedItemsSnapshot({});
    }
    // eslint-disable-next-line
  }, [tab, watchTopTab]);

  // URL sync — reflect tab + sub-tab in the query string so refresh
  // preserves location and direct links work. Skipped when share-
  // receive params (`shared=1`) are present so the share flow
  // controls the URL until it acts. Uses replaceState so browser
  // history isn't polluted on every tab click.
  //
  // PR #95 (2026-05-06): browser-back parity. Real navigations
  // (tab change, sub-tab change) now use pushState so the back
  // button walks the user backwards through Watchlist instead of
  // exiting the site. Initial mount + URL normalization (e.g.
  // stripping `col` when leaving Collections) stays on
  // replaceState. The popstate listener below mirrors browser
  // back/forward into state.
  const isFirstNavSync = useRef(true);
  const prevNavRef = useRef({ tab, watchTopTab, listingsSubTab, collectionsSubTab });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("shared") === "1") return;
    // Naming alignment 2026-05-08: emit external URL keys (saved /
    // learn) for the watchlist / references internal values. Listings
    // is the default and stays stripped from the URL.
    if (tab === "listings") params.delete("tab");
    else params.set("tab", INTERNAL_TAB_TO_URL[tab] || tab);
    if (tab === "listings" && listingsSubTab !== "live") {
      params.set("sub", listingsSubTab);
    } else if (tab === "watchlist" && watchTopTab !== "lists") {
      params.set("sub", watchTopTab);
    } else {
      params.delete("sub");
    }
    // `col` is the drill-in id for the Lists sub-tab inside Saved.
    // CollectionsTab itself owns the push when the user drills in;
    // App.js strips it whenever the active sub-tab isn't a
    // collections-style sub.
    if (tab !== "watchlist" || !SUB_VALUES_COLLECTIONS.includes(watchTopTab)) {
      params.delete("col");
    }
    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
    if (newUrl === currentUrl) {
      // No-op write — usually means popstate already moved us to
      // this URL and state is just catching up. Skip the history
      // mutation entirely (a no-op pushState would still create
      // a phantom history entry).
      prevNavRef.current = { tab, watchTopTab, listingsSubTab, collectionsSubTab };
      return;
    }
    const prev = prevNavRef.current;
    const navChanged =
      prev.tab !== tab ||
      // collectionsSubTab is now an alias for watchTopTab — the
    // explicit comparison stays for clarity but is redundant.
      prev.watchTopTab !== watchTopTab ||
      prev.listingsSubTab !== listingsSubTab;
    if (isFirstNavSync.current || !navChanged) {
      window.history.replaceState({}, "", newUrl);
    } else {
      window.history.pushState({}, "", newUrl);
    }
    isFirstNavSync.current = false;
    prevNavRef.current = { tab, watchTopTab, listingsSubTab, collectionsSubTab };
  }, [tab, watchTopTab, listingsSubTab, collectionsSubTab]);

  // popstate listener: when the user hits browser back / forward,
  // re-derive tab + sub-tab + listingsSubTab state from the
  // restored URL. The URL-sync effect above sees the URL already
  // matches and skips the history mutation, so this doesn't loop.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      // Skip while a share-receive surface is taking over the URL.
      if (params.get("shared") === "1") return;
      const tParam = params.get("tab");
      const sub = params.get("sub");
      // Compute the target tab. Bundle 2A.2 (2026-05-07): old
      // `?tab=collections` URLs collapse onto `?tab=watchlist` with
      // the sub-tab key preserved.
      let nextTab = "listings";
      // Same external→internal translation as the init useState.
      if (URL_TAB_TO_INTERNAL[tParam]) {
        nextTab = URL_TAB_TO_INTERNAL[tParam];
      } else if (TAB_VALUES.includes(tParam)) {
        nextTab = tParam;
      }
      setTab(nextTab);
      // Sub-tab routing depends on which main tab is active.
      if (nextTab === "listings") {
        setListingsSubTab(LISTINGS_SUB_VALUES.includes(sub) ? sub : "live");
      } else if (nextTab === "watchlist") {
        const norm = (v) => (v === "calendar") ? "listings" : v;
        const w = norm(sub);
        setWatchTopTab(SUB_VALUES.includes(w) ? w : "lists");
      }
      // Lists drill-in (`?col=…`) is owned by CollectionsTab —
      // it has its own popstate handler / URL-derived effect.
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // TAB_VALUES / SUB_VALUES / LISTINGS_SUB_VALUES are module-level
    // const arrays so they're stable references across renders.
    // eslint-disable-next-line
  }, []);
  const [page, setPage] = useState(1);
  // (filterSources, filterBrands, filterRefs, filterAuctionsOnly, sort,
  // search, minPriceText, maxPriceText, newDays, statusMode all moved
  // to useFilters at the top of this component.)
  // Global Group-by control. Replaces age-bucket dividers in the
  // Available/Archive feed AND drives the Watchlist > Listings sub-tab.
  // Persisted under `dial_group_v1`; falls back to the legacy
  // `watchlist_group_v1` key for users who set it before this lift.
  // (Group-by feature removed entirely 2026-04-30 per Mark — too
  // many overlapping axes against sort + status + filter pills.
  // Date dividers when sorted by date stay as an implicit
  // side-effect of the date sort. Brand / Source / Ref grouping
  // could come back later if there's a use case but isn't in
  // current scope. localStorage key dial_group_v1 is left untouched
  // for any users who might roll back.)

  // Hidden listings surface as a synthetic "Hidden" row inside
  // Collections > Lists (PR #99 moved the surface from Watchlist >
  // Collections to its current home). Drill-in lives in
  // CollectionsTab.js / WatchlistTab.js depending on access path —
  // App.js just owns the data via useWatchlist's hiddenItems +
  // toggleHide.
  // AboutModal doubles as the welcome surface (first-visit auto-open
  // gated by `dial_visited_v1` localStorage flag) and the always-on
  // About surface (header link + Settings entry). Same content, two
  // access paths. (2026-05-07)
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  // Sign-in prompt modal — 2-step explainer fired by the top-bar
  // "Sign in" button. Receivers (ShareReceiver / ChallengeReceiver /
  // signed-out feature prompts) keep firing signInWithGoogle directly;
  // they already carry their own context. (2026-05-07)
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);
  // First-visit auto-show of the welcome (AboutModal). Defer one tick
  // past mount so we don't fire during loading early-return. Hook lives
  // here near the other top-of-list state — well before App.js's
  // loading + loadError early returns; adding hooks past those triggers
  // React #310 (see Things-to-never-do in CLAUDE.md).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!window.localStorage.getItem("dial_visited_v1")) {
        // Slight delay so the welcome doesn't flash on top of the
        // listings loading state.
        const t = setTimeout(() => {
          setAboutModalOpen(true);
          window.localStorage.setItem("dial_visited_v1", "1");
        }, 400);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);
  // Watchlist + hidden now live server-side (Supabase) per authenticated
  // user. When signed out, these hooks return empty objects and their
  // toggles no-op — we wrap the toggles below to kick off sign-in instead.
  const { items: watchlist, toggle: toggleWatchlist } = useWatchlist(user);
  const { items: hidden,   toggle: toggleHidden    } = useHidden(user);
  // Global admin blocklist (Mark 2026-05-06). Loaded for every
  // visitor — anonymous + signed-in — so the live feed filters
  // out items Mark has hidden as taste-maker. toggle is admin-only
  // (RLS-gated) and gets called from the toggleHide wrapper below
  // when the current user is admin.
  const { ids: adminHidden, toggle: toggleAdminHidden } = useAdminHidden();
  // Admin gate, hoisted above toggleHide so the wrapper can decide
  // whether to propagate a per-user hide into the global blocklist.
  // Comma-separated emails in REACT_APP_ADMIN_EMAILS (Vercel + .env);
  // empty default = nobody is admin.
  const ADMIN_EMAILS = (process.env.REACT_APP_ADMIN_EMAILS || "")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
  // Demand-side telemetry — view / click / save / hide / list_add /
  // share. Anonymous-friendly (UUID in localStorage); admin-only RLS
  // for reads. See supabase/schema/2026-05-05_listing_events.sql.
  const { recordEvent, observeCard } = useEventTelemetry(user);
  const onClickListing = useCallback((item) => recordEvent("click", item), [recordEvent]);
  // User limit (Epic 3 — defensive engineering). Reads the per-user
  // override from public.user_limits (default 2500). The DB also
  // enforces the cap via a BEFORE INSERT trigger on watchlist_items;
  // this hook is purely UX. See supabase/schema/2026-05-06_user_limits.sql.
  const userLimit = useUserLimit(user, Object.keys(watchlist).length);
  // Share-receive surface state (Epic 4). When ShareReceiver detects
  // ?listing=&shared=1 on mount it flips this to true so the shell
  // hides the regular feed and lets the focused landing surface take
  // over the content area. ShareReceiver itself owns the share-intent
  // hooks — this is just a one-bit mirror so the shell can branch.
  // Hook lives at the TOP of App.js's hook list (before any early
  // returns) per CLAUDE.md "don't add hooks deep" guidance.
  const [shareActive, setShareActive] = useState(false);
  // Same one-bit mirror for Watch Challenges receive flow (v1.5).
  // Either of these flips the shell into "focused landing surface"
  // mode (regular browse chrome hidden).
  const [challengeShareActive, setChallengeShareActive] = useState(false);
  // List-share receive flow (List Sharing v1, 2026-05-07). Same
  // pattern — one-bit mirror; the ListReceiver component owns its
  // own intent state.
  const [listShareActive, setListShareActive] = useState(false);
  // One-bit mirror of CollectionsTab's drill-in state. CollectionsTab
  // still owns selectedListId / URL push; this just exposes "are we
  // drilled into a list?" up to App.js so the shell can render the
  // filter row when drilled in (mirroring the Listings tab). The
  // setter is threaded down to CollectionsTab via shellProps below.
  // (2026-05-09 IA pass.)
  const [colDrillInId, setColDrillInId] = useState(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("col") || null;
  });
  // Bumps each time the user explicitly navigates away from a
  // share-receive surface via main-nav (Watchlist logo, top tabs).
  // Receivers watch this and clear their internal intent state,
  // since they otherwise hold onto it across `setShareActive(false)`
  // calls. Mark D5 (2026-05-06): "I can't click on watchlist logo
  // to get back to homepage … feels like I'm stuck or trapped."
  const [shareReceiveResetTick, setShareReceiveResetTick] = useState(0);
  // After "Take this challenge" the receiver creates a new
  // challenge for the recipient and we want to drop them into it,
  // not leave them on the Collections list. ChallengeReceiver sets
  // this; CollectionsTab forwards it to ChallengesView, which reads
  // it on mount and drills in.
  const [pendingChallengeDrillId, setPendingChallengeDrillId] = useState(null);

  // Two-phase sign-in: every "Sign in" CTA in the app fires the
  // SignInPromptModal first (the explainer + Google button). Mark
  // feedback 2026-05-07: receivers + signed-out feature prompts were
  // bypassing the prompt and going straight to OAuth — that's
  // jarring on first visit. The wrapper below opens the modal; the
  // modal's primary button is wired to the real `signInWithGoogle`
  // (passed through shellProps unchanged so the modal still has a
  // working OAuth path).
  const triggerSignInPrompt = () => setSignInPromptOpen(true);

  // Tab re-tap → return to landing. Mark feedback 2026-05-07: when
  // the user is in a sub-view (e.g. Learn > SizeCompare, Saved >
  // Lists drilled into a list) and taps the active tab pill again,
  // they expect to return to the tab's landing. Each tab component
  // (ReferencesTab, CollectionsTab) watches this counter and resets
  // its internal drill-in state when bumped.
  const [tabResetTick, setTabResetTick] = useState(0);

  // setTab wrapper that auto-escapes any active share-receive
  // surface — clears URL share params, drops both shareActive
  // flags, bumps the resetTick so receivers clear their internal
  // intent state. Top-level nav (Watchlist logo + main tab buttons
  // in both shells) uses this; deep-internal callers (e.g. the
  // sign-in flow's tab switch) keep using the raw setTab.
  //
  // Bundle 2A.2 polish (2026-05-07): same-tab click bumps
  // `tabResetTick` so child tab components can reset their
  // drill-in state to the landing.
  //
  // Defined as a plain function (not useCallback) — App.js has
  // loading/loadError early returns past line ~1330 and adding
  // hooks past those triggers React #310 (CLAUDE.md "Things to
  // never do"). Identity churn each render is fine.
  const setTabWithReceiveEscape = (newTab) => {
    try {
      const url = new URL(window.location.href);
      ["listing", "shared", "newchallenge", "challenge", "t", "n", "b", "d", "list"]
        .forEach((k) => url.searchParams.delete(k));
      window.history.replaceState({}, "", url.toString());
    } catch {}
    setShareActive(false);
    setChallengeShareActive(false);
    setListShareActive(false);
    setShareReceiveResetTick((n) => n + 1);
    if (newTab === tab) {
      // Already on this tab — bump the reset counter so child
      // components can return to their landing without changing tab.
      setTabResetTick((n) => n + 1);
      return;
    }
    setTab(newTab);
  };

  // Saved searches are per-user (stored in Supabase). Signed-out visitors
  // get an empty list, and the whole Searches subsection is hidden inside
  // the Watchlist tab.
  const {
    items: userSearches,
    editor: searchEditor,
    setEditor: setSearchEditor,
    startAdd: startAddSearch,
    startEdit: startEditSearch,
    cancel: cancelSearchEdit,
    commit: commitSearch,
    remove: removeSearch,
    quickAdd: quickAddSearch,
  } = useSearches(user);
  // "Save current search as a favorite" prompt — opened by the heart
  // button inside the search input. The state machine lives in
  // useFavSearchModal; aliases below keep the rest of App.js's
  // references stable.
  const {
    open: favPromptOpen,    setOpen:    setFavPromptOpen,
    label: favPromptLabel,  setLabel:   setFavPromptLabel,
    error: favPromptError,  setError:   setFavPromptError,
    openPrompt:             openFavPrompt,
    submit:                 submitFavSearch,
  } = useFavSearchModal({ search, minPriceText, maxPriceText, quickAddSearch });
  // Whether the current search is already a saved favourite.
  // 2026-05-08 — same dedup signature as quickAdd: query + minPrice +
  // maxPrice. So a saved "Speedmaster pro $0–$5k" doesn't make the
  // heart show as already-saved when the user has a different price
  // band entered.
  const currentIsSaved = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return false;
    const cur = (s) => Number.isFinite(Number(s)) && s !== "" ? Number(s) : null;
    const curMin = cur(minPriceText);
    const curMax = cur(maxPriceText);
    return userSearches.some(s =>
      (s.query || "").toLowerCase() === q &&
      (s.minPrice ?? null) === curMin &&
      (s.maxPrice ?? null) === curMax
    );
  }, [search, minPriceText, maxPriceText, userSearches]);
  const { urls: trackedLotUrls, add: addTrackedLot, remove: removeTrackedLot, addedAt: trackedLotAddedAt } = useTrackedLots(user);

  // Collections — user-created beyond the default Watchlist (which is
  // still backed by useWatchlist above). Approach A: this hook only
  // manages additional collections + the auto Shared-with-me inbox.
  // The full API is passed through to WatchlistTab for the Collections
  // sub-tab UI; the picker modal (lifted to App.js below) reuses it
  // when adding a listing from any Card anywhere.
  const collectionsApi = useCollections(user);

  // User-level settings — currently just primary display currency.
  // Cross-device (Supabase user_settings table) vs theme/columns
  // which are per-device localStorage. Default 'USD' until the user
  // changes it. Plumbs through shellProps → Card so every card
  // surface honours the preference.
  const { primaryCurrency, setPrimaryCurrency } = useUserSettings(user);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Outbound share handler. Pure function (no useState/useMemo
  // closures), so it doesn't add a hook to App.js's count. The
  // RECEIVE side lives entirely inside <ShareReceiver/> so its
  // hooks isolate cleanly — that was the v3 architectural choice
  // after v2's React error #310 in production.
  // Returns { copied } so Card can flash "Copied!" on the
  // clipboard fallback path.
  const handleShare = async (input) => {
    // Two call shapes:
    //   - Listing card share: pass the listing item — URL built
    //     server-side as /share/<id> so preview-bots get per-listing
    //     OG tags (api/share.js).
    //   - Pre-built share (challenges, future surfaces): pass
    //     `{ url, title? }` with the URL already constructed. This
    //     path skips the listing telemetry event since it's not a
    //     listing-share. Without this, ChallengeFlow's shareChallenge
    //     used to no-op silently because handleShare returned early
    //     on the missing-id branch (Mark 2026-05-06: "Share still
    //     doesn't work").
    let shareUrl;
    let shareTitle;
    // Branch order matters. Pre-fix the listing-share path was
    // never reached because the dual-shape branch checked
    // `input.url` first — and listings have a `url` field set to
    // the dealer/auction URL. Every Card share emitted the dealer
    // URL instead of /share/<id> (Mark's report 2026-05-07).
    // Check `input.id` FIRST: if the caller passed a listing item,
    // we always want the /share/<id> URL. Pre-built `{url, title}`
    // payloads from ChallengeFlow / future surfaces fall through.
    if (input && input.id) {
      recordEvent("share", input);
      try {
        const url = new URL(window.location.origin);
        url.pathname = `/share/${encodeURIComponent(input.id)}`;
        shareUrl = url.toString();
      } catch {
        return { copied: false };
      }
    } else if (input && typeof input.url === "string") {
      shareUrl = input.url;
      shareTitle = input.title;
    } else {
      return { copied: false };
    }
    // Mobile OS (iPhone / iPad / Android phone) gets the native
    // share sheet — routing to iMessage/WhatsApp/AirDrop is where
    // it shines. Everything else (macOS, Windows, Linux desktop +
    // their browsers) copies to clipboard regardless of whether
    // navigator.share is available.
    //
    // Detection: User Agent string. Yes, UA sniffing is fragile in
    // theory; in practice the iPhone/iPad/Android substring is
    // stable and gives the right answer. Pre-2026-05-01 attempts
    // with viewport-width, (pointer: coarse), and (any-hover: none)
    // all triggered false positives on macOS (each has its own
    // wrinkle: trackpad input, retina display reporting, accessibility
    // features). UA isn't perfect either but it's empirically the
    // most reliable signal we have without server-side sniffing.
    //
    // Share payload is URL-only. iMessage/WhatsApp render their own
    // rich-link preview from the page's OG tags.
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    const isMobileOS =
      /iPhone|iPod/.test(ua)
      || /Android/.test(ua)
      // iPad on iOS 13+ reports as Macintosh; the maxTouchPoints
      // check disambiguates: real Macs have 0 touch points, iPads
      // have 5+.
      || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
    if (isMobileOS && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareTitle ? { url: shareUrl, title: shareTitle } : { url: shareUrl });
        return { copied: false };
      } catch (e) {
        if (e?.name === "AbortError") return { copied: false };
        // Other errors fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      return { copied: true };
    } catch {
      try { window.prompt("Copy this link:", shareUrl); } catch {}
      return { copied: false };
    }
  };

  // Picker modal state — lifted here so any Card across the app (in
  // Listings, Watchlist > Listings, or a Collection drill-in) can open
  // the same picker. Holds the item being added; null = closed.
  const [pickerTarget, setPickerTarget] = useState(null);
  const openCollectionPicker = useCallback((item) => setPickerTarget(item), []);

  // Edit modal state — used for both Create new collection (id='new')
  // and Rename existing (id=<uuid>). Lifted here because the sub-tab
  // strip's "+ New collection" trigger lives in App.js while WatchlistTab
  // also fires Rename from a row's actions.
  const [editingCollection, setEditingCollection] = useState(null);
  const startCreateCollection = useCallback(() => {
    setEditingCollection({ id: "new", name: "" });
  }, []);

  // Track-new-item modal — state machine lives in useTrackModal;
  // aliases below preserve the previous trackOpen/trackUrl/etc.
  // naming so the JSX consts and the sub-tab trigger button below
  // don't need to change.
  const {
    open: trackOpen,   setOpen:  setTrackOpen,
    url: trackUrl,     setUrl:   setTrackUrl,
    busy: trackBusy,
    error: trackError, setError: setTrackError,
    submit:                      submitTrack,
  } = useTrackModal({ addTrackedLot });
  // If there's leftover localStorage data from the pre-Supabase era, we
  // offer to import it after sign-in. Read once at mount so we can tell
  // the user *how many* items we'd import ("N saved, M hidden").
  const [legacyLocal] = useState(() => {
    try {
      return {
        watchlist: JSON.parse(localStorage.getItem(LEGACY_WATCHLIST_KEY) || "{}"),
        hidden:    JSON.parse(localStorage.getItem(LEGACY_HIDDEN_KEY) || "{}"),
      };
    } catch { return { watchlist: {}, hidden: {} }; }
  });
  const [importState, setImportState] = useState(() => {
    const any = Object.keys(legacyLocal.watchlist).length + Object.keys(legacyLocal.hidden).length;
    return any ? "available" : "none";  // available → done (after success) → none
  });
  // (brandsExpanded / sourcesExpanded / refsExpanded moved to useFilters.)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const observerRef = useRef(null);
  const BRANDS_SHOW = 8;
  const SOURCES_SHOW = 8;

  // (Auto-sort effect retired 2026-05-04 — both Listings AND Watchlist
  // now use sub-tabs that own their own Date-pill semantics inside
  // allFiltered / watchItems memos. No state change needed when the
  // user switches sub-tabs; the dispatch reads sort + sub-tab.)

  useEffect(() => {
    // `cache: 'no-cache'` forces the browser/PWA to revalidate with the
    // origin on every load (sends If-None-Match, gets 304 if unchanged
    // — fast). Without it, iOS PWA + GitHub raw's 5-minute Cache-Control
    // could serve stale data for hours after a fresh scrape commit.
    const fetchOpts = { cache: "no-cache" };
    fetch(LISTINGS_URL, fetchOpts)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setItems(d); setLoading(false); })
      .catch(() => { setLoadError(true); setLoading(false); });
    // Auctions load in parallel. Failing silently is fine — the Auctions tab
    // just won't have data, which we handle with an empty-state message.
    fetch(AUCTIONS_URL, fetchOpts)
      .then(r => r.ok ? r.json() : [])
      .then(d => setAuctions(Array.isArray(d) ? d : []))
      .catch(() => {});
    // Tracked lots is keyed by URL. Failing silently is fine — empty
    // object means no tracked-lot cards render, which is correct when the
    // file doesn't exist yet (first deployment, or Supabase env vars not
    // set in the Action).
    fetch(TRACKED_LOTS_URL, fetchOpts)
      .then(r => r.ok ? r.json() : {})
      .then(d => setTrackedLotsState(d && typeof d === "object" ? d : {}))
      .catch(() => {});
    // Comprehensive auction-lot scrape — same shape as tracked_lots.json
    // but populated by a separate scraper that walks every active sale.
    // Failing silently is fine on first deployment (file doesn't exist
    // yet) — the feed just won't have these lots until the cron runs.
    fetch(AUCTION_LOTS_URL, fetchOpts)
      .then(r => r.ok ? r.json() : {})
      .then(d => setAuctionLotsState(d && typeof d === "object" ? d : {}))
      .catch(() => {});

    // Manual archive lots — Phase D historical-auction surface. Same
    // shape as auction_lots.json, merged into the same projection
    // below. Failing silently is fine if the file isn't deployed yet.
    fetch(MANUAL_ARCHIVE_LOTS_URL, fetchOpts)
      .then(r => r.ok ? r.json() : {})
      .then(d => setManualArchiveLotsState(d && typeof d === "object" ? d : {}))
      .catch(() => {});
  }, []);

  const c = dark ? {
    "--bg": "#000", "--surface": "#1c1c1e", "--card-bg": "#2c2c2e",
    "--border": "rgba(255,255,255,0.1)", "--text1": "#f5f5f7",
    "--text2": "#98989d", "--text3": "#48484a",
    "--brand": "#185FA5", "--danger": "#c0392b", "--accent-positive": "#1b8f3a",
  } : {
    "--bg": "#fff", "--surface": "#f5f5f7", "--card-bg": "#fff",
    "--border": "rgba(0,0,0,0.09)", "--text1": "#1d1d1f",
    "--text2": "#6e6e73", "--text3": "#aeaeb2",
    "--brand": "#185FA5", "--danger": "#c0392b", "--accent-positive": "#1b8f3a",
  };

  // Auction lots projected into the main listings feed. Two sources
  // get merged by URL key:
  //   1. tracked_lots.json — user-tracked URLs (eBay primarily,
  //      plus any individual auction-house URLs users explicitly
  //      track via the +Track flow).
  //   2. auction_lots.json — comprehensive scrape of every lot in
  //      every currently-active sale on Antiquorum / Christie's /
  //      Sotheby's / Phillips, refreshed daily.
  // When the same URL appears in both files, the COMPREHENSIVE entry
  // wins (it's likely fresher — daily scrape vs whenever-the-user-
  // pasted-it). Same shape either way so the projection treats them
  // identically.
  //
  // Phase A note (2026-05-04): hearts on these cards write to
  // watchlist_items via the existing handleWish path. The
  // `_isTrackedLot` flag is preserved so handleWish's guard still
  // fires and a heart click stays a no-op until Phase B unifies
  // tracked_lots with watchlist_items.
  const auctionLotItems = useMemo(() => {
    const arr = [];
    // Merge order matters when the same URL appears in multiple
    // sources: later spreads win. Manual archive lots get the lowest
    // priority (they're frozen captures — if the comprehensive scrape
    // ever picks the same URL up, prefer the fresher data) but in
    // practice they never collide because manual archives target
    // long-closed sales and the comprehensive scrape walks active ones.
    const merged = {
      ...(manualArchiveLotsState || {}),
      ...(trackedLotsState || {}),
      ...(auctionLotsState || {}),
    };
    for (const url of Object.keys(merged)) {
      const data = merged[url];
      if (!data) continue;
      const isEnded = data.status === "ended";
      const price = (isEnded ? data.sold_price : data.current_bid)
        || data.starting_price || data.estimate_low || 0;
      const priceUsd = (isEnded ? data.sold_price_usd : data.current_bid_usd)
        || data.starting_price_usd || data.estimate_low_usd || price;
      const isFixedPrice = data.buying_option === "BUY_IT_NOW"
                        || data.buying_option === "FIXED_PRICE";
      const isAuctionFormat = !isFixedPrice;
      arr.push({
        id: shortHash(url),
        // Auction lots: brand often isn't in the title (Sotheby's
        // titles are pure model descriptions; the maker is in
        // creators[] / description). detectAuctionLotBrand walks
        // every signal — explicit `maker` field, title, "<Maker> — "
        // description prefix, full-description scan — before falling
        // back to "Other". Pre-2026-05-05 this read title only, which
        // dropped every Cartier Sotheby's lot into "Other".
        brand: canonicalizeBrand(detectAuctionLotBrand(data)),
        ref: data.title || "—",
        price: price || 0,
        currency: data.currency || "USD",
        priceUSD: priceUsd || price || 0,
        savedPrice: price || 0,
        savedCurrency: data.currency || "USD",
        savedPriceUSD: priceUsd || price || 0,
        source: data.house || "—",
        url,
        img: data.cached_img_url || data.image || "",
        sold: isEnded,
        _isSold: isEnded,
        _isTrackedLot: true,
        _isAuctionFormat: isAuctionFormat,
        // Use auction_end as the firstSeen surrogate so the date sort
        // doesn't see a NaN/empty for these rows. The blend sort
        // dispatches on auction_end + sold flag so this is mostly a
        // safety net for date-driven sorts that touch lot rows.
        firstSeen: data.auction_end || data.scraped_at || "",
        buying_option: data.buying_option,
        current_bid: data.current_bid,
        current_bid_usd: data.current_bid_usd,
        sold_price: data.sold_price,
        sold_price_usd: data.sold_price_usd,
        estimate_low: data.estimate_low,
        estimate_high: data.estimate_high,
        estimate_low_usd: data.estimate_low_usd,
        estimate_high_usd: data.estimate_high_usd,
        starting_price: data.starting_price,
        starting_price_usd: data.starting_price_usd,
        auction_end: data.auction_end,
        auction_start: data.auction_start,
        auction_title: data.auction_title,
        lot_number: data.lot_number,
        soldAt: isEnded ? (data.auction_end || data.scraped_at || "") : null,
      });
    }
    return arr;
  }, [trackedLotsState, auctionLotsState, manualArchiveLotsState]);

  // Main feed = dealer listings ∪ auction lots. Powers the Listings
  // tab's allFiltered memo; the listingsSubTab (live / auctions /
  // sold / calendar) narrows via predicate inside allFiltered, not here.
  //
  // Admin blocklist filter (Mark 2026-05-06): items in
  // admin_hidden_listings get dropped here for EVERY user
  // (anonymous + signed-in + admin alike) so Mark's hide action
  // works as global curation, not just a per-user dismissal.
  // Per-user `hidden_listings` keeps working alongside this; both
  // tables are read independently.
  const mainFeedItems = useMemo(() => {
    const hasAdminHide = adminHidden && adminHidden.size > 0;
    const filterAdminHidden = (it) => !adminHidden.has(it.id);
    if (auctionLotItems.length === 0) {
      return hasAdminHide ? items.filter(filterAdminHidden) : items;
    }
    const merged = [...items, ...auctionLotItems];
    return hasAdminHide ? merged.filter(filterAdminHidden) : merged;
  }, [items, auctionLotItems, adminHidden]);

  // Sources for the filter UI, split by kind so the sidebar/drawer can
  // group them under Dealers / Auction houses sub-headers. SOURCES is
  // the union (used everywhere a flat list is convenient — e.g. the
  // mobile drawer's overflow chip).
  const DEALER_SOURCES = useMemo(
    () => [...new Set(items.map(i => i.source).filter(Boolean))].sort(),
    [items]
  );
  const AUCTION_SOURCES = useMemo(
    () => [...new Set(auctionLotItems.map(i => i.source).filter(s => s && s !== "—"))].sort(),
    [auctionLotItems]
  );
  const SOURCES = useMemo(
    () => [...DEALER_SOURCES, ...AUCTION_SOURCES.filter(s => !DEALER_SOURCES.includes(s))],
    [DEALER_SOURCES, AUCTION_SOURCES]
  );

  // Singleton-brand collapse threshold. Brands with FEWER live listings
  // than this get pooled into "Other" rather than getting their own
  // filter chip. Stops one-off oddballs from cluttering the brand rail
  // while still letting niche brands surface as soon as a second
  // listing of the same brand appears. Mark set this to 2 on
  // 2026-04-29 — adjustable later if the chip rail feels sparse.
  const BRAND_CHIP_MIN = 2;
  // Brand counts power both the filter-chip rail (BRANDS below) and
  // the singleton-collapse decision in displayBrand. Pool depends on
  // the active view: pre-2026-05-05 this read every live dealer item
  // regardless of tab, so on Listings > Live auctions the user could
  // tap a brand and find no matches (chip rail was built from dealer
  // inventory, not auction lots). Now scoped per-sub-tab.
  const brandCounts = useMemo(() => {
    let pool;
    if (tab === "listings" && listingsSubTab === "auctions") {
      pool = mainFeedItems.filter(i =>
        !i.sold && (!!i._isAuctionFormat || !!i._isTrackedLot)
      );
    } else if (tab === "listings" && listingsSubTab === "sold") {
      pool = mainFeedItems.filter(i => i.sold && !hidden[i.id]);
    } else {
      // Live listings + Auction calendar + Watchlist + References all
      // fall through to the live dealer pool. Watchlist is technically
      // imperfect (its sub-tab scoping isn't wired in here yet) but
      // matches the long-standing behavior; refine when a Watchlist
      // brand-filter complaint surfaces.
      pool = items.filter(i => !i.sold && !hidden[i.id]);
    }
    const c = {};
    pool.forEach(i => {
      const k = i.brand || "Other";
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [items, hidden, mainFeedItems, tab, listingsSubTab]);
  // Bucket label for one item under singleton-collapse rules.
  // "Other" + any brand below the chip threshold all funnel into one
  // "Other" bucket for filter + group-by purposes.
  // FORCE_OTHER_BRANDS (utils.js) takes precedence — Mark's curation
  // pool 2026-05-05 for brands that have ≥2 listings (so the chip
  // threshold would normally surface them) but aren't interesting
  // enough to occupy a top-level chip.
  const displayBrand = useCallback((it) => {
    const b = it.brand || "Other";
    if (FORCE_OTHER_BRANDS.has(b)) return "Other";
    return (brandCounts[b] || 0) >= BRAND_CHIP_MIN ? b : "Other";
  }, [brandCounts]);
  const BRANDS = useMemo(() => {
    const visible = Object.entries(brandCounts)
      .filter(([b, n]) =>
        n >= BRAND_CHIP_MIN
        && b !== "Other"
        && !FORCE_OTHER_BRANDS.has(b)
      )
      .sort((a, b) => b[1] - a[1])
      .map(([b]) => b);
    // If any singleton, genuinely-Other, or force-Other items exist,
    // expose an "Other" chip so they remain reachable from the brand
    // filter UI.
    const otherTotal = Object.entries(brandCounts)
      .filter(([b, n]) =>
        n < BRAND_CHIP_MIN
        || b === "Other"
        || FORCE_OTHER_BRANDS.has(b)
      )
      .reduce((s, [, n]) => s + n, 0);
    if (otherTotal > 0) visible.push("Other");
    return visible;
  }, [brandCounts]);
  // Reference chips aggregate digit sequences (3-6 digits, optional .NNN)
  // found in listing titles. Years (1900-2099) are filtered out so a 4-digit
  // year doesn't pose as a ref. Refs are **scoped to the current brand
  // filter** — selecting Rolex hides "300" (Omega Seamaster/Speedy) and
  // selecting Omega hides "1675" (Rolex GMT). Without any brand selected,
  // chips draw from the whole catalog. Only refs with 2+ matches show.
  const REFS = useMemo(() => {
    const counts = {};
    const refRegex = /\b\d{3,6}(?:\.\d{1,3})?\b/g;
    const pool = items.filter(i =>
      !i.sold && (filterBrands.length === 0 || filterBrands.includes(displayBrand(i)))
    );
    pool.forEach(i => {
      const matches = (i.ref || "").match(refRegex) || [];
      for (const m of matches) {
        if (!m.includes(".")) {
          const n = parseInt(m, 10);
          if (n >= 1900 && n <= 2099 && m.length === 4) continue;  // year, skip
        }
        counts[m] = (counts[m] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([r]) => r);
  }, [items, filterBrands]);

  // (minPrice / maxPrice — int-parsed bounds — now derived inside
  // useFilters from the raw text inputs.)
  useEffect(() => { setPage(1); }, [filterSources, filterBrands, filterRefs, search, sort, newDays, minPriceText, maxPriceText]);

  // Sign-in gate for save actions. Tapping the heart or X while signed
  // out triggers the Google OAuth redirect instead of silently doing
  // nothing. If auth isn't configured at all (dev environment missing
  // env vars), we just no-op — no way to sign in anyway.
  // Pending-intent stash: when a signed-out user clicks heart or X, we
  // capture the listing id in sessionStorage before redirecting to
  // Google. After OAuth completes and the page reloads, the effect
  // below replays the action so the click isn't lost. sessionStorage
  // (vs localStorage) auto-clears with the tab and naturally scopes
  // per-window — different tabs don't replay each other's intents.
  const requireSignIn = useCallback((intent) => {
    if (!isAuthConfigured) return;
    if (intent) {
      try { sessionStorage.setItem("pending_intent", JSON.stringify(intent)); } catch {}
    }
    signInWithGoogle();
  }, [signInWithGoogle]);

  const toggleHide = useCallback((item) => {
    if (!user) { requireSignIn({ kind: "hide", id: item.id }); return; }
    // Telemetry: only fire on the on-direction so analytics counts
    // hides, not toggles. Read state BEFORE toggleHidden mutates it.
    const wasHidden = !!hidden[item.id];
    toggleHidden(item);
    if (!wasHidden) recordEvent("hide", item);
    // Mark 2026-05-06 admin-hide: when the taste-maker hides a
    // listing, ALSO add it to the global blocklist so it
    // disappears from every user's live feed. Per-user
    // hidden_listings still gets the row above (so the Hidden
    // synthetic list under Watchlist > Lists keeps a record).
    if (isAdmin) {
      const wasGlobalHidden = adminHidden.has(item.id);
      toggleAdminHidden(item.id, wasGlobalHidden);
    }
  }, [user, hidden, toggleHidden, requireSignIn, recordEvent, isAdmin, adminHidden, toggleAdminHidden]);

  const toggleFilterRef = (ref) =>
    setFilterRefs(p => p.includes(ref) ? p.filter(x => x !== ref) : [...p, ref]);

  const handleWish = useCallback((item) => {
    if (!user) { requireSignIn({ kind: "wish", id: item.id }); return; }
    // Phase B2 (2026-05-04): the `_isTrackedLot` guard is gone.
    // Auction-lot cards in the unified feed now write to
    // watchlist_items via toggleWatchlist, same as dealer listings.
    // The watchItems memo dedupes when a URL appears in both the
    // user's hearted set and the trackedLotUrls projection, so the
    // duplicate-card bug from before Phase B2 doesn't recur.
    const wasWished = !!watchlist[item.id];
    // Cap gate (Epic 3). The DB trigger is the line of defense, but
    // we no-op early in the UI so users get the persistent banner
    // instead of an invisibly-failed insert + stale optimistic state.
    // Un-favorite (wasWished=true) is always allowed — that's how
    // people clear room.
    if (!wasWished && userLimit.isAtHardCap) return;
    toggleWatchlist(item);
    // Telemetry on the on-direction only — same shape as toggleHide.
    if (!wasWished) recordEvent("save", item);
  }, [user, watchlist, toggleWatchlist, requireSignIn, recordEvent, userLimit.isAtHardCap]);

  // Replay a pending heart/hide once the user is back from OAuth and
  // the items list has loaded (so we can resolve the saved id to the
  // current item snapshot). Idempotent: only acts when the item isn't
  // already in the target collection, so re-runs from React strict-mode
  // or repeated renders don't toggle off what we just toggled on.
  useEffect(() => {
    if (!user || items.length === 0) return;
    let raw;
    try { raw = sessionStorage.getItem("pending_intent"); } catch { return; }
    if (!raw) return;
    try { sessionStorage.removeItem("pending_intent"); } catch {}
    let intent;
    try { intent = JSON.parse(raw); } catch { return; }
    if (!intent || !intent.id) return;
    const target = items.find(i => i.id === intent.id);
    if (!target) return;
    if (intent.kind === "wish" && !watchlist[target.id]) {
      toggleWatchlist(target);
      recordEvent("save", target);
    }
    if (intent.kind === "hide" && !hidden[target.id]) {
      toggleHidden(target);
      recordEvent("hide", target);
    }
  }, [user, items, watchlist, hidden, toggleWatchlist, toggleHidden, recordEvent]);

  // (toggleSource / toggleBrand moved to useFilters.)

  const newCounts = useMemo(() => {
    // Exclude backfilled items so the Today/3-day/Week counts reflect
    // real new inventory, not a scraper-change retro pickup.
    const fs = items.filter(i => !i.sold && !i.backfilled);
    return {
      1: fs.filter(i => daysAgo(freshDate(i)) <= 1).length,
      3: fs.filter(i => daysAgo(freshDate(i)) <= 3).length,
      7: fs.filter(i => daysAgo(freshDate(i)) <= 7).length,
    };
  }, [items]);

  const allFiltered = useMemo(() => {
    // Listings tab: scope by sub-tab BEFORE any other narrowing.
    //   live      — currently-active dealer listings only
    //   auctions  — currently-active auction lots only (live or upcoming)
    //   sold      — sold dealer listings + sold auction lots, mixed
    //   calendar  — handled outside this memo (renders the calendar
    //               component, not a card grid)
    //
    // Watchlist tab passes through unchanged here — its filtering
    // happens in the watchItems memo below.
    let its = [...mainFeedItems];
    const isLotItem = (i) => !!i._isAuctionFormat || !!i._isTrackedLot;
    if (listingsSubTab === "live") {
      its = its.filter(i => !i.sold && !isLotItem(i));
    } else if (listingsSubTab === "auctions") {
      its = its.filter(i => isLotItem(i) && !i.sold);
    } else if (listingsSubTab === "sold") {
      its = its.filter(i => i.sold);
      // Suppress low-tier brands from the All Sold view UNLESS the
      // user has hearted the item — in which case the saved entry
      // takes precedence and stays visible. Mark's curation pass
      // 2026-05-05; SUPPRESS_AT_SOLD_BRANDS lives in utils.js.
      its = its.filter(i =>
        !SUPPRESS_AT_SOLD_BRANDS.has(i.brand) || !!watchlist[i.id]
      );
    }
    its = its.filter(i => !hidden[i.id]);   // drop user-hidden items
    if (filterRefs.length > 0) {
      its = its.filter(i => {
        const ref = (i.ref || "").toLowerCase();
        return filterRefs.some(r => ref.includes(r.toLowerCase()));
      });
    }
    if (newDays > 0) its = its.filter(i => daysAgo(freshDate(i)) <= newDays && !i.backfilled);
    if (filterSources.length > 0) its = its.filter(i => filterSources.includes(i.source));
    if (filterBrands.length > 0) its = its.filter(i => filterBrands.includes(displayBrand(i)));
    if (search.trim()) {
      its = its.filter(i => matchesSearch(i, search));
    }
    if (minPrice > 0) its = its.filter(i => (i.priceUSD || i.price) >= minPrice);
    if (maxPrice < GLOBAL_MAX) its = its.filter(i => (i.priceUSD || i.price) <= maxPrice);
    // Hearted-only filter (Bundle 2B). When the toggle is on, narrow
    // the active sub-tab to items the user has saved. No-op when the
    // user is signed out (watchlist is empty), so the toggle is
    // hidden in that case at the UI layer.
    if (filterHearted) its = its.filter(i => !!watchlist[i.id]);

    // Sort dispatch — interpretation of the Date pill depends on
    // sub-tab. Price pill is uniform.
    if (sort === "price-asc") {
      its.sort((a, b) => (a.priceUSD || a.price) - (b.priceUSD || b.price));
    } else if (sort === "price-desc") {
      its.sort((a, b) => (b.priceUSD || b.price) - (a.priceUSD || a.price));
    } else if (listingsSubTab === "auctions") {
      // Live auctions: Date pill = ending order. date↓ = soonest first
      // (live → upcoming asc → ended desc → non-auction last). date↑
      // reverses the same axis so the user has an off-switch in the
      // same control. Catalog-order behavior (group by auction date,
      // then sort by lot_number ascending within the same auction)
      // is now baked into `endingSoonComparator` itself — Mark
      // 2026-05-07. The standalone Lot # pill was retired in the
      // same change.
      its.sort(endingSoonComparator);
      if (sort === "date-asc") its.reverse();
    } else if (listingsSubTab === "sold") {
      // All sold: Date pill = sold-date. Most-recently-sold first by
      // default; date-asc flips to oldest-sold first. Sold dealer items
      // carry `soldAt`; sold auction lots carry `soldAt` (set by the
      // projection to data.auction_end on ended lots) or fall back to
      // auction_end. Items without either land last.
      const soldDate = (i) => i.soldAt || i.auction_end || "";
      const ascending = sort === "date-asc";
      its.sort((a, b) => {
        const da = soldDate(a), db = soldDate(b);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return ascending ? da.localeCompare(db) : db.localeCompare(da);
      });
    } else {
      // Live listings (or non-listings tab fallthrough): Date pill =
      // freshness. Same effectiveDate logic as before — later of
      // firstSeen and priceDropAt (when there's a real cumulative drop).
      const effectiveDate = (i) => {
        const f = freshDate(i) || "";
        const d = (i.priceDropTotal && i.priceDropTotal > 0) ? (i.priceDropAt || "") : "";
        return d > f ? d : f;
      };
      const ascending = sort === "date-asc";
      its.sort((a, b) => {
        // Backfilled items always sort below non-backfilled in either
        // direction. firstSeen on a backfilled batch is "the day the
        // source was added", not "the day the listing appeared".
        const baBack = a.backfilled ? 1 : 0;
        const bbBack = b.backfilled ? 1 : 0;
        if (baBack !== bbBack) return baBack - bbBack;
        const ea = effectiveDate(a), eb = effectiveDate(b);
        if (ea === eb) return 0;
        return ascending ? (ea < eb ? -1 : 1) : (ea < eb ? 1 : -1);
      });
    }
    return its;
  }, [mainFeedItems, filterSources, filterBrands, filterRefs, hidden, watchlist, search, sort, minPrice, maxPrice, newDays, listingsSubTab, filterHearted]);

  const visible = useMemo(() => allFiltered.slice(0, page * PAGE_SIZE), [allFiltered, page]);
  const hasMore = visible.length < allFiltered.length;

  // Callback ref so the IntersectionObserver always tracks the current
  // loader DOM node, even if React swaps it out between page bumps.
  const loaderRef = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setPage(p => p + 1);
    }, { threshold: 0.1 });
    obs.observe(node);
    observerRef.current = obs;
  }, []);

  // Lookup map of current scrape state by listing id, used to determine
  // whether each watchlisted item is still live or has gone sold/inactive.
  // Includes auction-house lots so hearted Antiquorum/Phillips/Christie's/
  // Sotheby's items resolve to a live entry — without them, the
  // `!live || !!live.sold` check in watchItems incorrectly marks every
  // hearted auction-house lot as sold and the Watchlist > Auctions sub-tab
  // drops them.
  const liveStateById = useMemo(() => {
    const m = new Map();
    for (const it of items) m.set(it.id, it);
    for (const it of auctionLotItems) m.set(it.id, it);
    return m;
  }, [items, auctionLotItems]);

  const watchItems = useMemo(() => {
    // Hearted dealer items from `watchlist_items`. Mark 2026-05-07
    // un-heart staleness fix: merge the live watchlist with the
    // savedItemsSnapshot captured on saved-view entry. Spread order
    // means watchlist values WIN where keys collide, so currently-
    // hearted items get their fresh data; un-hearted items fall back
    // to the snapshot value (the original render-time copy) so the
    // card stays on screen until the next sub-tab change / refresh.
    let its = Object.values({ ...savedItemsSnapshot, ...watchlist });
    // Tag each entry with its current liveness so we can split into
    // Live/Sold sub-views below. An item is "sold" if the live scrape
    // says it's sold/on-hold OR if it's no longer in the scrape at all
    // (dealer pulled the listing → assume sold). The saved snapshot is
    // still the durable record either way.
    its = its.map(it => {
      const live = liveStateById.get(it.id);
      const isSold = !live || !!live.sold;
      return { ...it, _isSold: isSold };
    });
    // Project tracked lots (auction-house lots, eBay items, future
    // marketplace URLs) into the same shape so the Watchlist surface
    // is the single "things I care about" list. Tracked-lot URLs are
    // ALWAYS treated as user-saved (the URL paste itself counts as a
    // heart per Mark's spec on 2026-04-30). Item IDs use sha1(url) so
    // the union dedupes if the same URL ever ends up in both tables.
    //
    // Phase B2 dedup (2026-05-04): hearts on auction lots now write
    // to watchlist_items keyed by shortHash(url). If a user has both
    // a tracked_lots row AND a watchlist_items row for the same URL
    // (during migration, or transiently), skip the tracked_lots
    // projection — the watchlist row is the canonical record.
    const watchedIds = new Set(its.map(it => it.id));
    for (const url of trackedLotUrls) {
      if (watchedIds.has(shortHash(url))) continue;
      const data = trackedLotsState[url];
      if (!data) {
        // Pending: scraper hasn't populated tracked_lots.json yet.
        // Render a placeholder card.
        its.push({
          id: shortHash(url),
          brand: "Other",
          ref: "Fetching…",
          price: 0,
          currency: "USD",
          priceUSD: 0,
          savedPrice: 0,
          savedCurrency: "USD",
          savedPriceUSD: 0,
          source: "—",
          url,
          img: "",
          sold: false,
          _isSold: false,
          _isTrackedLot: true,
          _isAuctionFormat: false,
          savedAt: trackedLotAddedAt[url] || "",
        });
        continue;
      }
      const isEnded = data.status === "ended";
      const price = (isEnded ? data.sold_price : data.current_bid)
        || data.starting_price || data.estimate_low || 0;
      const priceUsd = (isEnded ? data.sold_price_usd : data.current_bid_usd)
        || data.starting_price_usd || data.estimate_low_usd || price;
      // eBay AUCTION + every traditional auction house = auction
      // format. eBay BIN + Chrono24 + Watchcollecting etc. = fixed
      // price. The chip + filter use this distinction; status text
      // ("CURRENT" vs "BUY NOW" vs "HAMMER" vs "SOLD") is set by the
      // Card render off `data.buying_option`.
      const isFixedPrice = data.buying_option === "BUY_IT_NOW"
                        || data.buying_option === "FIXED_PRICE";
      const isAuctionFormat = !isFixedPrice;
      its.push({
        id: shortHash(url),
        brand: canonicalizeBrand(detectAuctionLotBrand(data)),
        ref: data.title || "—",
        price: price || 0,
        currency: data.currency || "USD",
        priceUSD: priceUsd || price || 0,
        // savedPrice family populated so the WatchlistTab Card-render
        // overrides (which read savedPrice/savedCurrency/savedPriceUSD
        // for hearted dealer items) work for tracked-lot projections
        // too without a separate code path.
        savedPrice: price || 0,
        savedCurrency: data.currency || "USD",
        savedPriceUSD: priceUsd || price || 0,
        source: data.house || "—",
        url,
        // Prefer Blob-cached image when present (survives the dealer
        // / auction-house deleting their original); fall back to the
        // scraper's native image URL otherwise. Empty cached_img_url
        // === "" means "processed by the cache module but no source
        // image was available" — fall through to whatever data.image
        // has (probably also empty).
        img: data.cached_img_url || data.image || "",
        sold: isEnded,
        _isSold: isEnded,
        _isTrackedLot: true,
        _isAuctionFormat: isAuctionFormat,
        // Pass through auction-specific fields the Card needs to
        // render bid label / countdown / estimate range / etc.
        buying_option: data.buying_option,
        current_bid: data.current_bid,
        current_bid_usd: data.current_bid_usd,
        sold_price: data.sold_price,
        sold_price_usd: data.sold_price_usd,
        estimate_low: data.estimate_low,
        estimate_high: data.estimate_high,
        estimate_low_usd: data.estimate_low_usd,
        estimate_high_usd: data.estimate_high_usd,
        starting_price: data.starting_price,
        starting_price_usd: data.starting_price_usd,
        auction_end: data.auction_end,
        auction_title: data.auction_title,
        lot_number: data.lot_number,
        savedAt: trackedLotAddedAt[url] || "",
        soldAt: isEnded ? (data.auction_end || data.scraped_at || "") : null,
      });
    }
    // Watchlist sub-tab scopes the saved set BEFORE other filters
    // narrow it. Mirrors the Listings tab's sub-tab dispatch:
    //   listings → live dealer items only (no auction-format, no eBay)
    //   auctions → live auction-format items + ALL eBay items
    //              (including Buy-It-Now), per Mark 2026-05-04
    //   sold     → anything that's gone sold (dealer or lot)
    //   searches/collections → not item-shaped, watchView is empty here
    const isEbay = (i) => (i.source || "").toLowerCase() === "ebay"
      || /\bebay\.[a-z.]+\//i.test(i.url || "");
    const isAuctionShaped = (i) => !!i._isAuctionFormat || isEbay(i);
    if (watchTopTab === "listings") {
      its = its.filter(i => !i._isSold && !isAuctionShaped(i));
    } else if (watchTopTab === "auctions") {
      its = its.filter(i => !i._isSold && isAuctionShaped(i));
    } else if (watchTopTab === "sold") {
      its = its.filter(i => i._isSold);
    }
    // Apply the same source/brand/ref/search filters as Available so
    // the drawer narrows the watchlist too. Saved entries carry the
    // listing_snapshot fields (source, brand, ref), so the same
    // predicates work here.
    if (filterSources.length > 0) its = its.filter(i => filterSources.includes(i.source));
    if (filterBrands.length > 0)  its = its.filter(i => filterBrands.includes(displayBrand(i)));
    if (filterRefs.length > 0) {
      its = its.filter(i => {
        const ref = (i.ref || "").toLowerCase();
        return filterRefs.some(r => ref.includes(r.toLowerCase()));
      });
    }
    if (search.trim()) {
      its = its.filter(i => matchesSearch(i, search));
    }
    // Price filter — was missing on Watchlist (Mark surfaced
    // 2026-04-30: divider counts didn't react to the price boxes).
    if (minPrice > 0)  its = its.filter(i => (i.savedPriceUSD || i.savedPrice || i.priceUSD || i.price) >= minPrice);
    if (maxPrice < GLOBAL_MAX) its = its.filter(i => (i.savedPriceUSD || i.savedPrice || i.priceUSD || i.price) <= maxPrice);
    // Sort dispatch — Date pill semantics depend on sub-tab, mirroring
    // the Listings tab dispatch. Price pill uniform.
    if (sort === "price-asc") {
      its.sort((a, b) => (a.savedPriceUSD || a.savedPrice) - (b.savedPriceUSD || b.savedPrice));
    } else if (sort === "price-desc") {
      its.sort((a, b) => (b.savedPriceUSD || b.savedPrice) - (a.savedPriceUSD || a.savedPrice));
    } else if (watchTopTab === "auctions") {
      // Saved auctions: Date pill = ending order. Date↓ soonest
      // first; Date↑ reverses. Catalog-order behavior is baked
      // into `endingSoonComparator` (within the same auction
      // sort by lot_number ascending) — see the comparator note.
      its.sort(endingSoonComparator);
      if (sort === "date-asc") its.reverse();
    } else if (watchTopTab === "sold") {
      // Saved sold: Date pill = sold-date. Most-recent first by
      // default; Date↑ flips.
      const soldDate = (i) => i.soldAt || i.auction_end || "";
      const ascending = sort === "date-asc";
      its.sort((a, b) => {
        const da = soldDate(a), db = soldDate(b);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return ascending ? da.localeCompare(db) : db.localeCompare(da);
      });
    } else {
      // Saved listings + non-listing sub-tabs: savedAt order.
      const ascending = sort === "date-asc";
      its.sort((a, b) => ascending
        ? (a.savedAt || "").localeCompare(b.savedAt || "")
        : (b.savedAt || "").localeCompare(a.savedAt || ""));
    }
    return its;
  }, [watchlist, savedItemsSnapshot, liveStateById, sort, filterSources, filterBrands, filterRefs, search,
      minPrice, maxPrice, watchTopTab,
      trackedLotUrls, trackedLotsState, trackedLotAddedAt]);

  // (watchLive / watchSold removed 2026-05-04 — Watchlist sub-tabs
  // now scope live vs sold up-front inside the watchItems memo.)

  // Status-filtered slice: "live" / "sold" / "all". Drives the Watchlist
  // > Listings sub-tab. Sort + filters from the existing controls flow
  // through watchItems already.
  // sort from watchItems is preserved.
  // (no scraped data yet) sort with upcoming so the user sees them.
  const nowMs = Date.now();
  // Sort tracked lots by the same `sort` state Available + Watchlist use.
  // For lots, "price" maps to the most-relevant figure: hammer if sold,
  // current bid if there is one, else the estimate-low. Date sort uses
  // auction_end (soonest first by default for upcoming, latest first
  // for past so the most recent hammer leads).
  const lotSortValue = (l) => {
    if (l._pending) return null;
    if (l.sold_price_usd != null) return l.sold_price_usd;
    if (l.current_bid_usd != null) return l.current_bid_usd;
    if (l.estimate_low_usd != null) return l.estimate_low_usd;
    return null;
  };
  const sortLots = (arr, isPast) => arr.slice().sort((a, b) => {
    if (sort === "price-asc" || sort === "price-desc") {
      const av = lotSortValue(a), bv = lotSortValue(b);
      // Push pending/no-price lots to the end regardless of asc/desc.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sort === "price-asc" ? av - bv : bv - av;
    }
    if (sort === "date-asc") {
      // Oldest end-time first, regardless of section.
      return (a.auction_end || "").localeCompare(b.auction_end || "");
    }
    // "date" (newest first): for upcoming, that means soonest-ending
    // first (most time-sensitive); for past, latest-ended first.
    if (isPast) return (b.auction_end || "").localeCompare(a.auction_end || "");
    return (a.auction_end || "9").localeCompare(b.auction_end || "9");
  });
  // Tracked auction lots: join the user's saved URLs against the global
  // scraped state. URLs without scraped data yet show as a placeholder
  // ("Fetching details on next scrape").
  const trackedLots = useMemo(() => {
    return trackedLotUrls.map(url => {
      const data = trackedLotsState[url];
      return data ? { ...data, url } : { url, _pending: true };
    });
  }, [trackedLotUrls, trackedLotsState]);

  // Apply the search filter to lots — title, house, and lot number all
  // match. Wired so the same search box that filters dealer listings on
  // the Watchlist tab also narrows the auction lots.
  const trackedLotsFiltered = useMemo(() => {
    let arr = trackedLots;
    // Source filter — for auction lots the "source" is the auction house.
    // The same Source pill in the filter row drives both: dealer sources
    // for listings, auction houses for lots.
    if (filterSources.length > 0) {
      arr = arr.filter(l => filterSources.includes(l.house));
    }
    const q = (search || "").trim().toLowerCase();
    if (q) {
      arr = arr.filter(l => {
        if (l._pending) return l.url.toLowerCase().includes(q);
        const haystack = `${l.title || ""} ${l.house || ""} ${l.description || ""} ${l.lot_number || ""}`.toLowerCase();
        return haystack.includes(q);
      });
    }
    return arr;
  }, [trackedLots, search, filterSources]);

  // Distinct auction houses across the user's tracked lots — used to
  // populate the Source pill's options when on Watchlist > Auction lots.
  const lotHouses = useMemo(
    () => [...new Set(trackedLots.map(l => l.house).filter(Boolean))].sort(),
    [trackedLots]
  );

  // User-hidden items (still live, just told to disappear from Available).
  // Surfaced via a "Manage hidden" modal opened from the user dropdown.
  const hiddenItems = useMemo(() => {
    return items
      .filter(i => !i.sold && hidden[i.id])
      .map(i => ({ ...i, hiddenAt: hidden[i.id] || "" }))
      .sort((a, b) => (a.hiddenAt < b.hiddenAt ? 1 : -1));
  }, [items, hidden]);

  const watchCount = Object.keys(watchlist).length;
  // (hasFilters now derived inside useFilters.)

  const savedSearchStats = useMemo(() => {
    // Count = matches in the same set the user sees when they tap
    // the row (runSearch lands on Listings > Live listings, which
    // is dealer-only items minus the user's hidden set). Without
    // the hidden filter the count is rosier than the visible grid.
    // Mark's report 2026-05-06.
    //
    // 2026-05-08 — also apply the saved $ Min / $ Max guard if set,
    // so the count + "X new this week" badge match what the user
    // sees after the saved guard re-applies on tap.
    const forSale = items.filter(i => !i.sold && !hidden[i.id]);
    return userSearches.map(({ id, label, query, minPrice, maxPrice }) => {
      const q = (query || "").trim();
      let matches = q ? forSale.filter(i => matchesSearch(i, q)) : [];
      if (minPrice != null) matches = matches.filter(i => Number(i.price) >= minPrice);
      if (maxPrice != null) matches = matches.filter(i => Number(i.price) <= maxPrice);
      const newCount = matches.filter(i => daysAgo(freshDate(i)) <= 7 && !i.backfilled).length;
      return { id, label, query, minPrice, maxPrice, count: matches.length, newCount };
    });
  }, [items, hidden, userSearches]);


  // (resetFilters now provided by useFilters.)

  const visibleBrands = brandsExpanded ? BRANDS : BRANDS.slice(0, BRANDS_SHOW);
  const visibleSources = sourcesExpanded ? SOURCES : SOURCES.slice(0, SOURCES_SHOW);
  const REFS_SHOW = 12;
  const visibleRefs = refsExpanded ? REFS : REFS.slice(0, REFS_SHOW);
  const NEW_OPTS = [{ label: "Today", days: 1 }, { label: "3 days", days: 3 }, { label: "This week", days: 7 }];

  const baseStyle = {
    fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',sans-serif",
    WebkitFontSmoothing: "antialiased", minHeight: "100vh",
    background: "var(--bg)", color: "var(--text1)",
    ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v]))
  };
  const gridStyle = { display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 1, background: "var(--border)" };

  // ── AUTH UI ─────────────────────────────────────────────────────────────
  // One block of JSX used by both the desktop sidebar footer and the mobile
  // header so the experience is identical across layouts.
  //   - Not configured (env vars missing): render nothing — app still works.
  //   - Not ready yet: subtle placeholder so "Sign in" doesn't flash.
  //   - Signed out: "Sign in with Google" pill.
  //   - Signed in: user's first-letter avatar + dropdown with Sign out.
  const userInitial = user?.user_metadata?.name?.[0]
    || user?.user_metadata?.full_name?.[0]
    || user?.email?.[0]
    || "?";
  const userName = user?.user_metadata?.name
    || user?.user_metadata?.full_name
    || user?.email
    || "";

  // (Admin gate `isAdmin` is hoisted up near the auth hook so
  // toggleHide can use it; comment + computation moved with it.)

  // If the URL says ?tab=admin but the resolved user isn't an admin,
  // bounce to listings. Defer this until user has resolved (authReady)
  // so signed-in users don't get bumped during the initial auth flicker.
  useEffect(() => {
    if (authReady && tab === "admin" && !isAdmin) {
      setTab("listings");
    }
  }, [authReady, tab, isAdmin]);

  const authJSX = !isAuthConfigured ? null : !authReady ? (
    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--surface)" }} />
  ) : !user ? (
    // Signed-out: small "About" text link + the Sign-in button. The
    // About link is the always-on access path for signed-out users
    // (signed-in users reach About via Settings dropdown). Sign-in
    // routes through SignInPromptModal — 2-step explainer before the
    // OAuth fires.
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button onClick={() => setAboutModalOpen(true)} style={{
        fontSize: 12, padding: "5px 10px", borderRadius: 20,
        border: "none", background: "transparent",
        color: "var(--text2)", cursor: "pointer", fontFamily: "inherit",
        whiteSpace: "nowrap",
      }}>
        About
      </button>
      <button onClick={() => setSignInPromptOpen(true)} style={{
        fontSize: 12, padding: "5px 12px", borderRadius: 20,
        border: "0.5px solid var(--border)", background: "var(--surface)",
        color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
        whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
      }}>
        <svg width="12" height="12" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.6 2.1 30.1 0 24 0 14.8 0 6.8 5.3 3 13l7.8 6C12.7 13.5 17.8 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.2-3.1-.5-4.5H24v9h12.7c-.6 3-2.3 5.5-4.9 7.2l7.6 5.9c4.4-4.1 7.1-10.1 7.1-17.6z"/>
          <path fill="#FBBC05" d="M10.8 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.8-6C1.1 16.3 0 20 0 24s1.1 7.7 3 11.2l7.8-6.5z"/>
          <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15.1-5.5l-7.6-5.9c-2.1 1.4-4.8 2.2-7.5 2.2-6.2 0-11.3-4-13.2-9.5l-7.8 6C6.8 42.7 14.8 48 24 48z"/>
        </svg>
        Sign in
      </button>
    </div>
  ) : (
    <div style={{ position: "relative" }}>
      {/* Avatar — circle initial, no chevron. Mark feedback
          2026-05-07: chevron didn't read as a menu hint as
          intended; reverted to plain initial circle. The
          aria-label + title still convey "Account menu" for
          assistive tech / hover. */}
      <button onClick={() => setShowUserMenu(o => !o)}
        aria-label="Account menu"
        title="Account menu"
        style={{
          width: isMobile ? 40 : 32, height: isMobile ? 40 : 32, borderRadius: "50%",
          border: "0.5px solid var(--border)", background: "var(--surface)",
          color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
          fontSize: isMobile ? 14 : 13, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
        {userInitial.toUpperCase()}
      </button>
      {showUserMenu && (
        <div style={{
          position: "absolute", right: 0, top: isMobile ? 46 : 38, zIndex: 50,
          // Always open downward — both desktop and mobile buttons live in
          // the top header now, so opening up would push the menu off the
          // top of the viewport.
          background: "var(--bg)", border: "0.5px solid var(--border)",
          borderRadius: 10, padding: 8, minWidth: 200,
          boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
        }}>
          <div style={{ fontSize: 11, color: "var(--text3)", padding: "4px 8px" }}>Signed in as</div>
          <div style={{ fontSize: 13, color: "var(--text1)", padding: "0 8px 8px",
                       overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userName}
          </div>
          <div style={{ height: "0.5px", background: "var(--border)", margin: "4px -8px 4px" }} />
          {/* About Watchlist — surfaced as a top-level dropdown entry
              (Mark feedback 2026-05-07: "have About Watchlist not
              hidden under Settings"). Settings keeps a fallback entry
              too so existing muscle memory still works. */}
          <button onClick={() => { setShowUserMenu(false); setAboutModalOpen(true); }}
            style={{ display: "block", width: "100%", textAlign: "left",
                    padding: "6px 8px", border: "none", background: "transparent",
                    color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 13, borderRadius: 6 }}>
            About Watchlist
          </button>
          <button onClick={() => { setShowUserMenu(false); setSettingsModalOpen(true); }}
            style={{ display: "block", width: "100%", textAlign: "left",
                    padding: "6px 8px", border: "none", background: "transparent",
                    color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 13, borderRadius: 6 }}>
            Settings
          </button>
          {isAdmin && (
            // Site Stats is admin-only — shown only to Mark. Mark
            // feedback 2026-05-07: shade it and drop the trailing
            // arrow so it reads as "yours" rather than the same
            // weight as user-facing entries.
            <button onClick={() => { setShowUserMenu(false); setTab("admin"); setPage(1); }}
              style={{ display: "block", width: "100%", textAlign: "left",
                      padding: "6px 8px", border: "none", background: "transparent",
                      color: "var(--text3)", cursor: "pointer", fontFamily: "inherit",
                      fontSize: 12, borderRadius: 6, fontStyle: "italic" }}>
              Site stats
            </button>
          )}
          {/* Report-a-bug entry — fires the contextualized mailto so
              Mark + future reporters get URL + currency + browser
              prefilled in the body. Same helper backs the AboutModal
              feedback link so the two surfaces stay in lockstep. */}
          <button onClick={() => {
            setShowUserMenu(false);
            const href = buildFeedbackMailto({
              subject: "Watchlist bug report",
              opening: "Describe what you saw and what you expected:\n\n",
              contextLines: captureFeedbackContext({ primaryCurrency }),
            });
            try { window.location.href = href; } catch {}
          }}
            style={{ display: "block", width: "100%", textAlign: "left",
                    padding: "6px 8px", border: "none", background: "transparent",
                    color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 13, borderRadius: 6 }}>
            Report a bug
          </button>
          <button onClick={() => { setShowUserMenu(false); signOut(); }}
            style={{ display: "block", width: "100%", textAlign: "left",
                    padding: "6px 8px", border: "none", background: "transparent",
                    color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 13, borderRadius: 6 }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
  if (loading) return <div style={{ ...baseStyle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text2)" }}>Loading listings...</div>;
  if (loadError) return <div style={{ ...baseStyle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text2)" }}>Could not load listings. Try refreshing.</div>;

  // ── SHARED STYLE TOKEN ───────────────────────────────────────────────────
  // sectionHeadingStyle still consumed by MobileShell for the filter
  // drawer's Source / Brand / Price-range section labels. The desktop
  // sidebar this once also fed (sidebarFilterPanelJSX, ~45 lines of
  // dead JSX) was retired in the April '26 filter consolidation and
  // removed in the 2026-05-04 cleanup pass.
  const sectionHeadingStyle = {
    fontSize: 10, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.08em", color: "var(--text1)", marginBottom: 8,
  };

  // ── SEARCH RUNNER ─────────────────────────────────────────────────────────
  // Saved searches aren't their own tab — they render as a subsection
  // inside WatchlistTab. This just handles the "tap a search chip → jump
  // to Available with the query applied" handoff.
  // runSearch jumps to Listings with the query applied. Forces the
  // sub-tab to "live" so the visible set matches the count shown on
  // the saved-search row. Without this, a user on (say) Live auctions
  // who taps a search row sees auction-only matches while the row
  // count shows dealer-only matches — Mark's report 2026-05-06.
  const runSearch = (s) => {
    setSearch(s.query);
    // Re-apply the saved $ Min / $ Max guard if either is set; clear
    // both otherwise. (Mark feedback 2026-05-08: a saved search with
    // a price band wasn't restoring the band on tap.) Stored as
    // numbers — toString for the text input that drives the filter.
    const minStr = s.minPrice != null ? String(s.minPrice) : "";
    const maxStr = s.maxPrice != null ? String(s.maxPrice) : "";
    setMinPriceText(minStr);
    setMaxPriceText(maxStr);
    setSort("date");
    setListingsSubTab("live");
    setTab("listings");
    setPage(1);
  };

  // Inline editor row for add/edit. Rendered as a JSX helper (not a sub-
  // component) so React doesn't remount the inputs on every parent re-render
  // and lose focus mid-keystroke.

  // ── GRIDS ─────────────────────────────────────────────────────────────────
  // Walk `visible` and inject divider rows where the age bucket changes.
  // Only kicks in when sorted by date (newest or oldest first) and not
  // viewing sold history — date sort is what makes time-bucketing
  // meaningful. Other sorts (price) get a flat grid as before.
  // "Effective" age = whichever is more recent, the original firstSeen
  // or the most recent price-drop date (when there's a non-zero drop).
  // Same logic the sort uses, so a freshly-cut card lands in the same
  // bucket it sorts into rather than appearing as the "first card under
  // an Older header".
  const effectiveAgeDate = (i) => {
    const f = freshDate(i) || "";
    const d = (i.priceDropTotal && i.priceDropTotal > 0) ? (i.priceDropAt || "") : "";
    return d > f ? d : f;
  };
  // Same weekday-aware bucketing as the Watchlist surface — uses
  // ageBucketFromDate from utils.js so both tabs read identically
  // (Today / Yesterday / weekday-name / Last week / Older).
  const ageBucketLabel = (i) => ageBucketFromDate(effectiveAgeDate(i));
  // All-sold sub-tab uses sold-date buckets instead — recently sold
  // wants its own This week sold / Last week sold / Older bands so
  // the user can scan recent results without scrolling. Falls back to
  // auction_end for sold lots that lack an explicit soldAt.
  const soldBucketLabel = (i) => {
    const d = i.soldAt || i.auction_end || "";
    if (!d) return "Older sold";
    const label = ageBucketFromDate(d);
    // Repurpose the existing weekday buckets — append "sold" to make
    // the meaning unambiguous when the user sees "Tuesday sold" vs
    // "Tuesday" on a different sub-tab.
    if (label === "Today") return "Today sold";
    if (label === "Yesterday") return "Yesterday sold";
    if (label === "Last week") return "Last week sold";
    if (label === "Older") return "Older sold";
    return `${label} sold`;
  };
  // (Group-by helpers removed with the feature. Date dividers under
  // a date-sort are produced inline in `visibleWithDividers` below.)

  // Date-bucket ordering. Labels are now weekday-based (Today /
  // Yesterday / Wednesday / Tuesday / ... / Last week / Older), so
  // the static rank table from the old fixed-bucket model doesn't
  // work. Instead, sort grouped entries by the most-recent date
  // present in each group's items — that orders chronologically
  // regardless of label set.
  const groupRecency = (items) => {
    let max = 0;
    for (const it of items) {
      const t = new Date(effectiveAgeDate(it) || 0).getTime();
      if (t > max) max = t;
    }
    return max;
  };

  const visibleWithDividers = (() => {
    if (visible.length === 0) {
      return [];
    }
    // Date dividers fire only on Date-pill sorts (date / date-asc) and
    // only on sub-tabs where date dividers make sense:
    //   live  → freshness buckets (Today / Yesterday / weekday / ...)
    //   sold  → sold-date buckets (Today sold / Last week sold / ...)
    //   auctions → no dividers (sort is by ending order, not date)
    //   calendar → renders a calendar component, not this grid
    const isDateSort = sort === "date" || sort === "date-asc";
    const useFreshBuckets = isDateSort && tab === "listings" && listingsSubTab === "live";
    const useSoldBuckets  = isDateSort && tab === "listings" && listingsSubTab === "sold";
    if (!useFreshBuckets && !useSoldBuckets) {
      return visible.map(it => ({ kind: "card", item: it }));
    }
    const baseLabelFn = useSoldBuckets ? soldBucketLabel : ageBucketLabel;
    // Mark's report 2026-05-06: backfilled items can produce a second
    // "Last week" (or any) divider because they sort in a separate
    // section below the non-backfilled run but get bucketed by the
    // same date labels. Collapse all backfilled items under a single
    // "Earlier additions" divider so they can't collide with the
    // non-backfilled date dividers above.
    const labelFn = (i) => i.backfilled ? "Earlier additions" : baseLabelFn(i);
    const out = [];
    let last = null;
    // Count the contiguous run in `allFiltered`, not the bucket total:
    // run length is what the user sees between this header and the next.
    for (let i = 0; i < visible.length; i++) {
      const it = visible[i];
      const bucket = labelFn(it);
      if (bucket !== last) {
        let total = 0;
        for (let j = i; j < allFiltered.length && labelFn(allFiltered[j]) === bucket; j++) total++;
        out.push({ kind: "divider", label: bucket, total });
        last = bucket;
      }
      out.push({ kind: "card", item: it });
    }
    return out;
  })();

  // Auction calendar surface — surfaced inside the Listings tab's
  // Auctions filter via the Lots/Calendar toggle. Same component the
  // Watchlist > Calendar sub-tab used to render before the
  // 2026-05-04 unification; it now lives at Listings > Auction calendar
  // (its own sub-tab) after the listings sub-tabs restructure.
  const auctionCalendarJSX = (
    <div style={{ paddingTop: 4 }}>
      <AuctionCalendar auctions={auctions || []} />
    </div>
  );

  // Built once per render as a JSX expression (NOT a nested component).
  // A nested function-component gets a new identity on every App render,
  // which forces React to unmount + remount the entire grid — including
  // every <img> — making all tiles flash white on heart toggles, page
  // bumps, and any other state change. As a JSX expression, the same
  // grid instance is reused and only changed cards re-render.
  const listingsGridJSX = (
    <>
      <div style={{ ...gridStyle, borderRadius: 10, overflow: "hidden" }}>
        {visibleWithDividers.map((entry, idx) => (
          entry.kind === "divider" ? (
            <div key={`div-${idx}-${entry.label}`} style={{
              gridColumn: "1/-1",
              padding: idx === 0 ? "14px 14px 12px" : "28px 14px 12px",
              display: "flex", alignItems: "baseline", gap: 12,
              borderBottom: "0.5px solid var(--border)",
              marginBottom: 4,
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
                {entry.label}
              </span>
              <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto" }}>
                {entry.total.toLocaleString()}
              </span>
            </div>
          ) : (
            <Card key={entry.item.id} item={entry.item} wished={!!watchlist[entry.item.id]} onWish={handleWish} compact={compact} onHide={isAdmin ? toggleHide : undefined} isHidden={!!hidden[entry.item.id]} onAddToCollection={user ? openCollectionPicker : undefined} primaryCurrency={primaryCurrency} onShare={handleShare} onView={observeCard} onClickListing={onClickListing} />
          )
        ))}
        {allFiltered.length === 0 && <div style={{ gridColumn: "1/-1", padding: 48, textAlign: "center", color: "var(--text3)", fontSize: 14 }}>
          {tab === "listings" && listingsSubTab === "sold"
            ? "No sold items match your filters"
            : tab === "listings" && listingsSubTab === "auctions"
            ? "No live auction lots match your filters"
            : "No watches match your filters"}
        </div>}
      </div>
      {hasMore && <div ref={loaderRef} style={{ padding: 24, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>Loading more...</div>}
      {!hasMore && allFiltered.length > 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>All {allFiltered.length} shown</div>}
    </>
  );

  // What the Listings tab actually renders. Calendar sub-tab swaps
  // in the auction calendar; every other sub-tab gets the card grid.
  // Lifted here so both shells dispatch via a single prop.
  const listingsTabContentJSX = listingsSubTab === "calendar"
    ? auctionCalendarJSX
    : listingsGridJSX;


  // Save-current-search modal. Opened by the heart in the search input.
  // Single-field form (label) — query comes from the live search field.
  // Component lives in ./components/FavSearchModal.js as of 2026-04-30.
  const favSearchModalJSX = (
    <FavSearchModal
      open={favPromptOpen}
      setOpen={setFavPromptOpen}
      search={search}
      minPriceText={minPriceText}
      maxPriceText={maxPriceText}
      label={favPromptLabel}
      setLabel={setFavPromptLabel}
      error={favPromptError}
      setError={setFavPromptError}
      submit={submitFavSearch}
    />
  );

  // Live/Sold/All counts for the global tri-state pill. Computed
  // BEFORE the status filter is applied so flipping segments doesn't
  // make either count drop to 0. Counts are tab-aware: Available
  // counts use the global feed; Watchlist counts use saved items only.
  const isWatchlistTab = tab === "watchlist";
  const liveCountForPill = isWatchlistTab
    ? Object.values(watchlist).filter(it => {
        const live = liveStateById.get(it.id);
        return live && !live.sold;
      }).length
    : mainFeedItems.filter(i => !i.sold && !hidden[i.id]).length;
  const soldCountForPill = isWatchlistTab
    ? Object.values(watchlist).filter(it => {
        const live = liveStateById.get(it.id);
        return !live || !!live.sold;
      }).length
    : mainFeedItems.filter(i =>  i.sold && !hidden[i.id]).length;
  const allCountForPill = liveCountForPill + soldCountForPill;

  // (feedFilterPillJSX + auctionsViewToggleJSX retired 2026-05-04 —
  // Listings tab now uses sub-tabs. listingsSubTabsJSX below replaces
  // both controls.)

  // Listings tab sub-tab strip — mirrors the Watchlist sub-tab strip
  // pattern (tabPill underline buttons, horizontally scrollable).
  // Live listings | Live auctions | All sold | Auction calendar.
  const listingsSubTabsJSX = tab !== "listings" ? null : (
    <div style={{
      display: "flex", gap: 20, alignItems: "center",
      padding: "0 16px",
      background: "var(--bg)",
      borderBottom: "0.5px solid var(--border)",
      flexShrink: 0,
      overflowX: "auto",
      overflowY: "hidden",
      WebkitOverflowScrolling: "touch",
      scrollbarWidth: "none",
      msOverflowStyle: "none",
    }}>
      {[
        ["live", isMobile ? "Live" : "Live listings"],
        ["auctions", isMobile ? "Auctions" : "Live auctions"],
        ["sold", isMobile ? "Sold" : "All sold"],
        ["calendar", isMobile ? "Calendar" : "Auction calendar"],
      ].map(([key, label]) => {
        const active = listingsSubTab === key;
        return (
          <button key={key} onClick={() => { setListingsSubTab(key); setDrawerOpen(false); setPage(1); }}
            style={{ ...tabPill(active), flexShrink: 0 }}>
            {label}
          </button>
        );
      })}
    </div>
  );

  // (Retired 2026-04-30) AuctionsTab JSX was built here. Tracked lots
  // now flow into Watchlist > Listings; calendar lives at Watchlist >
  // Auction Calendar via AuctionCalendar.js.

  // Watchlist tab content JSX (was `watchlistTabJSX` pre-2A.2). The
  // dispatch in `savedContentJSX` below picks between this and the
  // CollectionsTab content based on which Saved sub-tab is active.
  const watchlistTabJSX_inner = (
    <WatchlistTab
      user={user}
      signInWithGoogle={triggerSignInPrompt}
      isAuthConfigured={isAuthConfigured}
      watchlist={watchlist}
      watchItems={watchItems}
      watchCount={watchCount}
      toggleWatchlist={toggleWatchlist}
      liveStateById={liveStateById}
      savedSearchStats={savedSearchStats}
      searchEditor={searchEditor}
      setSearchEditor={setSearchEditor}
      startAddSearch={startAddSearch}
      startEditSearch={startEditSearch}
      cancelSearchEdit={cancelSearchEdit}
      commitSearch={commitSearch}
      removeSearch={removeSearch}
      runSearch={runSearch}
      handleWish={handleWish}
      compact={compact}
      gridStyle={gridStyle}
      isMobile={isMobile}
      sort={sort}
      watchTopTab={watchTopTab}
      setWatchTopTab={setWatchTopTab}
      legacyLocal={legacyLocal}
      importState={importState}
      setImportState={setImportState}
      legacyKeys={{ watchlist: LEGACY_WATCHLIST_KEY, hidden: LEGACY_HIDDEN_KEY }}
      setTab={setTab}
      setPage={setPage}
      collectionsApi={collectionsApi}
      setEditingCollection={setEditingCollection}
      openCollectionPicker={openCollectionPicker}
      startCreateCollection={startCreateCollection}
      openTrackModal={() => { setTrackOpen(true); setTrackError(""); }}
      primaryCurrency={primaryCurrency}
      handleShare={handleShare}
      hiddenItems={hiddenItems}
      toggleHide={toggleHide}
      allListings={items}
      hidden={hidden}
      observeCard={observeCard}
      onClickListing={onClickListing}
    />
  );

  // Admin tab JSX — only rendered by the shells when tab === "admin".
  // The component itself fetches its own data (verification.json,
  // verification_history.json, listings.json); we pass in-memory hearts
  // and hides because those come from Supabase via App.js hooks.
  const adminTabJSX = (
    <AdminTab watchItems={watchItems} hiddenItems={hiddenItems} />
  );

  // References tab JSX. Watch Challenges moved out to the new
  // Collections tab on 2026-05-06 (PR #86); References (Cool Stuff)
  // now hosts only Watch size comparison + Links.
  const referencesTabJSX = (
    <ReferencesTab
      user={user}
      isAuthConfigured={isAuthConfigured}
      signInWithGoogle={triggerSignInPrompt}
      allListings={items}
      tabResetTick={tab === "references" ? tabResetTick : 0}
    />
  );

  // Collections-style tab content. Bundle 2A.2 (2026-05-07): the
  // standalone Collections top-level tab folded into Saved (internal
  // `tab=watchlist`); CollectionsTab itself renders unchanged but
  // it's now reached via Saved sub-tabs (my-collection / wishlist /
  // lists / challenges). The dispatch between WatchlistTab and
  // CollectionsTab content lives in `savedContentJSX` below — shells
  // just render whichever the dispatch chose.
  const collectionsTabJSX = (
    <CollectionsTab
      user={user}
      isAuthConfigured={isAuthConfigured}
      signInWithGoogle={triggerSignInPrompt}
      collectionsApi={collectionsApi}
      hiddenItems={hiddenItems}
      toggleHide={toggleHide}
      watchlist={watchlist}
      watchItems={watchItems}
      hidden={hidden}
      allListings={items}
      primaryCurrency={primaryCurrency}
      handleShare={handleShare}
      handleWish={handleWish}
      compact={compact}
      gridStyle={gridStyle}
      setEditingCollection={setEditingCollection}
      openCollectionPicker={openCollectionPicker}
      startCreateCollection={startCreateCollection}
      observeCard={observeCard}
      onClickListing={onClickListing}
      pendingChallengeDrillId={pendingChallengeDrillId}
      clearPendingChallengeDrill={() => setPendingChallengeDrillId(null)}
      collectionsSubTab={collectionsSubTab}
      setCollectionsSubTab={setCollectionsSubTab}
      tabResetTick={tab === "watchlist" && SUB_VALUES_COLLECTIONS.includes(watchTopTab) ? tabResetTick : 0}
      // Filter row values for drill-in filtering (2026-05-09).
      // Same shape useFilters exposes; ListsView applies these to
      // the drilled-in items so the shell's filter row drives the
      // visible set inside a list, mirroring Listings tab behavior.
      filterValues={{
        filterSources, filterBrands, search, sort,
        minPrice, maxPrice,
      }}
      // CollectionsTab notifies App.js of its drill-in id so the
      // shell can render the filter row when drilled in. App.js
      // doesn't manage the col state — this is a one-way mirror.
      onDrillInChange={setColDrillInId}
    />
  );

  // Bundle 2A.2 dispatch: when the active Saved sub-tab is one of
  // the collections-style values (my-collection / wishlist / lists /
  // challenges), render the CollectionsTab content; otherwise render
  // the WatchlistTab content (saved listings / auctions / sold /
  // searches). Shells render this via the existing `watchlistTabJSX`
  // prop name so the two render paths stay one-place-to-debug.
  const savedContentJSX = SUB_VALUES_COLLECTIONS.includes(watchTopTab)
    ? collectionsTabJSX
    : watchlistTabJSX_inner;

  // ── MOBILE ────────────────────────────────────────────────────────────────
  // (EndingSoon pinned strip retired 2026-05-04 — Watchlist > Saved
  // auctions sub-tab IS the ending-soon view now, with its own
  // ending-soonest default sort. Const + shellProps wiring removed
  // in the same cleanup pass.)

  // Watchlist sub-tab strip — lifted out of WatchlistTab.js on
  // 2026-04-30 so it sits between the main tab strip and the filter
  // row rather than below the filter row. Sits in the layout flow
  // only when tab === "watchlist". Inline contextual buttons:
  // "+ Track new item" on Listings, "+ Add search" on Searches,
  // none on Auction Calendar.
  const watchSubTabsJSX = tab !== "watchlist" ? null : (
    // Sub-tab strip uses underline-style buttons (see tabPill in
    // styles.js). Pre-2026-05-04 the strip also carried a trailing
    // contextual action button; that's gone now.
    //
    // Bundle 2A.2 (2026-05-07) folded the four Collections sub-tabs
    // into this strip — eight sub-tabs total. On 375px viewports
    // that's wider than the screen, so the wrapper needs horizontal
    // overflow scrolling. Mirror the listingsSubTabsJSX shape: same
    // overflowX:auto + scrollbar-hiding CSS so the strip scrolls
    // touch-style with no visible scrollbar. Mark feedback
    // 2026-05-08: "the sub tabs don't slide horizontally" — pre-fix
    // the wrapper was display:flex without overflow, so the buttons
    // got clipped.
    <div style={{
      display: "flex", gap: 20, alignItems: "center",
      padding: "0 16px",
      background: "var(--bg)",
      borderBottom: "0.5px solid var(--border)",
      flexShrink: 0,
      overflowX: "auto",
      overflowY: "hidden",
      WebkitOverflowScrolling: "touch",
      scrollbarWidth: "none",
      msOverflowStyle: "none",
    }}>
      {/* 2026-05-08 IA pass — Mark feedback: the previous "Saved"
          sub-tab duplicated the Listings tab + the heart filter
          (Listings → Saved chip) gave users the same browse-hearts
          flow inline with Listings, making the Saved pill feel
          redundant. Removed. The hearted-views (?sub=listings/
          auctions/sold) still work via direct URL for back-compat
          but have no pill in the strip. New strip pill order:
          Lists / Favorite searches / Owned Watches / Challenges
          (4 pills, lists is the new default landing). The "wishlist"
          sub-tab also lost its pill; the value still routes to
          MyCollectionView in shortlist-toggle mode for old URLs. */}
      {[
        ["lists",         "Lists"],
        ["searches",      isMobile ? "Searches" : "Favorite searches"],
        ["my-collection", "Owned Watches"],
        ["challenges",    "Challenges"],
      ].map(([key, label]) => {
        const active = watchTopTab === key;
        return (
          <button key={key} onClick={() => { setWatchTopTab(key); setDrawerOpen(false); }} style={{ ...tabPill(active), flexShrink: 0 }}>{label}</button>
        );
      })}
    </div>
  );

  // Internal Listings/Auctions/Sold toggle for the Saved tab.
  // Bundle 2A.2b — the three hearted views still exist as separate
  // underlying sub-tabs, they just share a top-level pill now.
  //
  // 2026-05-08 (Mark feedback) — was a separate row above the filter
  // row; merged into the filter row to save vertical space. Now
  // returns a JSX fragment of three pills (no wrapper) so each shell
  // can prepend it to its filter row inline. The cluster is rendered
  // exactly when the Saved tab is on a hearted sub-tab; outside that
  // it's null and shells render the filter row unchanged.
  const watchHeartedToggleJSX = (tab !== "watchlist" || !SAVED_HEARTED_SUBS.includes(watchTopTab)) ? null : (
    <>
      {[
        ["listings", "Listings"],
        ["auctions", "Auctions"],
        ["sold",     "Sold"],
      ].map(([key, label]) => {
        const active = watchTopTab === key;
        return (
          <button key={key} onClick={() => setWatchTopTab(key)}
            style={innerToggleButton(active)}>{label}</button>
        );
      })}
    </>
  );

  // collectionsSubTabsJSX retired in Bundle 2A.2 (2026-05-07) —
  // Collections collapsed into Saved (internal `tab=watchlist`); the
  // four collections-style sub-tabs are now part of `watchSubTabsJSX`
  // above. Shells receive a `null` here for backward compat (the
  // shellProps key still exists but is never assigned a JSX value).
  const collectionsSubTabsJSX = null;

  // Track new item modal — single-URL paste flow with source-list
  // instructions. Trigger lives in the watchSubTabsJSX strip above the
  // filter row. Component lives in ./components/TrackNewItemModal.js
  // as of 2026-04-30.
  const trackNewItemModalJSX = (
    <TrackNewItemModal
      open={trackOpen}
      setOpen={setTrackOpen}
      trackUrl={trackUrl}
      setTrackUrl={setTrackUrl}
      trackError={trackError}
      setTrackError={setTrackError}
      submitTrack={submitTrack}
      trackBusy={trackBusy}
    />
  );

  // Add-search modal — fires when searchEditor.id === "new" (i.e. user
  // tapped "+ Add search" in the sub-tab strip). Edits to existing
  // searches stay in the inline editor inside WatchlistTab; only the
  // "new" case routes through the modal so + Add and + Track behave
  // identically across the strip.
  const addSearchModalOpen = !!searchEditor && searchEditor.id === "new";
  const addSearchModalJSX = (
    <AddSearchModal
      open={addSearchModalOpen}
      onClose={cancelSearchEdit}
      searchEditor={searchEditor || { id: "", label: "", query: "", minPrice: null, maxPrice: null }}
      setSearchEditor={setSearchEditor}
      commitSearch={commitSearch}
    />
  );

  // Collections — create/rename modal + add-to-collection picker.
  // Both render globally so any Card across the app can trigger the
  // picker, and the sub-tab strip + WatchlistTab share the edit modal.
  const collectionEditModalJSX = (
    <CollectionEditModal
      editing={editingCollection}
      setEditing={setEditingCollection}
      createCollection={collectionsApi.createCollection}
      renameCollection={collectionsApi.renameCollection}
    />
  );
  // Wrap addItemToCollection so the picker fires a list_add telemetry
  // event each time a user adds the target listing into a collection.
  // Forwards args + return identity unchanged.
  //
  // Plain function, NOT useCallback — App.js's loading + loadError
  // early returns above mean any hook past line ~1328 is conditionally
  // skipped on the first render, then called on subsequent renders,
  // which triggers React error #310 ("rendered more hooks than during
  // the previous render"). This is the rule documented in CLAUDE.md
  // "Things to never do" — don't add new useCallback/useState/useMemo
  // deep into App.js. Function identity churns each render, but
  // CollectionPickerModal isn't memo'd in a way that minds.
  const addItemToCollectionWithTelemetry = (collectionId, item) => {
    recordEvent("list_add", item);
    return collectionsApi.addItemToCollection(collectionId, item);
  };
  const collectionPickerModalJSX = (
    <CollectionPickerModal
      target={pickerTarget}
      setTarget={setPickerTarget}
      collections={collectionsApi.collections}
      itemsByCollection={collectionsApi.itemsByCollection}
      addItemToCollection={addItemToCollectionWithTelemetry}
      removeItemFromCollection={collectionsApi.removeItemFromCollection}
      createCollection={collectionsApi.createCollection}
    />
  );

  // Settings modal — currency (cross-device) plus theme + columns
  // (per-device, was the standalone View popover before 2026-05-01)
  // and the About entry. Opened from the user dropdown.
  const settingsModalJSX = (
    <SettingsModal
      open={settingsModalOpen}
      onClose={() => setSettingsModalOpen(false)}
      primaryCurrency={primaryCurrency}
      setPrimaryCurrency={setPrimaryCurrency}
      isMobile={isMobile}
      dark={dark}
      setDarkOverride={setDarkOverride}
      mobileCols={mobileCols}
      setMobileCols={setMobileCols}
      desktopCols={desktopCols}
      setDesktopCols={setDesktopCols}
      desktopAutoCols={desktopAutoCols}
      setAboutModalOpen={setAboutModalOpen}
    />
  );

  // Share-receive surface. ALL share-related hooks live inside
  // <ShareReceiver/> — App.js's hook count stays unchanged regardless
  // of share state. That's the v3 architectural choice after v2's
  // React #310 in production. Receiver renders null when no share
  // intent is present, so it's effectively free in the common path.
  const shareReceiverJSX = (
    <ShareReceiver
      // mainFeedItems = items + auctionLotItems, so an auction-lot
      // share id resolves the same way a dealer-listing one does.
      // Pre-2026-05-07 this was `items` (dealer feed only) and any
      // auction-lot recipient saw the orientation page with a null
      // focused-card — Mark's report.
      items={mainFeedItems}
      user={user}
      watchlist={watchlist}
      toggleWatchlist={toggleWatchlist}
      addToSharedInbox={collectionsApi?.addToSharedInbox}
      isAuthConfigured={isAuthConfigured}
      signInWithGoogle={triggerSignInPrompt}
      primaryCurrency={primaryCurrency}
      onClickListing={onClickListing}
      // Mirrors active state up so the shell can hide the regular
      // feed when the focused landing surface is up.
      setShareActive={setShareActive}
      // Powers the orientation CTAs at the bottom of the surface
      // ("Browse all listings", "Go to your list", etc.).
      // setTabWithReceiveEscape clears URL params + dismisses the
      // receive surface so the user can navigate away cleanly.
      setTab={setTabWithReceiveEscape}
      resetTick={shareReceiveResetTick}
    />
  );

  // Watch Challenges receive surface (v1.5). Same isolation pattern
  // as ShareReceiver — all hooks live inside the component, App.js
  // only mirrors a one-bit `challengeShareActive` so the shells can
  // gate their browse chrome.
  const challengeReceiverJSX = (
    <ChallengeReceiver
      user={user}
      isAuthConfigured={isAuthConfigured}
      signInWithGoogle={triggerSignInPrompt}
      collectionsApi={collectionsApi}
      setChallengeShareActive={setChallengeShareActive}
      setTab={setTabWithReceiveEscape}
      resetTick={shareReceiveResetTick}
      onTakenChallenge={(id) => {
        // Drop the recipient straight into their freshly-created
        // challenge. Bundle 2A.2 (2026-05-07): Collections tab
        // collapsed into Saved; challenges live at
        // `?tab=watchlist&sub=challenges`. setTabWithReceiveEscape
        // clears URL params + dismisses the receive surface;
        // setting watchTopTab to "challenges" lands the user on
        // the right sub-tab; CollectionsTab + ChallengesView each
        // read pendingChallengeDrillId to drill in.
        setPendingChallengeDrillId(id);
        setWatchTopTab("challenges");
        setTabWithReceiveEscape("watchlist");
      }}
    />
  );

  // List-share receive surface (List Sharing v1, 2026-05-07). Same
  // isolation pattern as ShareReceiver / ChallengeReceiver — all
  // hooks live inside the component; App.js only mirrors a one-bit
  // `listShareActive` so the shells can gate browse chrome.
  const listReceiverJSX = (
    <ListReceiver
      user={user}
      isAuthConfigured={isAuthConfigured}
      signInWithGoogle={triggerSignInPrompt}
      collectionsApi={collectionsApi}
      items={mainFeedItems}
      primaryCurrency={primaryCurrency}
      setListShareActive={setListShareActive}
      setTab={setTabWithReceiveEscape}
      resetTick={shareReceiveResetTick}
    />
  );

  // Phase B2 one-shot per-user migration of tracked auction-house URLs
  // → watchlist_items. Self-contained component (hooks isolated) so
  // App.js's hook count stays unchanged. Renders the dismissable
  // banner only when migration completed with N>0 actually moved;
  // null in every other state.
  const lotMigrationBannerJSX = (
    <LotMigrationBanner
      user={user}
      watchlist={watchlist}
      trackedLotUrls={trackedLotUrls}
      trackedLotsState={trackedLotsState}
      auctionLotsState={auctionLotsState}
      toggleWatchlist={toggleWatchlist}
      removeTrackedLot={removeTrackedLot}
    />
  );

  // User-limit banner (Epic 3). Self-contained — renders nothing
  // unless the user is at ≥80% of their cap. Mounted next to
  // shareReceiverJSX in both shells so it surfaces regardless of
  // which tab the user is on.
  const userLimitBannerJSX = (
    <UserLimitBanner
      count={userLimit.count}
      cap={userLimit.cap}
      isAtSoftWarn={userLimit.isAtSoftWarn}
      isAtHardCap={userLimit.isAtHardCap}
    />
  );

  // Both shells consume the same props bag. App.js owns state and the
  // top-level JSX consts (authJSX, listingsGridJSX, watchSubTabsJSX,
  // watchlistTabJSX, plus the modal JSX consts) — the shells just
  // render. Extracted into MobileShell/DesktopShell as Stage 2 of
  // recommendation #1 on 2026-04-30.
  // Count shown next to the sort row (mobile) and at the right of the
  // filter row (desktop). On the Listings tab this is the filtered
  // dealer-feed length; on Watchlist it's the post-filter length of the
  // active sub-tab's saved set. Until 2026-05-04 both shells always read
  // allFiltered.length, which made the badge wildly misleading on the
  // Watchlist tab when no filters were on (showing the full ~1,800-item
  // dealer feed count next to a saved set of a few dozen).
  const displayedCount = tab === "watchlist" ? watchItems.length : allFiltered.length;

  const shellProps = {
    // Catalog / config
    BRANDS, BRANDS_SHOW, SOURCES, SOURCES_SHOW,
    DEALER_SOURCES, AUCTION_SOURCES,
    // State
    aboutModalOpen, activeFilterPop, allFiltered, displayedCount,
    brandsExpanded, currentIsSaved,
    drawerOpen,
    filterBrands, filterSources,
    listingsSubTab,
    hasFilters, hiddenItems,
    maxPriceText, minPriceText,
    filterHearted,
    search, signInPromptOpen, signInWithGoogle, sort, sourcesExpanded, tab, user,
    visibleBrands, visibleSources,
    watchTopTab, watchlist,
    // Setters / handlers
    handleWish, openFavPrompt, resetFilters,
    setAboutModalOpen, setActiveFilterPop, setBrandsExpanded,
    setDrawerOpen,
    setFilterBrands, setFilterHearted, setFilterSources,
    setListingsSubTab,
    setMaxPriceText, setMinPriceText,
    setPage, setSearch, setShowUserMenu, setSignInPromptOpen,
    setSort, setSourcePickerOpen, setSourcesExpanded,
    // Wrapped: top-level nav from shells uses the wrapper so that
    // clicking the Watchlist logo or a main tab while a share-receive
    // surface is up auto-escapes (clears URL params + dismisses the
    // receiver) rather than leaving the recipient stuck. Internal
    // setTab callsites in App.js use the raw setTab.
    setTab: setTabWithReceiveEscape,
    toggleBrand, toggleHide, toggleSource,
    // Style tokens / pre-built JSX
    addSearchModalJSX,
    authJSX, baseStyle,
    collectionEditModalJSX, collectionPickerModalJSX,
    favSearchModalJSX,
    listingsGridJSX, listingsTabContentJSX, primaryCurrency, sectionHeadingStyle,
    settingsModalJSX, shareReceiverJSX,
    challengeReceiverJSX,
    listReceiverJSX,
    listingsSubTabsJSX,
    trackNewItemModalJSX, watchSubTabsJSX, watchHeartedToggleJSX, collectionsSubTabsJSX,
    // Bundle 2A.2: shells render `watchlistTabJSX` for the Saved
    // tab — the value is now the dispatched content (Watchlist or
    // Collections style) computed by `savedContentJSX`.
    watchlistTabJSX: savedContentJSX,
    adminTabJSX, referencesTabJSX, collectionsTabJSX,
    lotMigrationBannerJSX,
    userLimitBannerJSX,
    // Whether a share-receive landing surface is taking over the
    // content area. Shells gate their normal tab content on any of
    // these flags — single-listing shares (#63), challenge shares
    // (v1.5), or list shares (List Sharing v1, 2026-05-07).
    shareActive,
    challengeShareActive,
    listShareActive,
    // Drill-in mirror so the shell can show the filter row when
    // we're inside a list (Watchlists > Lists > [list]).
    colDrillInId,
  };

  return isMobile
    ? <MobileShell {...shellProps} />
    : <DesktopShell {...shellProps} />;
}
