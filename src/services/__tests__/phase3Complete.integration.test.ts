import { describe, expect, it, afterEach } from "vitest";
import { createIntegrationApi } from "../git/integration";
import { createExtractChangesApi } from "../git/extractChanges";
import { createHistoryApi } from "../git/history";
import { createMergeApi } from "../git/merge";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";
import * as fs from "fs/promises";
import * as path from "path";

describe("Phase 3 complete integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("merges a branch with --no-ff", async () => {
    repo = await createTempGitRepo();
    const integration = createIntegrationApi(execGit);

    await writeRepoFile(repo.root, "base.txt", "base\n");
    await execGit(repo.root, ["add", "base.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);

    await execGit(repo.root, ["checkout", "-b", "feature"]);
    await writeRepoFile(repo.root, "feature.txt", "feature\n");
    await execGit(repo.root, ["add", "feature.txt"]);
    await execGit(repo.root, ["commit", "-m", "Feature"]);

    await execGit(repo.root, ["checkout", "main"]);
    await integration.mergeBranch(repo.root, "feature", { noFf: true });

    const { stdout: log } = await execGit(repo.root, ["log", "--oneline"]);
    expect(log).toContain("Merge");
    await expect(
      fs.access(path.join(repo.root, "feature.txt")),
    ).resolves.toBeUndefined();
  }, 15000);

  it("squash-merges a branch", async () => {
    repo = await createTempGitRepo();
    const integration = createIntegrationApi(execGit);

    await writeRepoFile(repo.root, "a.txt", "a\n");
    await execGit(repo.root, ["add", "a.txt"]);
    await execGit(repo.root, ["commit", "-m", "Initial"]);

    await execGit(repo.root, ["checkout", "-b", "topic"]);
    await writeRepoFile(repo.root, "b.txt", "b\n");
    await execGit(repo.root, ["add", "b.txt"]);
    await execGit(repo.root, ["commit", "-m", "Topic work"]);

    await execGit(repo.root, ["checkout", "main"]);
    await integration.mergeBranch(repo.root, "topic", {
      squash: true,
      message: "Squashed topic",
    });
    await execGit(repo.root, ["commit", "-m", "Squashed topic"]);

    await expect(fs.access(path.join(repo.root, "b.txt"))).resolves.toBeUndefined();
    const { stdout: log } = await execGit(repo.root, ["log", "--oneline"]);
    expect(log).toContain("Squashed topic");
  });

  it("leaves the merge staged but uncommitted with --no-commit", async () => {
    repo = await createTempGitRepo();
    const integration = createIntegrationApi(execGit);

    await writeRepoFile(repo.root, "a.txt", "a\n");
    await execGit(repo.root, ["add", "a.txt"]);
    await execGit(repo.root, ["commit", "-m", "Initial"]);

    await execGit(repo.root, ["checkout", "-b", "topic"]);
    await writeRepoFile(repo.root, "b.txt", "b\n");
    await execGit(repo.root, ["add", "b.txt"]);
    await execGit(repo.root, ["commit", "-m", "Topic work"]);

    await execGit(repo.root, ["checkout", "main"]);
    await integration.mergeBranch(repo.root, "topic", {
      noFf: true,
      noCommit: true,
      message: "ignored while uncommitted",
    });

    const { stdout: staged } = await execGit(repo.root, [
      "diff",
      "--cached",
      "--name-only",
    ]);
    expect(staged).toContain("b.txt");
    const { stdout: log } = await execGit(repo.root, ["log", "--oneline"]);
    expect(log).not.toContain("Merge");
  });

  it("rebases a branch other than the current one", async () => {
    repo = await createTempGitRepo();
    const integration = createIntegrationApi(execGit);

    await writeRepoFile(repo.root, "base.txt", "base\n");
    await execGit(repo.root, ["add", "base.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);

    await execGit(repo.root, ["checkout", "-b", "topic"]);
    await writeRepoFile(repo.root, "topic.txt", "topic\n");
    await execGit(repo.root, ["add", "topic.txt"]);
    await execGit(repo.root, ["commit", "-m", "Topic work"]);

    await execGit(repo.root, ["checkout", "main"]);
    await writeRepoFile(repo.root, "main.txt", "main\n");
    await execGit(repo.root, ["add", "main.txt"]);
    await execGit(repo.root, ["commit", "-m", "Main work"]);

    await integration.rebaseOnto(repo.root, "main", { from: "topic" });

    const { stdout: current } = await execGit(repo.root, [
      "branch",
      "--show-current",
    ]);
    expect(current.trim()).toBe("topic");
    const { stdout: log } = await execGit(repo.root, ["log", "--oneline"]);
    expect(log).toContain("Topic work");
    expect(log).toContain("Main work");
  }, 15000);

  it("rebases current branch onto another branch", async () => {
    repo = await createTempGitRepo();
    const integration = createIntegrationApi(execGit);

    await writeRepoFile(repo.root, "shared.txt", "v1\n");
    await execGit(repo.root, ["add", "shared.txt"]);
    await execGit(repo.root, ["commit", "-m", "Root"]);

    await execGit(repo.root, ["checkout", "-b", "base"]);
    await writeRepoFile(repo.root, "base.txt", "base\n");
    await execGit(repo.root, ["add", "base.txt"]);
    await execGit(repo.root, ["commit", "-m", "On base"]);

    await execGit(repo.root, ["checkout", "main"]);
    await writeRepoFile(repo.root, "main.txt", "main\n");
    await execGit(repo.root, ["add", "main.txt"]);
    await execGit(repo.root, ["commit", "-m", "On main"]);

    await integration.rebaseOnto(repo.root, "base");

    const { stdout: log } = await execGit(repo.root, ["log", "--oneline"]);
    expect(log).toContain("On main");
    await expect(fs.access(path.join(repo.root, "base.txt"))).resolves.toBeUndefined();
  });

  it("extracts changes from a commit without committing", async () => {
    repo = await createTempGitRepo();
    const extract = createExtractChangesApi(execGit);

    await writeRepoFile(repo.root, "start.txt", "start\n");
    await execGit(repo.root, ["add", "start.txt"]);
    await execGit(repo.root, ["commit", "-m", "Start"]);

    await writeRepoFile(repo.root, "extracted.txt", "extracted\n");
    await execGit(repo.root, ["add", "extracted.txt"]);
    await execGit(repo.root, ["commit", "-m", "To extract"]);
    const { stdout: sha } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await execGit(repo.root, ["reset", "--hard", "HEAD~1"]);
    await extract.extractFromCommit(repo.root, sha.trim());

    const content = await fs.readFile(
      path.join(repo.root, "extracted.txt"),
      "utf8",
    );
    expect(content).toBe("extracted\n");

    const { stdout: status } = await execGit(repo.root, ["status", "--porcelain"]);
    expect(status).toContain("extracted.txt");
  });

  it("continues and aborts merge recovery", async () => {
    repo = await createTempGitRepo();
    const integration = createIntegrationApi(execGit);
    const merge = createMergeApi(execGit);

    await writeRepoFile(repo.root, "conflict.txt", "base\n");
    await execGit(repo.root, ["add", "conflict.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);

    await execGit(repo.root, ["checkout", "-b", "side"]);
    await writeRepoFile(repo.root, "conflict.txt", "side\n");
    await execGit(repo.root, ["add", "conflict.txt"]);
    await execGit(repo.root, ["commit", "-m", "Side"]);

    await execGit(repo.root, ["checkout", "main"]);
    await writeRepoFile(repo.root, "conflict.txt", "main\n");
    await execGit(repo.root, ["add", "conflict.txt"]);
    await execGit(repo.root, ["commit", "-m", "Main"]);

    await expect(integration.mergeBranch(repo.root, "side")).rejects.toThrow();

    await writeRepoFile(repo.root, "conflict.txt", "resolved\n");
    await execGit(repo.root, ["add", "conflict.txt"]);
    await merge.continueMerge(repo.root);

    const content = await fs.readFile(
      path.join(repo.root, "conflict.txt"),
      "utf8",
    );
    expect(content).toBe("resolved\n");
  });

  it("continues cherry-pick recovery after conflict", async () => {
    repo = await createTempGitRepo();
    const history = createHistoryApi(execGit);

    await writeRepoFile(repo.root, "file.txt", "v1\n");
    await execGit(repo.root, ["add", "file.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);

    await execGit(repo.root, ["checkout", "-b", "other"]);
    await writeRepoFile(repo.root, "file.txt", "other\n");
    await execGit(repo.root, ["add", "file.txt"]);
    await execGit(repo.root, ["commit", "-m", "Other"]);
    const { stdout: otherSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await execGit(repo.root, ["checkout", "main"]);
    await writeRepoFile(repo.root, "file.txt", "main\n");
    await execGit(repo.root, ["add", "file.txt"]);
    await execGit(repo.root, ["commit", "-m", "Main edit"]);

    await expect(
      history.cherryPick(repo.root, otherSha.trim()),
    ).rejects.toThrow();

    await writeRepoFile(repo.root, "file.txt", "picked\n");
    await execGit(repo.root, ["add", "file.txt"]);
    await history.cherryPickContinue(repo.root);

    const content = await fs.readFile(path.join(repo.root, "file.txt"), "utf8");
    expect(content).toBe("picked\n");
  });
});