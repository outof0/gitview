import type { GitExecFn } from "../git/types";

export type HostedRemoteKind = "github" | "gitlab" | null;

/**
 * The hostname a remote URL actually connects to.
 *
 * Reading the provider out of the raw string with `includes()` was the bug: it
 * matched `github.com` inside `https://evil.example/github.com/app.git` (a
 * path segment), inside `https://github.com@evil.example/app.git` (userinfo),
 * and accepted `github.com.attacker.invalid` as GitHub. All three then received
 * the stored token as `Authorization: Bearer`. URL parsing collapses them.
 */
export function remoteHostname(url: string): string | null {
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  // scp-like SSH has no scheme, so `new URL` cannot parse it.
  const sshMatch = trimmed.match(/^[\w.+-]+@([^:/]+):/);
  if (sshMatch?.[1]) {
    return sshMatch[1];
  }
  try {
    // Drops userinfo, ignores the path, and lowercases the host.
    return new URL(trimmed).hostname || null;
  } catch {
    return null;
  }
}

export function detectHostedRemote(url: string): HostedRemoteKind {
  const host = remoteHostname(url);
  if (host === "github.com") {
    return "github";
  }
  if (host === "gitlab.com") {
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
