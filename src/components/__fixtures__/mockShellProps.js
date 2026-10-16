// Mock props bag for MobileShell + DesktopShell tests. The shells
// destructure ~60 named props from a single bag; missing one mid-render
// surfaces as a confusing "undefined.length" or similar. This fixture
// is the canonical default — tests override individual fields rather
// than building from scratch.
//
// Keep the keys aligned with the destructure lists at the top of each
// shell. When you add a prop to a shell, add it here too — otherwise
// the smoke tests stop catching missing-prop regressions.

import React from "react";

const noop = () => {};

export function buildMockShellProps(overrides = {}) {
  return {
    // Catalog / config
    BRANDS: ["Rolex", "Omega"],
    BRANDS_SHOW: 12,
    SOURCES: ["Wind Vintage", "Menta"],
    SOURCES_SHOW: 6,
    MODELS: [],
    MODELS_SHOW: 8,
    DEALER_SOURCES: ["Wind Vintage", "Menta"],
    AUCTION_SOURCES: ["Antiquorum"],

    // State (defaults: a fresh, signed-in-but-empty session)
    aboutModalOpen: false,
    activeFilterPop: null,
    allFiltered: [],
    // displayedCount drives the "0 watches" badge on the desktop filter
    // row and the "Show 0 watches" CTA in the mobile drawer. Added to
    // shellProps in PR #38 (was allFiltered.length until then); mock
    // mirrors the empty-session value of 0.
    displayedCount: 0,
    brandsExpanded: false,
    currentIsSaved: false,
    drawerOpen: false,
    filterBrands: [],
    filterHearted: false,
    filterSources: [],
    filterModels: [],
    modelsExpanded: false,
    visibleModels: [],
    listingsSubTab: "live",
    referencesSubTab: "editorial",
    hasFilters: false,
    activeFiltersStripJSX: null,
    saleContextHeaderJSX: null,
    catalogFullPage: false,
    catalogBarJSX: null,
    catalogActionRowJSX: null,
    hiddenItems: [],
    maxPriceText: "",
    minPriceText: "",
    search: "",
    signInPromptOpen: false,
    signInWithGoogle: noop,
    sort: "date",
    sourcesExpanded: false,
    tab: "watchlist",
    user: { id: "test-user", email: "test@example.com" },
    visibleBrands: ["Rolex", "Omega"],
    visibleSources: ["Wind Vintage", "Menta"],
    watchTopTab: "hearted",
    watchlist: {},

    // Setters / handlers — all noops by default
    handleWish: noop,
    goToSaved: noop,
    openFavPrompt: noop,
    onOpenCalendar: noop,
    resetFilters: noop,
    setAboutModalOpen: noop,
    setActiveFilterPop: noop,
    setBrandsExpanded: noop,
    setDrawerOpen: noop,
    setFilterBrands: noop,
    setFilterHearted: noop,
    setFilterSources: noop,
    setListingsSubTab: noop,
    setMaxPriceText: noop,
    setMinPriceText: noop,
    setPage: noop,
    setSearch: noop,
    setShowUserMenu: noop,
    setSignInPromptOpen: noop,
    setSort: noop,
    setSourcePickerOpen: noop,
    setSourcesExpanded: noop,
    setTab: noop,
    toggleBrand: noop,
    toggleHide: noop,
    toggleSource: noop,
    toggleModel: noop,
    setFilterModels: noop,
    setModelsExpanded: noop,

    // Style tokens / pre-built JSX placeholders
    addSearchModalJSX: null,
    authJSX: null,
    baseStyle: { background: "var(--bg)", color: "var(--text1)" },
    collectionEditModalJSX: null,
    collectionPickerModalJSX: null,
    favSearchModalJSX: null,
    listingsGridJSX: <div data-testid="listings-grid" />,
    listingsTabContentJSX: <div data-testid="listings-tab-content" />,
    listingsSubTabsJSX: <div data-testid="listings-sub-tabs" />,
    // Top-tab model (2026-06-03 IA: Watches · Saved · Articles · Reference
    // Guides) — mirrors what App.js builds from src/topTabs.js.
    // referencesSubTabsJSX retired the same pass.
    topTabs: [
      { key: "listings",  label: "Watches",  mobileLabel: "Watches",  icon: "listings",   active: false, onSelect: noop },
      { key: "watchlist", label: "Saved",    mobileLabel: "Saved",    icon: "watchlist",  active: true,  onSelect: noop },
      { key: "articles",  label: "Articles", mobileLabel: "Articles", icon: "articles",   active: false, onSelect: noop },
      { key: "guides", label: "Reference Guides", mobileLabel: "Guides", icon: "references", active: false, onSelect: noop },
    ],
    // `?look=new` — off in the fixture; the shell tests that need it pass it.
    lookNew: false,
    chromeFaces: "system",
    lotMigrationBannerJSX: null,
    userLimitBannerJSX: null,
    identityBandJSX: null,
    searchAllResultsJSX: null,
    searchAllActive: false,
    challengeReceiverJSX: null,
    listReceiverJSX: null,
    catalogReceiverJSX: null,
    shareActive: false,
    challengeShareActive: false,
    listShareActive: false,
    catalogShareActive: false,
    colDrillInId: null,
    primaryCurrency: "USD",
    setPrimaryCurrency: () => {},
    dark: false,
    setDarkOverride: () => {},
    mobileCols: 2,
    setMobileCols: () => {},
    desktopCols: "auto",
    setDesktopCols: () => {},
    desktopAutoCols: 5,
    sectionHeadingStyle: { fontSize: 11, fontWeight: 600 },
    settingsModalJSX: null,
    shareReceiverJSX: null,
    savedHeaderJSX: null,
    statusSegmentJSX: null,
    trackNewItemModalJSX: null,
    // B-08: the Watchlists sub-tab strip was retired (the tab is one
    // unified single-scroll screen). App passes null for this slot now.
    watchSubTabsJSX: null,
    watchHeartedToggleJSX: null,
    collectionsSubTabsJSX: <div data-testid="collections-sub-tabs" />,
    endingSoonJSX: null,
    watchlistTabJSX: <div data-testid="watchlist-tab" />,
    watchboxTabJSX: <div data-testid="watchbox-tab" />,
    adminTabJSX: <div data-testid="admin-tab" />,
    referencesTabJSX: <div data-testid="references-tab" />,
    collectionsTabJSX: <div data-testid="collections-tab" />,
    homeTabJSX: <div data-testid="home-tab" />,

    ...overrides,
  };
}
