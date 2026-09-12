import type { OperationState } from "./operation";
import type {
  RepositoryHeadState,
  RepositoryRemoteState,
  RepositoryShellState,
} from "./repositoryShell";

export type Repository = {
  id: string;
  rootPath: string;
  workspaceFolderPath: string | null;
  gitDirPath: string;
  name: string;
  currentBranch: string | null;
  headSha: string | null;
  upstream: string | null;
  isDetached: boolean;
  isBare: boolean;
  isWorktree: boolean;
  operation: OperationState;
  ahead: number | null;
  behind: number | null;
  conflictCount: number;
  dirty: boolean;
  /**
   * Content digest of the working tree at the last refresh, or null when the
   * repository is clean. `dirty` only says "something changed"; this captures
   * *what* the changed content is, so a dangerous operation can detect that the
   * tree moved between the moment confirmation was requested and the moment it
   * was submitted. See `computeChangeDigest` in `src/services/git/changeDigest.ts`.
   */
  changeDigest: string | null;
  trusted: boolean;
  protectedBranch: boolean;
  lastRefreshAt: number;
  headState?: RepositoryHeadState;
  remoteState?: RepositoryRemoteState;
};

export type RepositorySnapshot = {
  repositories: Repository[];
  activeRepoId: string | null;
  multiRootDiverged: boolean;
  shellState?: RepositoryShellState;
};