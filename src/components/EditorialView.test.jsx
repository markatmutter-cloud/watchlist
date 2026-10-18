import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorialView, ArticleCard } from "./EditorialView";

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
    expect(heart).toHaveTextContent(/^♡$/); // the same bare glyph the Watches sub-tabs carry: no word
    expect(screen.queryByRole("tab", { name: /Saved/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /^All$/ })).not.toBeInTheDocument();
    // Source, Brand and the heart are ONE segmented track, the same one the sub-tabs use.
    expect(screen.getByRole("button", { name: /^Source/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Brand/ })).toBeInTheDocument();
    const track = heart.closest(".ui-tabs");
    expect(track).not.toBeNull();
    expect(track).toContainElement(screen.getByRole("button", { name: /^Source/ }));
    expect(track).toContainElement(screen.getByRole("button", { name: /^Brand/ }));
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

// The article card's heart and ⋯ sit over a photo; with no photo they sit over the headline, so
// the words keep clear of them.
describe("ArticleCard actions", () => {
  const article = { url: "https://f/1", title: "Omega: une collection qui retrace presque un demi-siècle", author: "WatchFid",
                    published_at: "2026-10-16", _source: { label: "WatchFid" } };
  const card = (over = {}) => render(
    <ArticleCard article={{ ...article, ...over }} isMobile watchlist={{}} handleWish={() => {}} handleShare={() => {}} openCollectionPicker={() => {}} />
  );

  test("no photo: the shared heart and ⋯ are there and the headline block leaves room for them", () => {
    const { container } = card();
    expect(screen.getByRole("button", { name: "Save article" })).toHaveClass("ui-ovl");
    expect(screen.getByRole("button", { name: "More actions" })).toHaveClass("ui-ovl");
    const textBlock = screen.getByText(/Omega: une collection/).parentElement;
    expect(textBlock.style.paddingRight).toBe("46px");
    expect(container.querySelector("img")).toBeNull();
  });

  test("with a photo the text keeps its full width", () => {
    card({ image: "https://img/a.jpg" });
    const textBlock = screen.getByText(/Omega: une collection/).parentElement;
    expect(textBlock.style.paddingRight).toBe("0px");
  });
});

