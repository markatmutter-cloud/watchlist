import React from "react";
import { render, screen } from "@testing-library/react";
import { MobileShell } from "./MobileShell";
import { buildMockShellProps } from "./__fixtures__/mockShellProps";

// Smoke tests for the mobile render path. The TDZ ReferenceError that
// shipped a white screen on mobile (2026-04-29) would have been caught
// by a single render-without-crash assertion — the existence of this
// suite is most of the value, even before any specific behavior is
// covered. Add behavioral tests as bugs surface; don't preemptively
// chase coverage.

describe("MobileShell", () => {
  test("renders without crashing on a default empty session", () => {
    render(<MobileShell {...buildMockShellProps()} />);
    // The brand wordmark button (top-left) is the home button — its
    // accessible name is "Home" (2026-05-28: added a home icon + aria-label
    // "Home" so a real user could find it; was previously named by its
    // "Watchlist" text). Assert that home button renders.
    expect(screen.getAllByRole("button", { name: /home/i }).length).toBeGreaterThanOrEqual(1);
  });

  test("Home renders no chrome of its own — the magazine owns the masthead", () => {
    // The magazine landing page carries wordmark, saved heart and account
    // control in MagazineChrome. This shell used to render its brand row on
    // Home as well, which put a SECOND account control (a hamburger, signed
    // out) above the masthead — Mark, 2026-09-08. Desktop already suppressed
    // its equivalent; mobile had been missed.
    render(<MobileShell {...buildMockShellProps({
      tab: "home",
      authJSX: <button type="button" aria-label="Menu">Menu</button>,
    })} />);
    expect(screen.queryAllByRole("button", { name: "Menu" })).toHaveLength(0);
    expect(screen.getByTestId("home-tab")).toBeInTheDocument();
  });

  test("a share-receive surface on Home keeps the brand row", () => {
    // Share / search-all surfaces leave tab="home" but are NOT the magazine,
    // so they still need the shell's own chrome.
    render(<MobileShell {...buildMockShellProps({
      tab: "home",
      shareActive: true,
      authJSX: <button type="button" aria-label="Menu">Menu</button>,
    })} />);
    expect(screen.getAllByRole("button", { name: "Menu" }).length).toBe(1);
  });

  test("renders the Filters icon button on a filterable tab", () => {
    // 2026-05-21 (PR #440): search row + Filters icon hidden on the
    // entire Watchlists tab per Mark spec. Switched the assertion to
    // tab=listings (Live sub-tab) so it tests the still-present case.
    render(<MobileShell {...buildMockShellProps({ tab: "listings", listingsSubTab: "live" })} />);
    expect(screen.getByLabelText("Filters")).toBeInTheDocument();
  });

  // Watches > ♡ Saved (2026-07-30 IA move) — mirrors the DesktopShell pair.
  test("Saved sub-tab: Filters available, ♥ Saved-only pill does not", () => {
    render(<MobileShell {...buildMockShellProps({
      tab: "listings",
      listingsSubTab: "saved",
      watchlist: { abc: { id: "abc" } },
    })} />);
    expect(screen.getByLabelText("Filters")).toBeInTheDocument();
    expect(screen.queryByTitle("Show only saved")).not.toBeInTheDocument();
  });

  test("Saved sub-tab with nothing saved: Filters suppressed (U-11)", () => {
    render(<MobileShell {...buildMockShellProps({
      tab: "listings",
      listingsSubTab: "saved",
      watchlist: {},
    })} />);
    expect(screen.queryByLabelText("Filters")).not.toBeInTheDocument();
  });

  test("hides the Filters button on Searches sub-tab (no list to filter)", () => {
    render(<MobileShell {...buildMockShellProps({
      tab: "watchlist",
      watchTopTab: "searches",
    })} />);
    expect(screen.queryByLabelText("Filters")).not.toBeInTheDocument();
  });

  test("renders the main tabs: Watches + Articles + Guides, and no Saved tab", () => {
    render(<MobileShell {...buildMockShellProps()} />);
    // 2026-10-16 (Mark): the Saved top tab is retired (Lists → account menu,
    // saved searches → search bar). Labels come from the shared topTabs model
    // (src/topTabs.js); "Guides" is the mobile label. Brand title still says
    // "Watchlist".
    expect(screen.getAllByText("Watchlist").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Watches").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("button", { name: "Saved" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Articles").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Guides")).toBeInTheDocument();
    expect(screen.queryByText("Collecting")).not.toBeInTheDocument();
    expect(screen.queryByText("Learn")).not.toBeInTheDocument();
    expect(screen.queryByText("Share")).not.toBeInTheDocument();
    expect(screen.queryByText("Collections")).not.toBeInTheDocument();
    expect(screen.queryByText("Cool Stuff")).not.toBeInTheDocument();
  });

  test("auction-catalog full-page takeover: shows the green bar, hides the main tabs", () => {
    // Mark 2026-06-13: drilling into a sale promotes the catalogue to a
    // full-page surface — the shell suppresses the masthead + main tabs and
    // renders the App-built green bar (catalogBarJSX) + action row instead.
    render(<MobileShell {...buildMockShellProps({
      tab: "listings",
      listingsSubTab: "auctions",
      catalogFullPage: true,
      catalogBarJSX: <div data-testid="catalog-bar">The New York Auction: XIV</div>,
      catalogActionRowJSX: <div data-testid="catalog-actions" />,
    })} />);
    expect(screen.getByTestId("catalog-bar")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-actions")).toBeInTheDocument();
    // Chrome suppressed: main-tab pills + brand wordmark gone.
    expect(screen.queryByText("Articles")).not.toBeInTheDocument();
    expect(screen.queryByText("Guides")).not.toBeInTheDocument();
    // Filter affordance stays (catalogue is still a filterable grid).
    expect(screen.getByLabelText("Filters")).toBeInTheDocument();
  });

  test("renders the drawer when drawerOpen is true", () => {
    render(<MobileShell {...buildMockShellProps({ drawerOpen: true })} />);
    // Drawer's "Show N watches" CTA is the most reliable in-drawer anchor.
    expect(screen.getByText(/Show 0 watches/)).toBeInTheDocument();
  });

  test("renders the watchlist tab content (passed via watchlistTabJSX prop)", () => {
    render(<MobileShell {...buildMockShellProps({ tab: "watchlist", watchTopTab: "listings" })} />);
    expect(screen.getByTestId("watchlist-tab")).toBeInTheDocument();
  });

  test("renders the listings tab content on the Listings main tab", () => {
    render(<MobileShell {...buildMockShellProps({ tab: "listings" })} />);
    expect(screen.getByTestId("listings-tab-content")).toBeInTheDocument();
  });

  test("renders the collections-style content on Saved > my-collection sub-tab", () => {
    // Bundle 2A.2 — same pattern as DesktopShell: the dispatch lives
    // in App.js, so the test simulates it by passing collections
    // content through the `watchlistTabJSX` prop slot.
    render(<MobileShell {...buildMockShellProps({
      tab: "watchlist",
      watchTopTab: "my-collection",
      watchlistTabJSX: <div data-testid="collections-tab" />,
    })} />);
    expect(screen.getByTestId("collections-tab")).toBeInTheDocument();
  });
});
