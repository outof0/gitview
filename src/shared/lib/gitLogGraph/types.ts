import type { LogDagNode, LogDagSnapshot } from "../../types/log";

export type { LogDagNode, LogDagSnapshot };

export type PermanentGraph = {
  shas: readonly string[];
  /** Parent node indices; -1 means the parent SHA is not in this snapshot. */
  parents: readonly (readonly number[])[];
  timestamps: readonly number[];
  indexBySha: ReadonlyMap<string, number>;
  /**
   * 1-based IntelliJ layout index. 0 means the node was never visited
   * (should not happen when heads include every tip).
   */
  layoutIndex: Int32Array;
  headSha: string | null;
  refTips: readonly string[];
};

export type GitLogGraphTransition = {
  row: number;
  sha: string;
  lane: number;
  layoutIndex: number;
  nodeIndex: number;
  colorLane: number;
  parents: readonly string[];
  parentLanes: readonly number[];
};

export type GitLogGraphEdge = {
  id: number;
  childRow: number;
  childSha: string;
  parentSha: string;
  parentLane: number;
  downRow?: number;
  upIndex: number;
  downIndex: number;
  upLayoutIndex: number;
  downLayoutIndex: number;
};

export type GitLogGraphLayout = {
  laneBySha: ReadonlyMap<string, number>;
  colorLaneBySha: ReadonlyMap<string, number>;
  rowBySha: ReadonlyMap<string, number>;
  width: number;
  height: number;
  maxLane: number;
  transitions: readonly GitLogGraphTransition[];
  visibleRows: readonly number[];
  edges: readonly GitLogGraphEdge[];
  edgesByChildRow: ReadonlyMap<number, readonly GitLogGraphEdge[]>;
  edgesByDownRow: ReadonlyMap<number, readonly GitLogGraphEdge[]>;
};

export type GitLogGraphLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lane: number;
  fromSha: string;
  toSha: string;
  fromShas: readonly string[];
  edgeIds: readonly number[];
};

export type GitLogGraphArrow = {
  x: number;
  y: number;
  direction: "up" | "down";
  lane: number;
  fromSha: string;
  toSha: string;
  fromShas: readonly string[];
  edgeIds: readonly number[];
};

export type GitLogGraphDot = {
  x: number;
  y: number;
  lane: number;
  isMerge: boolean;
  sha: string;
};

export type GraphHit = {
  edgeIds: readonly number[];
  fromShas: readonly string[];
  toShas: readonly string[];
};

export type GraphLayoutMetrics = {
  crossingCount: number;
  bendCount: number;
  laneChangeCount: number;
  maxLaneCount: number;
  totalHorizontalTravel: number;
};
