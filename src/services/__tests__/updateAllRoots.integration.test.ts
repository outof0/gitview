import { describe, expect, it, afterEach } from "vitest";
import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import { createSyncApi } from "../git/sync";
import {
  createTempGitRepo,
  execGit,
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

describe("update all roots integration", () => {
  let repoA: TempGitRepo | null = null;
  let repoB: TempGitRepo | null = null;

  afterEach(async () => {
    if (repoA) {
      await fs.rm(path.dirname(repoA.root), { recursive: true, force: true });
      repoA = null;
    }
    if (repoB) {
      await fs.rm(path.dirname(repoB.root), { recursive: true, force: true });
      repoB = null;
    }
  });

  it("reports per-root success and failure", async () => {
    repoA = await createTempGitRepo();
    repoB = await createTempGitRepo();
    await addBareRemote(repoA);
    await addBareRemote(repoB);

    const sync = createSyncApi(execGit);
    const results = await sync.updateAllRoots(
      [
        { id: "a", name: "repo-a", rootPath: repoA.root },
        { id: "b", name: "repo-b", rootPath: repoB.root },
      ],
      "merge",
    );

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.ok)).toBe(true);
  }, 20_000);

  it("continues updating remaining roots when one root fails", async () => {
    repoA = await createTempGitRepo();
    await addBareRemote(repoA);

    const sync = createSyncApi(execGit);
    const results = await sync.updateAllRoots(
      [
        { id: "a", name: "repo-a", rootPath: repoA.root },
        { id: "missing", name: "missing", rootPath: "/does-not-exist/repo" },
      ],
      "merge",
    );

    expect(results).toHaveLength(2);
    expect(results[0]?.ok).toBe(true);
    expect(results[1]?.ok).toBe(false);
    expect(results[1]?.error).toBeTruthy();
  }, 20_000);
});