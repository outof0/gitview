import { afterEach, describe, expect, it } from "vitest";
import {
  createTempGitRepo,
  execGit,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";
import { createStatusApi } from "../git/status";

describe("git status porcelain integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("parses Git's real NUL-delimited rename record", async () => {
    repo = await createTempGitRepo();
    await execGit(repo.root, ["mv", "README.md", "RENAMED.md"]);

    const status = await createStatusApi(execGit).getStatus(repo.root, "repo");
    expect(status.files).toEqual([
      expect.objectContaining({
        path: "RENAMED.md",
        oldPath: "README.md",
        kind: "renamed",
      }),
    ]);
  });
});
