import type { ResetMode } from "@gitview/shared/types/log";
import type { DiffLineSelection, WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import type { LogCommitEntry, LogQueryFilters, LogSnapshot } from "@gitview/shared/types/log";

export type WorkspaceLogPanelProps = {
  snapshot: LogSnapshot | null;
  loading?: boolean;
  error?: string | null;
  selectedSha: string | null;
  selectedShas?: string[];
  selectedFilePath: string | null;
  diffDocument: WorkspaceDiffDocument | null;
  diffLoading?: boolean;
  diffError?: string | null;
  onSelectCommit: (sha: string, multi?: boolean) => void;
  onSelectFile: (path: string, status: string) => void;
  onRefresh: () => void;
  filters: LogQueryFilters;
  onFiltersChange: (filters: LogQueryFilters) => void;
  busy?: boolean;
  protectedBranch?: boolean;
  hasUpstream?: boolean;
  onCherryPick?: (sha: string) => void;
  onCherryPickMultiple?: (shas: string[]) => void;
  onRevert?: (sha: string) => void;
  onRevertMultiple?: (shas: string[]) => void;
  issueTrackerBaseUrl?: string | null;
  currentBranchHeadSha?: string | null;
  onCopyHash?: (sha: string) => void;
  onCreateBranchFromCommit?: (sha: string) => void;
  onResetToCommit?: (sha: string, mode: ResetMode) => void;
  onUndoLastCommit?: () => void;
  onEditMessage?: (sha: string, subject: string) => void;
  onDropCommit?: (sha: string) => void;
  onRewriteCommit?: (sha: string, action: "squash" | "fixup" | "drop") => void;
  onExtractChanges?: (sha: string) => void;
  canDropSelected?: boolean;
  protectedBranchForDrop?: boolean;
  onCherryPickHunk?: (hunkIndex: number) => void;
  onRevertHunk?: (hunkIndex: number) => void;
  onDropHunk?: (hunkIndex: number) => void;
  onCherryPickLines?: (lines: DiffLineSelection[]) => void;
  onRevertLines?: (lines: DiffLineSelection[]) => void;
  onDropLines?: (lines: DiffLineSelection[]) => void;
};

export function findCommit(
  commits: LogCommitEntry[],
  sha: string | null,
): LogCommitEntry | null {
  if (!sha) {
    return null;
  }
  return commits.find((commit) => commit.sha === sha) ?? null;
}