import type { GitExecFn } from "./types";

export async function hasUpstream(
  execGit: GitExecFn,
  repoRoot: string,
): Promise<boolean> {
  try {
    await execGit(repoRoot, ["rev-parse", "--abbrev-ref", "@{u}"]);
    return true;
  } catch {
    return false;
  }
}

export async function listRemotes(
  execGit: GitExecFn,
  repoRoot: string,
): Promise<string[]> {
  try {
    const { stdout } = await execGit(repoRoot, ["remote"]);
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function resolveDefaultRemote(
  execGit: GitExecFn,
  repoRoot: string,
): Promise<string | null> {
  const remotes = await listRemotes(execGit, repoRoot);
  if (remotes.length === 0) {
    return null;
  }

  try {
    const { stdout } = await execGit(repoRoot, [
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{u}",
    ]);
    const upstream = stdout.trim();
    const remote = [...remotes]
      .sort((left, right) => right.length - left.length)
      .find((candidate) => upstream.startsWith(`${candidate}/`));
    if (remote) {
      return remote;
    }
  } catch {
    // no upstream
  }
  return remotes[0] ?? null;
}