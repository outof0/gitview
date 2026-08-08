import type { DiffLineSelection } from "@gitview/shared/types/diff";
import type { WhitespacePolicy } from "../../../stores/gitViewStore";

export type DiffHunkPanelProps = {
  left: { label: string; text: string };
  right: { label: string; text: string };
  /** Repo-relative path — drives syntax highlighting per language. */
  filePath?: string | null;
  whitespacePolicy?: WhitespacePolicy;
  showHunkActions?: boolean;
  showLineActions?: boolean;
  stagedView?: boolean;
  busy?: boolean;
  selectedLineKeys?: Set<string>;
  onToggleLine?: (selection: DiffLineSelection, shiftKey: boolean) => void;
  onStageLines?: (lines: DiffLineSelection[]) => void;
  onUnstageLines?: (lines: DiffLineSelection[]) => void;
  onClearLineSelection?: () => void;
  onStageHunk?: (hunkIndex: number) => void;
  onUnstageHunk?: (hunkIndex: number) => void;
  onShelveHunk?: (hunkIndex: number) => void;
  showLogActions?: boolean;
  canDropSelected?: boolean;
  onCherryPickHunk?: (hunkIndex: number) => void;
  onRevertHunk?: (hunkIndex: number) => void;
  onDropHunk?: (hunkIndex: number) => void;
  onCherryPickLines?: (lines: DiffLineSelection[]) => void;
  onRevertLines?: (lines: DiffLineSelection[]) => void;
  onDropLines?: (lines: DiffLineSelection[]) => void;
};