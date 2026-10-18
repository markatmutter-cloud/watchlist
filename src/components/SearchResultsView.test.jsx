import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchResultsView } from "./SearchResultsView";

// Direct render of the real "Search all" page (the shell/App tests mount a mock or never reach
// it): the shared SearchField for the query, the shared SectionHead + Pill for each strip's
// "View all", and the Exit pill.

const mk = (i) => ({
  id: `w${i}`, brand: "Rolex", model: "Submariner", ref: `Ref ${i}`, title: `Rolex Submariner ${i}`,
  source: "Wind Vintage", url: `https://x/${i}`, img: `https://img/${i}.jpg`,
  price: 10000 + i, priceUSD: 10000 + i, currency: "USD", firstSeen: "2026-10-01",
});
const many = Array.from({ length: 10 }, (_, i) => mk(i));

function props(over = {}) {
  return {
    search: "submariner", setSearch: jest.fn(), mainFeedItems: many, auctionLotItems: [],
    articles: [], articleBodies: {}, isMobile: false, gridStyle: {}, watchlist: {}, handleWish: jest.fn(),
    hidden: {}, toggleHide: jest.fn(), primaryCurrency: "USD", openCollectionPicker: undefined,
    handleShare: jest.fn(), isAdmin: false, onClickListing: jest.fn(),
    onViewAllLive: jest.fn(), onViewAllAuctions: jest.fn(), onViewAllSold: jest.fn(),
    onViewAllArticles: jest.fn(), onExit: jest.fn(),
    ...over,
  };
}

describe("SearchResultsView", () => {
  beforeAll(() => {
    if (!window.IntersectionObserver) {
      window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
    }
  });

  it("the query is the shared search field; typing and clearing go to setSearch", () => {
    const p = props();
    const { container } = render(<SearchResultsView {...p} />);
    const field = screen.getByRole("searchbox", { name: "Search watches" });
    expect(container.querySelector("form.ui-search")).not.toBeNull();
    expect(field).toHaveValue("submariner");
    fireEvent.change(field, { target: { value: "speedmaster" } });
    expect(p.setSearch).toHaveBeenCalledWith("speedmaster");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(p.setSearch).toHaveBeenLastCalledWith("");
  });

  it("a strip over its cap says so with the shared 'View all' action; Exit leaves", () => {
    const p = props();
    render(<SearchResultsView {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "View all →" }));
    expect(p.onViewAllLive).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Exit" }));
    expect(p.onViewAllLive).toHaveBeenCalledTimes(1);
    expect(p.onExit).toHaveBeenCalledTimes(1);
  });

  it("read-only when it has no setSearch (no editing, no clear)", () => {
    render(<SearchResultsView {...props({ setSearch: undefined })} />);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });
});
