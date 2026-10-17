import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import MagazineWatches from "./MagazineWatches";

// Direct coverage for the Watches page, now built from src/ui. The shell tests render MOCK
// grids and never execute this file, and a Vercel build compiles without executing it
// either, so without this test a ReferenceError in the page would ship green (CLAUDE.md,
// "Tests").
//
// The assertions are the feature-parity checklist: every control has to be wired to the same
// App.js handler the shells passed, not to a lookalike of its own.

const noop = () => {};
const tabs = [
  { key: "listings", label: "Watches", mobileLabel: "Watches", active: true, onSelect: noop },
  { key: "references", label: "Articles", mobileLabel: "Articles", active: false, onSelect: noop },
];

function props(over = {}) {
  return {
    isMobile: false,
    baseStyle: {},
    tabs,
    authJSX: <span data-testid="auth" />,
    user: { id: "u1" },
    onHome: noop,
    goToSaved: noop,
    listingsSubTab: "live",
    setListingsSubTab: noop,
    setPage: noop,
    drawerOpen: false,
    setDrawerOpen: noop,
    search: "",
    setSearch: noop,
    openFavPrompt: noop,
    currentIsSaved: false,
    sort: "date",
    setSort: noop,
    minPriceText: "",
    setMinPriceText: noop,
    maxPriceText: "",
    setMaxPriceText: noop,
    hasFilters: false,
    resetFilters: noop,
    displayedCount: 1234,
    activeFilterPop: null,
    setActiveFilterPop: noop,
    filterSources: [],
    filterBrands: [],
    filterModels: [],
    toggleSource: noop,
    toggleBrand: noop,
    toggleModel: noop,
    visibleSources: ["Analog Shift", "Phillips"],
    visibleBrands: ["Rolex", "Omega"],
    visibleModels: ["Submariner"],
    DEALER_SOURCES: ["Analog Shift"],
    AUCTION_SOURCES: ["Phillips"],
    MODELS: ["Submariner"],
    SOURCES_SHOW: 8,
    BRANDS_SHOW: 8,
    MODELS_SHOW: 8,
    effectiveSourcesCount: 2,
    effectiveBrandsCount: 2,
    effectiveModelsCount: 1,
    sourcesExpanded: false,
    setSourcesExpanded: noop,
    brandsExpanded: false,
    setBrandsExpanded: noop,
    modelsExpanded: false,
    setModelsExpanded: noop,
    onOpenCalendar: noop,
    gridJSX: <div data-testid="grid" />,
    overlaysJSX: <div data-testid="overlays" />,
    aboutModalOpen: false,
    setAboutModalOpen: noop,
    signInPromptOpen: false,
    setSignInPromptOpen: noop,
    signInWithGoogle: noop,
    primaryCurrency: "USD",
    ...over,
  };
}

const searchbox = () => screen.getByRole("searchbox", { name: "Search watches" });

describe("MagazineWatches", () => {
  it("is built from the shared frame: the one header bar, no styles of its own", () => {
    const { container } = render(<MagazineWatches {...props()} />);
    expect(container.querySelector(".ui-page")).not.toBeNull();
    expect(container.querySelector(".magb-bar")).not.toBeNull();
    expect(container.querySelector(".ui-frame")).not.toBeNull();
    // The retired two-tier masthead and the page's own stylesheet classes are gone.
    expect(container.querySelector(".mag-flag, .mag-mhead, .magw-page, .magw-deck, .magw-pill")).toBeNull();
    // The search sits in the header bar, as on the style sheet.
    expect(container.querySelector(".magb-bar input[type='search']")).not.toBeNull();
  });

  it("renders the sub-tabs, the count and the real grid", () => {
    render(<MagazineWatches {...props()} />);
    expect(screen.getByTestId("auth")).toBeInTheDocument();
    expect(screen.getByTestId("grid")).toBeInTheDocument();
    expect(screen.getByTestId("overlays")).toBeInTheDocument();
    for (const label of ["For sale", "Auctions", "Sold", "Saved"]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
    // Heart only (Mark, 2026-10-17, style-sheet D5 B); the accessible name keeps the word.
    expect(screen.getByRole("tab", { name: "Saved" })).toHaveTextContent("♡");
    expect(screen.getByText("1,234 watches")).toBeInTheDocument();
  });

  it("has no Saved pill in the filter row: the Saved sub-tab is the one saved control", () => {
    // Mark, 2026-10-16: "the saved feature was doubled up in the watches tab".
    const { container } = render(<MagazineWatches {...props()} />);
    const zone = within(container.querySelector(".ui-filterzone"));
    expect(zone.queryByRole("button", { name: /Saved/ })).toBeNull();
  });

  it("routes a sub-tab tap through App's setters and resets paging", () => {
    const setListingsSubTab = jest.fn();
    const setPage = jest.fn();
    const setDrawerOpen = jest.fn();
    render(<MagazineWatches {...props({ setListingsSubTab, setPage, setDrawerOpen })} />);
    fireEvent.click(screen.getByRole("tab", { name: "Sold" }));
    expect(setListingsSubTab).toHaveBeenCalledWith("sold");
    expect(setPage).toHaveBeenCalledWith(1);
    expect(setDrawerOpen).toHaveBeenCalledWith(false);
  });

  it("types straight into the tab's search state", () => {
    const setSearch = jest.fn();
    render(<MagazineWatches {...props({ setSearch })} />);
    fireEvent.change(searchbox(), { target: { value: "daytona" } });
    expect(setSearch).toHaveBeenCalledWith("daytona");
  });

  it("Escape clears the search", () => {
    const setSearch = jest.fn();
    render(<MagazineWatches {...props({ search: "daytona", setSearch })} />);
    fireEvent.keyDown(searchbox(), { key: "Escape" });
    expect(setSearch).toHaveBeenCalledWith("");
  });

  it("clears the search from the x and saves it from the heart", () => {
    const setSearch = jest.fn();
    const openFavPrompt = jest.fn();
    render(<MagazineWatches {...props({ search: "daytona", setSearch, openFavPrompt })} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(setSearch).toHaveBeenCalledWith("");
    fireEvent.click(screen.getByRole("button", { name: "Save search as favorite" }));
    expect(openFavPrompt).toHaveBeenCalled();
  });

  it("an already-saved search says so and cannot be saved twice", () => {
    render(<MagazineWatches {...props({ search: "daytona", currentIsSaved: true })} />);
    expect(screen.getByRole("button", { name: "Already saved" })).toBeDisabled();
  });

  it("offers no save heart when signed out", () => {
    render(<MagazineWatches {...props({ search: "daytona", user: null })} />);
    expect(screen.queryByRole("button", { name: "Save search as favorite" })).toBeNull();
  });

  it("keeps the home affordance back to the landing page", () => {
    const onHome = jest.fn();
    render(<MagazineWatches {...props({ onHome })} />);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(onHome).toHaveBeenCalled();
  });

  it("toggles the source panel from its pill", () => {
    const setActiveFilterPop = jest.fn();
    render(<MagazineWatches {...props({ setActiveFilterPop })} />);
    fireEvent.click(screen.getByRole("button", { name: /^Source/ }));
    expect(setActiveFilterPop).toHaveBeenCalledTimes(1);
    const updater = setActiveFilterPop.mock.calls[0][0];
    expect(updater(null)).toBe("source");
    expect(updater("source")).toBeNull();
  });

  it("splits the source chips by slice: dealers on For sale, houses on Auctions", () => {
    const live = render(<MagazineWatches {...props({ activeFilterPop: "source" })} />);
    expect(screen.getByRole("button", { name: "Analog Shift" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Phillips" })).toBeNull();
    live.unmount();
    render(<MagazineWatches {...props({ activeFilterPop: "source", listingsSubTab: "auctions" })} />);
    expect(screen.getByRole("button", { name: "Phillips" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Analog Shift" })).toBeNull();
  });

  it("toggles a source, brand and model through App's handlers", () => {
    const toggleSource = jest.fn();
    const toggleBrand = jest.fn();
    const toggleModel = jest.fn();
    const handlers = { toggleSource, toggleBrand, toggleModel };
    const a = render(<MagazineWatches {...props({ ...handlers, activeFilterPop: "source" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Analog Shift" }));
    expect(toggleSource).toHaveBeenCalledWith("Analog Shift");
    a.unmount();
    const b = render(<MagazineWatches {...props({ ...handlers, activeFilterPop: "brand" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Rolex" }));
    expect(toggleBrand).toHaveBeenCalledWith("Rolex");
    b.unmount();
    render(<MagazineWatches {...props({ ...handlers, activeFilterPop: "model" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Submariner" }));
    expect(toggleModel).toHaveBeenCalledWith("Submariner");
  });

  it("shows +N more when a family has more chips than fit, and expands on tap", () => {
    const setBrandsExpanded = jest.fn();
    render(<MagazineWatches {...props({
      activeFilterPop: "brand", effectiveBrandsCount: 20, BRANDS_SHOW: 8, setBrandsExpanded,
    })} />);
    fireEvent.click(screen.getByRole("button", { name: "+12 more" }));
    expect(setBrandsExpanded).toHaveBeenCalledWith(true);
  });

  it("explains an empty source list rather than showing an empty panel", () => {
    render(<MagazineWatches {...props({ activeFilterPop: "source", visibleSources: [], filterBrands: ["Rolex"] })} />);
    expect(screen.getByText("No sources match the active brand / model filter.")).toBeInTheDocument();
  });

  it("offers the auction calendar only on the Auctions slice", () => {
    const live = render(<MagazineWatches {...props()} />);
    expect(screen.queryByRole("button", { name: "Auction calendar" })).toBeNull();
    live.unmount();
    const onOpenCalendar = jest.fn();
    render(<MagazineWatches {...props({ listingsSubTab: "auctions", onOpenCalendar })} />);
    fireEvent.click(screen.getByRole("button", { name: "Auction calendar" }));
    expect(onOpenCalendar).toHaveBeenCalled();
  });

  it("cycles the sort pills the way the shells do", () => {
    const setSort = jest.fn();
    const a = render(<MagazineWatches {...props({ sort: "date", setSort })} />);
    fireEvent.click(screen.getByRole("button", { name: /^Date/ }));
    expect(setSort).toHaveBeenLastCalledWith("date-asc");
    a.unmount();
    const b = render(<MagazineWatches {...props({ sort: "date-asc", setSort })} />);
    fireEvent.click(screen.getByRole("button", { name: /^Date/ }));
    expect(setSort).toHaveBeenLastCalledWith("date");
    b.unmount();
    render(<MagazineWatches {...props({ sort: "date", setSort })} />);
    fireEvent.click(screen.getByRole("button", { name: /^Price/ }));
    expect(setSort).toHaveBeenLastCalledWith("price-desc");
  });

  it("types a price band, and clears it", () => {
    const setMinPriceText = jest.fn();
    const setMaxPriceText = jest.fn();
    render(<MagazineWatches {...props({ minPriceText: "1000", setMinPriceText, setMaxPriceText })} />);
    fireEvent.change(screen.getByLabelText("Maximum price USD"), { target: { value: "5000" } });
    expect(setMaxPriceText).toHaveBeenCalledWith("5000");
    fireEvent.click(screen.getByRole("button", { name: "Clear price filter" }));
    expect(setMinPriceText).toHaveBeenCalledWith("");
    expect(setMaxPriceText).toHaveBeenCalledWith("");
  });

  it("shows Clear all only when something is filtering", () => {
    const resetFilters = jest.fn();
    const a = render(<MagazineWatches {...props({ resetFilters })} />);
    expect(screen.queryByRole("button", { name: /Clear all/ })).toBeNull();
    a.unmount();
    render(<MagazineWatches {...props({ resetFilters, hasFilters: true })} />);
    fireEvent.click(screen.getByRole("button", { name: /Clear all/ }));
    expect(resetFilters).toHaveBeenCalled();
  });

  it("singularises the count", () => {
    render(<MagazineWatches {...props({ displayedCount: 1 })} />);
    expect(screen.getByText("1 watch")).toBeInTheDocument();
  });
});

describe("MagazineWatches: saved searches under the focused search", () => {
  // Mark, 2026-10-16: saved searches "come up as suggested searches when you click on the
  // search bar" (the heart in the bar already saves them).
  const saved = [{ id: "s1", label: "Speedmaster pro", query: "speedmaster", count: 12, newCount: 2 }];

  it("opens on focus when empty and re-runs a search on tap", () => {
    const onRunSavedSearch = jest.fn();
    render(<MagazineWatches {...props({ savedSearches: saved, onRunSavedSearch })} />);
    fireEvent.focus(searchbox());
    expect(screen.getByText("Saved searches")).toBeInTheDocument();
    expect(screen.getByText("12 for sale · 2 new")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Speedmaster pro"));
    expect(onRunSavedSearch).toHaveBeenCalledWith(saved[0]);
    expect(screen.queryByText("Saved searches")).toBeNull();
  });

  it("unsaves from the x", () => {
    const onRemoveSavedSearch = jest.fn();
    render(<MagazineWatches {...props({ savedSearches: saved, onRemoveSavedSearch })} />);
    fireEvent.focus(searchbox());
    fireEvent.click(screen.getByRole("button", { name: "Remove Speedmaster pro" }));
    expect(onRemoveSavedSearch).toHaveBeenCalledWith(saved[0]);
  });

  it("closes when you click away", () => {
    render(<MagazineWatches {...props({ savedSearches: saved })} />);
    fireEvent.focus(searchbox());
    expect(screen.getByText("Saved searches")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Saved searches")).toBeNull();
  });

  it("stays shut when signed out, when there are none, and while a query is typed", () => {
    const a = render(<MagazineWatches {...props({ savedSearches: saved, user: null })} />);
    fireEvent.focus(searchbox());
    expect(screen.queryByText("Saved searches")).toBeNull();
    a.unmount();
    const b = render(<MagazineWatches {...props({ savedSearches: [] })} />);
    fireEvent.focus(searchbox());
    expect(screen.queryByText("Saved searches")).toBeNull();
    b.unmount();
    render(<MagazineWatches {...props({ savedSearches: saved, search: "rolex" })} />);
    fireEvent.focus(searchbox());
    expect(screen.queryByText("Saved searches")).toBeNull();
  });
});

describe("MagazineWatches on mobile: the filter sheet", () => {
  // The one shell behaviour the parallel page lacked (SESSION_HANDOFF 2026-10-04). The sheet
  // itself is FilterDrawer; these pin the page's wiring.
  const mobile = (over = {}) => props({ isMobile: true, ...over });

  it("takes the phone header: brand row, then sticky tabs + search", () => {
    const { container } = render(<MagazineWatches {...mobile()} />);
    expect(container.querySelector(".ui-page--phone")).not.toBeNull();
    expect(container.querySelector(".magb-brand")).not.toBeNull();
    const stick = container.querySelector(".ui-page-stick");
    expect(stick.querySelector(".magb-tabs")).not.toBeNull();
    expect(stick.querySelector("input[type='search']")).not.toBeNull();
    // The desktop bar is not rendered alongside it.
    expect(container.querySelector(".magb-bar")).toBeNull();
  });

  it("folds Source / Brand / Model / price into one Filter pill", () => {
    render(<MagazineWatches {...mobile()} />);
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    for (const gone of ["Source", "Brand", "Model"]) {
      expect(screen.queryByRole("button", { name: new RegExp(`^${gone}`, "i") })).toBeNull();
    }
    expect(screen.queryByLabelText("Minimum price USD")).toBeNull();
    // ...but the sort pills stay inline, as in the old mobile row.
    expect(screen.getByRole("button", { name: /^Date/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Price/ })).toBeInTheDocument();
  });

  it("opens the sheet from the Filter pill", () => {
    const setDrawerOpen = jest.fn();
    render(<MagazineWatches {...mobile({ setDrawerOpen })} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(setDrawerOpen).toHaveBeenCalledWith(true);
  });

  it("says how many filters are applied", () => {
    render(<MagazineWatches {...mobile({ filterSources: ["Phillips"], filterBrands: ["Rolex"], minPriceText: "1000" })} />);
    expect(screen.getByRole("button", { name: "Filters" })).toHaveTextContent(/Filter\s*·\s*3/);
  });

  it("renders the real sheet when open, wired to App's handlers", () => {
    const toggleBrand = jest.fn();
    const setDrawerOpen = jest.fn();
    render(<MagazineWatches {...mobile({ drawerOpen: true, toggleBrand, setDrawerOpen })} />);
    expect(screen.getByRole("dialog", { name: "Filter" })).toBeInTheDocument();
    for (const heading of ["Source", "Brand", "Model", "Price range"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "Rolex" }));
    expect(toggleBrand).toHaveBeenCalledWith("Rolex");
    fireEvent.click(screen.getByText("Show 1234 watches"));
    expect(setDrawerOpen).toHaveBeenCalledWith(false);
  });

  it("Escape and the x both close the sheet", () => {
    const setDrawerOpen = jest.fn();
    render(<MagazineWatches {...mobile({ drawerOpen: true, setDrawerOpen })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(setDrawerOpen).toHaveBeenCalledWith(false);
    setDrawerOpen.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Close filter" }));
    expect(setDrawerOpen).toHaveBeenCalledWith(false);
  });

  it("offers Reset only when something is filtering", () => {
    const a = render(<MagazineWatches {...mobile({ drawerOpen: true })} />);
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
    a.unmount();
    render(<MagazineWatches {...mobile({ drawerOpen: true, hasFilters: true })} />);
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  it("desktop keeps its inline pills and never renders the sheet", () => {
    render(<MagazineWatches {...props({ drawerOpen: true })} />);
    expect(screen.getByRole("button", { name: /^Source/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filters" })).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Filter" })).toBeNull();
  });
});
