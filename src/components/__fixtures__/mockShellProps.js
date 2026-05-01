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

    // State (defaults: a fresh, signed-in-but-empty session)
    aboutModalOpen: false,
    activeFilterPop: null,
    allFiltered: [],
    brandsExpanded: false,
    currentIsSaved: false,
    dark: false,
    desktopAutoCols: 5,
    desktopCols: "auto",
    drawerOpen: false,
    filterAuctionsOnly: false,
    filterBrands: [],
    filterSources: [],
    hasFilters: false,
    hiddenItems: [],
    hiddenModalOpen: false,
    maxPriceText: "",
    minPriceText: "",
    mobileCols: 2,
    search: "",
    sort: "date",
    sourcesExpanded: false,
    tab: "watchlist",
    user: { id: "test-user", email: "test@example.com" },
    viewMenuOpen: false,
    visibleBrands: ["Rolex", "Omega"],
    visibleSources: ["Wind Vintage", "Menta"],
    watchTopTab: "listings",
    watchlist: {},

    // Setters / handlers — all noops by default
    handleWish: noop,
    openFavPrompt: noop,
    resetFilters: noop,
    setAboutModalOpen: noop,
    setActiveFilterPop: noop,
    setBrandsExpanded: noop,
    setDarkOverride: noop,
    setDesktopCols: noop,
    setDrawerOpen: noop,
    setFilterAuctionsOnly: noop,
    setFilterBrands: noop,
    setFilterSources: noop,
    setHiddenModalOpen: noop,
    setMaxPriceText: noop,
    setMinPriceText: noop,
    setMobileCols: noop,
    setPage: noop,
    setSearch: noop,
    setShowUserMenu: noop,
    setSort: noop,
    setSourcePickerOpen: noop,
    setSourcesExpanded: noop,
    setTab: noop,
    setViewMenuOpen: noop,
    toggleBrand: noop,
    toggleHide: noop,
    toggleSource: noop,

    // Style tokens / pre-built JSX placeholders
    addSearchModalJSX: null,
    authJSX: null,
    baseStyle: { background: "var(--bg)", color: "var(--text1)" },
    collectionEditModalJSX: null,
    collectionPickerModalJSX: null,
    favSearchModalJSX: null,
    inp: { border: "none", padding: "8px 10px" },
    listingsGridJSX: <div data-testid="listings-grid" />,
    sectionHeadingStyle: { fontSize: 11, fontWeight: 600 },
    sharedListingJSX: null,
    statusSegmentJSX: <div data-testid="status-segment" />,
    trackNewItemModalJSX: null,
    watchSubTabsJSX: <div data-testid="watch-sub-tabs" />,
    watchlistTabJSX: <div data-testid="watchlist-tab" />,

    ...overrides,
  };
}
