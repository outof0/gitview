import { describe, expect, it, afterEach } from "vitest";
import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";
import { createSyncBranchOperationApi } from "../git/syncBranchOperation";
import type { Repository } from "../../shared/types/repository";
import { execGit } from "../../test/helpers/tempGitRepo";

const exec = promisify(execFile);

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

async function initRepo(root: string, name: string): Promise<Repository> {
  await fs.mkdir(root, { recursive: true });
  const run = (args: string[]) =>
    exec("git", args, { cwd: root, env: gitEnv });
  await run(["init", "-b", "main"]);
  await run(["config", "user.name", "Test"]);
  await run(["config", "user.email", "test@example.com"]);
  await fs.writeFile(path.join(root, "README.md"), `# ${name}\n`);
  await run(["add", "README.md"]);
  await run(["commit", "-m", "Initial commit"]);
  return {
    id: name,
    rootPath: root,
    workspaceFolderPath: root,
    gitDirPath: path.join(root, ".git"),
    name,
    currentBranch: "main",
    headSha: null,
    upstream: null,
    isDetached: false,
    isBare: false,
    isWorktree: false,
    operation: { type: "none" },
    ahead: null,
    behind: null,
    conflictCount: 0,
    dirty: false,
    trusted: true,
    protectedBranch: false,
    lastRefreshAt: Date.now(),
  };
}

describe("multi-root sync branch integration", () => {
  let parentDir: string | null = null;

  afterEach(async () => {
    if (parentDir) {
      await fs.rm(parentDir, { recursive: true, force: true });
      parentDir = null;
    }
  });

  it("plans matching branch availability per repository", async () => {
    parentDir = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-sync-branch-"));
    const repoA = await initRepo(path.join(parentDir, "repo-a"), "repo-a");
    const repoB = await initRepo(path.join(parentDir, "repo-b"), "repo-b");

    await execGit(repoA.rootPath, ["branch", "shared-branch"]);
    await execGit(repoB.rootPath, ["branch", "other-branch"]);

    const syncBranch = createSyncBranchOperationApi(execGit);
    const targets = await syncBranch.planTargets([repoA, repoB], "shared-branch");

    expect(targets).toHaveLength(2);
    expect(targets.find((t) => t.repoId === "repo-a")?.available).toBe(true);
    expect(targets.find((t) => t.repoId === "repo-b")?.available).toBe(false);
  }, 20_000);

  it("checks out branch in all matching repositories", async () => {
    parentDir = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-sync-branch-"));
    const repoA = await initRepo(path.join(parentDir, "repo-a"), "repo-a");
    const repoB = await initRepo(path.join(parentDir, "repo-b"), "repo-b");

    await execGit(repoA.rootPath, ["branch", "shared-branch"]);
    await execGit(repoB.rootPath, ["branch", "shared-branch"]);

    const syncBranch = createSyncBranchOperationApi(execGit);
    const results = await syncBranch.execute([repoA, repoB], "shared-branch");

    expect(results.filter((result) => result.ok)).toHaveLength(2);

    const currentA = await execGit(repoA.rootPath, ["branch", "--show-current"]);
    const currentB = await execGit(repoB.rootPath, ["branch", "--show-current"]);
    expect(currentA.stdout.trim()).toBe("shared-branch");
    expect(currentB.stdout.trim()).toBe("shared-branch");
  }, 20_000);
});