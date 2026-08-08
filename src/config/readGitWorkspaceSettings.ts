import * as vscode from "vscode";
import {
  normalizeGitWorkspaceSettings,
  type GitWorkspaceSettings,
} from "../shared/types/gitWorkspaceSettings";

export function readGitWorkspaceSettings(): GitWorkspaceSettings {
  const cfg = vscode.workspace.getConfiguration("gitView");
  return normalizeGitWorkspaceSettings({
    mode: cfg.get("mode"),
    updateStrategy: cfg.get("updateStrategy"),
    whitespacePolicy: cfg.get("whitespacePolicy"),
    diffViewMode: cfg.get("gitDiffViewMode"),
    synchronousBranchControl: cfg.get("synchronousBranchControl"),
    graphSort: cfg.get("graphSort"),
    highlightCurrentBranch: cfg.get("highlightCurrentBranch"),
    compactLogRows: cfg.get("compactLogRows"),
    issueTrackerBaseUrl: cfg.get("issueTrackerBaseUrl"),
  });
}
