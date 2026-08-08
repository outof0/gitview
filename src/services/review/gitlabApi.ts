import { formatProviderApiError } from "./apiError";
import { encodeGitlabProjectPath, type GitlabRepoCoordinates } from "./gitlabRemote";
import { fetchWithTimeout, type ReviewFetch } from "./reviewFetch";
import { createGitlabReadApi } from "./gitlabApiRead";
import { createGitlabWriteApi } from "./gitlabApiWrite";

export type { GitlabMergeRequest } from "./gitlabApiTypes";

export function createGitlabApi(opts: {
  token: string;
  apiBaseUrl: string;
  fetchFn?: ReviewFetch;
}) {
  const fetchFn = opts.fetchFn ?? globalThis.fetch.bind(globalThis);

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchWithTimeout(fetchFn, `${opts.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "PRIVATE-TOKEN": opts.token,
        ...init?.headers,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        formatProviderApiError("GitLab", response.status, body, opts.token),
      );
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  const projectPath = (coords: GitlabRepoCoordinates): string =>
    encodeGitlabProjectPath(coords.projectPath);

  return {
    ...createGitlabReadApi(request, projectPath),
    ...createGitlabWriteApi(request, projectPath),
  };
}

export type GitlabApi = ReturnType<typeof createGitlabApi>;
