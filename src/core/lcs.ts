// Line-oriented Myers diff with a linear-space bisect. The implementation is
// deterministic, trims common edges eagerly, and has a bounded work budget so
// pathological inputs cannot monopolize the extension host indefinitely.

export type DiffOp =
  | {
      type: "equal";
      aStart: number;
      aEnd: number;
      bStart: number;
      bEnd: number;
    }
  | {
      type: "replace";
      aStart: number;
      aEnd: number;
      bStart: number;
      bEnd: number;
    }
  | {
      type: "delete";
      aStart: number;
      aEnd: number;
      bStart: number;
      bEnd: number;
    }
  | {
      type: "insert";
      aStart: number;
      aEnd: number;
      bStart: number;
      bEnd: number;
    };

type PrimitiveDiffOp = Exclude<DiffOp, { type: "replace" }>;

export const MAX_DIFF_LINES = 12_000;
/** Maximum diagonal/snake steps before degrading the remaining range to replace. */
export const MAX_DIFF_WORK = 20_000_000;

export class DiffTooLargeError extends Error {
  readonly code = "DIFF_TOO_LARGE" as const;
  readonly lineCountA: number;
  readonly lineCountB: number;

  constructor(lineCountA: number, lineCountB: number) {
    super(
      `Diff is too large (${lineCountA} and ${lineCountB} lines). Open a smaller file or split the change.`,
    );
    this.name = "DiffTooLargeError";
    this.lineCountA = lineCountA;
    this.lineCountB = lineCountB;
  }
}

export function assertDiffSize(a: string[], b: string[]): void {
  if (a.length > MAX_DIFF_LINES || b.length > MAX_DIFF_LINES) {
    throw new DiffTooLargeError(a.length, b.length);
  }
}

type WorkBudget = { remaining: number };

function spend(budget: WorkBudget, amount = 1): boolean {
  budget.remaining -= amount;
  return budget.remaining >= 0;
}

function appendPrimitive(ops: PrimitiveDiffOp[], next: PrimitiveDiffOp): void {
  if (next.aStart === next.aEnd && next.bStart === next.bEnd) {
    return;
  }
  const previous = ops[ops.length - 1];
  if (!previous || previous.type !== next.type) {
    ops.push(next);
    return;
  }

  if (
    next.type === "equal" &&
    previous.type === "equal" &&
    previous.aEnd === next.aStart &&
    previous.bEnd === next.bStart
  ) {
    previous.aEnd = next.aEnd;
    previous.bEnd = next.bEnd;
    return;
  }
  if (
    next.type === "delete" &&
    previous.type === "delete" &&
    previous.aEnd === next.aStart &&
    previous.bStart === next.bStart
  ) {
    previous.aEnd = next.aEnd;
    return;
  }
  if (
    next.type === "insert" &&
    previous.type === "insert" &&
    previous.aStart === next.aStart &&
    previous.bEnd === next.bStart
  ) {
    previous.bEnd = next.bEnd;
    return;
  }
  ops.push(next);
}

function appendChange(
  ops: PrimitiveDiffOp[],
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): void {
  if (aStart < aEnd) {
    appendPrimitive(ops, {
      type: "delete",
      aStart,
      aEnd,
      bStart,
      bEnd: bStart,
    });
  }
  if (bStart < bEnd) {
    appendPrimitive(ops, {
      type: "insert",
      aStart: aEnd,
      aEnd,
      bStart,
      bEnd,
    });
  }
}

function rangesShareLine(
  a: string[],
  aStart: number,
  aEnd: number,
  b: string[],
  bStart: number,
  bEnd: number,
): boolean {
  if (aEnd - aStart <= bEnd - bStart) {
    const values = new Set(a.slice(aStart, aEnd));
    for (let index = bStart; index < bEnd; index++) {
      if (values.has(b[index]!)) {
        return true;
      }
    }
    return false;
  }
  const values = new Set(b.slice(bStart, bEnd));
  for (let index = aStart; index < aEnd; index++) {
    if (values.has(a[index]!)) {
      return true;
    }
  }
  return false;
}

/** Find a midpoint where the forward and reverse Myers frontiers overlap. */
function bisect(
  a: string[],
  aStart: number,
  aEnd: number,
  b: string[],
  bStart: number,
  bEnd: number,
  budget: WorkBudget,
): [number, number] | null {
  const n = aEnd - aStart;
  const m = bEnd - bStart;
  const maxDistance = Math.ceil((n + m) / 2);
  const offset = maxDistance + 1;
  const vectorLength = 2 * maxDistance + 3;
  const forward = new Int32Array(vectorLength);
  const reverse = new Int32Array(vectorLength);
  forward.fill(-1);
  reverse.fill(-1);
  forward[offset + 1] = 0;
  reverse[offset + 1] = 0;

  const delta = n - m;
  const overlapOnForwardPass = delta % 2 !== 0;
  let forwardStart = 0;
  let forwardEnd = 0;
  let reverseStart = 0;
  let reverseEnd = 0;

  // `offset` reserves one slot of slack on each side, so `vectorIndex - 1` and
  // `vectorIndex + 1` always land inside the vectors for every visited diagonal.
  for (let distance = 0; distance <= maxDistance; distance++) {
    for (
      let diagonal = -distance + forwardStart;
      diagonal <= distance - forwardEnd;
      diagonal += 2
    ) {
      if (!spend(budget)) {
        return null;
      }
      const vectorIndex = offset + diagonal;
      let x: number;
      if (
        diagonal === -distance ||
        (diagonal !== distance &&
          forward[vectorIndex - 1]! < forward[vectorIndex + 1]!)
      ) {
        x = forward[vectorIndex + 1]!;
      } else {
        x = forward[vectorIndex - 1]! + 1;
      }
      let y = x - diagonal;
      while (x < n && y < m && a[aStart + x] === b[bStart + y]) {
        if (!spend(budget)) {
          return null;
        }
        x++;
        y++;
      }
      forward[vectorIndex] = x;

      if (x > n) {
        forwardEnd += 2;
      } else if (y > m) {
        forwardStart += 2;
      } else if (overlapOnForwardPass) {
        const reverseDiagonal = delta - diagonal;
        const reverseIndex = offset + reverseDiagonal;
        if (
          reverseIndex >= 0 &&
          reverseIndex < vectorLength &&
          reverse[reverseIndex] !== -1 &&
          x >= n - reverse[reverseIndex]!
        ) {
          return [aStart + x, bStart + y];
        }
      }
    }

    for (
      let diagonal = -distance + reverseStart;
      diagonal <= distance - reverseEnd;
      diagonal += 2
    ) {
      if (!spend(budget)) {
        return null;
      }
      const vectorIndex = offset + diagonal;
      let x: number;
      if (
        diagonal === -distance ||
        (diagonal !== distance &&
          reverse[vectorIndex - 1]! < reverse[vectorIndex + 1]!)
      ) {
        x = reverse[vectorIndex + 1]!;
      } else {
        x = reverse[vectorIndex - 1]! + 1;
      }
      let y = x - diagonal;
      while (
        x < n &&
        y < m &&
        a[aEnd - x - 1] === b[bEnd - y - 1]
      ) {
        if (!spend(budget)) {
          return null;
        }
        x++;
        y++;
      }
      reverse[vectorIndex] = x;

      if (x > n) {
        reverseEnd += 2;
      } else if (y > m) {
        reverseStart += 2;
      } else if (!overlapOnForwardPass) {
        const forwardDiagonal = delta - diagonal;
        const forwardIndex = offset + forwardDiagonal;
        if (
          forwardIndex >= 0 &&
          forwardIndex < vectorLength &&
          forward[forwardIndex] !== -1 &&
          forward[forwardIndex]! >= n - x
        ) {
          const forwardX = forward[forwardIndex]!;
          const forwardY = forwardX - forwardDiagonal;
          return [aStart + forwardX, bStart + forwardY];
        }
      }
    }
  }
  return null;
}

function diffRange(
  a: string[],
  aStartInput: number,
  aEndInput: number,
  b: string[],
  bStartInput: number,
  bEndInput: number,
  budget: WorkBudget,
  ops: PrimitiveDiffOp[],
  depth: number,
): void {
  let aStart = aStartInput;
  let bStart = bStartInput;
  while (aStart < aEndInput && bStart < bEndInput && a[aStart] === b[bStart]) {
    aStart++;
    bStart++;
  }
  if (aStart > aStartInput) {
    appendPrimitive(ops, {
      type: "equal",
      aStart: aStartInput,
      aEnd: aStart,
      bStart: bStartInput,
      bEnd: bStart,
    });
  }

  let aEnd = aEndInput;
  let bEnd = bEndInput;
  while (aStart < aEnd && bStart < bEnd && a[aEnd - 1] === b[bEnd - 1]) {
    aEnd--;
    bEnd--;
  }

  if (aStart === aEnd || bStart === bEnd) {
    appendChange(ops, aStart, aEnd, bStart, bEnd);
  } else if (depth >= 256 || budget.remaining <= 0) {
    appendChange(ops, aStart, aEnd, bStart, bEnd);
  } else if (aEnd - aStart === 1) {
    const match = b.indexOf(a[aStart]!, bStart);
    if (match >= bStart && match < bEnd) {
      appendChange(ops, aStart, aStart, bStart, match);
      appendPrimitive(ops, {
        type: "equal",
        aStart,
        aEnd,
        bStart: match,
        bEnd: match + 1,
      });
      appendChange(ops, aEnd, aEnd, match + 1, bEnd);
    } else {
      appendChange(ops, aStart, aEnd, bStart, bEnd);
    }
  } else if (bEnd - bStart === 1) {
    const match = a.indexOf(b[bStart]!, aStart);
    if (match >= aStart && match < aEnd) {
      appendChange(ops, aStart, match, bStart, bStart);
      appendPrimitive(ops, {
        type: "equal",
        aStart: match,
        aEnd: match + 1,
        bStart,
        bEnd,
      });
      appendChange(ops, match + 1, aEnd, bEnd, bEnd);
    } else {
      appendChange(ops, aStart, aEnd, bStart, bEnd);
    }
  } else if (!rangesShareLine(a, aStart, aEnd, b, bStart, bEnd)) {
    appendChange(ops, aStart, aEnd, bStart, bEnd);
  } else {
    const split = bisect(a, aStart, aEnd, b, bStart, bEnd, budget);
    if (
      !split ||
      (split[0] === aStart && split[1] === bStart) ||
      (split[0] === aEnd && split[1] === bEnd)
    ) {
      appendChange(ops, aStart, aEnd, bStart, bEnd);
    } else {
      diffRange(a, aStart, split[0], b, bStart, split[1], budget, ops, depth + 1);
      diffRange(a, split[0], aEnd, b, split[1], bEnd, budget, ops, depth + 1);
    }
  }

  if (aEnd < aEndInput) {
    appendPrimitive(ops, {
      type: "equal",
      aStart: aEnd,
      aEnd: aEndInput,
      bStart: bEnd,
      bEnd: bEndInput,
    });
  }
}

function coalesceChanges(primitive: PrimitiveDiffOp[]): DiffOp[] {
  const result: DiffOp[] = [];
  // Every read below is guarded by `index < primitive.length`.
  for (let index = 0; index < primitive.length; ) {
    const current = primitive[index]!;
    if (current.type === "equal") {
      const previous = result[result.length - 1];
      if (
        previous?.type === "equal" &&
        previous.aEnd === current.aStart &&
        previous.bEnd === current.bStart
      ) {
        previous.aEnd = current.aEnd;
        previous.bEnd = current.bEnd;
      } else {
        result.push({ ...current });
      }
      index++;
      continue;
    }

    let aStart = current.aStart;
    let aEnd = current.aEnd;
    let bStart = current.bStart;
    let bEnd = current.bEnd;
    while (index < primitive.length && primitive[index]!.type !== "equal") {
      const change = primitive[index]!;
      aStart = Math.min(aStart, change.aStart);
      aEnd = Math.max(aEnd, change.aEnd);
      bStart = Math.min(bStart, change.bStart);
      bEnd = Math.max(bEnd, change.bEnd);
      index++;
    }

    result.push({
      type:
        aStart < aEnd && bStart < bEnd
          ? "replace"
          : aStart < aEnd
            ? "delete"
            : "insert",
      aStart,
      aEnd,
      bStart,
      bEnd,
    });
  }
  return result;
}

export type DiffLinesOptions = {
  /** Primarily useful for hosts that need a stricter synchronous work budget. */
  maxWork?: number;
};

export function diffLines(
  a: string[],
  b: string[],
  options: DiffLinesOptions = {},
): DiffOp[] {
  assertDiffSize(a, b);
  if (a.length === 0 && b.length === 0) {
    return [];
  }
  const primitive: PrimitiveDiffOp[] = [];
  diffRange(
    a,
    0,
    a.length,
    b,
    0,
    b.length,
    { remaining: options.maxWork ?? MAX_DIFF_WORK },
    primitive,
    0,
  );
  return coalesceChanges(primitive);
}
