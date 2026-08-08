// Marker-only merge engine (specs §11.4). Parses worktree conflict markers into
// ChangeBlocks without Git stage alignment.

import { splitLines } from "./lines";
import { parseMarkers } from "./markers";
import type { ChangeBlock, LineRange } from "./types";

const START = /^<{7}(?: |$)/;
const BASE = /^\|{7}(?: |$)/;
const SEP = /^={7}(?: |$)/;
const END = /^>{7}(?: |$)/;

export class MalformedConflictError extends Error {
  readonly code = "MALFORMED_MARKERS" as const;

  constructor(message = "Malformed conflict markers in worktree file.") {
    super(message);
    this.name = "MalformedConflictError";
  }
}

function lineRange(start: number, end: number): LineRange {
  return { start, end };
}

function makeUnchangedBlock(
  index: number,
  text: string,
  lineStart: number,
): ChangeBlock {
  const lineCount = text === "" ? 0 : splitLines(text).length;
  const range = lineRange(lineStart, lineStart + lineCount);
  return {
    id: `b${index}`,
    index,
    changeIndex: -1,
    kind: "unchanged",
    baseRange: range,
    oursRange: range,
    theirsRange: range,
    baseText: text,
    oursText: text,
    theirsText: text,
    resultText: text,
    resultRange: { start: 0, end: 0 },
    status: "resolved",
    metadata: { hasManualEdit: false },
  };
}

function makeConflictBlock(
  index: number,
  changeIndex: number,
  lineStart: number,
  ours: string,
  theirs: string,
  base?: string,
): ChangeBlock {
  const oursLines = ours === "" ? 0 : splitLines(ours).length;
  const theirsLines = theirs === "" ? 0 : splitLines(theirs).length;
  const baseLines = base === undefined ? 0 : base === "" ? 0 : splitLines(base).length;
  const baseText = base ?? "";
  return {
    id: `b${index}`,
    index,
    changeIndex,
    kind: "conflict",
    baseRange: lineRange(lineStart, lineStart + Math.max(baseLines, 1)),
    oursRange: lineRange(lineStart, lineStart + Math.max(oursLines, 1)),
    theirsRange: lineRange(lineStart, lineStart + Math.max(theirsLines, 1)),
    baseText,
    oursText: ours,
    theirsText: theirs,
    resultText: baseText,
    resultRange: { start: 0, end: 0 },
    status: "unresolved",
    metadata: {
      hasManualEdit: false,
      conflict: { ours: "pending", theirs: "pending", acceptedOrder: [] },
    },
  };
}

/** Build blocks by scanning marker lines in the worktree (fallback engine). */
export function buildChangeBlocksFromMarkers(worktree: string): ChangeBlock[] {
  const parsed = parseMarkers(worktree);
  if (parsed.malformed) {
    throw new MalformedConflictError();
  }

  const lines = splitLines(worktree);
  const blocks: ChangeBlock[] = [];
  let blockIndex = 0;
  let changeIndex = 0;
  let context: string[] = [];
  let virtualLine = 0;

  const flushContext = () => {
    if (context.length === 0) {
      return;
    }
    const text = context.join("\n");
    blocks.push(makeUnchangedBlock(blockIndex++, text, virtualLine));
    virtualLine += context.length;
    context = [];
  };

  let conflictIdx = 0;
  let i = 0;
  // Every `lines[...]` read below is bounded by its enclosing loop guard.
  while (i < lines.length) {
    if (!START.test(lines[i]!)) {
      context.push(lines[i]!);
      i++;
      continue;
    }

    flushContext();

    const conflict = parsed.conflicts[conflictIdx++];
    if (!conflict) {
      throw new MalformedConflictError();
    }

    // Skip marker region in source scan (parseMarkers already validated structure).
    i++;
    let section: "ours" | "base" | "theirs" = "ours";
    for (; i < lines.length; i++) {
      const line = lines[i]!;
      if (BASE.test(line)) {
        section = "base";
        continue;
      }
      if (SEP.test(line)) {
        section = "theirs";
        continue;
      }
      if (END.test(line)) {
        i++;
        break;
      }
      // Body lines are not duplicated into context — taken from parseMarkers.
      void section;
    }

    blocks.push(
      makeConflictBlock(
        blockIndex++,
        changeIndex++,
        virtualLine,
        conflict.ours,
        conflict.theirs,
        conflict.base,
      ),
    );
    const span = Math.max(
      splitLines(conflict.ours).length,
      splitLines(conflict.theirs).length,
      conflict.base ? splitLines(conflict.base).length : 1,
      1,
    );
    virtualLine += span;
  }

  flushContext();
  return blocks;
}