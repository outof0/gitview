import type { GitExecFn } from "../git/types";
import type { Logger } from "../../observability/logger";
import type { ReviewProviderInfo } from "../../shared/types/review";
import type { ReviewFetch } from "./reviewFetch";

/**
 * Everything a provider implementation needs from the host. This lives here
 * rather than in `githubProvider.ts` so that `providerRegistry.ts` — which can
 * host arbitrary providers — does not import its context type from one
 * concrete provider's module.
 */
export type ReviewProviderContext = {
  execGit: GitExecFn;
  logger?: Logger;
  getAccessToken?: (providerId: string) => Promise<string | null>;
  getGithubApiBaseUrl?: () => string;
  getGitlabApiBaseUrl?: () => string;
  fetchFn?: ReviewFetch;
};

/** What resolving a provider yields: coordinates always, API only with a token. */
export type ResolvedReviewApi<TCoords, TApi> = {
  coords: TCoords;
  api: TApi | null;
  token: string | null;
};

/**
 * Unwrap a resolved provider or fail. Every mutation entry point in both
 * providers used to open with the same four-line guard differing only in the
 * provider name; sixteen hand-written copies is sixteen places to forget one.
 */
export function requireReviewApi<TCoords, TApi>(
  resolved: ResolvedReviewApi<TCoords, TApi> | null | undefined,
  spec: ReviewProviderSpec,
): { coords: TCoords; api: TApi } {
  if (!resolved?.api || !resolved.coords) {
    throw new Error(`${spec.displayName} provider is not authenticated.`);
  }
  return { coords: resolved.coords, api: resolved.api };
}

export type ReviewProviderSpec = {
  id: string;
  displayName: string;
  noRemoteReason: string;
  tokenHintReason: string;
};

/** The three-way availability verdict, identical for every provider. */
export function describeReviewProvider(
  resolved: { api: unknown; token: string | null } | null,
  spec: ReviewProviderSpec,
): ReviewProviderInfo {
  if (!resolved) {
    return {
      id: spec.id,
      displayName: spec.displayName,
      available: false,
      authRequired: false,
      unavailableReason: spec.noRemoteReason,
    };
  }
  if (!resolved.token || !resolved.api) {
    return {
      id: spec.id,
      displayName: spec.displayName,
      available: true,
      authRequired: true,
      unavailableReason: spec.tokenHintReason,
    };
  }
  return {
    id: spec.id,
    displayName: spec.displayName,
    available: true,
    authRequired: false,
  };
}
