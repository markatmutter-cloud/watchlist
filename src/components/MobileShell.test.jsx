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
    // Bundle 2A.1 (2026-05-07) renamed the bottom-nav tab
    // "Watchlist" → "Saved" while the brand title at the top stays
    // "Watchlist". So "Watchlist" appears once (brand title button)
    // and "Saved" once (bottom-nav active tab on the default
    // tab=watchlist mock state).
    expect(screen.getAllByRole("button", { name: /watchlist/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: /saved/i }).length).toBeGreaterThanOrEqual(1);
  });

  test("renders the Filters icon button when not on Searches/Calendar sub-tabs", () => {
    render(<MobileShell {...buildMockShellProps({ watchTopTab: "listings" })} />);
    expect(screen.getByLabelText("Filters")).toBeInTheDocument();
  });

  test("hides the Filters button on Searches sub-tab (no list to filter)", () => {
    render(<MobileShell {...buildMockShellProps({
      tab: "watchlist",
      watchTopTab: "searches",
    })} />);
    expect(screen.queryByLabelText("Filters")).not.toBeInTheDocument();
  });

  test("renders the bottom tab bar with Listings + Saved", () => {
    render(<MobileShell {...buildMockShellProps()} />);
    // Bundle 2A.1 — bottom-nav tab is now "Saved" (UI label) backed
    // by `?tab=watchlist` (URL key). Brand title at the top stays
    // "Watchlist".
    expect(screen.getAllByText("Watchlist").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Saved").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Listings")).toBeInTheDocument();
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

  test("renders the collections tab content when tab=collections", () => {
    render(<MobileShell {...buildMockShellProps({ tab: "collections" })} />);
    expect(screen.getByTestId("collections-tab")).toBeInTheDocument();
  });
});
