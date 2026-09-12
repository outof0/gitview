export const GIT_LOG_GRAPH_ROW_HEIGHT = 24;
export const GIT_LOG_GRAPH_LANE_WIDTH = 14;
export const GIT_LOG_GRAPH_LANE_PAD = 10;
export const GIT_LOG_GRAPH_DOT_RADIUS = 4.5;
/**
 * IntelliJ hides the middle of edges that span more than this many rows and
 * draws arrow terminals near each attachment instead.
 */
export const GIT_LOG_GRAPH_LONG_EDGE_ROWS = 30;
export const GIT_LOG_GRAPH_ATTACH_ROWS = 1;

const GIT_LOG_LANE_COLORS = [
  "var(--gitview-graph-purple)",
  "var(--gitview-graph-green)",
  "var(--gitview-graph-pink)",
  "var(--gitview-graph-blue)",
  "var(--gitview-graph-cyan)",
  "var(--gitview-graph-orange)",
  "var(--gitview-graph-yellow)",
] as const;

export function gitLogLaneColor(lane: number): string {
  return (
    GIT_LOG_LANE_COLORS[lane % GIT_LOG_LANE_COLORS.length] ??
    GIT_LOG_LANE_COLORS[0]
  );
}

export function laneCenterX(lane: number): number {
  return (
    GIT_LOG_GRAPH_LANE_PAD +
    lane * GIT_LOG_GRAPH_LANE_WIDTH +
    GIT_LOG_GRAPH_LANE_WIDTH / 2
  );
}

export function gitLogGraphWidth(maxLane: number): number {
  return (
    GIT_LOG_GRAPH_LANE_PAD * 2 +
    (Math.max(0, maxLane) + 1) * GIT_LOG_GRAPH_LANE_WIDTH
  );
}
