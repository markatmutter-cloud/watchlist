import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorialView } from "./EditorialView";

// Direct render coverage for the Articles surface. It had none: the shell
// tests render a MOCK tab body, so nothing here ever executed in jest and a
// ReferenceError would have compiled clean and shipped (CLAUDE.md blind-edit
// rule). Added alongside the 2026-07-30 change that turned the ♥ Saved filter
// pill into a sub-tab.
//
// The corpus fetch is stubbed: the real one hits network URLs that don't
// resolve in jsdom, and the chrome under test renders regardless of it.
//
// A PLAIN function, not jest.fn(): CRA sets `resetMocks: true`, which clears
// every jest.fn implementation before each test, so a jest.fn stub returns
// undefined by the time the component calls it — and `undefined.catch(...)`
// throws inside the load effect.
jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  fetchJsonCached: () => Promise.resolve({}),
}));

const buildProps = (overrides = {}) => ({
  isMobile: false,
  watchlist: {},
  handleWish: () => {},
  search: "",
  setSearch: () => {},
  ...overrides,
});

describe("EditorialView", () => {
  test("renders the Articles surface with Saved as an icon-only heart pill", () => {
    render(<EditorialView {...buildProps()} />);
    // No page title (Mark, 2026-10-17, style-sheet D3) and the search is in the bar for every width.
    expect(screen.queryByRole("heading", { name: "Articles" })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search articles" })).toBeInTheDocument();
    // Mark, 2026-10-16: the heart in the filter row, no word, and no extra
    // sub-tab row. This REVERSES the 2026-07-30 rule (a sub-tab, never a pill):
    // that rule's reason (a labelled pill went unfound) is why the accessible
    // name and title say what the heart does.
    const heart = screen.getByRole("button", { name: "Show only saved articles" });
    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(heart).toHaveTextContent(""); // an icon, not a word
    expect(screen.queryByRole("tab", { name: /Saved/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /^All$/ })).not.toBeInTheDocument();
    // The other filter pills stay where they were.
    expect(screen.getByRole("button", { name: /^Source/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Brand/ })).toBeInTheDocument();
  });

  test("the heart toggles, raises Clear all like the pills beside it, and Clear all turns it off", () => {
    render(<EditorialView {...buildProps()} />);
    expect(screen.queryByText(/Clear all/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show only saved articles" }));
    expect(screen.getByRole("button", { name: "Show all" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByText(/Clear all/));
    expect(screen.getByRole("button", { name: "Show only saved articles" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText(/Clear all/)).not.toBeInTheDocument();
  });

  test("saved-only with nothing saved is an invite, not a no-results message", async () => {
    render(<EditorialView {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Show only saved articles" }));
    // The empty state waits for the (stubbed) corpus fetch to settle.
    expect(await screen.findByText(/Nothing saved yet/)).toBeInTheDocument();
    expect(screen.queryByText(/No articles match/)).not.toBeInTheDocument();
  });
});
