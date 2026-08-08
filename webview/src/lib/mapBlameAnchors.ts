/**
 * Content-stable blame anchoring (JetBrains-style).
 *
 * When the user inserts/deletes lines, line numbers shift but unchanged source
 * lines should keep their annotate metadata. We map original → current by
 * exact line-text identity using:
 *  1) unique common lines as anchors
 *  2) expansion of equal runs around / between anchors
 *  3) LCS on remaining small gaps
 *
 * Only exact text matches keep blame; edits and pure inserts stay blank.
 */

export type BlameAnchorSource = {
  text?: string;
};

const MAX_LCS_CELLS = 250_000;

/**
 * Returns one entry per current document line: the original blame source if
 * that line still matches an original line by content (order-preserving), else null.
 */
export function mapBlameAnchors<T extends BlameAnchorSource>(
  original: readonly T[],
  currentLines: readonly string[],
): Array<T | null> {
  const n = original.length;
  const m = currentLines.length;
  const result: Array<T | null> = Array.from({ length: m }, () => null);
  if (n === 0 || m === 0) {
    return result;
  }

  const a = original.map((line) => line.text ?? "");
  const b = currentLines as string[];

  const usedA = Array.from<boolean>({ length: n }).fill(false);
  const usedB = Array.from<boolean>({ length: m }).fill(false);

  const countA = new Map<string, number>();
  const countB = new Map<string, number>();
  for (const s of a) {
    countA.set(s, (countA.get(s) ?? 0) + 1);
  }
  for (const s of b) {
    countB.set(s, (countB.get(s) ?? 0) + 1);
  }

  // Pass 1 — unique lines that appear once on both sides become anchors.
  const uniquePosA = new Map<string, number>();
  for (let i = 0; i < n; i += 1) {
    const s = a[i]!;
    if (countA.get(s) === 1 && countB.get(s) === 1) {
      uniquePosA.set(s, i);
    }
  }

  type Anchor = { ai: number; bi: number };
  const anchors: Anchor[] = [];
  for (let j = 0; j < m; j += 1) {
    const ai = uniquePosA.get(b[j]!);
    if (ai === undefined || usedA[ai]) {
      continue;
    }
    // Keep anchors in increasing order on both sides (order-preserving).
    const last = anchors[anchors.length - 1];
    if (last && ai <= last.ai) {
      continue;
    }
    usedA[ai] = true;
    usedB[j] = true;
    result[j] = original[ai]!;
    anchors.push({ ai, bi: j });
  }

  // Pass 2 — expand equal runs around anchors and fill gaps.
  const segments: Array<{ a0: number; a1: number; b0: number; b1: number }> = [];
  let prevAi = 0;
  let prevBi = 0;
  for (const anchor of anchors) {
    segments.push({ a0: prevAi, a1: anchor.ai, b0: prevBi, b1: anchor.bi });
    prevAi = anchor.ai + 1;
    prevBi = anchor.bi + 1;
  }
  segments.push({ a0: prevAi, a1: n, b0: prevBi, b1: m });

  for (const seg of segments) {
    matchSegment(a, b, original, result, usedA, usedB, seg.a0, seg.a1, seg.b0, seg.b1);
  }

  return result;
}

function matchSegment<T extends BlameAnchorSource>(
  a: string[],
  b: string[],
  original: readonly T[],
  result: Array<T | null>,
  usedA: boolean[],
  usedB: boolean[],
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): void {
  if (a0 >= a1 || b0 >= b1) {
    return;
  }

  // Forward equal run
  let ai = a0;
  let bi = b0;
  while (ai < a1 && bi < b1) {
    if (!usedA[ai] && !usedB[bi] && a[ai] === b[bi]) {
      usedA[ai] = true;
      usedB[bi] = true;
      result[bi] = original[ai]!;
      ai += 1;
      bi += 1;
    } else {
      break;
    }
  }

  // Backward equal run
  let aj = a1 - 1;
  let bj = b1 - 1;
  while (aj >= ai && bj >= bi) {
    if (!usedA[aj] && !usedB[bj] && a[aj] === b[bj]) {
      usedA[aj] = true;
      usedB[bj] = true;
      result[bj] = original[aj]!;
      aj -= 1;
      bj -= 1;
    } else {
      break;
    }
  }

  const na = aj - ai + 1;
  const nb = bj - bi + 1;
  if (na <= 0 || nb <= 0) {
    return;
  }

  // Small remaining gap → full LCS of equal lines
  if (na * nb <= MAX_LCS_CELLS) {
    const pairs = lcsEqualIndexPairs(a, ai, aj + 1, b, bi, bj + 1);
    for (const [x, y] of pairs) {
      if (!usedA[x] && !usedB[y] && a[x] === b[y]) {
        usedA[x] = true;
        usedB[y] = true;
        result[y] = original[x]!;
      }
    }
    return;
  }

  // Large gap — greedy sequential scan by first free equal match
  greedyMatch(a, b, original, result, usedA, usedB, ai, aj + 1, bi, bj + 1);
}

function greedyMatch<T extends BlameAnchorSource>(
  a: string[],
  b: string[],
  original: readonly T[],
  result: Array<T | null>,
  usedA: boolean[],
  usedB: boolean[],
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): void {
  // Index free positions in A by text
  const freeA = new Map<string, number[]>();
  for (let i = a0; i < a1; i += 1) {
    if (usedA[i]) {
      continue;
    }
    const s = a[i]!;
    const list = freeA.get(s);
    if (list) {
      list.push(i);
    } else {
      freeA.set(s, [i]);
    }
  }

  let minAi = a0;
  for (let j = b0; j < b1; j += 1) {
    if (usedB[j]) {
      continue;
    }
    const list = freeA.get(b[j]!);
    if (!list || list.length === 0) {
      continue;
    }
    // Take the earliest free A index that preserves order
    let pick = -1;
    for (let k = 0; k < list.length; k += 1) {
      const ai = list[k]!;
      if (!usedA[ai] && ai >= minAi) {
        pick = ai;
        list.splice(k, 1);
        break;
      }
    }
    if (pick < 0) {
      continue;
    }
    usedA[pick] = true;
    usedB[j] = true;
    result[j] = original[pick]!;
    minAi = pick + 1;
  }
}

/** Classic LCS recovering pairs of equal indices in [a0,a1) × [b0,b1). */
function lcsEqualIndexPairs(
  a: string[],
  a0: number,
  a1: number,
  b: string[],
  b0: number,
  b1: number,
): Array<[number, number]> {
  const na = a1 - a0;
  const nb = b1 - b0;
  // dp[i][j] = LCS length of a[a0..a0+i) and b[b0..b0+j)
  const dp: number[][] = Array.from({ length: na + 1 }, () =>
    Array.from<number>({ length: nb + 1 }).fill(0),
  );
  for (let i = 1; i <= na; i += 1) {
    for (let j = 1; j <= nb; j += 1) {
      if (a[a0 + i - 1] === b[b0 + j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  const pairs: Array<[number, number]> = [];
  let i = na;
  let j = nb;
  while (i > 0 && j > 0) {
    if (a[a0 + i - 1] === b[b0 + j - 1]) {
      pairs.push([a0 + i - 1, b0 + j - 1]);
      i -= 1;
      j -= 1;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  pairs.reverse();
  return pairs;
}
