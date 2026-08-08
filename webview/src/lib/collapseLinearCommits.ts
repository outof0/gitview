import type { LogCommitEntry } from "@gitview/shared/types/log";

export type CollapsedLogCommit =
  | { kind: "commit"; commit: LogCommitEntry }
  | {
      kind: "collapsed";
      commits: LogCommitEntry[];
      fromSha: string;
      toSha: string;
      count: number;
    };

function isLinearMiddle(
  commits: LogCommitEntry[],
  index: number,
): boolean {
  const commit = commits[index];
  if (!commit || commit.isMerge) {
    return false;
  }
  const parents = commit.parentShas ?? [];
  if (parents.length !== 1) {
    return false;
  }
  const older = commits[index + 1];
  if (!older || parents[0] !== older.sha) {
    return false;
  }
  const newer = commits[index - 1];
  if (!newer) {
    return false;
  }
  const newerParents = newer.parentShas ?? [];
  return newerParents.length === 1 && newerParents[0] === commit.sha;
}

export function collapseLinearCommits(
  commits: LogCommitEntry[],
  enabled: boolean,
): CollapsedLogCommit[] {
  if (!enabled || commits.length === 0) {
    return commits.map((commit) => ({ kind: "commit", commit }));
  }

  const visible = new Set<number>();
  for (let i = 0; i < commits.length; i += 1) {
    if (!isLinearMiddle(commits, i)) {
      visible.add(i);
    }
  }
  if (commits.length > 0) {
    visible.add(0);
    visible.add(commits.length - 1);
  }

  const result: CollapsedLogCommit[] = [];
  let run: LogCommitEntry[] = [];

  function flushRun() {
    if (run.length === 0) {
      return;
    }
    if (run.length >= 3) {
      result.push({
        kind: "collapsed",
        commits: [...run],
        fromSha: run[0]!.sha,
        toSha: run[run.length - 1]!.sha,
        count: run.length,
      });
    } else {
      for (const commit of run) {
        result.push({ kind: "commit", commit });
      }
    }
    run = [];
  }

  for (let i = 0; i < commits.length; i += 1) {
    const commit = commits[i]!;
    if (!visible.has(i)) {
      run.push(commit);
      continue;
    }
    flushRun();
    result.push({ kind: "commit", commit });
  }
  flushRun();

  return result;
}

export function flattenCollapsedCommits(
  entries: CollapsedLogCommit[],
): LogCommitEntry[] {
  const commits: LogCommitEntry[] = [];
  for (const entry of entries) {
    if (entry.kind === "commit") {
      commits.push(entry.commit);
      continue;
    }
    commits.push(...entry.commits);
  }
  return commits;
}