import type { GitChangedFileStatus, GitCommitEntry } from "@gitview/types";

export function formatRelativeTime(
  authorTimeSec: number,
  nowMs = Date.now(),
): string {
  const diffSec = Math.max(0, Math.floor(nowMs / 1000) - authorTimeSec);
  if (diffSec < 60) {
    return "just now";
  }
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.floor(diffSec / 86400);
  if (d < 30) {
    return `${d} day${d === 1 ? "" : "s"} ago`;
  }
  return new Date(authorTimeSec * 1000).toISOString().slice(0, 10);
}

export function statusBadge(status: GitChangedFileStatus): string {
  switch (status) {
    case "A":
      return "A";
    case "M":
      return "M";
    case "D":
      return "D";
    case "R":
      return "R";
    case "C":
      return "C";
    default:
      return status;
  }
}

export function findCommit(
  commits: GitCommitEntry[],
  sha: string | null,
): GitCommitEntry | null {
  if (!sha) {
    return null;
  }
  return commits.find((c) => c.sha === sha) ?? null;
}
