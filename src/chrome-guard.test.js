// Chrome-consistency guard (Mark, 2026-06-03 polish session).
//
// The session's diagnosis: chrome consistency kept regressing because the
// rules lived in docs and heads — every surface could hand-roll its own
// header/filter-bar and drift apart one edit at a time (the date-divider gap
// took 4 attempts for the same reason). This test is the ENFORCEMENT layer of
// the escalation ladder (docs → code comment → a test that fails the build,
// per CLAUDE.md "Product QA"): the standard-library contract points below
// CANNOT silently drift, because drifting fails CI.
//
// Same source-scan pattern as service-worker.test.js (the B-21 drift guard).
// When one of these fails, fix the SURFACE to use the shared component/token —
// only change the assertion here if Mark has explicitly changed the rule.

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname);
const COMPONENTS = path.join(__dirname, "components");

const componentFiles = fs.readdirSync(COMPONENTS)
  .filter((f) => f.endsWith(".js") && !f.endsWith(".test.js"));
const srcRootFiles = fs.readdirSync(SRC)
  .filter((f) => f.endsWith(".js") && !f.endsWith(".test.js"));

const readComponent = (f) => fs.readFileSync(path.join(COMPONENTS, f), "utf8");
const readSrc = (f) => fs.readFileSync(path.join(SRC, f), "utf8");

describe("standard-library chrome contract", () => {
  test("the legacy shells and their chrome pieces stay deleted — src/ui is the one frame", () => {
    // DesktopShell / MobileShell and the pieces only they used (StandardFilterBar,
    // SubTabBar, the legacy Chip, SavedHeartLink, IdentityBand) were deleted 2026-10-17 when
    // the last page moved onto src/ui. FilterRow went the same way in 2026-06. Don't bring any
    // of them back: build the page from src/ui.
    for (const gone of ["FilterRow.js", "DesktopShell.js", "MobileShell.js", "StandardFilterBar.js",
                        "SubTabBar.js", "Chip.js", "SavedHeartLink.js", "IdentityBand.js", "HeartedView.js",
                        // Home sections nothing mounted since the magazine front page (MagazineHome) replaced them.
                        "HomeGuidesRow.js", "HomeAuctionModule.js", "MoonPhaseIndicator.js"]) {
      expect(fs.existsSync(path.join(COMPONENTS, gone))).toBe(false);
    }
    const offenders = componentFiles.filter((f) =>
      /from ["']\.\/(FilterRow|DesktopShell|MobileShell|StandardFilterBar|SubTabBar|Chip|SavedHeartLink|IdentityBand)["']/.test(readComponent(f)));
    expect(offenders).toEqual([]);
    expect(fs.existsSync(path.join(SRC, "lookFlag.js"))).toBe(false);
  });

  test("the legacy pill, header and chip helpers stay deleted", () => {
    // PageHeader, pillBase, innerToggleButton, tabPill, segTrack/segItem, producedPill, iconButton,
    // clearAllPill, dismissChip, the CHROME metrics sheet and the button / input / modal helpers
    // (actionButton, inputBase, modalShell, ...) were deleted 2026-10-17 when the last
    // page using them moved onto src/ui (Pill / SubTabs / Chip / DismissChip / SectionHead /
    // JumpNav). Build from src/ui; don't resurrect them.
    expect(fs.existsSync(path.join(COMPONENTS, "PageHeader.js"))).toBe(false);
    const styles = readSrc("styles.js");
    for (const gone of ["pillBase", "innerToggleButton", "tabPill", "segTrack", "segItem", "producedPill",
                        "iconButton", "clearAllPill", "dismissChip", "magLabel", "SELECTED_FILL", "export const CHROME",
                        "actionButton", "signInButton", "inputBase", "modalBackdrop", "modalShell", "modalCloseButton"]) {
      expect(styles).not.toContain(gone);
    }
    const offenders = componentFiles.filter((f) =>
      /\b(pillBase|innerToggleButton|PageHeader|clearAllPill|producedPill|actionButton|inputBase|modalShell|modalBackdrop)\b/.test(
        readComponent(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1")));
    expect(offenders).toEqual([]);
  });

  test("top-tab labels live ONLY in topTabs.js (no inline tab arrays)", () => {
    // The labels used to be duplicated inline in DesktopShell + MobileShell +
    // HomeTab — three render sites was exactly how labels drifted. Both the
    // old 3-tab array shape and any new hand-rolled copy must not reappear.
    const offenders = [...componentFiles.map((f) => ["components/" + f, readComponent(f)]),
                       ...srcRootFiles.filter((f) => f !== "topTabs.js").map((f) => [f, readSrc(f)])]
      .filter(([, src]) => /\[\s*\[\s*["']listings["']\s*,\s*["']Watches["']/.test(src))
      .map(([name]) => name);
    expect(offenders).toEqual([]);
  });

  test('no UI label says "Hearted" — the word is "Saved" (+ heart icon)', () => {
    // Mark's standing naming rule (2026-06-03): internal names (heartedOnly,
    // HeartedView, watchHearted…) are fine; user-facing labels are not.
    const uiHearted = /♥ Hearted|♡ Hearted|>Hearted</;
    const offenders = [...componentFiles.map((f) => ["components/" + f, readComponent(f)]),
                       ...srcRootFiles.map((f) => [f, readSrc(f)])]
      .filter(([, src]) => uiHearted.test(src))
      .map(([name]) => name);
    expect(offenders).toEqual([]);
  });

  test("every page's header renders the tabs from the shared topTabs model", () => {
    // App builds `pageChromeProps.tabs` from topTabs, and PageShell hands them to the one
    // header. Home's masthead consumes the same model via homeMastheadTabs (MagazineHome
    // hands it to MagazineChrome).
    expect(readSrc("App.js")).toMatch(/tabs: topTabs/);
    expect(fs.readFileSync(path.join(SRC, "ui", "PageShell.js"), "utf8")).toContain("tabs={tabs}");
    expect(readComponent("MagazineHome.js")).toContain("homeMastheadTabs");
    expect(readComponent("MagazineChrome.js")).toContain("tabs");
  });
});
