/**
 * Side-by-side Compare with an optional per-line Annotate column.
 * Annotated panes mirror around the centre, and each side toggles on its own.
 * Clicking a blame cell drives the shared log pane below — no new tab.
 */

import { useMemo, useState, type ReactNode, type MouseEvent } from "react";
import {
  buildDiffDisplayRows,
  type DiffDisplayRow,
  type DiffLineHighlight,
} from "./buildDiffDisplayRows";
import { HighlightedCodeLine } from "./HighlightedCodeLine";
import { useScrollSync } from "../../hooks/useScrollSync";
import { ResizableSplit } from "../ui/ResizableSplit";
import { cn } from "../../lib/cn";
import {
  blameBlockBackground,
  formatBlameAnnotationLabel,
} from "../../lib/blameFormat";
import type { BlameLineEntry } from "@gitview/shared/types/blame";

export type CompareContextMenuEvent = {
  x: number;
  y: number;
  lineNumber: number;
  side: "left" | "right";
};

type CompareSplitViewProps = {
  left: { label: string; text: string };
  right: { label: string; text: string };
  filePath?: string | null;
  hideHeaders?: boolean;
  /** Per-line blame (Annotate) column, toggled independently per side. */
  annotateLeft?: boolean;
  annotateRight?: boolean;
  leftBlame?: BlameLineEntry[] | null;
  rightBlame?: BlameLineEntry[] | null;
  leftBlameLoading?: boolean;
  rightBlameLoading?: boolean;
  selectedSha?: string | null;
  /** Log pane rendered below the panes while Annotate is on. */
  bottomPanel?: ReactNode;
  onSelectBlame?: (sha: string, side: "left" | "right", lineNumber: number) => void;
  onContextMenu?: (event: CompareContextMenuEvent) => void;
};

function highlightClass(side: DiffLineHighlight): string {
  switch (side) {
    case "removed":
      return "nx-hl-removed";
    case "added":
      return "nx-hl-added";
    case "changed":
      return "nx-hl-changed";
    default:
      return "nx-hl-none";
  }
}

function indexBlame(
  lines: BlameLineEntry[] | null | undefined,
): Map<number, BlameLineEntry> {
  const map = new Map<number, BlameLineEntry>();
  if (!lines) {
    return map;
  }
  for (const line of lines) {
    map.set(line.lineNumber, line);
  }
  return map;
}

const BLAME_WIDTH = 120;
const LINE_WIDTH = 40;

const BLAME_CELL_BASE =
  "nx-blame nx-diff-gutter shrink-0 w-[120px] bg-[var(--vscode-editorGutter-background,var(--vscode-editor-background))]";

function BlameCell({
  entry,
  loading,
  selected,
  onClick,
  edge,
}: {
  entry: BlameLineEntry | null;
  loading?: boolean;
  selected?: boolean;
  onClick?: (e: MouseEvent) => void;
  /** Which side of the code column the gutter sits on. */
  edge: "leading" | "trailing";
}) {
  const border = edge === "leading" ? "border-r" : "border-l";
  // Outermost gutter: pins to the scrollport edge while long lines scroll.
  const pin = edge === "leading" ? { left: 0 } : { right: 0 };
  if (loading) {
    return (
      <span
        className={cn(
          BLAME_CELL_BASE,
          border,
          "px-1.5 text-[10px] text-vscode-description truncate border-vscode-panel-border",
        )}
        style={pin}
        data-testid="compare-blame-loading"
      >
        …
      </span>
    );
  }
  if (!entry) {
    return (
      <span
        className={cn(BLAME_CELL_BASE, border, "border-vscode-panel-border")}
        style={pin}
      />
    );
  }
  const stripe = blameBlockBackground(entry.sha);
  const label = formatBlameAnnotationLabel(entry);
  return (
    <button
      type="button"
      className={cn(
        BLAME_CELL_BASE,
        border,
        "px-1.5 text-left text-[10px] leading-5 truncate border-vscode-panel-border cursor-pointer",
        "text-vscode-description hover:bg-toolbar-hover hover:text-vscode-editor-fg",
        selected && "bg-list-active text-vscode-editor-fg",
      )}
      style={{
        ...pin,
        boxShadow:
          edge === "leading"
            ? `inset 3px 0 0 ${stripe}`
            : `inset -3px 0 0 ${stripe}`,
      }}
      title={label}
      data-testid={`compare-blame-${entry.lineNumber}`}
      data-sha={entry.sha}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function CodeRow({
  lineNum,
  text,
  highlight,
  filePath,
  showAnnotate,
  blameEntry,
  blameLoading,
  blameSelected,
  onBlameClick,
  onContextMenu,
  side,
}: {
  lineNum: number | null;
  text: string;
  highlight: DiffLineHighlight;
  filePath?: string | null;
  showAnnotate?: boolean;
  blameEntry: BlameLineEntry | null;
  blameLoading?: boolean;
  blameSelected?: boolean;
  onBlameClick?: (e: MouseEvent) => void;
  onContextMenu?: (e: MouseEvent) => void;
  side: "left" | "right";
}) {
  // Panes mirror around the centre, annotated or not:
  // content · line · blame ‖ blame · line · content
  const mirrored = side === "left";
  const gutterOffset = showAnnotate ? BLAME_WIDTH : 0;
  const lineCell = (
    <span
      key="line"
      className={cn(
        "nx-diff-ln nx-diff-gutter shrink-0 text-right text-vscode-line-number select-none opacity-70",
        mirrored ? "pl-2" : "pr-2",
      )}
      style={{
        width: LINE_WIDTH,
        ...(mirrored ? { right: gutterOffset } : { left: gutterOffset }),
      }}
    >
      {lineNum ?? ""}
    </span>
  );
  const textCell = (
    <span
      key="text"
      className="nx-diff-txt flex-1 py-0 px-2 whitespace-pre"
    >
      <HighlightedCodeLine text={text} filePath={filePath} />
    </span>
  );
  const blameCell = showAnnotate ? (
    <BlameCell
      key="blame"
      entry={blameEntry}
      loading={blameLoading}
      selected={blameSelected}
      onClick={onBlameClick}
      edge={mirrored ? "trailing" : "leading"}
    />
  ) : null;

  return (
    <div
      className={cn(
        "nx-diff-code-line relative flex whitespace-pre min-h-5 leading-5",
        highlightClass(highlight),
      )}
      onContextMenu={onContextMenu}
      data-side={side}
      data-annotated={showAnnotate ? "true" : "false"}
      data-line={lineNum ?? undefined}
    >
      {mirrored
        ? [textCell, lineCell, blameCell]
        : [blameCell, lineCell, textCell]}
    </div>
  );
}

export function CompareSplitView({
  left,
  right,
  filePath,
  hideHeaders = false,
  annotateLeft = false,
  annotateRight = false,
  leftBlame,
  rightBlame,
  leftBlameLoading = false,
  rightBlameLoading = false,
  selectedSha = null,
  bottomPanel,
  onSelectBlame,
  onContextMenu,
}: CompareSplitViewProps) {
  const rows = useMemo(
    () => buildDiffDisplayRows(left.text, right.text),
    [left.text, right.text],
  );
  const leftMap = useMemo(() => indexBlame(leftBlame), [leftBlame]);
  const rightMap = useMemo(() => indexBlame(rightBlame), [rightBlame]);
  const { registerContainer, handleScroll } = useScrollSync(2);
  const [localSelectedSha, setLocalSelectedSha] = useState<string | null>(null);
  const activeSha = selectedSha ?? localSelectedSha;

  const annotateAny = annotateLeft || annotateRight;
  const showBottom = annotateAny && bottomPanel != null;

  const handleBlameClick = (
    entry: BlameLineEntry,
    side: "left" | "right",
    e: MouseEvent,
  ) => {
    e.stopPropagation();
    setLocalSelectedSha(entry.sha);
    onSelectBlame?.(entry.sha, side, entry.lineNumber);
  };

  const handleRowContextMenu = (
    e: MouseEvent,
    side: "left" | "right",
    lineNum: number | null,
  ) => {
    if (!onContextMenu || lineNum == null) {
      return;
    }
    e.preventDefault();
    onContextMenu({
      x: e.clientX,
      y: e.clientY,
      lineNumber: lineNum,
      side,
    });
  };

  const renderSide = (
    side: "left" | "right",
    getNum: (row: DiffDisplayRow) => number | null,
    getText: (row: DiffDisplayRow) => string,
    getHl: (row: DiffDisplayRow) => DiffLineHighlight,
    map: Map<number, BlameLineEntry>,
    showAnnotate: boolean,
    blameLoading: boolean,
  ): ReactNode[] =>
    rows.map((row, i) => {
      const lineNum = getNum(row);
      const entry = lineNum != null ? (map.get(lineNum) ?? null) : null;
      return (
        <CodeRow
          key={`${side}-${i}`}
          side={side}
          lineNum={lineNum}
          text={getText(row)}
          highlight={getHl(row)}
          filePath={filePath}
          showAnnotate={showAnnotate}
          blameEntry={entry}
          blameLoading={blameLoading && showAnnotate}
          blameSelected={!!entry && entry.sha === activeSha}
          onBlameClick={
            entry
              ? (e) => handleBlameClick(entry, side, e)
              : undefined
          }
          onContextMenu={(e) => handleRowContextMenu(e, side, lineNum)}
        />
      );
    });

  const panes = (
    <div
      className="flex-1 min-h-0 flex flex-col overflow-hidden bg-vscode-editor-bg"
      data-testid="git-diff-split"
      data-annotate={annotateAny ? "true" : "false"}
      data-annotate-left={annotateLeft ? "true" : "false"}
      data-annotate-right={annotateRight ? "true" : "false"}
    >
      <div className="flex-1 min-h-0 grid grid-cols-2 divide-x divide-vscode-panel-border overflow-hidden">
        <div className="min-h-0 flex flex-col overflow-hidden">
          {!hideHeaders && (
            <div className="h-7 px-3 flex items-center text-[11px] font-semibold text-vscode-description border-b border-vscode-panel-border shrink-0">
              {left.label}
            </div>
          )}
          <div
            ref={registerContainer(0)}
            className="flex-1 overflow-auto font-editor text-editor leading-5"
            onScroll={handleScroll(0)}
            data-testid="git-diff-left-scroll"
          >
            {/* max-content wrapper: every row stretches to the widest line, so
                row tints and pinned gutters stay correct while scrolling. */}
            <div className="min-w-max">
              {renderSide(
                "left",
                (r) => r.leftNum,
                (r) => r.leftText,
                (r) => r.leftHighlight,
                leftMap,
                annotateLeft,
                leftBlameLoading,
              )}
            </div>
          </div>
        </div>
        <div className="min-h-0 flex flex-col overflow-hidden">
          {!hideHeaders && (
            <div className="h-7 px-3 flex items-center text-[11px] font-semibold text-vscode-description border-b border-vscode-panel-border shrink-0">
              {right.label}
            </div>
          )}
          <div
            ref={registerContainer(1)}
            className="flex-1 overflow-auto font-editor text-editor leading-5"
            onScroll={handleScroll(1)}
            data-testid="git-diff-right-scroll"
          >
            <div className="min-w-max">
              {renderSide(
                "right",
                (r) => r.rightNum,
                (r) => r.rightText,
                (r) => r.rightHighlight,
                rightMap,
                annotateRight,
                rightBlameLoading,
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!showBottom) {
    return panes;
  }

  return (
    <ResizableSplit
      direction="vertical"
      initialPercent={68}
      minFirstPercent={36}
      minSecondPercent={18}
      storageKey="gitView.compare.annotate.bottomPanel"
      className="flex-1 min-h-0"
      first={panes}
      second={
        <div
          className="h-full min-h-0 flex flex-col border-t border-vscode-panel-border"
          data-testid="compare-annotate-bottom-panel"
        >
          {bottomPanel}
        </div>
      }
    />
  );
}
