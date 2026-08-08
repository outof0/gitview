import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import type { DiffLineSelection } from "../../shared/types/diff";
import { splitPatchHunks } from "./hunkPatch";
import type { GitExecFn } from "./types";

type ParsedPatchLine = {
  prefix: " " | "+" | "-";
  content: string;
  oldLine: number | null;
  newLine: number | null;
};

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const CONTEXT_LINES = 3;

function selectionKey(side: DiffLineSelection["side"], line: number): string {
  return `${side}:${line}`;
}

function parseHunkBody(hunkPatch: string): {
  fileHeader: string;
  headerLine: string;
  lines: ParsedPatchLine[];
} | null {
  const parts = hunkPatch.split("\n");
  const headerIdx = parts.findIndex((line) => HUNK_HEADER.test(line));
  if (headerIdx < 0) {
    return null;
  }

  const fileHeader = parts.slice(0, headerIdx).join("\n");
  const headerLine = parts[headerIdx]!;
  const headerMatch = headerLine.match(HUNK_HEADER);
  if (!headerMatch) {
    return null;
  }

  let oldLine = Number(headerMatch[1]);
  let newLine = Number(headerMatch[3]);
  const lines: ParsedPatchLine[] = [];

  for (let i = headerIdx + 1; i < parts.length; i++) {
    const raw = parts[i]!;
    if (!raw) {
      continue;
    }
    const prefix = raw[0];
    if (prefix !== " " && prefix !== "+" && prefix !== "-") {
      continue;
    }
    const content = raw.slice(1);
    if (prefix === " ") {
      lines.push({
        prefix: " ",
        content,
        oldLine,
        newLine,
      });
      oldLine += 1;
      newLine += 1;
      continue;
    }
    if (prefix === "-") {
      lines.push({
        prefix: "-",
        content,
        oldLine,
        newLine: null,
      });
      oldLine += 1;
      continue;
    }
    lines.push({
      prefix: "+",
      content,
      oldLine: null,
      newLine,
    });
    newLine += 1;
  }

  return { fileHeader, headerLine, lines };
}

function isLineDirectlySelected(
  line: ParsedPatchLine,
  selected: Set<string>,
): boolean {
  if (line.prefix === "-" && line.oldLine !== null) {
    return selected.has(selectionKey("old", line.oldLine));
  }
  if (line.prefix === "+" && line.newLine !== null) {
    return selected.has(selectionKey("new", line.newLine));
  }
  return false;
}

function expandSelectedIndices(
  lines: ParsedPatchLine[],
  selected: Set<string>,
): Set<number> {
  const expanded = new Set<number>();
  let blockStart = 0;

  function flushBlock(end: number) {
    if (end <= blockStart) {
      return;
    }
    const block: Array<{ idx: number; line: ParsedPatchLine }> = [];
    for (let i = blockStart; i < end; i++) {
      const line = lines[i]!;
      if (line.prefix !== " ") {
        block.push({ idx: i, line });
      }
    }
    if (block.length === 0) {
      return;
    }

    const minus = block.filter((entry) => entry.line.prefix === "-");
    const plus = block.filter((entry) => entry.line.prefix === "+");
    const chosen = new Set<number>();

    for (const entry of block) {
      if (isLineDirectlySelected(entry.line, selected)) {
        chosen.add(entry.idx);
      }
    }

    for (const entry of minus) {
      if (!chosen.has(entry.idx)) {
        continue;
      }
      const pos = minus.indexOf(entry);
      const paired = plus[pos];
      if (paired) {
        chosen.add(paired.idx);
      }
    }
    for (const entry of plus) {
      if (!chosen.has(entry.idx)) {
        continue;
      }
      const pos = plus.indexOf(entry);
      const paired = minus[pos];
      if (paired) {
        chosen.add(paired.idx);
      }
    }

    for (const idx of chosen) {
      expanded.add(idx);
    }
  }

  for (let i = 0; i <= lines.length; i++) {
    if (i === lines.length || lines[i]!.prefix === " ") {
      flushBlock(i);
      blockStart = i + 1;
    }
  }

  return expanded;
}

function includeWithContext(
  lines: ParsedPatchLine[],
  selectedIndices: Set<number>,
): Set<number> {
  if (selectedIndices.size === 0) {
    return new Set();
  }

  const sorted = [...selectedIndices].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const included = new Set<number>(selectedIndices);

  let contextBefore = 0;
  for (let i = min - 1; i >= 0 && contextBefore < CONTEXT_LINES; i -= 1) {
    if (lines[i]!.prefix !== " ") {
      break;
    }
    included.add(i);
    contextBefore += 1;
  }

  let contextAfter = 0;
  for (let i = max + 1; i < lines.length && contextAfter < CONTEXT_LINES; i += 1) {
    if (lines[i]!.prefix !== " ") {
      break;
    }
    included.add(i);
    contextAfter += 1;
  }

  return included;
}

function buildHunkHeader(lines: ParsedPatchLine[]): string | null {
  let oldStart: number | null = null;
  let newStart: number | null = null;
  let oldCount = 0;
  let newCount = 0;

  for (const line of lines) {
    if (line.prefix !== "+") {
      oldCount += 1;
      if (oldStart === null && line.oldLine !== null) {
        oldStart = line.oldLine;
      }
    }
    if (line.prefix !== "-") {
      newCount += 1;
      if (newStart === null && line.newLine !== null) {
        newStart = line.newLine;
      }
    }
  }

  if (oldStart === null || newStart === null || oldCount === 0 || newCount === 0) {
    return null;
  }

  const oldPart = oldCount === 1 ? `${oldStart}` : `${oldStart},${oldCount}`;
  const newPart = newCount === 1 ? `${newStart}` : `${newStart},${newCount}`;
  return `@@ -${oldPart} +${newPart} @@`;
}

function buildRanges(indices: Set<number>): Array<[number, number]> {
  const sorted = [...indices].sort((a, b) => a - b);
  const ranges: Array<[number, number]> = [];
  let start = -1;
  let prev = -1;

  for (const idx of sorted) {
    if (start < 0) {
      start = idx;
      prev = idx;
      continue;
    }
    if (idx === prev + 1) {
      prev = idx;
      continue;
    }
    ranges.push([start, prev]);
    start = idx;
    prev = idx;
  }
  if (start >= 0) {
    ranges.push([start, prev]);
  }
  return ranges;
}

export function extractLinePatch(
  unifiedDiff: string,
  selections: DiffLineSelection[],
): string | null {
  if (!unifiedDiff.trim() || selections.length === 0) {
    return null;
  }

  const selected = new Set(
    selections.map((entry) => selectionKey(entry.side, entry.line)),
  );
  const hunks = splitPatchHunks(unifiedDiff);
  const outputHunks: string[] = [];
  let fileHeader: string | null = null;

  for (const hunkPatch of hunks) {
    const parsed = parseHunkBody(hunkPatch);
    if (!parsed) {
      continue;
    }
    fileHeader ??= parsed.fileHeader;

    const selectedIndices = expandSelectedIndices(parsed.lines, selected);
    const included = includeWithContext(parsed.lines, selectedIndices);
    if (included.size === 0) {
      continue;
    }

    for (const [start, end] of buildRanges(included)) {
      const slice = parsed.lines.slice(start, end + 1);
      const header = buildHunkHeader(slice);
      if (!header) {
        continue;
      }
      const body = slice.map((line) => `${line.prefix}${line.content}`).join("\n");
      outputHunks.push(`${header}\n${body}`);
    }
  }

  if (!fileHeader || outputHunks.length === 0) {
    return null;
  }

  return `${fileHeader}\n${outputHunks.join("\n")}`;
}

async function writeTempPatch(content: string): Promise<string> {
  const file = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), "gitview-line-patch-")),
    "lines.patch",
  );
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  await fs.writeFile(file, normalized, "utf8");
  return file;
}

export function createLinePatchApi(execGit: GitExecFn) {
  async function readDiff(
    repoRoot: string,
    relativePath: string,
    staged: boolean,
  ): Promise<string> {
    const args = staged
      ? ["diff", "--cached", "HEAD", "--", relativePath]
      : ["diff", "HEAD", "--", relativePath];
    const { stdout } = await execGit(repoRoot, args);
    return stdout;
  }

  async function applyCachedPatch(
    repoRoot: string,
    patch: string,
    reverse = false,
  ): Promise<void> {
    const patchFile = await writeTempPatch(patch);
    try {
      const args = ["apply", "--cached"];
      if (reverse) {
        args.push("--reverse");
      }
      args.push(patchFile);
      await execGit(repoRoot, args);
    } finally {
      await fs.rm(path.dirname(patchFile), { recursive: true, force: true });
    }
  }

  async function stageLines(
    repoRoot: string,
    relativePath: string,
    selections: DiffLineSelection[],
  ): Promise<void> {
    const diff = await readDiff(repoRoot, relativePath, false);
    const patch = extractLinePatch(diff, selections);
    if (!patch) {
      throw new Error(
        "Selected lines are no longer available. Refresh the diff and try again.",
      );
    }
    await applyCachedPatch(repoRoot, patch, false);
  }

  async function unstageLines(
    repoRoot: string,
    relativePath: string,
    selections: DiffLineSelection[],
  ): Promise<void> {
    const diff = await readDiff(repoRoot, relativePath, true);
    const patch = extractLinePatch(diff, selections);
    if (!patch) {
      throw new Error(
        "Selected staged lines are no longer available. Refresh the diff and try again.",
      );
    }
    await applyCachedPatch(repoRoot, patch, true);
  }

  return {
    extractLinePatch,
    stageLines,
    unstageLines,
    readDiff,
  };
}