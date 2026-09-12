import { Button } from "../ui/Button";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { LogCommitEntry } from "@gitview/shared/types/log";
import type { CollapsedLogCommit } from "../../lib/collapseLinearCommits";
import { useDelayedFlag } from "../../hooks/useDelayedFlag";
import {
  GIT_LOG_GRAPH_ROW_HEIGHT,
  buildGitLogGraphLayout,
  gitLogLaneColor,
  type GitLogGraphLayout,
  type PermanentGraph,
} from "../../lib/gitLogGraph";
import { GitCommitRow } from "./GitCommitRow";
import {
  GitLogGraphOverlay,
  type GitLogGraphOverlayHandle,
} from "./GitLogGraphOverlay";

const GRAPH_OVERSCAN_ROWS = 32;
const GRAPH_INITIAL_ROWS = 96;
const DOM_OVERSCAN_ROWS = 12;
const DEFAULT_GRAPH_GUTTER_WIDTH = 72;
const MIN_GRAPH_GUTTER_WIDTH = 32;
const MAX_GRAPH_GUTTER_WIDTH = 320;

type GraphVisibleRange = {
  start: number;
  end: number;
};

function graphRowStyle(row: number): CSSProperties {
  return {
    position: "absolute",
    top: row * GIT_LOG_GRAPH_ROW_HEIGHT,
    left: 0,
    right: 0,
    height: GIT_LOG_GRAPH_ROW_HEIGHT,
  };
}

const SKELETON_ROWS = 12;

/**
 * List-shaped placeholder for a stalled first page. It keeps the graph gutter
 * and row rhythm, so a slow repository looks like the commit list populating
 * instead of a second loading screen.
 */
function GitCommitListSkeleton({ graphDensity }: { graphDensity: boolean }) {
  return (
    <div
      className="min-h-0"
      data-testid="git-commit-list-loading"
      aria-busy="true"
      aria-label="Loading history"
    >
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div
          key={index}
          className="flex items-center"
          style={{ height: GIT_LOG_GRAPH_ROW_HEIGHT }}
        >
          {graphDensity ? (
            <div
              className="shrink-0 flex items-center justify-center"
              style={{ width: DEFAULT_GRAPH_GUTTER_WIDTH }}
            >
              <div
                className="rounded-full bg-vscode-panel-border opacity-50 animate-blame-pulse"
                style={{ width: 8, height: 8 }}
              />
            </div>
          ) : null}
          <div
            className="h-2.5 rounded-vscode bg-vscode-panel-border opacity-40 animate-blame-pulse"
            style={{
              marginLeft: graphDensity ? 0 : 12,
              width: `${45 + (index % 5) * 9}%`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function findScrollContainer(element: HTMLElement | null): HTMLElement | null {
  let current = element?.parentElement ?? null;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

type GitCommitListProps = {
  entries?: CollapsedLogCommit[];
  commits?: LogCommitEntry[];
  selectedSha: string | null;
  selectedShas?: string[];
  onSelect: (sha: string, multi?: boolean) => void;
  onContextMenu?: (e: React.MouseEvent, commit: LogCommitEntry) => void;
  onExpandCollapsed?: (commits: LogCommitEntry[]) => void;
  issueTrackerBaseUrl?: string | null;
  compactRows?: boolean;
  /** Graph rows used by embedded compare annotation. */
  graphDensity?: boolean;
  /**
   * Immutable repo DAG layout. `null` means the snapshot is not ready yet.
   * Omit in tests to derive layout from the loaded commits.
   */
  permanentGraph?: PermanentGraph | null;
  /** Current / HEAD revision in annotate mode. */
  currentSha?: string | null;
  highlightCurrentBranch?: boolean;
  currentBranchHeadSha?: string | null;
  loading?: boolean;
  emptyLabel?: string;
};

export function GitCommitList({
  entries: entriesProp,
  commits,
  selectedSha,
  selectedShas = [],
  onSelect,
  onContextMenu,
  onExpandCollapsed,
  issueTrackerBaseUrl,
  graphDensity = false,
  permanentGraph,
  currentSha = null,
  highlightCurrentBranch = false,
  currentBranchHeadSha = null,
  compactRows = false,
  loading,
  emptyLabel = "No commits found.",
}: GitCommitListProps) {
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const graphRootRef = useRef<HTMLDivElement | null>(null);
  const [graphRootNode, setGraphRootNode] = useState<HTMLDivElement | null>(
    null,
  );
  const attachGraphRoot = useCallback((node: HTMLDivElement | null) => {
    graphRootRef.current = node;
    setGraphRootNode(node);
  }, []);
  const overlayRef = useRef<GitLogGraphOverlayHandle | null>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const paintedRef = useRef<GraphVisibleRange>({ start: 0, end: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [graphVisibleRange, setGraphVisibleRange] =
    useState<GraphVisibleRange>({
      start: 0,
      end: GRAPH_INITIAL_ROWS,
    });
  const [gutterWidth, setGutterWidth] = useState(DEFAULT_GRAPH_GUTTER_WIDTH);
  const gutterWidthRef = useRef(gutterWidth);
  gutterWidthRef.current = gutterWidth;
  const [panX, setPanX] = useState(0);

  // Callers pass either shape; rebuilding the fallback on every render would
  // invalidate the graph-layout memo below on lists of thousands of commits.
  const entries = useMemo(
    () =>
      entriesProp ??
      (commits ?? []).map((commit) => ({ kind: "commit" as const, commit })),
    [entriesProp, commits],
  );

  const graphCommits = useMemo(
    () =>
      entries
        .filter(
          (entry): entry is { kind: "commit"; commit: LogCommitEntry } =>
            entry.kind === "commit",
        )
        .map((entry) => entry.commit),
    [entries],
  );
  const graphRowBySha = useMemo(
    () =>
      new Map(
        entries.flatMap((entry, row) =>
          entry.kind === "commit" ? [[entry.commit.sha, row] as const] : [],
        ),
      ),
    [entries],
  );
  const hiddenShas = useMemo(() => {
    const hidden = new Set<string>();
    for (const entry of entries) {
      if (entry.kind === "collapsed") {
        for (const commit of entry.commits) {
          hidden.add(commit.sha);
        }
      }
    }
    return hidden;
  }, [entries]);
  const loadedBySha = useMemo(() => {
    const loaded = new Map<
      string,
      {
        sha: string;
        row: number;
        parentShas?: string[];
        parentPresent?: boolean[];
      }
    >();
    for (const entry of entries) {
      if (entry.kind === "commit") {
        loaded.set(entry.commit.sha, {
          sha: entry.commit.sha,
          row: -1,
          parentShas: entry.commit.parentShas,
          parentPresent: entry.commit.parentPresent,
        });
      } else {
        for (const commit of entry.commits) {
          loaded.set(commit.sha, {
            sha: commit.sha,
            row: -1,
            parentShas: commit.parentShas,
            parentPresent: commit.parentPresent,
          });
        }
      }
    }
    return loaded;
  }, [entries]);

  const graphLayout: GitLogGraphLayout | null = useMemo(() => {
    if (!graphDensity || graphCommits.length === 0) {
      return null;
    }
    if (permanentGraph === null) {
      return null;
    }
    return buildGitLogGraphLayout(graphCommits, {
      rowBySha: graphRowBySha,
      rowCount: entries.length,
      hiddenShas,
      loadedBySha,
      permanentGraph,
    });
  }, [
    entries.length,
    graphCommits,
    graphDensity,
    graphRowBySha,
    hiddenShas,
    loadedBySha,
    permanentGraph,
  ]);
  const graphWidth = graphLayout?.width ?? 0;
  const graphWidthRef = useRef(graphWidth);
  graphWidthRef.current = graphWidth;
  const maxPanX = Math.max(0, graphWidth - gutterWidth);

  const entriesLengthRef = useRef(entries.length);
  entriesLengthRef.current = entries.length;

  const computePaintWindow = useCallback(
    (scroller: HTMLElement, rowCount: number): GraphVisibleRange | null => {
      if (scroller.clientHeight <= 0) {
        return null;
      }
      const start = Math.max(
        0,
        Math.floor(scroller.scrollTop / GIT_LOG_GRAPH_ROW_HEIGHT) -
          GRAPH_OVERSCAN_ROWS,
      );
      const end = Math.min(
        rowCount,
        Math.ceil(
          (scroller.scrollTop + scroller.clientHeight) /
            GIT_LOG_GRAPH_ROW_HEIGHT,
        ) + GRAPH_OVERSCAN_ROWS,
      );
      return { start, end };
    },
    [],
  );

  const syncViewport = useCallback(
    (force = false) => {
      const scroller = scrollerRef.current;
      if (!scroller) {
        return;
      }
      const window = computePaintWindow(scroller, entriesLengthRef.current);
      if (!window) {
        // Hidden panels report zero height; keep a first window so the surface
        // is warm once it becomes visible.
        const end = Math.min(entriesLengthRef.current, GRAPH_INITIAL_ROWS);
        setGraphVisibleRange((previous) =>
          previous.start === 0 && previous.end === end
            ? previous
            : { start: 0, end },
        );
        if (force) {
          overlayRef.current?.paint(0, end);
          paintedRef.current = { start: 0, end };
        }
        return;
      }
      setGraphVisibleRange((previous) => {
        const start = Math.max(0, window.start - DOM_OVERSCAN_ROWS);
        const end = Math.min(
          entriesLengthRef.current,
          window.end + DOM_OVERSCAN_ROWS,
        );
        return previous.start === start && previous.end === end
          ? previous
          : { start, end };
      });
      const painted = paintedRef.current;
      if (
        force ||
        window.start < painted.start ||
        window.end > painted.end
      ) {
        // Repaint synchronously: a rAF repaint leaves the gutter blank when a
        // jump exceeds the painted window.
        overlayRef.current?.paint(window.start, window.end);
        paintedRef.current = window;
      }
    },
    [computePaintWindow],
  );

  useEffect(() => {
    if (!graphDensity) {
      return;
    }
    const scroller = findScrollContainer(graphRootRef.current);
    if (!scroller) {
      return;
    }
    scrollerRef.current = scroller;
    const onScroll = () => syncViewport();
    const onResize = () => syncViewport(true);
    const onWheel = (event: WheelEvent) => {
      const maxPan = Math.max(
        0,
        graphWidthRef.current - gutterWidthRef.current,
      );
      if (maxPan <= 0) {
        return;
      }
      const delta = event.shiftKey
        ? event.deltaY || event.deltaX
        : event.deltaX;
      // Trackpads often include a small horizontal component in a vertical
      // gesture. Only claim the wheel when horizontal movement is dominant;
      // otherwise preventing the event makes the commit list appear to stall
      // while the graph is merely trying to pan.
      if (
        delta === 0 ||
        (!event.shiftKey && Math.abs(event.deltaX) <= Math.abs(event.deltaY))
      ) {
        return;
      }
      event.preventDefault();
      setPanX((previous) => clamp(previous + delta, 0, maxPan));
    };
    syncViewport(true);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", onResize);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(onResize);
    resizeObserver?.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
    };
  }, [graphDensity, graphRootNode, syncViewport]);

  useLayoutEffect(() => {
    if (!graphDensity) {
      return;
    }
    if (panX > maxPanX) {
      setPanX(maxPanX);
      return;
    }
    syncViewport(true);
  }, [entries.length, graphDensity, gutterWidth, maxPanX, panX, syncViewport]);

  useEffect(() => {
    if (!graphDensity) {
      return;
    }
    const scrollContainer = findScrollContainer(graphRootRef.current);
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
    setGraphVisibleRange((previous) =>
      previous.start === 0 && previous.end === GRAPH_INITIAL_ROWS
        ? previous
        : { start: 0, end: GRAPH_INITIAL_ROWS },
    );
  }, [graphDensity]);

  const selectedEntryRow = useMemo(
    () =>
      selectedSha
        ? entries.findIndex((entry) =>
            entry.kind === "commit"
              ? entry.commit.sha === selectedSha
              : entry.commits.some((commit) => commit.sha === selectedSha),
          )
        : -1,
    [entries, selectedSha],
  );

  const scrolledSelectionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedSha || selectedEntryRow < 0) {
      scrolledSelectionRef.current = null;
      return;
    }
    // Append alone must not pull the viewport back to the selection; only a
    // new selection target (or the row appearing after load) scrolls.
    const key = `${selectedSha}:${selectedEntryRow}`;
    if (scrolledSelectionRef.current === key) {
      return;
    }
    const selectedButton = selectedRef.current;
    if (typeof selectedButton?.scrollIntoView === "function") {
      selectedButton.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
      scrolledSelectionRef.current = key;
      return;
    }
    if (!graphDensity) {
      scrolledSelectionRef.current = key;
      return;
    }
    const scrollContainer = findScrollContainer(graphRootRef.current);
    if (!scrollContainer) {
      return;
    }
    const top = selectedEntryRow * GIT_LOG_GRAPH_ROW_HEIGHT;
    const bottom = top + GIT_LOG_GRAPH_ROW_HEIGHT;
    const maxScroll = Math.max(
      scrollContainer.clientHeight,
      GIT_LOG_GRAPH_ROW_HEIGHT,
    );
    if (top < scrollContainer.scrollTop) {
      scrollContainer.scrollTop = top;
    } else if (bottom > scrollContainer.scrollTop + maxScroll) {
      scrollContainer.scrollTop = Math.max(0, bottom - maxScroll);
    }
    scrolledSelectionRef.current = key;
  }, [graphDensity, selectedEntryRow, selectedSha]);

  const visibleEntries = useMemo(() => {
    const start = graphDensity ? graphVisibleRange.start : 0;
    const end = graphDensity
      ? Math.min(entries.length, graphVisibleRange.end)
      : entries.length;
    return entries.slice(start, end).map((entry, offset) => ({
      entry,
      row: start + offset,
      style: graphDensity ? graphRowStyle(start + offset) : undefined,
    }));
  }, [entries, graphDensity, graphVisibleRange]);

  // A fast first page should go straight to the list; the placeholder only
  // appears when loading actually stalls.
  const showLoadingPlaceholder = useDelayedFlag(
    Boolean(loading) && entries.length === 0,
    200,
  );

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: gutterWidthRef.current,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [],
  );

  const handleResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      setGutterWidth(
        clamp(
          drag.startWidth + event.clientX - drag.startX,
          MIN_GRAPH_GUTTER_WIDTH,
          MAX_GRAPH_GUTTER_WIDTH,
        ),
      );
    },
    [],
  );

  const handleResizePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragRef.current?.pointerId === event.pointerId) {
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  if (showLoadingPlaceholder) {
    return <GitCommitListSkeleton graphDensity={graphDensity} />;
  }

  if (loading && entries.length === 0) {
    return null;
  }

  if (entries.length === 0) {
    return (
      <div
        className="p-3 text-ui-sm text-vscode-description"
        data-testid="git-commit-list-empty"
      >
        {emptyLabel}
      </div>
    );
  }

  const list = (
    <ul
      className="m-0 p-0 list-none"
      style={
        graphDensity
          ? {
              position: "relative",
              height: entries.length * GIT_LOG_GRAPH_ROW_HEIGHT,
            }
          : undefined
      }
      data-testid="git-commit-list"
    >
      {visibleEntries.map(({ entry, style }) => {
        if (entry.kind === "collapsed") {
          const selected = entry.commits.some((c) => c.sha === selectedSha);
          return (
            <li
              key={`collapsed-${entry.fromSha}-${entry.toSha}`}
              style={style}
            >
              <Button variant="ghost" size="content"
                type="button"
                className={`w-full text-left border-none cursor-pointer text-ui ${
                  graphDensity
                    ? "h-log-graph-row min-h-log-graph-row py-0 flex items-center"
                    : "px-3 py-2 leading-5"
                } ${
                  selected
                    ? "bg-list-active text-list-activeForeground"
                    : "bg-transparent text-foreground hover:bg-list-hover"
                }`}
                onClick={() => onExpandCollapsed?.(entry.commits)}
                data-testid="git-commit-collapsed"
              >
                <div className="font-mono text-vscode-link">
                  {entry.commits[0]?.shortSha}…
                  {entry.commits[entry.count - 1]?.shortSha}
                </div>
                <div className="truncate font-medium">
                  {entry.count} linear commits
                </div>
                <div
                  className={`truncate text-ui-sm ${
                    selected
                      ? "text-list-activeForeground/80"
                      : "text-vscode-description"
                  }`}
                >
                  Click to expand
                </div>
              </Button>
            </li>
          );
        }

        const commit = entry.commit;
        const selected =
          selectedShas.includes(commit.sha) || commit.sha === selectedSha;
        const current = currentSha === commit.sha;
        const graphLane = graphLayout?.laneBySha.get(commit.sha);
        const colorLane = graphLayout?.colorLaneBySha.get(commit.sha);
        return (
          <GitCommitRow
            key={commit.sha}
            commit={commit}
            selected={selected}
            current={current}
            highlighted={
              current ||
              (highlightCurrentBranch && currentBranchHeadSha === commit.sha)
            }
            issueTrackerBaseUrl={issueTrackerBaseUrl}
            compact={compactRows}
            graphWidth={graphDensity ? gutterWidth : null}
            graphLane={graphLane ?? null}
            graphColor={
              colorLane === undefined ? undefined : gitLogLaneColor(colorLane)
            }
            selectedRef={selectedRef}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            rowStyle={style}
          />
        );
      })}
    </ul>
  );

  if (graphDensity && graphLayout) {
    return (
      <div
        ref={attachGraphRoot}
        className="relative min-h-0"
        data-testid="git-commit-list-graph"
      >
        <GitLogGraphOverlay
          layout={graphLayout}
          rowCount={entries.length}
          gutterWidth={gutterWidth}
          panX={panX}
          handleRef={overlayRef}
        />
        {list}
        <div
          className="absolute top-0 h-full cursor-col-resize hover:bg-ring"
          style={{ left: gutterWidth - 3, width: 6, zIndex: 2 }}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          data-testid="git-log-graph-resize"
          aria-hidden="true"
        />
      </div>
    );
  }

  return list;
}
