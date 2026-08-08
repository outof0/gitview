export type { StageCode, ConflictFile, BranchInfo } from "./git";
export type { DiscardConfirmAction } from "../shared/types/merge";
export type {
  BlameLine,
  BlameResult,
  BlameSide,
  BlameErrorCode,
  GitCommitEntry,
  GitChangedFile,
  GitChangedFileStatus,
  FileDiffView,
  FileDiffAtCommitResult,
  FilePatchResult,
  LogResult,
  LogErrorCode,
  CommitDetailResult,
  LogOptions,
  ChangesFromSideResult,
  ChangesFromSideOptions,
  ChangesFromSideErrorCode,
} from "./blame";
export {
  GIT_CHANGED_FILE_STATUSES,
  BLAME_ERROR_CODES,
  LOG_ERROR_CODES,
  CHANGES_FROM_SIDE_ERROR_CODES,
  isGitChangedFileStatus,
  isBlameSide,
  isBlameErrorCode,
  isLogErrorCode,
  isChangesFromSideErrorCode,
} from "./blame";
export type {
  GitMenuAction,
  GitMenuWebviewAction,
  GitMenuCommandOnlyAction,
  GitMenuActionPayload,
} from "./gitMenu";
export {
  GIT_MENU_ACTIONS,
  GIT_MENU_WEBVIEW_ACTIONS,
  GIT_MENU_COMMAND_ONLY_ACTIONS,
  isGitMenuAction,
  isGitMenuWebviewAction,
  isRepoWideGitMenuAction,
  buildGitMenuActionPayload,
} from "./gitMenu";
export type {
  GitSubmenuScope,
  GitSubmenuItem,
  GitSubmenuRenderOptions,
} from "./gitSubmenu";
export {
  EDITOR_CONFLICT_RESOLVE_WHEN,
  FILE_ONLY_WHEN,
  GIT_SUBMENU_CONTEXT_GROUP,
  MERGE_CHANGES_WHEN,
  RESOLVE_CONFLICT_GROUP,
  RESOLVE_CONFLICT_KEYBINDING_WHEN,
  RESOURCE_FILE_WHEN,
  GIT_SUBMENU_ITEMS,
  getGitSubmenuItems,
  gitSubmenuGroupKey,
  gitSubmenuSectionLabel,
  isFileOnlyScope,
  findGitSubmenuItem,
} from "./gitSubmenu";
export type {
  GitSubmenuAction,
  GitSubmenuEnablementContext,
  GitSubmenuEnablementResult,
  GitSubmenuNativeContextFlags,
} from "./gitSubmenuEnablement";
export {
  GIT_SUBMENU_CONTEXT_KEYS,
  buildGitSubmenuEnablementContext,
  buildGitSubmenuNativeContext,
  evaluateGitSubmenuAction,
  isGitSubmenuActionEnabled,
} from "./gitSubmenuEnablement";
export type { GitViewSettings } from "./settings";
export {
  DEFAULT_GITVIEW_SETTINGS,
  isGitViewSettings,
  normalizeGitViewSettings,
} from "./settings";
export type { MessageEnvelope } from "./messageGuards";
export {
  isRecord,
  isString,
  isFiniteNumber,
  isMessageEnvelope,
  readOptionalString,
  readOptionalBoolean,
  readRequiredString,
  getPayload,
} from "./messageGuards";
