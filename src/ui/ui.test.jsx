import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  Pill, SavedPill, SearchField, SubTabs, FilterBar, PageFrame, Count,
  AccountDisc, SuggestionRows,
} from "./index";

// The shared page frame. Pages are built from these and nothing else, so a break
// here breaks every tab; shell tests render MOCK content and would never see it.

describe("Pill", () => {
  it("renders a button with the pill class, and marks the selected look (solid olive)", () => {
    const { rerender } = render(<Pill>Source</Pill>);
    const btn = screen.getByRole("button", { name: "Source" });
    expect(btn).toHaveClass("ui-pill");
    expect(btn).not.toHaveClass("is-on");
    rerender(<Pill on>Source</Pill>);
    expect(screen.getByRole("button", { name: "Source" })).toHaveClass("is-on");
  });

  it("only sets aria-pressed for on/off toggles", () => {
    const { rerender } = render(<Pill on>Brand</Pill>);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-pressed");
    rerender(<Pill on toggle>Brand</Pill>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a count suffix", () => {
    render(<Pill on n={2}>Source</Pill>);
    expect(screen.getByRole("button")).toHaveTextContent("Source· 2");
  });

  it("an icon with no label is an icon-only circle", () => {
    render(<Pill icon={<svg data-testid="i" />} aria-label="Filters" />);
    expect(screen.getByRole("button", { name: "Filters" })).toHaveClass("ui-pill--icon");
  });

  it("clicks through", () => {
    const onClick = jest.fn();
    render(<Pill onClick={onClick}>Go</Pill>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("SavedPill", () => {
  it("is a bare heart: no word, an accessible name that says what it does", () => {
    const { rerender } = render(<SavedPill on={false} onClick={() => {}} what="saved articles" />);
    const off = screen.getByRole("button", { name: "Show only saved articles" });
    expect(off).toHaveTextContent("");
    expect(off).toHaveAttribute("aria-pressed", "false");
    rerender(<SavedPill on onClick={() => {}} what="saved articles" />);
    const on = screen.getByRole("button", { name: "Show all" });
    expect(on).toHaveAttribute("aria-pressed", "true");
    expect(on).toHaveClass("is-on");
  });
});

describe("SearchField", () => {
  it("is one search role with a labelled input, and reports typing", () => {
    const onChange = jest.fn();
    render(<SearchField value="" onChange={onChange} placeholder="Search articles…" />);
    expect(screen.getByRole("search")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search articles…" }), { target: { value: "omega" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("offers a clear × only when there is a value and a handler", () => {
    const { rerender } = render(<SearchField value="" onChange={() => {}} onClear={() => {}} placeholder="s" />);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    const onClear = jest.fn();
    rerender(<SearchField value="rolex" onChange={() => {}} onClear={onClear} placeholder="s" />);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("seats a trailing control and a suggestions child inside the field", () => {
    const { container } = render(
      <SearchField value="" onChange={() => {}} placeholder="s" trailing={<button>save</button>}>
        <div className="ui-search-drop">rows</div>
      </SearchField>);
    expect(container.querySelector(".ui-search .ui-search-trailing button")).not.toBeNull();
    expect(container.querySelector(".ui-search .ui-search-drop")).not.toBeNull();
  });

  it("takes its size from the prop, same component for header, row and phone", () => {
    const { container } = render(<SearchField size="bar" value="" onChange={() => {}} placeholder="s" />);
    expect(container.firstChild).toHaveClass("ui-search", "ui-search--bar");
  });
});

describe("SubTabs", () => {
  const tabs = [{ key: "a", label: "For sale" }, { key: "b", label: "Sold" }];

  it("is one segmented tablist with one selected tab, and selecting reports the key", () => {
    const onSelect = jest.fn();
    const { container } = render(<SubTabs tabs={tabs} activeKey="a" onSelect={onSelect} ariaLabel="Views" />);
    expect(container.firstChild).toHaveClass("ui-tabs");
    expect(screen.getByRole("tablist", { name: "Views" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "For sale" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Sold" })).toHaveAttribute("aria-selected", "false");
    fireEvent.click(screen.getByRole("tab", { name: "Sold" }));
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("an icon-only tab keeps an accessible name (the Watches Saved heart)", () => {
    render(<SubTabs tabs={[{ key: "s", label: "♡", ariaLabel: "Saved" }]} activeKey="s" />);
    expect(screen.getByRole("tab", { name: "Saved" })).toHaveTextContent("♡");
  });

  it("has no underline variant (retired by Mark, 2026-10-17)", () => {
    const { container } = render(<SubTabs tabs={tabs} activeKey="a" variant="underline" />);
    expect(container.firstChild.className).toBe("ui-tabs");
  });
});

describe("FilterBar and PageFrame", () => {
  it("lays out pills, search and count in their own slots", () => {
    const { container } = render(
      <FilterBar pills={<Pill>Source</Pill>} search={<input aria-label="s" />} count="12 articles" end={<Pill>Date</Pill>} />);
    expect(container.querySelector(".ui-filterbar-pills")).toHaveTextContent("Source");
    expect(container.querySelector(".ui-filterbar-search input")).not.toBeNull();
    expect(container.querySelector(".ui-filterbar-end")).toHaveTextContent("Date");
    expect(screen.getByText("12 articles")).toHaveClass("ui-count");
  });

  it("a bar with no search says so, so it never reserves the search column", () => {
    const { container } = render(<FilterBar pills={<Pill>Source</Pill>} />);
    expect(container.firstChild).toHaveClass("ui-filterbar--nosearch");
    expect(container.querySelector(".ui-filterbar-search")).toBeNull();
  });

  it("PageFrame always orders sub-tabs, filter bar, content (and has no title band)", () => {
    const { container } = render(
      <PageFrame subTabs={<span>tabs</span>} filterBar={<div className="fb">bar</div>}>
        <p>content</p>
      </PageFrame>);
    const order = [...container.querySelectorAll(".ui-tabs-row, .fb, .ui-content")]
      .map((el) => el.className.split(" ")[0]);
    expect(order).toEqual(["ui-tabs-row", "fb", "ui-content"]);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("every band is optional", () => {
    const { container } = render(<PageFrame><p>only content</p></PageFrame>);
    expect(container.querySelector(".ui-tabs-row")).toBeNull();
    expect(screen.getByText("only content")).toBeInTheDocument();
  });
});

describe("the small ones", () => {
  it("Count renders nothing without a value", () => {
    const { container } = render(<Count>{null}</Count>);
    expect(container).toBeEmptyDOMElement();
  });

  it("AccountDisc is one olive disc with the initial", () => {
    render(<AccountDisc initial="M" />);
    const disc = screen.getByRole("button", { name: "Account menu" });
    expect(disc).toHaveClass("ui-disc");
    expect(disc).toHaveTextContent("M");
  });

  it("SuggestionRows runs and removes rows, and renders nothing when empty", () => {
    const onRun = jest.fn();
    const onRemove = jest.fn();
    const rows = [{ id: "1", label: "Speedmaster pro", meta: "12 for sale" }];
    const { container, rerender } = render(<SuggestionRows heading="Saved searches" rows={rows} onRun={onRun} onRemove={onRemove} />);
    expect(screen.getByText("Saved searches")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Speedmaster pro"));
    expect(onRun).toHaveBeenCalledWith(rows[0]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Speedmaster pro" }));
    expect(onRemove).toHaveBeenCalledWith(rows[0]);
    rerender(<SuggestionRows heading="Saved searches" rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
