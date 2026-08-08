export type CommitCheckKind =
  | "hooks"
  | "todo"
  | "analyze"
  | "reformat"
  | "optimizeImports";

export type CommitCheckIssue = {
  kind: CommitCheckKind;
  severity: "warning" | "error";
  message: string;
  paths?: string[];
};

export type CommitCheckResult = {
  ok: boolean;
  issues: CommitCheckIssue[];
};