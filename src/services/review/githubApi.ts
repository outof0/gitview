import { formatProviderApiError } from "./apiError";
import type { GithubFetch } from "./githubApiTypes";
import { createGithubReadApi } from "./githubApiRead";
import { createGithubWriteApi } from "./githubApiWrite";
import { fetchWithTimeout } from "./reviewFetch";

export type { GithubFetch } from "./githubApiTypes";
export type { GithubPullRequest } from "./githubApiTypes";

export function createGithubApi(opts: {
  token: string;
  apiBaseUrl: string;
  fetchFn?: GithubFetch;
}) {
  const fetchFn = opts.fetchFn ?? globalThis.fetch.bind(globalThis);

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchWithTimeout(fetchFn, `${opts.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${opts.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...init?.headers,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        formatProviderApiError("GitHub", response.status, body, opts.token),
      );
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  return {
    ...createGithubReadApi(request),
    ...createGithubWriteApi(request),
  };
}

export type GithubApi = ReturnType<typeof createGithubApi>;
