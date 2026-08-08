import { describe, expect, it, afterEach } from "vitest";
import * as fs from "fs/promises";
import { createApplyNonConflictingApi } from "../git/applyNonConflicting";
import {
  copyConflictRepo,
  ensureConflictFixture,
  hasUnmergedStages,
  isResolvedInIndex,
  readRepoFile,
  seedNonConflictingUnmerged,
} from "../../test/helpers/conflictRepoFixture";
import {
  createTempGitRepo,
  execGit,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("applyNonConflicting integration", () => {
  let repoRoot = "";
  let tempRepo: TempGitRepo | null = null;
  const tempParents: string[] = [];

  afterEach(async () => {
    if (tempRepo) {
      await tempRepo.cleanup();
      tempRepo = null;
    }
    if (repoRoot) {
      await fs.rm(tempParents[0] ?? repoRoot, {
        recursive: true,
        force: true,
      }).catch(() => undefined);
      repoRoot = "";
      tempParents.length = 0;
    }
  });

  it(
    "resolves and stages files with only non-conflicting merge changes",
    async () => {
    await ensureConflictFixture();
    repoRoot = await copyConflictRepo();
    tempParents.push(repoRoot.replace(/\/repo$/, ""));

    await seedNonConflictingUnmerged(repoRoot, "auto.txt", {
      base: "base\n",
      ours: "base\nours\n",
      theirs: "base\nours\n",
    });

    const api = createApplyNonConflictingApi(execGit);
    const result = await api.applyNonConflicting(repoRoot);

    expect(result.applied).toContain("auto.txt");
    expect(await hasUnmergedStages(repoRoot, "auto.txt")).toBe(false);
    expect(await isResolvedInIndex(repoRoot, "auto.txt")).toBe(true);
    expect(await readRepoFile(repoRoot, "auto.txt")).toBe("base\nours\n");
  },
    20_000,
  );

  it(
    "skips files that still contain conflict blocks",
    async () => {
    tempRepo = await createTempGitRepo();
    repoRoot = tempRepo.root;

    await seedNonConflictingUnmerged(repoRoot, "clean.txt", {
      base: "base\n",
      ours: "base\nours\n",
      theirs: "base\nours\n",
    });
    await seedNonConflictingUnmerged(repoRoot, "conflict.txt", {
      base: "base\n",
      ours: "base\nours\n",
      theirs: "base\ntheirs\n",
    });

    const api = createApplyNonConflictingApi(execGit);
    const result = await api.applyNonConflicting(repoRoot);

    expect(result.applied).toContain("clean.txt");
    expect(result.skipped).toContain("conflict.txt");
    expect(await isResolvedInIndex(repoRoot, "clean.txt")).toBe(true);
    expect(await hasUnmergedStages(repoRoot, "conflict.txt")).toBe(true);
  },
    15_000,
  );
});