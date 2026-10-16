import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MagazineShellBar, MagazineBrandRow, MagazineTabRow, MAGB_CSS } from "./MagazineShellBar";
import { DesktopShell } from "./DesktopShell";
import { MobileShell } from "./MobileShell";
import { buildMockShellProps } from "./__fixtures__/mockShellProps";

// Direct coverage for the compact shell bar, plus the one thing shell tests
// can't see: that `lookNew` swaps the olive bar and nothing else. Shell tests
// render MOCK content, so the bar itself never executes in them.

const noop = () => {};
const tabs = [
  { key: "listings", label: "Watches", mobileLabel: "Watches", active: false, onSelect: noop },
  { key: "guides", label: "Reference Guides", mobileLabel: "Guides", active: true, onSelect: noop },
];

describe("MAGB_CSS", () => {
  it("is a whole stylesheet (a stray backtick in a comment would truncate it)", () => {
    expect(typeof MAGB_CSS).toBe("string");
    expect(MAGB_CSS).toContain(".magb-bar");
    expect(MAGB_CSS).toContain(".magb-tabs");
    expect(MAGB_CSS).toContain(".mag.magb--display .mag-wordmark");
    expect(MAGB_CSS.split("{").length).toBe(MAGB_CSS.split("}").length);
  });
});

describe("MagazineShellBar", () => {
  it("renders the wordmark, the tabs and the account control it was given", () => {
    render(<MagazineShellBar tabs={tabs} authJSX={<span data-testid="auth" />}
                             showSaved onSavedClick={noop} onHome={noop} />);
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByText("Watchlist")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Watches" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reference Guides" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("auth")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saved watches" })).toBeInTheDocument();
  });

  it("has no search of its own (each tab keeps the one it has)", () => {
    const { container } = render(<MagazineShellBar tabs={tabs} authJSX={null} onHome={noop} />);
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("[role='search']")).toBeNull();
  });

  it("omits the heart when signed out", () => {
    render(<MagazineShellBar tabs={tabs} authJSX={null} showSaved={false} onSavedClick={noop} onHome={noop} />);
    expect(screen.queryByRole("button", { name: "Saved watches" })).toBeNull();
  });

  it("the wordmark goes home and a tab fires its own handler", () => {
    const onHome = jest.fn();
    const onSelect = jest.fn();
    render(<MagazineShellBar tabs={[{ ...tabs[0], onSelect }]} authJSX={null} onHome={onHome} />);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    fireEvent.click(screen.getByRole("button", { name: "Watches" }));
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("loads the display faces only when asked for them", () => {
    document.getElementById("mag-fonts")?.remove();
    const { container, unmount } = render(<MagazineShellBar tabs={tabs} authJSX={null} onHome={noop} faces="system" />);
    expect(container.querySelector(".magb--display")).toBeNull();
    expect(document.getElementById("mag-fonts")).toBeNull();
    unmount();
    const shown = render(<MagazineShellBar tabs={tabs} authJSX={null} onHome={noop} faces="display" />);
    expect(shown.container.querySelector(".magb--display")).not.toBeNull();
    expect(document.getElementById("mag-fonts")).not.toBeNull();
    document.getElementById("mag-fonts")?.remove();
  });
});

describe("mobile rows", () => {
  it("brand row carries the wordmark + account; tab row uses the short labels", () => {
    render(<>
      <MagazineBrandRow authJSX={<span data-testid="auth" />} showSaved onSavedClick={noop} onHome={noop} />
      <MagazineTabRow tabs={tabs} />
    </>);
    expect(screen.getByText("Watchlist")).toBeInTheDocument();
    expect(screen.getByTestId("auth")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guides" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reference Guides" })).toBeNull();
  });
});

describe("shells with lookNew", () => {
  beforeEach(() => { window.innerWidth = 1440; });

  it("DesktopShell swaps the olive bar for the magazine bar, nothing else", () => {
    const setTab = jest.fn();
    const { container } = render(<DesktopShell {...buildMockShellProps({ tab: "listings", lookNew: true, setTab })} />);
    expect(container.querySelector(".magb-bar")).not.toBeNull();
    // Everything below the bar is the shell's own, untouched.
    expect(screen.getAllByText("Source").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("listings-tab-content")).toBeInTheDocument();
    // One Home affordance, not the olive bar's ⌂ plus a wordmark.
    expect(screen.getAllByRole("button", { name: "Home" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(setTab).toHaveBeenCalledWith("home");
  });

  it("DesktopShell without lookNew is the olive bar, exactly as before", () => {
    const { container } = render(<DesktopShell {...buildMockShellProps({ tab: "listings" })} />);
    expect(container.querySelector(".magb-bar")).toBeNull();
  });

  it("the catalog takeover still wins over the new bar", () => {
    const { container } = render(<DesktopShell {...buildMockShellProps({
      tab: "listings", lookNew: true, catalogFullPage: true,
      catalogBarJSX: <div data-testid="catalog-bar" />, catalogActionRowJSX: null,
    })} />);
    expect(screen.getByTestId("catalog-bar")).toBeInTheDocument();
    expect(container.querySelector(".magb-bar")).toBeNull();
  });

  it("MobileShell swaps both olive rows for the magazine rows", () => {
    const { container } = render(<MobileShell {...buildMockShellProps({ tab: "listings", lookNew: true })} />);
    expect(container.querySelector(".magb-brand")).not.toBeNull();
    expect(container.querySelector(".magb-tabs")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Guides" })).toBeInTheDocument();
  });

  it("MobileShell without lookNew keeps the olive rows", () => {
    const { container } = render(<MobileShell {...buildMockShellProps({ tab: "listings" })} />);
    expect(container.querySelector(".magb-brand")).toBeNull();
    expect(container.querySelector(".magb-tabs")).toBeNull();
  });

  it("Home renders no bar from the shell on either viewport (the magazine owns it)", () => {
    const d = render(<DesktopShell {...buildMockShellProps({ tab: "home", lookNew: true })} />);
    expect(d.container.querySelector(".magb-bar")).toBeNull();
    d.unmount();
    const m = render(<MobileShell {...buildMockShellProps({ tab: "home", lookNew: true })} />);
    expect(m.container.querySelector(".magb-brand")).toBeNull();
  });
});
