// Derive the result document from the block list, and keep each block's
// resultRange in sync. Pure functions (specs §12). Never emits conflict markers.

import { eolString } from "./lines";
import type { ChangeBlock, Eol } from "./types";

// Number of lines a piece of result text occupies. Empty string = 0 lines.
function lineCount(text: string): number {
  if (text === "") {
    return 0;
  }
  return text.split("\n").length;
}

// Recompute resultRange for every block based on current resultText lengths.
// Returns a new array; does not mutate inputs.
export function reflowResultRanges(blocks: ChangeBlock[]): ChangeBlock[] {
  let cursor = 0;
  return blocks.map((b) => {
    const n = lineCount(b.resultText);
    const range = { start: cursor, end: cursor + n };
    cursor += n;
    return { ...b, resultRange: range };
  });
}

// Join all blocks' resultText into the final file content, applying eol and
// final-newline. Blocks contributing empty text are skipped (no blank line).
export function serializeResult(
  blocks: ChangeBlock[],
  eol: Eol,
  finalNewline: boolean,
): string {
  const sep = eolString(eol);
  const pieces = blocks.map((b) => b.resultText).filter((t) => t !== "");
  if (pieces.length === 0) {
    return "";
  }
  return pieces.join(sep) + (finalNewline ? sep : "");
}
