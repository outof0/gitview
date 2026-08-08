import type { MutableRefObject } from "react";
import type { BranchEntry } from "@gitview/shared/types/branch";
import type { DiffLineSelection } from "@gitview/shared/types/diff";
import type { ResetMode } from "@gitview/shared/types/log";
import type { Repository } from "@gitview/shared/types/repository";
import type { ProtocolClient } from "../../protocol/client";
import type {
  GitWorkspaceActions,
  GitWorkspaceState,
} from "../../stores/gitWorkspaceStoreTypes";

/**
 * The contract every Git Workspace component sees. Each hook below annotates
 * its return with the matching segment, so adding a local helper to a hook no
 * longer silently widens what the whole panel may reach for.
 */

export type GitWorkspaceCoreApi = {
  postMessage: (msg: unknown) => void;
  clientRef: MutableRefObject<ProtocolClient>;
  refreshing: boolean;
  syncing: boolean;
  setSyncing: (syncing: boolean) => void;
  reviewSelectedCommitSha: string | null;
  setReviewSelectedCommitSha: (sha: string | null) => void;
  activeRepo: Repository | null;
  /** Runs `fn` with the busy flag set and routes failures to the store error. */
  runMutation: (fn: () => Promise<unknown>) => Promise<void>;
  refresh: () => Promise<void>;
};

export type GitWorkspaceLoaderApi = {
  loadBranches: () => Promise<void>;
  openBranches: () => void;
  loadDiff: (path: string, staged?: boolean) => Promise<void>;
  loadBlame: () => Promise<void>;
  loadLog: () => Promise<void>;
  loadLogFileDiff: (sha: string, path: string, status: string) => Promise<void>;
  handleSelectFile: (path: string) => void;
};

export type GitWorkspaceCommitLogApi = {
  commit: (pushAfter: boolean, confirmedChecks?: boolean) => Promise<void>;
  handleRewriteHistory: (
    sha: string,
    action: "squash" | "fixup" | "drop",
    confirmed?: boolean,
  ) => Promise<void>;
  handleDropSelected: (
    sha: string,
    path: string,
    selection: { hunkIndexes?: number[]; lines?: DiffLineSelection[] },
    confirmed?: boolean,
  ) => Promise<void>;
  handleDeleteBranch: (name: string, force?: boolean) => Promise<void>;
  handleReset: (sha: string, mode: ResetMode, confirmed?: boolean) => Promise<void>;
};

export type GitWorkspaceBranchApi = {
  handleShowBranchInLog: (branch: BranchEntry) => void;
  handleCompareWithCurrent: (branch: BranchEntry) => void;
  handleCompareWithWorkingTree: (branch: BranchEntry) => void;
  handleBranchCompareFile: (path: string) => void;
};

export type GitWorkspaceSyncApi = {
  handlePush: () => Promise<void>;
  usesSyncBranchCheckout: () => boolean;
  handleBranchCheckout: (
    ref: string,
    opts?: { smart?: boolean; force?: boolean },
    confirmed?: boolean,
  ) => Promise<void>;
  confirmPushUpstream: () => Promise<void>;
  handleUpdateAllRoots: () => Promise<void>;
  loadReviews: () => Promise<void>;
  handleApplyNonConflicting: () => void;
};

export type GitWorkspaceAuxApi = {
  loadStashes: () => Promise<void>;
  loadShelves: () => Promise<void>;
  loadTags: () => Promise<void>;
  loadWorktrees: () => Promise<void>;
  handleRemoveWorktree: (
    path: string,
    force?: boolean,
    confirmed?: boolean,
  ) => Promise<void>;
  handleCopyHash: (sha: string) => Promise<void>;
  handleRollback: (paths: string[], confirmed?: boolean) => Promise<void>;
};

export type GitWorkspaceController = GitWorkspaceState &
  GitWorkspaceActions &
  GitWorkspaceCoreApi &
  GitWorkspaceLoaderApi &
  GitWorkspaceCommitLogApi &
  GitWorkspaceBranchApi &
  GitWorkspaceSyncApi &
  GitWorkspaceAuxApi;
