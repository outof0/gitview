import { create } from "zustand";
import type { GitViewState } from "./gitViewStoreTypes";
import { createGitViewStoreLifecycleSlice } from "./gitViewStoreLifecycleSlice";
import { createGitViewStoreResolutionSlice } from "./gitViewStoreResolutionSlice";

export type {
  WhitespacePolicy,
  HighlightingMode,
  CompareMode,
} from "./gitViewStoreTypes";
export { canApplyResolutionAction, getResolveContextMenuMode } from "./mergeResolveMenu";

export const useGitViewStore = create<GitViewState>((set, get) => ({
  screen: "conflictList",
  repoRoot: null,
  branchInfo: null,
  conflictFiles: [],
  activeDocument: null,
  activeBlockId: null,
  loading: false,
  error: null,
  acceptBothOrder: "oursFirst",
  undoStack: [],
  redoStack: [],
  toasts: [],
  statusMessage: null,

  whitespacePolicy: "doNotIgnore",
  highlightingMode: "lines",
  showBase: false,
  compareMode: "default",
  showConflictsNavigation: false,
  showDetails: false,
  annotateOnOpen: null,

  foldThreshold: 5,
  foldUnchangedRegions: false,
  expandedBlocks: [],

  enableScrollSync: true,
  warnOnCrlf: true,
  crlfBannerDismissed: false,
  confirmBeforeMarkResolved: false,
  goToNextFileAfterLastChange: true,
  pendingChangeNavigation: null,

  searchOpen: false,
  searchQuery: "",
  searchActiveIndex: 0,

  blockScrollIntoView: null,
  openConflictFile: null,
  confirmDiscard: null,

  ...createGitViewStoreLifecycleSlice(set, get),
  ...createGitViewStoreResolutionSlice(set, get),
}));