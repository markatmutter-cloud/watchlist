import React from "react";
import { render } from "@testing-library/react";
import { ChromeTint, chromeIsLight } from "./chromeTint";

// The browser's tint follows the page's top surface. These pin the rule
// (Mark, 2026-10-16: an olive toolbar over a light page "looks weird").

const base = { tab: "listings", anyTakeover: false, lookNew: false, catalogFullPage: false };
const light = (over) => chromeIsLight({ ...base, ...over });

describe("chromeIsLight", () => {
  it("Home is light", () => expect(light({ tab: "home" })).toBe(true));

  it("the Watches page is light whatever the look flag says", () => {
    expect(light({})).toBe(true);
    expect(light({ lookNew: true })).toBe(true);
  });

  it("the shells' olive bar tabs are olive until ?look=new swaps the bar", () => {
    for (const tab of ["references", "watchlist", "watchbox", "admin"]) {
      expect(light({ tab })).toBe(false);
      expect(light({ tab, lookNew: true })).toBe(true);
    }
  });

  it("receive and search-all surfaces keep the olive bar (tab still says home)", () => {
    expect(light({ tab: "home", anyTakeover: true })).toBe(false);
    expect(light({ tab: "listings", anyTakeover: true })).toBe(false);
    expect(light({ tab: "home", anyTakeover: true, lookNew: true })).toBe(true);
  });

  it("the green catalog takeover is never light", () => {
    expect(light({ catalogFullPage: true })).toBe(false);
    expect(light({ catalogFullPage: true, lookNew: true })).toBe(false);
  });
});

describe("ChromeTint", () => {
  const tags = () => ({
    plain: document.querySelector('meta[name="theme-color"]:not([media])').getAttribute("content"),
    lightM: document.querySelector('meta[media*="light"]').getAttribute("content"),
    darkM: document.querySelector('meta[media*="dark"]').getAttribute("content"),
  });

  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="theme-color" content="#3b4a36" />
      <meta name="theme-color" media="(prefers-color-scheme: light)" content="#3b4a36" />
      <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#3b4a36" />`;
    document.documentElement.style.background = "";
  });

  it("paints the three tags and <html> paper over a light surface", () => {
    render(<ChromeTint light dark={false} />);
    expect(tags()).toEqual({ plain: "#ffffff", lightM: "#ffffff", darkM: "#1c1c1e" });
    expect(document.documentElement.style.background).toMatch(/255, 255, 255|#fff/);
  });

  it("paints olive over the shells' olive bar, darker in dark mode", () => {
    const { rerender } = render(<ChromeTint light={false} dark={false} />);
    expect(tags()).toEqual({ plain: "#3b4a36", lightM: "#3b4a36", darkM: "#2a3527" });
    rerender(<ChromeTint light={false} dark />);
    expect(document.documentElement.style.background).toMatch(/42, 53, 39|#2a3527/);
  });

  it("follows the surface when it changes", () => {
    const { rerender } = render(<ChromeTint light={false} dark={false} />);
    rerender(<ChromeTint light dark={false} />);
    expect(tags().plain).toBe("#ffffff");
  });
});
