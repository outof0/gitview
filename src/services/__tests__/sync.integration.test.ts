import { describe, expect, it, afterEach } from "vitest";
import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import { createSyncApi } from "../git/sync";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

const exec = promisify(execFile);

const gitEnv = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_ASKPASS: "echo",
};

async function addBareRemote(repo: TempGitRepo): Promise<string> {
  const bareRoot = path.join(path.dirname(repo.root), "remote.git");
  await exec("git", ["init", "--bare", "-b", "main", bareRoot], { env: gitEnv });
  await exec("git", ["remote", "add", "origin", bareRoot], {
    cwd: repo.root,
    env: gitEnv,
  });
  await exec("git", ["push", "-u", "origin", "main"], {
    cwd: repo.root,
    env: gitEnv,
  });
  return bareRoot;
}

describe("sync integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    if (repo) {
      await fs.rm(path.dirname(repo.root), { recursive: true, force: true });
      repo = null;
    }
  });

  it("fetch does not modify local working tree files", async () => {
    repo = await createTempGitRepo();
    const sync = createSyncApi(execGit);
    await addBareRemote(repo);

    await writeRepoFile(repo.root, "local-only.ts", "local\n");
    await sync.fetch(repo.root);

    const { stdout } = await execGit(repo.root, ["status", "--porcelain"]);
    expect(stdout).toContain("local-only.ts");
  }, 15_000);

  it("reports rejected push when remote is ahead", async () => {
    repo = await createTempGitRepo();
    const sync = createSyncApi(execGit);
    const bareRoot = await addBareRemote(repo);

    const cloneDir = path.join(path.dirname(repo.root), "clone");
    await exec("git", ["clone", bareRoot, cloneDir], { env: gitEnv });
    await exec("git", ["config", "user.email", "r@example.com"], {
      cwd: cloneDir,
      env: gitEnv,
    });
    await exec("git", ["config", "user.name", "Remote"], {
      cwd: cloneDir,
      env: gitEnv,
    });
    await exec("git", ["commit", "--allow-empty", "-m", "remote ahead"], {
      cwd: cloneDir,
      env: gitEnv,
    });
    await exec("git", ["push", "origin", "main"], { cwd: cloneDir, env: gitEnv });

    await writeRepoFile(repo.root, "ahead-local.ts", "x\n");
    await execGit(repo.root, ["add", "ahead-local.ts"]);
    await execGit(repo.root, ["commit", "-m", "local commit"]);

    const result = await sync.push(repo.root);
    expect(result.rejected).toBe(true);
  }, 15_000);

  it("pulls with rebase strategy", async () => {
    repo = await createTempGitRepo();
    const sync = createSyncApi(execGit);
    const bareRoot = await addBareRemote(repo);

    const cloneDir = path.join(path.dirname(repo.root), "clone-rebase");
    await exec("git", ["clone", bareRoot, cloneDir], { env: gitEnv });
    await exec("git", ["config", "user.email", "r@example.com"], {
      cwd: cloneDir,
      env: gitEnv,
    });
    await exec("git", ["config", "user.name", "Remote"], {
      cwd: cloneDir,
      env: gitEnv,
    });
    await writeRepoFile(cloneDir, "remote.txt", "remote\n");
    await exec("git", ["add", "remote.txt"], { cwd: cloneDir, env: gitEnv });
    await exec("git", ["commit", "-m", "remote change"], {
      cwd: cloneDir,
      env: gitEnv,
    });
    await exec("git", ["push", "origin", "main"], { cwd: cloneDir, env: gitEnv });

    await writeRepoFile(repo.root, "local.txt", "local\n");
    await execGit(repo.root, ["add", "local.txt"]);
    await execGit(repo.root, ["commit", "-m", "local divergence"]);

    await sync.pull(repo.root, "rebase");

    const { stdout: log } = await execGit(repo.root, ["log", "--oneline"]);
    expect(log).toContain("local divergence");
    expect(log).toContain("remote change");
    const content = await fs.readFile(`${repo.root}/remote.txt`, "utf8");
    expect(content).toBe("remote\n");
  }, 20_000);
});