import type { LogCommitEntry, LogDagNode, LogDagSnapshot } from "../../types/log";
import type { PermanentGraph } from "./types";
import { assignLayoutIndices } from "./layout";

export function parseLogDagLines(stdout: string): LogDagNode[] {
  const nodes: LogDagNode[] = [];
  const seen = new Set<string>();
  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line) {
      continue;
    }
    const parts = line.split("\0");
    if (parts.length < 3) {
      continue;
    }
    const sha = parts[0]!.trim();
    if (!sha || seen.has(sha)) {
      continue;
    }
    seen.add(sha);
    const parentShas = parts[1]!.trim()
      ? parts[1]!.trim().split(/\s+/).filter(Boolean)
      : [];
    const timestamp = Number.parseInt(parts[2]!.trim(), 10);
    nodes.push({
      sha,
      parentShas,
      timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    });
  }
  return nodes;
}

export function uniqueRefTips(
  headSha: string | null,
  refTipShas: readonly string[],
): string[] {
  const tips: string[] = [];
  const seen = new Set<string>();
  const add = (sha: string | null | undefined) => {
    if (!sha || seen.has(sha)) {
      return;
    }
    seen.add(sha);
    tips.push(sha);
  };
  add(headSha);
  for (const sha of refTipShas) {
    add(sha);
  }
  return tips;
}

export function dagSnapshotFromCommits(
  commits: readonly Pick<LogCommitEntry, "sha" | "parentShas" | "authorTime">[],
  options: {
    repoId?: string;
    headSha?: string | null;
    refTips?: string[];
  } = {},
): LogDagSnapshot {
  const nodes: LogDagNode[] = commits.map((commit) => ({
    sha: commit.sha,
    parentShas: commit.parentShas ?? [],
    timestamp: commit.authorTime,
  }));
  const headSha = options.headSha ?? nodes[0]?.sha ?? null;
  return {
    repoId: options.repoId ?? "",
    headSha,
    refTips: options.refTips ?? uniqueRefTips(headSha, []),
    nodes,
    generatedAt: 0,
  };
}

export function buildPermanentGraph(snapshot: LogDagSnapshot): PermanentGraph {
  const shas = snapshot.nodes.map((node) => node.sha);
  const indexBySha = new Map<string, number>();
  for (let index = 0; index < shas.length; index += 1) {
    indexBySha.set(shas[index]!, index);
  }
  const parents = snapshot.nodes.map((node) =>
    node.parentShas.map((parent) => indexBySha.get(parent) ?? -1),
  );
  const timestamps = snapshot.nodes.map((node) => node.timestamp);
  const layoutIndex = assignLayoutIndices({
    parents,
    headSha: snapshot.headSha,
    refTips: snapshot.refTips,
    indexBySha,
  });
  return {
    shas,
    parents,
    timestamps,
    indexBySha,
    layoutIndex,
    headSha: snapshot.headSha,
    refTips: snapshot.refTips,
  };
}

export function displayLane(layoutIndex: number): number {
  return Math.max(0, layoutIndex - 1);
}
