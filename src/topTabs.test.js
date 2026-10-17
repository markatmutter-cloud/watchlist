import { TOP_TABS, isTopTabActive } from "./topTabs";

// The top-level tab model is ONE source of truth. Mark retired the Saved tab on
// 2026-10-16 ("I've not been using that as a tab"): what lived there moved to
// the heart in the bar, the ♡ pills, the search bar's suggestions and the
// account menu's Lists entry. Re-adding a tab is a product decision, so it
// fails here first.
describe("TOP_TABS", () => {
  it("is Watches, Articles, Reference Guides, in that order", () => {
    expect(TOP_TABS.map((t) => t.label)).toEqual(["Watches", "Articles", "Reference Guides"]);
  });

  it("has no Saved / Lists tab", () => {
    expect(TOP_TABS.some((t) => /saved|lists/i.test(t.label) || t.key === "watchlist")).toBe(false);
  });

  it("highlights nothing while you are in the Lists container (like the tools pages)", () => {
    expect(TOP_TABS.some((t) => isTopTabActive(t, "watchlist", "editorial"))).toBe(false);
  });

  it("Articles and Guides share the references container, told apart by sub-tab", () => {
    const [, articles, guides] = TOP_TABS;
    expect(isTopTabActive(articles, "references", "editorial")).toBe(true);
    expect(isTopTabActive(guides, "references", "editorial")).toBe(false);
    expect(isTopTabActive(guides, "references", "references")).toBe(true);
  });
});
