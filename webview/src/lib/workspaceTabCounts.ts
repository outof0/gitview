export type WorkspaceTabId =
  | "changes"
  | "log"
  | "blame"
  | "temporary"
  | "review";

export type WorkspaceTabCountSource = {
  changeCount: number;
  temporaryCount: number;
  reviewCount: number;
};

export const WORKSPACE_TAB_LABELS: Record<WorkspaceTabId, string> = {
  changes: "Changes",
  log: "Log",
  blame: "Blame",
  temporary: "Temporary Work",
  review: "Review",
};

export const WORKSPACE_TABS: WorkspaceTabId[] = [
  "changes",
  "log",
  "blame",
  "temporary",
  "review",
];

export function workspaceTabCount(
  tab: WorkspaceTabId,
  source: WorkspaceTabCountSource,
): number | null {
  if (tab === "changes" && source.changeCount > 0) {
    return source.changeCount;
  }
  if (tab === "temporary" && source.temporaryCount > 0) {
    return source.temporaryCount;
  }
  if (tab === "review" && source.reviewCount > 0) {
    return source.reviewCount;
  }
  return null;
}
