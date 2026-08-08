export type GitFileStatusKind =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "unversioned"
  | "ignored"
  | "conflicted";

export type GitFileStatus = {
  repoId: string;
  path: string;
  oldPath?: string;
  kind: GitFileStatusKind;
  indexStatus: string;
  workingTreeStatus: string;
  staged: boolean;
  conflicted: boolean;
  binary: boolean;
};

export type ChangeList = {
  id: string;
  repoId: string;
  name: string;
  description?: string;
  active: boolean;
  filePaths: string[];
  createdAt: number;
  updatedAt: number;
};

export type StatusSnapshot = {
  repoId: string;
  files: GitFileStatus[];
  changelists: ChangeList[];
  mode: "staging" | "changelist";
  showIgnored: boolean;
  showUnversioned: boolean;
  refreshedAt: number;
};