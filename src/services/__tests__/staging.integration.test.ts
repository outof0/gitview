import { describe, expect, it, afterEach } from "vitest";
import { createStagingApi } from "../git/staging";
import { createStatusApi } from "../git/status";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("staging integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("stages and unstages a modified tracked file", async () => {
    repo = await createTempGitRepo();
    const staging = createStagingApi(execGit);
    const status = createStatusApi(execGit);

    await writeRepoFile(repo.root, "README.md", "# updated\n");
    await staging.stageFiles(repo.root, ["README.md"]);

    let snapshot = await status.getStatus(repo.root, "r1");
    const staged = snapshot.files.find((f) => f.path === "README.md");
    expect(staged?.staged).toBe(true);

    await staging.unstageFiles(repo.root, ["README.md"]);
    snapshot = await status.getStatus(repo.root, "r1");
    const unstaged = snapshot.files.find((f) => f.path === "README.md");
    expect(unstaged?.staged).toBe(false);
    expect(unstaged?.kind).toBe("modified");
  });

  it("lists the exact staged paths", async () => {
    repo = await createTempGitRepo();
    const staging = createStagingApi(execGit);

    await writeRepoFile(repo.root, "staged.ts", "staged\n");
    await writeRepoFile(repo.root, "working.ts", "working\n");
    await staging.stageFiles(repo.root, ["staged.ts"]);

    expect(await staging.listStagedPaths(repo.root)).toEqual(["staged.ts"]);
  });

  it("rolls back staged added files while keeping unrelated files", async () => {
    repo = await createTempGitRepo();
    const staging = createStagingApi(execGit);

    await writeRepoFile(repo.root, "a.ts", "a1\n");
    await writeRepoFile(repo.root, "b.ts", "b1\n");
    await staging.stageFiles(repo.root, ["a.ts", "b.ts"]);

    await writeRepoFile(repo.root, "a.ts", "a-local\n");
    await staging.rollbackTrackedFiles(repo.root, ["a.ts"]);

    await expect(
      import("fs/promises").then((fs) =>
        fs.readFile(`${repo!.root}/a.ts`, "utf8"),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rolls back staged-only edits and clears the index entry", async () => {
    repo = await createTempGitRepo();
    const staging = createStagingApi(execGit);
    const status = createStatusApi(execGit);

    const original = await import("fs/promises").then((fs) =>
      fs.readFile(`${repo!.root}/README.md`, "utf8"),
    );
    await writeRepoFile(repo.root, "README.md", "staged-only\n");
    await staging.stageFiles(repo.root, ["README.md"]);
    await staging.rollbackTrackedFiles(repo.root, ["README.md"]);

    const snapshot = await status.getStatus(repo.root, "r1");
    expect(snapshot.files).toEqual([]);
    await expect(
      import("fs/promises").then((fs) =>
        fs.readFile(`${repo!.root}/README.md`, "utf8"),
      ),
    ).resolves.toBe(original);
  });
});
