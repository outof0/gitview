export type GithubRepoCoordinates = {
  owner: string;
  repo: string;
  host: string;
};

export function parseGithubRemoteUrl(url: string): GithubRepoCoordinates | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  const sshMatch = trimmed.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/i);
  if (sshMatch) {
    return {
      host: sshMatch[1]!.toLowerCase(),
      owner: sshMatch[2]!,
      repo: sshMatch[3]!.replace(/\.git$/i, ""),
    };
  }

  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return null;
    }
    const owner = segments[0]!;
    const repo = segments[1]!.replace(/\.git$/i, "");
    return {
      host: parsed.host.toLowerCase(),
      owner,
      repo,
    };
  } catch {
    return null;
  }
}

export function githubApiBaseUrl(host: string, configured?: string): string {
  const fallback =
    host === "github.com"
      ? "https://api.github.com"
      : `https://${host}/api/v3`;
  return secureApiBaseUrl({
    provider: "GitHub",
    remoteHost: host,
    configured,
    publicDefault: "https://api.github.com",
    fallback,
    publicRemoteHost: "github.com",
    publicApiHost: "api.github.com",
  });
}
import { secureApiBaseUrl } from "./apiBaseUrl";
