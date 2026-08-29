import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createShelfApi } from "../git/shelf";
import { createSelectedChangesApi } from "../git/selectedChanges";
import { computeChangeDigest } from "../git/changeDigest";
import { createShelfStorage } from "../../storage/shelfStorage";
import { NO_OPERATION } from "../../shared/types/operation";
import {
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

  it("returns a null digest for a clean working tree", async () => {
    repo = await createTempGitRepo();
    expect(await computeChangeDigest(repo.root, [])).toBeNull();
  });
});
