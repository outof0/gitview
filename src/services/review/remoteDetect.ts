import type { GitExecFn } from "../git/types";

export type HostedRemoteKind = "github" | "gitlab" | null;

export function detectHostedRemote(url: string): HostedRemoteKind {
  const normalized = url.trim().toLowerCase();
  if (
    normalized.includes("github.com") ||
    normalized.startsWith("git@github:")
  ) {
    return "github";
  }
  if (
    normalized.includes("gitlab.com") ||
    normalized.startsWith("git@gitlab:")
  ) {
    return "gitlab";
  }
  return null;
}

export async function readOriginRemoteUrl(
  execGit: GitExecFn,
  repoRoot: string,
): Promise<string | null> {
  try {
    const { stdout } = await execGit(repoRoot, [
      "remote",
      "get-url",
      "origin",
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}