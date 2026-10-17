import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import StyleSheet from "./StyleSheet";

// The live style sheet (?view=styleguide). It is the page Mark approves the
// shared frame on, so it has to render, every piece has to be on it, and the
// five open decisions have to be there to pick from.

const noop = () => {};
const tabs = [
  { key: "listings", label: "Watches", mobileLabel: "Watches", active: false, onSelect: noop },
  { key: "articles", label: "Articles", mobileLabel: "Articles", active: false, onSelect: noop },
];

describe("StyleSheet", () => {
  it("renders on desktop and on a phone", () => {
    const d = render(<StyleSheet tabs={tabs} authJSX={null} onHome={noop} isMobile={false} />);
    expect(screen.getByText("One definition per piece")).toBeInTheDocument();
    d.unmount();
    render(<StyleSheet tabs={tabs} authJSX={null} onHome={noop} isMobile />);
    expect(screen.getByText("One definition per piece")).toBeInTheDocument();
  });

  it("has all five sections and all five decisions", () => {
    render(<StyleSheet tabs={tabs} authJSX={null} onHome={noop} isMobile={false} />);
    for (const h of [/^1 · The page anatomy/, /^2 · Colour, type and size/, /^3 · The pieces/, /^4 · Composed pages/, /^5 · Decisions/]) {
      expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
    }
    for (const d of ["D1 · Sub-tabs", "D2 · Selected pill", "D3 · Page title", "D4 · Header type", "D5 · The Saved sub-tab on Watches"]) {
      expect(screen.getByRole("heading", { level: 3, name: d })).toBeInTheDocument();
    }
  });

  it("shows every piece for real (not screenshots of them)", () => {
    const { container } = render(<StyleSheet tabs={tabs} authJSX={null} onHome={noop} isMobile={false} />);
    for (const cls of [".ui-pill", ".ui-pill--icon", ".ui-search", ".ui-tabs--segmented", ".ui-tabs--underline",
                       ".ui-title-row", ".ui-filterbar", ".ui-count", ".ui-disc", ".ui-frame"]) {
      expect(container.querySelector(cls)).not.toBeNull();
    }
  });

  it("the demos are alive: the composed Articles page's heart toggles", () => {
    render(<StyleSheet tabs={tabs} authJSX={null} onHome={noop} isMobile={false} />);
    const first = screen.getAllByRole("button", { name: "Show only saved articles" })[0];
    fireEvent.click(first);
    expect(screen.getAllByRole("button", { name: "Show all" }).length).toBeGreaterThanOrEqual(1);
  });

  it("focusing the Watches demo's search shows saved-search suggestions", () => {
    render(<StyleSheet tabs={tabs} authJSX={null} onHome={noop} isMobile={false} />);
    const pages = screen.getByRole("heading", { level: 2, name: /^4 · Composed pages/ }).closest("section");
    const box = within(pages).getAllByRole("searchbox", { name: "Search watches" })[0];
    fireEvent.focus(box);
    expect(within(pages).getAllByText("Saved searches").length).toBeGreaterThanOrEqual(1);
  });
});
