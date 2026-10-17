import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterDrawer } from "./FilterDrawer";

// The sheet is shared by MobileShell and the magazine Watches page, so a break
// here breaks both. These cover what only this file owns: the source grouping
// by slice, the expand toggle, price inputs and the footer.

const noop = () => {};
function props(over = {}) {
  return {
    drawerOpen: true, setDrawerOpen: noop, sectionHeadingStyle: {},
    showDealerSources: true, showAuctionSources: true,
    DEALER_SOURCES: ["Analog Shift"], AUCTION_SOURCES: ["Phillips"],
    visibleSources: ["Analog Shift", "Phillips"], filterSources: [], toggleSource: noop,
    effectiveSourcesCount: 2, SOURCES_SHOW: 8, sourcesExpanded: false, setSourcesExpanded: noop,
    visibleBrands: ["Rolex"], filterBrands: [], toggleBrand: noop,
    effectiveBrandsCount: 1, BRANDS_SHOW: 8, brandsExpanded: false, setBrandsExpanded: noop,
    MODELS: ["Submariner"], visibleModels: ["Submariner"], filterModels: [], toggleModel: noop,
    effectiveModelsCount: 1, MODELS_SHOW: 8, modelsExpanded: false, setModelsExpanded: noop,
    minPriceText: "", setMinPriceText: noop, maxPriceText: "", setMaxPriceText: noop,
    hasFilters: false, resetFilters: noop, displayedCount: 42,
    ...over,
  };
}

describe("FilterDrawer", () => {
  it("renders nothing while closed", () => {
    const { container } = render(<FilterDrawer {...props({ drawerOpen: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("closes from the X, the scrim and the Show button", () => {
    const setDrawerOpen = jest.fn();
    const { container } = render(<FilterDrawer {...props({ setDrawerOpen })} />);
    fireEvent.click(screen.getByLabelText("Close filter"));
    fireEvent.click(screen.getByText("Show 42 watches"));
    fireEvent.click(container.firstChild.firstChild); // the scrim
    expect(setDrawerOpen).toHaveBeenCalledTimes(3);
    expect(setDrawerOpen).toHaveBeenCalledWith(false);
  });

  it("offers only the source family the slice can show", () => {
    const { rerender } = render(<FilterDrawer {...props({ showAuctionSources: false })} />);
    expect(screen.getByRole("button", { name: "Analog Shift" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Phillips" })).toBeNull();
    rerender(<FilterDrawer {...props({ showDealerSources: false })} />);
    expect(screen.queryByRole("button", { name: "Analog Shift" })).toBeNull();
    expect(screen.getByRole("button", { name: "Phillips" })).toBeInTheDocument();
  });

  it("groups sources under Dealers / Auction houses once expanded", () => {
    render(<FilterDrawer {...props({ sourcesExpanded: true })} />);
    expect(screen.getByText("Dealers")).toBeInTheDocument();
    expect(screen.getByText("Auction houses")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Less ↑" })).toBeInTheDocument();
  });

  it("shows the +N more expander only past SOURCES_SHOW", () => {
    render(<FilterDrawer {...props({ effectiveSourcesCount: 11 })} />);
    expect(screen.getByRole("button", { name: "+3 more" })).toBeInTheDocument();
  });

  it("types into the price range and resets", () => {
    const setMinPriceText = jest.fn();
    const resetFilters = jest.fn();
    render(<FilterDrawer {...props({ setMinPriceText, resetFilters, hasFilters: true })} />);
    fireEvent.change(screen.getByPlaceholderText("Min $"), { target: { value: "5000" } });
    expect(setMinPriceText).toHaveBeenCalledWith("5000");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(resetFilters).toHaveBeenCalled();
  });

  it("hides the Model section when there are no models", () => {
    render(<FilterDrawer {...props({ MODELS: [] })} />);
    expect(screen.queryByText("Model")).toBeNull();
  });
});
