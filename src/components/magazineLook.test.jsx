import React from "react";
import { render, screen } from "@testing-library/react";
import { pillBase, segItem, SELECTED_FILL, CHROME } from "../styles";
import { PageHeader } from "./PageHeader";

// The legacy pill family (pillBase and friends, still worn inside the Lists page and the
// calendar) speaks the magazine's label voice: TYPE only, never a tap target or a selected
// state (Mark, 2026-10-16: "keep the segmented sub-tab pill"). These pin that boundary.
// There is no old look to compare with any more (the `?look=old` way back was removed).

describe("pillBase", () => {
  it("takes the label voice: small tracked caps", () => {
    const p = pillBase(false, { compact: true });
    expect(p.textTransform).toBe("uppercase");
    expect(p.fontSize).toBe(CHROME.MAG_LABEL_FONT);
    expect(p.letterSpacing).toBe(CHROME.MAG_LABEL_TRACKING);
    expect(p.padding).toBe(CHROME.MAG_PILL_PAD);
  });

  it("gives the touch (mobile) pill the larger pad, so its target does not shrink", () => {
    expect(pillBase(false).padding).toBe(CHROME.MAG_PILL_PAD_TOUCH);
  });

  it("keeps the olive-tint selected state exactly", () => {
    const on = pillBase(true, { compact: true });
    expect(on.background).toBe(SELECTED_FILL.background);
    expect(on.color).toBe(SELECTED_FILL.color);
    expect(on.boxShadow).toBe(SELECTED_FILL.boxShadow);
  });

  it("does not touch the segmented sub-tab item", () => {
    const item = segItem(false);
    expect(item.textTransform).toBeUndefined();
  });
});

describe("PageHeader's count", () => {
  it("is tracked caps, in tabular figures", () => {
    render(<PageHeader title="Lists" count="12 watches" isMobile={false} />);
    expect(screen.getByText("12 watches")).toHaveStyle({ textTransform: "uppercase" });
  });
});
