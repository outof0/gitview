import { type ReactNode } from "react";
import {
  buildDiffDisplayRows,
  type DiffDisplayRow,
  type DiffLineHighlight,
} from "../buildDiffDisplayRows";
import { groupDiffHunks } from "../../../lib/groupDiffHunks";
import {
  lineSelectionKey,
  selectionFromRow,
  selectionsFromKeys,
} from "../../../lib/diffLineSelection";
import { useScrollSync } from "../../../hooks/useScrollSync";
import { HunkActionBar, LineActionBar } from "./WorkspaceDiffActionBars";
import { CodeLine } from "./WorkspaceDiffCodeLines";
import type { DiffHunkPanelProps } from "./workspaceDiffPanelTypes";

export function SplitWithHunks({
  left,
  right,
  filePath,
  whitespacePolicy = "doNotIgnore",
  showHunkActions,
  showLineActions,
  stagedView,
  busy,
  selectedLineKeys,
  onToggleLine,
  onStageLines,
  onUnstageLines,
  onClearLineSelection,
  onStageHunk,
  onUnstageHunk,
  onShelveHunk,
  showLogActions,
  canDropSelected,
  onCherryPickHunk,
  onRevertHunk,
  onDropHunk,
  onCherryPickLines,
  onRevertLines,
  onDropLines,
}: DiffHunkPanelProps) {
  const rows = buildDiffDisplayRows(left.text, right.text, { whitespacePolicy });
  const { registerContainer, handleScroll } = useScrollSync(2);
  const hunks = groupDiffHunks(rows);
  const hunkByRow = new Map<number, number>();
  for (const hunk of hunks) {
    for (let i = hunk.startRow; i <= hunk.endRow; i++) {
      hunkByRow.set(i, hunk.id);
    }
  }
  const selectedCount = selectedLineKeys?.size ?? 0;

  function renderSide(
    side: "left" | "right",
    getNum: (row: DiffDisplayRow) => number | null,
    getText: (row: DiffDisplayRow) => string,
    getHighlight: (row: DiffDisplayRow) => DiffLineHighlight,
  ) {
    const blocks: ReactNode[] = [];
    let lastHunk: number | null = null;

    rows.forEach((row, i) => {
      const hunkId = hunkByRow.get(i) ?? null;
      if (showHunkActions && hunkId !== null && hunkId !== lastHunk) {
        blocks.push(
          <HunkActionBar
            key={`hunk-${side}-${hunkId}`}
            hunkId={hunkId}
            showStage={!showLogActions && !stagedView}
            showUnstage={!showLogActions && Boolean(stagedView)}
            showLogActions={showLogActions}
            canDropSelected={canDropSelected}
            busy={busy}
            onStage={onStageHunk}
            onUnstage={onUnstageHunk}
            onShelve={onShelveHunk}
            onCherryPick={onCherryPickHunk}
            onRevert={onRevertHunk}
            onDrop={onDropHunk}
          />,
        );
        lastHunk = hunkId;
      }
      const selection = selectionFromRow(side, row);
      const lineNum = getNum(row);
      blocks.push(
        <CodeLine
          key={`${side}-${i}`}
          lineNum={lineNum}
          text={getText(row)}
          highlight={getHighlight(row)}
          filePath={filePath}
          selectable={showLineActions}
          testId={
            showLineActions && selection
              ? `diff-line-${side}-${lineNum}`
              : undefined
          }
          selected={
            selection
              ? selectedLineKeys?.has(lineSelectionKey(selection)) ?? false
              : false
          }
          onSelect={
            selection && onToggleLine
              ? (shiftKey) => onToggleLine(selection, shiftKey)
              : undefined
          }
        />,
      );
    });

    return blocks;
  }

  return (
    <div
      className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[var(--vscode-editor-background)]"
      data-testid="git-diff-split"
    >
      {showLineActions && selectedCount > 0 && (
        <LineActionBar
          count={selectedCount}
          showStage={!showLogActions && !stagedView}
          showUnstage={!showLogActions && Boolean(stagedView)}
          showLogActions={showLogActions}
          canDropSelected={canDropSelected}
          busy={busy}
          onStage={
            onStageLines
              ? () => onStageLines(selectionsFromKeys(selectedLineKeys ?? []))
              : undefined
          }
          onUnstage={
            onUnstageLines
              ? () => onUnstageLines(selectionsFromKeys(selectedLineKeys ?? []))
              : undefined
          }
          onCherryPick={
            onCherryPickLines
              ? () => onCherryPickLines(selectionsFromKeys(selectedLineKeys ?? []))
              : undefined
          }
          onRevert={
            onRevertLines
              ? () => onRevertLines(selectionsFromKeys(selectedLineKeys ?? []))
              : undefined
          }
          onDrop={
            onDropLines
              ? () => onDropLines(selectionsFromKeys(selectedLineKeys ?? []))
              : undefined
          }
          onClear={onClearLineSelection}
        />
      )}
      <div className="flex-1 min-h-0 grid grid-cols-2 divide-x divide-border overflow-hidden">
        <div className="min-h-0 flex flex-col overflow-hidden">
          <div className="h-7 px-3 flex items-center text-[11px] font-semibold text-[var(--vscode-descriptionForeground)] border-b border-border shrink-0">
            {left.label}
          </div>
          <div
            ref={registerContainer(0)}
            className="flex-1 overflow-auto font-mono text-[11px] leading-[18px] text-[var(--vscode-editor-foreground)]"
            onScroll={handleScroll(0)}
            data-testid="workspace-diff-left-scroll"
          >
            {renderSide(
              "left",
              (r) => r.leftNum,
              (r) => r.leftText,
              (r) => r.leftHighlight,
            )}
          </div>
        </div>
        <div className="min-h-0 flex flex-col overflow-hidden">
          <div className="h-7 px-3 flex items-center text-[11px] font-semibold text-[var(--vscode-descriptionForeground)] border-b border-border shrink-0">
            {right.label}
          </div>
          <div
            ref={registerContainer(1)}
            className="flex-1 overflow-auto font-mono text-[11px] leading-[18px] text-[var(--vscode-editor-foreground)]"
            onScroll={handleScroll(1)}
            data-testid="workspace-diff-right-scroll"
          >
            {renderSide(
              "right",
              (r) => r.rightNum,
              (r) => r.rightText,
              (r) => r.rightHighlight,
            )}
          </div>
        </div>
      </div>
    </div>
  );
}