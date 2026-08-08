export type GitUpdateStrategy = "merge" | "rebase" | "ff_only";

export type GitWhitespacePolicy =
  | "doNotIgnore"
  | "ignoreWhitespaces"
  | "trimWhitespaces";

export type GitDiffViewModeSetting = "side_by_side" | "unified";

export type GitGraphSort = "date" | "topological";

export type GitWorkspaceMode = "staging" | "changelist";

export type GitWorkspaceSettings = {
  mode: GitWorkspaceMode;
  updateStrategy: GitUpdateStrategy;
  whitespacePolicy: GitWhitespacePolicy;
  diffViewMode: GitDiffViewModeSetting;
  synchronousBranchControl: boolean;
  graphSort: GitGraphSort;
  highlightCurrentBranch: boolean;
  compactLogRows: boolean;
  issueTrackerBaseUrl: string | null;
};

export const DEFAULT_GIT_WORKSPACE_SETTINGS: GitWorkspaceSettings = {
  mode: "staging",
  updateStrategy: "merge",
  whitespacePolicy: "doNotIgnore",
  diffViewMode: "side_by_side",
  synchronousBranchControl: true,
  graphSort: "date",
  highlightCurrentBranch: true,
  compactLogRows: false,
  issueTrackerBaseUrl: null,
};

export function isGitUpdateStrategy(
  value: unknown,
): value is GitUpdateStrategy {
  return value === "merge" || value === "rebase" || value === "ff_only";
}

export function isGitWhitespacePolicy(
  value: unknown,
): value is GitWhitespacePolicy {
  return (
    value === "doNotIgnore" ||
    value === "ignoreWhitespaces" ||
    value === "trimWhitespaces"
  );
}

export function isGitDiffViewModeSetting(
  value: unknown,
): value is GitDiffViewModeSetting {
  return value === "side_by_side" || value === "unified";
}

export function isGitGraphSort(value: unknown): value is GitGraphSort {
  return value === "date" || value === "topological";
}

export function isGitWorkspaceMode(value: unknown): value is GitWorkspaceMode {
  return value === "staging" || value === "changelist";
}

export function normalizeGitWorkspaceSettings(
  value: unknown,
): GitWorkspaceSettings {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_GIT_WORKSPACE_SETTINGS;
  }
  const source = value as Record<string, unknown>;
  return {
    mode: isGitWorkspaceMode(source.mode)
      ? source.mode
      : DEFAULT_GIT_WORKSPACE_SETTINGS.mode,
    updateStrategy: isGitUpdateStrategy(source.updateStrategy)
      ? source.updateStrategy
      : DEFAULT_GIT_WORKSPACE_SETTINGS.updateStrategy,
    whitespacePolicy: isGitWhitespacePolicy(source.whitespacePolicy)
      ? source.whitespacePolicy
      : DEFAULT_GIT_WORKSPACE_SETTINGS.whitespacePolicy,
    diffViewMode: isGitDiffViewModeSetting(source.diffViewMode)
      ? source.diffViewMode
      : DEFAULT_GIT_WORKSPACE_SETTINGS.diffViewMode,
    synchronousBranchControl:
      typeof source.synchronousBranchControl === "boolean"
        ? source.synchronousBranchControl
        : DEFAULT_GIT_WORKSPACE_SETTINGS.synchronousBranchControl,
    graphSort: isGitGraphSort(source.graphSort)
      ? source.graphSort
      : DEFAULT_GIT_WORKSPACE_SETTINGS.graphSort,
    highlightCurrentBranch:
      typeof source.highlightCurrentBranch === "boolean"
        ? source.highlightCurrentBranch
        : DEFAULT_GIT_WORKSPACE_SETTINGS.highlightCurrentBranch,
    compactLogRows:
      typeof source.compactLogRows === "boolean"
        ? source.compactLogRows
        : DEFAULT_GIT_WORKSPACE_SETTINGS.compactLogRows,
    issueTrackerBaseUrl:
      typeof source.issueTrackerBaseUrl === "string" &&
      source.issueTrackerBaseUrl.trim()
        ? source.issueTrackerBaseUrl.trim()
        : DEFAULT_GIT_WORKSPACE_SETTINGS.issueTrackerBaseUrl,
  };
}
