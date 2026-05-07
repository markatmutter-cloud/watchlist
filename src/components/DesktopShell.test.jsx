import React from "react";
import { render, screen } from "@testing-library/react";
import { DesktopShell } from "./DesktopShell";
import { buildMockShellProps } from "./__fixtures__/mockShellProps";

// Symmetric smoke tests for the desktop render path. Same logic as
// MobileShell.test — render-without-crash is the highest-value
// assertion until we have specific behavior worth pinning.

describe("DesktopShell", () => {
  test("renders without crashing on a default empty session", () => {
    render(<DesktopShell {...buildMockShellProps()} />);
    // The "Watchlist" home-link button anchors the top bar.
    const watchlistButtons = screen.getAllByText("Watchlist");
    expect(watchlistButtons.length).toBeGreaterThanOrEqual(1);
  });

  test("renders the three main tabs (Listings / Saved / Learn)", () => {
    render(<DesktopShell {...buildMockShellProps()} />);
    expect(screen.getByText("Listings")).toBeInTheDocument();
    // Bundle 2A.2 (2026-05-07) collapsed the standalone Collections
    // tab into Saved; nav pill is now Listings / Saved / Learn.
    // The "Saved" UI label clashes with the "Saved" filter pill on
    // Listings sub-tabs, so use getAllByText and assert >= 1 — the
    // top-bar tab pill is always present.
    expect(screen.getAllByText("Saved").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Learn")).toBeInTheDocument();
    // Collections is no longer a top-level tab pill.
    expect(screen.queryByText("Collections")).not.toBeInTheDocument();
  });

  test("renders the filter row on Listings tab", () => {
    render(<DesktopShell {...buildMockShellProps({ tab: "listings" })} />);
    // Filter row's Source pill is a stable anchor — it's always present
    // on the Listings tab regardless of state.
    expect(screen.getByRole("button", { name: /^Source/ })).toBeInTheDocument();
  });

  test("hides the filter row on Watchlist > Searches sub-tab", () => {
    render(<DesktopShell {...buildMockShellProps({
      tab: "watchlist",
      watchTopTab: "searches",
    })} />);
    // Source pill is filter-row-only; on Searches sub-tab a spacer
    // renders instead.
    expect(screen.queryByRole("button", { name: /^Source/ })).not.toBeInTheDocument();
  });

  test("renders the listings tab content on the Listings tab", () => {
    render(<DesktopShell {...buildMockShellProps({ tab: "listings" })} />);
    expect(screen.getByTestId("listings-tab-content")).toBeInTheDocument();
  });

  test("renders the watchlist tab content on Watchlist tab", () => {
    render(<DesktopShell {...buildMockShellProps({ tab: "watchlist" })} />);
    expect(screen.getByTestId("watchlist-tab")).toBeInTheDocument();
  });

  test("renders the collections-style content on Saved > my-collection sub-tab", () => {
    // Bundle 2A.2 (2026-05-07): Collections collapsed into Saved.
    // The dispatch in App.js maps watchTopTab=my-collection (and the
    // other collections-style subs) to the CollectionsTab content,
    // surfaced via the `watchlistTabJSX` prop slot. The mock fixture
    // sets `watchlistTabJSX` to the dispatched value; testing the
    // dispatch itself requires App.js, so here we just confirm the
    // content area renders the expected mock testid.
    render(<DesktopShell {...buildMockShellProps({
      tab: "watchlist",
      watchTopTab: "my-collection",
      // Simulate App.js's dispatch by passing collections content
      // through watchlistTabJSX (the prop name shells render).
      watchlistTabJSX: <div data-testid="collections-tab" />,
    })} />);
    expect(screen.getByTestId("collections-tab")).toBeInTheDocument();
  });
});
