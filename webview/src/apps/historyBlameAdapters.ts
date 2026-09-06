import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import type { LogSnapshot } from "@gitview/shared/types/log";
import type { CommitDetailResult } from "@gitview/shared/types/history";
import type { FileDiffView } from "@gitview/types";
import { useGitHistoryStore } from "../stores/gitHistoryStore";

export function logSnapshotToStorePayload(snapshot: LogSnapshot): {
  path?: string;
  branch?: string;
  commits: LogSnapshot["commits"];
} {
  return {
    path: snapshot.filters?.path,
    branch: snapshot.branch ?? snapshot.filters?.branch,
    commits: snapshot.commits,
  };
}

export function workspaceDiffToFileDiffView(
  document: WorkspaceDiffDocument,
): FileDiffView {
  return {
    layout: document.layout,
    status: document.status,
    left: document.left,
    right: document.right,
    binary: document.binary,
  };
}
export type CommitDetailClient = {
  commitDetail: (repoId: string, sha: string) => Promise<CommitDetailResult>;
};

/**
 * Load full commit detail for a user selection, ignoring stale completions.
 *
 * Selecting A then B fires two overlapping requests. Without the guard, A's
 * late response would reassign the selection to A via applyCommitDetail.
 * Failures follow the same rule: a timed-out request for a deselected commit
 * must neither raise an error nor stick loading on. Every selection issues
 * exactly one request, so the current selection always settles its own
 * loading state.
 */
export function requestCommitDetail(
  client: CommitDetailClient,
  repoId: string,
  sha: string,
): void {
  void client
    .commitDetail(repoId, sha)
    .then((payload) => {
      const store = useGitHistoryStore.getState();
      if (store.selectedSha !== sha) {
        return;
      }
      if (payload.error) {
        store.setCommitDetailError(payload.error.message);
      } else if (payload.commit) {
        store.applyCommitDetail(payload.commit);
      }
    })
    .catch((err: unknown) => {
      const store = useGitHistoryStore.getState();
      if (store.selectedSha !== sha) {
        return;
      }
      store.setCommitDetailError(
        err instanceof Error ? err.message : "Could not load commit",
      );
    });
}
