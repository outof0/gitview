import { secureApiBaseUrl } from "./apiBaseUrl";

export type GitlabRepoCoordinates = {
  projectPath: string;
  host: string;
};

export function parseGitlabRemoteUrl(url: string): GitlabRepoCoordinates | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  const sshMatch = trimmed.match(/^git@([^:]+):(.+?)(?:\.git)?$/i);
  if (sshMatch) {
    return {
      host: sshMatch[1]!.toLowerCase(),
      projectPath: sshMatch[2]!.replace(/\.git$/i, ""),
    };
  }

  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return null;
    }
    const projectPath = segments
      .map((segment) => segment.replace(/\.git$/i, ""))
      .join("/");
    return {
      host: parsed.host.toLowerCase(),
      projectPath,
    };
  } catch {
    return null;
  }
}

export function encodeGitlabProjectPath(projectPath: string): string {
  return encodeURIComponent(projectPath);
}

const PUBLIC_GITLAB_HOST = "gitlab.com";
const PUBLIC_GITLAB_API = "https://gitlab.com/api/v4";

/**
 * Resolve the API endpoint a stored GitLab token may be sent to, or `null` when
 * the remote host is not one we may trust with it.
 *
 * See `githubApiBaseUrl` for the reasoning; the same rule applies here because
 * GitLab sends the token in a `PRIVATE-TOKEN` header.
 */
export function gitlabApiBaseUrl(
  host: string,
  configured?: string,
): string | null {
  const normalizedHost = host.trim().toLowerCase();
  const trimmed = configured?.trim();

  if (normalizedHost === PUBLIC_GITLAB_HOST) {
    return secureApiBaseUrl({
      provider: "GitLab",
      remoteHost: normalizedHost,
      configured: trimmed,
      publicDefault: PUBLIC_GITLAB_API,
      fallback: PUBLIC_GITLAB_API,
      publicRemoteHost: PUBLIC_GITLAB_HOST,
      publicApiHost: PUBLIC_GITLAB_HOST,
    });
  }

  if (!trimmed || trimmed.replace(/\/$/, "") === PUBLIC_GITLAB_API) {
    return null;
  }

  return secureApiBaseUrl({
    provider: "GitLab",
    remoteHost: normalizedHost,
    configured: trimmed,
    publicDefault: PUBLIC_GITLAB_API,
    fallback: PUBLIC_GITLAB_API,
    publicRemoteHost: PUBLIC_GITLAB_HOST,
    publicApiHost: PUBLIC_GITLAB_HOST,
  });
}
