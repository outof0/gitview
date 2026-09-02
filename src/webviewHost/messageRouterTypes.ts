import type { GitExecFn } from "../services/git/types";
import type { CommitCheckService } from "../services/commitCheckService";
import type { ProtectionService } from "../services/protectionService";
import type { RepositoryService } from "../services/repositoryService";
import type { RefreshCoordinator } from "../services/watchers/refreshCoordinator";
import type { SyncOperationCoordinator } from "../services/syncOperationCoordinator";
import type { BranchFavoriteStorage } from "../storage/branchFavoriteStorage";
import type { ChangelistStorage } from "../storage/changelistStorage";
import type { ShelfStorage } from "../storage/shelfStorage";
import type { ReviewFetch } from "../services/review/reviewFetch";
import type { HostToWebview } from "../shared/protocol";
import type { FileService } from "../services/fileService";
import type { GitViewSettings } from "../types/settings";
import type { GitMenuActionPayload } from "../types/gitMenu";
import type { StandaloneDiffPreview } from "../shared/types/diff";
import type { ReviewProviderRegistry } from "../services/review/providerRegistry";
import type { RepositoryMutationSerializer } from "../services/repositoryMutationSerializer";
import type { ProtocolExtensionRegistry } from "./protocolExtensionRegistry";
import type { BlameCacheEntry } from "../services/git/types";
import type { Logger } from "../observability/logger";

export type MergePanelDeps = {
  fileService: FileService;
  openedMergePaths: Set<string>;
  getSettings: () => GitViewSettings;
  confirmMarkResolved?: (message: string) => Promise<boolean>;
  confirmDiscard?: (message: string) => Promise<boolean>;
  close?: () => void;
  onAnnotateRequest?: (relativePath: string, side: "ours" | "theirs") => void;
  onDiffPreview?: (preview: StandaloneDiffPreview) => void;
};

export type MessageRouterDeps = {
  logger?: Logger;
  execGit: GitExecFn;
  repositoryService: RepositoryService;
  protectionService: ProtectionService;
  refreshCoordinator: RefreshCoordinator;
  syncOperationCoordinator?: SyncOperationCoordinator;
  changelistStorage?: ChangelistStorage;
  branchFavoriteStorage?: BranchFavoriteStorage;
  shelfStorage?: ShelfStorage;
  commitCheckService?: CommitCheckService;
  /** Snapshot trust (tests). Prefer `getTrusted` for live re-reads. */
  trusted?: boolean;
  getTrusted?: () => boolean;
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  /** Live workspace roots for long-lived routers. */
  getWorkspaceFolders?: () => Array<{ uriPath: string; name: string }>;
  postMessage: (message: HostToWebview) => void;
  executeWorkspaceCommand?: (
    command:
      | "openFolder"
      | "clone"
      | "manageTrust"
      | "addRemote"
      | "collapsePanel"
      | "toggleSidebar",
  ) => Promise<void>;
  getCrlfWarningsEnabled?: () => boolean;
  /** When true (default), destructive history ops require a confirmed flag. */
  getConfirmDestructiveActions?: () => boolean;
  getReviewAccessToken?: (providerId: string) => Promise<string | null>;
  getGithubApiBaseUrl?: () => string;
  getGitlabApiBaseUrl?: () => string;
  reviewFetchFn?: ReviewFetch;
  reviewProviderRegistry?: ReviewProviderRegistry;
  protocolExtensionRegistry?: ProtocolExtensionRegistry;
  /**
   * Orders requests targeting the same repository. Injected for tests; a fresh
   * serializer is created per router when omitted.
   */
  repositoryMutationSerializer?: RepositoryMutationSerializer;
  blameCache?: Map<string, BlameCacheEntry>;
  onGitMenuAction?: (
    payload: GitMenuActionPayload,
    workspaceRoot?: string,
  ) => Promise<void>;
  onOpenGitHistory?: (
    repoId: string,
    path: string,
    isFolder: boolean,
  ) => Promise<void>;
  onOpenGitRollback?: (
    repoId: string,
    path: string,
    selectedPaths?: string[],
  ) => Promise<void>;
  onOpenGitContentDialog?: (
    repoId: string,
    dialog: "stash" | "unstash",
    index?: number | null,
  ) => Promise<void>;
  mergePanel?: MergePanelDeps;
  openDiffInEditor?: (
    preview: StandaloneDiffPreview,
    workspaceRoot?: string,
  ) => Promise<void>;
};
