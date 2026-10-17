import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ListsPage from "./ListsPage";

// Direct coverage for the Lists page (src/ui). The shell tests render MOCK content, and a
// Vercel build compiles without executing, so this is the only place a ReferenceError in
// the page would show up before it ships.

const noop = () => {};
const tabs = [
  { key: "listings", label: "Watches", mobileLabel: "Watches", active: false, onSelect: noop },
  { key: "references", label: "Articles", mobileLabel: "Articles", active: false, onSelect: noop },
];

function props(over = {}) {
  return {
    isMobile: false, baseStyle: {}, tabs,
    authJSX: <span data-testid="auth" />, user: { id: "u1" },
    onHome: noop, goToSaved: noop,
    watchTopTab: "lists", onSelectSub: noop, colDrillInId: null, displayedCount: 7,
    contentJSX: <div data-testid="content" />, overlaysJSX: <div data-testid="overlays" />,
    drawerOpen: false, setDrawerOpen: noop, setPage: noop,
    search: "", setSearch: noop, openFavPrompt: noop, currentIsSaved: false,
    sort: "date", setSort: noop,
    minPriceText: "", setMinPriceText: noop, maxPriceText: "", setMaxPriceText: noop,
    hasFilters: false, resetFilters: noop,
    activeFilterPop: null, setActiveFilterPop: noop,
    filterSources: [], filterBrands: [], filterModels: [],
    toggleSource: noop, toggleBrand: noop, toggleModel: noop,
    visibleSources: ["Analog Shift", "Phillips"], visibleBrands: ["Rolex"], visibleModels: ["Submariner"],
    DEALER_SOURCES: ["Analog Shift"], AUCTION_SOURCES: ["Phillips"], MODELS: ["Submariner"],
    SOURCES_SHOW: 8, BRANDS_SHOW: 8, MODELS_SHOW: 8,
    effectiveSourcesCount: 2, effectiveBrandsCount: 1, effectiveModelsCount: 1,
    sourcesExpanded: false, setSourcesExpanded: noop, brandsExpanded: false, setBrandsExpanded: noop,
    modelsExpanded: false, setModelsExpanded: noop,
    aboutModalOpen: false, setAboutModalOpen: noop,
    signInPromptOpen: false, setSignInPromptOpen: noop, signInWithGoogle: noop,
    primaryCurrency: "USD",
    ...over,
  };
}

describe("ListsPage", () => {
  it("is the shared frame with Lists and Searches, and no Saved or hearted tab", () => {
    const { container } = render(<ListsPage {...props()} />);
    expect(container.querySelector(".ui-page")).not.toBeNull();
    expect(container.querySelector(".magb-bar")).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Lists" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Searches" })).toHaveAttribute("aria-selected", "false");
    expect(screen.queryByRole("tab", { name: /Watches|Saved/ })).toBeNull();
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByTestId("overlays")).toBeInTheDocument();
  });

  it("has no search or filter bar on the Lists landing", () => {
    const { container } = render(<ListsPage {...props()} />);
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(container.querySelector(".ui-filterzone")).toBeNull();
    expect(screen.queryByText(/items?$/)).toBeNull();
  });

  it("has none on Searches either", () => {
    const { container } = render(<ListsPage {...props({ watchTopTab: "searches", colDrillInId: "x" })} />);
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(container.querySelector(".ui-filterzone")).toBeNull();
  });

  it("hands a sub-tab tap to App", () => {
    const onSelectSub = jest.fn();
    render(<ListsPage {...props({ onSelectSub })} />);
    fireEvent.click(screen.getByRole("tab", { name: "Searches" }));
    expect(onSelectSub).toHaveBeenCalledWith("searches");
  });

  describe("inside a list", () => {
    const drilled = (over = {}) => props({ colDrillInId: "list-1", ...over });

    it("gains the header search, the filter bar and an item count", () => {
      const { container } = render(<ListsPage {...drilled()} />);
      expect(container.querySelector(".magb-bar input[type='search']")).not.toBeNull();
      expect(container.querySelector(".ui-filterzone.is-sticky")).not.toBeNull();
      expect(screen.getByText("7 items")).toBeInTheDocument();
    });

    it("singularises the count", () => {
      render(<ListsPage {...drilled({ displayedCount: 1 })} />);
      expect(screen.getByText("1 item")).toBeInTheDocument();
    });

    it("offers both source families: a list can hold dealer listings and auction lots", () => {
      render(<ListsPage {...drilled({ activeFilterPop: "source" })} />);
      expect(screen.getByRole("button", { name: "Analog Shift" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Phillips" })).toBeInTheDocument();
    });

    it("types into App's search and sorts through App's setter", () => {
      const setSearch = jest.fn();
      const setSort = jest.fn();
      render(<ListsPage {...drilled({ setSearch, setSort })} />);
      fireEvent.change(screen.getByRole("searchbox", { name: "Search watches" }), { target: { value: "sub" } });
      expect(setSearch).toHaveBeenCalledWith("sub");
      fireEvent.click(screen.getByRole("button", { name: /^Price/ }));
      expect(setSort).toHaveBeenCalledWith("price-desc");
    });

    it("on a phone: the header's search row and one Filter pill that opens the sheet", () => {
      const setDrawerOpen = jest.fn();
      const { container } = render(<ListsPage {...drilled({ isMobile: true, setDrawerOpen })} />);
      expect(container.querySelector(".ui-page-stick input[type='search']")).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Filters" }));
      expect(setDrawerOpen).toHaveBeenCalledWith(true);
    });

    it("renders the real sheet when open", () => {
      render(<ListsPage {...drilled({ isMobile: true, drawerOpen: true })} />);
      expect(screen.getByRole("dialog", { name: "Filter" })).toBeInTheDocument();
      expect(screen.getByText("Show 7 watches")).toBeInTheDocument();
    });
  });
});
