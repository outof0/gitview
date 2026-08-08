import { describe, expect, it } from "vitest";
import {
  applyMonacoChangeToSpans,
  applyMonacoChangesToSpans,
  buildCenterSpans,
  extractSpanText,
  joinCenterText,
  spanAtLine,
  type CenterBlockSpan,
} from "../centerDocument";
import type { BlockRows } from "../rowsTypes";

function makeBlock(
  partial: Partial<BlockRows> &
    Pick<BlockRows, "blockId" | "centerText" | "resultStart" | "resultEnd">,
): BlockRows {
  return {
    kind: "unchanged",
    status: "unresolved",
    changeType: "unchanged",
    navigable: false,
    isConflict: false,
    resolved: false,
    blameLeft: "",
    blameRight: "",
    baseLines: [],
    left: [],
    center: [],
    right: [],
    ...partial,
  };
}

describe("joinCenterText / buildCenterSpans", () => {
  it("joins non-empty block texts into one document", () => {
    const blocks = [
      makeBlock({
        blockId: "a",
        centerText: "one\ntwo",
        resultStart: 0,
        resultEnd: 2,
      }),
      makeBlock({
        blockId: "b",
        centerText: "three",
        resultStart: 2,
        resultEnd: 3,
      }),
    ];
    expect(joinCenterText(blocks)).toBe("one\ntwo\nthree");
    const spans = buildCenterSpans(blocks);
    expect(spans[0]).toMatchObject({
      blockId: "a",
      startLine: 1,
      endLine: 2,
      lineCount: 2,
    });
    expect(spans[1]).toMatchObject({
      blockId: "b",
      startLine: 3,
      endLine: 3,
      lineCount: 1,
    });
  });

  it("skips empty result blocks in the joined text but keeps zero-line spans", () => {
    const blocks = [
      makeBlock({
        blockId: "a",
        centerText: "x",
        resultStart: 0,
        resultEnd: 1,
      }),
      makeBlock({
        blockId: "empty",
        centerText: "",
        resultStart: 1,
        resultEnd: 1,
      }),
      makeBlock({
        blockId: "c",
        centerText: "y",
        resultStart: 1,
        resultEnd: 2,
      }),
    ];
    expect(joinCenterText(blocks)).toBe("x\ny");
    expect(buildCenterSpans(blocks)[1]!.lineCount).toBe(0);
  });
});

describe("spanAtLine", () => {
  it("maps continuous line numbers to the owning block", () => {
    const spans = buildCenterSpans([
      makeBlock({
        blockId: "a",
        centerText: "1\n2",
        resultStart: 0,
        resultEnd: 2,
      }),
      makeBlock({
        blockId: "b",
        centerText: "3",
        resultStart: 2,
        resultEnd: 3,
      }),
    ]);
    expect(spanAtLine(spans, 1)?.blockId).toBe("a");
    expect(spanAtLine(spans, 2)?.blockId).toBe("a");
    expect(spanAtLine(spans, 3)?.blockId).toBe("b");
    expect(spanAtLine(spans, 99)).toBeNull();
  });
});

describe("applyMonacoChangeToSpans", () => {
  const base: CenterBlockSpan[] = [
    {
      blockId: "a",
      startLine: 1,
      endLine: 2,
      lineCount: 2,
      navigable: false,
      changeType: "unchanged",
      kind: "unchanged",
      resolved: true,
      centerText: "one\ntwo",
    },
    {
      blockId: "b",
      startLine: 3,
      endLine: 3,
      lineCount: 1,
      navigable: true,
      changeType: "modified",
      kind: "conflict",
      resolved: false,
      centerText: "three",
    },
  ];

  it("grows a block when a newline is inserted inside it", () => {
    // Insert "\n" at end of line 1 → adds one line within block a
    const { spans, affectedBlockIds } = applyMonacoChangeToSpans(
      base,
      1,
      1,
      "one\nextra",
    );
    expect(affectedBlockIds).toEqual(["a"]);
    expect(spans[0]).toMatchObject({
      startLine: 1,
      endLine: 3,
      lineCount: 3,
    });
    expect(spans[1]).toMatchObject({ startLine: 4, endLine: 4 });
  });

  it("shifts later blocks when an earlier block gains lines", () => {
    const { spans } = applyMonacoChangeToSpans(base, 2, 2, "two\nmore");
    expect(spans[1]!.startLine).toBe(4);
  });

  it("gives a whole-document replacement to the first block instead of dropping it", () => {
    const { spans, affectedBlockIds } = applyMonacoChangeToSpans(
      base,
      1,
      3,
      "only",
    );
    expect(affectedBlockIds.sort()).toEqual(["a", "b"]);
    expect(spans[0]).toMatchObject({ startLine: 1, endLine: 1, lineCount: 1 });
    expect(spans[1]).toMatchObject({ lineCount: 0, centerText: "" });
  });

  it("keeps the surviving tail of a block when a change ends inside it", () => {
    // Replace lines 1-2 (all of block a, none of b) with a single line.
    const { spans } = applyMonacoChangeToSpans(base, 1, 2, "merged");
    expect(spans[0]).toMatchObject({ startLine: 1, endLine: 1, lineCount: 1 });
    expect(spans[1]).toMatchObject({ startLine: 2, endLine: 2, lineCount: 1 });
  });

  it("applies multiple changes from bottom to top", () => {
    const { spans, affectedBlockIds } = applyMonacoChangesToSpans(base, [
      { range: { startLineNumber: 3, endLineNumber: 3 }, text: "THREE" },
      { range: { startLineNumber: 1, endLineNumber: 1 }, text: "ONE" },
    ]);
    expect(affectedBlockIds.sort()).toEqual(["a", "b"]);
    expect(spans[0]!.lineCount).toBe(2);
    expect(spans[1]!.lineCount).toBe(1);
  });
});

describe("extractSpanText", () => {
  it("reads contiguous lines for a span", () => {
    const lines = ["a", "b", "c"];
    const span: CenterBlockSpan = {
      blockId: "x",
      startLine: 1,
      endLine: 2,
      lineCount: 2,
      navigable: false,
      changeType: "unchanged",
      kind: "unchanged",
      resolved: true,
      centerText: "a\nb",
    };
    expect(
      extractSpanText((ln) => lines[ln - 1]!, lines.length, "a\nb\nc", span),
    ).toBe("a\nb");
  });
});
