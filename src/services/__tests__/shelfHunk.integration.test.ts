import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createShelfApi } from "../git/shelf";
import type { GitExecFn } from "../git/types";
import { createShelfStorage } from "../../storage/shelfStorage";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

/** Real git with injected command failures, matched against the argv string. */
function withGitFailures(failPatterns: RegExp[]): GitExecFn {
  return (repoRoot, args, opts) => {
    if (failPatterns.some((pattern) => pattern.test(args.join(" ")))) {
      return Promise.reject(new Error(`injected failure: ${args.join(" ")}`));
    }
    return execGit(repoRoot, args, opts);
  };
}

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

  it("keeps local work when durable shelf persistence is unavailable", async () => {
    repo = await createTempGitRepo();
    const storage = createShelfStorage({
      resolveStorageDir: async () => {
        throw new Error("simulated storage failure");
      },
    });
    const shelf = createShelfApi(execGit, storage);
    await writeRepoFile(repo.root, "README.md", "# changed but safe\n");

    // Without a durable recovery copy the shelve aborts before touching the
    // working tree: cleanup must never run when the patch cannot be saved.
    await expect(
      shelf.shelveFiles(repo.root, {
        repoId: "test-repo",
        paths: ["README.md"],
      }),
    ).rejects.toThrow("Could not persist a recovery copy of the patch");

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

  it("shelves tracked and untracked files together", async () => {
    repo = await createTempGitRepo();
    const shelf = createShelfApi(execGit, createShelfStorage());
    await writeRepoFile(repo.root, "README.md", "# tracked change\n");
    await writeRepoFile(repo.root, "new.txt", "untracked change\n");

    const entry = await shelf.shelveFiles(repo.root, {
      repoId: "test-repo",
      paths: ["README.md", "new.txt"],
    });

    await expect(fs.readFile(path.join(repo.root, "README.md"), "utf8")).resolves.toBe(
      "# test\n",
    );
    await expect(fs.access(path.join(repo.root, "new.txt"))).rejects.toThrow();

    await shelf.unshelve(repo.root, entry.id, true);
    await expect(fs.readFile(path.join(repo.root, "README.md"), "utf8")).resolves.toBe(
      "# tracked change\n",
    );
    await expect(fs.readFile(path.join(repo.root, "new.txt"), "utf8")).resolves.toBe(
      "untracked change\n",
    );
  });

  it("reports a compound error when the index rollback itself fails", async () => {
    repo = await createTempGitRepo();
    const shelf = createShelfApi(
      withGitFailures([/^diff HEAD --binary/, /^reset --/]),
      createShelfStorage(),
    );
    await writeRepoFile(repo.root, "new.txt", "untracked work\n");

    await expect(
      shelf.shelveFiles(repo.root, { repoId: "test-repo", paths: ["new.txt"] }),
    ).rejects.toThrow(/Additionally, restoring the index failed.*git reset/s);

    // The index really is dirty: the file left `??` for intent-to-add.
    const { stdout: others } = await execGit(repo.root, [
      "ls-files",
      "--others",
      "--exclude-standard",
    ]);
    expect(others.trim()).toBe("");
  });

  it("discards the shelf entry when hunk unstage fails", async () => {
    repo = await createTempGitRepo();
    const shelf = createShelfApi(
      withGitFailures([/^apply --cached --reverse/]),
      createShelfStorage(),
    );

    await writeRepoFile(repo.root, "hunk.txt", "line1\n");
    await execGit(repo.root, ["add", "hunk.txt"]);
    await execGit(repo.root, ["commit", "-m", "Initial"]);
    await writeRepoFile(repo.root, "hunk.txt", "line1\nline2\n");
    await execGit(repo.root, ["add", "hunk.txt"]);

    await expect(
      shelf.shelveHunk(repo.root, {
        repoId: "test-repo",
        path: "hunk.txt",
        hunkIndex: 0,
        staged: true,
      }),
    ).rejects.toThrow(/injected failure: apply --cached --reverse/);

    // No shelf entry for content that was never removed; the staged hunk is
    // untouched.
    await expect(shelf.listShelves(repo.root, "test-repo")).resolves.toEqual([]);
    const { stdout: staged } = await execGit(repo.root, [
      "diff",
      "--cached",
      "--name-only",
    ]);
    expect(staged.trim()).toBe("hunk.txt");
  });

  it("restores staging when a staged hunk cannot leave the worktree", async () => {
    repo = await createTempGitRepo();
    const shelf = createShelfApi(
      // Worktree reverse-apply fails; the cached unstage succeeds.
      withGitFailures([/^apply --reverse /]),
      createShelfStorage(),
    );

    await writeRepoFile(repo.root, "hunk.txt", "line1\n");
    await execGit(repo.root, ["add", "hunk.txt"]);
    await execGit(repo.root, ["commit", "-m", "Initial"]);
    await writeRepoFile(repo.root, "hunk.txt", "line1\nline2\n");
    await execGit(repo.root, ["add", "hunk.txt"]);

    await expect(
      shelf.shelveHunk(repo.root, {
        repoId: "test-repo",
        path: "hunk.txt",
        hunkIndex: 0,
        staged: true,
      }),
    ).rejects.toThrow(/restored to the index/);

    // The shelf is gone and the index is exactly as before: the hunk is
    // still staged and the worktree still holds it.
    await expect(shelf.listShelves(repo.root, "test-repo")).resolves.toEqual([]);
    const { stdout: staged } = await execGit(repo.root, [
      "diff",
      "--cached",
      "--name-only",
    ]);
    expect(staged.trim()).toBe("hunk.txt");
    await expect(fs.readFile(path.join(repo.root, "hunk.txt"), "utf8")).resolves.toBe(
      "line1\nline2\n",
    );
  });

  it("keeps a recovery copy when staged-hunk compensation fails", async () => {
    repo = await createTempGitRepo();
    const recovered: Array<{ id: string; path: string }> = [];
    const storage = createShelfStorage();
    const spiedStorage = {
      ...storage,
      saveRecoveryPatch: async (root: string, id: string, patch: string) => {
        const recoveryPath = await storage.saveRecoveryPatch(root, id, patch);
        recovered.push({ id, path: recoveryPath });
        return recoveryPath;
      },
    };
    const shelf = createShelfApi(
      // Worktree reverse-apply fails and the compensating re-stage fails too.
      // The restage command is `apply --cached <patch>` (no --reverse),
      // unlike the unstage command.
      withGitFailures([/^apply --reverse /, /^apply --cached \//]),
      spiedStorage,
    );

    await writeRepoFile(repo.root, "hunk.txt", "line1\n");
    await execGit(repo.root, ["add", "hunk.txt"]);
    await execGit(repo.root, ["commit", "-m", "Initial"]);
    await writeRepoFile(repo.root, "hunk.txt", "line1\nline2\n");
    await execGit(repo.root, ["add", "hunk.txt"]);

    await expect(
      shelf.shelveHunk(repo.root, {
        repoId: "test-repo",
        path: "hunk.txt",
        hunkIndex: 0,
        staged: true,
      }),
    ).rejects.toThrow(/restoring the staged hunk failed.*recovery copy/s);

    await expect(shelf.listShelves(repo.root, "test-repo")).resolves.toEqual([]);
    expect(recovered).toHaveLength(1);
    await expect(fs.access(recovered[0]!.path)).resolves.toBeUndefined();
  });

  it("discards the shelf entry when hunk reverse-apply fails", async () => {
    repo = await createTempGitRepo();
    const shelf = createShelfApi(
      withGitFailures([/^apply --reverse/]),
      createShelfStorage(),
    );

    await writeRepoFile(repo.root, "hunk.txt", "line1\n");
    await execGit(repo.root, ["add", "hunk.txt"]);
    await execGit(repo.root, ["commit", "-m", "Initial"]);
    await writeRepoFile(repo.root, "hunk.txt", "line1\nline2\n");

    await expect(
      shelf.shelveHunk(repo.root, {
        repoId: "test-repo",
        path: "hunk.txt",
        hunkIndex: 0,
      }),
    ).rejects.toThrow(/injected failure: apply --reverse/);

    await expect(shelf.listShelves(repo.root, "test-repo")).resolves.toEqual([]);
    await expect(fs.readFile(path.join(repo.root, "hunk.txt"), "utf8")).resolves.toBe(
      "line1\nline2\n",
    );
  });
});
