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
    const searchModule = fs.readFileSync(path.join(__dirname, "SearchField.js"), "utf8");
    for (const name of ["Pill", "SavedPill", "SubTabs", "FilterBar", "PageFrame", "Count", "AccountDisc"]) {
      expect(index).toMatch(new RegExp(`export function ${name}\\b`));
    }
    // The search field and its suggestion rows live in their own module (so Home's masthead can
    // import them without a cycle) and are re-exported from the one index.
    for (const name of ["SearchField", "SuggestionRows"]) {
      expect(searchModule).toMatch(new RegExp(`export function ${name}\\b`));
      expect(index).toMatch(new RegExp(`export \\{[^}]*\\b${name}\\b[^}]*\\} from "\\./SearchField"`));
    }
  });

  test("responsiveness is a CONTAINER query, so the style sheet can show the phone layout in a desktop window", () => {
    expect(css).toMatch(/@container ui-frame \(max-width: 640px\)/);
    expect(css).not.toMatch(/@media \(max-width/);
  });

  test("the retired forms stay retired: no underline tabs, no page title, no tinted pill", () => {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(stripped).not.toMatch(/\.ui-tabs--underline|\.ui-title|\.ui-pill--solid|brand-olive-tint/);
    expect(index).not.toMatch(/export function PageTitle/);
  });

  test("the page-frame sizes are variables a page cannot quietly override", () => {
    for (const v of ["--ui-inset", "--ui-bar-h", "--ui-control-h", "--ui-search-h"]) {
      expect(css).toContain(`${v}:`);
    }
  });

  // Pages already moved onto src/ui. Add a file here when its tab migrates; the legacy
  // pieces below are deleted for good when the last page leaves them.
  const MIGRATED = [
    "components/EditorialView.js", "components/ReferenceBrowse.js",
    "components/MagazineWatches.js", "components/FilterDrawer.js", "components/ListingsFilters.js",
    "components/LumeConversation.js", "components/ChatBubbleHost.js", "components/LumeCanvas.js",
    "components/ReferencesTab.js", "components/CatalogPage.js", "components/ListsPage.js",
    "components/CollectionsTab.js", "components/AuctionCalendar.js", "components/ReferencePage.js",
    "components/SearchResultsView.js", "components/ActiveFiltersStrip.js", "components/ChallengesView.js",
    "components/ChallengeReceiver.js", "components/ListReviewMode.js",
    "components/CollectionEditModal.js", "components/FavSearchModal.js", "components/AddSearchModal.js",
    "components/ConfirmModal.js", "components/SignInPromptModal.js", "components/MarkAsSoldModal.js",
    "components/ManageListSheet.js", "components/ManualEntryForm.js", "components/ListingPickerModal.js",
    "components/CollectionPickerModal.js", "components/NotePickerModal.js", "components/TrackNewItemModal.js",
    "components/SettingsModal.js", "components/AboutModal.js", "components/WatchDetailSheet.js",
    "components/SharedReceiveFrame.js", "components/ChallengeFlow.js", "components/AdminTab.js",
    "components/SizeCompare.js", "components/Links.js", "components/SiteFooter.js",
    "components/ViewSettingsControls.js",
  ];
  const LEGACY = [
    /from "\.\/StandardFilterBar"/, /from "\.\/PageHeader"/, /from "\.\/Chip"/, /from "\.\/SavedPill"/,
    /\bpillBase\b/, /\bclearAllPill\b/, /from "\.\/SubTabBar"/,
  ];
  test.each(MIGRATED)("%s is built from src/ui, not the legacy pieces", (file) => {
    const src = fs.readFileSync(path.join(__dirname, "..", file), "utf8")
      // Full-line // comments first (one can mention a "/*" path), then block comments, then trailing // ones.
      .replace(/^\s*\/\/[^\n]*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
    expect(src).toMatch(/from "\.\.\/ui"/);
    for (const re of LEGACY) expect(src).not.toMatch(re);
  });
});
