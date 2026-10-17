import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import MagazineWatches, { MAGW_CSS } from "./MagazineWatches";

// Direct coverage for the parallel Watches page (?view=watches). The shell
// tests render MOCK grids and never execute this file, and a Vercel build
// compiles without executing it either — so without this test a ReferenceError
// in the page would ship green (CLAUDE.md, "Tests").
//
// The assertions are the feature-parity checklist: this page is a restyle of
// the Watches chrome, so every control has to be wired to the same App.js
// handler the shells pass, not to a lookalike of its own.

const noop = () => {};
const tabs = [
  { key: "listings", label: "Watches", active: true, onSelect: noop },
  { key: "references", label: "Articles", active: false, onSelect: noop },
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
    sectionHeadingStyle: { fontSize: 11 },
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
    filterHearted: false,
    setFilterHearted: noop,
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

describe("MagazineWatches", () => {
  it("ships a real stylesheet, not a broken template literal", () => {
    // MAGW_CSS is a template literal, so a stray backtick inside one of its
    // comments ends the string early and the rest becomes JS. It compiles —
    // the page then throws at RENDER, which no build catches (it happened
    // twice on 2026-09-08). Assert the shape of the thing, cheaply.
    expect(typeof MAGW_CSS).toBe("string");
    for (const sel of [".mag.magw", ".magw-deck", ".magw-subtabs", ".magw-pill", ".magw-search"]) {
      expect(MAGW_CSS).toContain(sel);
    }
  });

  it("sets its own type on top of the magazine's colour", () => {
    // Mark, 2026-09-08: the app's fonts, not the magazine's, with the colour
    // and layout kept. The override has to be two classes deep to beat
    // MAG_CSS's own `.mag` rule whatever order the two blocks are injected.
    expect(MAGW_CSS).toMatch(/\.mag\.magw\s*\{[^}]*--mag-body:\s*-apple-system/);
    expect(MAGW_CSS).toMatch(/\.mag\.magw\s+\.mag-wordmark\s*\{[^}]*text-transform:\s*uppercase/);
  });

  it("takes the shells' inset, not a centred column of its own (B-100)", () => {
    // Articles / Guides / Saved sit at CHROME.INSET_X_* (20 / 16px); the Watches
    // page was a centred 1600px column with a 2.4vw gutter, indented against them.
    expect(MAGW_CSS).toMatch(/\.magw-page\s*\{\s*padding:\s*0 20px 40px;\s*\}/);
    expect(MAGW_CSS).toMatch(/@media \(max-width: 700px\)\s*\{[^@]*\.magw-page\s*\{\s*padding:\s*0 16px 32px;/);
    expect(MAGW_CSS).not.toMatch(/\.magw-page\s*\{[^}]*max-width/);
  });

  it("renders the chrome, the sub-tabs, the count and the real grid", () => {
    render(<MagazineWatches {...props()} />);
    expect(screen.getByTestId("auth")).toBeInTheDocument();
    expect(screen.getByTestId("grid")).toBeInTheDocument();
    expect(screen.getByTestId("overlays")).toBeInTheDocument();
    for (const label of ["For sale", "Auctions", "Sold", "♡ Saved"]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText("1,234 watches")).toBeInTheDocument();
  });

  it("routes a sub-tab tap through App's setter and resets paging", () => {
    const setListingsSubTab = jest.fn();
    const setPage = jest.fn();
    render(<MagazineWatches {...props({ setListingsSubTab, setPage })} />);
    fireEvent.click(screen.getByRole("tab", { name: "Sold" }));
    expect(setListingsSubTab).toHaveBeenCalledWith("sold");
    expect(setPage).toHaveBeenCalledWith(1);
  });

  it("types straight into the tab's search state", () => {
    const setSearch = jest.fn();
    render(<MagazineWatches {...props({ setSearch })} />);
    fireEvent.change(screen.getByLabelText("Search watches"), { target: { value: "daytona" } });
    expect(setSearch).toHaveBeenCalledWith("daytona");
  });

  it("keeps the home affordance back to the landing page", () => {
    const onHome = jest.fn();
    render(<MagazineWatches {...props({ onHome })} />);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(onHome).toHaveBeenCalled();
  });

  it("opens the source panel with the sub-tab-aware chip split", () => {
    const setActiveFilterPop = jest.fn();
    render(<MagazineWatches {...props({ setActiveFilterPop })} />);
    fireEvent.click(screen.getByRole("button", { name: /^Source/ }));
    expect(setActiveFilterPop).toHaveBeenCalled();

    // On "For sale" the auction houses are not offered — they'd only ever
    // empty the grid, same rule the shells apply.
    render(<MagazineWatches {...props({ activeFilterPop: "source" })} />);
    expect(screen.getByRole("button", { name: "Analog Shift" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Phillips" })).toBeNull();
  });

  it("offers the auction calendar only on the Auctions slice", () => {
    const { unmount } = render(<MagazineWatches {...props()} />);
    expect(screen.queryByRole("button", { name: "Auction calendar" })).toBeNull();
    unmount();
    render(<MagazineWatches {...props({ listingsSubTab: "auctions" })} />);
    expect(screen.getByRole("button", { name: "Auction calendar" })).toBeInTheDocument();
  });

  it("has no Saved-only pill: the ♡ Saved sub-tab is the one saved control", () => {
    // Mark, 2026-10-16: "the saved feature was doubled up in the watches tab".
    // The sub-tab spans For sale / Auctions / Sold; a pill inside one slice
    // cannot, so the pill went and the sub-tab stayed.
    render(<MagazineWatches {...props()} />);
    expect(screen.queryByRole("button", { name: "♡ Saved" })).toBeNull();
    expect(screen.getByRole("tab", { name: "♡ Saved" })).toBeInTheDocument();
  });

  it("cycles the sort pills the way the shells do", () => {
    const setSort = jest.fn();
    const { unmount } = render(<MagazineWatches {...props({ sort: "date", setSort })} />);
    fireEvent.click(screen.getByRole("button", { name: "Date ↓" }));
    expect(setSort).toHaveBeenCalledWith("date-asc");
    unmount();
    const setSort2 = jest.fn();
    render(<MagazineWatches {...props({ sort: "price-desc", setSort: setSort2 })} />);
    fireEvent.click(screen.getByRole("button", { name: "Price ↓" }));
    expect(setSort2).toHaveBeenCalledWith("price-asc");
  });

  it("shows Clear all only when something is filtering", () => {
    const resetFilters = jest.fn();
    const { unmount } = render(<MagazineWatches {...props()} />);
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
    unmount();
    render(<MagazineWatches {...props({ hasFilters: true, resetFilters })} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(resetFilters).toHaveBeenCalled();
  });
});

describe("MagazineWatches: saved searches under the focused search", () => {
  // Mark, 2026-10-16: saved searches "come up as suggested searches when you
  // click on the search bar" (the heart in the bar already saves them).
  const saved = [{ id: "s1", label: "Speedmaster pro", query: "speedmaster", count: 12, newCount: 2 }];

  it("opens on focus when empty and re-runs a search on tap", () => {
    const onRunSavedSearch = jest.fn();
    render(<MagazineWatches {...props({ savedSearches: saved, onRunSavedSearch })} />);
    fireEvent.focus(screen.getByRole("searchbox", { name: "Search watches" }));
    expect(screen.getByText("Saved searches")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Speedmaster pro"));
    expect(onRunSavedSearch).toHaveBeenCalledWith(saved[0]);
    expect(screen.queryByText("Saved searches")).toBeNull();
  });

  it("unsaves from the x", () => {
    const onRemoveSavedSearch = jest.fn();
    render(<MagazineWatches {...props({ savedSearches: saved, onRemoveSavedSearch })} />);
    fireEvent.focus(screen.getByRole("searchbox", { name: "Search watches" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove saved search Speedmaster pro" }));
    expect(onRemoveSavedSearch).toHaveBeenCalledWith(saved[0]);
  });

  it("stays shut when signed out, when there are none, and while a query is typed", () => {
    const { unmount } = render(<MagazineWatches {...props({ savedSearches: saved, user: null })} />);
    fireEvent.focus(screen.getByRole("searchbox", { name: "Search watches" }));
    expect(screen.queryByText("Saved searches")).toBeNull();
    unmount();
    const none = render(<MagazineWatches {...props({ savedSearches: [] })} />);
    fireEvent.focus(screen.getByRole("searchbox", { name: "Search watches" }));
    expect(screen.queryByText("Saved searches")).toBeNull();
    none.unmount();
    render(<MagazineWatches {...props({ savedSearches: saved, search: "rolex" })} />);
    fireEvent.focus(screen.getByRole("searchbox", { name: "Search watches" }));
    expect(screen.queryByText("Saved searches")).toBeNull();
  });
});

describe("MagazineWatches on mobile: the shells' filter drawer", () => {
  // The one shell behaviour the parallel page lacked (SESSION_HANDOFF
  // 2026-10-04). Mark, 2026-10-16: bring it across. The sheet itself is
  // FilterDrawer, shared with MobileShell — these pin the page's wiring.
  const mobile = (over = {}) => props({ isMobile: true, ...over });

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

  it("opens the drawer from the Filter pill", () => {
    const setDrawerOpen = jest.fn();
    render(<MagazineWatches {...mobile({ setDrawerOpen })} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(setDrawerOpen).toHaveBeenCalledWith(true);
  });

  it("says how many filters are applied", () => {
    render(<MagazineWatches {...mobile({ filterSources: ["Phillips"], filterBrands: ["Rolex"], minPriceText: "1000" })} />);
    expect(screen.getByRole("button", { name: "Filters" })).toHaveTextContent("Filter · 3");
  });

  it("renders the real sheet when open, wired to App's handlers", () => {
    const toggleBrand = jest.fn();
    const setDrawerOpen = jest.fn();
    render(<MagazineWatches {...mobile({ drawerOpen: true, toggleBrand, setDrawerOpen })} />);
    expect(screen.getByText("Show 1234 watches")).toBeInTheDocument();
    for (const heading of ["Source", "Brand", "Model", "Price range"]) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "Rolex" }));
    expect(toggleBrand).toHaveBeenCalledWith("Rolex");
    fireEvent.click(screen.getByText("Show 1234 watches"));
    expect(setDrawerOpen).toHaveBeenCalledWith(false);
  });

  it("Escape closes the sheet", () => {
    const setDrawerOpen = jest.fn();
    render(<MagazineWatches {...mobile({ drawerOpen: true, setDrawerOpen })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(setDrawerOpen).toHaveBeenCalledWith(false);
  });

  it("offers Reset only when something is filtering", () => {
    const { rerender } = render(<MagazineWatches {...mobile({ drawerOpen: true })} />);
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
    rerender(<MagazineWatches {...mobile({ drawerOpen: true, hasFilters: true })} />);
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  it("desktop keeps its inline pills and never renders the sheet", () => {
    render(<MagazineWatches {...props({ drawerOpen: true })} />);
    expect(screen.getByRole("button", { name: /^Source/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filters" })).toBeNull();
    expect(screen.queryByText("Show 1234 watches")).toBeNull();
  });
});
