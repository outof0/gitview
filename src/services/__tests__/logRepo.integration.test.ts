import { describe, expect, it, afterEach } from "vitest";
import type { GitExecFn } from "../git/types";
import { createLogApi } from "../git/log";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("logRepo integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("omits diff-merges on Git versions that do not support the flag", async () => {
    const calls: string[][] = [];
    const mockExec: GitExecFn = async (_root, args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };
    const log = createLogApi(mockExec, {
      supportsDiffMerges: async () => false,
    });

    const result = await log.logRepo("/repo", { limit: 10 });

    expect(result.ok).toBe(true);
    expect(calls[0]).not.toContain("--diff-merges=first-parent");
  });

  it("filters commits by author", async () => {
    repo = await createTempGitRepo();
    const log = createLogApi(execGit);

    await writeRepoFile(repo.root, "alice.txt", "alice\n");
    await execGit(repo.root, ["add", "alice.txt"]);
    await execGit(repo.root, [
      "-c",
      "user.name=Alice",
      "-c",
      "user.email=alice@example.com",
      "commit",
      "-m",
      "Alice commit",
    ]);

    await writeRepoFile(repo.root, "bob.txt", "bob\n");
    await execGit(repo.root, ["add", "bob.txt"]);
    await execGit(repo.root, [
      "-c",
      "user.name=Bob",
      "-c",
      "user.email=bob@example.com",
      "commit",
      "-m",
      "Bob commit",
    ]);

    const result = await log.logRepo(repo.root, { author: "Alice", limit: 50 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.commits.every((c) => c.author.includes("Alice"))).toBe(true);
      expect(result.commits.some((c) => c.subject === "Alice commit")).toBe(true);
      expect(result.commits.some((c) => c.subject === "Bob commit")).toBe(false);
    }
  });

  it("queries outgoing commits relative to upstream", async () => {
    const calls: string[][] = [];
    const mockExec: GitExecFn = async (_root, args) => {
      calls.push(args);
      const key = args.join(" ");
      if (key.includes("rev-parse") && key.includes("@{upstream}")) {
        return { stdout: "origin/main\n", stderr: "" };
      }
      if (args[0] === "log") {
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected git call: ${key}`);
    };

    const log = createLogApi(mockExec);
    const result = await log.logRepo("/repo", { range: "outgoing", limit: 50 });
    expect(result.ok).toBe(true);
    const logCall = calls.find((args) => args[0] === "log");
    expect(logCall?.includes("origin/main..HEAD")).toBe(true);
  });

  it("keeps tool-owned checkpoint refs out of the repository graph", async () => {
    repo = await createTempGitRepo();
    const log = createLogApi(execGit);

    await execGit(repo.root, ["checkout", "-b", "feature"]);
    await writeRepoFile(repo.root, "feature.txt", "user branch\n");
    await execGit(repo.root, ["add", "feature.txt"]);
    await execGit(repo.root, ["commit", "-m", "User branch commit"]);
    await execGit(repo.root, ["checkout", "main"]);

    await execGit(repo.root, ["checkout", "-b", "checkpoint-source"]);
    await writeRepoFile(repo.root, "checkpoint.txt", "tool checkpoint\n");
    await execGit(repo.root, ["add", "checkpoint.txt"]);
    await execGit(repo.root, ["commit", "-m", "Tool checkpoint commit"]);
    const { stdout: checkpointSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);
    await execGit(repo.root, ["checkout", "main"]);
    await execGit(repo.root, ["branch", "-D", "checkpoint-source"]);
    await execGit(repo.root, [
      "update-ref",
      "refs/cline/checkpoints/test/1",
      checkpointSha.trim(),
    ]);

    const result = await log.logRepo(repo.root, { range: "all", limit: 50 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.commits.some((commit) => commit.subject === "User branch commit")).toBe(
        true,
      );
      expect(
        result.commits.some((commit) => commit.subject === "Tool checkpoint commit"),
      ).toBe(false);
    }
  });

  it("includes files introduced by merge commits without extra Git calls", async () => {
    repo = await createTempGitRepo();
    const calls: string[][] = [];
    const trackedExec: GitExecFn = async (root, args) => {
      calls.push(args);
      return execGit(root, args);
    };
    const log = createLogApi(trackedExec);

    await execGit(repo.root, ["checkout", "-b", "feature"]);
    await writeRepoFile(repo.root, "feature.txt", "feature\n");
    await execGit(repo.root, ["add", "feature.txt"]);
    await execGit(repo.root, ["commit", "-m", "Feature commit"]);
    await execGit(repo.root, ["checkout", "main"]);
    await writeRepoFile(repo.root, "main.txt", "main\n");
    await execGit(repo.root, ["add", "main.txt"]);
    await execGit(repo.root, ["commit", "-m", "Main commit"]);
    await execGit(repo.root, ["merge", "--no-ff", "feature", "-m", "Merge feature"]);

    const result = await log.logRepo(repo.root, { limit: 10 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const merge = result.commits.find((commit) => commit.subject === "Merge feature");
      expect(merge?.isMerge).toBe(true);
      expect(merge?.changedFiles).toContainEqual({ path: "feature.txt", status: "A" });
    }
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("--diff-merges=first-parent");
  });

  it("includes files for a merge whose tree matches its first parent", async () => {
    repo = await createTempGitRepo();
    const calls: string[][] = [];
    const trackedExec: GitExecFn = async (root, args) => {
      calls.push(args);
      return execGit(root, args);
    };
    const log = createLogApi(trackedExec);

    await execGit(repo.root, ["checkout", "-b", "feature"]);
    await writeRepoFile(repo.root, "feature.txt", "feature\n");
    await execGit(repo.root, ["add", "feature.txt"]);
    await execGit(repo.root, ["commit", "-m", "Feature commit"]);
    await execGit(repo.root, ["checkout", "main"]);
    await writeRepoFile(repo.root, "main.txt", "main\n");
    await execGit(repo.root, ["add", "main.txt"]);
    await execGit(repo.root, ["commit", "-m", "Main-only commit"]);
    const { stdout: mergeSha } = await execGit(repo.root, [
      "commit-tree",
      "HEAD^{tree}",
      "-p",
      "HEAD",
      "-p",
      "feature",
      "-m",
      "Merge equivalent feature",
    ]);
    await execGit(repo.root, ["reset", "--hard", mergeSha.trim()]);

    const result = await log.logRepo(repo.root, { limit: 10 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const matches = result.commits.filter(
        (commit) => commit.subject === "Merge equivalent feature",
      );
      expect(matches).toHaveLength(1);
      expect(matches[0]?.changedFiles).toEqual([]);

      const detail = await log.showCommit(repo.root, matches[0]!.sha);
      expect(detail.ok).toBe(true);
      if (detail.ok) {
        expect(detail.commit.changedFiles).toContainEqual({ path: "main.txt", status: "A" });
      }
    }
    const logCalls = calls.filter((args) => args[0] === "log");
    expect(logCalls).toHaveLength(1);
    expect(logCalls[0]).toContain("--diff-merges=first-parent");
  });
});
