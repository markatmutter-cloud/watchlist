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
    useCollectionBlocks: () => ({
      blocks: [], addBlock: noopAsync, removeBlock: noopAsync,
      updateNote: noopAsync, move: noopAsync,
    }),
    useTrackedLots: () => ({
      urls: [], addedAt: {}, add: noopAsync, remove: noopAsync,
    }),
    useSavedAuctions: () => ({
      urls: [], addedAt: {}, toggle: noopAsync,
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
      loaded: true,
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
    const u = typeof url === "string" ? url : String(url && url.url ? url.url : url);
    // The listings payload is `listings_live.json` (the live/sold split), NOT
    // `listings.json` — the old pattern here matched neither, so every App
    // test rendered the "Couldn't pull the listings" error screen and passed
    // vacuously (2026-09-08). Any array-shaped feed gets an array; the
    // manual-historical file gets its `{items}` envelope.
    if (/manual_historical/.test(u)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [] }) });
    }
    if (/listings|auctions|tracked_lots|lots|articles|corpus/.test(u)) {
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
    // Sanity: post-load chrome rendered. Asserted against the masthead
    // wordmark — the old /Listings/i matcher also matched the load-error
    // screen's "Couldn't pull the listings", so it passed even when nothing
    // rendered (2026-09-08, found when the fetch mock above was fixed).
    expect(screen.getAllByText("Watchlist").length).toBeGreaterThan(0);
  });

  test("the Watches tab mounts the magazine page by default", async () => {
    // Promoted to the default 2026-10-16. Asserted here as well as in
    // MagazineWatches.test.jsx because the wiring — not the component — is
    // what a refactor breaks: this is the only test that proves App still
    // swaps the shell for the page. `?view=watches` (the old parallel-page
    // URL) must keep landing on the same thing.
    window.history.replaceState({}, "", "/?view=watches");
    const { default: App } = require("./App");
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
    });
    // Keyed on the shared frame's wrapper: the legacy shells' sub-tabs were ALSO
    // role=tab "For sale", so a role query can't tell the two apart.
    expect(document.querySelector(".ui-page")).not.toBeNull();
    expect(document.querySelector("[data-desktop-main]")).toBeNull();
    // The home affordance Mark asked to keep.
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    window.history.replaceState({}, "", "/");
  });

  test("?tab=listings with no view param is the magazine page too", async () => {
    // The promotion itself: no flag needed any more.
    window.history.replaceState({}, "", "/?tab=listings");
    const { default: App } = require("./App");
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
    });
    expect(document.querySelector(".ui-page")).not.toBeNull();
    window.history.replaceState({}, "", "/");
  });

  test("the browser tint follows the page: paper on every page, so never olive over a light one", async () => {
    // Mark, 2026-10-16: an olive toolbar over a light Watches page "looks
    // weird". The tint used to be olive on every tab but Home.
    const tint = () => document.querySelector('meta[name="theme-color"]:not([media])').getAttribute("content");
    document.head.insertAdjacentHTML("beforeend", '<meta name="theme-color" content="#3b4a36" />');
    window.history.replaceState({}, "", "/?tab=listings");
    const { default: App } = require("./App");
    const first = render(<App />);
    await waitFor(() => {
      expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
    });
    expect(tint()).toBe("#ffffff");
    first.unmount();
    // Watches is the shared page whatever the look flag says (there is no classic Watches
    // any more), so ?look=old does not turn its toolbar olive.
    window.history.replaceState({}, "", "/?tab=listings&look=old");
    const second = render(<App />);
    await waitFor(() => {
      expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
    });
    expect(tint()).toBe("#ffffff");
    second.unmount();
    // ...and no page keeps the olive bar any more, so Watchbox is paper too.
    window.history.replaceState({}, "", "/?tab=watchbox&look=old");
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
    });
    expect(tint()).toBe("#ffffff");
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
    window.localStorage.removeItem("dial_look"); // ?look=old is sticky
    window.history.replaceState({}, "", "/");
  });

  test("Articles and Guides seat their search in the header, like Watches", async () => {
    // Mark, 2026-10-17: "all still different size boxes and y axis locations". One search, one
    // place: the header, on every page that has one.
    const { default: App } = require("./App");
    for (const url of ["/?tab=listings", "/?tab=references&sub=editorial", "/?tab=references&sub=references"]) {
      window.history.replaceState({}, "", url);
      const r = render(<App />);
      await waitFor(() => {
        expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(document.querySelector(".magb-bar input[type='search']")).not.toBeNull();
      });
      // exactly one search on the page, and none inside the filter bar
      expect(document.querySelectorAll(".ui-page input[type='search']").length).toBe(1);
      expect(document.querySelector(".ui-filterbar input[type='search']")).toBeNull();
      r.unmount();
    }
    window.history.replaceState({}, "", "/");
  });

  test("Home on a phone wears the shared header, with its search in the header's search row", async () => {
    const prev = window.innerWidth;
    window.innerWidth = 390;
    window.history.replaceState({}, "", "/");
    const { default: App } = require("./App");
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(document.querySelector(".ui-page-stick .ui-page-search input[type='search']")).not.toBeNull();
    });
    // the same three header rows as every other page, and no masthead of Home's own
    expect(document.querySelector(".magb-brand")).not.toBeNull();
    expect(document.querySelector(".magb-tabs")).not.toBeNull();
    expect(document.querySelector(".mag-mhead")).toBeNull();
    expect(document.querySelectorAll(".ui-page input[type='search']").length).toBe(1);
    window.innerWidth = prev;
    window.history.replaceState({}, "", "/");
  });

  test("?view=styleguide mounts the live style sheet", async () => {
    // The reference page for the shared frame (src/ui). Not a tab: reached only
    // by the URL flag, so this is the one test that proves the wiring.
    window.history.replaceState({}, "", "/?view=styleguide");
    const { default: App } = require("./App");
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText("One definition per piece")).toBeInTheDocument();
    window.history.replaceState({}, "", "/");
  });

  test("Articles and Reference Guides are built from src/ui (PageShell), not the legacy shells", async () => {
    // Migrated 2026-10-17 (Mark: one definition per piece). The real wiring: App picks
    // PageShell for these two subs and nothing else.
    for (const url of ["/?tab=references&sub=editorial", "/?tab=references&sub=references"]) {
      window.history.replaceState({}, "", url);
      const { default: App } = require("./App");
      const r = render(<App />);
      await waitFor(() => {
        expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
      });
      expect(document.querySelector(".ui-page")).not.toBeNull();
      expect(document.querySelector(".magb-bar, .magb-brand")).not.toBeNull();
      expect(document.querySelector("[data-desktop-main]")).toBeNull();
      r.unmount();
    }
    window.history.replaceState({}, "", "/");
  });

  test("the tools under the references container (size comparison) are built from src/ui too", async () => {
    window.history.replaceState({}, "", "/?tab=references&sub=size");
    const { default: App } = require("./App");
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
    });
    expect(document.querySelector(".ui-page")).not.toBeNull();
    expect(document.querySelector("[data-desktop-main]")).toBeNull();
    window.history.replaceState({}, "", "/");
  });

  test("Home is built from src/ui as well: no shell pane, its own masthead, the page's inset", async () => {
    window.history.replaceState({}, "", "/");
    const { default: App } = require("./App");
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
    });
    expect(document.querySelector(".ui-page .ui-home")).not.toBeNull();
    expect(document.querySelector("[data-desktop-main]")).toBeNull();
    // Home brings its own masthead, so the shared header is not rendered above it.
    expect(document.querySelector(".magb-bar")).toBeNull();
    window.history.replaceState({}, "", "/");
  });

  test("Watchbox is built from src/ui as well", async () => {
    window.history.replaceState({}, "", "/?tab=watchbox");
    const { default: App } = require("./App");
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
    });
    expect(document.querySelector(".ui-page")).not.toBeNull();
    expect(document.querySelector("[data-desktop-main]")).toBeNull();
    window.history.replaceState({}, "", "/");
  });

  test("?view=classic is gone: Watches is always the shared page", async () => {
    // The classic Watches (the shells' own chrome) was retired 2026-10-17 with the move
    // onto src/ui; an old bookmark with the param must still land on the page.
    window.history.replaceState({}, "", "/?tab=listings&view=classic");
    const { default: App } = require("./App");
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
    });
    expect(document.querySelector(".ui-page")).not.toBeNull();
    expect(document.querySelector("[data-desktop-main]")).toBeNull();
    expect(screen.getByRole("tab", { name: "For sale" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    window.history.replaceState({}, "", "/");
  });
});
