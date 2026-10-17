import React from "react";
import { render, screen } from "@testing-library/react";
import { PageShell, HeaderSearch } from "./PageShell";

// The page every src/ui tab sits in. The shell tests render MOCK content, so this is the
// place the header variants (standard, page-supplied, none) are pinned.

const noop = () => {};
const tabs = [{ key: "listings", label: "Watches", mobileLabel: "Watches", active: true, onSelect: noop }];
const base = { tabs, authJSX: <span data-testid="auth" />, user: { id: "u" }, onHome: noop, goToSaved: noop,
               aboutModalOpen: false, signInPromptOpen: false };

describe("PageShell", () => {
  it("wears the standard header bar on desktop and the brand + tab rows on a phone", () => {
    const d = render(<PageShell {...base}><p>body</p></PageShell>);
    expect(d.container.querySelector(".magb-bar")).not.toBeNull();
    expect(screen.getByText("body")).toBeInTheDocument();
    d.unmount();
    const m = render(<PageShell {...base} isMobile><p>body</p></PageShell>);
    expect(m.container.querySelector(".magb-brand")).not.toBeNull();
    expect(m.container.querySelector(".ui-page-stick .magb-tabs")).not.toBeNull();
  });

  it("takes a page-supplied header in place of the tab header (the catalog's title bar)", () => {
    const { container } = render(
      <PageShell {...base} header={<div data-testid="custom">Sale title</div>}><p>body</p></PageShell>);
    expect(screen.getByTestId("custom")).toBeInTheDocument();
    expect(container.querySelector(".ui-page-stick [data-testid='custom']")).not.toBeNull();
    expect(container.querySelector(".magb-bar")).toBeNull();
    expect(container.querySelector(".magb-brand")).toBeNull();
  });

  it("measures a page-supplied header so a sticky filter bar pins right under it", () => {
    const spy = jest.spyOn(Element.prototype, "getBoundingClientRect")
      .mockReturnValue({ height: 115, width: 0, top: 0, left: 0, right: 0, bottom: 115 });
    const { container, unmount } = render(
      <PageShell {...base} header={<div>Sale title</div>}><p>body</p></PageShell>);
    expect(container.querySelector(".ui-page").style.getPropertyValue("--ui-header-h")).toBe("115px");
    unmount();
    spy.mockRestore();
  });

  it("is bare for Home, whose masthead is part of its own page", () => {
    const { container } = render(<PageShell {...base} bare><p>the magazine</p></PageShell>);
    expect(screen.getByText("the magazine")).toBeInTheDocument();
    expect(container.querySelector(".magb-bar, .magb-brand, .ui-page-stick")).toBeNull();
  });

  it("still renders the overlays Home and every page need", () => {
    render(<PageShell {...base} bare overlaysJSX={<div data-testid="overlays" />}><p>x</p></PageShell>);
    expect(screen.getByTestId("overlays")).toBeInTheDocument();
  });

  describe("HeaderSearch: one place and one size for a page's search", () => {
    const field = <input type="search" aria-label="Search things" />;

    it("seats the page's search in the desktop header bar", () => {
      const { container } = render(<PageShell {...base}><HeaderSearch>{field}</HeaderSearch><p>body</p></PageShell>);
      expect(container.querySelector(".magb-bar .magb-search .ui-search-slot input[type='search']")).not.toBeNull();
      // ...and not also in the page body.
      expect(container.querySelectorAll("input[type='search']").length).toBe(1);
    });

    it("seats it in the phone's sticky block, under the tabs, and makes room for the row", () => {
      const { container } = render(<PageShell {...base} isMobile><HeaderSearch>{field}</HeaderSearch><p>body</p></PageShell>);
      expect(container.querySelector(".ui-page--phone-search")).not.toBeNull();
      expect(container.querySelector(".ui-page-stick .ui-page-search .ui-search-slot input[type='search']")).not.toBeNull();
    });

    it("reserves nothing when the page has no search", () => {
      const { container } = render(<PageShell {...base} isMobile><p>body</p></PageShell>);
      expect(container.querySelector(".ui-page-search")).toBeNull();
      expect(container.querySelector(".ui-page--phone-search")).toBeNull();
      const d = render(<PageShell {...base}><p>body</p></PageShell>);
      expect(d.container.querySelector(".magb-search")).toBeNull();
    });

    it("gives the room back when the page stops rendering its search", () => {
      const Page = ({ on }) => (
        <PageShell {...base} isMobile>{on ? <HeaderSearch>{field}</HeaderSearch> : null}<p>body</p></PageShell>);
      const { container, rerender } = render(<Page on />);
      expect(container.querySelector(".ui-page-search")).not.toBeNull();
      rerender(<Page on={false} />);
      expect(container.querySelector(".ui-page-search")).toBeNull();
    });

    it("renders inline outside a shell (a component test, say)", () => {
      const { container } = render(<HeaderSearch>{field}</HeaderSearch>);
      expect(container.querySelector("input[type='search']")).not.toBeNull();
    });

    it("a search the page passes in itself wins over the slot", () => {
      const { container } = render(
        <PageShell {...base} searchJSX={<input type="search" aria-label="Own" />}>
          <HeaderSearch>{field}</HeaderSearch>
        </PageShell>);
      expect(container.querySelector("input[aria-label='Own']")).not.toBeNull();
    });
  });
});
