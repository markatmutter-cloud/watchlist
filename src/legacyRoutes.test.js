import { savedUrlGoesToWatches } from "./legacyRoutes";

describe("savedUrlGoesToWatches", () => {
  it("sends a bare saved tab, the hearted landing and the old hearted subs to Watches > Saved", () => {
    for (const sub of [null, "hearted", "listings", "auctions", "sold", "wishlist"]) {
      for (const t of ["saved", "watchlist", "collections"]) {
        expect(savedUrlGoesToWatches(t, sub)).toBe(true);
      }
    }
  });

  it("keeps Lists, Searches and the shared inbox on the Lists page", () => {
    for (const sub of ["lists", "searches", "shared"]) {
      expect(savedUrlGoesToWatches("saved", sub)).toBe(false);
    }
  });

  it("leaves every other tab alone, and the old share link on Lists", () => {
    for (const t of ["listings", "references", "home", "watchbox", null, "share"]) {
      expect(savedUrlGoesToWatches(t, null)).toBe(false);
    }
  });
});
