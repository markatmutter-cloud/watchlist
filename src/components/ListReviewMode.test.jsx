import React from "react";
import { render } from "@testing-library/react";
import { ListReviewMode } from "./ListReviewMode";

// Render-without-crash smoke tests for the three screening modes
// (list / feed / auction) introduced 2026-05-14.
//
// Why this exists: ListReviewMode is 1,500+ lines, owns complex
// gesture/animation/persistence state, and is the entry point for
// three distinct user flows (shared-list review, new-listings
// screening, auction-catalog screening). A bug that wedges any one
// mode would surface as either a white screen at the screener launch
// OR a silent fall-through (the 2026-05-14 auction-mode constraint
// failure landed in feed mode behaviour because the catch ate the
// error). This test catches the obvious render-time class.
//
// What this DOES NOT catch: gesture handling, animation transitions,
// the persistence resume flow, or the bucket-classification math.
// Those would need integration tests with simulated pointer events.

// jsdom doesn't provide vibrate / matchMedia / IntersectionObserver
// by default. ListReviewMode probes navigator.vibrate inside a
// try/catch so vibrate is a no-op anyway, but matchMedia matters if
// the resize listener fires.
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true, configurable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false, media: query, onchange: null,
      addListener: jest.fn(), removeListener: jest.fn(),
      addEventListener: jest.fn(), removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

const noop = () => {};
const asyncNoop = async () => ({ error: null });

// Minimum item shape covering every field ListReviewMode reads off
// current / item. Easy to extend if a future code path needs more.
function makeItem(overrides = {}) {
  return {
    id: "item-1",
    rowId: "row-1",
    title: "Rolex Submariner 5513",
    brand: "Rolex",
    model: "Submariner",
    ref: "5513",
    reference: "5513",
    price: 12500,
    priceUSD: 12500,
    currency: "USD",
    img: "https://example.com/sub.jpg",
    url: "https://example.com/sub",
    source: "Test Dealer",
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    items: [makeItem()],
    listId: "list-uuid",
    listName: "Test list",
    ownerName: "Test Owner",
    currentUserId: "user-1",
    reactionsByItem: new Map(),
    onToggleReaction: asyncNoop,
    onClose: noop,
    primaryCurrency: "USD",
    watchlist: {},
    handleWish: noop,
    openCollectionPicker: noop,
    onShare: noop,
    onOpenDetail: noop,
    onReset: noop,
    ...overrides,
  };
}

describe("ListReviewMode render-without-crash", () => {
  test("module imports without throwing", () => {
    expect(() => require("./ListReviewMode")).not.toThrow();
  });

  test("list mode (default) renders without throwing", () => {
    expect(() => {
      render(<ListReviewMode {...baseProps({ mode: "list" })} />);
    }).not.toThrow();
  });

  test("feed mode renders without throwing", () => {
    // Feed mode is launched from the Home "N new listings" banner.
    // Items can be unprojected listings without a rowId — the
    // component falls back to `current.id` for the React key. listId
    // is null because there's no underlying collection.
    const feedItem = makeItem({ rowId: undefined });
    expect(() => {
      render(<ListReviewMode {...baseProps({
        mode: "feed",
        items: [feedItem],
        listId: null,
      })} />);
    }).not.toThrow();
  });

  test("auction mode renders without throwing", () => {
    // Auction mode is launched from the Auction calendar Review
    // button. Yes-swipe invokes onYesAdd(item) to append to the
    // auction's auto-list.
    expect(() => {
      render(<ListReviewMode {...baseProps({
        mode: "auction",
        onYesAdd: noop,
      })} />);
    }).not.toThrow();
  });

  test("empty queue renders the all-reviewed state without throwing", () => {
    expect(() => {
      render(<ListReviewMode {...baseProps({ items: [] })} />);
    }).not.toThrow();
  });

  test("recipient view (non-owner of shared list) renders without throwing", () => {
    // Shared-list recipient — ownerName set, currentUserId differs
    // from owner. Triggers the recipient banner branch.
    expect(() => {
      render(<ListReviewMode {...baseProps({
        mode: "list",
        ownerName: "Other User",
        currentUserId: "viewer-id",
      })} />);
    }).not.toThrow();
  });
});
