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

  test("renders all four main tabs (Listings / Saved / Collections / Learn)", () => {
    render(<DesktopShell {...buildMockShellProps()} />);
    expect(screen.getByText("Listings")).toBeInTheDocument();
    // Collections added 2026-05-06 PR #86. Bundle 2A.1 (2026-05-07)
    // renamed the "Watchlist" tab → "Saved" and the "Cool Stuff" tab
    // (URL key still `references`, component still `ReferencesTab`) →
    // "Learn". Internal/external naming divergence is documented in
    // CLAUDE.md.
    // The "Saved" UI label clashes with the "Saved" filter pill on
    // Listings sub-tabs, so use getAllByText and assert >= 1 — the
    // top-bar tab pill is always present on the default Listings tab.
    expect(screen.getAllByText("Saved").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Collections")).toBeInTheDocument();
    expect(screen.getByText("Learn")).toBeInTheDocument();
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

  test("renders the collections tab content on Collections tab", () => {
    render(<DesktopShell {...buildMockShellProps({ tab: "collections" })} />);
    expect(screen.getByTestId("collections-tab")).toBeInTheDocument();
  });
});
