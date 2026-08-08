import { describe, expect, it, afterEach } from "vitest";
import { createHunkPatchApi } from "../git/hunkPatch";
import { createStatusApi } from "../git/status";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("hunkPatch integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("stages a single hunk while leaving other edits unstaged", async () => {
    repo = await createTempGitRepo();
    const hunkPatch = createHunkPatchApi(execGit);
    const statusApi = createStatusApi(execGit);

    const baseLines = ["# title", ...Array.from({ length: 40 }, (_, i) => `row ${i}`)];
    await writeRepoFile(repo.root, "README.md", `${baseLines.join("\n")}\n`);
    await execGit(repo.root, ["add", "README.md"]);
    await execGit(repo.root, ["commit", "-m", "Expand readme"]);

    const edited = [...baseLines];
    edited[1] = "row 1 changed";
    edited[35] = "row 35 changed";
    await writeRepoFile(repo.root, "README.md", `${edited.join("\n")}\n`);

    await hunkPatch.stageHunk(repo.root, "README.md", 0);

    const status = await statusApi.getStatus(repo.root, "repo-1");
    const file = status.files.find((f) => f.path === "README.md");
    expect(file?.staged).toBe(true);

    const { stdout } = await execGit(repo.root, [
      "diff",
      "--cached",
      "HEAD",
      "--",
      "README.md",
    ]);
    expect(stdout).toContain("row 1 changed");
    expect(stdout).not.toContain("row 35 changed");
  });
});