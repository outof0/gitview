import type { OperationState } from "./operation";

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
  trusted: boolean;
  protectedBranch: boolean;
  lastRefreshAt: number;
};

export type RepositorySnapshot = {
  repositories: Repository[];
  activeRepoId: string | null;
  multiRootDiverged: boolean;
};