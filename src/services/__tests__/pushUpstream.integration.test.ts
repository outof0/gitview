import { describe, expect, it, afterEach } from "vitest";
import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import { createSyncApi } from "../git/sync";
import { hasUpstream, resolveDefaultRemote } from "../git/upstream";
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
  return bareRoot;
}

describe("push upstream integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    if (repo) {
      await fs.rm(path.dirname(repo.root), { recursive: true, force: true });
      repo = null;
    }
  });

  it("detects missing upstream before push", async () => {
    repo = await createTempGitRepo();
    await addBareRemote(repo);

    expect(await hasUpstream(execGit, repo.root)).toBe(false);
    expect(await resolveDefaultRemote(execGit, repo.root)).toBe("origin");
  }, 15_000);

  it("sets upstream with git push -u", async () => {
    repo = await createTempGitRepo();
    await addBareRemote(repo);
    const sync = createSyncApi(execGit);

    const result = await sync.push(repo.root, {
      setUpstream: true,
      remote: "origin",
      branch: "main",
    });
    expect(result.rejected).toBe(false);
    expect(await hasUpstream(execGit, repo.root)).toBe(true);
  }, 15_000);
});