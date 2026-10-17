import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth, useWatchlist, useHidden, useAdminHidden, useSearches, useTrackedLots, useSavedAuctions, useCollections, useUserSettings, useUserProfile, isAuthConfigured, addNoteToCollection } from "./supabase";
import { useEventTelemetry } from "./hooks/useEventTelemetry";
import { useUserLimit } from "./hooks/useUserLimit";
import { UserLimitBanner } from "./components/UserLimitBanner";
import {
  GLOBAL_MAX,
  daysAgo, freshDate,
  ageBucketFromDate, canonicalizeBrand, detectAuctionLotBrand,
  shortHash,
  normUrl,
  fetchJsonCached,
  matchesSearch,
  fmtSaleDateRange,
  FORCE_OTHER_BRANDS, SUPPRESS_AT_SOLD_BRANDS,
} from "./utils";
import { useWidth, useSystemDark } from "./hooks";
import { useTrackModal } from "./hooks/useTrackModal";
import { useFavSearchModal } from "./hooks/useFavSearchModal";
import { useViewSettings } from "./hooks/useViewSettings";
import { useFilters } from "./hooks/useFilters";
import { useHomeHidden } from "./hooks/useHomeHidden";
import { useRecentSearches } from "./hooks/useRecentSearches";
import { Card } from "./components/Card";
import { ActiveFiltersStrip } from "./components/ActiveFiltersStrip";
// AuctionsTab retired 2026-04-30 — Tracked lots merged into Watchlist
// Listings; calendar moved to Watchlist > Auction Calendar sub-tab via
// the new AuctionCalendar component (AuctionsTab.js deleted 2026-04-30).
import { ReferencesTab } from "./components/ReferencesTab";
import { CollectionsTab } from "./components/CollectionsTab";
import MagazineHome from "./components/MagazineHome";
import MagazineWatches from "./components/MagazineWatches";
import { sourceLabel } from "./components/EditorialView";
import { TrackNewItemModal } from "./components/TrackNewItemModal";
import { FavSearchModal } from "./components/FavSearchModal";
import { AddSearchModal } from "./components/AddSearchModal";
import { CollectionEditModal } from "./components/CollectionEditModal";
import { CollectionPickerModal } from "./components/CollectionPickerModal";
import { NotePickerModal } from "./components/NotePickerModal";
import { SettingsModal } from "./components/SettingsModal";
import { ViewSettingsControls } from "./components/ViewSettingsControls";
import { ShareReceiver } from "./components/ShareReceiver";
import { ChallengeReceiver } from "./components/ChallengeReceiver";
import { ListReceiver } from "./components/ListReceiver";
import { CatalogReceiver } from "./components/CatalogReceiver";
// Code-split (B-22): the auction calendar renders only inside the modal when
// opened (calendarModalOpen) — React.lazy splits it into its own chunk so it
// never loads on first paint. Named export → unwrap to default.
const AuctionCalendar = React.lazy(() =>
  import("./components/AuctionCalendar").then(m => ({ default: m.AuctionCalendar }))
);
import { LotMigrationBanner } from "./components/LotMigrationBanner";
import { WatchlistTab } from "./components/WatchlistTab";
import { EmptyState } from "./components/EmptyState";
// AdminTab is code-split (B-22): admin-only code that every public visitor
// used to download + parse on first load. React.lazy splits it into its own
// chunk, fetched only when an admin first opens the tab. Named export →
// unwrap to default. It's rendered behind `tab === "admin"` (admins only), so
// the chunk request never fires for normal users. See docs/audits/2026-05-24.
const AdminTab = React.lazy(() =>
  import("./components/AdminTab").then(m => ({ default: m.AdminTab }))
);
import { MobileShell } from "./components/MobileShell";
import { DesktopShell } from "./components/DesktopShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ConfirmHost, confirm } from "./components/ConfirmModal";
import { ChatBubbleHost } from "./components/ChatBubbleHost";
import { PageHeader } from "./components/PageHeader";
import { registerActionHandlers, registerItemResolver } from "./components/ActionBus";
// IdentityBand import retired 2026-05-22 — component file still in
// the repo for git history, no current call site.
// import { IdentityBand } from "./components/IdentityBand";
// Code-split (B-22): Search-all results render only when the user runs a
// cross-surface search (searchAllActive) — React.lazy → its own chunk.
const SearchResultsView = React.lazy(() =>
  import("./components/SearchResultsView").then(m => ({ default: m.SearchResultsView }))
);
import DateDivider from "./components/DateDivider";
import SubTabBar from "./components/SubTabBar";
import { TOP_TABS, isTopTabActive } from "./topTabs";
import { readLook, readChromeFaces, isMagWatchesOn } from "./lookFlag";
import { ChromeTint, chromeIsLight } from "./chromeTint";
import { innerToggleButton, actionButton, setMagazineLook } from "./styles";

// Same-origin paths — Vercel serves everything in /public at the
// site root, so these resolve against the user's current host
// (the-watch-list.app or a preview-deploy domain). 2026-05-10:
// switched away from `raw.githubusercontent.com/<user>/<repo>/...`
// to keep the GitHub repo identity off the production network tab.
// Live/sold split (merge.py). We fetch listings_live.json eager — it's
// the critical render path (Feed, Saved, all live-only views) — and
// listings_sold.json lazily after first paint. The Sold/Archive views
// only need the sold half, which can arrive a beat late. listings.json
// (the full file) is still emitted for backend tooling + stale-cached
// PWA bundles, but the current frontend never fetches it.
const LISTINGS_LIVE_URL = "/listings_live.json";
const LISTINGS_SOLD_URL = "/listings_sold.json";
// Sidecar to listings.json — same per-id keying, value is the full
// dealer description text. Emitted by merge.py. Lazy-loaded after
// first paint so it stays off the critical render path; consumed
// by handleWish to hydrate `desc` into the listing_snapshot at
// heart time so the description survives the dealer pulling the
// page. Cost: ~700KB gzipped, fetched async after listings.json
// resolves.
const LISTINGS_DESC_URL = "/listings_desc.json";
const AUCTIONS_URL = "/auctions.json";
const TRACKED_LOTS_URL = "/tracked_lots.json";
// Comprehensive auction-lot scrape — populated by auction_lots_scraper.py
// (Antiquorum + Christie's + Sotheby's + Phillips). Same shape as
// tracked_lots.json (URL-keyed lot detail dicts) so the App.js
// projection treats them identically.
const AUCTION_LOTS_URL = "/auction_lots.json";
// Manually-captured historical-auction lots (Phase D, 2026-05-05).
// Static, immutable: the manual_archive_scraper writes this once per
// added sale and the result never changes (archive sales don't update
// post-hoc). Loaded alongside auction_lots.json and merged by URL key.
const MANUAL_ARCHIVE_LOTS_URL = "/manual_archive_lots.json";
// Bonhams auction lots — Cloudflare blocks Bonhams' lot pages from CI
// (datacenter IPs), so they're scraped from a residential host (B-24/B-25)
// into their own file rather than auction_lots.json (which CI would
// overwrite, dropping Bonhams active lots). Same shape; folded by URL key.
const BONHAMS_LOTS_URL = "/bonhams_lots.json";
// Chrono24 per-reference listings — Cloudflare blocks Chrono24 from CI, so
// chrono24_lots_scraper.py runs on a residential host (curl-cffi Chrome
// impersonation, same as Bonhams) and writes its own file. Deliberately
// narrow: only specific references (the ones we have guides for). Folded into
// the main Listings feed by URL; the reference-guide page filters to highlight.
const CHRONO24_LOTS_URL = "/chrono24_lots.json";
// Loupe This auction lots — populated by loupethis_scraper.py. Loupe
// This is structurally a one-watch-per-auction marketplace (closer to
// eBay than to catalog houses), so it doesn't fit auction_lots_scraper's
// read-from-auctions.json loop and writes its own file. Loaded into a
// separate state below and folded into the same projection.
const LOUPETHIS_LOTS_URL = "/loupethis_lots.json";
// Hairspring "Finds" editorial corpus — Erik Gustafson's per-watch
// long-form prose, scraped from hairspring.com/blogs/finds. Each
// article documents a watch Hairspring sold (~1,600 articles to
// date, 93% carry a sold_price_usd). Projected into Listings >
// All sold alongside auction lots, with Erik's prose attached as
// the description. Mark spec 2026-05-17 — "less for the watch and
// more for the commentary and watch background" + "bring these
// into sold archive ... not just the prose."
const HAIRSPRING_FINDS_URL = "/hairspring_finds.json";
// Editorial corpus URLs for Search-all (PR_φ2 2026-05-22). When the
// user opens the cross-tab Search-all destination, we lazy-fetch each
// source's meta JSON in parallel and add an Articles strip to the
// strip view. Mirrors the SOURCES list in EditorialView.js but kept
// independent here — search-all needs only meta records (no bodies)
// and shouldn't have a circular import with EditorialView. If a new
// editorial source ships, add it here too — both lists stay in sync.
const EDITORIAL_SOURCE_URLS = [
  "/hairspring_finds.json",
  "/bring_a_loupe.json",
  "/rolex_magazine.json",
  "/onthedash.json",
  "/bulang_watch_talks.json",
  "/romainrea_editorial.json",
  "/hodinkee_reference_points.json",
  "/acollectedman_journal.json",
  "/woe_dispatch.json",
  "/screwdowncrown.json",
  "/fratello.json",
  "/watchfid_editorial.json",
];
// Body-text companion URLs (each meta JSON has a sibling *_bodies.json
// per editorial_corpus_io.py's split). Lazy-loaded on first
// keystroke in the Search-all input so Mark's "submariner" query
// matches articles where the term only appears in the body.
const EDITORIAL_BODY_URLS = EDITORIAL_SOURCE_URLS.map(u =>
  u.replace(/\.json$/, "_bodies.json")
);
// Hodinkee Shop archive — frozen since Feb 2023 (Hodinkee shut the
// vintage-watch shop). 2,346 products, 99.96% sold. Per-product
// editorial writeup + structured Fine Print (Maker/Model/Reference/
// Year/Caliber/Material/Dimensions) in body_html. Dual-track source
// just like hairspring_finds.json: feeds the editorial corpus AND
// gets projected into the Sold-archive view via `hodinkeeShopItems`
// below.
const HODINKEE_SHOP_URL = "/hodinkee_shop.json";
// Manually-curated historical sold listings (2026-05-09). Sits next
// to manual_archive_lots.json conceptually but is shaped like a flat
// listings.json entry rather than auction-lot data. Each item is a
// hand-added "watch sold by a dealer / house before our scraper
// window" record — surfaces in Listings > Archive (Sold) for
// everyone. merge.py is unaware of this file; App.js loads + merges.
const MANUAL_HISTORICAL_LISTINGS_URL = "/manual_historical_listings.json";
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
  // The look flag for chrome tokens (styles.js `LOOK`): set before any child
  // renders, so every pill and count below reads the same answer. A plain call,
  // not a hook — safe above the early returns.
  setMagazineLook(readLook() === "new");
  const screenWidth = useWidth();
  const sysDark = useSystemDark();
  // 760, was 640 (Mark 2026-06-06): half-screen laptop windows got the
  // desktop chrome at widths where it can't lay out — phone-ish windows
  // now get the real mobile view; 760+ gets desktop with the filter
  // bar's narrow stacked mode (StandardFilterBar).
  const isMobile = screenWidth < 760;
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
    filterModels,  setFilterModels,
    filterRefs,    setFilterRefs,
    filterSaleUrls, setFilterSaleUrls,
    toggleSource, toggleBrand, toggleModel, toggleSaleUrl,
    sort, setSort,
    search, setSearch,
    minPriceText, setMinPriceText,
    maxPriceText, setMaxPriceText,
    minPrice, maxPrice,
    newDays, setNewDays,
    statusMode, setStatusMode,
    brandsExpanded,  setBrandsExpanded,
    sourcesExpanded, setSourcesExpanded,
    modelsExpanded,  setModelsExpanded,
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
  // Compact = denser typography + smaller overlay buttons. Triggers
  // on tight grids: any desktop ≥4-col, AND mobile 3-col (Mark
  // 2026-05-09 — at 393px / 3-col the heart + ⋯ buttons crowded the
  // brand chip; compact shrinks them so they stay clear).
  const compact = cols >= 4 || (isMobile && cols >= 3);

  const [items, setItems] = useState([]);
  // id → description map. Lazy-fetched from /listings_desc.json after
  // the main listings load resolves; consulted by handleWish to
  // hydrate `desc` into the listing_snapshot at heart time. Empty
  // until the sidecar lands (rare race: user hearts within ~500ms of
  // page load → snapshot misses desc; acceptable trade for not
  // blocking first paint on this ~700KB-gzipped payload).
  const [listingsDesc, setListingsDesc] = useState({});
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
  const [bonhamsLotsState, setBonhamsLotsState] = useState({});
  // Chrono24 per-reference listings — residential-scraped (see CHRONO24_LOTS_URL).
  const [chrono24LotsState, setChrono24LotsState] = useState({});
  // Loupe This — one-watch-per-auction marketplace, scraped daily into
  // its own file. Same shape as auction_lots.json so it folds into the
  // same projection.
  const [loupethisLotsState, setLoupethisLotsState] = useState({});
  // Hairspring Finds editorial corpus — URL-keyed dict of articles.
  // Different shape from auction lots: each record carries
  // body_text + sold_price_usd + brand (already canonicalised at
  // scrape time) + reference_no. Projected separately from auction
  // lots so the "Hairspring (Finds)" source label and the
  // article-style click-through stay distinct.
  const [hairspringFindsState, setHairspringFindsState] = useState({});
  // Hodinkee Shop dealer archive — same dual-track pattern as
  // hairspringFindsState: feeds the editorial corpus (via Editorial
  // sub-tab's lazy fetch) AND projects into the Sold-archive view
  // (via `hodinkeeShopItems` memo below).
  const [hodinkeeShopState, setHodinkeeShopState] = useState({});
  // Search-all article corpus (PR_φ2 2026-05-22). Empty until the
  // user first opens the cross-tab Search-all destination, then
  // lazy-fetched. Each entry already has `_source: { key, label,
  // publication, column }` injected so the strip can display source
  // attribution without re-importing the EditorialView SOURCES list.
  const [searchAllArticles, setSearchAllArticles] = useState([]);
  const [searchAllArticlesLoaded, setSearchAllArticlesLoaded] = useState(false);
  // Home "Articles" strip (B-32) — recent editorial meta, idle-loaded.
  const [homeArticles, setHomeArticles] = useState([]);
  // Article body text — lazy-loaded SEPARATELY from meta (~14 MB
  // vs ~2 MB for meta only). First non-trivial keystroke in the
  // Search-all input triggers the fetch so the user's title-level
  // search returns immediately while body matches arrive shortly
  // after. Mark report 2026-05-22: "when I search submariner in
  // the editorial tab there are lots of articles. when I search in
  // the search area it says no articles" — Editorial's lazy body
  // load was matching against article body_text; Search-all wasn't,
  // so words that only appear in the body missed.
  const [searchAllArticleBodies, setSearchAllArticleBodies] = useState({});
  const [searchAllBodiesLoaded, setSearchAllBodiesLoaded] = useState(false);
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
  // 2026-06-01 Lists redesign: the Lists tab is sub-tabbed and LANDS ON
  // HEARTED by default. Four real sub-tabs, all rendered through
  // CollectionsTab (the WatchlistTab fork is retired for this tab).
  const SUB_VALUES = ["hearted", "lists", "searches"];
  // Back-compat alias — the savedContentJSX dispatch + tabResetTick guard
  // reference this name. All four sub-tabs now route to CollectionsTab, so
  // SUB_VALUES_COLLECTIONS === SUB_VALUES.
  const SUB_VALUES_COLLECTIONS = SUB_VALUES;
  // Bundle 2A.2b (2026-05-08) — the three hearted sub-tabs
  // (listings/auctions/sold) collapse under a single "Saved" pill in
  // the strip, with an internal Listings/Auctions/Sold toggle below.
  // Sub-tab values themselves stay unchanged — backward compat for
  // existing share URLs + localStorage prefs.
  const SAVED_HEARTED_SUBS = ["listings", "auctions", "sold"];
  const [watchTopTab, setWatchTopTab] = useState(() => {
    // Map any legacy/unknown sub-tab value to the new four-key set.
    // Used for the URL `?sub=` deep-link (so old shared links resolve);
    // legacy hearted/collections subs collapse to the Hearted landing.
    const normalize = (v) => {
      if (SUB_VALUES.includes(v)) return v;
      // "shared" is now a SECTION inside the Lists sub-tab, not its own tab.
      if (v === "challenges" || v === "shared") return "lists";
      // listings/auctions/sold/calendar/my-collection/wishlist/etc.
      return "hearted";
    };
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
    // No localStorage restore: the Lists tab always OPENS on Hearted
    // (Mark 2026-06-01 — "land here when going to lists"). In-session
    // sub-tab choices live in React state; a fresh load resets to Hearted.
    // (`dial_watch_top_tab` is still written below — harmless, not read.)
    return "hearted";
  });
  useEffect(() => {
    try { localStorage.setItem("dial_watch_top_tab", watchTopTab); } catch {}
    // Reset scroll on sub-tab change so switching from a long Listings
    // grid to the shorter Searches list doesn't leave the user mid-page.
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
    const desktopMain = document.querySelector("[data-desktop-main]");
    if (desktopMain) desktopMain.scrollTop = 0;
  }, [watchTopTab]);

  // (Saved-tab Brand/Source grouping retired 2026-06-02 — redundant with the
  // Source/Brand filters; Saved is a flat newest-first grid.)

  // (lastHeartedSubRef retired 2026-05-09 — was the "remember which
  // hearted sub-tab the user came from when re-tapping the Saved
  // pill" memory. The Saved pill itself was removed in the
  // Watchlists IA pass so the ref had no readers.)

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
  //   "saved"    — everything the user has hearted, ACROSS all states
  //                (2026-07-30 IA move: the ♡ Saved surface left the Saved
  //                tab and became a fourth slice of Watches, so the standard
  //                filter bar applies to it like any other sub-tab. The ♥
  //                filter pill can't do this job: it lives INSIDE a state
  //                sub-tab, so it can only ever show saved-and-for-sale or
  //                saved-and-at-auction, never the whole saved set.)
  const LISTINGS_SUB_VALUES = ["live", "auctions", "sold", "saved"];
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
  const collectionsSubTab = watchTopTab;
  const setCollectionsSubTab = setWatchTopTab;
  // Collecting (internal `references`) tab sub-tabs (2026-05-18).
  // Restructured from a resource-button list landing into a proper
  // sub-tab strip mirroring the Listings tab shape. Mark spec
  // 2026-05-18: the editorial corpus belongs alongside the other
  // collecting resources (Size comparison, Links) — not under
  // Watchlists. Sub-tab values:
  //   editorial — Hairspring Finds + Bring a Loupe + more editorial
  //               sources, card grid with filter/sort/search.
  //   size      — Watch size comparison (Calibrated 1:1 ruler).
  //   links     — Outbound link clusters per dealer + reference.
  // URL key: `?tab=learn&sub=<value>`. localStorage:
  // `dial_references_sub_tab`. Default = "editorial" (new headline
  // surface).
  // PR 2026-05-22: Challenges moved from Watchlists to Collecting
  // (Mark spec, "while at it, move the challenge tab from watchlist
  // to collecting"). Challenges sits as a Collecting sub-tab
  // alongside Editorial / Size compare / Links.
  // "tools" bundles size-comparison + links + challenges (Mark 2026-06-01).
  // Legacy values stay valid so old deep-links resolve; ReferencesTab routes
  // them into the Tools view and the strip highlights Tools.
  const REFERENCES_SUB_VALUES = ["editorial", "references", "tools", "challenges", "size", "links"];
  const [referencesSubTab, setReferencesSubTab] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tParam = params.get("tab");
      const sub = params.get("sub");
      if ((tParam === "learn" || tParam === "references") &&
          REFERENCES_SUB_VALUES.includes(sub)) {
        return sub;
      }
      // Legacy URL: `?tab=watchlist&sub=challenges` should land on
      // Collecting > Challenges (the tab init above redirected
      // tab → "references"; this completes the redirect by setting
      // the sub-tab too).
      if (tParam === "watchlist" && sub === "challenges") {
        return "challenges";
      }
    }
    try {
      const v = localStorage.getItem("dial_references_sub_tab");
      return REFERENCES_SUB_VALUES.includes(v) ? v : "editorial";
    } catch { return "editorial"; }
  });
  useEffect(() => {
    try { localStorage.setItem("dial_references_sub_tab", referencesSubTab); } catch {}
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
    const desktopMain = document.querySelector("[data-desktop-main]");
    if (desktopMain) desktopMain.scrollTop = 0;
  }, [referencesSubTab]);
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
  // Top-level tabs (Mark spec 2026-05-14): Listings · Watchlists ·
  // Collection. "Share" tab retired — the IA work in #279-#281
  // absorbed its functions (Watchlists > Lists > SHARED WITH ME
  // group covers discovery; per-list Share button covers send).
  // `references` keeps its internal key for backward compat; the UI
  // label is now "Collection" (was "Learn").
  // 2026-05-14: "watchbox" — formerly the Watchlists > My Watches
  // sub-tab — promoted out of the sub-tab strip into its own top-level
  // tab. There's no pill in the main nav; the avatar dropdown is the
  // entry point (Mark spec, eBay analogy: "kind of like my ebay"). The
  // URL key `?tab=watchbox` is canonical; legacy `?tab=watchlist&sub=my-collection`
  // redirects to it on init.
  const TAB_VALUES = ["home", "listings", "watchlist", "watchbox", "references", "admin"];
  // URL-key translation. Stale `share` URLs route to Watchlists >
  // Lists (where the Shared with me group lives now). `learn` also
  // still routes to references for back-compat. `mywatches` is a
  // short-link alias for Watchbox so external shares can be terse.
  const URL_TAB_TO_INTERNAL = { saved: "watchlist", learn: "references", collections: "watchlist", share: "watchlist", mywatches: "watchbox" };
  const INTERNAL_TAB_TO_URL = { watchlist: "saved", references: "learn" };
  const [tab, setTab] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab");
      const sub = params.get("sub");
      // Legacy redirect: ?tab=watchlist&sub=my-collection points at
      // the old sub-tab home for My Watches. Now lands on Watchbox.
      if (t === "watchlist" && sub === "my-collection") return "watchbox";
      // Legacy redirect (PR 2026-05-22): ?tab=watchlist&sub=challenges
      // points at the old Watchlists location for Challenges. Now
      // lands on Collecting > Challenges (?tab=references&sub=challenges
      // — referencesSubTab init below catches the same param).
      if (t === "watchlist" && sub === "challenges") return "references";
      // External → internal redirect: ?tab=saved / ?tab=learn /
      // ?tab=collections (legacy) all map to internal values.
      if (URL_TAB_TO_INTERNAL[t]) return URL_TAB_TO_INTERNAL[t];
      if (TAB_VALUES.includes(t)) return t;
      // `?view=watches` predates the promotion of the magazine Watches page
      // (2026-10-16), when it was a parallel page. Kept so existing links and
      // bookmarks still land on the Watches tab rather than Home.
      if (params.get("view") === "watches") return "listings";
    }
    // Default cold landing: home (2026-05-11). Was "listings" before
    // the editorial Home reached parity. Existing `?tab=listings`
    // bookmarks still resolve via the matcher above.
    return "home";
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
  // One-bit mirror of CollectionsTab's drill-in state. CollectionsTab
  // still owns selectedListId / URL push; this just exposes "are we
  // drilled into a list?" up to App.js so the shell can render the
  // filter row when drilled in (mirroring the Listings tab). The
  // setter is threaded down to CollectionsTab via shellProps below.
  // (Hoisted above savedItemsSnapshot 2026-05-09 — that effect's deps
  // reference colDrillInId; const declarations execute top-to-bottom
  // so referencing a later const in a useEffect deps array TDZs.)
  const [colDrillInId, setColDrillInId] = useState(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("col") || null;
  });

  const [savedItemsSnapshot, setSavedItemsSnapshot] = useState({});
  useEffect(() => {
    // Snapshot capture fires on ANY view that displays hearted items
    // as the primary content: legacy hearted sub-tabs (listings/
    // auctions/sold) AND the Saved virtual list inside Watchlists >
    // Lists drilled into `__saved__`. Both surfaces want the same
    // "un-heart leaves the card visible until refresh" UX so a
    // misclick is reversible. (Mark report 2026-05-09 — un-hearting
    // on the Saved virtual list immediately removed the card.)
    const onLegacyHeartedSubs = tab === "watchlist" &&
      (watchTopTab === "listings" || watchTopTab === "auctions" || watchTopTab === "sold");
    const onSavedVirtual = tab === "watchlist" &&
      watchTopTab === "lists" && colDrillInId === "__saved__";
    const onSavedView = onLegacyHeartedSubs || onSavedVirtual;
    if (onSavedView) {
      setSavedItemsSnapshot({ ...watchlist });
    } else if (Object.keys(savedItemsSnapshot).length > 0) {
      setSavedItemsSnapshot({});
    }
  }, [tab, watchTopTab, colDrillInId]);

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
    // learn) for the watchlist / references internal values.
    // Default cold landing flipped from listings → home 2026-05-11;
    // home is now the value that stays stripped from the URL. Any
    // other tab writes its key.
    if (tab === "home") params.delete("tab");
    else params.set("tab", INTERNAL_TAB_TO_URL[tab] || tab);
    if (tab === "listings" && listingsSubTab !== "live") {
      params.set("sub", listingsSubTab);
    } else if (tab === "watchlist" && watchTopTab !== "hearted") {
      params.set("sub", watchTopTab);
    } else if (tab === "references" && referencesSubTab !== "editorial") {
      params.set("sub", referencesSubTab);
    } else {
      params.delete("sub");
    }
    // `col` is the drill-in id for the Lists sub-tab. Only the "lists"
    // sub-tab owns a drill-in; CollectionsTab pushes `col` when the user
    // drills in, App.js strips it on every other tab/sub-tab.
    if (tab !== "watchlist" || watchTopTab !== "lists") {
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
        // Lists is sub-tabbed again (2026-06-01): restore the sub-tab
        // from ?sub, defaulting to the Hearted landing.
        setWatchTopTab(SUB_VALUES.includes(sub) ? sub : "hearted");
      } else if (nextTab === "references") {
        setReferencesSubTab(REFERENCES_SUB_VALUES.includes(sub) ? sub : "editorial");
      }
      // Lists drill-in (`?col=…`) is owned by CollectionsTab —
      // it has its own popstate handler / URL-derived effect.
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // TAB_VALUES / SUB_VALUES / LISTINGS_SUB_VALUES are module-level
    // const arrays so they're stable references across renders.
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
  // First-visit AUTO-open of the AboutModal retired 2026-06-03 (Mark):
  // a modal in a new visitor's face before they've seen the product was
  // the wrong welcome — users click About to read it. Manual opens stay
  // (top-nav About on both shells, account menu, Settings). The
  // dial_visited_v1 localStorage key is left orphaned, not reused.
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
  // Home-only hide set (admin curation, localStorage). The × overlay
  // on Home cards writes here; the rest of the site reads through
  // hidden / adminHidden and is unaffected. See useHomeHidden for
  // the rationale.
  // homeHidden still filters items previously hidden-from-home; the home "×"
  // toggle was retired 2026-06-01 (Mark) — admin Hide is the single tool now.
  const { ids: homeHidden } = useHomeHidden();
  // Recent-search history for the Home search bar. MRU-first array
  // of up to 6 strings, persisted in localStorage. addRecent fires
  // on Enter / target-pick / chip-tap from the dropdown.
  const { recent: homeRecentSearches, add: homeAddRecentSearch, remove: homeRemoveRecentSearch } = useRecentSearches();
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
  // The shared item the floating Lumé launcher should open SEEDED with (set by
  // ShareReceiver while a share surface is up; null otherwise). 2026-06-01.
  const [lumeSeedItem, setLumeSeedItem] = useState(null);
  // Same one-bit mirror for Watch Challenges receive flow (v1.5).
  // Either of these flips the shell into "focused landing surface"
  // mode (regular browse chrome hidden).
  const [challengeShareActive, setChallengeShareActive] = useState(false);
  // List-share receive flow (List Sharing v1, 2026-05-07). Same
  // pattern — one-bit mirror; the ListReceiver component owns its
  // own intent state.
  const [listShareActive, setListShareActive] = useState(false);
  const [catalogShareActive, setCatalogShareActive] = useState(false);
  // Auction calendar modal (Phase 4 slice 2). The calendar is no longer
  // a sub-tab — it opens as an overlay over the auctions grid and filters
  // it on sale pick.
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  // "Calendar first" (Mark spec): on DESKTOP the calendar pops up the first
  // time you land on the Auctions sub-tab each session — the visual entry —
  // then you drop into the grid. Once per session (sessionStorage), and
  // skipped when a sale filter is already pinned (deep-linked to a sale).
  // Mobile (Mark 2026-05-28): no auto-popup — it felt intrusive on a small
  // screen; mobile users open the calendar via the filter-row button instead.
  useEffect(() => {
    if (tab !== "listings" || listingsSubTab !== "auctions") return;
    if (isMobile) return;
    if ((filterSaleUrls || []).length > 0) return;
    try {
      if (sessionStorage.getItem("auctions_calendar_autoopened_v1")) return;
      sessionStorage.setItem("auctions_calendar_autoopened_v1", "1");
    } catch { return; }
    setCalendarModalOpen(true);
  }, [tab, listingsSubTab, filterSaleUrls, isMobile]);
  // Esc closes the calendar modal (Mark 2026-05-28) — mirrors the
  // backdrop click. Listener only mounts while the modal is open.
  useEffect(() => {
    if (!calendarModalOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setCalendarModalOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [calendarModalOpen]);
  // Feed-screening retired 2026-05-22 — the Home banner + per-strip
  // "Screen N new" pill that fed it were removed (PRs #283 / #507);
  // nothing renders openFeedScreener anymore. Audit confirmed the
  // entry-point is dead, so the feedScreenerOpen state, feedScreenerItems
  // memo, lastVisit hook, and `mode="feed"` branch in ListReviewMode
  // all went out together. Re-enable by re-introducing one of:
  //   (a) Collecting > Screening "New since last visit" pool card
  //   (b) banner above Home strips
  // Both would re-read `dial_last_visit_ts` (or a new key).
  // PR_W (2026-05-22): "Search all" destination. When true, shells
  // render <SearchResultsView/> in place of the regular tab content.
  // Clearing search or tab nav unsets it (see effects below).
  const [searchAllActive, setSearchAllActive] = useState(false);
  // Live-query state for the Home search bar. Drives the per-target
  // count chips in the dropdown AND opens the Search-all strip view
  // when 2+ chars are typed. Separate from `search` so deleting back
  // to empty on Home doesn't leak a stale query into other surfaces.
  const [homeLiveQuery, setHomeLiveQuery] = useState("");
  // Lazy article corpus loader (PR_φ2 2026-05-22). Fires the first
  // time the user opens Search-all. Each source's meta JSON is
  // ~50–200 KB; fetching all in parallel takes ~1-2s on a fast
  // connection. Results are concatenated with a `_source` marker
  // so the strip can show attribution. Bodies are NOT loaded —
  // search-all only needs title/brand/ref/image for the strip.
  useEffect(() => {
    if (!searchAllActive || searchAllArticlesLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const fetched = await Promise.all(
          EDITORIAL_SOURCE_URLS.map(async (url) => {
            try {
              // fetchJsonCached: shared with EditorialView + the Home strip
              // (PageSpeed 2026-06-06 — corpus was downloaded twice).
              const data = await fetchJsonCached(url);
              // Strip the source key from the URL path for a label.
              const key = url.replace(/^\//, "").replace(/\.json$/, "");
              // B-09 (2026-05-24): meta files are dict-keyed (url → record)
              // per the editorial_corpus_io split — the SAME shape
              // EditorialView reads via Object.values. Search-all previously
              // assumed arrays and `Array.isArray` → [] discarded EVERY
              // source, so Search-all returned zero articles for any query
              // (e.g. "5513" matched nothing). Parse both shapes, filtering
              // to real records (url + title) like EditorialView does.
              const records = Array.isArray(data) ? data : Object.values(data || {});
              return records
                .filter(rec => rec && rec.url && rec.title)
                .map(a => ({ ...a, _source: { key, label: sourceLabel(key) } }));
            } catch (e) {
              console.warn("editorial fetch failed", url, e);
              return [];
            }
          })
        );
        if (cancelled) return;
        const all = fetched.flat();
        setSearchAllArticles(all);
        setSearchAllArticlesLoaded(true);
      } catch (e) {
        console.warn("editorial corpus aggregate fetch failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [searchAllActive, searchAllArticlesLoaded]);

  // Home "Articles" strip (B-32, 2026-05-27) — idle-load the editorial META
  // (recent 12 by date) so it doesn't touch first paint (B-17 pattern). Reuses
  // EDITORIAL_SOURCE_URLS; meta only (no bodies). Falls back to setTimeout.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const fetched = await Promise.all(
          EDITORIAL_SOURCE_URLS.map(async (url) => {
            try {
              // fetchJsonCached — see search-all loader note.
              const data = await fetchJsonCached(url);
              const key = url.replace(/^\//, "").replace(/\.json$/, "");
              const records = Array.isArray(data) ? data : Object.values(data || {});
              return records
                .filter((rec) => rec && rec.url && rec.title)
                .map((a) => ({ ...a, _source: { key, label: sourceLabel(key) } }));
            } catch { return []; }
          })
        );
        if (cancelled) return;
        const all = fetched.flat()
          .sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""))
          .slice(0, 12);
        setHomeArticles(all);
      } catch (e) { console.warn("home articles fetch failed", e); }
    };
    const ric = window.requestIdleCallback;
    const id = ric ? ric(load, { timeout: 2500 }) : setTimeout(load, 1400);
    return () => {
      cancelled = true;
      if (ric && window.cancelIdleCallback) window.cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, []);

  // Article-body lazy load — fires on the first non-trivial Search-all
  // query (length >= 2). Bodies are heavy (~14 MB across sources) so
  // we defer until the user actually types. Once loaded, they stay
  // in memory for the session; subsequent searches use cached map.
  // SearchResultsView reads from `searchAllArticleBodies` and merges
  // body_text into the article match haystack.
  useEffect(() => {
    if (!searchAllActive || searchAllBodiesLoaded) return;
    const q = (search || "").trim();
    if (q.length < 2) return;
    let cancelled = false;
    (async () => {
      try {
        const fetched = await Promise.all(
          EDITORIAL_BODY_URLS.map(async (url) => {
            try {
              // fetchJsonCached — shared with EditorialView's bodies loader.
              return await fetchJsonCached(url);
            } catch (e) {
              console.warn("editorial bodies fetch failed", url, e);
              return null;
            }
          })
        );
        if (cancelled) return;
        const merged = {};
        for (const obj of fetched) {
          if (obj && typeof obj === "object") Object.assign(merged, obj);
        }
        setSearchAllArticleBodies(merged);
        setSearchAllBodiesLoaded(true);
      } catch (e) {
        console.warn("editorial bodies aggregate fetch failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [searchAllActive, searchAllBodiesLoaded, search]);
  // Tracks the URL of the auction whose "Add to list" / "Review"
  // (colDrillInId state moved up earlier in the file — needed by the
  // savedItemsSnapshot effect which depends on it.)
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
  // After creating a list, drill straight into it (Mark 2026-06-01 — "land in
  // the new list ready to add"). CollectionsTab → ListsView reads this and
  // sets its drill-in, then clears it. Mirrors pendingChallengeDrillId.
  const [pendingOpenListId, setPendingOpenListId] = useState(null);

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
    setCatalogShareActive(false);
    // PR_W (2026-05-22): tab change exits the cross-tab Search-all
    // destination so the destination tab renders its normal content.
    setSearchAllActive(false);
    setShareReceiveResetTick((n) => n + 1);
    if (newTab === tab) {
      // Already on this tab — bump the reset counter so child
      // components can return to their landing without changing tab.
      setTabResetTick((n) => n + 1);
      return;
    }
    // Reset the destination tab's sub-tab to its first entry
    // (Mark feedback 2026-05-16: "when you click on a tab it
    // should load the first subtab"). Previously the sub-tab
    // restored from localStorage, so a user who'd last visited
    // Watchlists > Searches would land back on Searches when
    // tapping Watchlists from another tab. Now lands on Lists.
    // On cross-main-tab navigation, reset the destination tab's sub-tab to its first value — do NOT restore from localStorage (Mark spec: clicking a tab loads the first sub-tab).
    if (newTab === "listings") setListingsSubTab("live");
    else if (newTab === "watchlist") setWatchTopTab("hearted");
    // `references` is NOT reset here (2026-06-03 IA): Articles and Reference
    // Guides are two top pills over the same internal container, so the
    // caller (selectTopTab / menu tools / challenge receive) sets the sub
    // explicitly BEFORE switching — a forced "editorial" here would clobber it.
    // Returning to Auctions later should start from the base page, not the
    // catalog you'd drilled into — clear the sale filter on tab nav (Mark).
    setFilterSaleUrls([]);
    setTab(newTab);
  };

  // Top-pill click handler (2026-06-03 IA: Watches · Saved · Articles ·
  // Reference Guides). Articles + Reference Guides both live in the internal
  // `references` container, so selecting either sets the sub FIRST, then
  // routes through setTabWithReceiveEscape (same-tab clicks still bump
  // tabResetTick for drill-in reset). Plain function, not useCallback —
  // see the note on setTabWithReceiveEscape above.
  const selectTopTab = (entry) => {
    const dest = entry.tab || entry.key;
    if (entry.key === "listings") setSearch("");
    if (entry.sub) setReferencesSubTab(entry.sub);
    setTabWithReceiveEscape(dest);
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
  // Saved auctions (Phase 3) — hearted SALES (by auction_url). Drives
  // the calendar heart + Hearted chip and the Watchlists section.
  const { urls: savedAuctionUrls, toggle: toggleSavedAuction } = useSavedAuctions(user);
  const savedAuctionUrlSet = useMemo(() => new Set(savedAuctionUrls), [savedAuctionUrls]);

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
  const { displayName, setDisplayName } = useUserProfile(user);
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
        // Sender attribution (Mark spec 2026-05-21): append the
        // signed-in user's display name as `?from=<name>` so the
        // recipient surface can render "Mark Mutter sent you..."
        // instead of the generic "Someone sent you...". Mirrors the
        // ChallengeFlow.shareChallengeSpec pattern (see CLAUDE.md
        // "Sender attribution on shared challenges"). Derived from
        // user_metadata.full_name → name → email local-part with
        // each segment capitalised. Falls through silently when no
        // user (anonymous share — keeps the generic copy).
        const md = user && user.user_metadata;
        let senderName = "";
        if (md) {
          senderName = (md.full_name || md.name || "").trim();
        }
        if (!senderName && user && user.email) {
          const local = String(user.email).split("@")[0] || "";
          senderName = local.split(/[._-]+/)
            .filter(Boolean)
            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
            .join(" ");
        }
        if (senderName) {
          url.searchParams.set("from", senderName);
        }
        // Per-type preview metadata (P-17/P-25, 2026-06-03): guides + most
        // articles aren't in the JSON api/share.js can read, so the link
        // carries title/image/kind for the OG card. Guides are detected
        // server-side by their ref_ id prefix; k marks articles.
        if (input.kind === "article" || input.kind === "reference") {
          if (input.kind === "article") url.searchParams.set("k", "article");
          if (input.title) url.searchParams.set("t", String(input.title).slice(0, 120));
          if (input.img) url.searchParams.set("img", String(input.img));
        }
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
  // Lumé save_note: the note text awaiting a list choice (null = picker closed).
  const [notePickerText, setNotePickerText] = useState(null);

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
    // Load listings.json + manual_historical_listings.json in parallel
    // and merge before populating items. Manual historical entries
    // append to the live listings feed (deduped by id) so curated
    // historical sold listings appear in Listings > Archive (Sold)
    // for everyone. (2026-05-09 — Mark request to surface his
    // spreadsheet's URLs in the public sold archive.)
    Promise.all([
      fetch(LISTINGS_LIVE_URL, fetchOpts).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(MANUAL_HISTORICAL_LISTINGS_URL, fetchOpts).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
    ])
      .then(([live, manual]) => {
        const seen = new Set((live || []).map(i => i.id));
        const extras = ((manual && manual.items) || []).filter(i => i && i.id && !seen.has(i.id));
        setItems([...(live || []), ...extras]);
        setLoading(false);
        // Sold half — lazy after first paint (PR: live/sold split). The
        // Feed and every live-only view render off the eager `live` set;
        // the Sold/Archive sub-tabs and watchlist sold-detection (a
        // hearted dealer item missing from the live set already resolves
        // to "sold") tolerate the sold array arriving a beat late. Append,
        // deduping against ids already present (live + manual extras) so a
        // manual historical entry overlapping a scraped sold lot — rare by
        // design — isn't doubled. Silent no-op on failure.
        fetch(LISTINGS_SOLD_URL, fetchOpts)
          .then(r => r.ok ? r.json() : [])
          .then(sold => {
            if (!Array.isArray(sold) || sold.length === 0) return;
            setItems(prev => {
              const have = new Set(prev.map(i => i.id));
              const add = sold.filter(i => i && i.id && !have.has(i.id));
              return add.length ? [...prev, ...add] : prev;
            });
          })
          .catch(() => {});
        // listings_desc.json (descriptions, ~0.9 MB) moved to the deferred
        // idle block below — it only feeds the hearted-item detail sheet
        // (see handleWish), never first paint, so it shouldn't ride along
        // with the critical listings fetch on every load.
      })
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
    // Heavy, non-critical payloads (~15 MB combined): auction-lot + editorial
    // sold-archive sources that feed ONLY the Auctions tab and the Sold-archive
    // projection — never the default Listings>Live first paint. Defer them past
    // first paint so ~15 MB of fetch+parse stops competing with the critical
    // render on mobile. Each populates a beat late exactly like listings_sold
    // above; every consumer starts from an empty {} and re-renders on arrival.
    // (B-17 / audit finding C1: ~19 MB was loading eagerly on every app open.)
    const loadDeferredArchives = () => {
      // Descriptions sidecar — only consumed by the hearted-item detail
      // sheet (handleWish), so it loads here at idle rather than competing
      // with the critical listings fetch on every page open.
      fetch(LISTINGS_DESC_URL, fetchOpts)
        .then(r => r.ok ? r.json() : {})
        .then(map => { if (map && typeof map === "object") setListingsDesc(map); })
        .catch(() => {});
      // Comprehensive auction-lot scrape — same shape as tracked_lots.json,
      // populated by a separate scraper that walks every active sale.
      fetch(AUCTION_LOTS_URL, fetchOpts)
        .then(r => r.ok ? r.json() : {})
        .then(d => setAuctionLotsState(d && typeof d === "object" ? d : {}))
        .catch(() => {});
      // Manual archive lots — Phase D historical-auction surface. Same shape
      // as auction_lots.json, merged into the same projection below.
      fetch(MANUAL_ARCHIVE_LOTS_URL, fetchOpts)
        .then(r => r.ok ? r.json() : {})
        .then(d => setManualArchiveLotsState(d && typeof d === "object" ? d : {}))
        .catch(() => {});
      // Bonhams auction lots — residential-scraped (B-24/B-25), same shape
      // as auction_lots.json, merged into the same projection below.
      fetch(BONHAMS_LOTS_URL, fetchOpts)
        .then(r => r.ok ? r.json() : {})
        .then(d => setBonhamsLotsState(d && typeof d === "object" ? d : {}))
        .catch(() => {});
      // Chrono24 per-reference listings — residential-scraped, listing-shaped
      // projection below; folded into the main feed + reference filter.
      fetch(CHRONO24_LOTS_URL, fetchOpts)
        .then(r => r.ok ? r.json() : {})
        .then(d => setChrono24LotsState(d && typeof d === "object" ? d : {}))
        .catch(() => {});
      // Loupe This auction lots — independent scraper, same shape.
      fetch(LOUPETHIS_LOTS_URL, fetchOpts)
        .then(r => r.ok ? r.json() : {})
        .then(d => setLoupethisLotsState(d && typeof d === "object" ? d : {}))
        .catch(() => {});
      // Hairspring Finds — editorial corpus w/ sold-archive metadata, projected
      // into Listings > All sold (hairspring_finds_scraper.py, URL-keyed dict).
      fetch(HAIRSPRING_FINDS_URL, fetchOpts)
        .then(r => r.ok ? r.json() : {})
        .then(d => setHairspringFindsState(d && typeof d === "object" ? d : {}))
        .catch(() => {});
      // Hodinkee Shop archive (frozen Feb 2023, ~2,346 sold products). Dual-track
      // like Hairspring Finds; the Editorial sub-tab also loads it lazily on its
      // own, but loading here lets the Sold-archive projection see the records.
      fetch(HODINKEE_SHOP_URL, fetchOpts)
        .then(r => r.ok ? r.json() : {})
        .then(d => setHodinkeeShopState(d && typeof d === "object" ? d : {}))
        .catch(() => {});
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      // timeout: load within 2s even if the main thread never goes idle, so a
      // user who opens Auctions/Sold right away still gets data promptly.
      window.requestIdleCallback(loadDeferredArchives, { timeout: 2000 });
    } else {
      setTimeout(loadDeferredArchives, 1200);
    }
  }, []);

  const c = dark ? {
    "--bg": "#000", "--surface": "#1c1c1e", "--card-bg": "#2c2c2e",
    "--border": "rgba(255,255,255,0.1)", "--text1": "#f5f5f7",
    "--text2": "#98989d", "--text3": "#48484a",
    "--brand": "#185FA5", "--danger": "#c0392b", "--accent-positive": "#1b8f3a",
    // Brand olive — the favicon hourglass background. Used as the
    // identity band tone for Listings + Watchlists (PR_Y1, Mark
    // feedback 2026-05-21: the bright --accent-positive green didn't
    // match the favicon).
    // Dark mode tones it down a notch (#3b4a36 → #2a3527) per Mark
    // feedback 2026-05-22: "the black is working great — would say
    // maybe all black or darker green." Darker olive reads as a
    // subtle brand thread against the black page bg instead of the
    // brighter light-mode olive that competed for attention.
    "--brand-olive": "#2a3527",
    // Text-on-bg variant — Mark spec 2026-05-22: "on landing page
    // in darkmode keep the wordmark green the same" — same full
    // olive in dark mode as light mode. Lower contrast on black
    // is intentional; reads as a subtle/muted editorial hero.
    "--brand-olive-text": "#3b4a36",
    // Readable olive INK for small chrome (filter-pill text/borders,
    // clear/dismiss controls). --brand-olive itself is dark in BOTH
    // themes (hero-wordmark contrast), so it's invisible on #000 — dark
    // mode needs the lighter sage here. Pairs with --brand-olive-tint-12
    // as the active-pill fill.
    "--brand-olive-ink": "#a8b3a0",
    // Disc-tint variant (translucent olive) for icon discs + chips
    // in the Watchlists family. Dark mode uses the lighter sage at
    // higher opacity so it reads against #000.
    "--brand-olive-tint-12": "rgba(168,179,160,0.18)",
    // Brand-tint surfaces (subtle fills behind icons, chips, hover
    // states) and the gold accent used for status / warning hints
    // (Plan view over-budget, admin "earning its keep" chip, etc.).
    // Promoted from inline literals 2026-05-10 maintenance pass.
    "--brand-tint-08": "rgba(24,95,165,0.08)",
    "--brand-tint-10": "rgba(24,95,165,0.10)",
    "--brand-tint-12": "rgba(24,95,165,0.12)",
    "--accent-warn": "#c9a227",
    "--accent-warn-tint-10": "rgba(201,162,39,0.10)",
    // Danger tint + dark-text variant — UserLimitBanner hard-cap state.
    "--danger-tint-10": "rgba(192,57,43,0.10)",
    "--danger-text": "#7d1f17",
    // Heart accent — intentionally NOT --brand. The screener heart +
    // "Hearted" tally read as the action, not as primary brand UI.
    "--heart": "#d92626",
    // Modal / floating-surface shadow. Repeated verbatim across
    // ShareReceiver / ChallengeReceiver / ChallengeFlow before this
    // token landed.
    "--shadow-modal": "0 2px 6px rgba(0,0,0,0.10), 0 16px 40px rgba(0,0,0,0.12)",
    // On-dark text + surface — used inside the HomeTab inverted hero
    // band, which is dark regardless of theme. Three opacity steps
    // mirror the --text1/2/3 hierarchy on the light path.
    "--text-on-dark-1": "rgba(255,255,255,0.78)",
    "--text-on-dark-2": "rgba(255,255,255,0.62)",
    "--text-on-dark-3": "rgba(255,255,255,0.40)",
    "--surface-on-dark": "rgba(255,255,255,0.10)",
  } : {
    "--bg": "#fff", "--surface": "#f5f5f7", "--card-bg": "#fff",
    "--border": "rgba(0,0,0,0.09)", "--text1": "#1d1d1f",
    "--text2": "#6e6e73", "--text3": "#aeaeb2",
    "--brand": "#185FA5", "--danger": "#c0392b", "--accent-positive": "#1b8f3a",
    // Brand olive — the favicon hourglass background. Used as the
    // identity band tone for Listings + Watchlists (PR_Y1, Mark
    // feedback 2026-05-21: the bright --accent-positive green didn't
    // match the favicon).
    "--brand-olive": "#3b4a36",
    // Text-on-bg variant — light mode uses the full olive directly.
    "--brand-olive-text": "#3b4a36",
    // Readable olive ink for small chrome — light mode uses the full
    // olive (good contrast on the light tint / page). See dark block.
    "--brand-olive-ink": "#3b4a36",
    // Disc-tint variant for olive icon discs + chips (Watchlists).
    "--brand-olive-tint-12": "rgba(59,74,54,0.12)",
    "--brand-tint-08": "rgba(24,95,165,0.08)",
    "--brand-tint-10": "rgba(24,95,165,0.10)",
    "--brand-tint-12": "rgba(24,95,165,0.12)",
    "--accent-warn": "#c9a227",
    "--accent-warn-tint-10": "rgba(201,162,39,0.10)",
    "--danger-tint-10": "rgba(192,57,43,0.10)",
    "--danger-text": "#7d1f17",
    "--heart": "#d92626",
    "--shadow-modal": "0 2px 6px rgba(0,0,0,0.10), 0 16px 40px rgba(0,0,0,0.12)",
    "--text-on-dark-1": "rgba(255,255,255,0.78)",
    "--text-on-dark-2": "rgba(255,255,255,0.62)",
    "--text-on-dark-3": "rgba(255,255,255,0.40)",
    "--surface-on-dark": "rgba(255,255,255,0.10)",
  };

  // Mirror the theme variables onto :root so portal-rendered nodes
  // (the Card ⋯ menu, future toasts) inherit them too. `baseStyle`
  // below also keeps them on the App root for back-compat with any
  // CSS that scopes off the App container, but the :root copy is
  // what makes `var(--bg)` resolve outside of App's subtree —
  // critical for the menu portal (Mark report 2026-05-10: menu
  // text rendered with no background because the portal sat under
  // <body> and var(--bg) was undefined there).
  // Theme CSS vars are mirrored to document.documentElement (:root), not just the App root, so portal-rendered nodes (Card ⋯ menu, overlays) inherit them. Keep the :root mirror.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    for (const [k, v] of Object.entries(c)) root.style.setProperty(k, v);
  }, [c]);

  // The browser tint (theme-color + <html> background) is rendered by
  // <ChromeTint /> in the returns below — see src/chromeTint.js. It used to be
  // an effect HERE keyed on `tab`, which had to know nothing about the
  // surfaces that decide the page's top colour (the magazine Watches page,
  // `?look=new`, the catalog takeover) because those are derived after the
  // early returns. A child component mounted unconditionally can read them.

  // Measure the sticky chrome height + set `--sticky-top` CSS variable
  // so DateDivider can lock just below the chrome instead of hiding
  // behind it (mobile chrome is `position: sticky; top: 0; z-index: 20`
  // — a divider with `top: 0` would render under it).
  //
  // Desktop has no sticky chrome → the selector misses, value stays 0,
  // dividers lock at viewport top naturally. The ResizeObserver re-fires
  // when chrome content changes (sub-tab switch, share/search-receive
  // toggles, viewport resize). Kept ABOVE the loading/loadError early
  // returns below so the hook count stays stable across the
  // loading→ready transition (see Things-to-never-do in CLAUDE.md).
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const measure = () => {
      const chrome = document.querySelector('[data-sticky-chrome]');
      const h = chrome ? Math.round(chrome.getBoundingClientRect().height) : 0;
      document.documentElement.style.setProperty('--sticky-top', `${h}px`);
    };
    measure();
    const chrome = document.querySelector('[data-sticky-chrome]');
    let ro;
    if (chrome && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(chrome);
    }
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      if (ro) ro.disconnect();
    };
  }, [tab, shareActive, challengeShareActive, listShareActive, catalogShareActive, searchAllActive]);

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
      ...(bonhamsLotsState || {}),
      ...(trackedLotsState || {}),
      ...(auctionLotsState || {}),
      ...(loupethisLotsState || {}),
    };
    for (const url of Object.keys(merged)) {
      const data = merged[url];
      if (!data) continue;
      // Trust the scraper's `status:"ended"` flag UNLESS the timing
      // says the auction can't possibly have ended AND the scraper
      // hasn't observed a realised sold price. Mark report 2026-05-09:
      // EU auctions whose date was today but start time hadn't been
      // reached got pinned to Archive Sold (Sotheby's auctionState
      // returns "closed" on some multi-stage sales before the live
      // session). Both checks needed because date-only auction_end
      // strings ('2026-05-09') resolve to 00:00 UTC and would falsely
      // pass the "end is in the past" gate later in the same day.
      //
      // Mark report 2026-05-10: Phillips multi-session auctions split
      // the catalog across two days. Lots that sold in session 1 had
      // status:"ended" + sold_price set, but the auction-level
      // auction_end is still in the future (session 2). The override
      // was force-resetting the per-lot ended state. Fix: only treat
      // a future auction_end as "still active" when sold_price is
      // null (i.e. the scraper hasn't seen the actual sale yet). A
      // realised sold_price is the strongest signal — trust it over
      // the calendar-level end date.
      const hasRealisedSale = data.sold_price != null && data.sold_price > 0;
      // Mark report 2026-05-11: sold session-1 lots in multi-session
      // auctions (Phillips, Sotheby's) carry `status:"active"` because
      // the parent auction's calendar end is still in the future
      // (session 2 hasn't run). They have a realised sold_price but
      // were never being flipped to ended, so they showed up in Live
      // auctions with a current_bid forever. A realised sold_price is
      // an unambiguous signal — count it as ended regardless of what
      // status or auction_end say.
      let isEnded = data.status === "ended" || hasRealisedSale;
      if (isEnded && !hasRealisedSale && data.auction_start) {
        const startMs = new Date(data.auction_start).getTime();
        if (Number.isFinite(startMs) && startMs > Date.now()) {
          isEnded = false;
        }
      }
      if (isEnded && !hasRealisedSale && data.auction_end) {
        const endMs = new Date(data.auction_end).getTime();
        if (Number.isFinite(endMs) && endMs > Date.now()) {
          isEnded = false;
        }
      }
      // 2026-05-09 — reverse-direction override. If the scraper
      // hasn't re-run since the auction ended (daily 06:00 cron
      // misses an EU-evening auction), mark the lot as sold so it
      // moves to Archive Sold when the user expects.
      //
      // Mark report 2026-05-21: lots from sales that ended 12 days
      // ago were still showing in Live auctions because their
      // `auction_end` is a date-only string ("2026-05-09" → 00:00
      // UTC), and the old gate "only flip when time-of-day is set"
      // never fired on those. The original time-of-day check was
      // there to avoid false-positives on TODAY's date (a date-only
      // string for today reads as 00:00 UTC and so looks past mid-
      // morning UTC even though the live session hasn't run yet).
      // Updated rule: keep the same-day safeguard (don't flip when
      // auction_end is within the last 24h AND has no time-of-day),
      // but anything older than 24h past is treated as ended.
      if (!isEnded && data.auction_end) {
        const endMs = new Date(data.auction_end).getTime();
        const now = Date.now();
        if (Number.isFinite(endMs) && endMs < now) {
          const d = new Date(endMs);
          const hasTimeOfDay = d.getUTCHours() !== 0
                            || d.getUTCMinutes() !== 0
                            || d.getUTCSeconds() !== 0;
          const moreThanADayPast = (now - endMs) > 24 * 3600 * 1000;
          if (hasTimeOfDay || moreThanADayPast) isEnded = true;
        }
      }
      // Mark report 2026-05-15 (Loupe This): when the reverse-direction
      // override above flips a lot to ended (auction_end has passed but
      // the next scrape hasn't run yet), sold_price is still null —
      // and Loupe This carries no estimates or starting prices, so the
      // chain bottomed out at 0 and rendered "USD 0" on freshly-closed
      // lots. Fall back to current_bid (the last known bid before close)
      // until the next scrape pass picks up the realised hammer.
      const price = (isEnded ? (data.sold_price || data.current_bid) : data.current_bid)
        || data.starting_price || data.estimate_low || 0;
      const priceUsd = (isEnded ? (data.sold_price_usd || data.current_bid_usd) : data.current_bid_usd)
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
        // Parent-auction URL — used to scope the auction-catalog
        // screener / Add to list / Review actions to lots that
        // belong to the same sale. Mark report 2026-05-14: was
        // missing from the projection, so the filter never matched
        // and Review catalog silently mounted on an empty queue.
        auction_url: data.auction_url,
        lot_number: data.lot_number,
        // For sold session-1 lots with a future auction_end, scraped_at
        // is the closer-to-truth sale date — using auction_end would
        // put them in a future date bucket. Prefer auction_end when
        // it's actually in the past (the normal case).
        soldAt: isEnded
          ? (() => {
              const end = data.auction_end ? new Date(data.auction_end).getTime() : 0;
              const endInPast = end > 0 && end <= Date.now();
              return endInPast ? data.auction_end : (data.scraped_at || data.auction_end || "");
            })()
          : null,
      });
    }
    return arr;
  }, [trackedLotsState, auctionLotsState, manualArchiveLotsState, bonhamsLotsState, loupethisLotsState]);

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
  // Hairspring Finds → listing-shaped projection. Every record in
  // hairspring_finds.json was a watch Hairspring sold, so sold:true
  // is unconditional; soldAt comes from the article's published_at
  // (best proxy for sale date — the article lands within days of
  // the watch leaving inventory). Source = "Hairspring (Finds)"
  // so it pools as its own filter chip distinct from any future
  // hairspring dealer-listing source we might add. The body_text
  // (Erik Gustafson's prose) goes into the desc field so it shows
  // on the card and feeds the reference corpus downstream.
  const hairspringFindsItems = useMemo(() => {
    const arr = [];
    const records = hairspringFindsState || {};
    for (const url of Object.keys(records)) {
      const data = records[url];
      if (!data) continue;
      const price = Number(data.sold_price_usd) || 0;
      arr.push({
        id: shortHash(url),
        brand: (data.brand || "").trim() || "Other",
        ref: data.title || "—",
        price,
        currency: data.currency || "USD",
        priceUSD: price,
        savedPrice: price,
        savedCurrency: data.currency || "USD",
        savedPriceUSD: price,
        source: "Hairspring (Finds)",
        url,
        img: data.image || "",
        sold: true,
        _isSold: true,
        // Reference-index match results (resolved at scrape time).
        // Surfaces here so downstream consumers — per-reference page,
        // matcher hit-rate counters — see the structured shape.
        reference_no: data.reference_no || null,
        model: data.model || null,
        sub_model: data.sub_model || null,
        model_line: data.model_line || null,
        // soldAt from published_at — the article lands within days
        // of the sale so it's a tight proxy. Used by the date sort
        // and the date-divider headers in Listings > All sold.
        soldAt: data.published_at || data.updated_at || "",
        firstSeen: data.published_at || data.updated_at || "",
        // Erik's prose. PR #353 split body_text out into the
        // lazy-loaded bodies file; the meta record carries `excerpt`
        // (~240-char teaser computed at scrape time) which is what
        // the Card render reads. Falls back to body_text for any
        // legacy single-file records that haven't been migrated.
        desc: (data.excerpt || data.body_text || "").slice(0, 1500),
      });
    }
    return arr;
  }, [hairspringFindsState]);

  // Hodinkee Shop archive → listing-shaped projection. Same pattern
  // as hairspringFindsItems above. The shop closed Feb 2023, so every
  // record is sold=true. Brand / reference / model / etc. come from
  // the structured Fine Print fields the scraper parses out of
  // body_html. Source = "Hodinkee" (Mark spec 2026-05-19: drop the
  // "Shop" suffix — Editorial surfaces BAL / Reference Points by
  // column name, so there's no collision in Listings where this
  // projection lives).
  const hodinkeeShopItems = useMemo(() => {
    const arr = [];
    const records = hodinkeeShopState || {};
    for (const url of Object.keys(records)) {
      const data = records[url];
      if (!data) continue;
      const price = Number(data.sold_price_usd) || 0;
      const isSold = data.is_sold !== false;  // default to sold (99.96% are)
      arr.push({
        id: shortHash(url),
        brand: (data.brand || "").trim() || "Other",
        ref: data.title || "—",
        price,
        currency: data.currency || "USD",
        priceUSD: price,
        savedPrice: price,
        savedCurrency: data.currency || "USD",
        savedPriceUSD: price,
        source: "Hodinkee",
        url,
        img: data.image || "",
        sold: isSold,
        _isSold: isSold,
        reference_no: data.reference_no || null,
        model: data.model || null,
        sub_model: data.sub_model || null,
        model_line: data.model_line || null,
        // No truthful sold-date — Hodinkee never published one and
        // Shopify's updated_at is regenerated on cache writes.
        // `published_at` reflects when the listing went LIVE on the
        // shop, not when it sold (could be months → years later).
        // Mark spec 2026-05-19: rather than misleadingly bucket
        // records into Today/Yesterday/Last week dividers off a
        // fake date, leave soldAt empty so they fall into the
        // "Other sold" undated bucket. firstSeen still gets the
        // published_at so the records have *some* temporal anchor
        // for sort tiebreakers.
        soldAt: "",
        firstSeen: data.published_at || data.updated_at || "",
        desc: (data.excerpt || "").slice(0, 1500),
      });
    }
    return arr;
  }, [hodinkeeShopState]);

  // Chrono24 per-reference listings → listing-shaped projection. Same pattern
  // as hairspringFindsItems / hodinkeeShopItems, but these are LIVE dealer
  // listings (sold:false) so they land in the Available bucket. reference_no /
  // model_line come from the scrape-time matcher so the reference-guide page's
  // market filter highlights them. price_usd is the USD figure recorded at
  // scrape time (Chrono24 serves USD to the residential scraper).
  const chrono24Items = useMemo(() => {
    const arr = [];
    const records = chrono24LotsState || {};
    for (const url of Object.keys(records)) {
      const data = records[url];
      if (!data) continue;
      const price = Number(data.price_usd) || Number(data.price) || 0;
      arr.push({
        id: shortHash(url),
        brand: (data.brand || "").trim() || "Other",
        ref: data.title || "—",
        price,
        currency: data.currency || "USD",
        priceUSD: price,
        source: "Chrono24",
        url,
        img: data.image || "",
        sold: false,
        reference_no: data.reference_no || null,
        model: data.model || null,
        sub_model: data.sub_model || null,
        model_line: data.model_line || null,
        firstSeen: data.scraped_at || "",
      });
    }
    return arr;
  }, [chrono24LotsState]);

  const mainFeedItems = useMemo(() => {
    const hasAdminHide = adminHidden && adminHidden.size > 0;
    const filterAdminHidden = (it) => !adminHidden.has(it.id);
    const merged = [...items, ...auctionLotItems, ...hairspringFindsItems, ...hodinkeeShopItems, ...chrono24Items];
    return hasAdminHide ? merged.filter(filterAdminHidden) : merged;
  }, [items, auctionLotItems, hairspringFindsItems, hodinkeeShopItems, chrono24Items, adminHidden]);

  // Auction-catalog screener queue (Mark spec 2026-05-14): live,
  // non-hidden lots whose parent auction_url matches the selected
  // auction. Sorted by lot_number where available so the screening
  // walks the catalog in the order the house listed it. No cap —
  // user opted into reviewing the whole catalog by tapping Review.
  // Lots grouped by parent auction URL. Drives both the per-row
  // "N lots" badge on the calendar AND the queue for Review / Add
  // to list. Built off the same auctionLotItems projection that
  // feeds the Listings > Live auctions sub-tab.
  const lotsByAuctionUrl = useMemo(() => {
    const m = new Map();
    for (const it of auctionLotItems) {
      if (!it.auction_url) continue;
      // Sold lots STAY in the map (Mark 2026-06-06): past sales' scraped
      // results are their catalog — excluding them zeroed the lot count,
      // so archive rows never showed the "View results" door even though
      // handleOpenSale already routes past sales to the Sold sub-tab.
      // Hero images + the shared-catalog receiver want them too.
      if (hidden[it.id]) continue;
      const arr = m.get(it.auction_url) || [];
      arr.push(it);
      m.set(it.auction_url, arr);
    }
    // Sort each bucket by lot_number so Review walks the catalog in
    // the order the house published it.
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        const la = parseInt(a.lot_number, 10);
        const lb = parseInt(b.lot_number, 10);
        if (Number.isFinite(la) && Number.isFinite(lb)) return la - lb;
        return (a.lot_number || "").localeCompare(b.lot_number || "");
      });
    }
    return m;
  }, [auctionLotItems, hidden]);

  // Counts per URL for AuctionCalendar's per-row lot badge.
  const lotCountsByAuctionUrl = useMemo(() => {
    const o = {};
    for (const [url, arr] of lotsByAuctionUrl) o[url] = arr.length;
    return o;
  }, [lotsByAuctionUrl]);

  // Hero image per sale for the image-forward calendar card (Phase 2,
  // 2026-05-26). No sale image exists in auctions.json, so we borrow
  // the top lot's image — ranked by estimate/realised/bid, falling
  // back to the first lot that has one. Zero scraper change; real
  // scraped sale heroes are a later refinement.
  const auctionHeroByUrl = useMemo(() => {
    const o = {};
    for (const [url, arr] of lotsByAuctionUrl) {
      let best = null, bestScore = -1;
      for (const lot of arr) {
        if (!lot || !lot.img) continue;
        const score = lot.estimate_high_usd || lot.sold_price_usd
          || lot.current_bid_usd || lot.savedPriceUSD || lot.priceUSD || 0;
        if (score > bestScore) { bestScore = score; best = lot; }
      }
      if (best) o[url] = best.img;
    }
    return o;
  }, [lotsByAuctionUrl]);

  // Sale-level metadata lookup (auction_url → calendar entry). Lets
  // the lots grid render sale-grouping headers with house + title +
  // date label. Mark spec 2026-05-22 (Auction IA Slice 1): when on
  // Live auctions, group lots by parent sale and emit a sticky
  // section header per sale instead of the closing-date buckets —
  // makes sale boundaries legible at a glance (e.g. "this run of
  // 40 lots is Christie's HK weekend; the next run is Phillips
  // London").
  const salesByUrl = useMemo(() => {
    const m = new Map();
    for (const a of auctions || []) {
      if (a && a.url) m.set(a.url, a);
    }
    return m;
  }, [auctions]);

  // The catalog/sale filter only applies where the sale's lots actually
  // live: a LIVE/upcoming catalog's lots sit on the Auctions sub-tab, a
  // CLOSED one's sold lots on Sold. On Sold a not-yet-closed catalog has
  // zero lots, so applying the filter there just empties the grid — which
  // makes no sense (Mark 2026-05-28). Drop the filter on Sold for any sale
  // that isn't closed; everything downstream (grid filter, sale-context
  // card, divider suppression) keys off this so they stay consistent.
  const effectiveSaleUrls = useMemo(() => {
    if (!filterSaleUrls.length) return filterSaleUrls;
    if (listingsSubTab === "sold") {
      const s = salesByUrl.get(filterSaleUrls[0]);
      if (s && s.status !== "past") return [];
    }
    return filterSaleUrls;
  }, [filterSaleUrls, listingsSubTab, salesByUrl]);

  // Saved auctions joined to their calendar entry + hero/lot-count, in
  // saved-order (added_at desc). Backs the Watchlists "Saved auctions"
  // synthetic row (Phase 3b). Sales no longer in the feed drop out.
  const savedAuctionItems = useMemo(() => {
    return savedAuctionUrls
      .map(url => {
        const a = salesByUrl.get(url);
        if (!a) return null;
        return { ...a, _heroImg: auctionHeroByUrl[url] || "", _lotCount: lotCountsByAuctionUrl[url] || 0 };
      })
      .filter(Boolean);
  }, [savedAuctionUrls, salesByUrl, auctionHeroByUrl, lotCountsByAuctionUrl]);

  // Per-target match counts for the Home search dropdown. Recomputed
  // on each homeLiveQuery change (the search-bar's onChange feeds it,
  // gated to 2+ chars). matchesSearch is O(n × tokens) substring —
  // ~10k items resolves in a few ms; no debounce needed.
  // CRITICAL: this useMemo lives ABOVE the loading/loadError early
  // returns to keep the hook count stable across the loading→ready
  // transition (CLAUDE.md Things-to-never-do).
  const homeSearchCounts = useMemo(() => {
    if (!homeLiveQuery) return null;
    const liveOnly = (i) => i && !i.sold;
    const soldOnly = (i) => i && i.sold;
    const liveMatches = items.filter(i => liveOnly(i) && matchesSearch(i, homeLiveQuery)).length;
    const auctionMatches = auctionLotItems.filter(i => liveOnly(i) && matchesSearch(i, homeLiveQuery)).length;
    const soldMatches = mainFeedItems.filter(i => soldOnly(i) && matchesSearch(i, homeLiveQuery)).length;
    return {
      all:      liveMatches + auctionMatches + soldMatches,
      live:     liveMatches,
      auctions: auctionMatches,
      sold:     soldMatches,
    };
  }, [homeLiveQuery, items, auctionLotItems, mainFeedItems]);

  // Live-query handler from HomeSearchBar. Receives "" or a 2+ char
  // string (the search-bar gates that). When non-empty, opens the
  // Search-all strip view with the query applied so the user sees
  // results filter live as they type. When empty, exits the strip
  // view so they return to Home.
  const homeSearchLiveQuery = useCallback((q) => {
    // Mark feedback 2026-05-22: "on the search feature it's a bit
    // weird when you start typing that you're suddenly in a
    // different page. Only go to the page when you click search —
    // stay on landing until then." So this used to flip
    // searchAllActive=true on each keystroke (live strip view); now
    // it only updates homeLiveQuery for the dropdown count chips.
    // The user has to press Enter or pick a target to actually
    // navigate. Counts still update live as a useful side-effect
    // without ripping them off Home.
    setHomeLiveQuery(q);
  }, []);

  // Auction-calendar action handlers (Mark spec 2026-05-14).
  // CRITICAL: these useCallbacks MUST live ABOVE the `loading` /
  // `loadError` early returns later in the function. Earlier draft
  // placed them next to the auctionCalendarJSX consts at line ~2496,
  // past the early returns, which tripped React #310 "rendered more
  // hooks than during the previous render" when loading flipped
  // false. See CLAUDE.md Things-to-never-do: hooks BEFORE every
  // early return, always.
  //
  // Open a sale's lots in the Listings grid, pre-filtered to that sale
  // (Mark 2026-05-26 — replaces the old external "View catalog" action and
  // the auction-title click). Clears the other filters for a clean
  // single-sale view, then routes to Sold for closed sales (their lots live
  // in the sold archive) and Auctions for live/upcoming. Uses the existing
  // filterSaleUrls filter (applied in the grid memo). MUST stay above the
  // loading/loadError early returns like the other auction handlers.
  const handleOpenSale = useCallback((auction) => {
    if (!auction?.url) return;
    setFilterBrands([]);
    setFilterSources([]);
    setFilterModels([]);
    setFilterHearted(false);
    setFilterSaleUrls([auction.url]);
    setTab("listings");
    setListingsSubTab(auction.status === "past" ? "sold" : "auctions");
  }, [setFilterBrands, setFilterSources, setFilterModels, setFilterHearted,
      setFilterSaleUrls, setTab, setListingsSubTab]);

  // B-55 (Mark 2026-06-02): the single-catalog filter (filterSaleUrls) is an
  // auctions/sold CONTEXT. Leaving it — switching to the Live sub-tab, or off
  // the Listings tab entirely (e.g. tapping Watches) — must drop it, or the
  // destination grid keeps filtering by a sale whose lots don't live there and
  // shows "Nothing matches". Opening a catalog sets tab=listings + sub=auctions/
  // sold in the same pass, so this never fires mid-open.
  useEffect(() => {
    if (!filterSaleUrls.length) return;
    const inCatalogContext = tab === "listings"
      && (listingsSubTab === "auctions" || listingsSubTab === "sold");
    if (!inCatalogContext) setFilterSaleUrls([]);
  }, [tab, listingsSubTab, filterSaleUrls.length, setFilterSaleUrls]);

  // Auction auto-list workflow (Review / Add-to-list) retired
  // 2026-05-26 with the screening collapse: auctions open the in-app
  // pre-filtered grid via handleOpenSale (Phase 1A), no bespoke list.

  // (feedScreenerItems memo retired 2026-05-22 alongside the
  // feed-mode entry points. Was computing "live non-hidden items
  // since last visit, capped at 50" — re-introduce when the
  // Collecting > Screening surface adds a "New since last visit"
  // pool card.)

  // Sources for the filter UI, split by kind so the sidebar/drawer can
  // group them under Dealers / Auction houses sub-headers. SOURCES is
  // the union (used everywhere a flat list is convenient — e.g. the
  // mobile drawer's overflow chip).
  const DEALER_SOURCES = useMemo(
    () => [...new Set(
      [...items, ...hairspringFindsItems, ...hodinkeeShopItems, ...chrono24Items].map(i => i.source).filter(Boolean)
    )].sort(),
    [items, hairspringFindsItems, hodinkeeShopItems, chrono24Items]
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
  // Per-tab pool — shared base for chip-rail counts (brand, source,
  // model). Computing this off the wrong pool was the root cause of
  // "brand → source filter doesn't react on Watchlist tab" — Mark
  // feedback 2026-05-20. Branches:
  //   Listings > Live auctions → live auction-format items
  //   Listings > All sold      → mixed sold items
  //   Watchlist (any sub-tab)  → user's saved set (hearted watchlist
  //                              items + tracked-lot projections),
  //                              full saved set regardless of sub-tab
  //                              so the chip rail covers everything
  //                              the user has saved
  //   Everything else          → live dealer pool
  const currentPool = useMemo(() => {
    if (tab === "listings" && listingsSubTab === "auctions") {
      return mainFeedItems.filter(i =>
        !i.sold && (!!i._isAuctionFormat || !!i._isTrackedLot)
      );
    } else if (tab === "listings" && listingsSubTab === "sold") {
      return mainFeedItems.filter(i => i.sold && !hidden[i.id]);
    } else if (tab === "watchlist") {
      // Merge savedItemsSnapshot (durable copy) + watchlist (current
      // hearts). Newer watchlist values win on key collision so
      // chip-rail counts reflect any in-flight un-heart cleanly.
      const arr = Object.values({ ...savedItemsSnapshot, ...watchlist });
      // Tracked lots — eBay items + any auction-house lots tracked
      // via the +Track flow. Only the fields the chip rails read
      // (brand, source, model, model_line) need to be present.
      for (const url of trackedLotUrls) {
        const data = trackedLotsState[url];
        if (!data) continue;
        arr.push({
          source: data.house || "—",
          brand: data.brand || "Other",
          model: data.model || null,
          model_line: data.model_line || null,
        });
      }
      return arr;
    }
    return items.filter(i => !i.sold && !hidden[i.id]);
  }, [items, hidden, mainFeedItems, tab, listingsSubTab,
      savedItemsSnapshot, watchlist, trackedLotUrls, trackedLotsState]);
  // Brand counts power both the filter-chip rail (BRANDS below) and
  // the singleton-collapse decision in displayBrand. Pool depends on
  // the active sub-tab, NOT on filterSources — keep brandCounts as
  // the canonical brand-bucket source-of-truth so displayBrand /
  // "Other" assignment stays stable across source-filter toggles.
  // (Reactive cross-axis filtering lives in brandsAvailableInPool
  // below — that drives chip *visibility*, not bucket *identity*.)
  // brandCounts must dispatch on tab + sub-tab (auctions→lot pool, sold→mixed pool, else live items) — don't fall back to global `items`, or a sub-tab shows brand chips with zero matches.
  const brandCounts = useMemo(() => {
    const c = {};
    currentPool.forEach(i => {
      const k = i.brand || "Other";
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [currentPool]);
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
    const entries = Object.entries(brandCounts)
      .filter(([b, n]) =>
        n >= BRAND_CHIP_MIN
        && b !== "Other"
        && !FORCE_OTHER_BRANDS.has(b)
      );
    // Mark feedback 2026-05-20: "could you have the first row be the
    // most listed as a popular section (Rolex, Omega, Patek, Cartier,
    // Heuer...), then all the brands listed alphabetically (hard to
    // find say Doxa as it's near the end and not alphabetically
    // listed)". Split the rail: top POPULAR_BRAND_COUNT by frequency,
    // then the remaining brands alphabetically. "Other" chip stays
    // appended last as the catch-all.
    const POPULAR_BRAND_COUNT = 12;
    const byFreq = [...entries].sort((a, b) => b[1] - a[1]).map(([b]) => b);
    const popular = byFreq.slice(0, POPULAR_BRAND_COUNT);
    const popularSet = new Set(popular);
    const alphaRest = entries
      .map(([b]) => b)
      .filter(b => !popularSet.has(b))
      .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    const visible = [...popular, ...alphaRest];
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
  // Source counts reactively respect the active brand filter
  // (Mark feedback 2026-05-19 item 3): "if I select source Tropical
  // Watch and there are no omegas, the brand list shouldn't show
  // Omega" — and vice versa. So a chip with zero remaining items
  // after the OTHER axis's filter applies drops out of the rail.
  const sourceCounts = useMemo(() => {
    const pool = filterBrands.length > 0
      ? currentPool.filter(i => filterBrands.includes(displayBrand(i)))
      : currentPool;
    const c = {};
    pool.forEach(i => {
      const k = i.source;
      if (!k) return;
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [currentPool, filterBrands, displayBrand]);
  // Symmetric — brands available in pool after filterSources applies.
  // Set rather than counts because BRANDS list is already ordered by
  // global brandCounts (kept stable so display ordering doesn't jump
  // around when source filter toggles).
  const brandsAvailableInPool = useMemo(() => {
    const pool = filterSources.length > 0
      ? currentPool.filter(i => filterSources.includes(i.source))
      : currentPool;
    return new Set(pool.map(displayBrand));
  }, [currentPool, filterSources, displayBrand]);
  // Model filter axis (Epic 0 slice B → Mark spec 2026-05-19 item 7).
  // Values are model_line strings populated by reference_index_match.
  // Coverage is partial (~43% of dealer items + most auction lots +
  // editorial projections) — surface only models with >= 2 hits to
  // avoid singleton clutter.
  const MODEL_CHIP_MIN = 2;
  const modelCounts = useMemo(() => {
    // modelCounts mirrors brandCounts — keyed on currentPool, NOT
    // narrowed by other filters. modelsAvailableInPool (below) handles
    // cross-axis reactivity.
    const c = {};
    currentPool.forEach(i => {
      const m = i.model_line;
      if (!m) return;
      c[m] = (c[m] || 0) + 1;
    });
    return c;
  }, [currentPool]);
  const MODELS = useMemo(() => {
    return Object.entries(modelCounts)
      .filter(([, n]) => n >= MODEL_CHIP_MIN)
      .sort((a, b) => b[1] - a[1])
      .map(([m]) => m);
  }, [modelCounts]);
  // Models available after source + brand filter applies.
  const modelsAvailableInPool = useMemo(() => {
    let pool = currentPool;
    if (filterSources.length > 0) {
      pool = pool.filter(i => filterSources.includes(i.source));
    }
    if (filterBrands.length > 0) {
      pool = pool.filter(i => filterBrands.includes(displayBrand(i)));
    }
    return new Set(pool.map(i => i.model_line).filter(Boolean));
  }, [currentPool, filterSources, filterBrands, displayBrand]);
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
  useEffect(() => { setPage(1); }, [filterSources, filterBrands, filterModels, filterRefs, search, sort, newDays, minPriceText, maxPriceText]);

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
    // Route through the SignInPromptModal so users see the
    // 2-step explainer before OAuth fires (Mark report 2026-05-09:
    // mobile heart-tap fired Google OAuth instantly with no
    // explanation; desktop top-bar Sign-in already used the modal,
    // so behaviour was inconsistent). The modal's onSignIn is wired
    // to signInWithGoogle, which picks up pending_intent on return.
    setSignInPromptOpen(true);
  }, []);

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
    // Hydrate `desc` from the lazy-loaded sidecar before snapshotting.
    // listings.json carries desc:"" to keep first-paint payload slim
    // (PR #437); listings_desc.json (lazy) restores it at heart time
    // so the description survives the dealer pulling the page. No-ops
    // for auction-lot items (their desc is already on the item),
    // article items (kind='article'), and the race window before the
    // sidecar lands. preserveExisting: if item.desc is already set
    // (auction lots, articles), don't clobber.
    const hydratedDesc = item.desc || listingsDesc[item.id] || "";
    const hydrated = hydratedDesc === item.desc ? item : { ...item, desc: hydratedDesc };
    toggleWatchlist(hydrated);
    // Telemetry on the on-direction only — same shape as toggleHide.
    if (!wasWished) recordEvent("save", item);
  }, [user, watchlist, toggleWatchlist, requireSignIn, recordEvent, userLimit.isAtHardCap, listingsDesc]);

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

  // The live-feed pipeline. `allFiltered` (defined below, after watchItems)
  // is what the grid actually renders: on the Saved sub-tab it swaps in the
  // saved set instead, because saved items must survive the listing coming
  // down — they live in the watchlist snapshot, not in mainFeedItems.
  const feedFiltered = useMemo(() => {
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
    if (filterModels.length > 0) its = its.filter(i => filterModels.includes(i.model_line));
    // Sale filter (PR 2026-05-22): narrows lots to specific
    // auction catalog(s). Only meaningful on Live auctions sub-tab
    // (only auction lots carry auction_url), but applying
    // unconditionally is safe — non-lot items have no auction_url
    // and would get filtered out, which matches the intent.
    if (effectiveSaleUrls.length > 0) {
      its = its.filter(i => i.auction_url && effectiveSaleUrls.includes(i.auction_url));
    }
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
  }, [mainFeedItems, filterSources, filterBrands, filterModels, filterRefs, hidden, watchlist, search, sort, minPrice, maxPrice, newDays, listingsSubTab, filterHearted, effectiveSaleUrls]);

  // (`allFiltered` / `visible` / `hasMore` are defined after the watchItems
  // memo below — the Saved sub-tab feeds off watchItems, so they can't be
  // declared before it.)

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

  // URL → live item, so a URL in a Lumé reply resolves to the item it points at
  // by URL match (NOT by hashing the URL — the feed id is merge.py's SHA1, which
  // shortHash never reproduces). This is what lets the chat open a listing link
  // in the in-app shared surface instead of bouncing to the dealer.
  const liveStateByUrl = useMemo(() => {
    const m = new Map();
    for (const it of items) if (it && it.url) m.set(normUrl(it.url), it);
    for (const it of auctionLotItems) if (it && it.url) m.set(normUrl(it.url), it);
    return m;
  }, [items, auctionLotItems]);

  // Lumé "open a watch" trigger — bumped by the open_watch action so
  // ShareReceiver opens the focused surface for an item without a reload.
  const [shareOpenTick, setShareOpenTick] = useState(0);
  const [shareOpenId, setShareOpenId] = useState(null);

  // Lumé action handlers — let the concierge bubble drive the app via the
  // decoupled ActionBus (components/ActionBus.js). Placed AFTER liveStateById
  // so open_watch can resolve an item by id. Stable setters only in deps
  // (+ the liveStateById memo) so no exhaustive-deps churn.
  useEffect(() => {
    const show_listings = (p = {}) => {
      resetFilters();
      // Brand → filter (Mark: "filter rolex is good"). Reference/model go in the
      // SEARCH box as a SINGLE substring term — NOT the exact refs/models filters,
      // which AND together and show nothing (e.g. two refs → 0 results). A first
      // ref or the model name in search narrows cleanly within the brand. (B-42)
      if (p.brand) setFilterBrands([canonicalizeBrand(p.brand)]);
      const refTerm = Array.isArray(p.ref) ? p.ref[0] : p.ref;
      const term = (p.query || refTerm || p.model || "").toString().trim();
      if (term) setSearch(term);
      if (p.minPrice != null && p.minPrice !== "") setMinPriceText(String(p.minPrice));
      if (p.maxPrice != null && p.maxPrice !== "") setMaxPriceText(String(p.maxPrice));
      // statusMode also routes the sub-tab: live · sold · auctions (Mark wants
      // sold + auction examples offered too).
      if (p.statusMode === "auctions") {
        setListingsSubTab("auctions");
      } else {
        const status = p.statusMode === "sold" || p.statusMode === "all" ? p.statusMode : "live";
        setStatusMode(status);
        setListingsSubTab(status === "sold" ? "sold" : "live");
      }
      setPage(1);
      setTab("listings");
    };
    const read_more = (p = {}) => {
      if (p.articleUrl) {
        try { window.open(p.articleUrl, "_blank", "noopener,noreferrer"); } catch {}
        return;
      }
      setReferencesSubTab("references");
      setTab("references");
    };
    const open_watch = (p = {}) => {
      const id = p.itemId || (p.itemUrl ? shortHash(p.itemUrl) : null);
      if (!id || !liveStateById.has(id)) {
        return { ok: false, message: "That one's gone." };
      }
      setShareOpenId(id);
      setShareOpenTick((n) => n + 1);
      return { ok: true };
    };
    const resolveItem = (p) => {
      const id = p.itemId || (p.itemUrl ? shortHash(p.itemUrl) : null);
      return id ? liveStateById.get(id) : null;
    };
    const add_to_list = (p = {}) => {
      const item = resolveItem(p);
      if (!item) return { ok: false, message: "That one's gone." };
      // Opens the collection picker: user adds to an existing list OR creates a
      // new one inline, then the item drops in (Mark: "create new or add to
      // existing, then the element within it"). Picker (z2500) floats over the bubble.
      openCollectionPicker(item);
      return { ok: true };
    };
    const create_list = async (p = {}) => {
      const item = resolveItem(p);
      // With an item, the picker's "+ create new list" path covers create+add
      // in one go — same flow as add_to_list.
      if (item) { openCollectionPicker(item); return { ok: true }; }
      const name = (p.listName || "").trim();
      if (!name) return { ok: false, message: "What should I call the list?" };
      const { error } = await collectionsApi.createCollection(name);
      if (error) return { ok: false, message: "Couldn't create that list." };
      return { ok: true, message: `Created "${name}".` };
    };
    const save_note = (p = {}) => {
      const text = (p.noteText || "").trim();
      if (!text) return { ok: false, message: "Nothing to note." };
      // Opens the note picker — user picks an existing list or creates one, then
      // the note saves there (NotePickerModal, z2500 over the bubble).
      setNotePickerText(text);
      return { ok: true };
    };
    const unregActions = registerActionHandlers({
      show_listings, read_more, open_watch, add_to_list, create_list, save_note,
    });
    // Sync resolver so Lumé's chat can route a watch link in its reply body to
    // the in-app shared surface (via open_watch) instead of the dealer site —
    // only when the URL resolves to a live watch we hold; everything else stays
    // a normal external link. Resolve by URL match (the feed id is SHA1, which
    // shortHash can't reproduce — hashing here is the bug that sent every link
    // to the dealer).
    const unregResolver = registerItemResolver((url) => liveStateByUrl.get(normUrl(url)) || null);
    return () => { unregActions(); unregResolver(); };
  }, [
    resetFilters, setFilterBrands, setFilterModels, setFilterRefs, setSearch,
    setMinPriceText, setMaxPriceText, setStatusMode, setListingsSubTab,
    setPage, setReferencesSubTab, setTab, liveStateById, liveStateByUrl,
    openCollectionPicker, collectionsApi,
  ]);

  const watchItems = useMemo(() => {
    // Hearted dealer items from `watchlist_items`. Mark 2026-05-07
    // un-heart staleness fix: merge the live watchlist with the
    // savedItemsSnapshot captured on saved-view entry. Spread order
    // means watchlist values WIN where keys collide, so currently-
    // hearted items get their fresh data; un-hearted items fall back
    // to the snapshot value (the original render-time copy) so the
    // card stays on screen until the next sub-tab change / refresh.
    // Articles (kind='article') share watchlist_items but render via
    // ArticleCard, not the dealer Card — strip them here so the
    // listing-only sub-tabs (Saved listings / auctions / sold) never
    // get an article. The "Saved articles" virtual row in Lists picks
    // them up via its own kind='article' filter pass.
    // `watchlist_items` is shared with saved ARTICLES (kind='article') and
    // saved REFERENCE GUIDES (kind='reference'); watches themselves carry no
    // kind at all. Both non-watch kinds render through their own card
    // components and belong to their own content tab, so strip them here.
    // Guides were missing from this filter until 2026-07-30 — latent while
    // the only consumer was HeartedView's watches branch, but it would have
    // rendered a saved guide as a dealer Card the moment one existed.
    const NON_WATCH_KINDS = new Set(["article", "reference"]);
    let its = Object.values({ ...savedItemsSnapshot, ...watchlist })
      .filter(it => it && !NON_WATCH_KINDS.has(it.kind));
    // Tag each entry with its current liveness so we can split into
    // Live/Sold sub-views below. An item is "sold" if the live scrape
    // says it's sold/on-hold OR if it's no longer in the scrape at all
    // (dealer pulled the listing → assume sold). The saved snapshot is
    // still the durable record either way.
    its = its.map(it => {
      const live = liveStateById.get(it.id);
      // "Missing from current scrape" is a strong signal for dealer
      // items (the dealer removed the URL → almost always sold). For
      // AUCTION items it's a false positive: a sale that hasn't
      // started yet may not be in the active scrape window, or a
      // transient scrape error may have dropped a single lot. If the
      // saved snapshot carries an auction_start that hasn't passed,
      // OR an auction_end that hasn't passed, the auction can't
      // possibly have ended — keep the hearted lot out of the
      // Archive Sold sub-tab. (Mark report 2026-05-09.)
      let isSold;
      if (live) {
        isSold = !!live.sold;
      } else if (it.auction_start) {
        const startMs = new Date(it.auction_start).getTime();
        if (Number.isFinite(startMs) && startMs > Date.now()) {
          isSold = false;
        } else if (it.auction_end) {
          const endMs = new Date(it.auction_end).getTime();
          isSold = Number.isFinite(endMs) && endMs <= Date.now();
        } else {
          isSold = true;
        }
      } else if (it.auction_end) {
        const endMs = new Date(it.auction_end).getTime();
        isSold = Number.isFinite(endMs) && endMs <= Date.now();
      } else {
        isSold = true;
      }
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
      // Same time-aware override as the auction-lots projection above
      // (see that comment for the bug detail). Both auction_start
      // and auction_end checks because date-only end strings give a
      // false positive on the same calendar day. 2026-05-11: count a
      // realised sold_price as ended regardless of status — covers
      // Phillips/Sotheby's multi-session session-1 lots whose parent
      // auction_end is still in the future.
      const hasRealisedSale = data.sold_price != null && data.sold_price > 0;
      // Only override status:"ended"→active when sold_price is null — a realised price beats the calendar end-date (Phillips multi-session lots ship ended+sold_price while auction_end is still future).
      let isEnded = data.status === "ended" || hasRealisedSale;
      if (isEnded && !hasRealisedSale && data.auction_start) {
        const startMs = new Date(data.auction_start).getTime();
        if (Number.isFinite(startMs) && startMs > Date.now()) {
          isEnded = false;
        }
      }
      if (isEnded && !hasRealisedSale && data.auction_end) {
        const endMs = new Date(data.auction_end).getTime();
        if (Number.isFinite(endMs) && endMs > Date.now()) {
          isEnded = false;
        }
      }
      // Reverse-direction override (mirrors site above): flip
      // active→ended when auction_end has explicit time-of-day AND
      // is in the past. Catches auctions that ended between scraper
      // runs.
      if (!isEnded && data.auction_end) {
        const endMs = new Date(data.auction_end).getTime();
        if (Number.isFinite(endMs) && endMs < Date.now()) {
          const d = new Date(endMs);
          const hasTimeOfDay = d.getUTCHours() !== 0
                            || d.getUTCMinutes() !== 0
                            || d.getUTCSeconds() !== 0;
          if (hasTimeOfDay) isEnded = true;
        }
      }
      // Mirror of the auctionLotItems projection above — same fallback
      // through current_bid when isEnded but sold_price hasn't landed
      // yet. See comment there for context.
      const price = (isEnded ? (data.sold_price || data.current_bid) : data.current_bid)
        || data.starting_price || data.estimate_low || 0;
      const priceUsd = (isEnded ? (data.sold_price_usd || data.current_bid_usd) : data.current_bid_usd)
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
        soldAt: isEnded
          ? (() => {
              const end = data.auction_end ? new Date(data.auction_end).getTime() : 0;
              const endInPast = end > 0 && end <= Date.now();
              return endInPast ? data.auction_end : (data.scraped_at || data.auction_end || "");
            })()
          : null,
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
    if (filterModels.length > 0)  its = its.filter(i => filterModels.includes(i.model_line));
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
  }, [watchlist, savedItemsSnapshot, liveStateById, sort, filterSources, filterBrands, filterModels, filterRefs, search,
      minPrice, maxPrice, watchTopTab,
      trackedLotUrls, trackedLotsState, trackedLotAddedAt]);

  // What the Watches grid renders. Every sub-tab except Saved reads the live
  // feed; Saved reads the saved set, which is built from the watchlist
  // snapshot + tracked-lot projections so a watch you saved stays on screen
  // after the dealer pulls the listing. Both arrays have already had the
  // SAME filter predicates applied (source / brand / model / ref / search /
  // price) and the same sort dispatch, so the shared filter bar drives the
  // Saved sub-tab exactly as it drives the other three.
  //
  // Residual tech debt, deliberately not fixed here: those predicates are
  // still written out twice (feedFiltered + watchItems). Unifying them is a
  // mechanical extraction worth doing, but not in the same change as an IA
  // move — the drift that mattered (filters silently not applying to the
  // saved grid) is gone once both feed one grid through one bar.
  const allFiltered = useMemo(
    () => (tab === "listings" && listingsSubTab === "saved" ? watchItems : feedFiltered),
    [tab, listingsSubTab, watchItems, feedFiltered]
  );
  const visible = useMemo(() => allFiltered.slice(0, page * PAGE_SIZE), [allFiltered, page]);
  const hasMore = visible.length < allFiltered.length;

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

  // Cross-axis reactive filtering (Mark feedback 2026-05-19 item 3):
  // when one filter axis is active, the OTHER axis's chips shrink to
  // only show what's actually reachable. Active filter chips stay
  // visible regardless so the user can always untoggle.
  const effectiveBrands = BRANDS.filter(b => brandsAvailableInPool.has(b) || filterBrands.includes(b));
  const visibleBrands = brandsExpanded ? effectiveBrands : effectiveBrands.slice(0, BRANDS_SHOW);
  const effectiveSources = SOURCES.filter(s => (sourceCounts[s] || 0) > 0 || filterSources.includes(s));
  const visibleSources = sourcesExpanded ? effectiveSources : effectiveSources.slice(0, SOURCES_SHOW);
  // Models — same reactive pattern. MODELS_SHOW=8 is conservative
  // because the model_line strings tend to be longer than brands.
  const MODELS_SHOW = 8;
  const effectiveModels = MODELS.filter(m => modelsAvailableInPool.has(m) || filterModels.includes(m));
  const visibleModels = modelsExpanded ? effectiveModels : effectiveModels.slice(0, MODELS_SHOW);
  const REFS_SHOW = 12;
  const visibleRefs = refsExpanded ? REFS : REFS.slice(0, REFS_SHOW);
  const NEW_OPTS = [{ label: "Today", days: 1 }, { label: "3 days", days: 3 }, { label: "This week", days: 7 }];

  const baseStyle = {
    fontFamily: "inherit",
    WebkitFontSmoothing: "antialiased", minHeight: "100vh",
    background: "var(--bg)", color: "var(--text1)",
    ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v]))
  };
  // PR 2026-05-22: gridStyle.background flipped from var(--border)
  // (light grey hairline-between-cards effect) to var(--bg) (page
  // bg). The hairline approach kept leaking 1px slivers around
  // full-bleed rows (DateDivider headers) — multiple fix attempts
  // (negative margin, box-shadow, absolute mask child) didn't fully
  // cover the leak in sticky state. Paint the gap as page-bg and
  // the leak goes away entirely; cards lose their 1px hairline
  // separator but the existing surface-bg + spacing reads clean.
  // background must be var(--bg), NOT var(--border). The hairline-grid trick leaks a grey border around full-bleed rows in sticky state. Use card-level borders.
  const gridStyle = { display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 1, background: "var(--bg)" };

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
    // Signed-out chrome — ONE control, both viewports (Mark, 2026-09-08).
    //
    // The rule is: signed out it says "Sign in", signed in it shows the
    // Google initial, and in BOTH cases the control opens the same menu.
    // Before this, mobile showed a bare hamburger glyph (no "Sign in"
    // anywhere) and desktop's pill fired the sign-in modal directly, so the
    // signed-out user never met About / the rest of the menu.
    <div style={{ position: "relative" }}>
      <button onClick={() => setShowUserMenu(o => !o)}
        aria-label="Menu" title="Menu"
        style={{
          fontSize: 13, fontWeight: 600, letterSpacing: "0.01em",
          padding: isMobile ? "7px 12px" : "4px 12px", borderRadius: 20,
          border: "0.5px solid var(--border)", background: "var(--surface)",
          color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
          whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 7,
          flexShrink: 0,
        }}>
        {/* The three rules keep the hamburger affordance Mark asked to
            retain; the word carries the meaning. */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          aria-hidden="true">
          <line x1="4" y1="7" x2="20" y2="7"/>
          <line x1="4" y1="12" x2="20" y2="12"/>
          <line x1="4" y1="17" x2="20" y2="17"/>
        </svg>
        Sign in
      </button>
      {showUserMenu && (
        <div style={{
          position: "absolute", right: 0, top: isMobile ? 46 : 42, zIndex: 50,
          background: "var(--bg)", border: "0.5px solid var(--border)",
          borderRadius: 12, padding: 10, minWidth: 220,
          boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
        }}>
          <button onClick={() => { setShowUserMenu(false); setSignInPromptOpen(true); }}
            style={{ display: "flex", alignItems: "center", gap: 8,
                    width: "100%", textAlign: "left",
                    padding: "10px 12px", border: "none", background: "transparent",
                    color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 14, fontWeight: 600, borderRadius: 6 }}>
            <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.6 2.1 30.1 0 24 0 14.8 0 6.8 5.3 3 13l7.8 6C12.7 13.5 17.8 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.2-3.1-.5-4.5H24v9h12.7c-.6 3-2.3 5.5-4.9 7.2l7.6 5.9c4.4-4.1 7.1-10.1 7.1-17.6z"/>
              <path fill="#FBBC05" d="M10.8 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.8-6C1.1 16.3 0 20 0 24s1.1 7.7 3 11.2l7.8-6.5z"/>
              <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15.1-5.5l-7.6-5.9c-2.1 1.4-4.8 2.2-7.5 2.2-6.2 0-11.3-4-13.2-9.5l-7.8 6C6.8 42.7 14.8 48 24 48z"/>
            </svg>
            Sign in with Google
          </button>
          <button onClick={() => { setShowUserMenu(false); setAboutModalOpen(true); }}
            style={{ display: "block", width: "100%", textAlign: "left",
                    padding: "10px 12px", border: "none", background: "transparent",
                    color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 14, borderRadius: 6 }}>
            About Watchlist
          </button>
          <button onClick={() => { setShowUserMenu(false); setSettingsModalOpen(true); }}
            style={{ display: "block", width: "100%", textAlign: "left",
                    padding: "10px 12px", border: "none", background: "transparent",
                    color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 14, borderRadius: 6 }}>
            Display settings
          </button>
        </div>
      )}
    </div>
  ) : (
    <div style={{ position: "relative" }}>
      {/* Desktop: brand-tinted pill that wraps the avatar initial +
          a visible "Watchbox" label, so users discover where the
          Watchbox lives (Mark feedback 2026-05-14 — the bare initial
          gave no hint there was a primary destination behind it).
          Mobile keeps the small initial circle to preserve the
          tight top-bar layout — the dropdown reveals Watchbox as
          its highlighted primary entry. */}
      {/* PR_ε2 2026-05-22: avatar disc + letter colors INVERT when the
          top bar is olive (every tab except Home, both viewports). On
          neutral top bar (Home): olive disc + white letter. On olive
          top bar (non-Home): white disc + olive letter. Single rule;
          fixes the mobile regression from ε5 where olive disc on
          olive chrome was invisible. */}
      {(() => {
        // The share-receive surfaces keep tab="home" but paint the top bar
        // olive — without OR-ing them in, the disc rendered olive-on-olive
        // (only the white initial visible; P-32, Mark 2026-06-03).
        const onOliveBar = tab !== "home"
          || shareActive || challengeShareActive || listShareActive || catalogShareActive || searchAllActive;
        const discBg     = onOliveBar ? "#ffffff" : "var(--brand-olive)";
        const discFg     = onOliveBar ? "var(--brand-olive)" : "#ffffff";
        // Home: the olive disc sits in the olive masthead band once it
        // scrolls/sticks, so the circle vanished (only the M showed) — a
        // white ring keeps it visible there (Mark 2026-06-03).
        const pillBorder = onOliveBar ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.85)";
        // Just the initial disc (Mark 2026-05-28): dropped the "Watchbox"
        // label pill — Watchbox is no longer the menu's primary destination
        // (it lives in the Lists tab), so the bare "M" reads cleanly as the
        // account / settings entry. Same disc on both viewports.
        return (
        <button onClick={() => setShowUserMenu(o => !o)}
          aria-label="Account menu" title="Account menu"
          style={{
            width: isMobile ? 40 : 36, height: isMobile ? 40 : 36, borderRadius: "50%",
            // 1px on Home so the white ring actually reads on the olive band.
            border: `${onOliveBar ? "0.5px" : "1px"} solid ${pillBorder}`,
            background: discBg, color: discFg, cursor: "pointer", fontFamily: "inherit",
            fontSize: 14, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
          {userInitial.toUpperCase()}
        </button>
        );
      })()}
      {showUserMenu && (
        <div style={{
          position: "absolute", right: 0, top: isMobile ? 46 : 42, zIndex: 50,
          // Always open downward — both desktop and mobile buttons live in
          // the top header now, so opening up would push the menu off the
          // top of the viewport.
          background: "var(--bg)", border: "0.5px solid var(--border)",
          borderRadius: 12, padding: 10, minWidth: 240,
          boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
        }}>
          {/* Identity header — small eyebrow + name. */}
          <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: "0.12em",
                       textTransform: "uppercase", fontWeight: 600,
                       padding: "2px 8px" }}>
            Signed in as
          </div>
          <div style={{ fontSize: 13, color: "var(--text1)", padding: "2px 8px 0",
                       overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userName}
          </div>
          {/* Sign out lives WITH the identity it signs out of (Mark
              2026-06-03) — a quiet link under the name, not a menu row. */}
          <button onClick={() => { setShowUserMenu(false); signOut(); }}
            style={{ display: "block", textAlign: "left",
                    padding: "2px 8px 8px", border: "none", background: "transparent",
                    color: "var(--text3)", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 12, textDecoration: "underline", textUnderlineOffset: 2 }}>
            Sign out
          </button>

          {/* Utilities. Watchbox is re-added here 2026-06-01 (eBay "My
              eBay" model — the second door to the owned/wishlist/sold
              vault, alongside its anchor on the Lists tab). About lives
              in the top nav; admin Site stats stays. */}
          <div style={{ marginTop: 8 }}>
            {/* Lists live here now (Mark, 2026-10-16), not under a Saved top tab.
                The container is still internal tab "watchlist"; this opens it on
                Lists. setTabWithReceiveEscape so a share-receive landing is
                dismissed first, like the other entries that leave the page. The
                sub-tab is set AFTER it: a tab change resets the container to its
                first sub-tab ("hearted"), which would otherwise win. */}
            <button onClick={() => { setShowUserMenu(false); setTabWithReceiveEscape("watchlist"); setWatchTopTab("lists"); setPage(1); }}
              style={{ display: "block", width: "100%", textAlign: "left",
                      padding: "8px 8px", border: "none", background: "transparent",
                      color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                      fontSize: 13, fontWeight: 500, borderRadius: 6 }}>
              Lists
            </button>
            <button onClick={() => { setShowUserMenu(false); setTab("watchbox"); setPage(1); }}
              style={{ display: "block", width: "100%", textAlign: "left",
                      padding: "8px 8px", border: "none", background: "transparent",
                      color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                      fontSize: 13, fontWeight: 500, borderRadius: 6 }}>
              My Watchbox
            </button>
            {/* Tools — relocated from the dissolved Collecting tab (2026-06-03
                IA restructure). Size comparison + Challenges launch the old
                tools surface (internal tab "references", sub set first so
                setTabWithReceiveEscape doesn't need to know which tool).
                Links is parked (legacy ?tab=learn&sub=links still resolves).
                Challenges' final home is provisional — Mark to revisit. */}
            <button onClick={() => { setShowUserMenu(false); setReferencesSubTab("size"); setTabWithReceiveEscape("references"); setPage(1); }}
              style={{ display: "block", width: "100%", textAlign: "left",
                      padding: "8px 8px", border: "none", background: "transparent",
                      color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                      fontSize: 13, fontWeight: 500, borderRadius: 6 }}>
              Size comparison
            </button>
            <button onClick={() => { setShowUserMenu(false); setReferencesSubTab("challenges"); setTabWithReceiveEscape("references"); setPage(1); }}
              style={{ display: "block", width: "100%", textAlign: "left",
                      padding: "8px 8px", border: "none", background: "transparent",
                      color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                      fontSize: 13, fontWeight: 500, borderRadius: 6 }}>
              Challenges
            </button>
            {isAdmin && (
              // Site Stats is admin-only — shown only to Mark.
              <button onClick={() => { setShowUserMenu(false); setTab("admin"); setPage(1); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                        gap: 8, width: "100%", textAlign: "left",
                        padding: "8px 8px", border: "none", background: "transparent",
                        color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                        fontSize: 13, fontWeight: 500, borderRadius: 6 }}>
                <span>Site stats</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
                              textTransform: "uppercase", color: "#ffffff",
                              background: "var(--brand-olive)",
                              padding: "2px 6px", borderRadius: 4 }}>
                  Admin
                </span>
              </button>
            )}
          </div>

          {/* View settings — visually contained card (Mark spec
              2026-05-14): currency / theme / columns. Surfaced
              inline on desktop so users can flip these without a
              modal hop; mobile shows a "Display settings" button
              that opens the SettingsModal instead (filter drawer
              owns most of those toggles already on mobile). */}
          {!isMobile ? (
            <div style={{
              marginTop: 10,
              // Horizontal inset matches the utility rows above (8px) so
              // every left edge in the menu lines up. The redundant
              // "Settings" umbrella label was removed (2026-05-28, Mark):
              // it duplicated the Currency/Theme/Columns labels below it and
              // clashed with them in size/tracking. The hairline top-rule is
              // the section break between account utilities and display
              // settings — no second label needed.
              padding: "10px 8px 4px",
              borderTop: "0.5px solid var(--border)",
            }}>
              <ViewSettingsControls
                primaryCurrency={primaryCurrency}
                setPrimaryCurrency={setPrimaryCurrency}
                isMobile={false}
                dark={dark}
                setDarkOverride={setDarkOverride}
                mobileCols={mobileCols}
                setMobileCols={setMobileCols}
                desktopCols={desktopCols}
                setDesktopCols={setDesktopCols}
                desktopAutoCols={desktopAutoCols}
                compact={true}
              />
            </div>
          ) : (
            <button onClick={() => { setShowUserMenu(false); setSettingsModalOpen(true); }}
              style={{ display: "block", width: "100%", textAlign: "left",
                      marginTop: 4,
                      padding: "8px 8px", border: "none", background: "transparent",
                      color: "var(--text1)", cursor: "pointer", fontFamily: "inherit",
                      fontSize: 13, borderRadius: 6 }}>
              Display settings
            </button>
          )}
        </div>
      )}
    </div>
  );
  // Home tab slice memos — MUST sit before the loading/loadError
  // early returns below. React #310 (rendered more hooks than during
  // the previous render) fires when hook calls live downstream of an
  // early return: render 1 (loading) stops at the return, render 2
  // (post-load) keeps going and runs three new hooks. React tracks
  // hook count per render. Position is load-bearing — do not move
  // these back into the JSX-const block. (CLAUDE.md "Don't add new
  // useState/useMemo/useCallback deep into App.js" — this is exactly
  // that warning. Origin: 2026-05-11 hotfix after PR #223 shipped
  // with them too deep and white-screened production.)
  const homeRecentAdded = useMemo(() => {
    // Exclude `backfilled` items: on a newly-onboarded source the whole
    // catalog lands at once with firstSeen=the-day-we-added-the-source, NOT
    // the day each listing appeared. Sorting those by firstSeen floods
    // "Recently added" with a back-catalog that isn't genuinely new (Menta,
    // 2026-06-18 — they showed on Home but not at the top of "View all").
    // The Listings live feed already excludes backfilled from "new" + sorts
    // it last (allFiltered, `!i.backfilled`); mirror that here so the strip
    // and the View-all destination agree.
    const live = items.filter(i => !i.sold && !i.backfilled && !hidden[i.id] && !adminHidden.has(i.id) && !homeHidden.has(i.id));
    const sortKey = (i) => i.firstSeen || i.scrapedAt || "";
    return [...live].sort((a, b) => (sortKey(b) || "").localeCompare(sortKey(a) || "")).slice(0, 20);
  }, [items, hidden, adminHidden, homeHidden]);
  const homeEndingNext = useMemo(() => {
    // auctionLotItems is the PROJECTED shape — `sold` is the
    // derived isEnded flag (data.status === "ended" || sold_price set),
    // there is no `status` field on the projected item. The earlier
    // `i.status === "ended"` check never fired, which let multi-
    // session sold session-1 lots through (Phillips Geneva XXIII,
    // Christie's online sales) because they carry a future
    // `auction_end` (session 2) AND a realised sold_price. Filter
    // on `!i.sold` to exclude them. (Bug surfaced 2026-05-11 — same
    // SOLD cards appearing in both Recently sold and Ending next.)
    const now = Date.now();
    const active = auctionLotItems.filter(i => {
      if (hidden[i.id] || adminHidden.has(i.id) || homeHidden.has(i.id)) return false;
      if (i.sold) return false;
      const end = i.auction_end ? Date.parse(i.auction_end) : NaN;
      return !Number.isNaN(end) && end > now;
    });
    return active.sort((a, b) => Date.parse(a.auction_end) - Date.parse(b.auction_end)).slice(0, 20);
  }, [auctionLotItems, hidden, adminHidden, homeHidden]);
  const homeRecentSold = useMemo(() => {
    const merged = [...items, ...auctionLotItems].filter(i => {
      if (hidden[i.id] || adminHidden.has(i.id) || homeHidden.has(i.id)) return false;
      return i.sold || i.status === "ended" || i.sold_price;
    });
    const soldKey = (i) => i.soldAt || i.auction_end || i.lastSeen || "";
    return merged.sort((a, b) => (soldKey(b) || "").localeCompare(soldKey(a) || "")).slice(0, 20);
  }, [items, auctionLotItems, hidden, adminHidden, homeHidden]);
  // Pool counts behind each Home row, for the section headers (Epic 9 step 1).
  // These are the SIZE OF THE POOL, not the 20 tiles a row renders, which is
  // the point: the count is what tells a visitor the row is a slice of
  // something large. Derived at render from the same sets the rows come from,
  // so nothing here can rot the way the hardcoded LiveCounts house number did.
  // Cheap: four length reads over arrays already in memory.
  const homeSectionCounts = useMemo(() => {
    const visible = (i) => i && !hidden[i.id] && !adminHidden.has(i.id) && !homeHidden.has(i.id);
    const isSold = (i) => i.sold || i.status === "ended" || i.sold_price;
    const now = Date.now();
    return {
      live: items.filter((i) => visible(i) && !isSold(i)).length,
      sold: [...items, ...auctionLotItems].filter((i) => visible(i) && isSold(i)).length,
      endingNext: auctionLotItems.filter((i) => {
        if (!visible(i) || i.sold) return false;
        const end = i.auction_end ? Date.parse(i.auction_end) : NaN;
        return !Number.isNaN(end) && end > now;
      }).length,
      // No `articles` here on purpose: `homeArticles` is already an
      // idle-loaded slice, not the corpus, so its length is the only honest
      // number available and HomeTab falls back to it. A real corpus count
      // needs the editorial index, which Home doesn't load.
    };
  }, [items, auctionLotItems, hidden, adminHidden, homeHidden]);

  // ⚠️ DO NOT add hooks (useState/useMemo/useEffect/useCallback) below this line. Hooks after an early return → React #310 ("rendered more hooks than previous render"); white-screened prod 3×. New hooks go ABOVE all early returns, or in a child component mounted unconditionally. Also: a useEffect deps array must not reference state declared later (TDZ).
  // Tint for the load / error screens: same rule as the ready render below,
  // minus the catalog takeover (not known until the data is in).
  const anyTakeoverNow = shareActive || challengeShareActive || listShareActive || catalogShareActive || searchAllActive;
  const preloadTint = (
    <ChromeTint dark={dark}
      light={chromeIsLight({ tab, anyTakeover: anyTakeoverNow, magWatchesOn: isMagWatchesOn(),
                             lookNew: readLook() === "new", catalogFullPage: false })} />
  );
  if (loading) return <><div style={{ ...baseStyle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text2)" }}>Pulling the latest listings…</div>{preloadTint}</>;
  if (loadError) return <><div style={{ ...baseStyle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text2)" }}>Couldn't pull the listings. Refresh to try again.</div>{preloadTint}</>;

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

  // Unsave from the search-bar suggestions (the heart in the bar is what saves).
  // Same confirm the Searches list uses: a stray tap shouldn't lose a search.
  const removeSavedSearch = async (s) => {
    if (await confirm({
      title: "Delete saved search?",
      message: `"${s.label}" will be removed from your saved searches.`,
      confirmLabel: "Delete",
      tone: "danger",
    })) removeSearch(s.id);
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
    // Mark spec 2026-05-19: items without a real sold-date bucket
    // into "Other" rather than "Older sold" — keeps the
    // date-known-but-old vs date-unknown distinction honest. Hits
    // Hodinkee Shop records (no truthful sold-date), some auction
    // lots that pre-date the soldAt back-fill, and any future
    // sold-archive source that ships without a date.
    if (!d) return "Other sold";
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
  // (closingBucketLabel retired 2026-05-22 Auction IA Slice 1 —
  // Live auctions now groups by parent sale instead of closing-date
  // buckets. Mark spec: when two sales from different houses overlap
  // on the same weekend, sale-grouping makes the boundaries legible
  // in a way the date buckets couldn't.)
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
    //   auctions → sale-group buckets (Auction IA Slice 1, 2026-05-22)
    //              — house · title with a date-range meta. Replaces the
    //              previous closing-time bucketing because two sales
    //              from different houses in the same weekend used to
    //              smear together; sale-grouping makes the boundaries
    //              legible.
    //   calendar → renders a calendar component, not this grid
    const isDateSort = sort === "date" || sort === "date-asc";
    const useFreshBuckets    = isDateSort && tab === "listings" && listingsSubTab === "live";
    const useSoldBuckets     = isDateSort && tab === "listings" && listingsSubTab === "sold";
    // Auctions grid groups by CLOSING TIME (Mark 2026-05-26): the
    // per-SALE section headers were dropped (hard to read, wrong count),
    // but date-group headers come back — "Closing today / tomorrow /
    // this week / …" — for the same breathing-room + scan rhythm as the
    // Live grid. Sale context still gets a single header at the top when
    // you've drilled into one sale (filterSaleUrls, in listingsGridJSX).
    const useClosingBuckets  = isDateSort && tab === "listings" && listingsSubTab === "auctions";
    // Single-catalog view: the sale-context card at the top already carries
    // house · date · lot count, so the "Closing this month/week" (or sold-
    // date) dividers are redundant — one sale closes on one date, and the
    // card's count is the accurate one (Mark 2026-05-28). Render flat.
    const singleCatalog = effectiveSaleUrls.length === 1;
    if (singleCatalog || (!useFreshBuckets && !useSoldBuckets && !useClosingBuckets)) {
      return visible.map(it => ({ kind: "card", item: it }));
    }
    if (useClosingBuckets) {
      const DAY = 86400000;
      const now = Date.now();
      const labelOf = (i) => {
        const end = i.auction_end ? new Date(i.auction_end).getTime() : 0;
        if (!end || !Number.isFinite(end)) return "Other auction lots";
        const diff = end - now;
        if (diff < 0) return "Ending now";
        if (diff < DAY) return "Closing today";
        if (diff < 2 * DAY) return "Closing tomorrow";
        if (diff < 7 * DAY) return "Closing this week";
        if (diff < 30 * DAY) return "Closing this month";
        return "Later";
      };
      const ORDER = [
        "Ending now", "Closing today", "Closing tomorrow",
        "Closing this week", "Closing this month", "Later",
        "Other auction lots",
      ];
      const groups = new Map();
      for (const it of visible) {
        const key = labelOf(it);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(it);
      }
      const out = [];
      for (const label of ORDER) {
        const lots = groups.get(label);
        if (!lots || lots.length === 0) continue;
        out.push({ kind: "divider", label, total: lots.length });
        for (const it of lots) out.push({ kind: "card", item: it });
      }
      return out;
    }
    const baseLabelFn = useSoldBuckets ? soldBucketLabel : ageBucketLabel;
    // Mark's report 2026-05-06: backfilled items can produce a second
    // "Last week" (or any) divider because they sort in a separate
    // section below the non-backfilled run but get bucketed by the
    // same date labels. Collapse all backfilled items under a single
    // "Earlier additions" divider so they can't collide with the
    // non-backfilled date dividers above.
    //
    // 2026-05-09: the "Earlier additions" override applies ONLY to
    // the live freshness buckets — for sold-date buckets it produced
    // a confusing "Today sold / Earlier additions / Yesterday sold /
    // Earlier additions" alternation because some recently-sold
    // items happen to be backfilled. Sold dividers should be
    // uniform: the sold-date is the right axis regardless of how
    // the listing was first captured.
    // "Earlier additions" override only applies to the live freshness
    // buckets — for sold + closing buckets it'd alternate confusingly
    // because some sold / closing items happen to be backfilled.
    const useEarlierOverride = useFreshBuckets;
    const labelFn = (i) =>
      (useEarlierOverride && !!i.backfilled) ? "Earlier additions" : baseLabelFn(i);
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

  // Auction calendar component. Phase 4 slice 2 (2026-05-26): no longer
  // its own sub-tab — it renders inside the calendar MODAL below,
  // launched from the auctions grid; picking a sale filters the grid +
  // closes the modal.
  const auctionCalendarJSX = (
    <div style={{ paddingTop: 4 }}>
      <React.Suspense fallback={null}>
        <AuctionCalendar
          auctions={auctions || []}
          lotCounts={lotCountsByAuctionUrl}
          heroImgByUrl={auctionHeroByUrl}
          savedUrls={savedAuctionUrlSet}
          onToggleSave={user ? toggleSavedAuction : null}
          onOpenSale={(a) => { handleOpenSale(a); setCalendarModalOpen(false); }}
          isMobile={isMobile}
        />
      </React.Suspense>
    </div>
  );

  // Built once per render as a JSX expression (NOT a nested component).
  // A nested function-component gets a new identity on every App render,
  // which forces React to unmount + remount the entire grid — including
  // every <img> — making all tiles flash white on heart toggles, page
  // bumps, and any other state change. As a JSX expression, the same
  // grid instance is reused and only changed cards re-render.
  // Shared active-filters strip. Same instance is rendered above the
  // listings grid AND threaded through to WatchlistTab so the Saved
  // sub-tabs (which use the same useFilters state) get a consistent
  // affordance for "what's currently filtered + clear it". Mark spec
  // 2026-05-19 item 4.
  const activeFiltersStripJSX = (
    <ActiveFiltersStrip
      filterSources={filterSources} toggleSource={toggleSource}
      filterBrands={filterBrands}   toggleBrand={toggleBrand}
      filterModels={filterModels}   toggleModel={toggleModel}
      filterRefs={filterRefs}       toggleFilterRef={toggleFilterRef}
      search={search}               setSearch={setSearch}
      newDays={newDays}             setNewDays={setNewDays}
      minPriceText={minPriceText}   setMinPriceText={setMinPriceText}
      maxPriceText={maxPriceText}   setMaxPriceText={setMaxPriceText}
      filterHearted={filterHearted} setFilterHearted={setFilterHearted}
      resetFilters={resetFilters}
    />
  );
  // Auction catalog = a FULL-PAGE surface (Mark 2026-06-13). When you've
  // drilled into one sale, the shells suppress the masthead / main tabs /
  // sub-tabs and pin a GREEN BAR carrying the sale title + a persistent ×
  // that returns to the calendar — mirroring the auction calendar modal's
  // own full-page treatment ([[project_chrome_unification]], cross-surface
  // consistency). The Save / Share / Auction-house actions move to a slim
  // row under the bar; the filter/search bar + lot grid stay. This replaced
  // the in-chrome PageHeader (saleContextHeaderJSX, kept null below) that
  // framed the catalog 2026-06-01 → 06-13.
  const catalogSale = (
    tab === "listings"
    && (listingsSubTab === "auctions" || listingsSubTab === "sold")
    && effectiveSaleUrls.length === 1
    && salesByUrl.get(effectiveSaleUrls[0])
  ) || null;
  const catalogFullPage = !!catalogSale;
  // × / back: drop the single-sale filter AND reopen the calendar (the
  // surface you drilled in from). Clearing filterSaleUrls ends the catalog
  // context so the normal chrome returns under the calendar modal.
  const exitCatalogToCalendar = () => { setFilterSaleUrls([]); setCalendarModalOpen(true); };
  // saleContextHeaderJSX retired in favour of the green bar (same drill-in
  // condition), but kept as a null prop so the shells' existing render slot
  // is a harmless no-op rather than a removed-prop ReferenceError.
  const saleContextHeaderJSX = null;
  const catalogActions = (() => {
    if (!catalogSale) return [];
    const sale = catalogSale;
    const saved = savedAuctionUrlSet.has(sale.url);
    // Share an IN-APP link to the catalog receive surface (Mark 2026-06-02) —
    // NOT the raw auction-house URL (which dead-ended off the platform).
    const shareCatalog = async () => {
      try {
        const u = new URL(window.location.origin);
        u.searchParams.set("catalog", sale.url);
        u.searchParams.set("shared", "1");
        const md = user && user.user_metadata;
        let senderName = md ? (md.full_name || md.name || "").trim() : "";
        if (!senderName && user && user.email) {
          senderName = String(user.email).split("@")[0].split(/[._-]+/).filter(Boolean)
            .map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
        }
        if (senderName) u.searchParams.set("from", senderName);
        const link = u.toString();
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({ title: sale.title || "Auction catalog", url: link });
        } else if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(link);
        }
      } catch {}
    };
    const a = [];
    if (user) a.push({
      label: saved ? "Saved" : "Save catalog", active: saved,
      icon: <span style={{ color: saved ? "var(--heart)" : "var(--text2)" }}>{saved ? "♥" : "♡"}</span>,
      onClick: () => toggleSavedAuction(sale.url),
    });
    if (sale.url) a.push({ label: "Share", onClick: shareCatalog });
    if (sale.url) a.push({ label: "Auction house ↗", href: sale.url, external: true });
    return a;
  })();
  // Green title bar (content only — the shells wrap it in their own sticky
  // container so it pins as you scroll the lots). House · location · date
  // eyebrow + sale title, × on the right.
  const catalogBarJSX = catalogSale ? (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12, padding: "12px 16px",
      paddingTop: isMobile ? "calc(12px + env(safe-area-inset-top, 0px))" : 12,
      background: "var(--brand-olive)", color: "#fff",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
          textTransform: "uppercase", opacity: 0.82,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {`${catalogSale.house}${catalogSale.location ? ` · ${catalogSale.location}` : ""}${fmtSaleDateRange(catalogSale) ? ` · ${fmtSaleDateRange(catalogSale)}` : ""}`}
        </div>
        <div style={{
          fontSize: 16, fontWeight: 600,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{catalogSale.title}</div>
      </div>
      <button onClick={exitCatalogToCalendar} aria-label="Back to auction calendar"
        title="Back to auction calendar"
        style={{
          border: "none", background: "transparent", cursor: "pointer",
          color: "#fff", fontSize: 22, lineHeight: 1, padding: "0 4px", flexShrink: 0,
        }}>×</button>
    </div>
  ) : null;
  // Slim action row beneath the green bar (Save catalog · Share · Auction
  // house ↗). Sits in page-bg so it reads as a toolbar under the title.
  const catalogActionRowJSX = catalogSale ? (
    <div style={{
      display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
      padding: "8px 16px", background: "var(--bg)",
      borderBottom: "0.5px solid var(--border)",
    }}>
      {catalogActions.map((a, i) => {
        const style = {
          display: "inline-flex", alignItems: "center", gap: 5,
          fontFamily: "inherit", fontSize: 12, fontWeight: 600,
          padding: "5px 11px", borderRadius: 999,
          border: "1px solid var(--border)", background: "transparent",
          color: "var(--text1)", cursor: "pointer", textDecoration: "none",
          whiteSpace: "nowrap",
        };
        return a.href ? (
          <a key={i} href={a.href} target="_blank" rel="noopener noreferrer" style={style}>{a.label}</a>
        ) : (
          <button key={i} onClick={a.onClick} style={style}>{a.icon}{a.label}</button>
        );
      })}
    </div>
  ) : null;

  // Saved-tab scrolling header (Mark 2026-06-02). On the Saved (hearted)
  // surface the title scrolls away while the filter bar pins — same collapsing
  // pattern as the catalog. The shell renders this in the scroll pane above the
  // sticky filter, so the title must live here (a shell slot), not in
  // HeartedView. The under-title count was removed 2026-06-03 (P-8, Mark's
  // verification pass): the count's ONE home is the filter bar's reserved
  // right slot — the header carried a second, slightly different number
  // ("434 items" over the grid's "432 watches") right above it.
  const savedHeaderJSX = (
    <PageHeader
      isMobile={isMobile}
      title="Saved"
    />
  );

  const listingsGridJSX = (
    <>
      {activeFiltersStripJSX}
      {/* (The sale-context header moved ABOVE the filter bar — see
          `saleContextHeaderJSX`, rendered at the shell level — so the catalog
          you're inside frames the filters, not sits among the results. Mark
          2026-06-01.) */}
      {/* Grid wrapper drops `overflow: hidden` + `borderRadius` (was
          there to clip the hairline-gap background to rounded corners)
          so the DateDivider inside can `position: sticky` against the
          page scroll. With overflow:hidden the wrapper became a
          non-scrolling containment block and sticky bound to it, which
          meant the divider never stuck. PR 2026-05-22 sticky dividers. */}
      <div style={gridStyle}>
        {visibleWithDividers.map((entry, idx) => (
          entry.kind === "divider" ? (
            <DateDivider
              key={`div-${idx}-${entry.label}`}
              label={entry.label}
              total={entry.total}
              meta={entry.meta}
              isFirst={idx === 0}
            />
          ) : (
            <Card key={entry.item.id} item={entry.item} wished={!!watchlist[entry.item.id]} onWish={handleWish} compact={compact} onHide={isAdmin ? toggleHide : undefined} isHidden={!!hidden[entry.item.id]} onAddToCollection={user ? openCollectionPicker : undefined} primaryCurrency={primaryCurrency} onShare={handleShare} onView={observeCard} onClickListing={onClickListing} />
          )
        ))}
        {allFiltered.length === 0 && (
          <div style={{ gridColumn: "1/-1" }}>
            {/* Saved with nothing saved is not a no-results state, it's an
                invite — so it gets the heart and the explanation rather than
                "Nothing matches" and a Clear-filters button that would do
                nothing. Once something IS saved, filters can empty the grid
                like anywhere else, and then the normal copy applies. */}
            <EmptyState
              icon={
                tab === "listings" && listingsSubTab === "saved" && !hasFilters
                  ? "♡" : undefined
              }
              heading={
                tab === "listings" && listingsSubTab === "saved"
                  ? (hasFilters ? "No saved watches match your filters" : "Nothing saved yet")
                  : tab === "listings" && listingsSubTab === "sold"
                  ? "No sold items match your filters"
                  : tab === "listings" && listingsSubTab === "auctions"
                  ? "No live auction lots match your filters"
                  : "Nothing matches"
              }
              blurb={
                tab === "listings" && listingsSubTab === "saved" && !hasFilters
                  ? "Tap the heart on any watch as you browse and it lands here, with the price you saved at, even after the dealer takes the listing down."
                  : hasFilters ? "Loosen the filters and the feed will fill back up." : undefined
              }
              action={hasFilters ? (
                <button onClick={resetFilters} style={actionButton()}>Clear filters</button>
              ) : undefined}
            />
          </div>
        )}
      </div>
      {hasMore && <div ref={loaderRef} style={{ padding: 24, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>More on the way…</div>}
      {!hasMore && allFiltered.length > 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>All {allFiltered.length} shown</div>}
    </>
  );

  // Auction calendar modal. Portals to body so it overlays correctly
  // regardless of shell stacking contexts (CLAUDE.md overlay pattern);
  // theme vars are mirrored to :root + font on body so it inherits.
  const calendarModalJSX = (calendarModalOpen && typeof document !== "undefined")
    ? createPortal(
        <div
          onClick={() => setCalendarModalOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(0,0,0,0.45)",
            display: "flex", flexDirection: "column",
            padding: isMobile ? 0 : "5vh 24px",
            alignItems: "center",
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg)", color: "var(--text1)",
              width: "100%", maxWidth: isMobile ? "100%" : 880,
              height: isMobile ? "100%" : "auto", maxHeight: isMobile ? "100%" : "90vh",
              borderRadius: isMobile ? 0 : 14, overflow: "hidden",
              display: "flex", flexDirection: "column",
              boxShadow: "0 24px 60px rgba(0,0,0,0.30)",
              fontFamily: "inherit",
            }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 12, padding: "14px 16px",
              background: "var(--brand-olive)", color: "#fff", flexShrink: 0,
              paddingTop: isMobile ? "calc(14px + env(safe-area-inset-top))" : 14,
            }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Auction Calendar</span>
              <button onClick={() => setCalendarModalOpen(false)}
                aria-label="Close calendar"
                style={{
                  border: "none", background: "transparent", cursor: "pointer",
                  color: "#fff", fontSize: 22, lineHeight: 1, padding: "0 4px",
                }}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: "8px 16px 24px", WebkitOverflowScrolling: "touch" }}>
              {auctionCalendarJSX}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  // Listings tab content — the card grid plus the (portaled) calendar
  // modal. The grid is the always-on base surface now; the calendar is
  // the on-demand overlay launched from the auctions grid's header.
  const listingsTabContentJSX = (
    <>
      {listingsGridJSX}
      {calendarModalJSX}
    </>
  );

  // PR_W (2026-05-22): cross-tab "Search all" destination. Renders
  // three strips (Live listings / Live auctions / Archive sold)
  // each filtered by the query, with "View all" links jumping to
  // the corresponding tab+sub-tab with the search preserved.
  // Editorial strip deferred to v2 (corpus loaded lazily in
  // EditorialView; lifting that up is its own change).
  const searchAllResultsJSX = (
    <React.Suspense fallback={null}>
    <SearchResultsView
      search={search}
      setSearch={setSearch}
      mainFeedItems={mainFeedItems}
      // Admin-removed articles drop from Search-all too (Mark 2026-06-06)
      articles={adminHidden.size ? searchAllArticles.filter(a => !adminHidden.has(shortHash(a.url))) : searchAllArticles}
      articleBodies={searchAllArticleBodies}
      auctionLotItems={auctionLotItems}
      isMobile={isMobile}
      gridStyle={gridStyle}
      watchlist={watchlist}
      handleWish={handleWish}
      hidden={hidden}
      toggleHide={toggleHide}
      primaryCurrency={primaryCurrency}
      openCollectionPicker={user ? openCollectionPicker : undefined}
      handleShare={handleShare}
      isAdmin={isAdmin}
      onClickListing={onClickListing}
      onViewAllLive={() => {
        setSearchAllActive(false);
        setTab("listings"); setListingsSubTab("live"); setPage(1);
      }}
      onViewAllAuctions={() => {
        setSearchAllActive(false);
        setTab("listings"); setListingsSubTab("auctions"); setPage(1);
      }}
      onViewAllSold={() => {
        setSearchAllActive(false);
        setTab("listings"); setListingsSubTab("sold"); setPage(1);
      }}
      onViewAllArticles={() => {
        setSearchAllActive(false);
        setTab("references"); setReferencesSubTab("editorial"); setPage(1);
      }}
      onExit={() => {
        setSearchAllActive(false);
        setSearch("");
        setTab("home"); setPage(1);
      }}
    />
    </React.Suspense>
  );

  // Identity band — RETIRED 2026-05-22 (Mark spec). PR_β extended
  // the olive chrome zone through brand + main-tabs + sub-tabs, so
  // the sub-tab strip itself now visually identifies the section.
  // The separate band below was doing a duplicate job. Mark: "the
  // identity bars could be taken off now right?"
  //
  // Count display ("3,548 watches") moves back to the filter row's
  // right edge — see DesktopShell + MobileShell filter rows.
  //
  // Const kept (= null) so shells still destructure
  // `identityBandJSX` without conditional logic at the call site.
  // Git history (#433 shipped it; this PR retired it) is the
  // reference for the old shape if it ever needs to come back.
  const identityBandJSX = null;


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

  // Listings tab sub-tab strip — the shared SubTabBar (segmented control
  // since audit:2026-06-06, horizontally scrollable). Mobile picks up the
  // olive bg to extend the colored chrome zone from brand+tabs down through
  // the sub-tabs (PR_β-A 2026-05-22); desktop is neutral + hairline divider.
  const listingsSubTabsJSX = tab !== "listings" ? null : (
    <SubTabBar
      ariaLabel="Listings views"
      // "For sale", not "Listings" (audit:2026-06-06 U-10): to a novice,
      // "Listings" under a tab called "Watches" is a near-synonym that adds
      // no meaning — outcome words make the row read as a real three-way
      // choice (for sale now / at auction / already sold). Internal key
      // stays `live`; only the label changes.
      // "Saved" (2026-07-30) is a fourth SLICE, not a fourth state: For sale /
      // Auctions / Sold are where a watch sits in the market, Saved is your
      // relationship to it, cutting across all three. It earns the slot
      // anyway because nothing else can show your saved set whole — see the
      // LISTINGS_SUB_VALUES note. Cards keep showing their own state, so the
      // row still reads honestly.
      tabs={[["live", "For sale"], ["auctions", "Auctions"], ["sold", "Sold"], ["saved", "♡ Saved"]]}
      activeKey={listingsSubTab}
      onSelect={(key) => { setListingsSubTab(key); setDrawerOpen(false); setPage(1); }}
      isMobile={isMobile}
      onOlive={isMobile}
      containerStyle={{
        background: isMobile ? "var(--brand-olive)" : "var(--bg)",
        borderBottom: isMobile ? "none" : "0.5px solid var(--border)",
      }}
    />
  );

  // referencesSubTabsJSX retired 2026-06-03 (IA restructure): Articles and
  // Reference Guides are top-level tabs now; the tools family (size / links /
  // challenges) launches from the account menu. The strip's job moved into
  // the shared top-tab model below.

  // Top-tab model — built once from TOP_TABS (src/topTabs.js), consumed by
  // BOTH shells and the HomeTab masthead. One source of truth for labels,
  // active state and click handling — the three render sites used to carry
  // their own inline arrays, which is exactly how labels drifted.
  const topTabs = TOP_TABS.map((t) => ({
    key: t.key,
    label: t.label,
    mobileLabel: t.mobileLabel || t.label,
    icon: t.icon,
    active: isTopTabActive(t, tab, referencesSubTab),
    onSelect: () => selectTopTab(t),
  }));

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
      activeFiltersStripJSX={activeFiltersStripJSX}
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
      hasFilters={hasFilters}
      resetFilters={resetFilters}
    />
  );

  // Admin tab JSX — only rendered by the shells when tab === "admin".
  // The component itself fetches its own data (verification.json,
  // verification_history.json, listings.json); we pass in-memory hearts
  // and hides because those come from Supabase via App.js hooks.
  const adminTabJSX = (
    <React.Suspense fallback={<div style={{ padding: 24, color: "var(--text2)" }}>Loading admin…</div>}>
      <AdminTab watchItems={watchItems} hiddenItems={hiddenItems} />
    </React.Suspense>
  );

  // Home tab JSX — step 1 (2026-05-11). The three slice memos
  // (homeRecentAdded / homeEndingNext / homeRecentSold) live ABOVE
  // the loading/loadError early returns higher up — moving them
  // here triggers React #310 because the hook count varies between
  // the loading render and the post-load render. Only the JSX const
  // sits here. See the load-bearing comment up there for the full
  // explanation.
  // Home is the magazine (Mark, 2026-09-07: "this page should be the new
  // landing page ... retire the old landing page"). It ran behind
  // ?view=magazine for a week of daily use first. Built ONCE and handed to
  // whichever shell renders it.
  const homeTabJSX = (
    <MagazineHome
      homeRecentAdded={homeRecentAdded}
      homeRecentSold={homeRecentSold}
      homeEndingNext={homeEndingNext}
      goToRecentAdded={() => { setTab("listings"); setListingsSubTab("live"); setPage(1); }}
      goToRecentSold={() => { setTab("listings"); setListingsSubTab("sold"); setPage(1); }}
      goToEndingNext={() => { setTab("listings"); setListingsSubTab("auctions"); setPage(1); }}
      // Admin-removed articles drop from the Home strip (Mark 2026-06-06)
      homeRecentArticles={adminHidden.size ? homeArticles.filter(a => !adminHidden.has(shortHash(a.url))) : homeArticles}
      homeSectionCounts={homeSectionCounts}
      // Magazine view extras: the auction top-lot artwork the calendar already
      // computes, so its rows can carry a picture rather than a bare line.
      homeAuctionHeroes={auctionHeroByUrl}
      // Auction houses are excluded from the magazine's dealer chips: their
      // listings sit behind the Auctions sub-tab, so a "For sale" filter by
      // house returns nothing.
      homeAuctionSources={AUCTION_SOURCES}
      // Resolved column count (Settings > Columns, Auto included) so the
      // magazine grids agree with the rest of the site.
      cols={cols}
      goToSavedHearts={() => { setTab("listings"); setListingsSubTab("saved"); setPage(1); }}
      // The magazine masthead's saved-watches button routes here. Watches >
      // (heart) Saved, matching the 2026-07-30 IA move.
      goToSavedHearts={() => { setTab("listings"); setListingsSubTab("saved"); setPage(1); }}
      // Auction module on Home (Epic 9 step 3): the same sale feed the
      // calendar reads, and the same two routes out of it, so the block on
      // Home and the calendar itself can't drift apart.
      homeAuctionSales={auctions || []}
      homeOpenSale={handleOpenSale}
      homeOpenCalendar={() => setCalendarModalOpen(true)}
      // Reference-guides row on Home (Epic 9 step 5). ReferenceBrowse reads
      // `?ref=` from the URL on mount, so the param has to be pushed BEFORE
      // the tab switch mounts it. The nav-sync effect below preserves unknown
      // params, so `ref` survives the tab/sub rewrite that follows.
      homeOpenGuide={(nodeId) => {
        try {
          const p = new URLSearchParams(window.location.search);
          if (nodeId) p.set("ref", nodeId); else p.delete("ref");
          p.set("tab", "learn");
          p.set("sub", "references");
          window.history.pushState({}, "", `?${p.toString()}`);
        } catch {}
        setReferencesSubTab("references");
        setTab("references");
        setPage(1);
      }}
      goToArticles={() => { setTab("references"); setReferencesSubTab("editorial"); setPage(1); }}
      homeSearchSubmit={(query, target) => {
        // Commit the typed query to App.js's existing `search` state
        // (which feeds `allFiltered`) and land on the chosen sub-tab.
        // Target values match listingsSubTab: live / auctions / sold.
        // PR_W (2026-05-22): target="all" opens the cross-tab strip
        // results view (SearchResultsView) instead of routing to a
        // specific Listings sub-tab.
        setSearch(query);
        if (target === "all") {
          setSearchAllActive(true);
          setPage(1);
          return;
        }
        setSearchAllActive(false);
        // Articles target (Mark 2026-06-06): land on the Articles tab —
        // EditorialView reads the same shared `search` state, so the
        // query applies on arrival.
        if (target === "articles") {
          setTab("references");
          setReferencesSubTab("editorial");
          setPage(1);
          return;
        }
        setTab("listings");
        setListingsSubTab(target);
        setPage(1);
      }}
      // Footer routes
      openAbout={() => setAboutModalOpen(true)}
      signInWithGoogle={triggerSignInPrompt}
      // Admin × overlay on Home cards writes here (Home-only hide).
      // Dealer typeahead — popover under the search bar suggests
      // matching dealer names when the user starts typing. Clicking
      // a dealer routes to Listings filtered by that source.
      homeDealerSources={DEALER_SOURCES}
      homeJumpToDealer={(name) => {
        setSearch("");
        setFilterSources([name]);
        setTab("listings");
        setListingsSubTab("live");
        setPage(1);
      }}
      isMobile={isMobile}
      watchlist={watchlist}
      hidden={hidden}
      handleWish={handleWish}
      toggleHide={isAdmin ? toggleHide : undefined}
      primaryCurrency={primaryCurrency}
      onShare={handleShare}
      onView={observeCard}
      onClickListing={onClickListing}
      openCollectionPicker={user ? openCollectionPicker : undefined}
      isAdmin={isAdmin}
      user={user}
      compact={compact}
      // (Feed-screening props retired 2026-05-22 — banner + Screen
      // pill that consumed them are gone. HomeTab destructures the
      // names but no surface renders them now.)
      dark={dark}
      // Masthead-nav: chrome moved into HomeTab on Home (PR 2026-05-22
      // γ). Tabs + auth render below the wordmark in an olive-bleed
      // band; top bar is suppressed on Home in both shells. About
      // trigger reuses openAbout above.
      homeMastheadTabs={topTabs}
      homeMastheadAuthJSX={authJSX}
      // Search-bar augmentations (PR 2026-05-22): recent-search
      // history surfaced on focus when input is empty, live per-
      // target counts when typing, live strip filtering from 2+
      // chars. See useRecentSearches + homeSearchCounts memo +
      // homeSearchLiveQuery callback above.
      homeRecentSearches={homeRecentSearches}
      homeAddRecentSearch={homeAddRecentSearch}
      homeRemoveRecentSearch={homeRemoveRecentSearch}
      // Saved searches as suggestions under the focused bar (Mark, 2026-10-16).
      homeSavedSearches={savedSearchStats}
      homeRunSavedSearch={runSearch}
      homeRemoveSavedSearch={removeSavedSearch}
      homeSearchCounts={homeSearchCounts}
      homeSearchLiveQuery={homeSearchLiveQuery}
    />
  );

  // References tab JSX. Watch Challenges moved out to the new
  // Collections tab on 2026-05-06 (PR #86); References (Cool Stuff)
  // now hosts only Watch size comparison + Links.
  const referencesTabJSX = (
    <ReferencesTab
      user={user}
      isAuthConfigured={isAuthConfigured}
      signInWithGoogle={triggerSignInPrompt}
      // Chrono24 per-reference listings are folded in here too so the
      // reference-guide page's market filter highlights them, matching the
      // main Listings feed (which includes them via mainFeedItems). Scoped to
      // chrono24Items only — other projections aren't part of the reference
      // filter today; broadening to mainFeedItems would be a separate call.
      allListings={[...items, ...chrono24Items]}
      // Re-tap of the active Reference Guides top pill bumps this (via
      // setTabWithReceiveEscape's same-tab branch); ReferenceBrowse uses it
      // to exit a drilled-in guide back to the index (P-15, 2026-06-03).
      resetTick={tab === "references" ? tabResetTick : 0}
      subTab={referencesSubTab}
      setSubTab={setReferencesSubTab}
      cols={cols}
      goToSavedHearts={() => { setTab("listings"); setListingsSubTab("saved"); setPage(1); }}
      compact={compact}
      gridStyle={gridStyle}
      isMobile={isMobile}
      // Heart-articles primitive (PR_P, 2026-05-20). Threaded through to
      // EditorialView so each ArticleCard can render its own heart state +
      // toggle. Articles share watchlist_items with listings; the snapshot
      // carries `kind: 'article'` so Watchlists' listing-only sub-tabs can
      // filter them out and the Saved-articles virtual row aggregates them.
      watchlist={watchlist}
      handleWish={handleWish}
      // Per-article "..." menu (PR_R, 2026-05-20). Same Add-to-list + Share
      // affordances dealer-listing Cards have. Add-to-list goes through
      // openCollectionPicker → addItemToCollection with kind='article' on
      // the snapshot; Share routes through handleShare (Web Share API →
      // clipboard fallback, same as dealer cards).
      openCollectionPicker={user ? openCollectionPicker : undefined}
      handleShare={handleShare}
      // Shared search state (2026-05-21): EditorialView consumes
      // App.js's global `search` so the top-bar input on Collecting
      // serves both Listings and Editorial. Typing travels across
      // tabs; placeholder adapts via the shells.
      search={search}
      setSearch={setSearch}
      // Admin article curation (Mark 2026-06-06): "Remove article" in the
      // card ⋯ menu writes the article's shortHash(url) id into
      // admin_hidden_listings — the same global blocklist the listings ×
      // overlay uses — so it disappears for every visitor (Articles tab,
      // Home strip, Search-all). Admin-gated here; RLS enforces it anyway.
      isAdmin={isAdmin}
      adminHidden={adminHidden}
      onAdminRemoveArticle={isAdmin ? (article) => {
        const id = shortHash(article.url);
        toggleAdminHidden(id, adminHidden.has(id), { reason: "article" });
      } : undefined}
      // Challenges plumbing (PR 2026-05-22, moved here from
      // CollectionsTab/Watchlists). Same prop bag ChallengesView
      // consumed before; just routed to the new mount point.
      collectionsApi={collectionsApi}
      hidden={hidden}
      primaryCurrency={primaryCurrency}
      pendingChallengeDrillId={pendingChallengeDrillId}
      clearPendingChallengeDrill={() => setPendingChallengeDrillId(null)}
      // Reference pages (2026-05-24): "View all" on a market slider deep-links
      // to Listings pre-filtered by the page's reference set (same pattern as
      // homeJumpToDealer). onClickListing carries the existing card telemetry.
      onViewAll={(refs, sub) => {
        setSearch("");
        setFilterSources([]); setFilterBrands([]); setFilterModels([]);
        setFilterRefs(Array.isArray(refs) ? refs : [refs]);
        setTab("listings");
        setListingsSubTab(sub || "live");
        setPage(1);
      }}
      onClickListing={onClickListing}
    />
  );

  // Collections-style tab content. Bundle 2A.2 (2026-05-07): the
  // standalone Collections top-level tab folded into Saved (internal
  // `tab=watchlist`); CollectionsTab itself renders unchanged but
  // it's now reached via Saved sub-tabs (my-collection / wishlist /
  // lists / challenges). The dispatch between WatchlistTab and
  // CollectionsTab content lives in `savedContentJSX` below — shells
  // Top-level Share tab retired 2026-05-14 (Mark spec). Its two roles
  // — discovery of incoming shared lists + send-a-list CTA — were
  // absorbed by Watchlists > Lists (SHARED WITH ME group) and the
  // per-list Share button respectively. `?tab=share` URLs fall through
  // to the default tab via TAB_VALUES's includes-check.

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
      savedAuctions={savedAuctionItems}
      onOpenSale={handleOpenSale}
      onToggleSaveAuction={user ? toggleSavedAuction : null}
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
      // B-08 unified Watchlists landing: searches + Watchbox now live
      // as sections on the one ListsView screen (no more Searches
      // sub-tab). Pass the same search-editor handles WatchlistTab got,
      // plus a Watchbox jump. The AddSearchModal (App-level) fires on
      // searchEditor.id === "new", so add/edit reuse it directly.
      isMobile={isMobile}
      goToWatchbox={() => { setTab("watchbox"); setPage(1); }}
      // The shared active-filters strip (chips + Clear all) — rendered at
      // the top of the Hearted surface so Lists gets the same clear/save
      // filter affordances as Watches (closes B-48 for this surface).
      activeFiltersStripJSX={activeFiltersStripJSX}
      pendingOpenListId={pendingOpenListId}
      clearPendingOpenList={() => setPendingOpenListId(null)}
      // Empty-list onboarding routes here to add watches/articles/guides.
      goToTab={(t, sub) => {
        setTab(t);
        if (t === "listings") setListingsSubTab(sub || "live");
        if (t === "references") setReferencesSubTab(sub || "editorial");
        setPage(1);
      }}
      savedSearchStats={savedSearchStats}
      searchEditor={searchEditor}
      setSearchEditor={setSearchEditor}
      startAddSearch={startAddSearch}
      startEditSearch={startEditSearch}
      cancelSearchEdit={cancelSearchEdit}
      commitSearch={commitSearch}
      removeSearch={removeSearch}
      runSearch={runSearch}
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

  // Watchbox tab (Mark spec 2026-05-14): re-uses the same
  // CollectionsTab component but pinned to the My Watches view.
  // Reached only via the avatar dropdown — no pill in the main nav
  // strip, no sub-tab strip above. Internal pre-tab-watchbox URLs
  // (?tab=watchlist&sub=my-collection) redirect to ?tab=watchbox on
  // init via the legacy-URL handler in setTab.
  const watchboxTabJSX = (
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
      // Force-pin to My Watches regardless of watchTopTab — Watchbox
      // is the surface; the Watchlists sub-tab strip isn't shown.
      collectionsSubTab="my-collection"
      setCollectionsSubTab={() => { /* fixed on Watchbox */ }}
      tabResetTick={tab === "watchbox" ? tabResetTick : 0}
      filterValues={{
        filterSources, filterBrands, search, sort,
        minPrice, maxPrice,
      }}
      onDrillInChange={setColDrillInId}
    />
  );

  // ── MOBILE ────────────────────────────────────────────────────────────────
  // (EndingSoon pinned strip retired 2026-05-04 — Watchlist > Saved
  // auctions sub-tab IS the ending-soon view now, with its own
  // ending-soonest default sort. Const + shellProps wiring removed
  // in the same cleanup pass.)

  // Lists sub-tab strip REBUILT 2026-06-01. The Lists tab is sub-tabbed
  // again — Hearted (default landing) · Lists · Searches · Shared — using
  // the shared SubTabBar so it's pixel-identical to the Listings /
  // Collecting strips. Lands on Hearted: the #1 fix (one tap to your
  // hearted watches, was two). All four route through CollectionsTab.
  const watchSubTabsJSX = tab !== "watchlist" ? null : (
    <SubTabBar
      ariaLabel="Lists views"
      tabs={[["hearted", "♡ Watches"], ["lists", "Lists"], ["searches", "Searches"]]}
      activeKey={watchTopTab}
      // Re-tapping the ACTIVE sub-tab returns to its landing (P-22, Mark
      // 2026-06-03): inside a drilled-in list, tapping "Lists" used to be a
      // no-op (only the "< All lists" breadcrumb exited). The bump feeds the
      // same tabResetTick CollectionsTab already watches to clear its
      // drill-in; the breadcrumb stays as the second door.
      onSelect={(key) => {
        if (key === watchTopTab) setTabResetTick((n) => n + 1);
        else setWatchTopTab(key);
        setDrawerOpen(false); setPage(1);
      }}
      isMobile={isMobile}
      onOlive={isMobile}
      containerStyle={{
        background: isMobile ? "var(--brand-olive)" : "var(--bg)",
        borderBottom: isMobile ? "none" : "0.5px solid var(--border)",
      }}
    />
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
        // "For sale" matches the Watches sub-tab rename (audit:2026-06-06
        // U-10) — same concept, same word everywhere. Keys unchanged.
        ["listings", "For sale"],
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
      onCreated={(id) => {
        setTab("watchlist");
        setWatchTopTab("lists");
        setPage(1);
        setPendingOpenListId(id);
      }}
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
    <>
      <CollectionPickerModal
        target={pickerTarget}
        setTarget={setPickerTarget}
        collections={collectionsApi.collections}
        itemsByCollection={collectionsApi.itemsByCollection}
        addItemToCollection={addItemToCollectionWithTelemetry}
        removeItemFromCollection={collectionsApi.removeItemFromCollection}
        createCollection={collectionsApi.createCollection}
      />
      <NotePickerModal
        noteText={notePickerText}
        setNoteText={setNotePickerText}
        collections={collectionsApi.collections}
        itemsByCollection={collectionsApi.itemsByCollection}
        createCollection={collectionsApi.createCollection}
        addNote={addNoteToCollection}
      />
    </>
  );

  // Settings modal — currency (cross-device) plus theme + columns
  // (per-device, was the standalone View popover before 2026-05-01)
  // and the About entry. Opened from the user dropdown.
  const settingsModalJSX = (
    <SettingsModal
      open={settingsModalOpen}
      onClose={() => setSettingsModalOpen(false)}
      user={user}
      displayName={displayName}
      setDisplayName={setDisplayName}
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
      // Lumé open_watch: App bumps openTick (+ openListingId) to open the
      // focused surface for a specific item in-app, no reload.
      openTick={shareOpenTick}
      openListingId={shareOpenId}
      // Action-bar verbs (2026-06-01): Add to list + Share onward.
      openCollectionPicker={user ? openCollectionPicker : undefined}
      handleShare={handleShare}
      // Seed the floating Lumé launcher with the shared item (Mark 2026-06-01).
      onSeedItem={setLumeSeedItem}
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
        // challenge. PR 2026-05-22: Challenges moved from Watchlists
        // to Collecting; receive flow now lands on
        // ?tab=references&sub=challenges. ReferencesTab forwards
        // pendingChallengeDrillId to ChallengesView for the drill-in.
        setPendingChallengeDrillId(id);
        setReferencesSubTab("challenges");
        setTabWithReceiveEscape("references");
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

  // Auction-catalog share-receive surface (Mark 2026-06-02). Same isolation
  // pattern — App mirrors one-bit `catalogShareActive`. The Share button on the
  // catalog header now emits `?catalog=<saleUrl>&shared=1`, landing here.
  const catalogReceiverJSX = (
    <CatalogReceiver
      user={user}
      isAuthConfigured={isAuthConfigured}
      signInWithGoogle={triggerSignInPrompt}
      salesByUrl={salesByUrl}
      lotsByAuctionUrl={lotsByAuctionUrl}
      auctionHeroByUrl={auctionHeroByUrl}
      lotCountsByAuctionUrl={lotCountsByAuctionUrl}
      savedAuctionUrlSet={savedAuctionUrlSet}
      toggleSavedAuction={user ? toggleSavedAuction : null}
      onOpenCatalog={(url) => { const s = salesByUrl.get(url); if (s) handleOpenSale(s); }}
      setCatalogShareActive={setCatalogShareActive}
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
  // When drilled into a real user-created list, show that list's
  // item count — pre-fix any drill-in showed the global saved-set
  // count (e.g. "311 watches") regardless of how many items the
  // drilled-in list actually contained. The synthetic __saved__ /
  // __hidden__ rows keep the previous dispatch (for __saved__ the
  // saved-set count IS the right answer; Hidden's drill-in body
  // shows its own count below the chrome).
  const drillInCollectionCount =
    colDrillInId && colDrillInId !== "__hidden__" && colDrillInId !== "__saved__"
      ? (collectionsApi.itemsByCollection?.[colDrillInId]?.length ?? null)
      : null;
  const displayedCount = drillInCollectionCount != null
    ? drillInCollectionCount
    : (tab === "watchlist" ? watchItems.length : allFiltered.length);

  // ---------------------------------------------------------------------
  // Watches in the magazine's clothes. Built 2026-09-08 as a parallel page at
  // `?view=watches`, PROMOTED to the default 2026-10-16 (Mark, after living
  // with it: "i now think it's better"). The old shell chrome is still one
  // param away at `?view=classic` — the way back, kept for a trial window and
  // then deleted along with the shells' Watches-only branches.
  //
  // `view` is not one of the params the nav-sync effect rewrites, and that
  // effect preserves params it doesn't own, so the opt-out survives tab and
  // sub-tab navigation without any extra plumbing.
  //
  // Read at render rather than through a useState initialiser: App.js has
  // early returns below, and a new hook here would be exactly the React #310
  // trap CLAUDE.md warns about.
  const magWatchesFlagged = isMagWatchesOn();
  // Only the Watches tab itself is restyled. Every takeover surface (share
  // receivers, cross-tab search, the auction-catalog full page) keeps the
  // shell, so nothing that isn't built yet can be reached through this page.
  const magWatchesActive = magWatchesFlagged
    && tab === "listings"
    && !shareActive && !challengeShareActive && !listShareActive && !catalogShareActive
    && !searchAllActive && !catalogFullPage;

  const magWatchesJSX = !magWatchesActive ? null : (
    <MagazineWatches
      isMobile={isMobile}
      baseStyle={baseStyle}
      tabs={topTabs}
      authJSX={authJSX}
      user={user}
      // The home affordance Mark asked to keep: the wordmark goes back to the
      // landing page, same as the shells' Home icon.
      onHome={() => { setTabWithReceiveEscape("home"); setPage(1); }}
      goToSaved={() => { setListingsSubTab("saved"); setPage(1); }}
      listingsSubTab={listingsSubTab}
      setListingsSubTab={setListingsSubTab}
      setPage={setPage}
      drawerOpen={drawerOpen}
      setDrawerOpen={setDrawerOpen}
      sectionHeadingStyle={sectionHeadingStyle}
      savedSearches={savedSearchStats}
      onRunSavedSearch={runSearch}
      onRemoveSavedSearch={removeSavedSearch}
      search={search}
      setSearch={setSearch}
      openFavPrompt={openFavPrompt}
      currentIsSaved={currentIsSaved}
      sort={sort}
      setSort={setSort}
      minPriceText={minPriceText}
      setMinPriceText={setMinPriceText}
      maxPriceText={maxPriceText}
      setMaxPriceText={setMaxPriceText}
      filterHearted={filterHearted}
      setFilterHearted={setFilterHearted}
      hasFilters={hasFilters}
      resetFilters={resetFilters}
      displayedCount={displayedCount}
      activeFilterPop={activeFilterPop}
      setActiveFilterPop={setActiveFilterPop}
      filterSources={filterSources}
      filterBrands={filterBrands}
      filterModels={filterModels}
      toggleSource={toggleSource}
      toggleBrand={toggleBrand}
      toggleModel={toggleModel}
      visibleSources={visibleSources}
      visibleBrands={visibleBrands}
      visibleModels={visibleModels}
      DEALER_SOURCES={DEALER_SOURCES}
      AUCTION_SOURCES={AUCTION_SOURCES}
      MODELS={MODELS}
      SOURCES_SHOW={SOURCES_SHOW}
      BRANDS_SHOW={BRANDS_SHOW}
      MODELS_SHOW={MODELS_SHOW}
      effectiveSourcesCount={effectiveSources.length}
      effectiveBrandsCount={effectiveBrands.length}
      effectiveModelsCount={effectiveModels.length}
      sourcesExpanded={sourcesExpanded}
      setSourcesExpanded={setSourcesExpanded}
      brandsExpanded={brandsExpanded}
      setBrandsExpanded={setBrandsExpanded}
      modelsExpanded={modelsExpanded}
      setModelsExpanded={setModelsExpanded}
      onOpenCalendar={() => setCalendarModalOpen(true)}
      // The grid, the cards and the calendar modal exactly as the shells get
      // them — this page restyles the chrome, it does not rebuild the feed.
      gridJSX={listingsTabContentJSX}
      // The overlays the shells render at their own tail. Miss one and a
      // control on this page (share, add-to-list, settings) opens nothing.
      overlaysJSX={
        <>
          {trackNewItemModalJSX}
          {addSearchModalJSX}
          {collectionEditModalJSX}
          {collectionPickerModalJSX}
          {settingsModalJSX}
          {favSearchModalJSX}
          {lotMigrationBannerJSX}
          {userLimitBannerJSX}
        </>
      }
      aboutModalOpen={aboutModalOpen}
      setAboutModalOpen={setAboutModalOpen}
      signInPromptOpen={signInPromptOpen}
      setSignInPromptOpen={setSignInPromptOpen}
      signInWithGoogle={signInWithGoogle}
      primaryCurrency={primaryCurrency}
    />
  );

  const shellProps = {
    // Auction calendar launcher (Phase 4) — both shells render a
    // "Calendar" pill on the filter row for the auction surfaces.
    onOpenCalendar: () => setCalendarModalOpen(true),
    // Catalog / config
    BRANDS, BRANDS_SHOW, SOURCES, SOURCES_SHOW,
    MODELS, MODELS_SHOW,
    // Effective list lengths drive the "+N more" chip — without
    // these, the chip text says "+107 more" even when the filter has
    // narrowed the rail to ~3 chips (Mark feedback 2026-05-20).
    effectiveBrandsCount: effectiveBrands.length,
    effectiveSourcesCount: effectiveSources.length,
    effectiveModelsCount: effectiveModels.length,
    DEALER_SOURCES, AUCTION_SOURCES,
    // State
    aboutModalOpen, activeFilterPop, allFiltered, displayedCount,
    brandsExpanded, currentIsSaved,
    drawerOpen,
    filterBrands, filterSources, filterModels, filterSaleUrls,
    listingsSubTab,
    referencesSubTab,
    hasFilters, hiddenItems,
    maxPriceText, minPriceText,
    filterHearted,
    search, signInPromptOpen, signInWithGoogle, sort, sourcesExpanded, modelsExpanded, tab, user,
    visibleBrands, visibleSources, visibleModels,
    watchTopTab, watchlist,
    // Setters / handlers
    handleWish, openFavPrompt, resetFilters,
    // Top-right "reach Saved from anywhere" heart link (Mark 2026-06-02).
    // Routes through setTabWithReceiveEscape (Mark 2026-06-03): the raw
    // setTab changed the tab state but left an active share-receive surface
    // covering the content, so on share pages the heart looked dead — the
    // wrapper dismisses the receiver (like the Home icon) before we route.
    // 2026-07-30: destination moved from Saved > ♡ Watches to Watches > ♡
    // Saved, the surface that now holds saved watches across every state.
    goToSaved: () => { setTabWithReceiveEscape("listings"); setListingsSubTab("saved"); setPage(1); },
    setAboutModalOpen, setActiveFilterPop, setBrandsExpanded,
    setDrawerOpen,
    setFilterBrands, setFilterHearted, setFilterSources, setFilterModels, setFilterSaleUrls,
    setListingsSubTab,
    setMaxPriceText, setMinPriceText,
    setPage, setSearch, setShowUserMenu, setSignInPromptOpen,
    setSort, setSourcePickerOpen, setSourcesExpanded, setModelsExpanded,
    // Wrapped: top-level nav from shells uses the wrapper so that
    // clicking the Watchlist logo or a main tab while a share-receive
    // surface is up auto-escapes (clears URL params + dismisses the
    // receiver) rather than leaving the recipient stuck. Internal
    // setTab callsites in App.js use the raw setTab.
    setTab: setTabWithReceiveEscape,
    toggleBrand, toggleHide, toggleSource, toggleModel, toggleSaleUrl,
    // Sale filter (PR 2026-05-22): catalog of active sales for the
    // Sale chip dropdown + lot counts.
    auctions, lotCountsByAuctionUrl,
    // Style tokens / pre-built JSX
    addSearchModalJSX,
    authJSX, baseStyle,
    collectionEditModalJSX, collectionPickerModalJSX,
    favSearchModalJSX,
    listingsGridJSX, listingsTabContentJSX, primaryCurrency, sectionHeadingStyle,
    // View-settings (currency / theme / columns) threaded into shells so
    // the same controls can render inline in the mobile filter drawer
    // and the desktop user menu (2026-05-09 — Mark feedback that
    // burying these in a Settings modal cost a tap users didn't have
    // patience for, especially currency while comparing prices).
    setPrimaryCurrency,
    dark, setDarkOverride,
    mobileCols, setMobileCols,
    desktopCols, setDesktopCols, desktopAutoCols,
    settingsModalJSX, shareReceiverJSX,
    challengeReceiverJSX,
    listReceiverJSX,
    catalogReceiverJSX,
    listingsSubTabsJSX,
    topTabs,
    // `?look=new` — the magazine's skin on the shells' top bar, every tab.
    // Read at render (not a hook: App.js has early returns above).
    lookNew: readLook() === "new",
    chromeFaces: readChromeFaces(),
    trackNewItemModalJSX, watchSubTabsJSX, watchHeartedToggleJSX, collectionsSubTabsJSX,
    saleContextHeaderJSX,
    // Auction catalog full-page takeover (Mark 2026-06-13). When
    // catalogFullPage, the shells suppress the masthead / main tabs /
    // sub-tabs and pin catalogBarJSX (green title bar + × back-to-calendar)
    // with catalogActionRowJSX (Save/Share/Auction-house) beneath it; the
    // filter bar + lot grid stay.
    catalogFullPage,
    catalogBarJSX,
    catalogActionRowJSX,
    savedHeaderJSX,
    // Bundle 2A.2: shells render `watchlistTabJSX` for the Saved
    // tab — the value is now the dispatched content (Watchlist or
    // Collections style) computed by `savedContentJSX`.
    watchlistTabJSX: savedContentJSX,
    watchboxTabJSX,
    adminTabJSX, referencesTabJSX, collectionsTabJSX, homeTabJSX,
    lotMigrationBannerJSX,
    userLimitBannerJSX,
    // Unified header band (PR_Y, 2026-05-21). Colored slab beneath
    // the controls row carrying section identity. Built per active
    // tab/sub-tab in App.js so the shells just render it; null on
    // Home and during share-receive surfaces.
    identityBandJSX,
    // PR_W (2026-05-22): cross-tab Search-all destination. When
    // `searchAllActive` is true, shells render this in place of
    // the regular tab content (and hide sub-tabs / band / filter
    // chrome). Main tab bar stays visible so the user can exit.
    searchAllResultsJSX,
    searchAllActive,
    // Whether a share-receive landing surface is taking over the
    // content area. Shells gate their normal tab content on any of
    // these flags — single-listing shares (#63), challenge shares
    // (v1.5), or list shares (List Sharing v1, 2026-05-07).
    shareActive,
    challengeShareActive,
    listShareActive,
    catalogShareActive,
    // Drill-in mirror so the shell can show the filter row when
    // we're inside a list (Watchlists > Lists > [list]).
    colDrillInId,
  };

  return (
    <ErrorBoundary>
      {/* The Watches tab swaps the shell for the magazine-styled page unless
          `?view=classic` is set. The swap is at the shell boundary, not
          inside it, so the shells' chrome is untouched — and ChatBubbleHost /
          ConfirmHost below still mount either way. */}
      {magWatchesActive
        ? magWatchesJSX
        : isMobile
        ? <MobileShell {...shellProps} />
        : <DesktopShell {...shellProps} />}
      <ConfirmHost />
      {/* The browser's tint follows whichever surface is at the top. */}
      <ChromeTint dark={dark}
        light={chromeIsLight({ tab, anyTakeover: anyTakeoverNow, magWatchesOn: magWatchesFlagged,
                               lookNew: shellProps.lookNew, catalogFullPage })} />
      <ChatBubbleHost
        seedItem={lumeSeedItem}
        liveItems={items}
        auctionLotItems={auctionLotItems}
        articles={adminHidden.size ? homeArticles.filter(a => !adminHidden.has(shortHash(a.url))) : homeArticles}
        watchlist={watchlist}
        savedSearches={userSearches}
        cardCtx={{
          watchlist, hidden, handleWish, isAdmin, toggleHide, user,
          openCollectionPicker, primaryCurrency, handleShare, observeCard, onClickListing,
        }}
      />
    </ErrorBoundary>
  );
}
