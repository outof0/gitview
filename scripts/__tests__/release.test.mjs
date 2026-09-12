/**
 * Release guards, exercised against real throwaway repositories.
 *
 * These use a real Git rather than mocks because every guard here exists to
 * catch a Git-state mistake: a file that was not written, a tag that already
 * exists, a branch that is not a branch. Mocking `execFileSync` would only
 * prove the mocks agree with each other.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertCleanTree,
  assertReleaseFilesOnly,
  assertStagedFilesOnly,
  assertTagIsNew,
  assertVersionIsUnreleased,
  currentBranch,
  expectedReleaseFiles,
  pushArgs,
  readPackageVersion,
  statusPaths,
} from "../release.mjs";
import {
  newestTag,
  parseRemoteTags,
  parseTagName,
} from "../release-lineage.mjs";

const repos = [];

async function initRepo({ version = "0.1.1" } = {}) {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-release-"));
  const cwd = path.join(parent, "repo");
  await fs.mkdir(cwd, { recursive: true });
  repos.push(parent);

  const run = (args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" });

  await run(["init", "-b", "main"]);
  await run(["config", "user.name", "Release Test"]);
  await run(["config", "user.email", "release@example.com"]);
  await run(["config", "commit.gpgsign", "false"]);
  await run(["config", "tag.gpgsign", "false"]);

  await fs.writeFile(
    path.join(cwd, "package.json"),
    `${JSON.stringify({ name: "release-fixture", version }, null, 2)}\n`,
  );
  await fs.writeFile(path.join(cwd, "CHANGELOG.md"), "# Changelog\n");
  await run(["add", "package.json", "CHANGELOG.md"]);
  await run(["commit", "-m", "Initial commit"]);

  return { cwd, run };
}

afterEach(async () => {
  while (repos.length > 0) {
    const parent = repos.pop();
    await fs.rm(parent, { recursive: true, force: true, maxRetries: 5 });
  }
});

describe("statusPaths", () => {
  it("keeps the first path intact when it is the only change", async () => {
    const { cwd } = await initRepo();
    await fs.writeFile(path.join(cwd, "CHANGELOG.md"), "# Changelog\n\n## v0.1.1\n");

    // Regression: trimming the whole porcelain output ate the leading space of
    // the first line, so slicing off the 3-char status prefix also cut the
    // first character of the path — `CHANGELOG.md` came back as `HANGELOG.md`
    // and was reported as an unexpected change.
    expect(statusPaths(cwd)).toEqual(["CHANGELOG.md"]);
  });

  it("reports every changed path, not just the first", async () => {
    const { cwd } = await initRepo();
    await fs.writeFile(path.join(cwd, "CHANGELOG.md"), "# Changelog\n\n## v0.1.2\n");
    await fs.writeFile(
      path.join(cwd, "package.json"),
      `${JSON.stringify({ name: "release-fixture", version: "0.1.2" }, null, 2)}\n`,
    );

    expect(statusPaths(cwd).sort()).toEqual(["CHANGELOG.md", "package.json"]);
  });
});

describe("release tag selection", () => {
  it("ignores v-prefixed tags that are not semantic versions", () => {
    const tags = parseRemoteTags(
      [
        `${"a".repeat(40)}\trefs/tags/v1.4.0`,
        `${"b".repeat(40)}\trefs/tags/vnext`,
        `${"c".repeat(40)}\trefs/tags/vscode-extension`,
      ].join("\n"),
    );

    expect(tags.map((tag) => tag.name)).toEqual(["v1.4.0"]);
    expect(newestTag(tags)?.name).toBe("v1.4.0");
  });

  it("orders stable releases after prereleases", () => {
    const tags = [
      { name: "v2.0.0-rc.2" },
      { name: "v1.9.9" },
      { name: "v2.0.0" },
      { name: "v2.0.0-rc.10" },
    ];
    expect(newestTag(tags)?.name).toBe("v2.0.0");
  });

  it("rejects malformed semantic versions", () => {
    expect(parseTagName("vnext")).toBeNull();
    expect(parseTagName("release-v1.0.0")).toBeNull();
    expect(parseTagName("v01.0.0")).toBeNull();
    expect(parseTagName("v1.0.0-alpha..1")).toBeNull();
    expect(parseTagName("v1.0.0-alpha.01")).toBeNull();
    expect(parseTagName("v1.0.0+build..1")).toBeNull();
    expect(parseTagName("v1.0.0-alpha.1+build.5")).not.toBeNull();
  });
});

describe("expectedReleaseFiles", () => {
  it("owes both files when the version moved", () => {
    expect(expectedReleaseFiles({ preBumped: false })).toEqual([
      "CHANGELOG.md",
      "package.json",
    ]);
  });

  it("owes only the changelog for a pre-bumped candidate", () => {
    expect(expectedReleaseFiles({ preBumped: true })).toEqual(["CHANGELOG.md"]);
  });
});

describe("assertReleaseFilesOnly", () => {
  it("accepts a pre-bumped candidate whose only change is the changelog", async () => {
    const { cwd } = await initRepo({ version: "0.1.1" });
    await fs.writeFile(
      path.join(cwd, "CHANGELOG.md"),
      "# Changelog\n\n## v0.1.1\n",
    );

    expect(statusPaths(cwd)).toEqual(["CHANGELOG.md"]);
    expect(() => assertReleaseFilesOnly(cwd, ["CHANGELOG.md"])).not.toThrow();
  });

  it("rejects a pre-bumped candidate that also rewrote the manifest", async () => {
    const { cwd } = await initRepo({ version: "0.1.1" });
    await fs.writeFile(path.join(cwd, "CHANGELOG.md"), "# Changelog\n\n## v0.1.1\n");
    await fs.writeFile(
      path.join(cwd, "package.json"),
      `${JSON.stringify({ name: "release-fixture", version: "0.1.2" }, null, 2)}\n`,
    );

    expect(() => assertReleaseFilesOnly(cwd, ["CHANGELOG.md"])).toThrow(
      /changed unexpected paths: package\.json/,
    );
  });

  it("rejects a run that never rewrote the changelog", async () => {
    const { cwd } = await initRepo();
    expect(() => assertReleaseFilesOnly(cwd, ["CHANGELOG.md"])).toThrow(
      /did not update: CHANGELOG\.md/,
    );
  });

  it("still requires the manifest when the version actually moved", async () => {
    const { cwd } = await initRepo({ version: "0.1.0" });
    await fs.writeFile(path.join(cwd, "CHANGELOG.md"), "# Changelog\n\n## v0.1.1\n");

    expect(() =>
      assertReleaseFilesOnly(cwd, expectedReleaseFiles({ preBumped: false })),
    ).toThrow(/did not update: package\.json/);
  });
});

describe("assertStagedFilesOnly", () => {
  it("accepts exactly the owed files staged for commit", async () => {
    const { cwd, run } = await initRepo();
    await fs.writeFile(path.join(cwd, "CHANGELOG.md"), "# Changelog\n\n## v0.1.2\n");
    await fs.writeFile(
      path.join(cwd, "package.json"),
      `${JSON.stringify({ name: "release-fixture", version: "0.1.2" }, null, 2)}\n`,
    );
    await run(["add", "--", "CHANGELOG.md", "package.json"]);

    expect(() =>
      assertStagedFilesOnly(cwd, expectedReleaseFiles({ preBumped: false })),
    ).not.toThrow();
  });

  it("rejects a staged file that is not part of the release", async () => {
    const { cwd, run } = await initRepo();
    await fs.writeFile(path.join(cwd, "CHANGELOG.md"), "# Changelog\n\n## v0.1.1\n");
    await fs.writeFile(path.join(cwd, "src.ts"), "export const leaked = 1;\n");
    await run(["add", "--", "CHANGELOG.md", "src.ts"]);

    expect(() => assertStagedFilesOnly(cwd, ["CHANGELOG.md"])).toThrow(
      /must contain exactly CHANGELOG\.md; staged CHANGELOG\.md, src\.ts/,
    );
  });
});

describe("readPackageVersion", () => {
  it("reads the version the bump started from", async () => {
    const { cwd } = await initRepo({ version: "0.1.1" });
    expect(readPackageVersion(cwd)).toBe("0.1.1");
  });
});

describe("assertCleanTree", () => {
  it("passes on a clean repository", async () => {
    const { cwd } = await initRepo();
    expect(() => assertCleanTree(cwd)).not.toThrow();
  });

  it("reports the number of dirty paths", async () => {
    const { cwd } = await initRepo();
    await fs.writeFile(path.join(cwd, "CHANGELOG.md"), "# Changelog\n\n## v0.1.1\n");
    expect(() => assertCleanTree(cwd)).toThrow(/found 1 changed path/);
  });
});

describe("currentBranch", () => {
  it("returns the checked-out branch", async () => {
    const { cwd } = await initRepo();
    expect(currentBranch(cwd)).toBe("main");
  });

  it("refuses a detached HEAD instead of pushing refs/heads/HEAD", async () => {
    const { cwd, run } = await initRepo();
    const head = (await run(["rev-parse", "HEAD"])).trim();
    await run(["checkout", "--detach", head]);

    expect(() => currentBranch(cwd)).toThrow(/detached HEAD/);
  });
});

describe("assertTagIsNew", () => {
  it("accepts a version that has never been tagged", async () => {
    const { cwd } = await initRepo();
    expect(() => assertTagIsNew(cwd, "0.1.1")).not.toThrow();
  });

  it("refuses a version whose tag already exists", async () => {
    const { cwd, run } = await initRepo();
    await run(["tag", "--annotate", "--message", "chore(release): v0.1.1", "v0.1.1"]);

    expect(() => assertTagIsNew(cwd, "0.1.1")).toThrow(
      /tag v0\.1\.1 already exists locally/,
    );
  });
});

describe("assertVersionIsUnreleased", () => {
  it("refuses to re-release the newest published tag", async () => {
    const { cwd } = await initRepo();
    const lineage = { remoteName: "origin", latest: { name: "v0.1.1" } };

    expect(() => assertVersionIsUnreleased(cwd, "0.1.1", lineage)).toThrow(
      /v0\.1\.1 is already published on origin/,
    );
  });

  it("accepts a version that is newer than the published one", async () => {
    const { cwd } = await initRepo();
    const lineage = { remoteName: "origin", latest: { name: "v0.1.0" } };

    expect(() => assertVersionIsUnreleased(cwd, "0.1.1", lineage)).not.toThrow();
  });

  it("works before any release exists", async () => {
    const { cwd } = await initRepo();
    expect(() => assertVersionIsUnreleased(cwd, "0.1.1", { remoteName: "origin", latest: null })).not.toThrow();
  });
});

describe("pushArgs", () => {
  it("names the verified remote, the branch ref and the new tag", () => {
    expect(pushArgs({ remote: "origin", branch: "main", version: "0.1.1" })).toEqual([
      "push",
      "--atomic",
      "origin",
      "refs/heads/main",
      "refs/tags/v0.1.1",
    ]);
  });

  it("never sweeps in unrelated tags with --follow-tags", () => {
    const args = pushArgs({ remote: "upstream", branch: "release", version: "1.2.3" });
    expect(args).not.toContain("--follow-tags");
    expect(args.filter((arg) => arg.startsWith("refs/"))).toEqual([
      "refs/heads/release",
      "refs/tags/v1.2.3",
    ]);
  });
});

describe("pushArgs against a real remote", () => {
  it("publishes the branch and only the new tag", async () => {
    const { cwd, run } = await initRepo({ version: "0.1.1" });

    // A bare repository standing in for the release remote. The bare repo lives
    // next to the working clone, inside the temp dir already queued for cleanup.
    const remoteDir = path.join(path.dirname(cwd), "remote.git");
    execFileSync("git", ["init", "--bare", "-b", "main", remoteDir], {
      encoding: "utf8",
      stdio: "pipe",
    });
    await run(["remote", "add", "origin", remoteDir]);
    await run(["remote", "add", "fork", remoteDir]);

    // An annotated tag that upstream does not have: `--follow-tags` would have
    // swept this one in along with the release.
    await run(["tag", "--annotate", "--message", "chore(release): v0.1.0", "v0.1.0"]);

    await fs.writeFile(path.join(cwd, "CHANGELOG.md"), "# Changelog\n\n## v0.1.1\n");
    await run(["add", "--", "CHANGELOG.md"]);
    await run([
      "commit",
      "--only",
      "--message",
      "chore(release): v0.1.1",
      "--",
      "CHANGELOG.md",
    ]);
    await run(["tag", "--annotate", "--message", "chore(release): v0.1.1", "v0.1.1"]);

    // Named remote, not the branch's configured default.
    run(pushArgs({ remote: "fork", branch: "main", version: "0.1.1" }));

    const remoteTags = execFileSync("git", ["ls-remote", "--tags", remoteDir], {
      encoding: "utf8",
    });
    expect(remoteTags).toContain("refs/tags/v0.1.1");
    expect(remoteTags).not.toContain("refs/tags/v0.1.0");

    const remoteHeads = execFileSync("git", ["ls-remote", "--heads", remoteDir], {
      encoding: "utf8",
    });
    expect(remoteHeads).toContain("refs/heads/main");
  });
});

describe("pre-bumped candidate end to end", () => {
  it("commits and tags a candidate whose manifest is already at the version", async () => {
    const { cwd, run } = await initRepo({ version: "0.1.1" });
    assertCleanTree(cwd);

    // What `pnpm release` does after bumpp answers "as-is": the changelog is
    // rewritten, the manifest is byte-identical, and both guards must accept it.
    await fs.writeFile(path.join(cwd, "CHANGELOG.md"), "# Changelog\n\n## v0.1.1\n");
    const preBumped = readPackageVersion(cwd) === "0.1.1";
    expect(preBumped).toBe(true);

    const expected = expectedReleaseFiles({ preBumped });
    assertReleaseFilesOnly(cwd, expected);
    await run(["add", "--", ...expected]);
    assertStagedFilesOnly(cwd, expected);

    await run(["commit", "--only", "--message", "chore(release): v0.1.1", "--", ...expected]);
    await run(["tag", "--annotate", "--message", "chore(release): v0.1.1", "v0.1.1"]);

    assertCleanTree(cwd);
    expect((await run(["tag", "--list", "v0.1.1"])).trim()).toBe("v0.1.1");

    const released = (await run(["show", "--name-only", "--format=%s", "HEAD"]))
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    expect(released).toEqual(["chore(release): v0.1.1", "CHANGELOG.md"]);
    // The manifest was never part of the release commit.
    expect(readPackageVersion(cwd)).toBe("0.1.1");
  });
});
