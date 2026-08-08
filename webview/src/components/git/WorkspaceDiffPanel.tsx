import { useEffect, useState } from "react";
import type { DiffLineSelection, WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import { changedFileStatusLabel } from "./changedFileStatus";
import {
  lineSelectionKey,
} from "../../lib/diffLineSelection";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import type { WhitespacePolicy } from "../../stores/gitViewStore";
import { WHITESPACE_LABELS, toFileDiffView } from "./workspaceDiffPanel/workspaceDiffPanelUtils";
import { SplitWithHunks } from "./workspaceDiffPanel/WorkspaceDiffSplitView";
import { UnifiedWithHunks } from "./workspaceDiffPanel/WorkspaceDiffUnifiedView";
import { MonacoDiffViewer } from "./MonacoDiffViewer";

type WorkspaceDiffPanelProps = {
  document: WorkspaceDiffDocument | null;
  filePath: string | null;
  loading?: boolean;
  error?: string | null;
  showHunkActions?: boolean;
  stagedView?: boolean;
  busy?: boolean;
  onStageHunk?: (hunkIndex: number) => void;
  onUnstageHunk?: (hunkIndex: number) => void;
  onStageLines?: (lines: DiffLineSelection[]) => void;
  onUnstageLines?: (lines: DiffLineSelection[]) => void;
  onShelveHunk?: (hunkIndex: number) => void;
  showLogActions?: boolean;
  canDropSelected?: boolean;
  onCherryPickHunk?: (hunkIndex: number) => void;
  onRevertHunk?: (hunkIndex: number) => void;
  onDropHunk?: (hunkIndex: number) => void;
  onCherryPickLines?: (lines: DiffLineSelection[]) => void;
  onRevertLines?: (lines: DiffLineSelection[]) => void;
  onDropLines?: (lines: DiffLineSelection[]) => void;
  onToggleStagedView?: () => void;
  borderless?: boolean;
};

function clearSelection(
  setSelectedLineKeys: (keys: Set<string>) => void,
  setRangeAnchor: (anchor: DiffLineSelection | null) => void,
) {
  setSelectedLineKeys(new Set());
  setRangeAnchor(null);
}

export function WorkspaceDiffPanel({
  document,
  filePath,
  loading = false,
  error = null,
  showHunkActions = false,
  stagedView = false,
  busy = false,
  onStageHunk,
  onUnstageHunk,
  onStageLines,
  onUnstageLines,
  onShelveHunk,
  showLogActions = false,
  canDropSelected = false,
  onCherryPickHunk,
  onRevertHunk,
  onDropHunk,
  onCherryPickLines,
  onRevertLines,
  onDropLines,
  onToggleStagedView,
  borderless = false,
}: WorkspaceDiffPanelProps) {
  const diffViewMode = useGitWorkspaceStore((s) => s.diffViewMode);
  const whitespacePolicy = useGitWorkspaceStore((s) => s.whitespacePolicy);
  const setDiffViewMode = useGitWorkspaceStore((s) => s.setDiffViewMode);
  const setWhitespacePolicy = useGitWorkspaceStore((s) => s.setWhitespacePolicy);
  const diff = document ? toFileDiffView(document) : null;
  const [selectedLineKeys, setSelectedLineKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [rangeAnchor, setRangeAnchor] = useState<DiffLineSelection | null>(null);

  useEffect(() => {
    setSelectedLineKeys(new Set());
    setRangeAnchor(null);
  }, [filePath, stagedView, diffViewMode, whitespacePolicy]);

  const toggleLine = (selection: DiffLineSelection, shiftKey: boolean) => {
    const key = lineSelectionKey(selection);
    setSelectedLineKeys((prev) => {
      const next = new Set(prev);
      if (shiftKey && rangeAnchor && rangeAnchor.side === selection.side) {
        const start = Math.min(rangeAnchor.line, selection.line);
        const end = Math.max(rangeAnchor.line, selection.line);
        for (let line = start; line <= end; line += 1) {
          next.add(lineSelectionKey({ side: selection.side, line }));
        }
        return next;
      }
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    if (!shiftKey) {
      setRangeAnchor(selection);
    }
  };

  const hunkPanelProps = {
    whitespacePolicy,
    showHunkActions: showHunkActions || showLogActions,
    showLineActions: showHunkActions || showLogActions,
    stagedView,
    busy,
    filePath,
    selectedLineKeys,
    onToggleLine: toggleLine,
    onStageLines: onStageLines
      ? (lines: DiffLineSelection[]) => {
        onStageLines(lines);
        clearSelection(setSelectedLineKeys, setRangeAnchor);
      }
      : undefined,
    onUnstageLines: onUnstageLines
      ? (lines: DiffLineSelection[]) => {
        onUnstageLines(lines);
        clearSelection(setSelectedLineKeys, setRangeAnchor);
      }
      : undefined,
    onClearLineSelection: () => clearSelection(setSelectedLineKeys, setRangeAnchor),
    onStageHunk,
    onUnstageHunk,
    onShelveHunk,
    showLogActions,
    canDropSelected,
    onCherryPickHunk,
    onRevertHunk,
    onDropHunk,
    onCherryPickLines: onCherryPickLines
      ? (lines: DiffLineSelection[]) => {
        onCherryPickLines(lines);
        clearSelection(setSelectedLineKeys, setRangeAnchor);
      }
      : undefined,
    onRevertLines: onRevertLines
      ? (lines: DiffLineSelection[]) => {
        onRevertLines(lines);
        clearSelection(setSelectedLineKeys, setRangeAnchor);
      }
      : undefined,
    onDropLines: onDropLines
      ? (lines: DiffLineSelection[]) => {
        onDropLines(lines);
        clearSelection(setSelectedLineKeys, setRangeAnchor);
      }
      : undefined,
  };

  return (
    <div
      className={`flex-1 min-h-0 flex flex-col ${borderless ? "" : "border-l border-border"}`}
      data-testid="workspace-diff-panel"
    >
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-border min-h-[32px]">
        {filePath && (
          <span className="text-[11px] font-mono truncate flex-1">{filePath}</span>
        )}
        {diff && !diff.binary && diff.layout === "split" && (
          <>
            <button
              type="button"
              className="h-6 px-2 text-[10px] rounded-vscode border border-border hover:bg-list-hover"
              onClick={() =>
                setDiffViewMode(
                  diffViewMode === "side_by_side" ? "unified" : "side_by_side",
                )
              }
              data-testid="diff-view-mode-toggle"
            >
              {diffViewMode === "side_by_side" ? "Unified" : "Side-by-side"}
            </button>
            <select
              className="h-6 px-1 text-[10px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
              value={whitespacePolicy}
              onChange={(event) =>
                setWhitespacePolicy(event.target.value as WhitespacePolicy)
              }
              data-testid="diff-whitespace-policy"
              aria-label="Whitespace policy"
            >
              {(Object.keys(WHITESPACE_LABELS) as WhitespacePolicy[]).map(
                (policy) => (
                  <option key={policy} value={policy}>
                    {WHITESPACE_LABELS[policy]}
                  </option>
                ),
              )}
            </select>
          </>
        )}
        {showHunkActions && onToggleStagedView && (
          <button
            type="button"
            className="h-6 px-2 text-[10px] rounded-vscode border border-border hover:bg-list-hover"
            onClick={onToggleStagedView}
            data-testid="diff-staged-toggle"
          >
            {stagedView ? "Staged" : "Working tree"}
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading && (
          <div className="p-3 text-[12px] text-[var(--vscode-descriptionForeground)]">
            Loading diff preview…
          </div>
        )}
        {!loading && error && (
          <div className="p-3 text-[12px] text-[var(--vscode-errorForeground,#f48771)]">
            {error}
          </div>
        )}
        {!loading && !error && !diff && (
          <div className="p-3 text-[12px] text-[var(--vscode-descriptionForeground)]">
            Select a changed file to preview its diff.
          </div>
        )}
        {!loading && !error && diff?.binary && (
          <div className="p-3 text-[12px] text-[var(--vscode-descriptionForeground)]">
            Binary file ({changedFileStatusLabel(diff.status)}) — preview not
            available.
          </div>
        )}
        {!loading && !error && diff && !diff.binary && diff.layout === "split" && diff.left && diff.right && (
          <div className="h-full min-h-0 flex flex-col" data-testid="git-diff-preview">
            {diffViewMode === "unified" ? (
              <UnifiedWithHunks
                left={diff.left}
                right={diff.right}
                {...hunkPanelProps}
              />
            ) : showHunkActions || showLogActions ? (
              <SplitWithHunks
                left={diff.left}
                right={diff.right}
                {...hunkPanelProps}
              />
            ) : (
              // Compare / branch-compare: full Monaco (syntax + native scroll sync)
              <MonacoDiffViewer
                leftText={diff.left.text}
                rightText={diff.right.text}
                leftLabel={diff.left.label}
                rightLabel={diff.right.label}
                filePath={filePath}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}