import type { DiscardConfirmAction } from "@gitview/types";
import type { StoreApi } from "zustand";
import {
  adjacentConflictFilePath,
  scrollActiveBlock,
  unresolvedConflictOrder,
} from "./gitViewStoreHelpers";
import type { CompareMode, GitViewState } from "./gitViewStoreTypes";

type Set = StoreApi<GitViewState>["setState"];
type Get = StoreApi<GitViewState>["getState"];

export function createGitViewStoreLifecycleSlice(set: Set, get: Get) {
  // Auto-dismiss timers are tracked so a superseded message cannot clear the one
  // that replaced it, and so nothing fires into a store that has gone away.
  let statusTimer: ReturnType<typeof setTimeout> | null = null;
  const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let toastSeq = 0;

  return {
    setStatusMessage: (message: string | null) => {
      if (statusTimer !== null) {
        clearTimeout(statusTimer);
        statusTimer = null;
      }
      set({ statusMessage: message });
      if (message) {
        statusTimer = setTimeout(() => {
          statusTimer = null;
          if (get().statusMessage === message) {
            set({ statusMessage: null });
          }
        }, 4000);
      }
    },
    showToast: (
      message: string,
      type: "info" | "success" | "warning" | "error" = "info",
    ) => {
      // Routine feedback lives in the status line, not popups.
      if (type === "success" || type === "info" || type === "warning") {
        get().setStatusMessage(message);
        return;
      }
      toastSeq += 1;
      const id = `toast-${toastSeq}`;
      set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
      toastTimers.set(
        id,
        setTimeout(() => {
          toastTimers.delete(id);
          get().removeToast(id);
        }, 5000),
      );
    },
    removeToast: (id: string) => {
      const timer = toastTimers.get(id);
      if (timer !== undefined) {
        clearTimeout(timer);
        toastTimers.delete(id);
      }
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },

    setScreen: (screen: GitViewState["screen"]) => set({ screen }),
    setRepoRoot: (repoRoot: string | null) => set({ repoRoot }),
    setBranchInfo: (branchInfo: GitViewState["branchInfo"]) => set({ branchInfo }),
    setConflictFiles: (conflictFiles: GitViewState["conflictFiles"]) =>
      set({ conflictFiles, error: null }),
    removeConflictFile: (relativePath: string) =>
      set((s) => ({
        conflictFiles: s.conflictFiles.filter(
          (f) => f.relativePath !== relativePath,
        ),
      })),
    markDocumentSaved: (relativePath: string) => {
      const doc = get().activeDocument;
      if (doc?.relativePath === relativePath) {
        set({ activeDocument: { ...doc, dirty: false } });
      }
    },
    setActiveDocument: (activeDocument: GitViewState["activeDocument"]) => {
      const pending = get().pendingChangeNavigation;
      let activeBlockId: string | null = null;
      if (activeDocument && pending) {
        const order = activeDocument.changeOrder;
        if (order.length > 0) {
          // `!`: guarded by the non-empty check above.
          activeBlockId =
            pending === "first" ? order[0]! : order[order.length - 1]!;
        }
      }
      set({
        activeDocument,
        activeBlockId,
        pendingChangeNavigation: null,
        loading: false,
        undoStack: [],
        redoStack: [],
        expandedBlocks: [],
        searchOpen: false,
        searchQuery: "",
        searchActiveIndex: 0,
        crlfBannerDismissed: false,
        error: null,
      });
      if (activeBlockId) {
        scrollActiveBlock(get, activeBlockId);
      }
    },
    setLoading: (loading: boolean) =>
      set({ loading, ...(loading ? { error: null } : {}) }),
    setError: (error: string | null) => set({ error }),
    setAcceptBothOrder: (acceptBothOrder: GitViewState["acceptBothOrder"]) =>
      set({ acceptBothOrder }),
    commitActiveDocument: (activeDocument: NonNullable<GitViewState["activeDocument"]>) =>
      set((s) => {
        if (!s.activeDocument || s.activeDocument === activeDocument) {
          return { activeDocument };
        }
        return {
          activeDocument,
          undoStack: [...s.undoStack, s.activeDocument],
          redoStack: [],
        };
      }),
    undoMerge: () =>
      set((s) => {
        const previous = s.undoStack[s.undoStack.length - 1];
        if (!previous || !s.activeDocument) {
          return s;
        }
        return {
          activeDocument: previous,
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [s.activeDocument, ...s.redoStack],
        };
      }),
    redoMerge: () =>
      set((s) => {
        const next = s.redoStack[0];
        if (!next || !s.activeDocument) {
          return s;
        }
        return {
          activeDocument: next,
          undoStack: [...s.undoStack, s.activeDocument],
          redoStack: s.redoStack.slice(1),
        };
      }),

    setWhitespacePolicy: (whitespacePolicy: GitViewState["whitespacePolicy"]) =>
      set({ whitespacePolicy }),
    setHighlightingMode: (highlightingMode: GitViewState["highlightingMode"]) =>
      set({ highlightingMode }),
    toggleShowBase: () => set((s) => ({ showBase: !s.showBase })),
    setCompareMode: (compareMode: CompareMode) =>
      set((s) => ({
        compareMode,
        showBase:
          compareMode === "localBase" || compareMode === "repoBase"
            ? true
            : s.showBase,
      })),
    toggleConflictsNavigation: () =>
      set((s) => ({ showConflictsNavigation: !s.showConflictsNavigation })),
    toggleShowDetails: () => set((s) => ({ showDetails: !s.showDetails })),
    setAnnotateOnOpen: (annotateOnOpen: GitViewState["annotateOnOpen"]) =>
      set({ annotateOnOpen }),

    setFoldThreshold: (foldThreshold: number) => set({ foldThreshold }),
    expandBlock: (id: string) =>
      set((s) =>
        s.expandedBlocks.includes(id)
          ? s
          : { expandedBlocks: [...s.expandedBlocks, id] },
      ),
    collapseBlock: (id: string) =>
      set((s) => ({
        expandedBlocks: s.expandedBlocks.filter((x) => x !== id),
      })),
    applySettings: (settings: Parameters<GitViewState["applySettings"]>[0]) => {
      const highlightingMode =
        settings.showWordLevelDiff === false &&
        settings.highlightingMode === "words"
          ? "lines"
          : settings.highlightingMode;
      set({
        acceptBothOrder: settings.acceptBothOrder,
        showBase: settings.showBasePanel,
        whitespacePolicy: settings.whitespacePolicy,
        highlightingMode,
        foldThreshold: settings.foldThreshold,
        foldUnchangedRegions: settings.foldUnchangedRegions,
        enableScrollSync: settings.enableScrollSync,
        warnOnCrlf: settings.warnOnCrlf,
        confirmBeforeMarkResolved: settings.confirmBeforeMarkResolved,
        goToNextFileAfterLastChange: settings.goToNextFileAfterLastChange,
      });
    },
    openSearch: () => set({ searchOpen: true }),
    closeSearch: () => set({ searchOpen: false }),
    setSearchQuery: (searchQuery: string) =>
      set({ searchQuery, searchActiveIndex: 0 }),
    setSearchActiveIndex: (searchActiveIndex: number) =>
      set({ searchActiveIndex }),

    enterMergeResolver: () => set({ screen: "mergeResolver", error: null }),
    backToList: () =>
      set({
        screen: "conflictList",
        activeDocument: null,
        activeBlockId: null,
        undoStack: [],
        redoStack: [],
        expandedBlocks: [],
        searchOpen: false,
        searchQuery: "",
        searchActiveIndex: 0,
      }),
    requestBackToList: () => {
      const doc = get().activeDocument;
      if (doc?.dirty) {
        get().confirmDiscard?.({ action: "backToList" });
        return;
      }
      get().backToList();
    },
    setConfirmDiscard: (
      fn: ((action: DiscardConfirmAction) => void) | null,
    ) => set({ confirmDiscard: fn }),
    applyDiscardConfirmed: (action: DiscardConfirmAction) => {
      if (action.action === "backToList") {
        get().backToList();
        return;
      }
      const opener = get().openConflictFile;
      if (!opener) {
        return;
      }
      set({
        pendingChangeNavigation: action.targetChange,
        loading: true,
      });
      opener(action.relativePath);
    },
    setActiveBlock: (id: string | null) => set({ activeBlockId: id }),
    setBlockScrollIntoView: (
      fn: ((blockId: string) => void) | null,
    ) => set({ blockScrollIntoView: fn }),
    setOpenConflictFile: (
      fn: ((relativePath: string) => void) | null,
    ) => set({ openConflictFile: fn }),

    goToNextConflict: () => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      const currentId = get().activeBlockId;
      const order = unresolvedConflictOrder(doc);
      if (order.length === 0) {
        set({ activeBlockId: null });
        return;
      }
      // `!` below: `order` is non-empty here, and `next` is taken modulo its length.
      if (!currentId) {
        const id = order[0]!;
        set({ activeBlockId: id });
        scrollActiveBlock(get, id);
        return;
      }
      const idx = order.indexOf(currentId);
      const next = idx >= 0 ? (idx + 1) % order.length : 0;
      const id = order[next]!;
      set({ activeBlockId: id });
      scrollActiveBlock(get, id);
    },

    goToPreviousConflict: () => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      const currentId = get().activeBlockId;
      const order = unresolvedConflictOrder(doc);
      if (order.length === 0) {
        set({ activeBlockId: null });
        return;
      }
      // `!` below: `order` is non-empty here, and `prev` is taken modulo its length.
      if (!currentId) {
        const id = order[order.length - 1]!;
        set({ activeBlockId: id });
        scrollActiveBlock(get, id);
        return;
      }
      const idx = order.indexOf(currentId);
      const prev =
        idx >= 0 ? (idx - 1 + order.length) % order.length : order.length - 1;
      const id = order[prev]!;
      set({ activeBlockId: id });
      scrollActiveBlock(get, id);
    },

    goToNextChange: () => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      const currentId = get().activeBlockId;
      const order = doc.changeOrder;
      if (order.length === 0) {
        return;
      }
      // `!` below: `order` is non-empty here, and `next` is taken modulo its length.
      if (!currentId) {
        const id = order[0]!;
        set({ activeBlockId: id });
        scrollActiveBlock(get, id);
        return;
      }
      const idx = order.indexOf(currentId);
      if (
        idx === order.length - 1 &&
        get().goToNextFileAfterLastChange &&
        !doc.dirty
      ) {
        const nextPath = adjacentConflictFilePath(
          get().conflictFiles,
          doc.relativePath,
          "next",
        );
        const opener = get().openConflictFile;
        if (nextPath && opener) {
          set({ pendingChangeNavigation: "first", loading: true });
          opener(nextPath);
          return;
        }
      }
      const next = idx >= 0 ? (idx + 1) % order.length : 0;
      const id = order[next]!;
      set({ activeBlockId: id });
      scrollActiveBlock(get, id);
    },

    goToPreviousChange: () => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      const currentId = get().activeBlockId;
      const order = doc.changeOrder;
      if (order.length === 0) {
        return;
      }
      // `!` below: `order` is non-empty here, and `prev` is taken modulo its length.
      if (!currentId) {
        const id = order[order.length - 1]!;
        set({ activeBlockId: id });
        scrollActiveBlock(get, id);
        return;
      }
      const idx = order.indexOf(currentId);
      if (idx === 0 && get().goToNextFileAfterLastChange && !doc.dirty) {
        const prevPath = adjacentConflictFilePath(
          get().conflictFiles,
          doc.relativePath,
          "previous",
        );
        const opener = get().openConflictFile;
        if (prevPath && opener) {
          set({ pendingChangeNavigation: "last", loading: true });
          opener(prevPath);
          return;
        }
      }
      const prev =
        idx >= 0 ? (idx - 1 + order.length) % order.length : order.length - 1;
      const id = order[prev]!;
      set({ activeBlockId: id });
      scrollActiveBlock(get, id);
    },
  };
}