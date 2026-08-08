import * as vscode from "vscode";
import {
  DEFAULT_GITVIEW_SETTINGS,
  normalizeGitViewSettings,
  type GitViewSettings,
} from "../types/settings";

/** Read current workspace/user settings for GitView Diff. */
export function readGitViewSettings(): GitViewSettings {
  const cfg = vscode.workspace.getConfiguration("gitView");
  return normalizeGitViewSettings({
    mergeEngine: cfg.get(
      "mergeEngine",
      DEFAULT_GITVIEW_SETTINGS.mergeEngine,
    ),
    conflictPlaceholder: cfg.get(
      "conflictPlaceholder",
      DEFAULT_GITVIEW_SETTINGS.conflictPlaceholder,
    ),
    acceptBothOrder: cfg.get(
      "acceptBothOrder",
      DEFAULT_GITVIEW_SETTINGS.acceptBothOrder,
    ),
    autoStageOnResolved: cfg.get(
      "autoStageOnResolved",
      DEFAULT_GITVIEW_SETTINGS.autoStageOnResolved,
    ),
    showBasePanel: cfg.get(
      "showBasePanel",
      DEFAULT_GITVIEW_SETTINGS.showBasePanel,
    ),
    confirmBeforeMarkResolved: cfg.get(
      "confirmBeforeMarkResolved",
      DEFAULT_GITVIEW_SETTINGS.confirmBeforeMarkResolved,
    ),
    enableScrollSync: cfg.get(
      "enableScrollSync",
      DEFAULT_GITVIEW_SETTINGS.enableScrollSync,
    ),
    showWordLevelDiff: cfg.get(
      "showWordLevelDiff",
      DEFAULT_GITVIEW_SETTINGS.showWordLevelDiff,
    ),
    autoResolveBothSame: cfg.get(
      "autoResolveBothSame",
      DEFAULT_GITVIEW_SETTINGS.autoResolveBothSame,
    ),
    whitespacePolicy: cfg.get(
      "whitespacePolicy",
      DEFAULT_GITVIEW_SETTINGS.whitespacePolicy,
    ),
    highlightingMode: cfg.get(
      "highlightingMode",
      DEFAULT_GITVIEW_SETTINGS.highlightingMode,
    ),
    warnOnCrlf: cfg.get("warnOnCrlf", DEFAULT_GITVIEW_SETTINGS.warnOnCrlf),
    goToNextFileAfterLastChange: cfg.get(
      "goToNextFileAfterLastChange",
      DEFAULT_GITVIEW_SETTINGS.goToNextFileAfterLastChange,
    ),
    foldUnchangedRegions: cfg.get(
      "foldUnchangedRegions",
      DEFAULT_GITVIEW_SETTINGS.foldUnchangedRegions,
    ),
    foldThreshold: cfg.get(
      "foldThreshold",
      DEFAULT_GITVIEW_SETTINGS.foldThreshold,
    ),
  });
}

export function themeKindFromVscode():
  | "light"
  | "dark"
  | "high-contrast"
  | "high-contrast-light" {
  const kind = vscode.window.activeColorTheme.kind;
  if (kind === vscode.ColorThemeKind.Light) {
    return "light";
  }
  if (kind === vscode.ColorThemeKind.HighContrastLight) {
    return "high-contrast-light";
  }
  if (kind === vscode.ColorThemeKind.HighContrast) {
    return "high-contrast";
  }
  return "dark";
}
