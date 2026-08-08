// 3-way diff: align ours and theirs against a common base, classify each
// aligned region into a ChangeKind. Core of the merge engine (specs §11, AD-1).
// Pure functions over line arrays. Algorithm: classic diff3 over two LCS diffs.

import { diffLines, type DiffOp } from "./lcs";
import { splitLines } from "./lines";
import type { ChangeBlock, ChangeKind, LineRange } from "./types";

// Per-base-line mapping: for each base line, which side line it maps to when
// equal, plus a flag array marking base lines that the side changed.
type SideMap = {
  // For base index i (0..baseLen-1): index in side if this base line is kept
  // equal, else -1.
  baseToSide: number[];
  // changedBaseRanges: ranges of base lines that are deleted/replaced by side.
  // insertsAtBase[i] = number of side lines inserted at base position i.
  // We capture changes as a set of "segments" between equal anchors instead.
  ops: DiffOp[];
};

function buildSideMap(base: string[], side: string[]): SideMap {
  const ops = diffLines(base, side);
  const baseToSide = Array.from({ length: base.length }, () => -1);
  for (const op of ops) {
    if (op.type === "equal") {
      for (let k = 0; k < op.aEnd - op.aStart; k++) {
        baseToSide[op.aStart + k] = op.bStart + k;
      }
    }
  }
  return { baseToSide, ops };
}

// True if the side changed any base line in [bs, be), or inserted at the
// boundary touching this region.
function sideChangedInBase(ops: DiffOp[], bs: number, be: number): boolean {
  for (const op of ops) {
    if (op.type === "equal") {
      continue;
    }
    if (op.aStart === op.aEnd) {
      continue;
    }
    const overlaps = op.aStart < be && op.aEnd > bs;
    if (overlaps) {
      return true;
    }
  }
  return false;
}

// Map a base range [bs, be) to the side line range covering it, including any
// inserts that fall within/adjacent to the range.
function mapSideRange(ops: DiffOp[], bs: number, be: number): LineRange {
  let start = -1;
  let end = -1;
  const consider = (s: number, e: number) => {
    if (start === -1 || s < start) {
      start = s;
    }
    if (e > end) {
      end = e;
    }
  };
  for (const op of ops) {
    const overlaps = op.aStart < be && op.aEnd > bs;
    const equalTouch = op.type === "equal" && op.aStart < be && op.aEnd > bs;
    if (equalTouch) {
      const localStart = Math.max(bs, op.aStart);
      const localEnd = Math.min(be, op.aEnd);
      consider(
        op.bStart + (localStart - op.aStart),
        op.bStart + (localEnd - op.aStart),
      );
    } else if (overlaps) {
      consider(op.bStart, op.bEnd);
    }
  }
  if (start === -1) {
    // Locate an anchor: side position aligned to bs.
    const pos = sidePosForBase(ops, bs);
    return { start: pos, end: pos };
  }
  return { start, end };
}

// Side line index aligned to a base position (for zero-width anchors).
function sidePosForBase(ops: DiffOp[], basePos: number): number {
  let pos = 0;
  for (const op of ops) {
    if (op.aEnd <= basePos) {
      pos = op.bEnd;
    } else if (op.aStart <= basePos) {
      if (op.type === "equal") {
        return op.bStart + (basePos - op.aStart);
      }
      return op.bStart;
    } else {
      break;
    }
  }
  return pos;
}

function insertionRangeAtBase(
  ops: DiffOp[],
  basePos: number,
): LineRange | null {
  let start = -1;
  let end = -1;
  for (const op of ops) {
    if (op.aStart === basePos && op.aEnd === basePos && op.bEnd > op.bStart) {
      if (start === -1 || op.bStart < start) {
        start = op.bStart;
      }
      if (op.bEnd > end) {
        end = op.bEnd;
      }
    }
  }
  return start === -1 ? null : { start, end };
}

function sliceText(lines: string[], range: LineRange): string {
  return lines.slice(range.start, range.end).join("\n");
}

// Build the ordered list of ChangeBlocks from base/ours/theirs.
export function buildChangeBlocks(
  baseText: string,
  oursText: string,
  theirsText: string,
): ChangeBlock[] {
  const base = splitLines(baseText);
  const ours = splitLines(oursText);
  const theirs = splitLines(theirsText);

  const oursMap = buildSideMap(base, ours);
  const theirsMap = buildSideMap(base, theirs);

  // Boundaries in base coords where classification may change.
  const bset = new Set<number>([0, base.length]);
  for (const op of [...oursMap.ops, ...theirsMap.ops]) {
    bset.add(op.aStart);
    bset.add(op.aEnd);
  }
  const bounds = [...bset]
    .filter((x) => x >= 0 && x <= base.length)
    .sort((a, b) => a - b);

  type Raw = {
    kind: ChangeKind;
    baseRange: LineRange;
    oursRange: LineRange;
    theirsRange: LineRange;
  };
  const raw: Raw[] = [];

  const pushRaw = (
    baseRange: LineRange,
    oursRange: LineRange,
    theirsRange: LineRange,
    oursChanged: boolean,
    theirsChanged: boolean,
  ) => {
    const oursSlice = sliceText(ours, oursRange);
    const theirsSlice = sliceText(theirs, theirsRange);

    let kind: ChangeKind;
    if (!oursChanged && !theirsChanged) {
      kind = "unchanged";
    } else if (oursChanged && !theirsChanged) {
      kind = "ours_only";
    } else if (!oursChanged && theirsChanged) {
      kind = "theirs_only";
    } else if (oursSlice === theirsSlice) {
      kind = "both_same";
    } else {
      kind = "conflict";
    }

    raw.push({ kind, baseRange, oursRange, theirsRange });
  };

  // `bounds` reads are kept in range by the loop guard and the `i + 1` skip below.
  for (let i = 0; i < bounds.length; i++) {
    const pos = bounds[i]!;
    const oursInsert = insertionRangeAtBase(oursMap.ops, pos);
    const theirsInsert = insertionRangeAtBase(theirsMap.ops, pos);

    if (oursInsert || theirsInsert) {
      const oursPos = sidePosForBase(oursMap.ops, pos);
      const theirsPos = sidePosForBase(theirsMap.ops, pos);
      pushRaw(
        { start: pos, end: pos },
        oursInsert ?? { start: oursPos, end: oursPos },
        theirsInsert ?? { start: theirsPos, end: theirsPos },
        !!oursInsert,
        !!theirsInsert,
      );
    }

    if (i >= bounds.length - 1) {
      continue;
    }

    const bs = pos;
    const be = bounds[i + 1]!;
    if (bs === be) {
      continue;
    }

    pushRaw(
      { start: bs, end: be },
      mapSideRange(oursMap.ops, bs, be),
      mapSideRange(theirsMap.ops, bs, be),
      sideChangedInBase(oursMap.ops, bs, be),
      sideChangedInBase(theirsMap.ops, bs, be),
    );
  }

  // Coalesce adjacent unchanged regions.
  const merged: Raw[] = [];
  for (const r of raw) {
    const prev = merged[merged.length - 1];
    if (prev && prev.kind === "unchanged" && r.kind === "unchanged") {
      prev.baseRange.end = r.baseRange.end;
      prev.oursRange.end = r.oursRange.end;
      prev.theirsRange.end = r.theirsRange.end;
    } else {
      merged.push({
        kind: r.kind,
        baseRange: { ...r.baseRange },
        oursRange: { ...r.oursRange },
        theirsRange: { ...r.theirsRange },
      });
    }
  }

  // Drop empty unchanged segments (zero lines on all sides).
  const cleaned = merged.filter(
    (r) =>
      !(
        r.kind === "unchanged" &&
        r.baseRange.start === r.baseRange.end &&
        r.oursRange.start === r.oursRange.end &&
        r.theirsRange.start === r.theirsRange.end
      ),
  );

  // Assign indices and build blocks.
  let changeIdx = 0;
  const blocks: ChangeBlock[] = cleaned.map((r, idx) => {
    const isNavigable = r.kind !== "unchanged";
    const changeIndex = isNavigable ? changeIdx++ : -1;
    const oursSlice = sliceText(ours, r.oursRange);
    const theirsSlice = sliceText(theirs, r.theirsRange);
    const baseSlice = sliceText(base, r.baseRange);

    const initialResult = initialResultFor(
      r.kind,
      oursSlice,
      theirsSlice,
      baseSlice,
    );
    const initialStatus = r.kind === "conflict" ? "unresolved" : "resolved";

    return {
      id: `b${idx}`,
      index: idx,
      changeIndex,
      kind: r.kind,
      baseRange: r.baseRange,
      oursRange: r.oursRange,
      theirsRange: r.theirsRange,
      baseText: baseSlice,
      oursText: oursSlice,
      theirsText: theirsSlice,
      resultText: initialResult,
      resultRange: { start: 0, end: 0 },
      status: initialStatus,
      metadata: {
        hasManualEdit: false,
        conflict:
          r.kind === "conflict"
            ? { ours: "pending", theirs: "pending", acceptedOrder: [] }
            : undefined,
      },
    };
  });

  return blocks;
}

function initialResultFor(
  kind: ChangeKind,
  ours: string,
  theirs: string,
  base: string,
): string {
  switch (kind) {
    case "unchanged":
      return base;
    case "ours_only":
      return ours;
    case "theirs_only":
      return theirs;
    case "both_same":
      return ours; // === theirs
    case "conflict":
      return base;
  }
}
