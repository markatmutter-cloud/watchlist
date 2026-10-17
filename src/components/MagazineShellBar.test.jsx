import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MagazineShellBar, MagazineBrandRow, MagazineTabRow, MAGB_CSS } from "./MagazineShellBar";

// Direct coverage for the header every page wears. Page tests render MOCK content, so the
// bar itself would never execute in them.

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
    expect(MAGB_CSS).toContain(".mag.magb .mag-wordmark");
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

  it("wears the front page's faces (Bodoni wordmark, mono tabs) and loads them", () => {
    document.getElementById("mag-fonts")?.remove();
    const { container } = render(<MagazineShellBar tabs={tabs} authJSX={null} onHome={noop} />);
    expect(container.querySelector(".mag.magb")).not.toBeNull();
    expect(MAGB_CSS).toMatch(/Bodoni Moda/);
    expect(MAGB_CSS).toMatch(/IBM Plex Mono/);
    expect(document.getElementById("mag-fonts")).not.toBeNull();
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
