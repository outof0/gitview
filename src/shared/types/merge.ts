import type { MergeDocument } from "../../core/types";
import type { GitViewSettings } from "../../types/settings";
import type { BlameSide, GitCommitEntry } from "../../types/blame";

export type MergeConflictFile = {
  relativePath: string;
  stageCode: string;
  conflictCount?: number;
  specialKind?:
    | "none"
    | "add_add"
    | "modify_delete"
    | "delete_modify"
    | "binary";
};

export type MergeBranchInfo = {
  currentBranch: string;
  mergeHead?: string;
};

export type ConflictSnapshot = {
  repoRoot: string;
  files: MergeConflictFile[];
  branchInfo: MergeBranchInfo;
};

export type MergeInitPayload = {
  repoId: string;
  themeKind: "light" | "dark" | "high-contrast" | "high-contrast-light";
  extensionVersion: string;
  settings: GitViewSettings;
};

export type DiscardConfirmAction =
  | { action: "backToList" }
  | {
      action: "openFile";
      relativePath: string;
      targetChange: "first" | "last";
    };

export type ChangesFromSidePayload = {
  repoId: string;
  side: BlameSide;
  relativePath?: string;
  filterByFile?: boolean;
  limit?: number;
};

export type ChangesFromSideResult = {
  side: BlameSide;
  relativePath?: string;
  mergeBase?: string;
  revisionRange?: string;
  branchRef?: string;
  commits?: GitCommitEntry[];
  allChangedPaths?: string[];
  error?: { code: string; message: string };
};

export type { MergeDocument };