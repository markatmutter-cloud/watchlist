import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import MagazineChrome from "./MagazineChrome";

// Direct coverage for the shared chrome. It is the piece two surfaces will
// wear, so a break here breaks both, and shell tests render mock content and
// never execute it.

const noop = () => {};
const tabs = [
  { key: "listings", label: "Watches", active: true, onSelect: noop },
  { key: "guides", label: "Reference Guides", mobileLabel: "Guides", active: false, onSelect: noop },
];

function props(over = {}) {
  return {
    tabs, authJSX: <span data-testid="auth" />,
    onSavedClick: noop, showSaved: false,
    onSearchSubmit: noop, onSearchLiveQuery: noop, searchCounts: null,
    recentSearches: [], addRecentSearch: noop,
    ...over,
  };
}

describe("MagazineChrome", () => {
  it("renders one search, the tabs and the passed account control", () => {
    const { container } = render(<MagazineChrome {...props()} />);
    expect(container.querySelectorAll("form[role='search']").length).toBe(1);
    // the shared field, not a masthead copy of it
    expect(container.querySelector(".ui-search.ui-search--bar")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Watches" })).toBeInTheDocument();
    expect(screen.getByTestId("auth")).toBeInTheDocument();
  });

  it("never builds its own account control", () => {
    // Every duplicate-control bug on this page came from the chrome inventing
    // one instead of rendering the app's.
    render(<MagazineChrome {...props({ authJSX: null })} />);
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "About" })).toBeNull();
  });

  it("is the desktop masthead: long tab labels, no phone rows", () => {
    // A phone wears the shared header instead (PageShell); Home only seats its search there.
    const { container } = render(<MagazineChrome {...props()} />);
    expect(screen.getByRole("button", { name: "Reference Guides" })).toBeInTheDocument();
    expect(container.querySelector(".mag-mhead")).toBeNull();
    expect(container.querySelector(".mag-flag")).not.toBeNull();
  });

  it("shows the saved heart only when asked, and carries no count badge", () => {
    // The badge was dropped 2026-09-08 (Mark): the saved count belongs on the
    // destination, not on the way in, and it unbalanced the masthead row.
    const { rerender, container } = render(<MagazineChrome {...props()} />);
    expect(screen.queryByLabelText("Saved watches")).toBeNull();
    rerender(<MagazineChrome {...props({ showSaved: true })} />);
    const heart = within(container).getByLabelText("Saved watches");
    expect(heart).toBeInTheDocument();
    expect(heart.textContent).toBe("");
    expect(container.querySelector(".mag-badge")).toBeNull();
  });

  it("submits a search through the handler it is given", () => {
    const calls = [];
    render(<MagazineChrome {...props({ onSearchSubmit: (q, t) => calls.push([q, t]) })} />);
    const input = screen.getByLabelText("Search watches");
    fireEvent.change(input, { target: { value: "explorer" } });
    fireEvent.submit(input.closest("form"));
    expect(calls).toEqual([["explorer", "all"]]);
  });

  it("has a Search button seated in the field, and a clear x once you have typed", () => {
    render(<MagazineChrome {...props()} />);
    expect(screen.getByRole("button", { name: "Search" })).toHaveClass("ui-search-go");
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Search watches"), { target: { value: "sub" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByLabelText("Search watches")).toHaveValue("");
  });

  it("previews what each destination holds as you type, and a row goes there", () => {
    const calls = [];
    render(<MagazineChrome {...props({
      onSearchSubmit: (q, t) => calls.push([q, t]),
      searchCounts: { all: 1200, live: 800, auctions: 300, sold: 100 },
    })} />);
    fireEvent.change(screen.getByLabelText("Search watches"), { target: { value: "sub" } });
    expect(screen.getByText("800")).toBeInTheDocument();
    fireEvent.click(screen.getByText("At auction"));
    expect(calls).toEqual([["sub", "auctions"]]);
  });

  it("offers recent searches on focus when empty", () => {
    render(<MagazineChrome {...props({ recentSearches: ["speedmaster", "gmt"] })} />);
    fireEvent.focus(screen.getByLabelText("Search watches"));
    expect(screen.getByText("Recent")).toBeInTheDocument();
    fireEvent.click(screen.getByText("gmt"));
    expect(screen.getByLabelText("Search watches")).toHaveValue("gmt");
  });

  describe("saved searches under the focused search", () => {
    const saved = [
      { id: "s1", label: "Speedmaster pro", query: "speedmaster", count: 12, newCount: 2 },
      { id: "s2", label: "Datejust 1601", query: "1601", count: 4, newCount: 0 },
    ];
    const withSaved = (over = {}) => props({
      savedSearches: saved, onRunSavedSearch: jest.fn(), onRemoveSavedSearch: jest.fn(), ...over,
    });

    it("lists them on focus, with what is for sale and what is new", () => {
      render(<MagazineChrome {...withSaved()} />);
      fireEvent.focus(screen.getByRole("searchbox"));
      expect(screen.getByText("Saved searches")).toBeInTheDocument();
      expect(screen.getByText("Speedmaster pro")).toBeInTheDocument();
      expect(screen.getByText("12 for sale · 2 new")).toBeInTheDocument();
      expect(screen.getByText("4 for sale")).toBeInTheDocument();
    });

    it("a row re-runs the search; the x unsaves it", () => {
      const onRunSavedSearch = jest.fn();
      const onRemoveSavedSearch = jest.fn();
      render(<MagazineChrome {...withSaved({ onRunSavedSearch, onRemoveSavedSearch })} />);
      fireEvent.focus(screen.getByRole("searchbox"));
      fireEvent.click(screen.getByText("Speedmaster pro"));
      expect(onRunSavedSearch).toHaveBeenCalledWith(saved[0]);
      fireEvent.focus(screen.getByRole("searchbox"));
      fireEvent.click(screen.getByRole("button", { name: "Remove Datejust 1601" }));
      expect(onRemoveSavedSearch).toHaveBeenCalledWith(saved[1]);
    });

    it("steps aside once you type, and shows nothing when there are none", () => {
      const { unmount } = render(<MagazineChrome {...withSaved()} />);
      const box = screen.getByRole("searchbox");
      fireEvent.focus(box);
      fireEvent.change(box, { target: { value: "rol" } });
      expect(screen.queryByText("Saved searches")).toBeNull();
      unmount();
      render(<MagazineChrome {...withSaved({ savedSearches: [] })} />);
      fireEvent.focus(screen.getByRole("searchbox"));
      expect(screen.queryByText("Saved searches")).toBeNull();
    });
  });
});
