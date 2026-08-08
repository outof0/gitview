import type {
  AcceptBothOrder,
  ChangeBlock,
  ConflictSide,
  MergeDocument,
} from "../../../src/core/types";
import type {
  BlameSide,
  DiscardConfirmAction,
  GitViewSettings,
} from "@gitview/types";

export type Screen = "conflictList" | "mergeResolver";

export type WhitespacePolicy =
  | "doNotIgnore"
  | "ignoreWhitespaces"
  | "trimWhitespaces";
export type HighlightingMode = "words" | "lines" | "none";

export type CompareMode =
  | "default"
  | "localBase"
  | "repoBase"
  | "localRepo"
  | "localMiddle"
  | "repoMiddle";

export type ConflictFile = {
  relativePath: string;
  stageCode: string;
  conflictCount?: number;
  specialKind?:
    | "none"
    | "add_add"
    | "modify_delete"
    | "delete_modify"
    | "binary";
};

export type BranchInfo = {
  currentBranch: string;
  mergeHead?: string;
};

export type GitViewState = {
  screen: Screen;
  repoRoot: string | null;
  branchInfo: BranchInfo | null;
  conflictFiles: ConflictFile[];
  activeDocument: MergeDocument | null;
  activeBlockId: string | null;
  loading: boolean;
  error: string | null;
  acceptBothOrder: AcceptBothOrder;
  undoStack: MergeDocument[];
  redoStack: MergeDocument[];
  toasts: Array<{
    id: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
  }>;
  showToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
  removeToast: (id: string) => void;
  statusMessage: string | null;
  setStatusMessage: (message: string | null) => void;

  whitespacePolicy: WhitespacePolicy;
  highlightingMode: HighlightingMode;
  showBase: boolean;
  compareMode: CompareMode;
  showConflictsNavigation: boolean;
  showDetails: boolean;
  annotateOnOpen: BlameSide | null;

  foldThreshold: number;
  foldUnchangedRegions: boolean;
  expandedBlocks: string[];

  enableScrollSync: boolean;
  warnOnCrlf: boolean;
  crlfBannerDismissed: boolean;
  confirmBeforeMarkResolved: boolean;
  goToNextFileAfterLastChange: boolean;
  pendingChangeNavigation: "first" | "last" | null;

  searchOpen: boolean;
  searchQuery: string;
  searchActiveIndex: number;

  setScreen: (screen: Screen) => void;
  setRepoRoot: (root: string | null) => void;
  setBranchInfo: (info: BranchInfo | null) => void;
  setConflictFiles: (files: ConflictFile[]) => void;
  removeConflictFile: (relativePath: string) => void;
  markDocumentSaved: (relativePath: string) => void;
  setActiveDocument: (doc: MergeDocument | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAcceptBothOrder: (order: AcceptBothOrder) => void;
  commitActiveDocument: (doc: MergeDocument) => void;
  undoMerge: () => void;
  redoMerge: () => void;

  setWhitespacePolicy: (policy: WhitespacePolicy) => void;
  setHighlightingMode: (mode: HighlightingMode) => void;
  toggleShowBase: () => void;
  setCompareMode: (mode: CompareMode) => void;
  toggleConflictsNavigation: () => void;
  toggleShowDetails: () => void;
  setAnnotateOnOpen: (side: BlameSide | null) => void;

  setFoldThreshold: (n: number) => void;
  expandBlock: (id: string) => void;
  collapseBlock: (id: string) => void;
  applySettings: (settings: GitViewSettings) => void;

  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (q: string) => void;
  setSearchActiveIndex: (i: number) => void;

  enterMergeResolver: () => void;
  backToList: () => void;
  requestBackToList: () => void;
  setActiveBlock: (id: string | null) => void;
  blockScrollIntoView: ((blockId: string) => void) | null;
  setBlockScrollIntoView: (fn: ((blockId: string) => void) | null) => void;
  openConflictFile: ((relativePath: string) => void) | null;
  setOpenConflictFile: (fn: ((relativePath: string) => void) | null) => void;
  confirmDiscard: ((action: DiscardConfirmAction) => void) | null;
  setConfirmDiscard: (fn: ((action: DiscardConfirmAction) => void) | null) => void;
  applyDiscardConfirmed: (action: DiscardConfirmAction) => void;
  goToNextConflict: () => void;
  goToPreviousConflict: () => void;
  goToNextChange: () => void;
  goToPreviousChange: () => void;

  applyAcceptOurs: (id: string) => void;
  applyAcceptTheirs: (id: string) => void;
  applyAcceptSide: (id: string, side: ConflictSide) => void;
  applyAcceptBoth: (id: string) => void;
  applyAppendSide: (id: string, side: ConflictSide) => void;
  applyIgnore: (id: string, side: ConflictSide) => void;
  applyResetConflict: (id: string) => void;
  applyRevertCenterBlock: (id: string) => void;
  dismissCrlfBanner: () => void;
  normalizeDocumentEol: () => void;
  acceptAllOurs: () => void;
  acceptAllTheirs: () => void;
  applyAllNonConflicting: () => void;
  applyAllNonConflictingLeft: () => void;
  applyAllNonConflictingRight: () => void;
  resolveSimpleConflicts: () => void;
  acceptAndNext: (id: string, side: "ours" | "theirs") => void;

  remainingConflicts: () => number;
  isFullyResolved: () => boolean;
  getResultText: () => string;
};

export type ChangeBlockUpdater = (block: ChangeBlock) => ChangeBlock;