import {
  isGitChangedFileStatus,
  type GitChangedFile,
  type GitCommitEntry,
} from "../types/blame";

export const LOG_RECORD_MARKER = "COMMIT";
export const LOG_RECORD_END = "END";

export const LOG_FORMAT = [
  LOG_RECORD_MARKER,
  "%H",
  "%h",
  "%an",
  "%ae",
  "%at",
  "%s",
  "%P",
  "%D",
  "%b",
  LOG_RECORD_END,
].join("%n");

/** Parse `git log %D` (e.g. "HEAD -> master, origin/master, tag: v1"). */
function parseLogDecorations(raw: string): string[] {
  if (!raw.trim()) {
    return [];
  }
  return raw
    .split(",")
    .map((part) => {
      let s = part.trim();
      if (!s) {
        return "";
      }
      // "HEAD -> master" → "master"
      const arrow = s.indexOf(" -> ");
      if (arrow !== -1) {
        s = s.slice(arrow + 4).trim();
      }
      // "tag: v1.0" → "v1.0"
      if (s.startsWith("tag: ")) {
        s = s.slice(5).trim();
      }
      // Drop bare HEAD
      if (s === "HEAD") {
        return "";
      }
      return s;
    })
    .filter(Boolean);
}

const NAME_STATUS_RE = /^([AMDRC])\d*(?:\d+)?\t(.+)$/;

function parseChangedFile(line: string): GitChangedFile | null {
  const match = line.match(NAME_STATUS_RE);
  if (!match) {
    return null;
  }
  // Both capture groups in NAME_STATUS_RE are non-optional.
  const statusToken = match[1]!;
  if (!isGitChangedFileStatus(statusToken)) {
    return null;
  }
  const status = statusToken;
  const path = match[2]!;
  // Rename lines look like "R100\told\tnew" — keep the destination path.
  if (status === "R" || status === "C") {
    const parts = path.split("\t");
    return { path: parts[parts.length - 1] ?? path, status };
  }
  return { path, status };
}

function parseChangedFiles(lines: Iterable<string>): GitChangedFile[] {
  const filesByPath = new Map<string, GitChangedFile>();
  for (const line of lines) {
    const file = parseChangedFile(line.trim());
    if (file && !filesByPath.has(file.path)) {
      filesByPath.set(file.path, file);
    }
  }
  return [...filesByPath.values()];
}

export function parseGitLogWithNameStatus(output: string): GitCommitEntry[] {
  const commits: GitCommitEntry[] = [];
  const chunks = output.split(`${LOG_RECORD_MARKER}\n`).filter((c) => c.trim());

  for (const chunk of chunks) {
    const endIdx = chunk.indexOf(`\n${LOG_RECORD_END}\n`);
    if (endIdx === -1) {
      continue;
    }

    const metaBlock = chunk.slice(0, endIdx);
    const metaLines = metaBlock.split("\n");
    // LOG_FORMAT: sha, shortSha, author, email, time, subject, parents (%P), decorate (%D), body (%b…)
    if (metaLines.length < 9) {
      continue;
    }

    // The length check above guarantees slots 0-8 are populated.
    const sha = metaLines[0]!;
    const shortSha = metaLines[1]!;
    const author = metaLines[2]!;
    const authorEmail = metaLines[3]!;
    const authorTimeStr = metaLines[4]!;
    const subject = metaLines[5]!;
    const parentsLine = metaLines[6]!;
    const decorateLine = metaLines[7]!;
    const bodyParts = metaLines.slice(8);
    const parentShas = parentsLine.trim()
      ? parentsLine.trim().split(/\s+/).filter(Boolean)
      : [];
    const refs = parseLogDecorations(decorateLine);
    const body = bodyParts.join("\n").trim() || undefined;

    const statusBlock = chunk.slice(endIdx + `\n${LOG_RECORD_END}\n`.length);
    const changedFiles = parseChangedFiles(
      statusBlock
        .split("\n")
        .filter((line) => line.trim() && !line.trim().startsWith(LOG_RECORD_MARKER)),
    );

    commits.push({
      sha,
      shortSha,
      author,
      authorEmail,
      authorTime: Number.parseInt(authorTimeStr, 10),
      subject,
      body,
      parentShas,
      isMerge: parentShas.length > 1,
      refs: refs.length > 0 ? refs : undefined,
      changedFiles,
    });
  }

  return commits;
}
