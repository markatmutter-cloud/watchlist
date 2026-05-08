import React from "react";
import { render } from "@testing-library/react";
import { WatchlistTab } from "./WatchlistTab";

// Render-without-crash smoke tests for WatchlistTab + its sub-views
// (saved listings / saved auctions / saved sold / searches).
//
// Same rationale as CollectionsTab.test.jsx — the existing shell
// smoke tests use mockShellProps and never render this component
// tree. Multiple regressions slipped through in the 2026-05-07
// session that would have been caught by these tests.

const noop = () => {};
const noopAsync = async () => ({ error: null });

const baseUser = { id: "test-user", email: "test@example.com" };

function buildProps(overrides = {}) {
  return {
    user: baseUser,
    signInWithGoogle: noop,
    isAuthConfigured: true,
    watchlist: {},
    watchItems: [],
    watchCount: 0,
    toggleWatchlist: noopAsync,
    savedSearchStats: [],
    searchEditor: null,
    setSearchEditor: noop,
    startAddSearch: noop,
    startEditSearch: noop,
    cancelSearchEdit: noop,
    commitSearch: noopAsync,
    removeSearch: noopAsync,
    runSearch: noop,
    handleWish: noop,
    compact: false,
    gridStyle: { display: "grid" },
    isMobile: false,
    sort: "date",
    watchTopTab: "listings",
    setWatchTopTab: noop,
    // legacyLocal is always { watchlist: {}, hidden: {} } in App.js's
    // initializer (it parses LEGACY_WATCHLIST_KEY / LEGACY_HIDDEN_KEY
    // from localStorage with a `|| "{}"` fallback). Mirror that shape
    // here — passing null crashes WatchlistTab's `legacyCounts` deref.
    legacyLocal: { watchlist: {}, hidden: {} },
    importState: { phase: "idle" },
    setImportState: noop,
    legacyKeys: { watchlist: "x", hidden: "y" },
    setTab: noop,
    setPage: noop,
    openCollectionPicker: noop,
    primaryCurrency: "USD",
    handleShare: noop,
    observeCard: noop,
    onClickListing: noop,
    ...overrides,
  };
}

describe("WatchlistTab render-without-crash", () => {
  test("Saved listings sub-tab (default) renders without throwing", () => {
    expect(() => {
      render(<WatchlistTab {...buildProps({ watchTopTab: "listings" })} />);
    }).not.toThrow();
  });

  test("Saved auctions sub-tab renders without throwing", () => {
    expect(() => {
      render(<WatchlistTab {...buildProps({ watchTopTab: "auctions" })} />);
    }).not.toThrow();
  });

  test("Saved sold sub-tab renders without throwing", () => {
    expect(() => {
      render(<WatchlistTab {...buildProps({ watchTopTab: "sold" })} />);
    }).not.toThrow();
  });

  test("Favorite searches sub-tab renders without throwing", () => {
    expect(() => {
      render(<WatchlistTab {...buildProps({ watchTopTab: "searches" })} />);
    }).not.toThrow();
  });

  test("Signed-out user falls through cleanly (no crash)", () => {
    expect(() => {
      render(<WatchlistTab {...buildProps({ user: null })} />);
    }).not.toThrow();
  });
});
