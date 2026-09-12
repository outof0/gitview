import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createShelfApi } from "../git/shelf";
import { createSelectedChangesApi } from "../git/selectedChanges";
import { createHistoryApi } from "../git/history";
import { createBranchCompareApi, writeFileAtomically } from "../git/branchCompare";
import { computeChangeDigest } from "../git/changeDigest";
import { createRepositoryService } from "../repositoryService";
import { requireRollbackConfirmation } from "../../application/mutationPreconditions";
import { createShelfStorage, type ShelfStorage } from "../../storage/shelfStorage";
import type { GitExecFn } from "../git/types";
import { NO_OPERATION } from "../../shared/types/operation";
import {
  createRollbackConfirmationEvidence,
  fingerprintRepository,
  matchesRepositoryFingerprint,
  type ConfirmationRepositoryState,
} from "../../shared/types/confirmation";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("data safety regressions", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("preserves binary content across shelve and unshelve", async () => {
    repo = await createTempGitRepo();
    const shelf = createShelfApi(execGit, createShelfStorage());

    // Bytes that are not valid UTF-8. Without `git diff --binary` git writes
    // "Binary files differ" into the patch, the working tree is then rolled
    // back, and the change is gone for good.
    const committed = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe, 0x80,
    ]);
    const logoPath = path.join(repo.root, "logo.bin");
    await fs.writeFile(logoPath, committed);
    await execGit(repo.root, ["add", "logo.bin"]);
    await execGit(repo.root, ["commit", "-m", "Add binary asset"]);

    const modified = Buffer.concat([committed, Buffer.from([0x01, 0x02, 0xff])]);
    await fs.writeFile(logoPath, modified);

    const entry = await shelf.shelveFiles(repo.root, {
      repoId: "test-repo",
      paths: ["logo.bin"],
    });

    // Shelving rolls the file back to its committed content.
    expect((await fs.readFile(logoPath)).equals(committed)).toBe(true);

    await shelf.unshelve(repo.root, entry.id);

    const restored = await fs.readFile(logoPath);
    expect(restored.equals(modified)).toBe(true);
  });

  it("keeps uncommitted local edits when dropping selected changes", async () => {
    repo = await createTempGitRepo();
    const selected = createSelectedChangesApi(execGit, async () => false);

    await writeRepoFile(repo.root, "file.txt", "one\nthree\n");
    await execGit(repo.root, ["add", "file.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);

    await writeRepoFile(repo.root, "file.txt", "one\ntwo\nthree\n");
    await execGit(repo.root, ["add", "file.txt"]);
    await execGit(repo.root, ["commit", "-m", "Insert two"]);
    const { stdout: headSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    // An edit the user has not committed yet. `git restore --source=HEAD`
    // overwrote the whole file and destroyed it.
    await writeRepoFile(repo.root, "file.txt", "one\ntwo\nthree\nlocal-user-edit\n");

    const sha = headSha.trim();
    await selected.dropSelectedFromHead(
      repo.root,
      sha,
      "file.txt",
      { hunkIndexes: [0] },
      sha,
    );

    const content = await fs.readFile(path.join(repo.root, "file.txt"), "utf8");
    // The dropped hunk is gone; the user's edit survives.
    expect(content).toBe("one\nthree\nlocal-user-edit\n");
  });

  it("detects a content change that leaves the repository equally dirty", async () => {
    repo = await createTempGitRepo();
    await writeRepoFile(repo.root, "a.txt", "first\n");

    const files = [{ path: "a.txt", kind: "modified" }];
    const before = await computeChangeDigest(repo.root, files);

    await writeRepoFile(repo.root, "a.txt", "second\n");
    const after = await computeChangeDigest(repo.root, files);

    expect(before).not.toBeNull();
    expect(after).not.toBe(before);

    const stateAt = (changeDigest: string | null): ConfirmationRepositoryState => ({
      id: "test-repo",
      headSha: "abc",
      currentBranch: "main",
      // `dirty` is true on both sides. Without the digest there is nothing
      // here to tell "the tree I agreed to destroy" from "the tree I now have".
      dirty: true,
      conflictCount: 0,
      operation: NO_OPERATION,
      changeDigest,
    });

    const evidence = fingerprintRepository(stateAt(before));
    expect(matchesRepositoryFingerprint(stateAt(before), evidence)).toBe(true);
    expect(matchesRepositoryFingerprint(stateAt(after), evidence)).toBe(false);
  });

  it("refreshes repository confirmation digests before validating rollback", async () => {
    repo = await createTempGitRepo();
    await writeRepoFile(repo.root, "notes.txt", "first\n");

    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => [repo!.root],
    });
    const input = {
      workspaceFolders: [{ uriPath: repo.root, name: "repo" }],
      trusted: true,
      freshChangeDigest: true,
    };

    const [before] = await repositoryService.discoverRepositories(input);
    expect(before?.changeDigest).not.toBeNull();
    if (!before) {
      throw new Error("Expected a repository snapshot");
    }

    const confirmation = createRollbackConfirmationEvidence(
      before,
      ["notes.txt"],
      [],
    );

    await writeRepoFile(repo.root, "notes.txt", "second\n");
    const [after] = await repositoryService.discoverRepositories(input);
    expect(after?.changeDigest).not.toBe(before.changeDigest);
    if (!after) {
      throw new Error("Expected a refreshed repository snapshot");
    }

    const validation = requireRollbackConfirmation(after, ["notes.txt"], [], {
      evidence: confirmation,
      typedValue: confirmation.expectedTypedValue,
    });
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.error.code).toBe("CONFIRMATION_STALE");
    }
  });

  it("returns a null digest for a clean working tree", async () => {
    repo = await createTempGitRepo();
    expect(await computeChangeDigest(repo.root, [])).toBeNull();
  });

  it("refuses a reset whose target is shaped like a git option", async () => {
    repo = await createTempGitRepo();
    const { stdout: headSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);
    await writeRepoFile(repo.root, "notes.txt", "dirty\n");
    const history = createHistoryApi(execGit);

    // `{ mode: "soft", sha: "--hard" }` used to produce
    // `git reset --soft --hard`, which hard-resets and destroys uncommitted
    // work. The operand assert must stop it before git runs.
    await expect(
      history.resetTo(repo.root, "--hard", "soft"),
    ).rejects.toThrow("Invalid commit");

    expect(
      await fs.readFile(path.join(repo.root, "notes.txt"), "utf8"),
    ).toBe("dirty\n");
    const { stdout: after } = await execGit(repo.root, ["rev-parse", "HEAD"]);
    expect(after.trim()).toBe(headSha.trim());
  });

  it("keeps unrelated staged changes out of the rewritten commit", async () => {
    repo = await createTempGitRepo();
    const selected = createSelectedChangesApi(execGit, async () => false);

    await writeRepoFile(repo.root, "file.txt", "one\nthree\n");
    await writeRepoFile(repo.root, "other.txt", "original\n");
    await execGit(repo.root, ["add", "."]);
    await execGit(repo.root, ["commit", "-m", "Base"]);

    await writeRepoFile(repo.root, "file.txt", "one\ntwo\nthree\n");
    await execGit(repo.root, ["add", "file.txt"]);
    await execGit(repo.root, ["commit", "-m", "Insert two"]);
    const { stdout: headSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    // An edit staged for a later commit. `reset --soft` keeps the index, so
    // the old flow committed it into the rewritten HEAD and it vanished from
    // the staged diff.
    await writeRepoFile(repo.root, "other.txt", "staged\n");
    await execGit(repo.root, ["add", "other.txt"]);

    await selected.dropSelectedFromHead(
      repo.root,
      headSha.trim(),
      "file.txt",
      { hunkIndexes: [0] },
      headSha.trim(),
    );

    const { stdout: committedOther } = await execGit(repo.root, [
      "show",
      "HEAD:other.txt",
    ]);
    expect(committedOther).toBe("original\n");

    const { stdout: staged } = await execGit(repo.root, [
      "diff",
      "--cached",
      "--name-only",
    ]);
    expect(staged.trim().split("\n")).toEqual(["other.txt"]);

    const { stdout: committedFile } = await execGit(repo.root, [
      "show",
      "HEAD:file.txt",
    ]);
    expect(committedFile).toBe("one\nthree\n");
  });

  it("does not delete the working file when reading the branch blob fails", async () => {
    repo = await createTempGitRepo();
    await writeRepoFile(repo.root, "file.txt", "working\n");
    await execGit(repo.root, ["add", "file.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);
    const { stdout: sha } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    // `git show` fails as if git itself were broken; every other command
    // answers normally. A failed show used to read as "the branch deleted
    // this file" and the working-tree copy was unlinked.
    const faultyExec: GitExecFn = async (repoRoot, args, opts) => {
      if (args[0] === "show") {
        throw new Error("git fatal: unable to read tree");
      }
      return execGit(repoRoot, args, opts);
    };
    const compare = createBranchCompareApi(faultyExec, async () => false);

    await expect(
      compare.applyFileFromBranch(
        repo.root,
        sha.trim(),
        "file.txt",
        "workingTree",
      ),
    ).rejects.toThrow("unable to read tree");
    expect(
      await fs.readFile(path.join(repo.root, "file.txt"), "utf8"),
    ).toBe("working\n");
  });

  it("still deletes the working file when the branch genuinely lacks it", async () => {
    repo = await createTempGitRepo();
    const compare = createBranchCompareApi(execGit, async () => false);

    await writeRepoFile(repo.root, "file.txt", "working\n");
    await execGit(repo.root, ["add", "file.txt"]);
    await execGit(repo.root, ["commit", "-m", "Add file"]);
    await execGit(repo.root, ["branch", "side", "HEAD~1"]);

    await compare.applyFileFromBranch(
      repo.root,
      "side",
      "file.txt",
      "workingTree",
    );
    await expect(
      fs.access(path.join(repo.root, "file.txt")),
    ).rejects.toThrow();
  });

  it("refuses to unlink a working file that resolves outside the repository", async () => {
    repo = await createTempGitRepo();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-outside-"));
    const outsideFile = path.join(outside, "secret.txt");
    try {
      await fs.writeFile(outsideFile, "precious\n");

      await writeRepoFile(repo.root, "vendor/secret.txt", "precious\n");
      await execGit(repo.root, ["add", "vendor/secret.txt"]);
      await execGit(repo.root, ["commit", "-m", "Add vendored file"]);
      await execGit(repo.root, ["branch", "side", "HEAD~1"]);

      // Swap the directory for a symlink that escapes the repository. The
      // branch lacks the path, but deleting it must still not leave the repo.
      await fs.rm(path.join(repo.root, "vendor"), { recursive: true });
      await fs.symlink(outside, path.join(repo.root, "vendor"));

      const compare = createBranchCompareApi(execGit, async () => false);
      await expect(
        compare.applyFileFromBranch(
          repo.root,
          "side",
          "vendor/secret.txt",
          "workingTree",
        ),
      ).rejects.toThrow();
      expect(await fs.readFile(outsideFile, "utf8")).toBe("precious\n");
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it("refuses an apply whose final component already escapes the repository", async () => {
    repo = await createTempGitRepo();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-outside-"));
    const outsideFile = path.join(outside, "secret.txt");
    try {
      await fs.writeFile(outsideFile, "precious\n");

      await writeRepoFile(repo.root, "target.txt", "base\n");
      await execGit(repo.root, ["add", "target.txt"]);
      await execGit(repo.root, ["commit", "-m", "Add target"]);
      await execGit(repo.root, ["branch", "side"]);
      await writeRepoFile(repo.root, "target.txt", "branch content\n");
      await execGit(repo.root, ["add", "target.txt"]);
      await execGit(repo.root, ["commit", "-m", "Update target on master"]);
      await execGit(repo.root, ["checkout", "side"]);

      // The swap already won the race before the apply starts: the lexical
      // entry is a symlink escaping the repository. The containment check
      // refuses, and the outside file is never touched.
      await fs.rm(path.join(repo.root, "target.txt"));
      await fs.symlink(outsideFile, path.join(repo.root, "target.txt"));

      const compare = createBranchCompareApi(execGit, async () => false);
      await expect(
        compare.applyFileFromBranch(
          repo.root,
          "master",
          "target.txt",
          "workingTree",
        ),
      ).rejects.toThrow();
      expect(await fs.readFile(outsideFile, "utf8")).toBe("precious\n");
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it("never writes outside the repository while the entry is swapped mid-apply", async () => {
    repo = await createTempGitRepo();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-outside-"));
    const outsideFile = path.join(outside, "secret.txt");
    try {
      await fs.writeFile(outsideFile, "precious\n");

      await writeRepoFile(repo.root, "target.txt", "base\n");
      await execGit(repo.root, ["add", "target.txt"]);
      await execGit(repo.root, ["commit", "-m", "Add target"]);
      await execGit(repo.root, ["branch", "side"]);
      await writeRepoFile(repo.root, "target.txt", "branch content\n");
      await execGit(repo.root, ["add", "target.txt"]);
      await execGit(repo.root, ["commit", "-m", "Update target on master"]);
      await execGit(repo.root, ["checkout", "side"]);

      const dest = path.join(repo.root, "target.txt");
      const compare = createBranchCompareApi(execGit, async () => false);
      let stop = false;
      const swapper = (async () => {
        while (!stop) {
          await fs.rm(dest, { force: true }).catch(() => undefined);
          await fs.symlink(outsideFile, dest).catch(() => undefined);
          // Hold the hostile entry so the apply has to cross it.
          await new Promise((resolve) =>
            setTimeout(resolve, Math.floor(Math.random() * 3)),
          );
          await fs.rm(dest, { force: true }).catch(() => undefined);
          await fs.writeFile(dest, "base\n").catch(() => undefined);
        }
      })();
      try {
        for (let i = 0; i < 250; i++) {
          await compare
            .applyFileFromBranch(repo.root, "master", "target.txt", "workingTree")
            .catch(() => undefined);
          expect(await fs.readFile(outsideFile, "utf8")).toBe("precious\n");
        }
      } finally {
        stop = true;
        await swapper;
      }
      expect(await fs.readFile(outsideFile, "utf8")).toBe("precious\n");
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it("writeFileAtomically replaces a hostile symlink instead of following it", async () => {
    repo = await createTempGitRepo();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-outside-"));
    const outsideFile = path.join(outside, "secret.txt");
    try {
      await fs.writeFile(outsideFile, "precious\n");
      const dest = path.join(repo.root, "target.txt");
      await fs.symlink(outsideFile, dest);

      await writeFileAtomically(repo.root, dest, Buffer.from("branch content\n"));

      expect(await fs.readFile(outsideFile, "utf8")).toBe("precious\n");
      const stat = await fs.lstat(dest);
      expect(stat.isSymbolicLink()).toBe(false);
      expect(await fs.readFile(dest, "utf8")).toBe("branch content\n");
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it("writeFileAtomically refuses when the parent directory escapes the repository", async () => {
    repo = await createTempGitRepo();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-outside-"));
    try {
      await fs.mkdir(path.join(repo.root, "work"));
      await fs.symlink(outside, path.join(repo.root, "work", "linked"));

      await expect(
        writeFileAtomically(
          repo.root,
          path.join(repo.root, "work", "linked", "target.txt"),
          Buffer.from("branch content\n"),
        ),
      ).rejects.toThrow("outside the repository");
      expect(await fs.readdir(outside)).toEqual([]);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it("restores staged placement when a shelve fails after cleanup", async () => {
    repo = await createTempGitRepo();
    const failingStorage: ShelfStorage = {
      ...createShelfStorage(),
      add: async () => {
        throw new Error("disk full");
      },
    };
    const shelf = createShelfApi(execGit, failingStorage);

    await writeRepoFile(repo.root, "notes.txt", "committed\n");
    await execGit(repo.root, ["add", "notes.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);
    await writeRepoFile(repo.root, "notes.txt", "staged\n");
    await execGit(repo.root, ["add", "notes.txt"]);
    await writeRepoFile(repo.root, "notes.txt", "staged plus unstaged\n");

    const beforeCached = await execGit(repo.root, [
      "diff",
      "--cached",
      "--",
      "notes.txt",
    ]);
    const beforeWorktree = await execGit(repo.root, ["diff", "--", "notes.txt"]);
    expect(beforeCached.stdout).toContain("+staged");
    expect(beforeWorktree.stdout).toContain("plus unstaged");

    await expect(
      shelf.shelveFiles(repo.root, { repoId: "test-repo", paths: ["notes.txt"] }),
    ).rejects.toThrow("disk full");

    const afterCached = await execGit(repo.root, [
      "diff",
      "--cached",
      "--",
      "notes.txt",
    ]);
    const afterWorktree = await execGit(repo.root, ["diff", "--", "notes.txt"]);
    expect(afterCached.stdout).toBe(beforeCached.stdout);
    expect(afterWorktree.stdout).toBe(beforeWorktree.stdout);
  });

  it("keeps a durable recovery patch when a shelve fails after cleanup", async () => {
    repo = await createTempGitRepo();
    const failingStorage: ShelfStorage = {
      ...createShelfStorage(),
      add: async () => {
        throw new Error("disk full");
      },
    };
    const faultyExec: GitExecFn = async (repoRoot, args, opts) => {
      if (args[0] === "apply") {
        throw new Error("apply failed");
      }
      return execGit(repoRoot, args, opts);
    };
    const shelf = createShelfApi(faultyExec, failingStorage);

    await writeRepoFile(repo.root, "notes.txt", "committed\n");
    await execGit(repo.root, ["add", "notes.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);
    await writeRepoFile(repo.root, "notes.txt", "uncommitted work\n");

    let message = "";
    try {
      await shelf.shelveFiles(repo.root, {
        repoId: "test-repo",
        paths: ["notes.txt"],
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    // Both the persistence and the compensation failed, so the tree is clean
    // and no shelf entry exists — the recovery file is the only copy.
    expect(message).toMatch(/recovery copy of the patch is at (.+)\.$/);
    const recoveryPath = message.match(/recovery copy of the patch is at (.+)\.$/)?.[1] ?? "";
    expect(recoveryPath).not.toBe("");
    expect(await fs.readFile(recoveryPath, "utf8")).toContain(
      "uncommitted work",
    );
    expect(
      await fs.readFile(path.join(repo.root, "notes.txt"), "utf8"),
    ).toBe("committed\n");
  });
});
