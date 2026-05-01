import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    // "Watchlist" appears twice on the default Watchlist tab — once as
    // the title-bar button at top, once as the active bottom-tab label.
    // getAllByRole + length assertion captures both without picking one.
    const watchlistButtons = screen.getAllByRole("button", { name: /watchlist/i });
    expect(watchlistButtons.length).toBeGreaterThanOrEqual(2);
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

  test("opens the View menu when the eye button is tapped", async () => {
    const setViewMenuOpen = jest.fn();
    render(<MobileShell {...buildMockShellProps({ setViewMenuOpen })} />);
    const viewBtn = screen.getByLabelText("View options");
    await userEvent.click(viewBtn);
    // The first arg passed to setViewMenuOpen is the updater function
    // (`o => !o`) — invoke it against `false` to confirm it flips.
    const updater = setViewMenuOpen.mock.calls[0][0];
    expect(updater(false)).toBe(true);
  });

  test("renders the bottom tab bar with Listings + Watchlist", () => {
    render(<MobileShell {...buildMockShellProps()} />);
    // Both labels appear twice (top title + bottom tab on Watchlist tab),
    // so use getAllByText for the bottom-bar specifically.
    const watchlistButtons = screen.getAllByText("Watchlist");
    expect(watchlistButtons.length).toBeGreaterThanOrEqual(1);
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

  test("renders the listings grid on the Listings main tab", () => {
    render(<MobileShell {...buildMockShellProps({ tab: "listings" })} />);
    expect(screen.getByTestId("listings-grid")).toBeInTheDocument();
  });
});
