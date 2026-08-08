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

export async function resolveDefaultRemote(
  execGit: GitExecFn,
  repoRoot: string,
): Promise<string> {
  try {
    const { stdout } = await execGit(repoRoot, [
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{u}",
    ]);
    const upstream = stdout.trim();
    const slash = upstream.indexOf("/");
    if (slash > 0) {
      return upstream.slice(0, slash);
    }
  } catch {
    // no upstream
  }
  try {
    const { stdout } = await execGit(repoRoot, ["remote"]);
    const first = stdout
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean);
    return first ?? "origin";
  } catch {
    return "origin";
  }
}