import { describe, expect, it, afterEach } from "vitest";
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
});