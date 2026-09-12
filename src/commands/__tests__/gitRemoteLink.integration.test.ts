import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { buildRemoteLink } from "../../core/remoteLink";
import { createDefaultExecGit } from "../../services/git/exec";
import { resolveRemoteLinkContext } from "../../services/git/remoteLink";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

describe("gitRemoteLink host integration", () => {
  let tempParent = "";

  afterEach(async () => {
    if (tempParent) {
      await fs.rm(tempParent, { recursive: true, force: true });
      tempParent = "";
    }
  });

  async function initRepoWithGithubOrigin(): Promise<string> {
    tempParent = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitview-remote-link-"),
    );
    const repoRoot = path.join(tempParent, "repo");
    await fs.mkdir(repoRoot);
    await git(repoRoot, ["init", "-b", "main"]);
    await git(repoRoot, ["config", "user.email", "gitview@test.com"]);
    await git(repoRoot, ["config", "user.name", "GitView Test"]);
    await fs.writeFile(path.join(repoRoot, "file.txt"), "hello\n", "utf8");
    await git(repoRoot, ["add", "file.txt"]);
    await git(repoRoot, ["commit", "-m", "initial"]);
    await git(repoRoot, [
      "remote",
      "add",
      "origin",
      "https://github.com/test-owner/test-repo.git",
    ]);
    return repoRoot;
  }

  it("gitOpenOnRemote refuses a path ref while HEAD and its branch are local-only", async () => {
    const repoRoot = await initRepoWithGithubOrigin();
    const execGit = createDefaultExecGit();
    const context = await resolveRemoteLinkContext(
      execGit,
      repoRoot,
      "origin",
      "auto",
    );
    expect(context?.ref).toBeNull();
  });

  it("gitCopyRemoteLink pins the sha once HEAD reaches the remote", async () => {
    const repoRoot = await initRepoWithGithubOrigin();
    const sha = await git(repoRoot, ["rev-parse", "HEAD"]);
    await git(repoRoot, ["update-ref", "refs/remotes/origin/main", sha]);
    const execGit = createDefaultExecGit();
    const context = await resolveRemoteLinkContext(
      execGit,
      repoRoot,
      "origin",
      "auto",
    );
    expect(context?.ref).toEqual({ type: "commit", sha });
    expect(
      buildRemoteLink({
        remoteUrl: context!.remoteUrl,
        target: { type: "commit", sha },
        ref: context!.ref ?? undefined,
      }),
    ).toBe(`https://github.com/test-owner/test-repo/commit/${sha}`);
  });
});
