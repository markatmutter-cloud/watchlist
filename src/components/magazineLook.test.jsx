import React from "react";
import { render, screen } from "@testing-library/react";
import { pillBase, segItem, SELECTED_FILL, setMagazineLook, LOOK, CHROME } from "../styles";
import { StandardFilterBar, StandardSearchInput } from "./StandardFilterBar";
import { PageHeader } from "./PageHeader";

// The magazine look changes TYPE on pills and counts, and nothing that governs
// a tap target, a selected state or the segmented sub-tab (Mark, 2026-10-16:
// "keep the segmented sub-tab pill"). These pin that boundary.

afterEach(() => setMagazineLook(false));

describe("pillBase under the magazine look", () => {
  it("is unchanged in the old look", () => {
    const p = pillBase(false, { compact: true });
    expect(p.fontSize).toBe(CHROME.PILL_FONT);
    expect(p.textTransform).toBeUndefined();
    expect(p.padding).toBe(CHROME.PILL_PAD);
  });

  it("takes the label voice: small tracked caps", () => {
    setMagazineLook(true);
    const p = pillBase(false, { compact: true });
    expect(p.textTransform).toBe("uppercase");
    expect(p.fontSize).toBe(CHROME.MAG_LABEL_FONT);
    expect(p.letterSpacing).toBe(CHROME.MAG_LABEL_TRACKING);
    expect(p.padding).toBe(CHROME.MAG_PILL_PAD);
  });

  it("gives the touch (mobile) pill the larger pad, so its target does not shrink", () => {
    setMagazineLook(true);
    expect(pillBase(false).padding).toBe(CHROME.MAG_PILL_PAD_TOUCH);
  });

  it("keeps the olive-tint selected state exactly (it is the quieter of the two active treatments)", () => {
    setMagazineLook(true);
    const on = pillBase(true, { compact: true });
    expect(on.background).toBe(SELECTED_FILL.background);
    expect(on.color).toBe(SELECTED_FILL.color);
    expect(on.boxShadow).toBe(SELECTED_FILL.boxShadow);
  });

  it("leaves the segmented sub-tab alone (the June audit's U-01 shape)", () => {
    const before = segItem(true);
    setMagazineLook(true);
    expect(segItem(true)).toEqual(before);
    expect(segItem(true).textTransform).toBeUndefined();
  });
});

describe("counts under the magazine look", () => {
  it("StandardFilterBar's count is tracked caps, and reserves room for it", () => {
    setMagazineLook(true);
    render(<StandardFilterBar pills={<span />} search={<span />} count="11,288 articles" isMobile />);
    const el = screen.getByText("11,288 articles");
    expect(el).toHaveStyle({ textTransform: "uppercase" });
    expect(el).toHaveStyle({ minWidth: `${CHROME.MAG_COUNT_MIN_W}px` });
  });

  it("StandardFilterBar's count stays plain in the old look", () => {
    render(<StandardFilterBar pills={<span />} search={<span />} count="11,288 articles" isMobile />);
    const el = screen.getByText("11,288 articles");
    expect(el.style.textTransform).toBe("");
    expect(el).toHaveStyle({ minWidth: "86px" });
  });

  it("PageHeader's count follows the same rule", () => {
    setMagazineLook(true);
    render(<PageHeader title="Saved" count="12 watches" isMobile={false} />);
    expect(screen.getByText("12 watches")).toHaveStyle({ textTransform: "uppercase" });
  });
});

describe("search under the magazine look (B-101)", () => {
  it("is bigger than the old 30px / 13px field, and the bar gives it a wider slot", () => {
    window.innerWidth = 1400; // above the narrow-desktop guard
    const barOld = render(<StandardFilterBar pills={<span />} search={<span data-testid="s" />} isMobile={false} />);
    const gridOld = barOld.container.firstChild.style.gridTemplateColumns;
    barOld.unmount();
    setMagazineLook(true);
    const barNew = render(<StandardFilterBar pills={<span />} search={<span data-testid="s" />} isMobile={false} />);
    const gridNew = barNew.container.firstChild.style.gridTemplateColumns;
    expect(gridOld).toContain("340px");
    expect(gridNew).toContain("520px");
    barNew.unmount();

    const { container } = render(<StandardSearchInput value="" onChange={() => {}} placeholder="Search articles…" />);
    expect(container.firstChild).toHaveStyle({ height: `${CHROME.MAG_SEARCH_H}px` });
    expect(screen.getByPlaceholderText("Search articles…")).toHaveStyle({ fontSize: `${CHROME.MAG_SEARCH_FONT}px` });
  });

  it("is unchanged in the old look", () => {
    const { container } = render(<StandardSearchInput value="" onChange={() => {}} placeholder="Search guides…" />);
    expect(container.firstChild).toHaveStyle({ height: `${CHROME.CONTROL_H}px` });
    expect(screen.getByPlaceholderText("Search guides…")).toHaveStyle({ fontSize: "13px" });
  });
});

describe("the flag", () => {
  it("starts off, so component tests render the old look unless they opt in", () => {
    expect(LOOK.magazine).toBe(false);
  });
});
