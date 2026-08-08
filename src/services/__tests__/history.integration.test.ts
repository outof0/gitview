import { describe, expect, it, afterEach } from "vitest";
import { createHistoryApi } from "../git/history";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("history integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("cherry-picks a commit onto the current branch", async () => {
    repo = await createTempGitRepo();
    const history = createHistoryApi(execGit);

    await execGit(repo.root, ["checkout", "-b", "side"]);
    await writeRepoFile(repo.root, "feature.txt", "feature\n");
    await execGit(repo.root, ["add", "feature.txt"]);
    await execGit(repo.root, ["commit", "-m", "Add feature"]);
    const { stdout: featureSha } = await execGit(repo.root, [
      "rev-parse",
      "HEAD",
    ]);

    await execGit(repo.root, ["checkout", "main"]);
    await writeRepoFile(repo.root, "main-only.txt", "main\n");
    await execGit(repo.root, ["add", "main-only.txt"]);
    await execGit(repo.root, ["commit", "-m", "Main-only change"]);

    await history.cherryPick(repo.root, featureSha.trim());

    const { stdout: log } = await execGit(repo.root, ["log", "--oneline"]);
    expect(log).toContain("Add feature");
    const content = await import("fs/promises").then((fs) =>
      fs.readFile(`${repo!.root}/feature.txt`, "utf8"),
    );
    expect(content).toBe("feature\n");
  });

  it("reverts a commit with a new revert commit", async () => {
    repo = await createTempGitRepo();
    const history = createHistoryApi(execGit);

    await writeRepoFile(repo.root, "revert-me.txt", "original\n");
    await execGit(repo.root, ["add", "revert-me.txt"]);
    await execGit(repo.root, ["commit", "-m", "Add revert target"]);
    const { stdout: targetSha } = await execGit(repo.root, [
      "rev-parse",
      "HEAD",
    ]);

    await history.revertCommit(repo.root, targetSha.trim());

    const { stdout: log } = await execGit(repo.root, ["log", "--oneline"]);
    expect(log.toLowerCase()).toContain("revert");
    await expect(
      import("fs/promises").then((fs) =>
        fs.access(`${repo!.root}/revert-me.txt`),
      ),
    ).rejects.toThrow();
  });
});