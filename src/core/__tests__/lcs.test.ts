import { describe, expect, it } from "vitest";
import {
  DiffTooLargeError,
  MAX_DIFF_LINES,
  assertDiffSize,
  diffLines,
} from "../lcs";

describe("lcs", () => {
  function applyOps(a: string[], b: string[], ops: ReturnType<typeof diffLines>) {
    const result: string[] = [];
    for (const op of ops) {
      if (op.type === "equal") {
        expect(a.slice(op.aStart, op.aEnd)).toEqual(b.slice(op.bStart, op.bEnd));
        result.push(...a.slice(op.aStart, op.aEnd));
      } else if (op.type === "insert" || op.type === "replace") {
        result.push(...b.slice(op.bStart, op.bEnd));
      }
    }
    return result;
  }

  it("returns a single equal op for identical inputs", () => {
    const ops = diffLines(["a", "b"], ["a", "b"]);
    expect(ops).toEqual([
      { type: "equal", aStart: 0, aEnd: 2, bStart: 0, bEnd: 2 },
    ]);
  });

  it("detects insert between equal runs with exact op boundaries", () => {
    const ops = diffLines(["a", "c"], ["a", "b", "c"]);
    expect(ops).toEqual([
      { type: "equal", aStart: 0, aEnd: 1, bStart: 0, bEnd: 1 },
      { type: "insert", aStart: 1, aEnd: 1, bStart: 1, bEnd: 2 },
      { type: "equal", aStart: 1, aEnd: 2, bStart: 2, bEnd: 3 },
    ]);
  });

  it("detects delete with exact op boundaries", () => {
    const ops = diffLines(["a", "b", "c"], ["a", "c"]);
    expect(ops).toEqual([
      { type: "equal", aStart: 0, aEnd: 1, bStart: 0, bEnd: 1 },
      { type: "delete", aStart: 1, aEnd: 2, bStart: 1, bEnd: 1 },
      { type: "equal", aStart: 2, aEnd: 3, bStart: 1, bEnd: 2 },
    ]);
  });

  it("coalesces a replace region when lines differ in place", () => {
    const ops = diffLines(["a", "x"], ["a", "y"]);
    expect(ops).toEqual([
      { type: "equal", aStart: 0, aEnd: 1, bStart: 0, bEnd: 1 },
      { type: "replace", aStart: 1, aEnd: 2, bStart: 1, bEnd: 2 },
    ]);
  });

  it("handles empty inputs", () => {
    expect(diffLines([], [])).toEqual([]);
    expect(diffLines([], ["x"])).toEqual([
      { type: "insert", aStart: 0, aEnd: 0, bStart: 0, bEnd: 1 },
    ]);
    expect(diffLines(["x"], [])).toEqual([
      { type: "delete", aStart: 0, aEnd: 1, bStart: 0, bEnd: 0 },
    ]);
  });

  it("rejects inputs above the line cap", () => {
    expect(() =>
      assertDiffSize(
        Array.from({ length: MAX_DIFF_LINES + 1 }, () => "x"),
        ["y"],
      ),
    ).toThrow(DiffTooLargeError);
  });

  it("handles large completely different inputs without a quadratic matrix", () => {
    const left = Array.from({ length: 10_000 }, (_, index) => `left-${index}`);
    const right = Array.from({ length: 10_000 }, (_, index) => `right-${index}`);
    expect(diffLines(left, right)).toEqual([
      { type: "replace", aStart: 0, aEnd: 10_000, bStart: 0, bEnd: 10_000 },
    ]);
  });

  it("reconstructs the target for varied repeated-line inputs", () => {
    let state = 0x1a2b3c4d;
    const random = () => {
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      return state;
    };
    const alphabet = ["a", "b", "c", "d", "e"];

    for (let sample = 0; sample < 250; sample++) {
      const a = Array.from(
        { length: random() % 18 },
        () => alphabet[random() % alphabet.length]!,
      );
      const b = Array.from(
        { length: random() % 18 },
        () => alphabet[random() % alphabet.length]!,
      );
      const ops = diffLines(a, b);
      expect(applyOps(a, b, ops)).toEqual(b);
    }
  });
});
