import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

// The account ("M") menu, signed in, through the REAL App. Mark, 2026-10-16:
// Lists moved here when the Saved top tab was retired. App.test.jsx runs with
// auth unconfigured, so the menu never renders there; this file mocks a
// signed-in user so the entry is exercised, not just compiled.
//
// (Mock + fixtures copied from App.test.jsx; keep them in step.)

jest.mock("./supabase", () => {
  const noop = () => {};
  const noopAsync = async () => ({ error: null });
  const emptyHook = () => ({});
  return {
    supabase: null,
    isAuthConfigured: true,
    useAuth: () => ({ user: { id: "u1", email: "mark@example.com", user_metadata: { name: "Mark" } }, ready: true, signInWithGoogle: noop, signOut: noop }),
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


describe("account menu (signed in)", () => {
  afterEach(() => { window.history.replaceState({}, "", "/"); });

  test("offers Lists, and tapping it opens the Lists container", async () => {
    window.history.replaceState({}, "", "/");
    const { default: App } = require("./App");
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("button", { name: "Lists" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My Watchbox" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lists" }));
    await waitFor(() => {
      // The container is still tab="watchlist" (URL key "saved"), opened on Lists.
      expect(window.location.search).toMatch(/tab=saved/);
      expect(window.location.search).toMatch(/sub=lists/);
    });
  });

  test("there is no Saved top tab", async () => {
    window.history.replaceState({}, "", "/");
    const { default: App } = require("./App");
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Saved" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Articles" }).length).toBeGreaterThanOrEqual(1);
  });

  test("the account control is the shared olive disc on every tab, and an outside press closes the menu", async () => {
    window.history.replaceState({}, "", "/?tab=listings");
    const { default: App } = require("./App");
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByText(/Pulling the latest listings/i)).not.toBeInTheDocument();
    });
    const disc = screen.getByRole("button", { name: "Account menu" });
    expect(disc).toHaveClass("ui-disc");
    expect(disc).toHaveTextContent("M");
    fireEvent.click(disc);
    expect(screen.getByRole("button", { name: "Lists" })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("button", { name: "Lists" })).not.toBeInTheDocument();
  });
});
