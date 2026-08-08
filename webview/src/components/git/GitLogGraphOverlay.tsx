import type { LogCommitEntry } from "@gitview/shared/types/log";
import {
  GIT_LOG_GRAPH_DOT_RADIUS,
  GIT_LOG_GRAPH_ROW_HEIGHT,
  type GitLogGraphLayout,
  gitLogLaneColor,
  laneCenterX,
} from "../../lib/gitLogGraph";

type GitLogGraphOverlayProps = {
  commits: readonly LogCommitEntry[];
  layout: GitLogGraphLayout;
};

/**
 * Commit graph rendering:
 * - vertical rails on a lane
 * - diagonal zig-zags when a parent lives on another lane
 * - no double-drawn pass-through strokes
 */
export function GitLogGraphOverlay({
  commits,
  layout,
}: GitLogGraphOverlayProps) {
  if (commits.length === 0) {
    return null;
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      width={layout.width}
      height={layout.height}
      aria-hidden="true"
      data-testid="git-log-graph"
    >
      {layout.edges.map((edge, index) => (
        <path
          key={`${edge.d}-${index}`}
          d={edge.d}
          fill="none"
          stroke={edge.color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
      ))}
      {commits.map((commit, row) => {
        const lane = layout.laneBySha.get(commit.sha);
        if (lane === undefined) {
          return null;
        }
        const x = laneCenterX(lane);
        const y = row * GIT_LOG_GRAPH_ROW_HEIGHT + GIT_LOG_GRAPH_ROW_HEIGHT / 2;
        const color = gitLogLaneColor(lane);
        const isMerge = commit.isMerge || (commit.parentShas?.length ?? 0) > 1;
        return (
          <g key={commit.sha} data-testid={`git-log-graph-dot-${commit.sha}`}>
            <circle
              cx={x}
              cy={y}
              r={GIT_LOG_GRAPH_DOT_RADIUS}
              fill={color}
              stroke="var(--vscode-editor-background, #1e1e1e)"
              strokeWidth={2}
            />
            {isMerge ? (
              // Small merge “fork” tick (JB-ish), drawn above the dot
              <path
                d={`M ${x - 3.5} ${y - GIT_LOG_GRAPH_DOT_RADIUS - 1} L ${x} ${y - GIT_LOG_GRAPH_DOT_RADIUS - 6} L ${x + 3.5} ${y - GIT_LOG_GRAPH_DOT_RADIUS - 1}`}
                fill="none"
                stroke={color}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.95}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
