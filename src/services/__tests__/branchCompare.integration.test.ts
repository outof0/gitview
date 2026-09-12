import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createBranchCompareApi } from "../git/branchCompare";
import { createMergeApi } from "../git/merge";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("branchCompare integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it(
    "lists and builds a compare-with-current document",
    async () => {
    repo = await createTempGitRepo();
    const merge = createMergeApi(execGit);
    const compare = createBranchCompareApi(execGit, merge.isBinaryFile);

    await writeRepoFile(repo.root, "base.txt", "base\n");
    await execGit(repo.root, ["add", "base.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);

    await execGit(repo.root, ["checkout", "-b", "feature"]);
    await writeRepoFile(repo.root, "feature.txt", "feature\n");
    await execGit(repo.root, ["add", "feature.txt"]);
    await execGit(repo.root, ["commit", "-m", "Feature file"]);

    await execGit(repo.root, ["checkout", "main"]);
    await writeRepoFile(repo.root, "main.txt", "main\n");
    await execGit(repo.root, ["add", "main.txt"]);
    await execGit(repo.root, ["commit", "-m", "Main file"]);

    const files = await compare.listFiles(repo.root, "feature", "current");
    expect(files.some((file) => file.path === "feature.txt")).toBe(true);

    const document = await compare.buildFileDocument(
      repo.root,
      "repo-1",
      "feature.txt",
      "feature",
      "current",
      "A",
    );
    expect(document).not.toBeNull();
    expect(document?.layout).toBe("single");
    expect(document?.right?.text).toContain("feature");
  },
    15_000,
  );

  it("lists and builds a compare-with-working-tree document", async () => {
    repo = await createTempGitRepo();
    const merge = createMergeApi(execGit);
    const compare = createBranchCompareApi(execGit, merge.isBinaryFile);

    await writeRepoFile(repo.root, "shared.txt", "base\n");
    await execGit(repo.root, ["add", "shared.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);

    await execGit(repo.root, ["checkout", "-b", "feature"]);
    await writeRepoFile(repo.root, "shared.txt", "feature\n");
    await execGit(repo.root, ["add", "shared.txt"]);
    await execGit(repo.root, ["commit", "-m", "Feature edit"]);

    await execGit(repo.root, ["checkout", "main"]);
    await writeRepoFile(repo.root, "shared.txt", "working\n");

    const files = await compare.listFiles(repo.root, "feature", "workingTree");
    expect(files.some((file) => file.path === "shared.txt")).toBe(true);

    const document = await compare.buildFileDocument(
      repo.root,
      "repo-1",
      "shared.txt",
      "feature",
      "workingTree",
      "M",
    );
    expect(document).not.toBeNull();
    expect(document?.layout).toBe("split");
    expect(document?.left?.text).toContain("feature");
    expect(document?.right?.text).toContain("working");
  },
    15_000,
  );
  it("detects binary content from the compared refs", async () => {
    repo = await createTempGitRepo();
    const merge = createMergeApi(execGit);
    const compare = createBranchCompareApi(execGit, merge.isBinaryFile);
    await execGit(repo.root, ["checkout", "-b", "feature"]);
    await fs.writeFile(
      path.join(repo.root, "asset.bin"),
      Buffer.from([0x00, 0xff, 0x80, 0x01]),
    );
    await execGit(repo.root, ["add", "asset.bin"]);
    await execGit(repo.root, ["commit", "-m", "Add binary asset"]);
    await execGit(repo.root, ["checkout", "main"]);

    const document = await compare.buildFileDocument(
      repo.root,
      "repo-1",
      "asset.bin",
      "feature",
      "current",
      "A",
    );

    expect(document?.binary).toBe(true);
    expect(document?.right?.text).toBe("[Binary file]");
  });
});
