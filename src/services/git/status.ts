import type { GitFileStatus, GitFileStatusKind } from "../../shared/types/status";
import type { GitExecFn } from "./types";
import { isUnmergedCode } from "./porcelain";

export type ParsedBranchHeader = {
  currentBranch: string | null;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  isDetached: boolean;
};

export type RawStatusEntry = {
  xy: string;
  path: string;
  oldPath?: string;
};

function parseBranchHeader(line: string): ParsedBranchHeader {
  const header = line.startsWith("## ") ? line.slice(3) : line;
  if (header.startsWith("HEAD (no branch)")) {
    return {
      currentBranch: null,
      upstream: null,
      ahead: null,
      behind: null,
      isDetached: true,
    };
  }

  const branchPart = header.split("...")[0]?.trim() ?? null;
  const upstreamMatch = header.match(/\.\.\.([^\s[]+)/);
  const upstream = upstreamMatch?.[1] ?? null;

  const aheadMatch = header.match(/ahead (\d+)/);
  const behindMatch = header.match(/behind (\d+)/);

  return {
    currentBranch: branchPart,
    upstream,
    ahead: aheadMatch ? Number(aheadMatch[1]) : upstream ? 0 : null,
    behind: behindMatch ? Number(behindMatch[1]) : upstream ? 0 : null,
    isDetached: false,
  };
}

export function parsePorcelainV1Z(output: string): {
  branch: ParsedBranchHeader | null;
  entries: RawStatusEntry[];
} {
  const parts = output.split("\0");
  let branch: ParsedBranchHeader | null = null;
  const entries: RawStatusEntry[] = [];

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (!part) {
      continue;
    }
    if (part.startsWith("## ")) {
      branch = parseBranchHeader(part);
      continue;
    }
    if (part.length < 3) {
      continue;
    }
    const xy = part.slice(0, 2);
    const rest = part.slice(3);
    if (xy === "??" || xy === "!!") {
      entries.push({ xy, path: rest });
      continue;
    }

    // In porcelain v1 `-z`, rename/copy records are `XY new\0old\0`.
    // This is deliberately different from the human-oriented `old -> new`
    // representation and must not trim either path.
    if (xy.includes("R") || xy.includes("C")) {
      const oldPath = parts[index + 1];
      if (oldPath !== undefined && oldPath.length > 0) {
        index++;
        entries.push({ xy, path: rest, oldPath });
      } else {
        entries.push({ xy, path: rest });
      }
      continue;
    }

    entries.push({ xy, path: rest });
  }

  return { branch, entries };
}

function mapStatusKind(xy: string): GitFileStatusKind {
  if (xy === "??") {
    return "unversioned";
  }
  if (xy === "!!") {
    return "ignored";
  }
  if (isUnmergedCode(xy)) {
    return "conflicted";
  }
  if (xy[0] === "R" || xy[1] === "R") {
    return "renamed";
  }
  if (xy[0] === "C" || xy[1] === "C") {
    return "copied";
  }
  if (xy[0] === "A" || xy[1] === "A" || xy[0] === "?" || xy[1] === "?") {
    return "added";
  }
  if (xy[0] === "D" || xy[1] === "D") {
    return "deleted";
  }
  return "modified";
}

export function mapEntryToFileStatus(
  repoId: string,
  entry: RawStatusEntry,
): GitFileStatus {
  // `charAt` is total: this is exported, so a caller outside the porcelain
  // parser can pass a short code, and `""` is a safer leak than `undefined`
  // into fields the type declares as `string`.
  const x = entry.xy.charAt(0);
  const y = entry.xy.charAt(1);
  const indexStatus = x === "?" ? " " : x;
  const workingTreeStatus = y === "?" ? " " : y;
  const conflicted = isUnmergedCode(entry.xy);
  const staged =
    !conflicted &&
    indexStatus !== " " &&
    indexStatus !== "?" &&
    indexStatus !== "!";

  return {
    repoId,
    path: entry.path.replace(/\\/g, "/"),
    oldPath: entry.oldPath?.replace(/\\/g, "/"),
    kind: mapStatusKind(entry.xy),
    indexStatus,
    workingTreeStatus,
    staged,
    conflicted,
    binary: false,
  };
}

export function createStatusApi(execGit: GitExecFn) {
  async function getStatus(
    repoRoot: string,
    repoId: string,
    opts?: { includeIgnored?: boolean },
  ): Promise<{
    branch: ParsedBranchHeader | null;
    files: GitFileStatus[];
  }> {
    const args = ["status", "--porcelain=v1", "-z", "-b"];
    if (opts?.includeIgnored) {
      args.push("--ignored");
    }
    const { stdout } = await execGit(repoRoot, args);
    const parsed = parsePorcelainV1Z(stdout);
    const files = parsed.entries
      .filter((e) => opts?.includeIgnored || e.xy !== "!!")
      .map((e) => mapEntryToFileStatus(repoId, e));
    return { branch: parsed.branch, files };
  }

  return { getStatus, parsePorcelainV1Z, mapEntryToFileStatus };
}
