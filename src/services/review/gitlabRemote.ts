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

export function gitlabApiBaseUrl(host: string, configured?: string): string {
  const fallback =
    host === "gitlab.com"
      ? "https://gitlab.com/api/v4"
      : `https://${host}/api/v4`;
  return secureApiBaseUrl({
    provider: "GitLab",
    remoteHost: host,
    configured,
    publicDefault: "https://gitlab.com/api/v4",
    fallback,
    publicRemoteHost: "gitlab.com",
    publicApiHost: "gitlab.com",
  });
}
import { secureApiBaseUrl } from "./apiBaseUrl";
