export type BlameLineEntry = {
  lineNumber: number;
  sha: string;
  shortSha: string;
  author: string;
  authorEmail: string;
  authorTime: number;
  summary: string;
  /** Source line content from git blame --line-porcelain. */
  text?: string;
};

export type BlameSnapshot = {
  repoId: string;
  filePath: string;
  ref: string;
  lines: BlameLineEntry[];
  truncated?: boolean;
  refreshedAt: number;
};