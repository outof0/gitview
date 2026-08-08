import type { ProtectionService } from "../../services/protectionService";
import { createDiffApi } from "../../services/git/diff";
import { createBranchApi } from "../../services/git/branch";
import { createHistoryApi, type ResetMode } from "../../services/git/history";
import { createLogApi } from "../../services/git/log";
import { createMergeApi } from "../../services/git/merge";
import { createRebaseApi } from "../../services/git/rebase";
import { createSelectedChangesApi } from "../../services/git/selectedChanges";
import { createExtractChangesApi } from "../../services/git/extractChanges";
import type { DiffLineSelection } from "../../shared/types/diff";
import type { HostToWebview } from "../../shared/protocol";
import type { LogQueryFilters, LogSnapshot } from "../../shared/types/log";
import type { WorkspaceDiffDocument } from "../../shared/types/diff";
import type { RepositoryService } from "../../services/repositoryService";
import type { RefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";

export { gitCommandError } from "../../util/safeLog";

export type LogHandlerDeps = {
  execGit: GitExecFn;
  repositoryService: RepositoryService;
  protectionService: ProtectionService;
  refreshCoordinator: RefreshCoordinator;
  trusted: boolean;
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  postMessage: (message: HostToWebview) => void;
  /** When true (default), destructive history ops require a confirmed flag. */
  getConfirmDestructiveActions?: () => boolean;
};

/** Default true when unset — matches package.json default. */
export function confirmDestructiveEnabled(deps: LogHandlerDeps): boolean {
  return deps.getConfirmDestructiveActions?.() !== false;
}

export function toLogSnapshot(
  repoId: string,
  branch: string | null,
  commits: LogSnapshot["commits"],
  filters?: LogQueryFilters,
): LogSnapshot {
  return {
    repoId,
    branch,
    commits,
    refreshedAt: Date.now(),
    filters,
  };
}

export function mapDiffStatus(
  status: string,
): WorkspaceDiffDocument["status"] {
  if (status === "A" || status === "D" || status === "R" || status === "U") {
    return status;
  }
  return "M";
}

export function commitDiffToWorkspaceDocument(
  repoId: string,
  filePath: string,
  diff: {
    layout: "single" | "split";
    status: string;
    left: WorkspaceDiffDocument["left"];
    right: WorkspaceDiffDocument["right"];
    binary?: boolean;
  },
): WorkspaceDiffDocument {
  return {
    repoId,
    filePath,
    layout: diff.layout,
    status: mapDiffStatus(diff.status),
    left: diff.left,
    right: diff.right,
    binary: Boolean(diff.binary),
    staged: false,
  };
}

export function resetRequiresConfirmation(mode: ResetMode): boolean {
  return mode === "hard" || mode === "mixed" || mode === "keep";
}

export function resetProtectionAction(mode: ResetMode): "hard_reset" | "history_rewrite" {
  return mode === "hard" ? "hard_reset" : "history_rewrite";
}

export function isLineSelection(value: unknown): value is DiffLineSelection {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as { side?: unknown; line?: unknown };
  return (
    (entry.side === "old" || entry.side === "new") &&
    Number.isInteger(entry.line) &&
    (entry.line as number) > 0
  );
}

export function parseSelectedChangeInput(
  hunkIndexes?: number[],
  lines?: unknown[],
): { hunkIndexes?: number[]; lines?: DiffLineSelection[] } | { error: string } {
  const parsedHunks = hunkIndexes?.filter(
    (index) => Number.isInteger(index) && index >= 0,
  );
  const parsedLines = lines?.every(isLineSelection)
    ? (lines as DiffLineSelection[])
    : undefined;
  if (lines && lines.length > 0 && !parsedLines) {
    return { error: "Invalid line selection payload." };
  }
  if ((!parsedHunks || parsedHunks.length === 0) && (!parsedLines || parsedLines.length === 0)) {
    return { error: "Select at least one hunk or changed line." };
  }
  return {
    hunkIndexes: parsedHunks && parsedHunks.length > 0 ? parsedHunks : undefined,
    lines: parsedLines && parsedLines.length > 0 ? parsedLines : undefined,
  };
}

export function createLogHandlerApis(deps: LogHandlerDeps) {
  const log = createLogApi(deps.execGit);
  const history = createHistoryApi(deps.execGit);
  const branchApi = createBranchApi(deps.execGit);
  const merge = createMergeApi(deps.execGit);
  const diff = createDiffApi(deps.execGit, merge.isBinaryFile);
  const rebase = createRebaseApi(deps.execGit);
  const selectedChanges = createSelectedChangesApi(
    deps.execGit,
    merge.isBinaryFile,
  );
  const extractChanges = createExtractChangesApi(deps.execGit);

  async function resolveRepo(repoId: string) {
    const repos = await deps.repositoryService.discoverRepositories({
      workspaceFolders: deps.workspaceFolders,
      explicitRepoId: repoId,
      trusted: deps.trusted,
    });
    return deps.repositoryService.resolveRepositoryForResource(
      repos,
      undefined,
      repoId,
    );
  }

  return {
    deps,
    log,
    history,
    branchApi,
    merge,
    diff,
    rebase,
    selectedChanges,
    extractChanges,
    resolveRepo,
  };
}

export type LogHandlerApis = ReturnType<typeof createLogHandlerApis>;
