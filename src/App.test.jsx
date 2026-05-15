import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

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
      acceptInviteByToken: noopAsync,
      fetchInviteByToken: async () => ({ invite: null }),
      declineInvite: noopAsync,
      listCollaborators: async () => ({ error: null, rows: [] }),
      fetchPendingInvitesForMe: async () => ({ error: null, rows: [] }),
      fetchListMembers: async () => ({ error: null, members: [] }),
      updateWatchDetails: noopAsync,
      toggleFlagForSale: noopAsync,
      fetchComments: async () => ({ error: null, rows: [] }),
      postComment: async () => ({ error: null, row: null }),
      deleteComment: noopAsync,
      fetchReactions: async () => ({ error: null, rows: [] }),
      toggleReaction: async () => ({ error: null }),
      fetchReactionCounts: async () => ({ error: null, counts: new Map() }),
    }),
    useUserSettings: () => ({
      primaryCurrency: "USD",
      setPrimaryCurrency: () => {},
    }),
    useUserProfile: () => ({
      displayName: "",
      setDisplayName: noopAsync,
      loaded: true,
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
    // Synchronous-mount tripwire. The traversal test below catches
    // the post-load hook-count regression class; this one catches
    // anything that throws during the initial render before the
    // early `if (loading) return …` even fires.
    expect(document.body).toBeInTheDocument();
  });

  test("App renders past loading state without crashing (React #310 tripwire)", async () => {
    // This test catches the hooks-past-early-return regression class
    // (React error #310 — "rendered more hooks than during the
    // previous render"). The loading/loadError early returns at
    // App.js:2401-2402 short-circuit rendering before any later
    // useState / useCallback / useMemo executes. When loading flips
    // false after the listings.json fetch resolves, every hook past
    // the early return executes for the first time — and any added
    // there since the previous render bumps the hook count, which
    // React refuses to accept.
    //
    // Bit production THREE TIMES: the Collections + Sharing build
    // (twice), then PR #290 hotfix 2026-05-14 when an auction
    // useCallback shipped past the early returns. The sync-mount
    // test above doesn't see this — it asserts mid-loading, before
    // the transition. This test forces the transition.
    const { default: App } = require("./App");
    render(<App />);
    await waitFor(() => {
      // The loading message disappears once `loading` flips false.
      expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
    });
    // Sanity: post-load chrome rendered.
    expect(screen.getAllByText(/Listings/i).length).toBeGreaterThan(0);
  });
});
