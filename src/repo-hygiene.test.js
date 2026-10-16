// Repo hygiene guard. On 2026-10-16 a `node_modules` SYMLINK (a dev shortcut
// between two git worktrees) was committed by a blanket `git add -A`: the
// .gitignore entry was `node_modules/`, and a trailing slash matches
// directories only, so a symlink of the same name slipped past it. Nothing
// failed — it sat on main until it clobbered a worktree's installed deps on
// the next checkout. Two checks keep that from happening quietly again.

const { execSync } = require("child_process");

const git = (args) => {
  try {
    return execSync(`git ${args}`, { cwd: __dirname, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null; // not a git checkout (e.g. a tarball) — nothing to assert
  }
};

describe("repo hygiene", () => {
  test("no symlink is tracked (they carry machine-specific absolute paths)", () => {
    const out = git("ls-files -s");
    if (out === null) return;
    const symlinks = out.split("\n").filter((l) => l.startsWith("120000")).map((l) => l.split("\t")[1]);
    expect(symlinks).toEqual([]);
  });

  test("node_modules is ignored whether it is a directory OR a symlink", () => {
    // Asserted on the pattern itself: when a real node_modules/ directory
    // exists (CI), `git check-ignore` matches a slash-terminated pattern too,
    // so it could not catch the slip.
    const lines = require("fs").readFileSync(require("path").join(__dirname, "..", ".gitignore"), "utf8")
      .split("\n").map((l) => l.trim());
    expect(lines).toContain("node_modules");
    expect(lines).not.toContain("node_modules/");
  });
});
