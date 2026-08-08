export type WorktreeEntry = {
  path: string;
  headSha: string | null;
  branch: string | null;
  detached: boolean;
  bare: boolean;
  locked: boolean;
  prunable: boolean;
  isMain: boolean;
};

export type WorktreeListSnapshot = {
  repoId: string;
  worktrees: WorktreeEntry[];
  refreshedAt: number;
};