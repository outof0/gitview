/** VS Code `gitView.*` settings mirrored in the webview (see package.json). */

/** Selectable conflict engines; each needs an entry in `core/mergeEngines.ts`. */
export const MERGE_ENGINE_IDS = ["threeWay", "markers"] as const;
export type MergeEngine = (typeof MERGE_ENGINE_IDS)[number];
export type ConflictPlaceholder = "base";
export type AcceptBothOrderSetting = "oursFirst" | "theirsFirst";
export type WhitespacePolicySetting =
  | "doNotIgnore"
  | "ignoreWhitespaces"
  | "trimWhitespaces";
export type HighlightingModeSetting = "words" | "lines" | "none";

export type GitViewSettings = {
  mergeEngine: MergeEngine;
  conflictPlaceholder: ConflictPlaceholder;
  acceptBothOrder: AcceptBothOrderSetting;
  autoStageOnResolved: boolean;
  showBasePanel: boolean;
  confirmBeforeMarkResolved: boolean;
  enableScrollSync: boolean;
  showWordLevelDiff: boolean;
  autoResolveBothSame: boolean;
  whitespacePolicy: WhitespacePolicySetting;
  highlightingMode: HighlightingModeSetting;
  warnOnCrlf: boolean;
  /** Workflow rule: Settings → Diff & Merge → Go to the next file after reaching last change. */
  goToNextFileAfterLastChange: boolean;
  /** Collapse long unchanged regions in the merge resolver (desktop-IDE-style folding). */
  foldUnchangedRegions: boolean;
  /** Minimum line count in an unchanged block before it can collapse. */
  foldThreshold: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMergeEngine(value: unknown): value is MergeEngine {
  return (MERGE_ENGINE_IDS as readonly unknown[]).includes(value);
}

function isConflictPlaceholder(value: unknown): value is ConflictPlaceholder {
  return value === "base";
}

function isAcceptBothOrder(value: unknown): value is AcceptBothOrderSetting {
  return value === "oursFirst" || value === "theirsFirst";
}

function isWhitespacePolicy(value: unknown): value is WhitespacePolicySetting {
  return (
    value === "doNotIgnore" ||
    value === "ignoreWhitespaces" ||
    value === "trimWhitespaces"
  );
}

function isHighlightingMode(value: unknown): value is HighlightingModeSetting {
  return value === "words" || value === "lines" || value === "none";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function readSetting<T>(
  value: unknown,
  fallback: T,
  isValid: (value: unknown) => value is T,
): T {
  return isValid(value) ? value : fallback;
}

export function isGitViewSettings(
  value: unknown,
): value is GitViewSettings {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isMergeEngine(value.mergeEngine) &&
    isConflictPlaceholder(value.conflictPlaceholder) &&
    isAcceptBothOrder(value.acceptBothOrder) &&
    isBoolean(value.autoStageOnResolved) &&
    isBoolean(value.showBasePanel) &&
    isBoolean(value.confirmBeforeMarkResolved) &&
    isBoolean(value.enableScrollSync) &&
    isBoolean(value.showWordLevelDiff) &&
    isBoolean(value.autoResolveBothSame) &&
    isWhitespacePolicy(value.whitespacePolicy) &&
    isHighlightingMode(value.highlightingMode) &&
    isBoolean(value.warnOnCrlf) &&
    isBoolean(value.goToNextFileAfterLastChange) &&
    isBoolean(value.foldUnchangedRegions) &&
    isPositiveInteger(value.foldThreshold)
  );
}

export const DEFAULT_GITVIEW_SETTINGS: GitViewSettings = {
  mergeEngine: "threeWay",
  conflictPlaceholder: "base",
  acceptBothOrder: "oursFirst",
  autoStageOnResolved: true,
  showBasePanel: false,
  confirmBeforeMarkResolved: false,
  enableScrollSync: true,
  showWordLevelDiff: true,
  autoResolveBothSame: true,
  whitespacePolicy: "doNotIgnore",
  highlightingMode: "lines",
  warnOnCrlf: true,
  goToNextFileAfterLastChange: true,
  foldUnchangedRegions: false,
  foldThreshold: 5,
};

export function normalizeGitViewSettings(value: unknown): GitViewSettings {
  const source = isRecord(value) ? value : {};
  return {
    mergeEngine: readSetting(
      source.mergeEngine,
      DEFAULT_GITVIEW_SETTINGS.mergeEngine,
      isMergeEngine,
    ),
    conflictPlaceholder: readSetting(
      source.conflictPlaceholder,
      DEFAULT_GITVIEW_SETTINGS.conflictPlaceholder,
      isConflictPlaceholder,
    ),
    acceptBothOrder: readSetting(
      source.acceptBothOrder,
      DEFAULT_GITVIEW_SETTINGS.acceptBothOrder,
      isAcceptBothOrder,
    ),
    autoStageOnResolved: readSetting(
      source.autoStageOnResolved,
      DEFAULT_GITVIEW_SETTINGS.autoStageOnResolved,
      isBoolean,
    ),
    showBasePanel: readSetting(
      source.showBasePanel,
      DEFAULT_GITVIEW_SETTINGS.showBasePanel,
      isBoolean,
    ),
    confirmBeforeMarkResolved: readSetting(
      source.confirmBeforeMarkResolved,
      DEFAULT_GITVIEW_SETTINGS.confirmBeforeMarkResolved,
      isBoolean,
    ),
    enableScrollSync: readSetting(
      source.enableScrollSync,
      DEFAULT_GITVIEW_SETTINGS.enableScrollSync,
      isBoolean,
    ),
    showWordLevelDiff: readSetting(
      source.showWordLevelDiff,
      DEFAULT_GITVIEW_SETTINGS.showWordLevelDiff,
      isBoolean,
    ),
    autoResolveBothSame: readSetting(
      source.autoResolveBothSame,
      DEFAULT_GITVIEW_SETTINGS.autoResolveBothSame,
      isBoolean,
    ),
    whitespacePolicy: readSetting(
      source.whitespacePolicy,
      DEFAULT_GITVIEW_SETTINGS.whitespacePolicy,
      isWhitespacePolicy,
    ),
    highlightingMode: readSetting(
      source.highlightingMode,
      DEFAULT_GITVIEW_SETTINGS.highlightingMode,
      isHighlightingMode,
    ),
    warnOnCrlf: readSetting(
      source.warnOnCrlf,
      DEFAULT_GITVIEW_SETTINGS.warnOnCrlf,
      isBoolean,
    ),
    goToNextFileAfterLastChange: readSetting(
      source.goToNextFileAfterLastChange,
      DEFAULT_GITVIEW_SETTINGS.goToNextFileAfterLastChange,
      isBoolean,
    ),
    foldUnchangedRegions: readSetting(
      source.foldUnchangedRegions,
      DEFAULT_GITVIEW_SETTINGS.foldUnchangedRegions,
      isBoolean,
    ),
    foldThreshold: readSetting(
      source.foldThreshold,
      DEFAULT_GITVIEW_SETTINGS.foldThreshold,
      isPositiveInteger,
    ),
  };
}
