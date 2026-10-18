import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CardStrip from "./CardStrip";

// Direct render coverage (blind-edit rule): shell tests render mock grids, so
// CardStrip's own DOM never executes in them. B-88 shipped for months behind
// exactly that gap.

const items = Array.from({ length: 8 }, (_, i) => ({ id: `i${i}`, title: `Item ${i}` }));
const renderCard = (it) => <div>{it.title}</div>;

// jsdom reports every element as 0x0, so overflow never registers on its own.
// Force the geometry the way a real 1240px viewport would.
function withOverflow(scrollWidth, clientWidth, scrollLeft = 0) {
  // jsdom returns the inline padding shorthand, which CardStrip parses for the
  // resting-position offset, so no extra stubbing is needed for paddingLeft.
  const proto = window.HTMLElement.prototype;
  const defs = {
    scrollWidth: { configurable: true, get: () => scrollWidth },
    clientWidth: { configurable: true, get: () => clientWidth },
    scrollLeft: { configurable: true, get: () => scrollLeft, set: () => {} },
  };
  Object.defineProperties(proto, defs);
  return () => {
    ["scrollWidth", "clientWidth", "scrollLeft"].forEach((k) => delete proto[k]);
  };
}

describe("CardStrip", () => {
  it("renders every item it is given", () => {
    render(<CardStrip items={items} renderCard={renderCard} isMobile={false} />);
    expect(screen.getByText("Item 0")).toBeInTheDocument();
    expect(screen.getByText("Item 7")).toBeInTheDocument();
  });

  it("caps at `max`", () => {
    render(<CardStrip items={items} renderCard={renderCard} isMobile={false} max={3} />);
    expect(screen.getByText("Item 2")).toBeInTheDocument();
    expect(screen.queryByText("Item 3")).toBeNull();
  });

  it("offers scroll arrows on desktop once the row overflows (B-88)", () => {
    const restore = withOverflow(2520, 1240);
    try {
      render(<CardStrip items={items} renderCard={renderCard} isMobile={false} label="Recently added" />);
      expect(screen.getByLabelText("Scroll Recently added right")).toBeInTheDocument();
      expect(screen.getByLabelText("Scroll Recently added left")).toBeInTheDocument();
      // The shared overlay button in its paper form, not a strip-local style.
      expect(screen.getByLabelText("Scroll Recently added right")).toHaveClass("ui-ovl", "ui-ovl--light");
    } finally {
      restore();
    }
  });

  it("scrolls the row when the next arrow is pressed", () => {
    const restore = withOverflow(2520, 1240);
    const calls = [];
    window.HTMLElement.prototype.scrollBy = function scrollBy(arg) { calls.push(arg); };
    try {
      render(<CardStrip items={items} renderCard={renderCard} isMobile={false} label="Sold" />);
      fireEvent.click(screen.getByLabelText("Scroll Sold right"));
      expect(calls.length).toBe(1);
      expect(calls[0].left).toBeGreaterThan(0);
    } finally {
      delete window.HTMLElement.prototype.scrollBy;
      restore();
    }
  });

  it("renders no arrows on mobile, where the gesture already exists", () => {
    const restore = withOverflow(2520, 375);
    try {
      render(<CardStrip items={items} renderCard={renderCard} isMobile label="Recently added" />);
      expect(screen.queryByLabelText("Scroll Recently added right")).toBeNull();
    } finally {
      restore();
    }
  });

  it("treats a padding-offset resting position as the start (no fade over card 1)", () => {
    // scroll-snap settles the first tile at scrollLeft === paddingLeft, not 0.
    const restore = withOverflow(2520, 1240, 20);
    try {
      const { container } = render(<CardStrip items={items} renderCard={renderCard} isMobile={false} label="Recently added" />);
      const fades = [...container.querySelectorAll('div[aria-hidden="true"]')];
      // The left fade is the one anchored to left: 0.
      const leftFade = fades.find((f) => f.style.left === "0px" && f.style.right === "");
      expect(leftFade).toBeTruthy();
      expect(leftFade.style.opacity).toBe("0");
    } finally {
      restore();
    }
  });

  it("contains overscroll so a swipe at the rail edge can't trigger back-navigation (B-89)", () => {
    const { container } = render(<CardStrip items={items} renderCard={renderCard} isMobile />);
    const css = container.querySelector("style").textContent;
    expect(css).toContain("overscroll-behavior-x:contain");
  });
});
