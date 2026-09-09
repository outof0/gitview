import {
  PROTOCOL_VERSION,
  isGitPanelSurface,
  type GitPanelSurface,
} from "@gitview/shared/protocol";
import type {
  BranchCompareSnapshot,
  BranchListSnapshot,
} from "@gitview/shared/types/branch";
import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import type { LogSnapshot } from "@gitview/shared/types/log";
import type { RepositorySnapshot } from "@gitview/shared/types/repository";
import { isRepositorySnapshotPayload } from "@gitview/shared/types/repositoryShell";
import type { ShelfListSnapshot } from "@gitview/shared/types/shelf";
import type { StashListSnapshot } from "@gitview/shared/types/stash";
import type { StatusSnapshot } from "@gitview/shared/types/status";
import type { TagListSnapshot } from "@gitview/shared/types/tag";
import type { WorktreeListSnapshot } from "@gitview/shared/types/worktree";
import type { ReviewDetailsSnapshot, ReviewListSnapshot } from "@gitview/shared/types/review";
import type { GitWorkspaceSettings } from "@gitview/shared/types/gitWorkspaceSettings";
import {
  isSyncOperationEvent,
  type SyncOperationEvent,
} from "@gitview/shared/types/sync";

export function isRepoSnapshot(value: unknown): value is { type: "repo.snapshot"; payload: RepositorySnapshot } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "repo.snapshot" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION &&
    isRepositorySnapshotPayload((value as { payload?: unknown }).payload)
  );
}

export function isSyncOperationMessage(
  value: unknown,
): value is { type: "sync.operation"; payload: SyncOperationEvent } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "sync.operation" &&
    (value as { protocolVersion?: number }).protocolVersion ===
      PROTOCOL_VERSION &&
    isSyncOperationEvent((value as { payload?: unknown }).payload)
  );
}

export function isStatusSnapshot(value: unknown): value is { type: "status.snapshot"; payload: StatusSnapshot } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "status.snapshot" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isGitSettings(
  value: unknown,
): value is { type: "git.settings"; payload: GitWorkspaceSettings } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "git.settings" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isOpenHistoryRequest(value: unknown): value is {
  type: "git.openHistory";
  payload: { repoId: string; path: string; isFolder: boolean; showDiff?: boolean };
} {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { type?: string }).type !== "git.openHistory" ||
    (value as { protocolVersion?: number }).protocolVersion !== PROTOCOL_VERSION
  ) {
    return false;
  }
  const payload = (value as { payload?: unknown }).payload;
  const showDiff = (payload as { showDiff?: unknown } | null)?.showDiff;
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as { repoId?: unknown }).repoId === "string" &&
    typeof (payload as { path?: unknown }).path === "string" &&
    typeof (payload as { isFolder?: unknown }).isFolder === "boolean" &&
    (showDiff === undefined || typeof showDiff === "boolean")
  );
}

export function isSelectCommitRequest(value: unknown): value is {
  type: "git.selectCommit";
  payload: { repoId: string; sha: string };
} {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { type?: string }).type !== "git.selectCommit" ||
    (value as { protocolVersion?: number }).protocolVersion !== PROTOCOL_VERSION
  ) {
    return false;
  }
  const payload = (value as { payload?: unknown }).payload;
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as { repoId?: unknown }).repoId === "string" &&
    typeof (payload as { sha?: unknown }).sha === "string"
  );
}

export function isRollbackRequest(value: unknown): value is {
  type: "git.requestRollback";
  payload: { repoId: string; path: string; selectedPaths?: string[] };
} {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { type?: string }).type !== "git.requestRollback" ||
    (value as { protocolVersion?: number }).protocolVersion !== PROTOCOL_VERSION
  ) {
    return false;
  }
  const payload = (value as { payload?: unknown }).payload;
  const selectedPaths = (payload as { selectedPaths?: unknown } | null)
    ?.selectedPaths;
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as { repoId?: unknown }).repoId === "string" &&
    (payload as { repoId: string }).repoId.length > 0 &&
    typeof (payload as { path?: unknown }).path === "string" &&
    (payload as { path: string }).path.length > 0 &&
    (selectedPaths === undefined ||
      (Array.isArray(selectedPaths) &&
        selectedPaths.every((path) => typeof path === "string" && path.length > 0)))
  );
}

export function isFocusRootRequest(value: unknown): value is {
  type: "git.focusRoot";
  payload: Record<string, never>;
} {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { type?: string }).type !== "git.focusRoot" ||
    (value as { protocolVersion?: number }).protocolVersion !== PROTOCOL_VERSION
  ) {
    return false;
  }
  const payload = (value as { payload?: unknown }).payload;
  return (
    typeof payload === "object" &&
    payload !== null &&
    !Array.isArray(payload) &&
    Object.keys(payload).length === 0
  );
}

export function isBranchCompareSnapshot(
  value: unknown,
): value is { type: "branch.compare.snapshot"; payload: BranchCompareSnapshot } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "branch.compare.snapshot" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isBranchSnapshot(value: unknown): value is { type: "branch.snapshot"; payload: BranchListSnapshot } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "branch.snapshot" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isLogSnapshot(value: unknown): value is { type: "log.snapshot"; payload: LogSnapshot } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "log.snapshot" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isNotification(
  value: unknown,
): value is {
  type: "notification";
  payload: { level: "info" | "warning" | "error"; message: string };
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "notification" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isReviewSnapshot(
  value: unknown,
): value is { type: "review.snapshot"; payload: ReviewListSnapshot } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "review.snapshot" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isReviewDetails(
  value: unknown,
): value is { type: "review.details"; payload: ReviewDetailsSnapshot } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "review.details" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isStashSnapshot(value: unknown): value is { type: "stash.snapshot"; payload: StashListSnapshot } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "stash.snapshot" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isShelfSnapshot(value: unknown): value is { type: "shelf.snapshot"; payload: ShelfListSnapshot } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "shelf.snapshot" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isTagSnapshot(value: unknown): value is { type: "tag.snapshot"; payload: TagListSnapshot } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "tag.snapshot" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isWorktreeSnapshot(
  value: unknown,
): value is { type: "worktree.snapshot"; payload: WorktreeListSnapshot } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "worktree.snapshot" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isDiffResult(value: unknown): value is { type: "diff.result"; payload: WorkspaceDiffDocument } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "diff.result" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isOpenDialogRequest(
  value: unknown,
): value is {
  type: "git.openDialog";
  payload: {
    dialog: GitPanelSurface;
    relativePath?: string;
    index?: number | null;
    repoId?: string;
  };
} {
  if (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "git.openDialog" &&
    (value as { protocolVersion?: number }).protocolVersion ===
      PROTOCOL_VERSION &&
    isGitPanelSurface(
      (value as { payload?: { dialog?: unknown } }).payload?.dialog,
    )
  ) {
    const payload = (value as { payload?: Record<string, unknown> }).payload;
    const index = payload?.index;
    const repoId = payload?.repoId;
    return (
      (index === undefined ||
        index === null ||
        (typeof index === "number" && Number.isInteger(index) && index >= 0)) &&
      (repoId === undefined || (typeof repoId === "string" && repoId.length > 0))
    );
  }
  return false;
}
