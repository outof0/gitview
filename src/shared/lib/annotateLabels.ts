import type { BlameLine } from "../../types/blame";

/** Blame Details column: "Author, 2 hours ago | Commit: e9a2b5f" */
export function formatBlameDetailsLabel(
  line: BlameLine,
  nowMs: number,
): string {
  const rel = formatRelativeTime(line.authorTime, nowMs);
  return `${line.author}, ${rel} | Commit: ${line.shortSha}`;
}

export function baseContextLabel(branchLabel: string): string {
  return `base (${branchLabel})`;
}

export function unmodifiedBaseLabel(): string {
  return "Unmodified base";
}

/** Pick the dominant commit author for a line range (merge change block). */
export function blockAnnotateLabel(
  lines: BlameLine[],
  startLine: number,
  endLine: number,
  fallback: string,
  nowMs: number,
): string {
  const inRange = lines.filter(
    (line) => line.lineNumber >= startLine && line.lineNumber <= endLine,
  );
  if (inRange.length === 0) {
    return fallback;
  }

  const counts = new Map<string, { line: BlameLine; count: number }>();
  for (const line of inRange) {
    const previous = counts.get(line.sha);
    if (previous) {
      previous.count++;
    } else {
      counts.set(line.sha, { line, count: 1 });
    }
  }

  let best: { line: BlameLine; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) {
      best = entry;
    }
  }
  return best ? formatBlameDetailsLabel(best.line, nowMs) : fallback;
}

function formatRelativeTime(authorTimeSec: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor(nowMs / 1000) - authorTimeSec);
  if (diffSec < 60) {
    return "just now";
  }
  if (diffSec < 3600) {
    const minutes = Math.floor(diffSec / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(diffSec / 86400);
  if (days < 30) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return new Date(authorTimeSec * 1000).toISOString().slice(0, 10);
}
