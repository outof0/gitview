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

  it("runs a cherry-pick batch as one sequencer so abort restores pre-batch HEAD", async () => {
    repo = await createTempGitRepo();
    const history = createHistoryApi(execGit);
    const fs = await import("fs/promises");

    await writeRepoFile(repo.root, "file.txt", "line1\n");
    await execGit(repo.root, ["add", "file.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);
    await execGit(repo.root, ["checkout", "-b", "side"]);
    await writeRepoFile(repo.root, "picked.txt", "picked\n");
    await execGit(repo.root, ["add", "picked.txt"]);
    await execGit(repo.root, ["commit", "-m", "Side clean pick"]);
    const { stdout: cleanSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);
    await writeRepoFile(repo.root, "file.txt", "side\n");
    await execGit(repo.root, ["add", "file.txt"]);
    await execGit(repo.root, ["commit", "-m", "Side conflicting pick"]);
    const { stdout: conflictSha } = await execGit(repo.root, [
      "rev-parse",
      "HEAD",
    ]);

    await execGit(repo.root, ["checkout", "main"]);
    await writeRepoFile(repo.root, "file.txt", "main\n");
    await execGit(repo.root, ["add", "file.txt"]);
    await execGit(repo.root, ["commit", "-m", "Main conflicting change"]);
    const { stdout: preBatchHead } = await execGit(repo.root, [
      "rev-parse",
      "HEAD",
    ]);

    await expect(
      history.cherryPickMultiple(repo.root, [
        cleanSha.trim(),
        conflictSha.trim(),
      ]),
    ).rejects.toThrow();
    // The second pick conflicted inside the same sequencer: abort must unwind
    // the clean first pick as well, back to the pre-batch HEAD.
    await history.cherryPickAbort(repo.root);
    const { stdout: postAbortHead } = await execGit(repo.root, [
      "rev-parse",
      "HEAD",
    ]);
    expect(postAbortHead.trim()).toBe(preBatchHead.trim());
    await expect(fs.access(`${repo.root}/picked.txt`)).rejects.toThrow();
    expect(await fs.readFile(`${repo.root}/file.txt`, "utf8")).toBe("main\n");
  });

  it("runs a revert batch as one sequencer so abort restores pre-batch HEAD", async () => {
    repo = await createTempGitRepo();
    const history = createHistoryApi(execGit);
    const fs = await import("fs/promises");

    await writeRepoFile(repo.root, "file.txt", "base\n");
    await execGit(repo.root, ["add", "file.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);
    await execGit(repo.root, ["checkout", "-b", "side"]);
    await writeRepoFile(repo.root, "file.txt", "side\n");
    await execGit(repo.root, ["add", "file.txt"]);
    await execGit(repo.root, ["commit", "-m", "Side change"]);
    const { stdout: sideSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);
    await execGit(repo.root, ["checkout", "main"]);
    await writeRepoFile(repo.root, "file.txt", "one\n");
    await execGit(repo.root, ["add", "file.txt"]);
    await execGit(repo.root, ["commit", "-m", "Main change"]);
    const { stdout: mainSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);
    const { stdout: preBatchHead } = await execGit(repo.root, [
      "rev-parse",
      "HEAD",
    ]);

    // Newest-first input: the batch reverts the main change cleanly, then the
    // side revert conflicts inside the same sequencer. Aborting must unwind
    // the clean first revert as well — per-SHA commands would leave it behind.
    await expect(
      history.revertMultiple(repo.root, [sideSha.trim(), mainSha.trim()]),
    ).rejects.toThrow();
    await history.revertAbort(repo.root);
    const { stdout: postAbortHead } = await execGit(repo.root, [
      "rev-parse",
      "HEAD",
    ]);
    expect(postAbortHead.trim()).toBe(preBatchHead.trim());
    const { stdout: log } = await execGit(repo.root, ["log", "--oneline"]);
    expect(log.toLowerCase()).not.toContain("revert");
    expect(await fs.readFile(`${repo.root}/file.txt`, "utf8")).toBe("one\n");
  });
});