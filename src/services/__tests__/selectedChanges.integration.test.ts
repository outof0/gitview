import { describe, expect, it, afterEach } from "vitest";
import { createMergeApi } from "../git/merge";
import { createSelectedChangesApi } from "../git/selectedChanges";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("selectedChanges integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("cherry-picks a selected hunk from a commit into the working tree", async () => {
    repo = await createTempGitRepo();
    const merge = createMergeApi(execGit);
    const selected = createSelectedChangesApi(execGit, merge.isBinaryFile);

    await writeRepoFile(repo.root, "pick.txt", "base\n");
    await execGit(repo.root, ["add", "pick.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);

    await writeRepoFile(repo.root, "pick.txt", "base\npicked\n");
    await execGit(repo.root, ["add", "pick.txt"]);
    await execGit(repo.root, ["commit", "-m", "Add picked line"]);
    const { stdout: sha } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await writeRepoFile(repo.root, "pick.txt", "base\n");
    await execGit(repo.root, ["add", "pick.txt"]);
    await execGit(repo.root, ["commit", "-m", "Reset file to base"]);

    await selected.cherryPickSelected(repo.root, sha.trim(), "pick.txt", {
      hunkIndexes: [0],
    });

    const content = await import("fs/promises").then((fs) =>
      fs.readFile(`${repo!.root}/pick.txt`, "utf8"),
    );
    expect(content).toBe("base\npicked\n");
  });

  it("drops selected hunks from HEAD via amend", async () => {
    repo = await createTempGitRepo();
    const merge = createMergeApi(execGit);
    const selected = createSelectedChangesApi(execGit, merge.isBinaryFile);

    await writeRepoFile(repo.root, "pick.txt", "base\n");
    await execGit(repo.root, ["add", "pick.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);

    await writeRepoFile(repo.root, "pick.txt", "base\npicked\n");
    await execGit(repo.root, ["add", "pick.txt"]);
    await execGit(repo.root, ["commit", "-m", "Add picked line"]);
    const { stdout: headSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await selected.dropSelectedFromHead(
      repo.root,
      headSha.trim(),
      "pick.txt",
      { hunkIndexes: [0] },
      headSha.trim(),
    );

    const content = await import("fs/promises").then((fs) =>
      fs.readFile(`${repo!.root}/pick.txt`, "utf8"),
    );
    expect(content).toBe("base\n");
    const { stdout: log } = await execGit(repo.root, ["log", "--oneline"]);
    expect(log).toContain("Add picked line");
  });
});