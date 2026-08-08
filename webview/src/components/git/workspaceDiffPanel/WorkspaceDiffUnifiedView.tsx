import { type ReactNode } from "react";
import type { DiffLineSelection } from "@gitview/shared/types/diff";
import {
  buildDiffDisplayRows,
  type DiffLineHighlight,
} from "../buildDiffDisplayRows";
import { groupDiffHunks } from "../../../lib/groupDiffHunks";
import {
  lineSelectionKey,
  selectionsFromKeys,
} from "../../../lib/diffLineSelection";
import { HunkActionBar, LineActionBar } from "./WorkspaceDiffActionBars";
import { UnifiedCodeLine } from "./WorkspaceDiffCodeLines";
import type { DiffHunkPanelProps } from "./workspaceDiffPanelTypes";

export function UnifiedWithHunks({
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
  const hunks = groupDiffHunks(rows);
  const hunkByRow = new Map<number, number>();
  for (const hunk of hunks) {
    for (let i = hunk.startRow; i <= hunk.endRow; i++) {
      hunkByRow.set(i, hunk.id);
    }
  }
  const selectedCount = selectedLineKeys?.size ?? 0;
  let lastHunk: number | null = null;

  const blocks: ReactNode[] = [];
  rows.forEach((row, rowIndex) => {
    const hunkId = hunkByRow.get(rowIndex) ?? null;
    if (showHunkActions && hunkId !== null && hunkId !== lastHunk) {
      blocks.push(
        <HunkActionBar
          key={`hunk-unified-${hunkId}`}
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

    const unifiedLines: Array<{
      prefix: " " | "-" | "+";
      lineNum: number | null;
      text: string;
      highlight: DiffLineHighlight;
      selection: DiffLineSelection | null;
      testSide: "old" | "new";
    }> = [];

    if (row.leftHighlight === "none" && row.rightHighlight === "none") {
      unifiedLines.push({
        prefix: " ",
        lineNum: row.leftNum ?? row.rightNum,
        text: row.leftText || row.rightText,
        highlight: "none",
        selection: null,
        testSide: "old",
      });
    } else {
      if (row.leftNum !== null && row.leftHighlight !== "none") {
        unifiedLines.push({
          prefix: "-",
          lineNum: row.leftNum,
          text: row.leftText,
          highlight: row.leftHighlight,
          selection: { side: "old", line: row.leftNum },
          testSide: "old",
        });
      }
      if (row.rightNum !== null && row.rightHighlight !== "none") {
        unifiedLines.push({
          prefix: "+",
          lineNum: row.rightNum,
          text: row.rightText,
          highlight: row.rightHighlight,
          selection: { side: "new", line: row.rightNum },
          testSide: "new",
        });
      }
    }

    unifiedLines.forEach((line, lineIndex) => {
      blocks.push(
        <UnifiedCodeLine
          key={`unified-${rowIndex}-${lineIndex}`}
          prefix={line.prefix}
          lineNum={line.lineNum}
          text={line.text}
          highlight={line.highlight}
          filePath={filePath}
          selectable={showLineActions}
          testId={
            showLineActions && line.selection
              ? `diff-line-${line.testSide}-${line.lineNum}`
              : undefined
          }
          selected={
            line.selection
              ? selectedLineKeys?.has(lineSelectionKey(line.selection)) ?? false
              : false
          }
          onSelect={
            line.selection && onToggleLine
              ? (shiftKey) => onToggleLine(line.selection!, shiftKey)
              : undefined
          }
        />,
      );
    });
  });

  return (
    <div
      className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[var(--vscode-editor-background)]"
      data-testid="git-diff-unified"
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
      <div className="h-7 px-3 flex items-center text-[11px] font-semibold text-[var(--vscode-descriptionForeground)] border-b border-border shrink-0">
        {left.label} → {right.label}
      </div>
      <div className="flex-1 overflow-auto font-mono text-[11px] leading-[18px] text-[var(--vscode-editor-foreground)]">
        {blocks}
      </div>
    </div>
  );
}