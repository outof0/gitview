import { describe, expect, it, afterEach } from "vitest";
import { createRebaseApi } from "../git/rebase";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("rebase integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("drops a middle commit with rebase --onto", async () => {
    repo = await createTempGitRepo();
    const rebase = createRebaseApi(execGit);

    await writeRepoFile(repo.root, "a.txt", "a1\n");
    await execGit(repo.root, ["add", "a.txt"]);
    await execGit(repo.root, ["commit", "-m", "First"]);
    const { stdout: firstSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await writeRepoFile(repo.root, "b.txt", "b1\n");
    await execGit(repo.root, ["add", "b.txt"]);
    await execGit(repo.root, ["commit", "-m", "Drop me"]);
    const { stdout: dropSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await writeRepoFile(repo.root, "c.txt", "c1\n");
    await execGit(repo.root, ["add", "c.txt"]);
    await execGit(repo.root, ["commit", "-m", "Third"]);

    await rebase.dropCommit(repo.root, dropSha.trim());

    const { stdout: log } = await execGit(repo.root, ["log", "--oneline"]);
    expect(log).toContain("First");
    expect(log).toContain("Third");
    expect(log).not.toContain("Drop me");

    const fs = await import("fs/promises");
    await expect(fs.access(`${repo.root}/b.txt`)).rejects.toThrow();
    await expect(fs.readFile(`${repo.root}/a.txt`, "utf8")).resolves.toBe("a1\n");
    void firstSha;
  });

  it("amends message for HEAD commit", async () => {
    repo = await createTempGitRepo();
    const rebase = createRebaseApi(execGit);

    await writeRepoFile(repo.root, "head.txt", "x\n");
    await execGit(repo.root, ["add", "head.txt"]);
    await execGit(repo.root, ["commit", "-m", "Original"]);
    const { stdout: headSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await rebase.editMessage(
      repo.root,
      headSha.trim(),
      "Reworded HEAD",
      headSha.trim(),
    );

    const { stdout: subject } = await execGit(repo.root, [
      "log",
      "-1",
      "--format=%s",
    ]);
    expect(subject.trim()).toBe("Reworded HEAD");
  });
});