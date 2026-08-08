import { describe, it, expect } from "vitest";
import { wordDiffRanges } from "../wordDiff";

describe("wordDiffRanges", () => {
  it("returns no ranges for identical lines", () => {
    expect(wordDiffRanges("const x = 1", "const x = 1")).toEqual([]);
  });

  it("highlights changed words against base", () => {
    const ranges = wordDiffRanges("const value = 1", "const x = 1");
    expect(ranges).toEqual([{ start: 6, end: 11 }]);
  });

  it("highlights all words when reference is empty", () => {
    const ranges = wordDiffRanges("new line", "");
    expect(ranges).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 8 },
    ]);
  });
});
