import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";

/**
 * A captured repository selection: id plus the monotonic selection epoch.
 *
 * Comparing bare repository ids suffers ABA: after A→B→A, `isRepoActive("A")`
 * is true again and a stale completion from the first A era would pass the
 * guard. Tokens also capture the epoch at request time, so only completions
 * from the current selection era apply.
 */
export type RepoToken = {
  repoId: string;
  epoch: number;
};

/** Capture the current selection era for a repository a request targets. */
export function captureRepoToken(repoId: string): RepoToken {
  return {
    repoId,
    epoch: useGitWorkspaceStore.getState().repoEpoch,
  };
}

/**
 * True while the token's selection era is still current: same repository
 * active AND no repository switch (in either direction) happened since.
 *
 * Async completions capture their token up front and must check this before
 * mutating draft, dialog, notification, or error state. Data refreshes
 * (loaders) are exempt — they self-scope to the current repo.
 */
export function isRepoTokenCurrent(token: RepoToken): boolean {
  const state = useGitWorkspaceStore.getState();
  return (
    state.repoSnapshot?.activeRepoId === token.repoId &&
    state.repoEpoch === token.epoch
  );
}
