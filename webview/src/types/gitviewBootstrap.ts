import type { BlameLineEntry } from "@gitview/shared/types/blame";
import type { FileDiffView } from "@gitview/types";

export type HistoryBootstrap = {
  path: string;
  isFolder: boolean;
  repoId: string;
};

export type BlameBootstrap = {
  relativePath: string;
  repoId: string;
  lines: BlameLineEntry[];
  headSha?: string | null;
  loading?: boolean;
  truncated?: boolean;
  /** 1-based line from the editor when Annotate was opened. */
  focusLine?: number;
};

export type DiffBootstrap = {
  relativePath: string;
  title: string;
  diff: FileDiffView;
  /** Enables Annotate / Git menu actions inside the compare panel. */
  repoId?: string;
};

export type MergeBootstrap = {
  repoId: string;
};

export type GitViewBootstrap =
  | HistoryBootstrap
  | BlameBootstrap
  | DiffBootstrap
  | MergeBootstrap;

declare global {
  interface Window {
    __GITVIEW_BOOTSTRAP__?: GitViewBootstrap;
  }
}