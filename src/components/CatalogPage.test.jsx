import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CatalogPage from "./CatalogPage";

// Direct coverage for the auction-catalog page: the shell tests render MOCK content and a
// Vercel build never executes, so this is where a ReferenceError in it would show up.

const noop = () => {};

function props(over = {}) {
  return {
    isMobile: false, baseStyle: {},
    tabs: [{ key: "listings", label: "Watches", mobileLabel: "Watches", active: true, onSelect: noop }],
    authJSX: <span data-testid="auth" />, user: { id: "u1" }, onHome: noop, goToSaved: noop,
    overlaysJSX: <div data-testid="overlays" />,
    aboutModalOpen: false, signInPromptOpen: false,
    sale: { house: "Bonhams", location: "Online, Paris", title: "Paris Watches Online" },
    saleDates: "8 - 22 October", onExit: noop,
    actions: [
      { label: "Save catalog", icon: <span>♡</span>, onClick: noop },
      { label: "Share", onClick: noop },
      { label: "Auction house ↗", href: "https://bonhams.example/sale" },
    ],
    gridJSX: <div data-testid="grid" />, displayedCount: 114,
    listingsSubTab: "auctions", drawerOpen: false, setDrawerOpen: noop,
    search: "", setSearch: noop, sort: "date", setSort: noop,
    minPriceText: "", setMinPriceText: noop, maxPriceText: "", setMaxPriceText: noop,
    hasFilters: false, resetFilters: noop, activeFilterPop: null, setActiveFilterPop: noop,
    filterSources: [], filterBrands: [], filterModels: [],
    toggleSource: noop, toggleBrand: noop, toggleModel: noop,
    visibleSources: ["Bonhams"], visibleBrands: ["Rolex"], visibleModels: [],
    DEALER_SOURCES: [], AUCTION_SOURCES: ["Bonhams"], MODELS: [],
    SOURCES_SHOW: 8, BRANDS_SHOW: 8, MODELS_SHOW: 8,
    effectiveSourcesCount: 1, effectiveBrandsCount: 1, effectiveModelsCount: 0,
    sourcesExpanded: false, setSourcesExpanded: noop, brandsExpanded: false, setBrandsExpanded: noop,
    modelsExpanded: false, setModelsExpanded: noop, onOpenCalendar: noop,
    ...over,
  };
}

describe("CatalogPage", () => {
  it("replaces the tab header with the sale's own title bar", () => {
    const { container } = render(<CatalogPage {...props()} />);
    expect(container.querySelector(".ui-takeover")).not.toBeNull();
    expect(container.querySelector(".magb-bar")).toBeNull();
    expect(screen.getByText("Paris Watches Online")).toBeInTheDocument();
    expect(container.querySelector(".ui-takeover-eyebrow").textContent).toBe("Bonhams · Online, Paris · 8 - 22 October");
  });

  it("× goes back to the calendar it was opened from", () => {
    const onExit = jest.fn();
    render(<CatalogPage {...props({ onExit })} />);
    fireEvent.click(screen.getByRole("button", { name: "Back to auction calendar" }));
    expect(onExit).toHaveBeenCalled();
  });

  it("offers Save, Share and the auction house as shared pills (the last one a link)", () => {
    const onClick = jest.fn();
    render(<CatalogPage {...props({ actions: [{ label: "Share", onClick }, { label: "Auction house ↗", href: "https://x.example" }] })} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Auction house ↗" })).toHaveAttribute("href", "https://x.example");
  });

  it("shows a saved catalog as an on pill", () => {
    render(<CatalogPage {...props({ actions: [{ label: "Saved", active: true, onClick: noop }] })} />);
    expect(screen.getByRole("button", { name: "Saved" })).toHaveClass("is-on");
  });

  it("carries its own search in a stacked filter bar, with the count at its right", () => {
    const setSearch = jest.fn();
    const { container } = render(<CatalogPage {...props({ setSearch })} />);
    expect(container.querySelector(".ui-filterbar.ui-filterbar--stacked .ui-filterbar-search input[type='search']")).not.toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search watches" }), { target: { value: "movado" } });
    expect(setSearch).toHaveBeenCalledWith("movado");
    expect(screen.getByText("114 watches")).toBeInTheDocument();
    expect(screen.getByTestId("grid")).toBeInTheDocument();
    expect(screen.getByTestId("overlays")).toBeInTheDocument();
  });

  it("offers the auction calendar pill and the shared Source / Brand pills", () => {
    render(<CatalogPage {...props()} />);
    expect(screen.getByRole("button", { name: "Auction calendar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Source/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Brand/ })).toBeInTheDocument();
  });

  it("on a phone: one Filter pill that opens the sheet", () => {
    const setDrawerOpen = jest.fn();
    render(<CatalogPage {...props({ isMobile: true, setDrawerOpen })} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(setDrawerOpen).toHaveBeenCalledWith(true);
  });
});
