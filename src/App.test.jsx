import React from "react";
import { render, screen } from "@testing-library/react";

// App-level render-without-crash smoke test.
//
// Why this exists: between 2026-05-07 morning and evening, FOUR
// production white-screens shipped because regressions inside App.js
// or its child trees (CollectionsTab / ListsView) only manifested at
// real render time, and the existing shell smoke tests use
// `mockShellProps` which never renders the actual App / tab
// components.
//
// What this catches: TDZ const-ordering bugs (App.js:266 — useEffect
// deps array referenced `tab` declared further down), undefined-
// variable references inside child components (ListsView referenced
// `user` without destructuring), and any bare-import-time syntax
// failure.
//
// What this DOES NOT catch: errors that only surface on specific
// state transitions (e.g., drilling into a particular sub-tab). For
// those, add targeted tests in CollectionsTab.test.jsx /
// WatchlistTab.test.jsx.
//
// Mocking strategy: stub `./supabase` with no-op hook returns. The
// app's hooks are designed to no-op when Supabase isn't configured
// (see `isAuthConfigured`), so we lean on that path. Fetch is mocked
// to return empty arrays for listings.json and friends.

jest.mock("./supabase", () => {
  const noop = () => {};
  const noopAsync = async () => ({ error: null });
  const emptyHook = () => ({});
  return {
    supabase: null,
    isAuthConfigured: false,
    useAuth: () => ({ user: null, ready: true, signInWithGoogle: noop, signOut: noop }),
    useWatchlist: () => ({ items: {}, toggle: noopAsync }),
    useHidden: () => ({ items: {}, toggle: noopAsync }),
    useAdminHidden: () => ({ ids: new Set(), toggle: noopAsync }),
    useSearches: () => ({
      items: [],
      add: noopAsync, edit: noopAsync, remove: noopAsync,
    }),
    useTrackedLots: () => ({
      urls: [], addedAt: {}, add: noopAsync, remove: noopAsync,
    }),
    useCollections: () => ({
      collections: [],
      itemsByCollection: {},
      createCollection: noopAsync,
      renameCollection: noopAsync,
      deleteCollection: noopAsync,
      addItemToCollection: noopAsync,
      removeItemFromCollection: noopAsync,
      ensureSharedInbox: noopAsync,
      addToSharedInbox: noopAsync,
      uploadWatchPhoto: noopAsync,
      addManualItem: noopAsync,
      markItemAsSold: noopAsync,
      reorderItems: noopAsync,
      createChallenge: noopAsync,
      updateChallenge: noopAsync,
      addToShortlist: noopAsync,
      togglePickStatus: noopAsync,
      updateReasoning: noopAsync,
      inviteCollaborator: noopAsync,
      revokeCollaborator: noopAsync,
      acceptInvite: noopAsync,
      declineInvite: noopAsync,
      listCollaborators: async () => ({ error: null, rows: [] }),
      fetchPendingInvitesForMe: async () => ({ error: null, rows: [] }),
    }),
    useUserSettings: () => ({
      primaryCurrency: "USD",
      setPrimaryCurrency: () => {},
    }),
    importLocalData: noopAsync,
    emptyHook,
  };
});

// Mock the listings + auctions fetches so the loading spinner clears.
beforeEach(() => {
  global.fetch = jest.fn((url) => {
    if (typeof url === "string" && /listings\.json/.test(url)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });
  // matchMedia is used by useSystemDark. jsdom does NOT provide
  // matchMedia by default, so always assign (the previous typeof
  // guard skipped on jsdom because matchMedia was undefined-but-
  // accessible-as-property).
  Object.defineProperty(window, "matchMedia", {
    writable: true, configurable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false, media: query, onchange: null,
      addListener: jest.fn(), removeListener: jest.fn(),
      addEventListener: jest.fn(), removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
  // IntersectionObserver — used by Card via useEventTelemetry.
  if (typeof window.IntersectionObserver === "undefined") {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(() => {
  jest.resetAllMocks();
});

describe("App render-without-crash", () => {
  test("App imports without throwing", () => {
    // Module-load test — catches syntax errors and TDZ at parse time.
    // The require inside the test (rather than at module top) lets
    // jest.mock above take effect first.
    expect(() => require("./App")).not.toThrow();
  });

  test("App mounts on the default Listings tab without crashing", async () => {
    const { default: App } = require("./App");
    render(<App />);
    // The "Loading listings..." string appears during the
    // listings.json fetch and is replaced by tab chrome once loaded.
    // If App crashed during render, this query would throw with
    // "found multiple elements" or similar test errors before this
    // line is reached. Just asserting render-without-throw is the
    // value here.
    // (Specific UI assertions live in MobileShell / DesktopShell
    // tests; this test is a tripwire for App-level regressions.)
    expect(document.body).toBeInTheDocument();
  });
});
