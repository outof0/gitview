// Word-level diff ranges for intra-line highlighting (specs §5.2, mockup .word).

export type CharRange = { start: number; end: number };

type WordToken = {
  text: string;
  start: number;
  end: number;
};

function tokenizeWords(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    tokens.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}

function lcsMatchedSourceIndices(a: string[], b: string[]): Set<number> {
  const rows = a.length;
  const cols = b.length;
  const dp: number[][] = Array.from({ length: rows + 1 }, () =>
    Array(cols + 1).fill(0),
  );

  // `!` throughout: i/j are bounded by the dp table dimensions built above.
  for (let i = 1; i <= rows; i++) {
    for (let j = 1; j <= cols; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]! + 1
          : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }

  const matched = new Set<number>();
  let i = rows;
  let j = cols;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      matched.add(i - 1);
      i--;
      j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
    }
  }
  return matched;
}

function mergeRanges(ranges: CharRange[]): CharRange[] {
  if (ranges.length === 0) {
    return [];
  }
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  // `!` throughout: `sorted` is non-empty and `merged` always has a last entry.
  const merged: CharRange[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1]!;
    const cur = sorted[i]!;
    if (cur.start <= prev.end) {
      prev.end = Math.max(prev.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/** Character ranges in `source` whose words differ from `reference`. */
export function wordDiffRanges(source: string, reference: string): CharRange[] {
  if (source === reference) {
    return [];
  }
  if (source === "") {
    return [];
  }
  if (reference === "") {
    return mergeRanges(
      tokenizeWords(source).map((w) => ({ start: w.start, end: w.end })),
    );
  }

  const sourceWords = tokenizeWords(source);
  const refWords = tokenizeWords(reference);
  const matched = lcsMatchedSourceIndices(
    sourceWords.map((w) => w.text),
    refWords.map((w) => w.text),
  );

  const ranges: CharRange[] = [];
  for (let i = 0; i < sourceWords.length; i++) {
    if (!matched.has(i)) {
      const word = sourceWords[i]!;
      ranges.push({ start: word.start, end: word.end });
    }
  }
  return mergeRanges(ranges);
}
