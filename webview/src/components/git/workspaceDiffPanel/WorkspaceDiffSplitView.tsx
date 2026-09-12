import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from "react";
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
import { ScrollArea } from "../../ui/ScrollArea";
import { HunkActionBar, LineActionBar } from "./WorkspaceDiffActionBars";
import { CodeLine } from "./WorkspaceDiffCodeLines";
import type { DiffHunkPanelProps } from "./workspaceDiffPanelTypes";

const DIFF_ROW_HEIGHT = 18;
const HUNK_ACTION_HEIGHT = 30;
const VIRTUAL_OVERSCAN = 360;

type SplitRenderItem =
  | { kind: "hunk"; hunkId: number; offset: number; height: number }
  | { kind: "row"; rowIndex: number; offset: number; height: number };

function firstItemEndingAfter(items: SplitRenderItem[], offset: number): number {
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

function VirtualizedDiffSide({
  items,
  totalHeight,
  contentWidth,
  scrollTop,
  registerContainer,
  onScroll,
  renderItem,
  testId,
}: {
  items: SplitRenderItem[];
  totalHeight: number;
  contentWidth: number;
  scrollTop: number;
  registerContainer: (element: HTMLDivElement | null) => void;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  renderItem: (item: SplitRenderItem) => ReactNode;
  testId: string;
}) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [viewportHeight, setViewportHeight] = useState(720);
  const setElement = useCallback(
    (element: HTMLDivElement | null) => {
      elementRef.current = element;
      registerContainer(element);
      if (element?.clientHeight) {
        setViewportHeight(element.clientHeight);
      }
    },
    [registerContainer],
  );

  useEffect(() => {
    const element = elementRef.current;
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
    items,
    Math.max(0, scrollTop - VIRTUAL_OVERSCAN),
  );
  const end = firstItemEndingAfter(
    items,
    scrollTop + viewportHeight + VIRTUAL_OVERSCAN,
  );
  const visibleItems = items.slice(start, Math.min(items.length, end + 1));

  return (
    <ScrollArea
      ref={setElement}
      axis="both"
      className="flex-1 font-mono text-ui-sm leading-code text-vscode-editor-fg"
      onScroll={onScroll}
      data-testid={testId}
    >
      <div
        className="relative"
        style={{
          height: totalHeight,
          minWidth: `${Math.max(80, contentWidth + 6)}ch`,
        }}
      >
        {visibleItems.map((item) => (
          <div
            key={item.kind === "row" ? `row-${item.rowIndex}` : `hunk-${item.hunkId}`}
            className="absolute left-0 right-0"
            style={{ top: item.offset, height: item.height }}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

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
  onDropHunk,
  onCherryPickLines,
  onRevertLines,
  onDropLines,
}: DiffHunkPanelProps) {
  const rows = useMemo(
    () => buildDiffDisplayRows(left.text, right.text, { whitespacePolicy }),
    [left.text, right.text, whitespacePolicy],
  );
  const { registerContainer, handleScroll } = useScrollSync(2);
  const [scrollTop, setScrollTop] = useState(0);
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
  const { renderItems, totalHeight } = useMemo(() => {
    const items: SplitRenderItem[] = [];
    let offset = 0;
    let lastHunk: number | null = null;
    rows.forEach((_row, rowIndex) => {
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
      items.push({
        kind: "row",
        rowIndex,
        offset,
        height: DIFF_ROW_HEIGHT,
      });
      offset += DIFF_ROW_HEIGHT;
    });
    return { renderItems: items, totalHeight: offset };
  }, [hunkByRow, rows, showHunkActions]);
  const firstChangeOffset = useMemo(() => {
    const firstChangedItem = renderItems.find((item) => {
      if (item.kind !== "row") {
        return false;
      }
      const row = rows[item.rowIndex];
      return Boolean(
        row &&
          (row.leftHighlight !== "none" || row.rightHighlight !== "none"),
      );
    });
    return firstChangedItem?.offset ?? 0;
  }, [renderItems, rows]);
  const contentWidth = useMemo(
    () =>
      rows.reduce(
        (width, row) => Math.max(width, row.leftText.length, row.rightText.length),
        0,
      ),
    [rows],
  );
  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);
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
      const leftElement = leftScrollRef.current;
      const rightElement = rightScrollRef.current;
      const maxScroll = Math.min(
        leftElement
          ? Math.max(0, leftElement.scrollHeight - leftElement.clientHeight)
          : target,
        rightElement
          ? Math.max(0, rightElement.scrollHeight - rightElement.clientHeight)
          : target,
      );
      const nextScrollTop = Math.min(target, maxScroll);
      if (leftElement) {
        leftElement.scrollTop = nextScrollTop;
      }
      if (rightElement) {
        rightElement.scrollTop = nextScrollTop;
      }
      setScrollTop(nextScrollTop);
    };
    applyScroll();
    const frame = window.requestAnimationFrame(applyScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [firstChangeOffset, left.text, right.text]);
  const selectedCount = selectedLineKeys?.size ?? 0;

  const renderSideItem = (
    side: "left" | "right",
    getNum: (row: DiffDisplayRow) => number | null,
    getText: (row: DiffDisplayRow) => string,
    getHighlight: (row: DiffDisplayRow) => DiffLineHighlight,
    item: SplitRenderItem,
  ) => {
    if (item.kind === "hunk") {
      return (
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
      );
    }
    const row = rows[item.rowIndex]!;
    const selection = selectionFromRow(side, row);
    const lineNum = getNum(row);
    return (
      <CodeLine
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
      />
    );
  };
  const registerLeft = useCallback(
    (element: HTMLDivElement | null) => {
      leftScrollRef.current = element;
      registerContainer(0)(element);
    },
    [registerContainer],
  );
  const registerRight = useCallback(
    (element: HTMLDivElement | null) => {
      rightScrollRef.current = element;
      registerContainer(1)(element);
    },
    [registerContainer],
  );
  const handleLeftScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      setScrollTop(event.currentTarget.scrollTop);
      handleScroll(0)();
    },
    [handleScroll],
  );
  const handleRightScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      setScrollTop(event.currentTarget.scrollTop);
      handleScroll(1)();
    },
    [handleScroll],
  );

  return (
    <div
      className="flex-1 min-h-0 flex flex-col overflow-hidden bg-vscode-editor-bg"
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
          <div className="h-7 px-3 flex items-center text-ui-sm font-semibold text-vscode-description border-b border-border shrink-0">
            {left.label}
          </div>
          <VirtualizedDiffSide
            items={renderItems}
            totalHeight={totalHeight}
            contentWidth={contentWidth}
            scrollTop={scrollTop}
            registerContainer={registerLeft}
            onScroll={handleLeftScroll}
            testId="workspace-diff-left-scroll"
            renderItem={(item) =>
              renderSideItem(
                "left",
                (r) => r.leftNum,
                (r) => r.leftText,
                (r) => r.leftHighlight,
                item,
              )
            }
          />
        </div>
        <div className="min-h-0 flex flex-col overflow-hidden">
          <div className="h-7 px-3 flex items-center text-ui-sm font-semibold text-vscode-description border-b border-border shrink-0">
            {right.label}
          </div>
          <VirtualizedDiffSide
            items={renderItems}
            totalHeight={totalHeight}
            contentWidth={contentWidth}
            scrollTop={scrollTop}
            registerContainer={registerRight}
            onScroll={handleRightScroll}
            testId="workspace-diff-right-scroll"
            renderItem={(item) =>
              renderSideItem(
                "right",
                (r) => r.rightNum,
                (r) => r.rightText,
                (r) => r.rightHighlight,
                item,
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
