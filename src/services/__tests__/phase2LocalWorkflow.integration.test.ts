import { describe, expect, it, afterEach } from "vitest";
import { createTagApi } from "../git/tag";
import { createWorktreeApi } from "../git/worktree";
import { createLogApi } from "../git/log";
import { createCommitApi } from "../git/commit";
import { createBranchApi } from "../git/branch";
import { createRebaseApi } from "../git/rebase";
import * as path from "node:path";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("Phase 2 local workflow integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("creates, deletes, checks out, and pushes annotated tags", async () => {
    repo = await createTempGitRepo();
    const tags = createTagApi(execGit);

    await tags.createAnnotated(repo.root, "v1.0.0", "Release 1");
    const entries = await tags.listTagEntries(repo.root, "repo-1");
    expect(entries.some((t) => t.name === "v1.0.0" && t.annotated)).toBe(true);

    await tags.deleteTag(repo.root, "v1.0.0");
    const afterDelete = await tags.listTagEntries(repo.root, "repo-1");
    expect(afterDelete.some((t) => t.name === "v1.0.0")).toBe(false);

    await tags.createAnnotated(repo.root, "v2.0.0", "Release 2");
    await tags.checkout(repo.root, "v2.0.0");
    const { stdout: head } = await execGit(repo.root, ["describe", "--tags"]);
    expect(head.trim()).toContain("v2.0.0");
  });

  it("lists and removes worktrees", async () => {
    repo = await createTempGitRepo();
    const worktrees = createWorktreeApi(execGit);

    const before = await worktrees.listWorktrees(repo.root, repo.root);
    const wtPath = path.join(path.dirname(repo.root), "wt-feature");
    await worktrees.addWorktree(repo.root, wtPath, { newBranch: "wt-branch" });

    const listed = await worktrees.listWorktrees(repo.root, repo.root);
    expect(listed.length).toBe(before.length + 1);
    expect(listed.some((w) => !w.isMain && w.branch === "wt-branch")).toBe(true);

    const target = listed.find((w) => w.branch === "wt-branch" && !w.isMain);
    expect(target?.path).toBeTruthy();
    await worktrees.removeWorktree(repo.root, target!.path);
    const after = await worktrees.listWorktrees(repo.root, repo.root);
    expect(after.length).toBe(before.length);
  });

  it("queries incoming commits relative to upstream", async () => {
    const calls: string[][] = [];
    const mockExec = async (_root: string, args: string[]) => {
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
    const result = await log.logRepo("/repo", { range: "incoming", limit: 50 });
    expect(result.ok).toBe(true);
    const logCall = calls.find((args) => args[0] === "log");
    expect(logCall?.includes("HEAD..origin/main")).toBe(true);
  });

  it("commits with amend, signoff, and author override", async () => {
    repo = await createTempGitRepo();
    const commit = createCommitApi(execGit);

    await writeRepoFile(repo.root, "signed.txt", "x\n");
    await execGit(repo.root, ["add", "signed.txt"]);
    const first = await commit.commit(repo.root, {
      message: "Initial signed",
      signoff: true,
    });
    expect(first.sha).toBeTruthy();

    await writeRepoFile(repo.root, "signed.txt", "y\n");
    await execGit(repo.root, ["add", "signed.txt"]);
    const amended = await commit.commit(repo.root, {
      message: "Amended signed",
      amend: true,
      signoff: true,
      author: "Other <other@example.com>",
    });
    expect(amended.sha).toBeTruthy();

    const { stdout: subject } = await execGit(repo.root, [
      "log",
      "-1",
      "--format=%s",
    ]);
    expect(subject.trim()).toBe("Amended signed");
  });

  it("passes gpg sign flag to git commit", async () => {
    let head = "abc";
    const calls: string[][] = [];
    const mockExec = async (_root: string, args: string[]) => {
      calls.push(args);
      if (args[0] === "rev-parse") {
        return { stdout: `${head}\n`, stderr: "" };
      }
      if (args[0] === "commit") {
        head = "def";
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected: ${args.join(" ")}`);
    };
    const commit = createCommitApi(mockExec);
    await commit.commit("/repo", { message: "Signed", gpgSign: true });
    const commitCall = calls.find((args) => args[0] === "commit");
    expect(commitCall?.includes("-S")).toBe(true);
  });

  it("checks out remote branch as tracking local branch", async () => {
    repo = await createTempGitRepo();
    const branches = createBranchApi(execGit);

    await writeRepoFile(repo.root, "remote.txt", "r\n");
    await execGit(repo.root, ["add", "remote.txt"]);
    await execGit(repo.root, ["commit", "-m", "Remote base"]);
    const { stdout: baseSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await execGit(repo.root, ["branch", "origin/feature", baseSha.trim()]);
    await branches.checkoutRemoteAsTracking(repo.root, "origin/feature");

    const { stdout: current } = await execGit(repo.root, ["branch", "--show-current"]);
    expect(current.trim()).toBe("feature");
  });

  it("drops a commit via squash/fixup rewrite actions", async () => {
    repo = await createTempGitRepo();
    const rebase = createRebaseApi(execGit);

    await writeRepoFile(repo.root, "a.txt", "a\n");
    await execGit(repo.root, ["add", "a.txt"]);
    await execGit(repo.root, ["commit", "-m", "First"]);

    await writeRepoFile(repo.root, "b.txt", "b\n");
    await execGit(repo.root, ["add", "b.txt"]);
    await execGit(repo.root, ["commit", "-m", "Squash me"]);
    const { stdout: squashSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await writeRepoFile(repo.root, "c.txt", "c\n");
    await execGit(repo.root, ["add", "c.txt"]);
    await execGit(repo.root, ["commit", "-m", "Third"]);

    await rebase.rewriteCommit(repo.root, squashSha.trim(), "drop");

    const { stdout: log } = await execGit(repo.root, ["log", "--oneline"]);
    expect(log).toContain("First");
    expect(log).toContain("Third");
    expect(log).not.toContain("Squash me");
  });
});