import type { FileDiffView } from "../../types/blame";

/** Workspace diff payload shared between host and webview. */

/** Standalone git diff panel preview (gitDiff surface — not workspace diff). */
export type StandaloneDiffPreview = {
  relativePath: string;
  title: string;
  diff: FileDiffView;
  /** Repo id for blame.query / git.menuAction from the compare webview. */
  repoId?: string;
};

export type DiffLineSelection = {
  side: "old" | "new";
  line: number;
};

export type WorkspaceDiffPanel = {
  label: string;
  text: string;
};

export type WorkspaceDiffDocument = {
  repoId: string;
  filePath: string;
  layout: "single" | "split";
  status: "A" | "M" | "D" | "R" | "U";
  left: WorkspaceDiffPanel | null;
  right: WorkspaceDiffPanel | null;
  binary: boolean;
  staged: boolean;
  readOnly?: boolean;
  compareMode?: "branchCurrent" | "branchWorkingTree";
};