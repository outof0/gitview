import { create } from "zustand";
import type { BlameSide, GitCommitEntry } from "@gitview/types";

export type GitHistoryPanelState = {
  open: boolean;
  path: string;
  isFolder: boolean;
  loading: boolean;
  error: string | null;
  commits: GitCommitEntry[];
  selectedSha: string | null;
};

export type ChangesFromSidePanelState = {
  open: boolean;
  side: BlameSide;
  relativePath: string;
  branchLabel: string;
  filterByFile: boolean;
  loading: boolean;
  error: string | null;
  mergeBase: string | null;
  revisionRange: string | null;
  branchRef: string | null;
  commits: GitCommitEntry[];
  allChangedPaths: string[];
  selectedSha: string | null;
  /** Side revision text preview (from MergeDocument). */
  previewText: string;
};

type GitPanelStore = {
  history: GitHistoryPanelState;
  changesFromSide: ChangesFromSidePanelState;

  openGitHistory: (path: string, isFolder: boolean) => void;
  closeGitHistory: () => void;
  setGitHistoryLoading: (loading: boolean) => void;
  setGitHistoryResult: (payload: {
    path: string;
    commits?: GitCommitEntry[];
    error?: { message: string };
  }) => void;
  selectHistoryCommit: (sha: string | null) => void;

  openChangesFromSide: (opts: {
    side: BlameSide;
    relativePath: string;
    branchLabel: string;
    previewText: string;
    filterByFile?: boolean;
  }) => void;
  closeChangesFromSide: () => void;
  setChangesFromSideFilter: (filterByFile: boolean) => void;
  setChangesFromSideLoading: (loading: boolean) => void;
  setChangesFromSideResult: (payload: {
    side: BlameSide;
    relativePath?: string;
    mergeBase?: string;
    revisionRange?: string;
    branchRef?: string;
    commits?: GitCommitEntry[];
    allChangedPaths?: string[];
    error?: { message: string };
  }) => void;
  selectChangesCommit: (sha: string | null) => void;
};

/** Treat "." and "./" as the same repo-root folder path for result matching. */
export function normalizeGitHistoryPath(path: string): string {
  if (!path || path === "./") {
    return ".";
  }
  return path;
}

const closedHistory = (): GitHistoryPanelState => ({
  open: false,
  path: "",
  isFolder: false,
  loading: false,
  error: null,
  commits: [],
  selectedSha: null,
});

const closedChanges = (): ChangesFromSidePanelState => ({
  open: false,
  side: "ours",
  relativePath: "",
  branchLabel: "",
  filterByFile: true,
  loading: false,
  error: null,
  mergeBase: null,
  revisionRange: null,
  branchRef: null,
  commits: [],
  allChangedPaths: [],
  selectedSha: null,
  previewText: "",
});

export const useGitPanelStore = create<GitPanelStore>((set, get) => ({
  history: closedHistory(),
  changesFromSide: closedChanges(),

  openGitHistory: (path, isFolder) => {
    set({
      history: {
        open: true,
        path,
        isFolder,
        loading: true,
        error: null,
        commits: [],
        selectedSha: null,
      },
    });
  },

  closeGitHistory: () => set({ history: closedHistory() }),

  setGitHistoryLoading: (loading) =>
    set((s) => ({ history: { ...s.history, loading } })),

  setGitHistoryResult: (payload) => {
    const { history } = get();
    if (
      !history.open ||
      normalizeGitHistoryPath(history.path) !==
        normalizeGitHistoryPath(payload.path)
    ) {
      return;
    }
    if (payload.error) {
      set({
        history: {
          ...history,
          loading: false,
          error: payload.error.message,
          commits: [],
          selectedSha: null,
        },
      });
      return;
    }
    const commits = payload.commits ?? [];
    set({
      history: {
        ...history,
        loading: false,
        error: null,
        commits,
        selectedSha: commits[0]?.sha ?? null,
      },
    });
  },

  selectHistoryCommit: (sha) =>
    set((s) => ({ history: { ...s.history, selectedSha: sha } })),

  openChangesFromSide: (opts) => {
    set({
      changesFromSide: {
        open: true,
        side: opts.side,
        relativePath: opts.relativePath,
        branchLabel: opts.branchLabel,
        filterByFile: opts.filterByFile ?? true,
        loading: true,
        error: null,
        mergeBase: null,
        revisionRange: null,
        branchRef: null,
        commits: [],
        allChangedPaths: [],
        selectedSha: null,
        previewText: opts.previewText,
      },
    });
  },

  closeChangesFromSide: () => set({ changesFromSide: closedChanges() }),

  setChangesFromSideFilter: (filterByFile) => {
    set((s) => ({
      changesFromSide: { ...s.changesFromSide, filterByFile, loading: true },
    }));
  },

  setChangesFromSideLoading: (loading) =>
    set((s) => ({
      changesFromSide: { ...s.changesFromSide, loading },
    })),

  setChangesFromSideResult: (payload) => {
    const { changesFromSide } = get();
    if (!changesFromSide.open || changesFromSide.side !== payload.side) {
      return;
    }
    if (payload.error) {
      set({
        changesFromSide: {
          ...changesFromSide,
          loading: false,
          error: payload.error.message,
          commits: [],
          allChangedPaths: [],
          selectedSha: null,
        },
      });
      return;
    }
    const commits = payload.commits ?? [];
    set({
      changesFromSide: {
        ...changesFromSide,
        loading: false,
        error: null,
        mergeBase: payload.mergeBase ?? null,
        revisionRange: payload.revisionRange ?? null,
        branchRef: payload.branchRef ?? null,
        commits,
        allChangedPaths: payload.allChangedPaths ?? [],
        selectedSha: commits[0]?.sha ?? null,
      },
    });
  },

  selectChangesCommit: (sha) =>
    set((s) => ({
      changesFromSide: { ...s.changesFromSide, selectedSha: sha },
    })),
}));
