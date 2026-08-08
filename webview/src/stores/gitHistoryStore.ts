import { create } from "zustand";
import type {
  FileDiffView,
  GitChangedFile,
  GitChangedFileStatus,
  GitCommitEntry,
} from "@gitview/types";
import {
  filterChangedFilesForScope,
  pickDefaultChangedFile,
} from "../components/git/changedFilesTree";
import { findCommit } from "../components/git/gitPanelFormat";
import { normalizeGitHistoryPath } from "./gitPanelStore";

export type GitHistoryStore = {
  path: string;
  isFolder: boolean;
  repoId: string | null;
  repoRoot: string | null;
  branches: string[];
  branchFilter: string;
  searchQuery: string;
  /** Author filter (JB Log "User"). Empty = All. */
  authorFilter: string;
  /**
   * Left branch tree visibility. Default false — Show History must not
   * dump a static expanded branch list (user expands when needed).
   */
  branchTreeOpen: boolean;
  /**
   * Inline diff under files+details. Default true for Show History so
   * selecting a changed file loads parent↔commit diff. Annotate turns this
   * off and opens a Diff Viewer tab instead.
   */
  showDiffPreview: boolean;
  showDetails: boolean;
  loading: boolean;
  error: string | null;
  commits: GitCommitEntry[];
  selectedSha: string | null;
  /** File whose diff is shown in the preview pane. */
  selectedChangedFilePath: string | null;
  fileDiff: FileDiffView | null;
  patchLoading: boolean;
  patchError: string | null;
  /** Annotate view: full commit file list + open diffs in new tabs. */
  annotateMode: boolean;
  /** Waiting for log.commitDetail — avoid showing file-scoped log entries. */
  commitDetailLoading: boolean;

  init: (payload: {
    path: string;
    isFolder: boolean;
    repoId: string;
    branches: string[];
    currentBranch: string;
  }) => void;
  setBranchFilter: (branch: string) => void;
  setSearchQuery: (q: string) => void;
  setAuthorFilter: (author: string) => void;
  setBranchTreeOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
  setLogResult: (payload: {
    path?: string;
    branch?: string;
    commits?: GitCommitEntry[];
    error?: string;
  }) => void;
  selectCommit: (sha: string | null) => void;
  applyCommitDetail: (commit: GitCommitEntry) => void;
  setCommitDetailError: (message: string) => void;
  selectChangedFile: (path: string) => void;
  setPatchLoading: (loading: boolean) => void;
  changedFilesForSelection: () => GitChangedFile[];
  setFileDiffResult: (payload: {
    sha?: string;
    path?: string;
    diff?: FileDiffView;
    error?: string;
  }) => void;
  selectedChangedFileStatus: () => GitChangedFileStatus | undefined;
  filteredCommits: () => GitCommitEntry[];
};

export const useGitHistoryStore = create<GitHistoryStore>((set, get) => ({
  path: "",
  isFolder: false,
  repoId: null,
  repoRoot: null,
  branches: [],
  branchFilter: "",
  searchQuery: "",
  authorFilter: "",
  branchTreeOpen: false,
  /** Show History: load file diffs on select. Annotate sets false. */
  showDiffPreview: true,
  showDetails: true,
  loading: false,
  error: null,
  commits: [],
  selectedSha: null,
  selectedChangedFilePath: null,
  fileDiff: null,
  patchLoading: false,
  patchError: null,
  annotateMode: false,
  commitDetailLoading: false,

  init: (payload) => {
    set({
      path: payload.path,
      isFolder: payload.isFolder,
      repoId: payload.repoId,
      repoRoot: null,
      branches: payload.branches,
      branchFilter: payload.currentBranch,
      searchQuery: "",
      authorFilter: "",
      // File/folder history opens with branch pane closed; user expands on demand.
      branchTreeOpen: false,
      // Always enable inline diff so click on a changed file loads preview.
      // Annotate mode overwrites this after init via GitBlameApp.
      showDiffPreview: true,
      showDetails: true,
      loading: true,
      error: null,
      commits: [],
      selectedSha: null,
      selectedChangedFilePath: null,
      fileDiff: null,
      patchLoading: false,
      patchError: null,
    });
  },

  setBranchFilter: (branchFilter) =>
    set({
      branchFilter,
      loading: true,
      fileDiff: null,
      patchError: null,
      selectedChangedFilePath: null,
    }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setAuthorFilter: (authorFilter) => set({ authorFilter }),

  setBranchTreeOpen: (branchTreeOpen) => set({ branchTreeOpen }),

  setLoading: (loading) => set({ loading }),

  setLogResult: (payload) => {
    const state = get();
    if (
      payload.path !== undefined &&
      normalizeGitHistoryPath(state.path) !==
        normalizeGitHistoryPath(payload.path)
    ) {
      return;
    }
    // Empty branchFilter means "no explicit filter" (annotate / initial load).
    // Host snapshots still report the resolved branch (e.g. "master"); do not
    // drop those results or the log pane stays on "Loading history…" forever.
    if (
      payload.branch !== undefined &&
      state.branchFilter !== "" &&
      payload.branch !== state.branchFilter
    ) {
      return;
    }
    if (payload.error) {
      set({
        loading: false,
        error: payload.error,
        commits: [],
        selectedSha: null,
        selectedChangedFilePath: null,
      });
      return;
    }
    const commits = payload.commits ?? [];
    const first = commits[0] ?? null;
    const annotateMode = get().annotateMode;
    const path = get().path;
    const isFolder = get().isFolder;
    const scoped = first
      ? filterChangedFilesForScope(first.changedFiles, path, isFolder)
      : [];
    // File history (JB): always diff the scoped file; folder log uses tree default.
    const defaultFile =
      first && !annotateMode
        ? !isFolder && path
          ? path
          : pickDefaultChangedFile(scoped, path, isFolder)
        : null;
    set({
      loading: false,
      error: null,
      commits,
      selectedSha: first?.sha ?? null,
      selectedChangedFilePath: defaultFile,
      fileDiff: null,
      patchLoading: !!defaultFile && get().showDiffPreview && !annotateMode,
      patchError: null,
      commitDetailLoading: annotateMode && !!first,
    });
  },

  selectCommit: (sha) => {
    const { commits, path, isFolder, showDiffPreview, annotateMode } = get();
    const commit = findCommit(commits, sha);
    const files = commit
      ? annotateMode
        ? []
        : filterChangedFilesForScope(commit.changedFiles, path, isFolder)
      : [];
    const defaultFile = commit
      ? annotateMode
        ? null
        : !isFolder && path
          ? path
          : pickDefaultChangedFile(files, path, isFolder)
      : null;
    set({
      selectedSha: sha,
      selectedChangedFilePath: defaultFile,
      fileDiff: null,
      patchLoading: !!defaultFile && showDiffPreview && !annotateMode,
      patchError: null,
      commitDetailLoading: annotateMode && !!sha,
    });
  },

  applyCommitDetail: (commit) => {
    const { commits, path, isFolder, annotateMode } = get();
    const nextCommits = commits.some((c) => c.sha === commit.sha)
      ? commits.map((c) =>
          c.sha === commit.sha
            ? { ...c, ...commit, changedFiles: commit.changedFiles }
            : c,
        )
      : [commit, ...commits];
    const files = annotateMode
      ? commit.changedFiles
      : filterChangedFilesForScope(commit.changedFiles, path, isFolder);
    const defaultFile = pickDefaultChangedFile(files, path, isFolder);
    set({
      commits: nextCommits,
      selectedSha: commit.sha,
      selectedChangedFilePath: defaultFile,
      fileDiff: null,
      patchLoading: false,
      patchError: null,
      commitDetailLoading: false,
    });
  },

  setCommitDetailError: (message) =>
    set({
      commitDetailLoading: false,
      error: message,
    }),

  selectChangedFile: (path) =>
    set({
      selectedChangedFilePath: path,
      fileDiff: null,
      patchLoading: get().showDiffPreview && !get().annotateMode,
      patchError: null,
    }),

  selectedChangedFileStatus: () => {
    const { selectedChangedFilePath } = get();
    if (!selectedChangedFilePath) {
      return undefined;
    }
    return get()
      .changedFilesForSelection()
      .find((f) => f.path === selectedChangedFilePath)?.status;
  },

  changedFilesForSelection: () => {
    const { commits, selectedSha, path, isFolder, annotateMode, commitDetailLoading } =
      get();
    const commit = findCommit(commits, selectedSha);
    if (!commit || (annotateMode && commitDetailLoading)) {
      return [];
    }
    if (annotateMode) {
      return commit.changedFiles;
    }
    return filterChangedFilesForScope(commit.changedFiles, path, isFolder);
  },

  setPatchLoading: (patchLoading) => set({ patchLoading }),

  setFileDiffResult: (payload) => {
    const state = get();
    if (
      payload.path !== undefined &&
      payload.path !== state.selectedChangedFilePath
    ) {
      return;
    }
    if (payload.sha !== undefined && payload.sha !== state.selectedSha) {
      return;
    }
    if (payload.error) {
      set({
        patchLoading: false,
        patchError: payload.error,
        fileDiff: null,
      });
      return;
    }
    set({
      patchLoading: false,
      patchError: null,
      fileDiff: payload.diff ?? null,
    });
  },

  filteredCommits: () => {
    const { commits, searchQuery, authorFilter } = get();
    const q = searchQuery.trim().toLowerCase();
    const author = authorFilter.trim().toLowerCase();
    return commits.filter((c) => {
      if (author && c.author.toLowerCase() !== author) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        c.subject.toLowerCase().includes(q) ||
        c.sha.toLowerCase().includes(q) ||
        c.shortSha.toLowerCase().includes(q) ||
        c.author.toLowerCase().includes(q) ||
        (c.refs?.some((r) => r.toLowerCase().includes(q)) ?? false)
      );
    });
  },
}));
