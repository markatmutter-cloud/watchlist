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
    "components/ViewSettingsControls.js", "components/CardShell.js",
    "components/Breadcrumb.js", "components/ErrorBoundary.js", "components/LotMigrationBanner.js",
    "components/LumeModule.js", "components/LumeResultGrid.js", "components/LumeResultPanel.js",
    "components/CardStrip.js", "components/MagazineHome.js",
    "components/LumeMemorySettings.js", "components/LumeLead.js", "components/ListRow.js", "components/DossierBlocks.js",
  ];
  const LEGACY = [
    /from "\.\/StandardFilterBar"/, /from "\.\/PageHeader"/, /from "\.\/Chip"/, /from "\.\/SavedPill"/,
    /\bpillBase\b/, /\bclearAllPill\b/, /from "\.\/SubTabBar"/,
    // The hand-rolled card overlay buttons and menu rows (now OverlayButton / OverlayMenu / MenuItem).
    /\boverlayBtn\b/, /\boverlayIconBtn\b/, /\bmenuItemStyle\b/, /\barticleMenuItemStyle\b/, /\bOverflowMenu\b/, /\bwlMenuItem\b/, /\bwlIconBtn\b/, /\bmodalScrim\b/, /\beditorialPanel\b/, /\bskipBtnStyle\b/, /\bsaveBtnStyle\b/,
  ];
  test.each(MIGRATED)("%s is built from src/ui, not the legacy pieces", (file) => {
    const src = fs.readFileSync(path.join(__dirname, "..", file), "utf8")
      // Full-line // comments first (one can mention a "/*" path), then block comments, then trailing // ones.
      .replace(/^\s*\/\/[^\n]*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
    expect(src).toMatch(/from "\.\.\/ui"/);
    for (const re of LEGACY) expect(src).not.toMatch(re);
  });

  // One form field. A raw <input>/<select>/<textarea> in a page or dialog is a hand-rolled look
  // (its own border, radius, padding): use Input / Textarea / Select. LumeInput's chat box is the
  // one exception (it lives in the Lumé panel's own composer, styled by .ui-lume-*).
  const FIELD_OK = [/type="(file|hidden|checkbox|search)"/];
  const FIELD_EXEMPT = ["components/LumeInput.js"];
  const componentFiles = fs.readdirSync(path.join(__dirname, "..", "components"))
    .filter((f) => f.endsWith(".js") && !f.endsWith(".test.js"))
    .map((f) => `components/${f}`).concat(["App.js"]);
  test.each(componentFiles.filter((f) => !FIELD_EXEMPT.includes(f)))("%s has no raw form fields", (file) => {
    const src = fs.readFileSync(path.join(__dirname, "..", file), "utf8")
      .replace(/^\s*\/\/[^\n]*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const offenders = [];
    const re = /<(input|select|textarea)\b/g;
    let m;
    while ((m = re.exec(src))) {
      let i = re.lastIndex, depth = 0;
      for (; i < src.length; i++) {
        const c = src[i];
        if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth === 0) break;
      }
      const tag = src.slice(m.index, i + 1);
      if (!tag.includes("ui-input") && !FIELD_OK.some((r) => r.test(tag))) offenders.push(tag.slice(0, 60).replace(/\s+/g, " "));
    }
    expect(offenders).toEqual([]);
  });
});

