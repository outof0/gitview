import {
  PROTOCOL_VERSION,
  isGitPanelSurface,
  type GitPanelSurface,
} from "@gitview/shared/protocol";
import type { BlameSnapshot } from "@gitview/shared/types/blame";
import type {
  BranchCompareSnapshot,
  BranchListSnapshot,
} from "@gitview/shared/types/branch";
import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import type { LogSnapshot } from "@gitview/shared/types/log";
import type { RepositorySnapshot } from "@gitview/shared/types/repository";
import type { ShelfListSnapshot } from "@gitview/shared/types/shelf";
import type { StashListSnapshot } from "@gitview/shared/types/stash";
import type { StatusSnapshot } from "@gitview/shared/types/status";
import type { TagListSnapshot } from "@gitview/shared/types/tag";
import type { WorktreeListSnapshot } from "@gitview/shared/types/worktree";
import type { ReviewDetailsSnapshot, ReviewListSnapshot } from "@gitview/shared/types/review";
import type { GitWorkspaceSettings } from "@gitview/shared/types/gitWorkspaceSettings";

export function isRepoSnapshot(value: unknown): value is { type: "repo.snapshot"; payload: RepositorySnapshot } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "repo.snapshot" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
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

export function isBlameSnapshot(value: unknown): value is { type: "blame.snapshot"; payload: BlameSnapshot } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "blame.snapshot" &&
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

export function isDestructiveRollbackError(err: unknown): string[] | null {
  if (!(err instanceof Error)) {
    return null;
  }
  if (!err.message.includes("requires confirmation")) {
    return null;
  }
  const match = err.message.match(/paths['":\s]+\[([^\]]+)\]/i);
  if (match?.[1]) {
    return match[1].split(",").map((p) => p.trim().replace(/^['"]|['"]$/g, ""));
  }
  return [];
}

export function isOpenDialogRequest(
  value: unknown,
): value is {
  type: "git.openDialog";
  payload: { dialog: GitPanelSurface; relativePath?: string };
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "git.openDialog" &&
    (value as { protocolVersion?: number }).protocolVersion ===
      PROTOCOL_VERSION &&
    isGitPanelSurface(
      (value as { payload?: { dialog?: unknown } }).payload?.dialog,
    )
  );
}
