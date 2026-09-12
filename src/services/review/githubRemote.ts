import { secureApiBaseUrl } from "./apiBaseUrl";

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
      host: parsed.hostname.toLowerCase(),
      owner,
      repo,
    };
  } catch {
    return null;
  }
}

const PUBLIC_GITHUB_HOST = "github.com";
const PUBLIC_GITHUB_API = "https://api.github.com";

/**
 * Resolve the API endpoint a stored GitHub token may be sent to, or `null` when
 * the remote host is not one we may trust with it.
 *
 * Only `github.com` gets an endpoint without configuration. Any other host
 * (GitHub Enterprise) must be paired with an API base the user set explicitly,
 * and never with the public default — that value is what the setting returns
 * when nobody configured anything, so treating it as "configured" would hand an
 * unrecognised host the token.
 *
 * Deriving `https://<host>/api/v3` from the remote alone is what leaked: the
 * remote URL is repository data, so whoever controls the remote chooses where
 * the token goes.
 */
export function githubApiBaseUrl(
  host: string,
  configured?: string,
): string | null {
  const normalizedHost = host.trim().toLowerCase();
  const trimmed = configured?.trim();

  if (normalizedHost === PUBLIC_GITHUB_HOST) {
    return secureApiBaseUrl({
      provider: "GitHub",
      remoteHost: normalizedHost,
      configured: trimmed,
      publicDefault: PUBLIC_GITHUB_API,
      fallback: PUBLIC_GITHUB_API,
      publicRemoteHost: PUBLIC_GITHUB_HOST,
      publicApiHost: "api.github.com",
    });
  }

  if (!trimmed || trimmed.replace(/\/$/, "") === PUBLIC_GITHUB_API) {
    return null;
  }

  return secureApiBaseUrl({
    provider: "GitHub",
    remoteHost: normalizedHost,
    configured: trimmed,
    publicDefault: PUBLIC_GITHUB_API,
    fallback: PUBLIC_GITHUB_API,
    publicRemoteHost: PUBLIC_GITHUB_HOST,
    publicApiHost: "api.github.com",
  });
}
