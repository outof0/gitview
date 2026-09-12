import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createBranchCompareApi } from "../git/branchCompare";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("branch apply file type and mode", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  async function setupBranches(): Promise<void> {
    repo = await createTempGitRepo();
    await writeRepoFile(repo.root, "target.txt", "target\n");
    await fs.symlink(
      path.join(repo.root, "target.txt"),
      path.join(repo.root, "oldlink"),
    );
    await execGit(repo.root, ["add", "target.txt", "oldlink"]);
    await execGit(repo.root, ["commit", "-m", "Base with symlink"]);

    await execGit(repo.root, ["checkout", "-b", "side"]);
    await writeRepoFile(repo.root, "run.sh", "#!/bin/sh\necho hi\n");
    await fs.chmod(path.join(repo.root, "run.sh"), 0o755);
    await fs.symlink(
      path.join(repo.root, "target.txt"),
      path.join(repo.root, "link.txt"),
    );
    await execGit(repo.root, ["add", "run.sh", "link.txt"]);
    await execGit(repo.root, ["commit", "-m", "Side adds executable and symlink"]);
    await execGit(repo.root, ["rm", "oldlink"]);
    await execGit(repo.root, ["commit", "-m", "Side deletes symlink"]);
    await execGit(repo.root, ["checkout", "main"]);
  }

  function api() {
    return createBranchCompareApi(execGit, async () => false);
  }

  it("preserves the executable bit when applying a 100755 file", async () => {
    await setupBranches();
    await api().applyFileFromBranch(repo!.root, "side", "run.sh", "workingTree");

    const stat = await fs.stat(path.join(repo!.root, "run.sh"));
    expect(stat.mode & 0o777).toBe(
      process.platform === "win32" ? 0o666 : 0o755,
    );
    expect(await fs.readFile(path.join(repo!.root, "run.sh"), "utf8")).toBe(
      "#!/bin/sh\necho hi\n",
    );
  });

  it("materializes a 120000 entry as a symlink, not a text file", async () => {
    await setupBranches();
    await api().applyFileFromBranch(repo!.root, "side", "link.txt", "workingTree");

    const linkPath = path.join(repo!.root, "link.txt");
    expect((await fs.lstat(linkPath)).isSymbolicLink()).toBe(true);
    expect(await fs.readlink(linkPath)).toBe(path.join(repo!.root, "target.txt"));
  });

  it("deletes a tracked symlink when the branch removed it", async () => {
    await setupBranches();
    const linkPath = path.join(repo!.root, "oldlink");
    expect((await fs.lstat(linkPath)).isSymbolicLink()).toBe(true);

    await api().applyFileFromBranch(repo!.root, "side", "oldlink", "workingTree");

    await expect(fs.lstat(linkPath)).rejects.toThrow();
    // The link target is untouched by the deletion.
    expect(await fs.readFile(path.join(repo!.root, "target.txt"), "utf8")).toBe(
      "target\n",
    );
  });

  it("refuses a submodule entry instead of materializing it", async () => {
    await setupBranches();
    // Point a gitlink at the side branch HEAD to simulate a submodule entry.
    const { stdout: sideSha } = await execGit(repo!.root, ["rev-parse", "side"]);
    await execGit(repo!.root, [
      "update-index",
      "--add",
      "--cacheinfo",
      "160000",
      sideSha.trim(),
      "nested",
    ]);
    await execGit(repo!.root, ["commit", "-m", "Add gitlink"]);
    await execGit(repo!.root, ["checkout", "-b", "withlink"]);
    await execGit(repo!.root, ["checkout", "main"]);

    await expect(
      api().applyFileFromBranch(repo!.root, "withlink", "nested", "workingTree"),
    ).rejects.toThrow(/submodule/i);
  });
});
