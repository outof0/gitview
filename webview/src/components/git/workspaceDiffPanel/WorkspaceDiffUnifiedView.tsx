import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import type { DiffLineSelection } from "@gitview/shared/types/diff";
import {
  buildDiffDisplayRows,
  type DiffDisplayRow,
  type DiffLineHighlight,
} from "../buildDiffDisplayRows";
import { groupDiffHunks } from "../../../lib/groupDiffHunks";
import {
  lineSelectionKey,
  selectionsFromKeys,
} from "../../../lib/diffLineSelection";
import { ScrollArea } from "../../ui/ScrollArea";
import { HunkActionBar, LineActionBar } from "./WorkspaceDiffActionBars";
import { UnifiedCodeLine } from "./WorkspaceDiffCodeLines";
import type { DiffHunkPanelProps } from "./workspaceDiffPanelTypes";

const DIFF_ROW_HEIGHT = 18;
const HUNK_ACTION_HEIGHT = 30;
const VIRTUAL_OVERSCAN = 360;

type UnifiedLine = {
  prefix: " " | "-" | "+";
  lineNum: number | null;
  text: string;
  highlight: DiffLineHighlight;
  selection: DiffLineSelection | null;
  testSide: "old" | "new";
};

type UnifiedRenderItem =
  | { kind: "hunk"; hunkId: number; offset: number; height: number }
  | {
      kind: "line";
      key: string;
      line: UnifiedLine;
      offset: number;
      height: number;
    };

function linesForRow(row: DiffDisplayRow): UnifiedLine[] {
  if (row.leftHighlight === "none" && row.rightHighlight === "none") {
    return [{
      prefix: " ",
      lineNum: row.leftNum ?? row.rightNum,
      text: row.leftText || row.rightText,
      highlight: "none",
      selection: null,
      testSide: "old",
    }];
  }
  const lines: UnifiedLine[] = [];
  if (row.leftNum !== null && row.leftHighlight !== "none") {
    lines.push({
      prefix: "-",
      lineNum: row.leftNum,
      text: row.leftText,
      highlight: row.leftHighlight,
      selection: { side: "old", line: row.leftNum },
      testSide: "old",
    });
  }
  if (row.rightNum !== null && row.rightHighlight !== "none") {
    lines.push({
      prefix: "+",
      lineNum: row.rightNum,
      text: row.rightText,
      highlight: row.rightHighlight,
      selection: { side: "new", line: row.rightNum },
      testSide: "new",
    });
  }
  return lines;
}

function firstItemEndingAfter(items: UnifiedRenderItem[], offset: number): number {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const item = items[middle]!;
    if (item.offset + item.height < offset) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

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
  onDropHunk,
  onCherryPickLines,
  onRevertLines,
  onDropLines,
}: DiffHunkPanelProps) {
  const rows = useMemo(
    () => buildDiffDisplayRows(left.text, right.text, { whitespacePolicy }),
    [left.text, right.text, whitespacePolicy],
  );
  const hunkByRow = useMemo(() => {
    const nextHunks = groupDiffHunks(rows);
    const nextHunkByRow = new Map<number, number>();
    for (const hunk of nextHunks) {
      for (let i = hunk.startRow; i <= hunk.endRow; i++) {
        nextHunkByRow.set(i, hunk.id);
      }
    }
    return nextHunkByRow;
  }, [rows]);
  const { renderItems, totalHeight, contentWidth } = useMemo(() => {
    const items: UnifiedRenderItem[] = [];
    let offset = 0;
    let width = 0;
    let lastHunk: number | null = null;
    rows.forEach((row, rowIndex) => {
      const hunkId = hunkByRow.get(rowIndex) ?? null;
      if (showHunkActions && hunkId !== null && hunkId !== lastHunk) {
        items.push({
          kind: "hunk",
          hunkId,
          offset,
          height: HUNK_ACTION_HEIGHT,
        });
        offset += HUNK_ACTION_HEIGHT;
        lastHunk = hunkId;
      }
      linesForRow(row).forEach((line, lineIndex) => {
        width = Math.max(width, line.text.length);
        items.push({
          kind: "line",
          key: `${rowIndex}-${lineIndex}`,
          line,
          offset,
          height: DIFF_ROW_HEIGHT,
        });
        offset += DIFF_ROW_HEIGHT;
      });
    });
    return { renderItems: items, totalHeight: offset, contentWidth: width };
  }, [hunkByRow, rows, showHunkActions]);
  const firstChangeOffset = useMemo(() => {
    const firstChangedItem = renderItems.find(
      (item) => item.kind === "line" && item.line.highlight !== "none",
    );
    return firstChangedItem?.offset ?? 0;
  }, [renderItems]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(720);
  const autoScrollKeyRef = useRef<{ left: string; right: string } | null>(
    null,
  );

  useEffect(() => {
    const previous = autoScrollKeyRef.current;
    if (previous?.left === left.text && previous.right === right.text) {
      return;
    }
    autoScrollKeyRef.current = { left: left.text, right: right.text };

    const target = Math.max(0, firstChangeOffset - DIFF_ROW_HEIGHT * 2);
    setScrollTop(target);
    const applyScroll = () => {
      const element = scrollRef.current;
      const maxScroll = element
        ? Math.max(0, element.scrollHeight - element.clientHeight)
        : target;
      const nextScrollTop = Math.min(target, maxScroll);
      if (element) {
        element.scrollTop = nextScrollTop;
      }
      setScrollTop(nextScrollTop);
    };
    applyScroll();
    const frame = window.requestAnimationFrame(applyScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [firstChangeOffset, left.text, right.text]);
  const selectedCount = selectedLineKeys?.size ?? 0;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setViewportHeight(entry.contentRect.height);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const start = firstItemEndingAfter(
    renderItems,
    Math.max(0, scrollTop - VIRTUAL_OVERSCAN),
  );
  const end = firstItemEndingAfter(
    renderItems,
    scrollTop + viewportHeight + VIRTUAL_OVERSCAN,
  );
  const visibleItems = renderItems.slice(
    start,
    Math.min(renderItems.length, end + 1),
  );

  return (
    <div
      className="flex-1 min-h-0 flex flex-col overflow-hidden bg-vscode-editor-bg"
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
      <div className="h-7 px-3 flex items-center text-ui-sm font-semibold text-vscode-description border-b border-border shrink-0">
        {left.label} → {right.label}
      </div>
      <ScrollArea
        ref={scrollRef}
        axis="both"
        className="flex-1 font-mono text-ui-sm leading-code text-vscode-editor-fg"
        onScroll={(event: UIEvent<HTMLDivElement>) => {
          setScrollTop(event.currentTarget.scrollTop);
        }}
      >
        <div
          className="relative"
          style={{
            height: totalHeight,
            minWidth: `${Math.max(80, contentWidth + 8)}ch`,
          }}
        >
          {visibleItems.map((item) => (
            <div
              key={item.kind === "hunk" ? `hunk-${item.hunkId}` : item.key}
              className="absolute left-0 right-0"
              style={{ top: item.offset, height: item.height }}
            >
              {item.kind === "hunk" ? (
                <HunkActionBar
                  hunkId={item.hunkId}
                  showStage={!showLogActions && !stagedView}
                  showUnstage={!showLogActions && Boolean(stagedView)}
                  showLogActions={showLogActions}
                  canDropSelected={canDropSelected}
                  busy={busy}
                  onStage={onStageHunk}
                  onUnstage={onUnstageHunk}
                  onShelve={onShelveHunk}
                  onDrop={onDropHunk}
                />
              ) : (
                <UnifiedCodeLine
                  prefix={item.line.prefix}
                  lineNum={item.line.lineNum}
                  text={item.line.text}
                  highlight={item.line.highlight}
                  filePath={filePath}
                  selectable={showLineActions}
                  testId={
                    showLineActions && item.line.selection
                      ? `diff-line-${item.line.testSide}-${item.line.lineNum}`
                      : undefined
                  }
                  selected={
                    item.line.selection
                      ? selectedLineKeys?.has(
                          lineSelectionKey(item.line.selection),
                        ) ?? false
                      : false
                  }
                  onSelect={
                    item.line.selection && onToggleLine
                      ? (shiftKey) =>
                          onToggleLine(item.line.selection!, shiftKey)
                      : undefined
                  }
                />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
