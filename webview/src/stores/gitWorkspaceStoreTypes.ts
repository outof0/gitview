import type { BlameSnapshot } from "@gitview/shared/types/blame";
import type {
  BranchCompareSnapshot,
  BranchListSnapshot,
} from "@gitview/shared/types/branch";
import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import type { LogQueryFilters, LogSnapshot } from "@gitview/shared/types/log";
import type { Repository, RepositorySnapshot } from "@gitview/shared/types/repository";
import type { ShelfListSnapshot } from "@gitview/shared/types/shelf";
import type { StashListSnapshot } from "@gitview/shared/types/stash";
import type { GitFileStatus, StatusSnapshot } from "@gitview/shared/types/status";
import type { TagListSnapshot } from "@gitview/shared/types/tag";
import type { WorktreeListSnapshot } from "@gitview/shared/types/worktree";
import type {
  ReviewDetailsSnapshot,
  ReviewFilters,
  ReviewListSnapshot,
} from "@gitview/shared/types/review";
import type { WhitespacePolicy } from "../stores/gitViewStore";
import type {
  GitWorkspaceDialogId,
  GitWorkspaceDialogPayloads,
  GitWorkspaceDialogState,
} from "./gitWorkspaceDialogs";

export type GitDiffViewMode = "side_by_side" | "unified";

export type GitWorkspaceState = {
  loading: boolean;
  error: string | null;
  /** Open modals keyed by id; see `gitWorkspaceDialogs.ts`. */
  dialogs: GitWorkspaceDialogState;
  /**
   * Set while a surface opened from the native Git submenu is up, so the panel
   * can hide its workspace behind the modal the way a JetBrains dialog does.
   */
  nativeFocusSurface: GitWorkspaceDialogId | "branches" | null;
  repoSnapshot: RepositorySnapshot | null;
  statusSnapshot: StatusSnapshot | null;
  branchSnapshot: BranchListSnapshot | null;
  branchCompareSnapshot: BranchCompareSnapshot | null;
  branchCompareOpen: boolean;
  branchCompareSelectedFile: string | null;
  diffDocument: WorkspaceDiffDocument | null;
  diffLoading: boolean;
  diffError: string | null;
  selectedFilePath: string | null;
  commitScope: Set<string>;
  commitMessage: string;
  amend: boolean;
  signoff: boolean;
  gpgSign: boolean;
  author: string;
  runChecks: boolean;
  pullStrategy: "merge" | "rebase" | "ff_only";
  synchronousBranchControl: boolean;
  branchesOpen: boolean;
  branchesLoading: boolean;
  workspaceTab: "changes" | "log" | "blame" | "temporary" | "review";
  temporarySubTab: "stash" | "shelf" | "patch";
  stashSnapshot: StashListSnapshot | null;
  shelfSnapshot: ShelfListSnapshot | null;
  tagsOpen: boolean;
  tagsLoading: boolean;
  tagSnapshot: TagListSnapshot | null;
  worktreesOpen: boolean;
  worktreesLoading: boolean;
  worktreeSnapshot: WorktreeListSnapshot | null;
  patchPreview: string | null;
  blameSnapshot: BlameSnapshot | null;
  blameLoading: boolean;
  blameError: string | null;
  workspaceNotification: { level: "info" | "warning" | "error"; message: string } | null;
  logSnapshot: LogSnapshot | null;
  logLoading: boolean;
  logError: string | null;
  logSelectedSha: string | null;
  logSelectedShas: string[];
  logSelectedFilePath: string | null;
  logFilters: LogQueryFilters;
  issueTrackerBaseUrl: string | null;
  diffStagedView: boolean;
  diffViewMode: GitDiffViewMode;
  whitespacePolicy: WhitespacePolicy;
  commitAfterChecksConfirmed: boolean;
  reviewSnapshot: ReviewListSnapshot | null;
  reviewDetails: ReviewDetailsSnapshot | null;
  reviewLoading: boolean;
  reviewError: string | null;
  reviewFilters: ReviewFilters;
  selectedReviewId: string | null;
};

export type GitWorkspaceActions = {
  setLoading: (loading: boolean) => void;
  openDialog: <K extends GitWorkspaceDialogId>(
    id: K,
    payload: GitWorkspaceDialogPayloads[K],
  ) => void;
  /** Opens `id` and closes every other dialog and list popup. */
  openExclusiveDialog: <K extends GitWorkspaceDialogId>(
    id: K,
    payload: GitWorkspaceDialogPayloads[K],
  ) => void;
  closeAllDialogs: () => void;
  closeDialog: (id: GitWorkspaceDialogId) => void;
  setNativeFocusSurface: (
    surface: GitWorkspaceState["nativeFocusSurface"],
  ) => void;
  setError: (error: string | null) => void;
  applyRepoSnapshot: (snapshot: RepositorySnapshot) => void;
  applyStatusSnapshot: (snapshot: StatusSnapshot) => void;
  applyBranchSnapshot: (snapshot: BranchListSnapshot) => void;
  applyBranchCompareSnapshot: (snapshot: BranchCompareSnapshot | null) => void;
  setBranchCompareOpen: (open: boolean) => void;
  setBranchCompareSelectedFile: (path: string | null) => void;
  clearBranchCompare: () => void;
  setBranchesOpen: (open: boolean) => void;
  setBranchesLoading: (loading: boolean) => void;
  setDiffDocument: (document: WorkspaceDiffDocument | null) => void;
  setDiffLoading: (loading: boolean) => void;
  setDiffError: (error: string | null) => void;
  selectFile: (path: string | null) => void;
  toggleCommitScope: (path: string) => void;
  setCommitScope: (paths: Iterable<string>) => void;
  setCommitMessage: (message: string) => void;
  setAmend: (amend: boolean) => void;
  setSignoff: (signoff: boolean) => void;
  setGpgSign: (gpgSign: boolean) => void;
  setAuthor: (author: string) => void;
  setRunChecks: (runChecks: boolean) => void;
  setPullStrategy: (strategy: GitWorkspaceState["pullStrategy"]) => void;
  setSynchronousBranchControl: (enabled: boolean) => void;
  setWorkspaceTab: (tab: GitWorkspaceState["workspaceTab"]) => void;
  setTemporarySubTab: (tab: GitWorkspaceState["temporarySubTab"]) => void;
  applyStashSnapshot: (snapshot: StashListSnapshot) => void;
  applyShelfSnapshot: (snapshot: ShelfListSnapshot) => void;
  setTagsOpen: (open: boolean) => void;
  setTagsLoading: (loading: boolean) => void;
  applyTagSnapshot: (snapshot: TagListSnapshot) => void;
  setWorktreesOpen: (open: boolean) => void;
  setWorktreesLoading: (loading: boolean) => void;
  applyWorktreeSnapshot: (snapshot: WorktreeListSnapshot) => void;
  setPatchPreview: (patch: string | null) => void;
  applyBlameSnapshot: (snapshot: BlameSnapshot) => void;
  setBlameLoading: (loading: boolean) => void;
  setBlameError: (error: string | null) => void;
  setWorkspaceNotification: (
    notification: GitWorkspaceState["workspaceNotification"],
  ) => void;
  clearWorkspaceNotification: () => void;
  selectedFileConflicted: () => boolean;
  applyLogSnapshot: (snapshot: LogSnapshot) => void;
  setLogLoading: (loading: boolean) => void;
  setLogError: (error: string | null) => void;
  selectLogCommit: (sha: string | null) => void;
  toggleLogCommitSelection: (sha: string, multi?: boolean) => void;
  clearLogCommitSelection: () => void;
  selectLogFile: (path: string | null) => void;
  setLogFilters: (filters: LogQueryFilters) => void;
  setIssueTrackerBaseUrl: (url: string | null) => void;
  setDiffStagedView: (staged: boolean) => void;
  setDiffViewMode: (mode: GitDiffViewMode) => void;
  setWhitespacePolicy: (policy: WhitespacePolicy) => void;
  setCommitAfterChecksConfirmed: (confirmed: boolean) => void;
  applyReviewSnapshot: (snapshot: ReviewListSnapshot) => void;
  applyReviewDetails: (details: ReviewDetailsSnapshot | null) => void;
  setReviewLoading: (loading: boolean) => void;
  setReviewError: (error: string | null) => void;
  setReviewFilters: (filters: ReviewFilters) => void;
  setSelectedReviewId: (reviewId: string | null) => void;
  activeRepository: () => Repository | null;
  activeChangelistPaths: () => Set<string> | null;
  visibleFiles: () => GitFileStatus[];
  committableFiles: () => GitFileStatus[];
};