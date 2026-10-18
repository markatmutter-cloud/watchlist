import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ListReviewMode } from "./ListReviewMode";

// Render-without-crash smoke tests for the two screening modes
// (list / feed). The original "auction" mode was retired in #55
// (2026-05-15) — auction-catalog screening now goes through
// mode="list" against the auction's auto-list so Pass items survive
// in the Disliked bucket like a shared list.
//
// Why this exists: ListReviewMode is 1,500+ lines, owns complex
// gesture/animation/persistence state, and is the entry point for
// two distinct user flows (list review — shared OR auction-catalog,
// and new-listings feed screening). A bug that wedges either mode
// would surface as either a white screen at the screener launch
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

// The screener's controls are the shared Button / OverlayHeart / OverlayMenu. These click them for real
// (the tests above only check that nothing throws).
describe("ListReviewMode controls", () => {
  beforeEach(() => { localStorage.setItem("screening_intro_seen_v1", "1"); });
  afterEach(() => { localStorage.clear(); });

  const two = () => [makeItem(), makeItem({ id: "item-2", rowId: "row-2", title: "Omega Speedmaster", brand: "Omega", model: "Speedmaster" })];

  test("Save hearts the card and moves on; Skip moves on without saving; Exit closes", () => {
    const handleWish = jest.fn();
    const onClose = jest.fn();
    render(<ListReviewMode {...baseProps({ mode: "list", items: two(), handleWish, onClose })} />);
    const save = screen.getAllByRole("button", { name: /Save/ })[0];
    expect(save).toHaveClass("ui-btn--primary");
    fireEvent.click(save);
    expect(handleWish).toHaveBeenCalledTimes(1);
    expect(handleWish.mock.calls[0][0].id).toBe("item-1");
    fireEvent.click(screen.getAllByRole("button", { name: /Skip/ })[0]);
    expect(handleWish).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByRole("button", { name: /Exit|Done/ })[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("the heart and ⋯ on the photo are the shared overlay controls", () => {
    const handleWish = jest.fn();
    const openCollectionPicker = jest.fn();
    render(<ListReviewMode {...baseProps({ mode: "list", items: two(), handleWish, openCollectionPicker })} />);
    const heart = screen.getByRole("button", { name: "Add to watchlist" });
    expect(heart).toHaveClass("ui-ovl");
    fireEvent.click(heart);
    expect(handleWish).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Add to list…" }));
    expect(openCollectionPicker).toHaveBeenCalledTimes(1);
    expect(openCollectionPicker.mock.calls[0][0].id).toBe("item-1");
  });

  test("Undo is off on the first card", () => {
    render(<ListReviewMode {...baseProps({ mode: "list", items: two() })} />);
    for (const undo of screen.getAllByRole("button", { name: "Undo" })) expect(undo).toBeDisabled();
  });
});

