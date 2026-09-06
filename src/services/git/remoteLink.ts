import type { RemoteLinkRef } from "../../core/remoteLink";
import type { GitExecFn } from "./types";

export type RemoteLinkRefMode = "auto" | "branch" | "commit";

export type RemoteLinkContext = {
  remoteUrl: string;
  /** Null when auto mode cannot prove a usable remote ref for a path link. */
  ref: RemoteLinkRef | null;
};

/** `git remote get-url <remote>`; null when the remote is not configured. */
export async function getRemoteUrl(
  execGit: GitExecFn,
  repoRoot: string,
  remote: string,
): Promise<string | null> {
  try {
    const { stdout } = await execGit(repoRoot, ["remote", "get-url", remote]);
    const url = stdout.trim();
    return url ? url : null;
  } catch {
    return null;
  }
}

/** Full HEAD SHA; null for an unborn HEAD. */
export async function getHeadSha(
  execGit: GitExecFn,
  repoRoot: string,
): Promise<string | null> {
  try {
    const { stdout } = await execGit(repoRoot, ["rev-parse", "HEAD"]);
    const sha = stdout.trim();
    return /^[0-9a-f]{40}$/i.test(sha) ? sha : null;
  } catch {
    return null;
  }
}

/** Current branch name; null on a detached HEAD. */
export async function getCurrentBranch(
  execGit: GitExecFn,
  repoRoot: string,
): Promise<string | null> {
  try {
    const { stdout } = await execGit(repoRoot, ["branch", "--show-current"]);
    const branch = stdout.trim();
    return branch ? branch : null;
  } catch {
    return null;
  }
}

/**
 * True when the SHA is reachable from the selected remote.
 *
 * Reachability must be scoped to the remote the link is built for: testing
 * every remote-tracking branch lets a commit pushed only to `upstream` count
 * as pushed on `origin`, producing an `origin` commit URL that 404s.
 */
export async function isShaOnRemote(
  execGit: GitExecFn,
  repoRoot: string,
  sha: string,
  remote: string,
): Promise<boolean> {
  try {
    const { stdout } = await execGit(repoRoot, [
      "branch",
      "-r",
      "--contains",
      sha,
      "--format=%(refname)",
    ]);
    const prefix = `refs/remotes/${remote}/`;
    return stdout
      .split("\n")
      .some((line) => line.trim().startsWith(prefix));
  } catch {
    return false;
  }
}

/** True when the selected remote has an exact remote-tracking branch ref. */
export async function isBranchOnRemote(
  execGit: GitExecFn,
  repoRoot: string,
  branch: string,
  remote: string,
): Promise<boolean> {
  try {
    const { stdout } = await execGit(repoRoot, [
      "for-each-ref",
      "--format=%(refname)",
      `refs/remotes/${remote}`,
    ]);
    const expected = `refs/remotes/${remote}/${branch}`;
    return stdout.split("\n").some((line) => line.trim() === expected);
  } catch {
    return false;
  }
}

/**
 * Resolve the remote URL plus the ref a link should pin to.
 *
 * `auto` links the commit SHA when it is already pushed, then a current branch
 * that exists on the selected remote. It returns a null ref when neither can
 * produce a usable path URL. `branch` and `commit` force either side (falling
 * back to whichever exists).
 */
export async function resolveRemoteLinkContext(
  execGit: GitExecFn,
  repoRoot: string,
  remote: string,
  mode: RemoteLinkRefMode,
): Promise<RemoteLinkContext | null> {
  const remoteUrl = await getRemoteUrl(execGit, repoRoot, remote);
  if (!remoteUrl) {
    return null;
  }
  const sha = await getHeadSha(execGit, repoRoot);
  const branch = await getCurrentBranch(execGit, repoRoot);
  if (!sha && !branch) {
    return null;
  }

  if (mode === "commit") {
    if (sha) {
      return { remoteUrl, ref: { type: "commit", sha } };
    }
    if (branch) {
      return { remoteUrl, ref: { type: "branch", name: branch } };
    }
    return null;
  }

  if (mode === "branch") {
    if (branch) {
      return { remoteUrl, ref: { type: "branch", name: branch } };
    }
    if (sha) {
      return { remoteUrl, ref: { type: "commit", sha } };
    }
    return null;
  }

  if (sha && (await isShaOnRemote(execGit, repoRoot, sha, remote))) {
    return { remoteUrl, ref: { type: "commit", sha } };
  }
  if (branch && (await isBranchOnRemote(execGit, repoRoot, branch, remote))) {
    return { remoteUrl, ref: { type: "branch", name: branch } };
  }
  return { remoteUrl, ref: null };
}
