export type BranchEntry = {
  repoId: string;
  name: string;
  fullName: string;
  remote: boolean;
  current: boolean;
  upstream: string | null;
  headSha: string | null;
  protected?: boolean;
  favorite?: boolean;
};

export type BranchListSnapshot = {
  repoId: string;
  branches: BranchEntry[];
  refreshedAt: number;
};

export type BranchCompareMode = "current" | "workingTree";

export type BranchCompareFile = {
  path: string;
  status: "A" | "M" | "D" | "R";
};

export type BranchCompareSnapshot = {
  repoId: string;
  mode: BranchCompareMode;
  selectedRef: string;
  selectedLabel: string;
  baseLabel: string;
  files: BranchCompareFile[];
  refreshedAt: number;
};

export type SyncBranchTarget = {
  repoId: string;
  name: string;
  available: boolean;
  currentBranch: string | null;
  unavailableReason?: string;
};

export type SyncBranchResult = {
  repoId: string;
  name: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
};