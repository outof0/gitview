import { describe, expect, it, afterEach } from "vitest";
import { createHistoryApi } from "../git/history";
import { createBranchCompareApi } from "../git/branchCompare";
import { createMergeApi } from "../git/merge";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";
import * as fs from "fs/promises";
import * as path from "path";

describe("Phase 3 history and branch compare integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("cherry-picks multiple commits in order", async () => {
    repo = await createTempGitRepo();
    const history = createHistoryApi(execGit);

    await writeRepoFile(repo.root, "a.txt", "a\n");
    await execGit(repo.root, ["add", "a.txt"]);
    await execGit(repo.root, ["commit", "-m", "Commit A"]);
    const { stdout: shaA } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await execGit(repo.root, ["checkout", "-b", "source"]);
    await writeRepoFile(repo.root, "b.txt", "b\n");
    await execGit(repo.root, ["add", "b.txt"]);
    await execGit(repo.root, ["commit", "-m", "Commit B"]);
    const { stdout: shaB } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await writeRepoFile(repo.root, "c.txt", "c\n");
    await execGit(repo.root, ["add", "c.txt"]);
    await execGit(repo.root, ["commit", "-m", "Commit C"]);
    const { stdout: shaC } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await execGit(repo.root, ["checkout", "main"]);
    await history.cherryPickMultiple(repo.root, [
      shaB.trim(),
      shaC.trim(),
    ]);

    await expect(fs.access(path.join(repo.root, "b.txt"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(repo.root, "c.txt"))).resolves.toBeUndefined();
    void shaA;
  }, 15000);

  it("reverts multiple commits in reverse order", async () => {
    repo = await createTempGitRepo();
    const history = createHistoryApi(execGit);

    await writeRepoFile(repo.root, "one.txt", "1\n");
    await execGit(repo.root, ["add", "one.txt"]);
    await execGit(repo.root, ["commit", "-m", "One"]);
    const { stdout: shaOne } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await writeRepoFile(repo.root, "two.txt", "2\n");
    await execGit(repo.root, ["add", "two.txt"]);
    await execGit(repo.root, ["commit", "-m", "Two"]);
    const { stdout: shaTwo } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await history.revertMultiple(repo.root, [shaOne.trim(), shaTwo.trim()]);

    await expect(fs.access(path.join(repo.root, "two.txt"))).rejects.toThrow();
    await expect(fs.access(path.join(repo.root, "one.txt"))).rejects.toThrow();
  });

  it("applies a file from a compared branch into the working tree", async () => {
    repo = await createTempGitRepo();
    const merge = createMergeApi(execGit);
    const compare = createBranchCompareApi(execGit, merge.isBinaryFile);

    await writeRepoFile(repo.root, "shared.txt", "base\n");
    await execGit(repo.root, ["add", "shared.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);

    await execGit(repo.root, ["checkout", "-b", "feature"]);
    await writeRepoFile(repo.root, "shared.txt", "from feature\n");
    await execGit(repo.root, ["add", "shared.txt"]);
    await execGit(repo.root, ["commit", "-m", "Feature change"]);

    await execGit(repo.root, ["checkout", "main"]);
    await writeRepoFile(repo.root, "shared.txt", "on main\n");
    await execGit(repo.root, ["add", "shared.txt"]);
    await execGit(repo.root, ["commit", "-m", "Main change"]);

    await compare.applyFileFromBranch(repo.root, "feature", "shared.txt", "current");

    const content = await fs.readFile(path.join(repo.root, "shared.txt"), "utf8");
    expect(content).toBe("from feature\n");
  });
});