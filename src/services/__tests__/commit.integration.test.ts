import { describe, expect, it, afterEach } from "vitest";
import { createCommitApi } from "../git/commit";
import { createStagingApi } from "../git/staging";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";
import { checkDestructiveAction } from "../protectionService";

describe("commit integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("commits only selected paths and leaves other staged edits pending", async () => {
    repo = await createTempGitRepo();
    const commit = createCommitApi(execGit);
    const staging = createStagingApi(execGit);

    await writeRepoFile(repo.root, "README.md", "# updated readme\n");
    await writeRepoFile(repo.root, "other.ts", "other\n");
    await staging.stageFiles(repo.root, ["other.ts"]);

    await commit.commit(repo.root, {
      message: "Partial commit",
      paths: ["README.md"],
    });

    const { stdout } = await execGit(repo.root, ["status", "--porcelain"]);
    expect(stdout).toContain("other.ts");
    expect(stdout).not.toMatch(/^commit /);
  });

  it("rejects empty commit messages", async () => {
    repo = await createTempGitRepo();
    const commit = createCommitApi(execGit);
    await expect(
      commit.commit(repo.root, { message: "   " }),
    ).rejects.toThrow(/empty/i);
  });

  it("blocks amend on protected branches via protection guard", () => {
    const blocked = checkDestructiveAction("main", ["main"], "history_rewrite");
    expect(blocked.allowed).toBe(false);
  });
});