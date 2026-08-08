import type { LogCommitEntry } from "@gitview/shared/types/log";

export function sortLogCommitsTopologically(
  commits: LogCommitEntry[],
): LogCommitEntry[] {
  const bySha = new Map(commits.map((commit) => [commit.sha, commit]));
  const visited = new Set<string>();
  const result: LogCommitEntry[] = [];

  function visit(sha: string) {
    if (visited.has(sha)) {
      return;
    }
    visited.add(sha);
    const commit = bySha.get(sha);
    if (!commit) {
      return;
    }
    for (const parent of commit.parentShas ?? []) {
      visit(parent);
    }
    result.push(commit);
  }

  for (const commit of commits) {
    visit(commit.sha);
  }

  return result.reverse();
}