export type ConflictFile = {
  relativePath: string;
  stageCode: string;
  conflictCount?: number;
};

export type BranchInfo = {
  currentBranch: string;
  mergeHead?: string;
  rebaseInProgress: boolean;
  mergeInProgress: boolean;
  operation: "merge" | "rebase" | "cherry-pick" | "revert" | "none";
};

export type StageCode =
  | "UU"
  | "AA"
  | "UD"
  | "DU"
  | "DD"
  | "AU"
  | "UA"
  | "other";
