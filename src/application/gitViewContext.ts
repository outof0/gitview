import type { GitCommandRuntime } from "../commands/gitMenuActionsHelpers";
import type { GitMenuPresentation } from "../commands/gitMenuPresentation";
import type { CommitCheckService } from "../services/commitCheckService";
import type { GitService } from "../services/gitService";
import type { ProtectionService } from "../services/protectionService";
import type { RepositoryService } from "../services/repositoryService";
import type { RefreshCoordinator } from "../services/watchers/refreshCoordinator";
import type { BranchFavoriteStorage } from "../storage/branchFavoriteStorage";
import type { ChangelistStorage } from "../storage/changelistStorage";
import type { ShelfStorage } from "../storage/shelfStorage";
import type { ReviewProviderRegistry } from "../services/review/providerRegistry";
import type { ProtocolExtensionRegistry } from "../webviewHost/protocolExtensionRegistry";
import type { BlameCacheEntry } from "../services/git/types";
import type { Logger } from "../observability/logger";

/** Instance-scoped application services shared by VS Code adapters. */
export interface GitViewContext {
  logger: Logger;
  gitService: GitService;
  repositoryService: RepositoryService;
  protectionService: ProtectionService;
  refreshCoordinator: RefreshCoordinator;
  changelistStorage: ChangelistStorage;
  branchFavoriteStorage: BranchFavoriteStorage;
  shelfStorage: ShelfStorage;
  commitCheckService: CommitCheckService;
  commandRuntime: GitCommandRuntime;
  gitMenuPresentation: GitMenuPresentation;
  reviewProviderRegistry: ReviewProviderRegistry;
  protocolExtensionRegistry: ProtocolExtensionRegistry;
  blameCache: Map<string, BlameCacheEntry>;
  dispose(): void;
}
