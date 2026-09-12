#!/usr/bin/env node
/**
 * Release driver.
 *
 * Order matters: prove lineage against the release remote, let bumpp resolve
 * the version, generate the changelog, then commit, tag and push. Every step
 * that mutates anything re-checks its inputs first, because a half-published
 * release is worse than a refused one.
 *
 * The module only runs `main()` when invoked directly, so the guards below are
 * importable and testable against a throwaway repository.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import versionBump from "bumpp";
import { getPublishedReleaseLineage, root } from "./release-lineage.mjs";

const RELEASE_FILES = ["CHANGELOG.md", "package.json"];
const CHANGELOG_FILE = "CHANGELOG.md";
const PACKAGE_FILE = "package.json";

const selfPath = fileURLToPath(import.meta.url);

function runGit(args, cwd, stdio = "pipe") {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio,
  });
}

function runNode(script, args = []) {
  execFileSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    stdio: "inherit",
  });
}

export function statusPaths(cwd) {
  const status = runGit(["status", "--porcelain=v1"], cwd);
  return status
    .split("\n")
    .map((line) => line.replace(/\r+$/, ""))
    // Porcelain v1 lines are `XY <path>`. Trimming the whole output first
    // would eat the leading space of the first line and take the first
    // character of its path with it — turning `CHANGELOG.md` into
    // `HANGELOG.md`, which then looked like an unexpected change.
    .filter((line) => line.length > 3)
    .map((line) => line.slice(3));
}

export function assertCleanTree(cwd) {
  const paths = statusPaths(cwd);
  if (paths.length > 0) {
    throw new Error(
      `pnpm release requires a clean working tree; found ${paths.length} changed path(s)`,
    );
  }
}

/**
 * Which files the release commit is owed.
 *
 * A candidate that was already bumped — `package.json` carries 0.1.1 and no
 * `v0.1.1` tag exists yet — leaves the manifest untouched, because bumpp
 * rewriting 0.1.1 as 0.1.1 is a no-op. Requiring both files to change made
 * that candidate unreleasable and nudged the operator onto the next default
 * choice, which published a version nobody selected. Only the changelog is
 * strictly owed; the manifest is owed only when the version actually moved.
 */
export function expectedReleaseFiles({ preBumped }) {
  return preBumped ? [CHANGELOG_FILE] : [...RELEASE_FILES];
}

export function assertReleaseFilesOnly(cwd, expected = RELEASE_FILES) {
  const paths = statusPaths(cwd);
  const unexpected = paths.filter((file) => !expected.includes(file));
  if (unexpected.length > 0) {
    throw new Error(
      `release generation changed unexpected paths: ${unexpected.join(", ")}`,
    );
  }
  const missing = expected.filter((file) => !paths.includes(file));
  if (missing.length > 0) {
    throw new Error(`release generation did not update: ${missing.join(", ")}`);
  }
}

export function assertStagedFilesOnly(cwd, expected = RELEASE_FILES) {
  const staged = runGit(["diff", "--cached", "--name-only"], cwd)
    .trim()
    .split("\n")
    .filter(Boolean);
  const unexpected = staged.filter((file) => !expected.includes(file));
  const missing = expected.filter((file) => !staged.includes(file));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `release commit must contain exactly ${expected.join(", ")}; staged ${
        staged.join(", ") || "nothing"
      }`,
    );
  }
}

export function readPackageVersion(cwd) {
  const pkg = JSON.parse(fs.readFileSync(path.join(cwd, PACKAGE_FILE), "utf8"));
  if (typeof pkg.version !== "string" || pkg.version.trim() === "") {
    throw new Error(`${PACKAGE_FILE} has no version field`);
  }
  return pkg.version.trim();
}

/**
 * The branch ref that will be pushed. A detached HEAD yields the literal
 * `HEAD`, which is not a branch ref — pushing `refs/heads/HEAD` would create
 * garbage on the remote, so refuse while the tree is still untouched.
 */
export function currentBranch(cwd) {
  const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd).trim();
  if (!branch || branch === "HEAD") {
    throw new Error(
      "release requires a checked-out branch; refusing to release from a detached HEAD",
    );
  }
  return branch;
}

export function assertTagIsNew(cwd, version) {
  const tag = `v${version}`;
  const existing = runGit(["tag", "--list", tag], cwd)
    .trim()
    .split("\n")
    .filter(Boolean);
  if (existing.includes(tag)) {
    throw new Error(
      `tag ${tag} already exists locally. A previous run may have committed and ` +
        `tagged before its push failed; delete the tag (git tag -d ${tag}) and undo ` +
        `the release commit, or pick a different version.`,
    );
  }
}

/**
 * Refuse to cut a version that is already out.
 *
 * `lineage` is the result of the remote check performed before any mutation —
 * re-releasing the newest published tag would move a tag other people already
 * fetched, and a stale local tag usually means a release half-finished after a
 * failed push. Both fail here, before a commit exists to clean up.
 */
export function assertVersionIsUnreleased(cwd, version, lineage) {
  const tag = `v${version}`;
  if (lineage?.latest && tag === lineage.latest.name) {
    throw new Error(
      `${tag} is already published on ${
        lineage.remoteName ?? "the release remote"
      }; bump to a new version instead of re-releasing it`,
    );
  }
  assertTagIsNew(cwd, version);
}

/**
 * Push exactly the release branch and the new tag to the remote that lineage
 * verified.
 *
 * `git push --follow-tags` used whatever remote the branch happened to track —
 * not the one lineage was checked against — and swept in every reachable
 * annotated tag that was missing upstream. Naming the remote, the branch ref
 * and the tag ref keeps a fork workflow from publishing to the wrong remote,
 * and `--atomic` makes the branch and its tag land together or not at all.
 */
export function pushArgs({ remote, branch, version }) {
  return [
    "push",
    "--atomic",
    remote,
    `refs/heads/${branch}`,
    `refs/tags/v${version}`,
  ];
}

async function main() {
  const cwd = root;
  assertCleanTree(cwd);
  const lineage = getPublishedReleaseLineage();
  const versionBefore = readPackageVersion(cwd);
  const branch = currentBranch(cwd);

  const result = await versionBump({
    confirm: true,
    cwd: root,
    files: ["package.json"],
    commit: false,
    tag: false,
    push: false,
    execute: async (operation) => {
      if (!operation.state.newVersion) {
        throw new Error("bumpp did not produce a release version");
      }
      runNode("scripts/generate-changelog.mjs", ["--write"]);
    },
  });

  const version = result.newVersion;
  if (!version) {
    throw new Error("bumpp did not produce a release version");
  }
  assertVersionIsUnreleased(cwd, version, lineage);

  const preBumped = version === versionBefore;
  if (preBumped) {
    console.log(
      `Releasing pre-bumped candidate ${version}: ${PACKAGE_FILE} is already at ` +
        `${version}, so the release commit carries ${CHANGELOG_FILE} only.`,
    );
  }

  const expected = expectedReleaseFiles({ preBumped });
  assertReleaseFilesOnly(cwd, expected);
  runGit(["add", "--", ...expected], cwd, "inherit");
  assertStagedFilesOnly(cwd, expected);

  const commitMessage = `chore(release): v${version}`;
  runGit(
    [
      "commit",
      "--only",
      "--message",
      commitMessage,
      "--",
      ...expected,
    ],
    cwd,
    "inherit",
  );
  runGit(
    ["tag", "--annotate", "--message", commitMessage, `v${version}`],
    cwd,
    "inherit",
  );
  runGit(pushArgs({ remote: lineage.remoteName, branch, version }), cwd, "inherit");
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main().catch((error) => {
    console.error(
      `Release aborted: ${error instanceof Error ? error.message : String(error)}`,
    );
    // bumpp rewrites the manifest and the changelog before the guards above
    // run, so an abort after that point leaves generated files behind. Say so
    // instead of letting the operator discover them at the next clean-tree
    // check.
    const dirty = statusPaths(root);
    if (dirty.length > 0) {
      console.error(
        `The working tree now carries generated files (${dirty.join(", ")}); inspect them before retrying.`,
      );
    }
    process.exitCode = 1;
  });
}
