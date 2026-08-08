import type { BlameLine } from "../types/blame";

const PORCELAIN_HEADER = /^([0-9a-f]{40})\s+(\d+)\s+(\d+)(?:\s+(\d+))?$/;

export const BLAME_MAX_LINES = 5000;

function readTabLine(lines: string[], index: number): { text: string; next: number } {
  const line = lines[index];
  if (line?.startsWith("\t")) {
    return { text: line.slice(1), next: index + 1 };
  }
  return { text: "", next: index };
}

function skipMetadataUntilTab(lines: string[], start: number): number {
  let i = start;
  for (;;) {
    const line = lines[i];
    if (line === undefined || line.startsWith("\t")) {
      break;
    }
    if (PORCELAIN_HEADER.test(line)) {
      return i;
    }
    i++;
  }
  return i;
}

function parseMetadata(lines: string[], start: number): {
  author: string;
  authorEmail: string;
  authorTime: number;
  summary: string;
  next: number;
} {
  let author = "";
  let authorEmail = "";
  let authorTime = 0;
  let summary = "";
  let i = start;
  for (;;) {
    const line = lines[i];
    if (line === undefined || line.startsWith("\t")) {
      break;
    }
    if (line.startsWith("author ")) {
      author = line.slice("author ".length);
    } else if (line.startsWith("author-mail ")) {
      authorEmail = line.slice("author-mail ".length).replace(/^<|>$/g, "");
    } else if (line.startsWith("author-time ")) {
      authorTime = Number.parseInt(line.slice("author-time ".length), 10);
    } else if (line.startsWith("summary ")) {
      summary = line.slice("summary ".length);
    }
    i++;
  }
  return { author, authorEmail, authorTime, summary, next: i };
}

function readGroupedTabLines(
  lines: string[],
  start: number,
  lineCount: number,
): { texts: string[]; next: number } {
  const texts: string[] = [];
  let i = start;
  while (texts.length < lineCount) {
    const line = lines[i];
    if (line === undefined || PORCELAIN_HEADER.test(line)) {
      break;
    }
    if (line.startsWith("\t")) {
      texts.push(line.slice(1));
      i++;
      continue;
    }
    break;
  }
  while (texts.length < lineCount) {
    texts.push("");
  }
  return { texts, next: i };
}

export function parseBlamePorcelain(output: string): BlameLine[] {
  const lines = output.split("\n");
  const result: BlameLine[] = [];
  const lineIndex = new Map<number, number>();
  let i = 0;

  while (i < lines.length) {
    const headerMatch = lines[i]?.match(PORCELAIN_HEADER);
    if (!headerMatch) {
      i++;
      continue;
    }

    // Groups 1 and 3 are non-optional in PORCELAIN_HEADER.
    const sha = headerMatch[1]!;
    const finalLine = Number.parseInt(headerMatch[3]!, 10);
    const lineCount = headerMatch[4] ? Number.parseInt(headerMatch[4], 10) : 1;

    // Per-line source text after a grouped `1 1 N` attribution header.
    if (lineCount === 1 && lineIndex.has(finalLine)) {
      i = skipMetadataUntilTab(lines, i + 1);
      const tab = readTabLine(lines, i);
      i = tab.next;
      const existing = result[lineIndex.get(finalLine)!];
      if (existing) {
        existing.text = tab.text;
      }
      continue;
    }

    const meta = parseMetadata(lines, i + 1);
    i = meta.next;

    const blameLine: BlameLine = {
      lineNumber: finalLine,
      sha,
      shortSha: sha.slice(0, 7),
      author: meta.author,
      authorEmail: meta.authorEmail,
      authorTime: meta.authorTime,
      summary: meta.summary,
    };

    if (lineCount > 1) {
      const grouped = readGroupedTabLines(lines, i, lineCount);
      i = grouped.next;

      for (let n = 0; n < lineCount; n++) {
        const lineNumber = finalLine + n;
        const entry: BlameLine = {
          ...blameLine,
          lineNumber,
          text: grouped.texts[n] ?? "",
        };
        lineIndex.set(lineNumber, result.length);
        result.push(entry);
      }
      continue;
    }

    const tab = readTabLine(lines, i);
    i = tab.next;
    const entry: BlameLine = {
      ...blameLine,
      lineNumber: finalLine,
      text: tab.text,
    };
    lineIndex.set(finalLine, result.length);
    result.push(entry);
  }

  return result.sort((a, b) => a.lineNumber - b.lineNumber);
}

export function truncateBlameLines(
  lines: BlameLine[],
  maxLines = BLAME_MAX_LINES,
): { lines: BlameLine[]; truncated: boolean } {
  if (lines.length <= maxLines) {
    return { lines, truncated: false };
  }
  return { lines: lines.slice(0, maxLines), truncated: true };
}