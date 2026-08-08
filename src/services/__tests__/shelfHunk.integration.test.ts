import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createShelfApi } from "../git/shelf";
import { createShelfStorage } from "../../storage/shelfStorage";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("shelf hunk integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("shelves a single hunk and removes it from the working tree", async () => {
    repo = await createTempGitRepo();
    const shelfStorage = createShelfStorage();
    const shelf = createShelfApi(execGit, shelfStorage);

    await writeRepoFile(repo.root, "hunk.txt", "line1\n");
    await execGit(repo.root, ["add", "hunk.txt"]);
    await execGit(repo.root, ["commit", "-m", "Initial"]);

    await writeRepoFile(repo.root, "hunk.txt", "line1\nline2\nline3\n");
    const entry = await shelf.shelveHunk(repo.root, {
      repoId: "test-repo",
      path: "hunk.txt",
      hunkIndex: 0,
    });

    expect(entry.paths).toEqual(["hunk.txt"]);
    const shelves = await shelf.listShelves(repo.root, "test-repo");
    const stored = shelves.find((row) => row.id === entry.id);
    expect(stored?.name).toContain("hunk");

    const content = await import("fs/promises").then((fs) =>
      fs.readFile(`${repo!.root}/hunk.txt`, "utf8"),
    );
    expect(content).toBe("line1\n");
  });

  it("keeps local work when durable shelf persistence fails", async () => {
    repo = await createTempGitRepo();
    const storage = createShelfStorage({
      resolveStorageDir: async () => {
        throw new Error("simulated storage failure");
      },
    });
    const shelf = createShelfApi(execGit, storage);
    await writeRepoFile(repo.root, "README.md", "# changed but safe\n");

    await expect(
      shelf.shelveFiles(repo.root, {
        repoId: "test-repo",
        paths: ["README.md"],
      }),
    ).rejects.toThrow("simulated storage failure");

    await expect(fs.readFile(path.join(repo.root, "README.md"), "utf8")).resolves.toBe(
      "# changed but safe\n",
    );
  });

  it("stores and restores shelves from a linked worktree", async () => {
    repo = await createTempGitRepo();
    const worktreeRoot = path.join(path.dirname(repo.root), "linked-worktree");
    await execGit(repo.root, ["worktree", "add", "-b", "linked", worktreeRoot]);
    await writeRepoFile(worktreeRoot, "README.md", "# linked change\n");

    const storage = createShelfStorage();
    const shelf = createShelfApi(execGit, storage);
    const entry = await shelf.shelveFiles(worktreeRoot, {
      repoId: "linked-repo",
      paths: ["README.md"],
    });

    await expect(fs.readFile(path.join(worktreeRoot, "README.md"), "utf8")).resolves.toBe(
      "# test\n",
    );
    await expect(shelf.listShelves(worktreeRoot, "linked-repo")).resolves.toEqual([
      expect.objectContaining({ id: entry.id, paths: ["README.md"] }),
    ]);

    await shelf.unshelve(worktreeRoot, entry.id, true);
    await expect(fs.readFile(path.join(worktreeRoot, "README.md"), "utf8")).resolves.toBe(
      "# linked change\n",
    );
  });
});
