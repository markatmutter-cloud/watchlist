// Guard for the shared page frame (src/ui). The point of src/ui is ONE definition
// per piece; these fail the build when that starts to erode. When one fails, fix
// the surface (use the piece), or — if Mark has decided the piece changes — change
// ui.css and the style sheet together.

const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(path.join(__dirname, "ui.css"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

describe("src/ui", () => {
  test("ui.css colours come from tokens, not literals (dark mode and the olive stay in one place)", () => {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const literals = (stripped.match(/#[0-9a-fA-F]{3,8}\b/g) || []).filter((h) => h.toLowerCase() !== "#fff");
    expect(literals).toEqual([]);
  });

  test("every shared piece is exported from the one index", () => {
    for (const name of ["Pill", "SavedPill", "SearchField", "SubTabs", "PageTitle", "FilterBar",
                        "PageFrame", "Count", "AccountDisc", "SuggestionRows"]) {
      expect(index).toMatch(new RegExp(`export function ${name}\\b`));
    }
  });

  test("responsiveness is a CONTAINER query, so the style sheet can show the phone layout in a desktop window", () => {
    expect(css).toMatch(/@container ui-frame \(max-width: 640px\)/);
    expect(css).not.toMatch(/@media \(max-width/);
  });

  test("the page-frame sizes are variables a page cannot quietly override", () => {
    for (const v of ["--ui-inset", "--ui-bar-h", "--ui-control-h", "--ui-search-h"]) {
      expect(css).toContain(`${v}:`);
    }
  });
});
