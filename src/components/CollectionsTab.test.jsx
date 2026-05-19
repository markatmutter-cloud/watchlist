import React from "react";
import { render, screen } from "@testing-library/react";
import { CollectionsTab } from "./CollectionsTab";

// Render-without-crash smoke tests for CollectionsTab + its sub-views
// (MyCollectionView / ListsView / ChallengesView). The Shortlist
// view consolidated into MyCollectionView in 2026-05-08 (Bundle
// 2A.2b 5→4) — the "wishlist" sub-tab still routes through here for
// URL backward-compat, hitting MyCollectionView with the toggle in
// shortlist mode.
//
// Why these exist: production white-screened twice on this component
// in a single session — once from a `props.tabResetTick` typo (props
// not destructured) and once from a `user is not defined` reference
// inside ListsView. Both shipped because the existing shell smoke
// tests use mockShellProps which never renders this component tree.
//
// Each test renders one sub-tab path with the minimum mock shape
// CollectionsTab needs. The asserts are deliberately weak — the
// goal is "did the component throw or not", not "does this string
// appear in the DOM". Specific UI assertions live in component-
// internal tests if/when those are added.

const noop = () => {};
const noopAsync = async () => ({ error: null });

const baseUser = { id: "test-user", email: "test@example.com" };

const baseCollectionsApi = {
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
};

function buildProps(overrides = {}) {
  return {
    user: baseUser,
    isAuthConfigured: true,
    signInWithGoogle: noop,
    collectionsApi: baseCollectionsApi,
    hiddenItems: [],
    toggleHide: noop,
    watchlist: {},
    watchItems: [],
    hidden: {},
    allListings: [],
    primaryCurrency: "USD",
    handleShare: noop,
    handleWish: noop,
    compact: false,
    gridStyle: { display: "grid" },
    setEditingCollection: noop,
    openCollectionPicker: noop,
    startCreateCollection: noop,
    observeCard: noop,
    onClickListing: noop,
    pendingChallengeDrillId: null,
    clearPendingChallengeDrill: noop,
    collectionsSubTab: "my-collection",
    setCollectionsSubTab: noop,
    tabResetTick: 0,
    ...overrides,
  };
}

describe("CollectionsTab render-without-crash", () => {
  test("My watches sub-tab (default) renders without throwing", () => {
    expect(() => {
      render(<CollectionsTab {...buildProps({ collectionsSubTab: "my-collection" })} />);
    }).not.toThrow();
  });

  test("Shortlist sub-tab renders without throwing", () => {
    // Wishlist requires a `wishlist` system collection — without one
    // the empty-state path fires, which is what we want to exercise.
    expect(() => {
      render(<CollectionsTab {...buildProps({ collectionsSubTab: "wishlist" })} />);
    }).not.toThrow();
  });

  test("Lists sub-tab renders without throwing (no lists yet)", () => {
    expect(() => {
      render(<CollectionsTab {...buildProps({ collectionsSubTab: "lists" })} />);
    }).not.toThrow();
  });

  test("Challenges sub-tab renders without throwing", () => {
    expect(() => {
      render(<CollectionsTab {...buildProps({ collectionsSubTab: "challenges" })} />);
    }).not.toThrow();
  });

  test("Editorial sub-tab renders without throwing", () => {
    // EditorialView fetches `/hairspring_finds.json` + `/bring_a_loupe.json`
    // on mount; jsdom's fetch implementation rejects, the component lands
    // in the loadError or empty state without throwing. That's the path
    // we want to keep regression-tested.
    const origFetch = global.fetch;
    global.fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    try {
      expect(() => {
        render(<CollectionsTab {...buildProps({ collectionsSubTab: "editorial" })} />);
      }).not.toThrow();
    } finally {
      global.fetch = origFetch;
    }
  });

  test("Lists sub-tab drill-in (selected list) renders without throwing", () => {
    // Mark's report 2026-05-07: ListsView crashed with "user is not
    // defined" when navigating into a list. This is the regression
    // test — set selectedListId via URL so the drill-in branch fires.
    const stub = {
      ...baseCollectionsApi,
      collections: [{
        id: "list-uuid",
        name: "Test list",
        description: null,
        type: "free-form",
        userId: "test-user",
        isSharedInbox: false,
        isSystem: false,
      }],
      itemsByCollection: { "list-uuid": [] },
    };
    // Override the URL so ListsView's `?col=` init picks it up.
    const origLocation = window.location;
    delete window.location;
    window.location = { ...origLocation, search: "?col=list-uuid" };
    try {
      expect(() => {
        render(<CollectionsTab {...buildProps({
          collectionsSubTab: "lists",
          collectionsApi: stub,
        })} />);
      }).not.toThrow();
    } finally {
      window.location = origLocation;
    }
  });

  test("Lists drill-in as recipient (shared list, not owner) renders without throwing", () => {
    // Coverage gap from the 2026-05-13 v1.2 white-screen — App.test
    // doesn't exercise the recipient drill-in path, and the per-list
    // bucket layout introduced 2026-05-14 also branches on
    // isRecipient. Stub fetchListMembers to return two members so
    // memberCount >= 2 → isSharedList; set the list's userId to a
    // different user so isOwner=false → isRecipient=true.
    const stub = {
      ...baseCollectionsApi,
      collections: [{
        id: "shared-list-uuid",
        name: "Shared with me",
        description: null,
        type: "free-form",
        userId: "other-user",
        isSharedInbox: false,
        isSystem: false,
      }],
      itemsByCollection: { "shared-list-uuid": [] },
      fetchListMembers: async () => ({ error: null, members: [
        { user_id: "test-user", user_name: "Test", user_email: "test@example.com" },
        { user_id: "other-user", user_name: "Owner", user_email: "owner@example.com" },
      ] }),
    };
    const origLocation = window.location;
    delete window.location;
    window.location = { ...origLocation, search: "?col=shared-list-uuid" };
    try {
      expect(() => {
        render(<CollectionsTab {...buildProps({
          collectionsSubTab: "lists",
          collectionsApi: stub,
        })} />);
      }).not.toThrow();
    } finally {
      window.location = origLocation;
    }
  });

  test("Signed-out user gets the sign-in prompt (no crash)", () => {
    expect(() => {
      render(<CollectionsTab {...buildProps({ user: null })} />);
    }).not.toThrow();
    expect(screen.getByText(/Sign in to organize your watches/i)).toBeInTheDocument();
  });
});
