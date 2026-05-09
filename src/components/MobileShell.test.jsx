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
    // "Watchlist" → "Saved", then 2026-05-09 IA pass renamed
    // "Saved" → "Watchlists". The brand title at the top still
    // says "Watchlist" (singular). So "Watchlist" appears at least
    // twice on the default mock (brand button + bottom-nav matches
    // /watchlist/i).
    expect(screen.getAllByRole("button", { name: /watchlist/i }).length).toBeGreaterThanOrEqual(1);
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

  test("renders the bottom tab bar with Listings + Watchlists + Learn", () => {
    render(<MobileShell {...buildMockShellProps()} />);
    // Bundle 2A.2 — Collections nav pill removed from bottom bar
    // (collapsed into Saved); Learn (URL key `references`) replaces
    // the Collections slot. 2026-05-09 IA pass renamed "Saved" →
    // "Watchlists". Three pills: Listings / Watchlists / Learn.
    // Brand title at the top still says "Watchlist" (singular).
    expect(screen.getAllByText("Watchlist").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Watchlists")).toBeInTheDocument();
    expect(screen.getByText("Listings")).toBeInTheDocument();
    expect(screen.getByText("Learn")).toBeInTheDocument();
    expect(screen.queryByText("Collections")).not.toBeInTheDocument();
    expect(screen.queryByText("Cool Stuff")).not.toBeInTheDocument();
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
