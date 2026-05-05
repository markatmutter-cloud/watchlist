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

  test("renders all three main tabs (Listings / Watchlist / Cool Stuff)", () => {
    render(<DesktopShell {...buildMockShellProps()} />);
    expect(screen.getByText("Listings")).toBeInTheDocument();
    // The third top-tab was relabelled "Reference" → "Cool Stuff" on
    // 2026-05-04. URL key (?tab=references) and component name
    // (ReferencesTab) stayed unchanged; only the user-facing label moved.
    expect(screen.getByText("Cool Stuff")).toBeInTheDocument();
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
});
