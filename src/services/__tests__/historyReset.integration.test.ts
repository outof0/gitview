import { describe, expect, it, afterEach } from "vitest";
import { createHistoryApi } from "../git/history";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("history reset integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("soft-resets to an earlier commit", async () => {
    repo = await createTempGitRepo();
    const history = createHistoryApi(execGit);

    await writeRepoFile(repo.root, "one.txt", "one\n");
    await execGit(repo.root, ["add", "one.txt"]);
    await execGit(repo.root, ["commit", "-m", "First"]);
    const { stdout: firstSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await writeRepoFile(repo.root, "two.txt", "two\n");
    await execGit(repo.root, ["add", "two.txt"]);
    await execGit(repo.root, ["commit", "-m", "Second"]);

    await history.resetTo(repo.root, firstSha.trim(), "soft");

    const { stdout: head } = await execGit(repo.root, ["rev-parse", "HEAD"]);
    expect(head.trim()).toBe(firstSha.trim());
    const { stdout: status } = await execGit(repo.root, ["status", "--porcelain"]);
    expect(status).toContain("two.txt");
  });

  it("undoes the last commit keeping changes unstaged", async () => {
    repo = await createTempGitRepo();
    const history = createHistoryApi(execGit);

    await writeRepoFile(repo.root, "undo.txt", "undo\n");
    await execGit(repo.root, ["add", "undo.txt"]);
    await execGit(repo.root, ["commit", "-m", "To undo"]);
    const { stdout: before } = await execGit(repo.root, ["rev-parse", "HEAD~1"]);

    await history.undoLastCommit(repo.root);

    const { stdout: head } = await execGit(repo.root, ["rev-parse", "HEAD"]);
    expect(head.trim()).toBe(before.trim());
    const { stdout: status } = await execGit(repo.root, ["status", "--porcelain"]);
    expect(status).toContain("undo.txt");
  });
});